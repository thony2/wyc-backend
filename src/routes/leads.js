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
} = require('../middleware/security');

router.post(
    '/leads',
    leadSubmissionLimiter,
    honeypotCheck,
    validateLeadSubmission,
    validateResult,
    leadController.create,
);

module.exports = router;
