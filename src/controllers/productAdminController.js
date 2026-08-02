'use strict';

/**
 * src/controllers/productAdminController.js
 *
 * Admin-only product/offer/stats/audit-log handlers, extracted from
 * routes/panel.js (5A step 3 — see MASTER_CHECKLIST.md). Mounted at
 * /api/panel in src/routes/panel.js, same paths as before.
 *
 * One change made during this move, beyond relocation: all 14 of this
 * file's original `res.status(500).json({ error: e.message })` calls
 * (routes/panel.js's share of the "error-handling inconsistency" finding
 * tracked in MASTER_CHECKLIST.md 5A) are replaced with logger.error
 * internally + a generic message externally, matching the pattern
 * leadController.js, adminController.js, and productPublicController.js
 * already used correctly. Response shape unchanged — still
 * `{ error: '...' }` on failure, not the leadController/adminController
 * `{ success, error }` envelope — admin/index.html's frontend code only
 * ever reads `data.error` as a generic string (confirmed by grep before
 * making this change), so tightening the message content is safe; changing
 * the envelope shape would not have been, and isn't done here.
 */

const db       = require('../config/database');
const logger   = require('../utils/logger');
const { auditProductAction, getClientIp } = require('../utils/auditLog');

async function getStats(req, res) {
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
        logger.error(`[Panel] getStats error: ${e.message}`);
        res.status(500).json({ error: 'Failed to load stats.' });
    }
}

