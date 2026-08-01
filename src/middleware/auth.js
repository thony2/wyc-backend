'use strict';

/**
 * src/middleware/auth.js
 *
 * Single shared JWT auth guard for every admin/protected route.
 *
 * Replaces three previously-duplicated, independently-drifting copies of the
 * same logic: src/routes/authGuard.js, routes/panel.js, routes/scraper.js.
 * (5A consolidation, see MASTER_CHECKLIST.md.) All three copies verified the
 * same JWT with the same secret and near-identical logic, but any future
 * change to auth behaviour had to be applied three times by hand. This is
 * the one place that now needs to change.
 *
 * requireAuth attaches the decoded token payload to req.user — every route
 * handler and the audit() helpers that read req.user.id / req.user.username /
 * req.user.role depend on that exact property name.
 */

const jwt     = require('jsonwebtoken');
const logger  = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    logger.error('FATAL: JWT_SECRET env var not set');
    process.exit(1);
}

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
        // Pinning the algorithm closes a class of attack that's low-risk here
        // (single symmetric secret, no asymmetric key involved) but is a
        // zero-cost hardening now that there's only one place to add it.
        req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        next();
    } catch (e) {
        logger.warn(`[Auth] Invalid JWT attempt from IP: ${req.ip}`);
        return res.status(401).json({
            success: false,
            error:   'Invalid or expired token. Please log in again.',
        });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Forbidden.' });
    }
    next();
}

module.exports = { requireAuth, requireAdmin };
