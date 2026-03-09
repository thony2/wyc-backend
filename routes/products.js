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

    // POST /api/products/:id/like — toggle like
    router.post('/:id/like', async (req, res) => {
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
            console.error('Like error:', e);
            res.status(500).json({ error: 'Server error' });
        }
    });

    return router;
};