async function getProduct(req, res) {
    try {
        const result = await db.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (e) {
        logger.error(`[Panel] getProduct error: ${e.message}`);
        res.status(500).json({ error: 'Failed to retrieve product.' });
    }
}

async function listProducts(req, res) {
    try {
        const result = await db.query('SELECT * FROM products ORDER BY created_at DESC');
        res.json(result.rows || []);
    } catch (e) {
        logger.error(`[Panel] listProducts error: ${e.message}`);
        res.status(500).json({ error: 'Failed to retrieve products.' });
    }
}

async function createProduct(req, res) {
    try {
        const {
            name, category_slug, subcategory, sku, price, original_price,
            stock_level, description, img_url, badge, badge_type, rooms,
            durability, softness, is_featured, is_deal, is_active,
            fitting_price, colours, features,
            colour_family, fibre, carpet_style, softness_label, thickness, density,
        } = req.body;

        if (!name || price == null) return res.status(400).json({ error: 'Name and price required' });

        const result = await db.query(
            `INSERT INTO products
                (name, category_slug, subcategory, sku, price, original_price,
                 stock_level, description, img_url, badge, badge_type, rooms,
                 durability, softness, is_featured, is_deal, is_active,
                 fitting_price, colours, features,
                 colour_family, fibre, carpet_style, softness_label, thickness, density)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
             RETURNING id`,
            [
                name, category_slug, subcategory || null, sku || null, price, original_price || null,
                stock_level || 0, description || null, img_url || null, badge || null, badge_type || null,
                rooms || '[]', durability || 3, softness || 3,
                is_featured || 0, is_deal || 0, is_active != null ? is_active : 1,
                fitting_price || 6.00, colours || '[]', features || '[]',
                colour_family || '', fibre || '', carpet_style || '',
                softness_label || '', thickness || '', density || '',
            ]
        );
        await auditProductAction(db, req.user, 'CREATE', 'products', result.rows[0]?.id, req.body, getClientIp(req));
        res.status(201).json({ id: result.rows[0]?.id, success: true });
    } catch (e) {
        logger.error(`[Panel] createProduct error: ${e.message}`);
        res.status(500).json({ error: 'Failed to create product.' });
    }
}

async function updateProduct(req, res) {
    try {
        const {
            name, category_slug, subcategory, sku, price, original_price,
            stock_level, description, img_url, badge, badge_type, rooms,
            durability, softness, is_featured, is_deal, is_active,
            fitting_price, colours, features,
            colour_family, fibre, carpet_style, softness_label, thickness, density,
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
                updated_at=NOW()
             WHERE id=$27`,
            [
                name, category_slug, subcategory || null, sku || null, price,
                original_price || null, stock_level || 0, description || null, img_url || null,
                badge || null, badge_type || null, rooms || '[]', durability || 3, softness || 3,
                is_featured || 0, is_deal || 0, is_active != null ? is_active : 1,
                fitting_price || 6.00, colours || '[]', features || '[]',
                colour_family || '', fibre || '', carpet_style || '',
                softness_label || '', thickness || '', density || '',
                req.params.id,
            ]
        );
        await auditProductAction(db, req.user, 'UPDATE', 'products', req.params.id, req.body, getClientIp(req));
        res.json({ success: true });
    } catch (e) {
        logger.error(`[Panel] updateProduct error: ${e.message}`);
        res.status(500).json({ error: 'Failed to update product.' });
    }
}

async function setProductVisibility(req, res) {
    try {
        const { is_active } = req.body;
        await db.query('UPDATE products SET is_active=$1, updated_at=NOW() WHERE id=$2', [is_active, req.params.id]);
        await auditProductAction(db, req.user, 'VISIBILITY', 'products', req.params.id, { is_active }, getClientIp(req));
        res.json({ success: true });
    } catch (e) {
        logger.error(`[Panel] setProductVisibility error: ${e.message}`);
        res.status(500).json({ error: 'Failed to update visibility.' });
    }
}

async function deleteProduct(req, res) {
    try {
        await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        await auditProductAction(db, req.user, 'DELETE', 'products', req.params.id, {}, getClientIp(req));
        res.json({ success: true });
    } catch (e) {
        logger.error(`[Panel] deleteProduct error: ${e.message}`);
        res.status(500).json({ error: 'Failed to delete product.' });
    }
}

async function setProductStock(req, res) {
    try {
        const { stock_level } = req.body;
        await db.query(
            'UPDATE products SET stock_level = $1, updated_at = NOW() WHERE id = $2',
            [stock_level, req.params.id]
        );
        await auditProductAction(db, req.user, 'STOCK_UPDATE', 'products', req.params.id, { stock_level }, getClientIp(req));
        res.json({ success: true });
    } catch (e) {
        logger.error(`[Panel] setProductStock error: ${e.message}`);
        res.status(500).json({ error: 'Failed to update stock.' });
    }
}

async function setProductPrice(req, res) {
    try {
        const { price } = req.body;
        await db.query(
            'UPDATE products SET price = $1, updated_at = NOW() WHERE id = $2',
            [price, req.params.id]
        );
        await auditProductAction(db, req.user, 'PRICE_UPDATE', 'products', req.params.id, { price }, getClientIp(req));
        res.json({ success: true });
    } catch (e) {
        logger.error(`[Panel] setProductPrice error: ${e.message}`);
        res.status(500).json({ error: 'Failed to update price.' });
    }
}

async function listOffers(req, res) {
    try {
        const result = await db.query(
            `SELECT o.*, p.name AS product_name
             FROM offers o
             LEFT JOIN products p ON o.product_id = p.id
             ORDER BY o.created_at DESC`
        );
        res.json(result.rows || []);
    } catch (e) {
        logger.error(`[Panel] listOffers error: ${e.message}`);
        res.status(500).json({ error: 'Failed to retrieve offers.' });
    }
}

async function createOffer(req, res) {
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
        await auditProductAction(db, req.user, 'CREATE_OFFER', 'offers', null, req.body, getClientIp(req));
        res.status(201).json({ success: true });
    } catch (e) {
        logger.error(`[Panel] createOffer error: ${e.message}`);
        res.status(500).json({ error: 'Failed to create offer.' });
    }
}

async function deleteOffer(req, res) {
    try {
        await db.query('DELETE FROM offers WHERE id = $1', [req.params.id]);
        await auditProductAction(db, req.user, 'DELETE_OFFER', 'offers', req.params.id, {}, getClientIp(req));
        res.json({ success: true });
    } catch (e) {
        logger.error(`[Panel] deleteOffer error: ${e.message}`);
        res.status(500).json({ error: 'Failed to delete offer.' });
    }
}

async function listAuditLog(req, res) {
    try {
        const result = await db.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100');
        res.json(result.rows || []);
    } catch (e) {
        logger.error(`[Panel] listAuditLog error: ${e.message}`);
        res.status(500).json({ error: 'Failed to retrieve audit log.' });
    }
}

module.exports = {
    getStats, getProduct, listProducts, createProduct, updateProduct,
    setProductVisibility, deleteProduct, setProductStock, setProductPrice,
    listOffers, createOffer, deleteOffer, listAuditLog,
};
