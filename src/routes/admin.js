'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET env var not set'); process.exit(1); }

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

async function audit(db, user, action, table, recordId, details) {
    try {
        await db.query(
            `INSERT INTO audit_log (lead_id, action, actor, detail, ip_address)
             VALUES ($1, $2, $3, $4, $5)`,
            [recordId || null, action, user.username, JSON.stringify({ table, ...details }), null]
        );
    } catch (e) {
        // Audit failures must never break the main request
    }
}


// POST /api/products/:id/like — increment like counter (public, no auth)
router.post('/products/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `UPDATE products SET likes = COALESCE(likes, 0) + 1 WHERE id = $1 RETURNING likes`,
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ likes: result.rows[0].likes });
    } catch (e) {
        console.error('Like error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = (db) => {

    const loginLimiter = require('express-rate-limit').rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: { error: 'Too many login attempts. Please wait 15 minutes.' },
        standardHeaders: 'draft-7',
        legacyHeaders: false,
    });

    router.post('/login', loginLimiter, async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

            const result = await db.query(
                'SELECT * FROM admin_users WHERE username = $1', [username]
            );
            const user = result.rows[0];

            if (!user || !bcrypt.compareSync(password, user.password_hash)) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            await db.query(
                'UPDATE admin_users SET last_login = NOW() WHERE id = $1', [user.id]
            );

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '8h' }
            );

            res.json({ token, username: user.username, role: user.role });
        } catch (e) {
            res.status(500).json({ error: 'Unexpected error' });
        }
    });

    router.get('/stats', requireAuth, async (req, res) => {
        try {
            const [products, deals, lowStock, enquiries] = await Promise.all([
                db.query(`SELECT COUNT(*) AS c FROM products WHERE is_active = 1`),
                db.query(`SELECT COUNT(*) AS c FROM offers WHERE is_active = 1 AND end_date >= TO_CHAR(CURRENT_DATE,'YYYY-MM-DD')`),
                db.query(`SELECT COUNT(*) AS c FROM products WHERE stock_level <= 5 AND is_active = 1`),
                db.query(`SELECT COUNT(*) AS c FROM leads`).catch(() => ({ rows: [{ c: 0 }] })),
            ]);

            res.json({
                total_products:  parseInt(products.rows[0]?.c  || 0),
                active_deals:    parseInt(deals.rows[0]?.c     || 0),
                low_stock:       parseInt(lowStock.rows[0]?.c  || 0),
                total_enquiries: parseInt(enquiries.rows[0]?.c || 0),
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/products/:id', requireAuth, async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
            if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
            res.json(result.rows[0]);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/products', requireAuth, async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM products ORDER BY created_at DESC');
            res.json(result.rows || []);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/products', requireAuth, async (req, res) => {
        try {
            const {
                name, category_slug, subcategory, sku, price, original_price,
                stock_level, description, img_url, badge, badge_type, rooms,
                durability, softness, is_featured, is_deal, is_active,
                fitting_price, colours, features,
                colour_family, fibre, carpet_style, softness_label, thickness, density,
                thickness_mm, wear_layer_mm, ac_rating, board_design,
                plank_width_mm, species_finish, surface_finish, lay_pattern,
                installation_method, ufh_compatible,
            } = req.body;

            if (!name || price == null) return res.status(400).json({ error: 'Name and price required' });

            const result = await db.query(
                `INSERT INTO products
                    (name, category_slug, subcategory, sku, price, original_price,
                     stock_level, description, img_url, badge, badge_type, rooms,
                     durability, softness, is_featured, is_deal, is_active,
                     fitting_price, colours, features,
                     colour_family, fibre, carpet_style, softness_label, thickness, density,
                     thickness_mm, wear_layer_mm, ac_rating, board_design,
                     plank_width_mm, species_finish, surface_finish, lay_pattern,
                     installation_method, ufh_compatible)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                         $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)
                 RETURNING id`,
                [
                    name, category_slug, subcategory || null, sku || null, price, original_price || null,
                    stock_level || 0, description || null, img_url || null, badge || null, badge_type || null,
                    rooms || '[]', durability || 3, softness || 3,
                    is_featured || 0, is_deal || 0, is_active != null ? is_active : 1,
                    fitting_price || 6.00, colours || '[]', features || '[]',
                    colour_family || '', fibre || '', carpet_style || '',
                    softness_label || '', thickness || '', density || '',
                    thickness_mm || null, wear_layer_mm || null, ac_rating || '',
                    board_design || '', plank_width_mm || null, species_finish || '',
                    surface_finish || '', lay_pattern || '', installation_method || '',
                    ufh_compatible || 0,
                ]
            );

            await audit(db, req.user, 'CREATE', 'products', result.rows[0]?.id, req.body);
            res.status(201).json({ id: result.rows[0]?.id, success: true });
        } catch (e) {
            console.error('[PRODUCT CREATE ERROR]', e);
            res.status(500).json({ error: e.message });
        }
    });

    router.put('/products/:id', requireAuth, async (req, res) => {
        try {
            const {
                name, category_slug, subcategory, sku, price, original_price,
                stock_level, description, img_url, badge, badge_type, rooms,
                durability, softness, is_featured, is_deal, is_active,
                fitting_price, colours, features,
                colour_family, fibre, carpet_style, softness_label, thickness, density,
                thickness_mm, wear_layer_mm, ac_rating, board_design,
                plank_width_mm, species_finish, surface_finish, lay_pattern,
                installation_method, ufh_compatible,
            } = req.body;

            await db.query(
                `UPDATE products SET
                    name=$1, category_slug=$2, subcategory=$3, sku=$4, price=$5,
                    original_price=$6, stock_level=$7, description=$8, img_url=$9,
                    badge=$10, badge_type=$11, rooms=$12, durability=$13, softness=$14,
                    is_featured=$15, is_deal=$16, is_active=$17,
                    fitting_price=$18, colours=$19, features=$20,
                    colour_family=$21, fibre=$22, carpet_style=$23,
                    softness_label=$24, thickness=$25, density=$26,
                    thickness_mm=$27, wear_layer_mm=$28, ac_rating=$29, board_design=$30,
                    plank_width_mm=$31, species_finish=$32, surface_finish=$33,
                    lay_pattern=$34, installation_method=$35, ufh_compatible=$36,
                    updated_at=NOW()
                 WHERE id=$37`,
                [
                    name, category_slug, subcategory || null, sku || null, price,
                    original_price || null, stock_level || 0, description || null, img_url || null,
                    badge || null, badge_type || null, rooms || '[]', durability || 3, softness || 3,
                    is_featured || 0, is_deal || 0, is_active != null ? is_active : 1,
                    fitting_price || 6.00, colours || '[]', features || '[]',
                    colour_family || '', fibre || '', carpet_style || '',
                    softness_label || '', thickness || '', density || '',
                    thickness_mm || null, wear_layer_mm || null, ac_rating || '',
                    board_design || '', plank_width_mm || null, species_finish || '',
                    surface_finish || '', lay_pattern || '', installation_method || '',
                    ufh_compatible || 0,
                    req.params.id,
                ]
            );

            await audit(db, req.user, 'UPDATE', 'products', req.params.id, req.body);
            res.json({ success: true });
        } catch (e) {
            console.error('[PRODUCT UPDATE ERROR]', e);
            res.status(500).json({ error: e.message });
        }
    });

    router.patch('/products/:id/visibility', requireAuth, async (req, res) => {
        try {
            const { is_active } = req.body;
            await db.query('UPDATE products SET is_active=$1, updated_at=NOW() WHERE id=$2', [is_active, req.params.id]);
            await audit(db, req.user, 'VISIBILITY', 'products', req.params.id, { is_active });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/products/:id', requireAuth, async (req, res) => {
        try {
            await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
            await audit(db, req.user, 'DELETE', 'products', req.params.id, {});
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.patch('/products/:id/stock', requireAuth, async (req, res) => {
        try {
            const { stock_level } = req.body;
            await db.query(
                'UPDATE products SET stock_level = $1, updated_at = NOW() WHERE id = $2',
                [stock_level, req.params.id]
            );
            await audit(db, req.user, 'STOCK_UPDATE', 'products', req.params.id, { stock_level });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.patch('/products/:id/price', requireAuth, async (req, res) => {
        try {
            const { price } = req.body;
            await db.query(
                'UPDATE products SET price = $1, updated_at = NOW() WHERE id = $2',
                [price, req.params.id]
            );
            await audit(db, req.user, 'PRICE_UPDATE', 'products', req.params.id, { price });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/offers', requireAuth, async (req, res) => {
        try {
            const result = await db.query(
                `SELECT o.*, p.name AS product_name
                 FROM offers o
                 LEFT JOIN products p ON o.product_id = p.id
                 ORDER BY o.created_at DESC`
            );
            res.json(result.rows || []);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/offers', requireAuth, async (req, res) => {
        try {
            const { product_id, offer_name, discounted_price, start_date, end_date, is_featured, is_active } = req.body;

            if (!offer_name || !end_date || discounted_price == null) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            if (end_date < start_date) {
                return res.status(400).json({ error: 'End date must be after start date' });
            }

            await db.query(
                `INSERT INTO offers (product_id, offer_name, discounted_price, start_date, end_date, is_featured, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [product_id, offer_name, discounted_price, start_date, end_date, is_featured || 0, is_active || 1]
            );

            await audit(db, req.user, 'CREATE_OFFER', 'offers', null, req.body);
            res.status(201).json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/offers/:id', requireAuth, async (req, res) => {
        try {
            await db.query('DELETE FROM offers WHERE id = $1', [req.params.id]);
            await audit(db, req.user, 'DELETE_OFFER', 'offers', req.params.id, {});
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/audit', requireAuth, requireAdmin, async (req, res) => {
        try {
            const result = await db.query(
                'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100'
            );
            res.json(result.rows || []);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/change-password', requireAuth, async (req, res) => {
        try {
            const { current_password, new_password } = req.body;

            if (!new_password || new_password.length < 8) {
                return res.status(400).json({ error: 'Minimum 8 characters required' });
            }

            const result = await db.query(
                'SELECT * FROM admin_users WHERE id = $1', [req.user.id]
            );
            const user = result.rows[0];

            if (!bcrypt.compareSync(current_password, user.password_hash)) {
                return res.status(401).json({ error: 'Current password incorrect' });
            }

            const hash = bcrypt.hashSync(new_password, 10);
            await db.query(
                'UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]
            );

            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};