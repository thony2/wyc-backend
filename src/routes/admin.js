/**
 * ============================================================
 * West Yorkshire Carpets — Admin Routes (Protected)
 * src/routes/admin.js
 *
 * All routes require: Authorization: Bearer <JWT>
 * JWT is issued by /api/panel/login (routes/admin.js)
 * ============================================================
 */

'use strict';

const router          = require('express').Router();
const jwt             = require('jsonwebtoken');
const adminController = require('../controllers/adminController');
const logger          = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    logger.error('FATAL: JWT_SECRET env var not set');
    process.exit(1);
}
// ── JWT Auth Middleware ──────────────────────────────────────
// Accepts the same JWT issued by /api/panel/login
// so one login works for both leads and products.

function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            error:   'Authentication required.',
        });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch(e) {
        logger.warn(`[Admin] Invalid JWT attempt from IP: ${req.ip}`);
        return res.status(401).json({
            success: false,
            error:   'Invalid or expired token. Please log in again.',
        });
    }
}

// ── Apply auth to all routes ─────────────────────────────────
router.use(requireAuth);

// ── Routes ───────────────────────────────────────────────────
router.get('/dashboard',          adminController.getDashboard);
router.get('/leads/export.csv',   adminController.exportCsv);
router.get('/leads',              adminController.listLeads);
router.get('/leads/:id',          adminController.getLead);
router.patch('/leads/:id/status', adminController.updateStatus);
router.patch('/leads/:id/booking',adminController.setBooking);
router.get('/calendar',           adminController.getCalendar);
router.delete('/leads/:id',       adminController.deleteLead);

module.exports = router;
