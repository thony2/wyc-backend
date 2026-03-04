/**
 * ============================================================
 * West Yorkshire Carpets — Lead Routes (Public)
 * src/routes/leads.js
 *
 * Public endpoints:
 *   GET  /api/csrf-token    — Fetch CSRF token (required before POST)
 *   POST /api/leads         — Submit a new lead
 * ============================================================
 */

'use strict';

const router         = require('express').Router();
const leadController = require('../controllers/leadController');
const {
    validateLeadSubmission,
    validateResult,
    honeypotCheck,
}                    = require('../middleware/validate');
const {
    leadSubmissionLimiter,
    csrfTokenGenerator,
    csrfValidator,
}                    = require('../middleware/security');


// ── GET /api/csrf-token ──────────────────────────────────────
// Frontend must call this once per session before submitting the form.
// Sets an HttpOnly-equivalent SameSite=Strict cookie and returns the token.

router.get('/csrf-token', csrfTokenGenerator, (req, res) => {
    return res.json({
        success: true,
        token:   req.csrfToken,
    });
});


// ── POST /api/leads ──────────────────────────────────────────
// Middleware chain (order is critical):
//   1. leadSubmissionLimiter  — reject if IP exceeds rate limit
//   2. csrfValidator          — verify CSRF token in header
//   3. honeypotCheck          — silently discard bot submissions
//   4. validateLeadSubmission — validate + sanitise all fields
//   5. validateResult         — return 422 if any validation failed
//   6. leadController.create  — persist to DB, fire email, return 201

router.post(
    '/leads',
    leadSubmissionLimiter,
    csrfValidator,
    honeypotCheck,
    validateLeadSubmission,
    validateResult,
    leadController.create,
);


module.exports = router;
