'use strict';
const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const router     = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'wyc-change-this-secret-in-production';

function requireAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorised' });
    try { req.user = jwt.verify(token, JWT_SECRET); next(); }
    catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
}

async function audit(db, user, action, table, recordId, details) {
    try {
        await db.prepare(
            'INSERT INTO audit_log (user_id,username,action,table_name,record_id,details) VALUES (?,?,?,?,?,?)'
        ).run(user.id, user.username, action, table, recordId, JSON.stringify(details));
    } catch(e) {
        console.error('[Audit] Failed:', e.message);
    }
}

module.exports = (db) => {

    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
            const user = await db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
            if (!user || !bcrypt.compareSync(password, user.password_hash))
                return res.status(401).json({ error: 'Invalid username or password' });
            await db.prepare('UPDATE admin_users SET last_login = NOW() WHERE id = ?').run(user.id);
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '8h' }
            );
            res.json({ token, username: user.username, role: user.role });
        } catch(e) {
            console.error('[Login]', e.message);
            res.status(500).json({ error: 'Unexpected error' });
        }
    });

    router.get('/stats', requireAuth, async (req, res) => {
        try {
            const products = await db.prepare(
                'SELECT COUNT(*) as c FROM products WHERE is_active=1'
            ).get();
            const deals = await db.prepare(
                "SELECT COUNT(*) as c FROM offers WHERE is_active=1 AND end_date >= TO_CHAR(CURRENT_DATE,'YYYY-MM-DD')"
            ).get();
            const lowStock = await db.prepare(
                'SELECT COUNT(*) as c FROM products WHERE stock_level <= 5 AND is_active=1'
            ).get();
            let enquiries = { c: 0 };
            try {
                enquiries = await db.prepare('SELECT COUNT(*) as c FROM leads').get();
            } catch(e) { /* leads table may not exist yet */ }
            res.json({
                total_products:  parseInt(products?.c  || products?.count  || 0),
                active_deals:    parseInt(deals?.c     || deals?.count     || 0),
                low_stock:       parseInt(lowStock?.c  || lowStock?.count  || 0),
                total_enquiries: parseInt(enquiries?.c || enquiries?.count || 0),
            });
        } catch(e) {
            console.error('[Stats]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/products', requireAuth, async (req, res) => {
        try {
            const rows = await db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
            res.json(rows || []);
        } catch(e) {
            console.error('[Products GET]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/products', requireAuth, async (req, res) => {
        try {
            const {
                name, category_slug, subcategory, sku, price, original_price,
                stock_level, description, img_url, badge, badge_type, rooms,
                durability, softness, is_featured, is_deal, is_active
            } = req.body;
            if (!name || price == null) return res.status(400).json({ error: 'Name and price required' });
            const result = await db.prepare(
                `INSERT INTO products
                    (name,category_slug,subcategory,sku,price,original_price,
                     stock_level,description,img_url,badge,badge_type,rooms,
                     durability,softness,is_featured,is_deal,is_active)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                 RETURNING id`
            ).get(
                name, category_slug, subcategory||null, sku||null, price, original_price||null,
                stock_level||0, description||null, img_url||null, badge||null, badge_type||null,
                rooms||'[]', durability||3, softness||3, is_featured||0, is_deal||0,
                is_active != null ? is_active : 1
            );
            await audit(db, req.user, 'CREATE', 'products', result?.id, req.body);
            res.status(201).json({ id: result?.id, success: true });
        } catch(e) {
            console.error('[Products POST]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.put('/products/:id', requireAuth, async (req, res) => {
        try {
            const {
                name, category_slug, subcategory, sku, price, original_price,
                stock_level, description, img_url, badge, badge_type, rooms,
                durability, softness, is_featured, is_deal, is_active
            } = req.body;
            await db.prepare(
                `UPDATE products SET
                    name=?,category_slug=?,subcategory=?,sku=?,price=?,original_price=?,
                    stock_level=?,description=?,img_url=?,badge=?,badge_type=?,rooms=?,
                    durability=?,softness=?,is_featured=?,is_deal=?,is_active=?,updated_at=NOW()
                 WHERE id=?`
            ).run(
                name, category_slug, subcategory||null, sku||null, price, original_price||null,
                stock_level||0, description||null, img_url||null, badge||null, badge_type||null,
                rooms||'[]', durability||3, softness||3, is_featured||0, is_deal||0,
                is_active != null ? is_active : 1,
                req.params.id
            );
            await audit(db, req.user, 'UPDATE', 'products', req.params.id, req.body);
            res.json({ success: true });
        } catch(e) {
            console.error('[Products PUT]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/products/:id', requireAuth, async (req, res) => {
        try {
            await db.prepare('UPDATE products SET is_active=0 WHERE id=?').run(req.params.id);
            await audit(db, req.user, 'DELETE', 'products', req.params.id, {});
            res.json({ success: true });
        } catch(e) {
            console.error('[Products DELETE]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.patch('/products/:id/stock', requireAuth, async (req, res) => {
        try {
            const { stock_level } = req.body;
            await db.prepare('UPDATE products SET stock_level=?,updated_at=NOW() WHERE id=?').run(stock_level, req.params.id);
            await audit(db, req.user, 'STOCK_UPDATE', 'products', req.params.id, { stock_level });
            res.json({ success: true });
        } catch(e) {
            console.error('[Stock]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.patch('/products/:id/price', requireAuth, async (req, res) => {
        try {
            const { price } = req.body;
            await db.prepare('UPDATE products SET price=?,updated_at=NOW() WHERE id=?').run(price, req.params.id);
            await audit(db, req.user, 'PRICE_UPDATE', 'products', req.params.id, { price });
            res.json({ success: true });
        } catch(e) {
            console.error('[Price]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/offers', requireAuth, async (req, res) => {
        try {
            const rows = await db.prepare(
                `SELECT o.*, p.name as product_name FROM offers o
                 LEFT JOIN products p ON o.product_id = p.id
                 ORDER BY o.created_at DESC`
            ).all();
            res.json(rows || []);
        } catch(e) {
            console.error('[Offers GET]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/offers', requireAuth, async (req, res) => {
        try {
            const { product_id, offer_name, discounted_price, start_date, end_date, is_featured, is_active } = req.body;
            if (!offer_name || !end_date || discounted_price == null)
                return res.status(400).json({ error: 'Missing required fields' });
            if (end_date < start_date)
                return res.status(400).json({ error: 'End date must be after start date' });
            await db.prepare(
                `INSERT INTO offers (product_id,offer_name,discounted_price,start_date,end_date,is_featured,is_active)
                 VALUES (?,?,?,?,?,?,?)`
            ).run(product_id, offer_name, discounted_price, start_date, end_date, is_featured||0, is_active||1);
            await audit(db, req.user, 'CREATE_OFFER', 'offers', null, req.body);
            res.status(201).json({ success: true });
        } catch(e) {
            console.error('[Offers POST]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/offers/:id', requireAuth, async (req, res) => {
        try {
            await db.prepare('DELETE FROM offers WHERE id=?').run(req.params.id);
            await audit(db, req.user, 'DELETE_OFFER', 'offers', req.params.id, {});
            res.json({ success: true });
        } catch(e) {
            console.error('[Offers DELETE]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/audit', requireAuth, requireAdmin, async (req, res) => {
        try {
            const rows = await db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100').all();
            res.json(rows || []);
        } catch(e) {
            console.error('[Audit GET]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/change-password', requireAuth, async (req, res) => {
        try {
            const { current_password, new_password } = req.body;
            if (!new_password || new_password.length < 8)
                return res.status(400).json({ error: 'Minimum 8 characters required' });
            const user = await db.prepare('SELECT * FROM admin_users WHERE id=?').get(req.user.id);
            if (!bcrypt.compareSync(current_password, user.password_hash))
                return res.status(401).json({ error: 'Current password incorrect' });
            const hash = bcrypt.hashSync(new_password, 10);
            await db.prepare('UPDATE admin_users SET password_hash=? WHERE id=?').run(hash, req.user.id);
            res.json({ success: true });
        } catch(e) {
            console.error('[Password]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};