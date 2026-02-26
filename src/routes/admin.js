/**
 * ============================================================
 * West Yorkshire Carpets — Admin Routes (Protected)
 * src/routes/admin.js
 *
 * All routes require: Authorization: Bearer <ADMIN_TOKEN>
 *
 * Endpoints:
 *   GET    /api/admin/dashboard              — Summary stats
 *   GET    /api/admin/leads                  — Paginated list
 *   GET    /api/admin/leads/export.csv       — CSV download
 *   GET    /api/admin/leads/:id              — Single lead + audit
 *   PATCH  /api/admin/leads/:id/status       — Update status
 *   DELETE /api/admin/leads/:id              — Anonymise / delete
 * ============================================================
 */

'use strict';

const router          = require('express').Router();
const crypto          = require('crypto');
const adminController = require('../controllers/adminController');
const logger          = require('../utils/logger');


// ── Admin Authentication Middleware ─────────────────────────
// Simple bearer token check. The ADMIN_TOKEN is set in .env
// and should be a cryptographically random 48+ character string.
//
// For a multi-user production system, replace with a proper
// JWT-based authentication flow with refresh tokens.

function requireAdminToken(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token      = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

    const adminToken = process.env.ADMIN_TOKEN;

    if (!adminToken) {
        logger.error('[Admin] ADMIN_TOKEN is not set in environment variables — all admin routes are blocked');
        return res.status(503).json({
            success: false,
            error:   'Admin access is not configured. Contact the system administrator.',
        });
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            error:   'Authentication required. Provide a Bearer token.',
        });
    }

    // Constant-time comparison prevents timing attacks
    const tokenBuf = Buffer.from(token);
    const adminBuf = Buffer.from(adminToken);

    if (
        tokenBuf.length !== adminBuf.length ||
        !crypto.timingSafeEqual(tokenBuf, adminBuf)
    ) {
        logger.warn(`[Admin] Invalid token attempt from IP: ${req.ip}`);
        return res.status(403).json({
            success: false,
            error:   'Invalid authentication token.',
        });
    }

    next();
}


// ── Apply auth middleware to all routes in this file ─────────
router.use(requireAdminToken);


// ── Routes ───────────────────────────────────────────────────

// Summary dashboard statistics
router.get('/dashboard', adminController.getDashboard);

// CSV export (must come before /:id to avoid "export.csv" matching as an ID)
router.get('/leads/export.csv', adminController.exportCsv);

// Paginated leads list
// Query params: ?page=1&limit=20&status=new
router.get('/leads', adminController.listLeads);

// Single lead detail + audit log
router.get('/leads/:id', adminController.getLead);

// Update lead status
// Body: { "status": "contacted" | "quoted" | "won" | "lost" | "spam" }
router.patch('/leads/:id/status', adminController.updateStatus);

// Soft-anonymise (GDPR) or hard-delete (with ?hard=true) a lead
router.delete('/leads/:id', adminController.deleteLead);


module.exports = router;
