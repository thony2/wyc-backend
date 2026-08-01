/**
 * ============================================================
 * West Yorkshire Carpets — Admin Routes (Protected)
 *
 * All routes require: Authorization: Bearer <JWT>
 * JWT is issued by POST /api/panel/login (routes/panel.js — moves to
 * src/routes/auth.js in a later step of the 5A consolidation)
 * ============================================================
 */

'use strict';

const router          = require('express').Router();
const adminController = require('../controllers/adminController');
const { requireAuth }  = require('../middleware/auth');

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
