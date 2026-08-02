/**
 * ============================================================
 * West Yorkshire Carpets — Admin Panel Routes (Products, Offers, Auth)
 *
 * Mounted at /api/panel in server.js. Migrated from routes/panel.js
 * (5A consolidation, step 3 of 5 — see MASTER_CHECKLIST.md).
 * ============================================================
 */

'use strict';

const express         = require('express');
const rateLimit       = require('express-rate-limit');
const router          = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const authController  = require('../controllers/adminAuthController');
const productAdmin    = require('../controllers/productAdminController');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many login attempts. Please wait 15 minutes.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

// ── Auth ─────────────────────────────────────────────────────
router.post('/login', loginLimiter, authController.login);
router.post('/change-password', requireAuth, authController.changePassword);

// ── Stats ────────────────────────────────────────────────────
router.get('/stats', requireAuth, productAdmin.getStats);

// ── Products ─────────────────────────────────────────────────
router.get('/products/:id',            requireAuth, productAdmin.getProduct);
router.get('/products',                requireAuth, productAdmin.listProducts);
router.post('/products',               requireAuth, productAdmin.createProduct);
router.put('/products/:id',            requireAuth, productAdmin.updateProduct);
router.patch('/products/:id/visibility', requireAuth, productAdmin.setProductVisibility);
router.delete('/products/:id',         requireAuth, productAdmin.deleteProduct);
router.patch('/products/:id/stock',    requireAuth, productAdmin.setProductStock);
router.patch('/products/:id/price',    requireAuth, productAdmin.setProductPrice);

// ── Offers ───────────────────────────────────────────────────
router.get('/offers',      requireAuth, productAdmin.listOffers);
router.post('/offers',     requireAuth, productAdmin.createOffer);
router.delete('/offers/:id', requireAuth, productAdmin.deleteOffer);

// ── Audit log ────────────────────────────────────────────────
router.get('/audit', requireAuth, requireAdmin, productAdmin.listAuditLog);

module.exports = router;
