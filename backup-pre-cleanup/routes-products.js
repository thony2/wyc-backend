'use strict';
const express = require('express');
const router  = express.Router();

module.exports = (db) => {

    router.get('/', async (req, res) => {
        try {
            const { category, deals } = req.query;
            let query = 'SELECT * FROM products WHERE is_active = 1';
            const params = [];
            if (category && category !== 'all') {
                query += ' AND category_slug = ?';
                params.push(category);
            }
            if (deals === 'true') {
                query += ' AND is_deal = 1';
            }
            query += ' ORDER BY is_featured DESC, id ASC';
            const rows = await db.prepare(query).all(...params);
            res.json(rows || []);
        } catch(e) {
            console.error('[Products public]', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/categories', async (req, res) => {
        try {
            const rows = await db.prepare('SELECT * FROM categories ORDER BY display_order ASC').all();
            res.json(rows || []);
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/deals', async (req, res) => {
        try {
            const rows = await db.prepare(
                `SELECT p.*, o.offer_name, o.discounted_price
                 FROM products p
                 LEFT JOIN offers o ON o.product_id = p.id
                     AND o.is_active = 1
                     AND CURRENT_DATE BETWEEN o.start_date::date AND o.end_date::date
                 WHERE p.is_active = 1 AND p.is_deal = 1
                 ORDER BY p.is_featured DESC`
            ).all();
            res.json(rows || []);
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
