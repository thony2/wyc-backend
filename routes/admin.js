/* ── ADMIN API — authenticated write operations ── */
const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const router    = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'wyc-change-this-secret-in-production';

/* ── AUTH MIDDLEWARE ── */
function requireAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorised' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
}

/* ── AUDIT LOG HELPER ── */
function audit(db, user, action, table, recordId, details) {
    db.prepare(`
        INSERT INTO audit_log (user_id, username, action, table_name, record_id, details)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.id, user.username, action, table, recordId, JSON.stringify(details));
}

module.exports = (db) => {

    /* ── LOGIN ── */
    router.post('/login', (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

        const user = db.prepare(`SELECT * FROM admin_users WHERE username = ?`).get(username);
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        db.prepare(`UPDATE admin_users SET last_login = datetime('now') WHERE id = ?`).run(user.id);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        res.json({ token, username: user.username, role: user.role });
    });

    /* ── DASHBOARD STATS ── */
    router.get('/stats', requireAuth, (req, res) => {
        res.json({
            total_products:  db.prepare(`SELECT COUNT(*) as c FROM products WHERE is_active=1`).get().c,
            active_deals:    db.prepare(`SELECT COUNT(*) as c FROM products WHERE is_deal=1 AND is_active=1`).get().c,
            low_stock:       db.prepare(`SELECT COUNT(*) as c FROM products WHERE stock_level <= 5 AND is_active=1`).get().c,
            total_leads:     db.prepare(`SELECT COUNT(*) as c FROM leads`).get()?.c || 0,
            recent_changes:  db.prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5`).all(),
            low_stock_items: db.prepare(`SELECT id, name, stock_level, category_slug FROM products WHERE stock_level <= 5 AND is_active=1`).all(),
        });
    });

    /* ── GET ALL PRODUCTS (admin view) ── */
    router.get('/products', requireAuth, (req, res) => {
        res.json(db.prepare(`SELECT * FROM products ORDER BY category_slug, name`).all());
    });

    /* ── CREATE PRODUCT ── */
    router.post('/products', requireAuth, (req, res) => {
        const p = req.body;
        if (!p.name || !p.category_slug || p.price == null) {
            return res.status(400).json({ error: 'name, category_slug and price are required' });
        }
        if (p.price < 0) return res.status(400).json({ error: 'Price cannot be negative' });

        const result = db.prepare(`
            INSERT INTO products
            (name, category_slug, subcategory, sku, price, original_price,
             stock_level, description, img_url, badge, badge_type,
             rooms, durability, softness, is_featured, is_deal, is_active)
            VALUES
            (@name,@category_slug,@subcategory,@sku,@price,@original_price,
             @stock_level,@description,@img_url,@badge,@badge_type,
             @rooms,@durability,@softness,@is_featured,@is_deal,@is_active)
        `).run(p);

        audit(db, req.user, 'CREATE', 'products', result.lastInsertRowid, p);
        res.status(201).json({ id: result.lastInsertRowid });
    });

    /* ── UPDATE PRODUCT ── */
    router.put('/products/:id', requireAuth, (req, res) => {
        const p = req.body;
        const { id } = req.params;
        if (p.price != null && p.price < 0) return res.status(400).json({ error: 'Price cannot be negative' });

        db.prepare(`
            UPDATE products SET
                name=@name, category_slug=@category_slug, subcategory=@subcategory,
                sku=@sku, price=@price, original_price=@original_price,
                stock_level=@stock_level, description=@description,
                img_url=@img_url, badge=@badge, badge_type=@badge_type,
                rooms=@rooms, durability=@durability, softness=@softness,
                is_featured=@is_featured, is_deal=@is_deal, is_active=@is_active,
                updated_at=datetime('now')
            WHERE id=@id
        `).run({ ...p, id });

        audit(db, req.user, 'UPDATE', 'products', id, p);
        res.json({ success: true });
    });

    /* ── DELETE PRODUCT (soft delete) ── */
    router.delete('/products/:id', requireAuth, (req, res) => {
        db.prepare(`UPDATE products SET is_active=0, updated_at=datetime('now') WHERE id=?`).run(req.params.id);
        audit(db, req.user, 'DELETE', 'products', req.params.id, {});
        res.json({ success: true });
    });

    /* ── QUICK STOCK UPDATE ── */
    router.patch('/products/:id/stock', requireAuth, (req, res) => {
        const { stock_level } = req.body;
        if (stock_level < 0) return res.status(400).json({ error: 'Stock cannot be negative' });
        db.prepare(`UPDATE products SET stock_level=?, updated_at=datetime('now') WHERE id=?`)
          .run(stock_level, req.params.id);
        audit(db, req.user, 'STOCK_UPDATE', 'products', req.params.id, { stock_level });
        res.json({ success: true });
    });

    /* ── QUICK PRICE UPDATE ── */
    router.patch('/products/:id/price', requireAuth, (req, res) => {
        const { price } = req.body;
        if (price < 0) return res.status(400).json({ error: 'Price cannot be negative' });
        db.prepare(`UPDATE products SET price=?, updated_at=datetime('now') WHERE id=?`)
          .run(price, req.params.id);
        audit(db, req.user, 'PRICE_UPDATE', 'products', req.params.id, { price });
        res.json({ success: true });
    });

    /* ── OFFERS ── */
    router.get('/offers', requireAuth, (req, res) => {
        res.json(db.prepare(`
            SELECT o.*, p.name as product_name FROM offers o
            JOIN products p ON p.id = o.product_id
            ORDER BY o.created_at DESC
        `).all());
    });

    router.post('/offers', requireAuth, (req, res) => {
        const o = req.body;
        if (!o.product_id || !o.offer_name || !o.discounted_price || !o.start_date || !o.end_date) {
            return res.status(400).json({ error: 'All offer fields are required' });
        }
        if (new Date(o.end_date) < new Date(o.start_date)) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }
        const result = db.prepare(`
            INSERT INTO offers (product_id, offer_name, discounted_price, start_date, end_date, is_featured, is_active)
            VALUES (@product_id,@offer_name,@discounted_price,@start_date,@end_date,@is_featured,@is_active)
        `).run(o);
        audit(db, req.user, 'CREATE_OFFER', 'offers', result.lastInsertRowid, o);
        res.status(201).json({ id: result.lastInsertRowid });
    });

    router.delete('/offers/:id', requireAuth, (req, res) => {
        db.prepare(`DELETE FROM offers WHERE id=?`).run(req.params.id);
        audit(db, req.user, 'DELETE_OFFER', 'offers', req.params.id, {});
        res.json({ success: true });
    });

    /* ── AUDIT LOG ── */
    router.get('/audit', requireAuth, requireAdmin, (req, res) => {
        res.json(db.prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100`).all());
    });

    /* ── CHANGE PASSWORD ── */
    router.post('/change-password', requireAuth, (req, res) => {
        const { current_password, new_password } = req.body;
        if (!new_password || new_password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        const user = db.prepare(`SELECT * FROM admin_users WHERE id=?`).get(req.user.id);
        if (!bcrypt.compareSync(current_password, user.password_hash)) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        db.prepare(`UPDATE admin_users SET password_hash=? WHERE id=?`)
          .run(bcrypt.hashSync(new_password, 10), req.user.id);
        res.json({ success: true });
    });

    return router;
};