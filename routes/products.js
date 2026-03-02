/* ── PUBLIC PRODUCTS API — read only ── */
const express = require('express');
const router  = express.Router();

module.exports = (db) => {

    // GET /api/products — all active products
    router.get('/', (req, res) => {
        const { category, deals } = req.query;
        let query = `SELECT * FROM products WHERE is_active = 1`;
        const params = [];
        if (category && category !== 'all') {
            query += ` AND category_slug = ?`;
            params.push(category);
        }
        if (deals === 'true') {
            query += ` AND is_deal = 1`;
        }
        query += ` ORDER BY is_featured DESC, id ASC`;
        res.json(db.prepare(query).all(...params));
    });

    // GET /api/products/categories
    router.get('/categories', (req, res) => {
        res.json(db.prepare(
            `SELECT * FROM categories ORDER BY display_order ASC`
        ).all());
    });

    // GET /api/products/deals — active deals only
    router.get('/deals', (req, res) => {
        res.json(db.prepare(
            `SELECT p.*, o.offer_name, o.discounted_price
             FROM products p
             LEFT JOIN offers o ON o.product_id = p.id
                 AND o.is_active = 1
                 AND date('now') BETWEEN o.start_date AND o.end_date
             WHERE p.is_active = 1 AND p.is_deal = 1
             ORDER BY p.is_featured DESC`
        ).all());
    });

    return router;
};