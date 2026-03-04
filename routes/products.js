'use strict';

const express = require('express');
const router  = express.Router();

module.exports = (db) => {

    router.get('/', async (req, res) => {
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
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/categories', async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM categories ORDER BY display_order ASC');
            res.json(result.rows || []);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/deals', async (req, res) => {
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
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
