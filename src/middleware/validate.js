'use strict';

const { body, validationResult } = require('express-validator');

const UK_PHONE_REGEX    = /^(?:(?:\+44\s?|0)(?:7\d{3}|\d{4})\s?\d{3,6}(?:\s?\d{3,4})?)$/;
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
const NAME_REGEX        = /^[a-zA-Z\s'\-\.]{2,80}$/;

const VALID_SERVICES = [
    'Carpet Fitting',
    'Vinyl Installation',
    'Laminate / Wood',
    'Not sure yet — need advice',
];

const validateLeadSubmission = [
    body('name')
        .trim()
        .notEmpty().withMessage('Full name is required.')
        .matches(NAME_REGEX).withMessage('Please enter a valid name (letters, spaces, hyphens and apostrophes only).')
        .isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters.')
        .escape(),

    body('email')
        .optional({ checkFalsy: true })
        .trim()
        .isEmail().withMessage('Please enter a valid email address.')
        .isLength({ max: 254 }).withMessage('Email address is too long.')
        .normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),

    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required.')
        .customSanitizer(v => v.replace(/[\s\-().]/g, ''))
        .matches(UK_PHONE_REGEX).withMessage('Please enter a valid UK phone number (e.g. 07700 900000).')
        .escape(),

    body('postcode')
        .trim()
        .notEmpty().withMessage('Postcode is required.')
        .toUpperCase()
        .matches(UK_POSTCODE_REGEX).withMessage('Please enter a valid UK postcode (e.g. LS1 1AA).')
        .escape(),

    body('service_type')
        .optional({ checkFalsy: true })
        .trim()
        .isIn(VALID_SERVICES).withMessage('Invalid service type selected.')
        .escape(),

    body('message')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 2000 }).withMessage('Message must not exceed 2,000 characters.')
        .escape(),

    body('gdpr_consent')
        .optional({ checkFalsy: true })
        .isBoolean().withMessage('Invalid consent value.'),

    body('room_length_m')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0.5, max: 100 }).withMessage('Room length must be between 0.5 and 100 metres.')
        .toFloat(),

    body('room_width_m')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0.5, max: 100 }).withMessage('Room width must be between 0.5 and 100 metres.')
        .toFloat(),

    body('flooring_type')
        .optional({ checkFalsy: true })
        .trim()
        .isIn(['carpet_budget', 'carpet_premium', 'vinyl', 'laminate', 'wood', '']).withMessage('Invalid flooring type.')
        .escape(),

    body('include_underlay')
        .optional({ checkFalsy: true })
        .isBoolean().withMessage('Invalid underlay option.')
        .toBoolean(),

    body('include_fitting')
        .optional({ checkFalsy: true })
        .isBoolean().withMessage('Invalid fitting option.')
        .toBoolean(),

    body('estimated_cost')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 1_000_000 }).withMessage('Invalid estimated cost.')
        .toFloat(),
];

function validateResult(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false,
            error:   'Please check the highlighted fields and try again.',
            fields:  errors.array().map(err => ({ field: err.path || err.param, message: err.msg })),
        });
    }
    next();
}

function honeypotCheck(req, res, next) {
    const honeypot = req.body['website'] || req.body['url'] || '';
    if (honeypot.trim().length > 0) {
        return res.status(200).json({ success: true, message: "Thank you! We'll be in touch shortly." });
    }
    next();
}

module.exports = { validateLeadSubmission, validateResult, honeypotCheck };
