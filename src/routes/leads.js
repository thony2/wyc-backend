'use strict';

const router         = require('express').Router();
const leadController = require('../controllers/leadController');
const {
    validateLeadSubmission,
    validateResult,
    honeypotCheck,
} = require('../middleware/validate');
const {
    leadSubmissionLimiter,
    csrfTokenGenerator,
    csrfValidator,
} = require('../middleware/security');

router.get('/csrf-token', csrfTokenGenerator, (req, res) => {
    return res.json({ success: true, token: req.csrfToken });
});

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
