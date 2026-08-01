'use strict';

/**
 * src/controllers/productPublicController.js
 *
 * Public, unauthenticated product endpoints — mounted at /api/products.
 * Migrated from routes/products.js (5A consolidation, step 2 of 5 — see
 * MASTER_CHECKLIST.md). Response shapes are unchanged from the original:
 * raw arrays/objects on success, `{ error: '...' }` on failure — no
 * `{ success, data }` envelope, unlike the admin controllers. This is
 * a deliberate compatibility constraint, not an oversight: js/catalogue.js
 * and js/product-page.js consume this exact contract directly and are not
 * being touched as part of this migration.
 *
 * What did change: the original routes/products.js returned raw
 * `e.message` to the client on 3 of its 5 endpoints (flagged in
 * MASTER_CHECKLIST.md, 5A, fourth audit 26 Jul). Unlike the admin/panel
 * leak (authenticated admins only), this one is public-facing, so it's
 * arguably worth fixing sooner, not later. Fixed here to match the
 * pattern the other 2 endpoints already used correctly: log the real
 * error internally, return a generic message to the client.
 */

const db     = require('../config/database');
const logger = require('../utils/logger');

async function listProducts(req, res) {
    try {
        const { category, deals } = req.query;
        let sql = 'SELECT * FROM products WHERE is_active = 1';
        const params = [];

        if (category && category !== 'all') {
            params.push(category);
            sql += ` AND category_slug = $${params.length}`;
        }

        if (deals === 'true') {
            sql += ' AND is_deal = 1';
        }

        sql += ' ORDER BY is_featured DESC, id ASC';

        const result = await db.query(sql, params);
        res.json(result.rows || []);
    } catch (e) {
        logger.error(`[Products] listProducts error: ${e.message}`);
        res.status(500).json({ error: 'Server error' });
    }
}

async function listCategories(req, res) {
    try {
        const result = await db.query('SELECT * FROM categories ORDER BY display_order ASC');
        res.json(result.rows || []);
    } catch (e) {
        logger.error(`[Products] listCategories error: ${e.message}`);
        res.status(500).json({ error: 'Server error' });
    }
}

async function listDeals(req, res) {
    try {
        const result = await db.query(
            `SELECT p.*, o.offer_name, o.discounted_price
             FROM products p
             LEFT JOIN offers o ON o.product_id = p.id
                 AND o.is_active = 1
                 AND CURRENT_DATE BETWEEN o.start_date::date AND o.end_date::date
             WHERE p.is_active = 1 AND p.is_deal = 1
             ORDER BY p.is_featured DESC`
        );
        res.json(result.rows || []);
    } catch (e) {
        logger.error(`[Products] listDeals error: ${e.message}`);
        res.status(500).json({ error: 'Server error' });
    }
}

async function getLikes(req, res) {
    try {
        const result = await db.query(
            'SELECT COALESCE(likes, 0) AS likes FROM products WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ likes: result.rows[0].likes });
    } catch (e) {
        logger.error(`[Products] getLikes error: ${e.message}`);
        res.status(500).json({ error: 'Server error' });
    }
}

// This is the one surviving like/unlike implementation. It previously
// coexisted with a second, behaviourally different copy in routes/panel.js
// (POST /api/panel/products/:id/like — always-increment, no unlike). That
// copy is removed as part of this same change: confirmed by grepping
// admin/index.html, admin/js/*, and every public js/*.js file for any
// reference to the /api/panel path before removing it — none found. Only
// js/catalogue.js and js/product-page.js call the like endpoint, and both
// already call this one (/api/products/:id/like).
async function toggleLike(req, res) {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'like' or 'unlike'
        const delta = action === 'unlike' ? -1 : 1;
        const result = await db.query(
            `UPDATE products SET likes = GREATEST(COALESCE(likes,0) + $1, 0) WHERE id = $2 RETURNING likes`,
            [delta, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ likes: result.rows[0].likes });
    } catch (e) {
        logger.error(`[Products] toggleLike error: ${e.message}`);
        res.status(500).json({ error: 'Server error' });
    }
}

module.exports = { listProducts, listCategories, listDeals, getLikes, toggleLike };
