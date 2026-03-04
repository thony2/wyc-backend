'use strict';

const router          = require('express').Router();
const jwt             = require('jsonwebtoken');
const adminController = require('../controllers/adminController');
const logger          = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'wyc-change-this-secret-in-production';

function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        logger.warn(`[Admin] Invalid JWT from IP: ${req.ip}`);
        return res.status(401).json({ success: false, error: 'Invalid or expired token. Please log in again.' });
    }
}

router.use(requireAuth);

router.get('/dashboard',           adminController.getDashboard);
router.get('/leads/export.csv',    adminController.exportCsv);
router.get('/leads/calendar',      adminController.getCalendar);
router.get('/calendar',            adminController.getCalendar);
router.get('/leads',               adminController.listLeads);
router.get('/leads/:id',           adminController.getLead);
router.patch('/leads/:id/status',  adminController.updateStatus);
router.patch('/leads/:id/booking', adminController.setBooking);
router.delete('/leads/:id',        adminController.deleteLead);

module.exports = router;
