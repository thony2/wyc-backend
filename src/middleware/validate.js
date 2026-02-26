/**
 * ============================================================
 * West Yorkshire Carpets — Input Validation & Sanitisation
 * src/middleware/validate.js
 *
 * Uses express-validator for declarative validation chains.
 * Every field is:
 *   1. Trimmed (whitespace removed)
 *   2. Escaped / sanitised (XSS prevention)
 *   3. Validated against business rules
 *
 * The validateResult() middleware collects all errors from a
 * chain and returns them in a consistent format if any fail.
 * ============================================================
 */

'use strict';

const { body, validationResult } = require('express-validator');

// ── UK-specific regex patterns ───────────────────────────────

// UK phone: accepts 07xxx, 01xxx, 02xxx, +44, international with spaces/dashes
const UK_PHONE_REGEX   = /^(?:(?:\+44\s?|0)(?:7\d{3}|\d{4})\s?\d{3,6}(?:\s?\d{3,4})?)$/;

// UK postcode: covers all valid formats including overseas territories
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

// Name: allows hyphens and apostrophes for names like O'Brien, Smith-Jones
const NAME_REGEX        = /^[a-zA-Z\s'\-\.]{2,80}$/;

// Permitted service types (must match the <select> options in index.html)
const VALID_SERVICES = [
    'Carpet Fitting',
    'Vinyl Installation',
    'Laminate / Wood',
    'Not sure yet — need advice',
];


// ── Lead Submission Validation Chain ────────────────────────

const validateLeadSubmission = [

    // Full Name — required, 2–80 chars, safe characters only
    body('name')
        .trim()
        .notEmpty()
            .withMessage('Full name is required.')
        .matches(NAME_REGEX)
            .withMessage('Please enter a valid name (letters, spaces, hyphens and apostrophes only).')
        .isLength({ min: 2, max: 80 })
            .withMessage('Name must be between 2 and 80 characters.')
        .escape(),

    // Email — optional but validated if provided
    body('email')
        .optional({ checkFalsy: true })
        .trim()
        .isEmail()
            .withMessage('Please enter a valid email address.')
        .isLength({ max: 254 })
            .withMessage('Email address is too long.')
        .normalizeEmail({
            gmail_remove_dots:   false,  // Preserve dots: john.smith@gmail.com ≠ johnsmith@gmail.com
            gmail_remove_subaddress: false,
        }),

    // Phone — required, UK format
    body('phone')
        .trim()
        .notEmpty()
            .withMessage('Phone number is required.')
        .customSanitizer(v => v.replace(/[\s\-().]/g, '')) // Strip spacing/formatting
        .matches(UK_PHONE_REGEX)
            .withMessage('Please enter a valid UK phone number (e.g. 07700 900000).')
        .escape(),

    // Postcode — required, UK format
    body('postcode')
        .trim()
        .notEmpty()
            .withMessage('Postcode is required.')
        .toUpperCase()
        .matches(UK_POSTCODE_REGEX)
            .withMessage('Please enter a valid UK postcode (e.g. LS1 1AA).')
        .escape(),

    // Service type — optional, must be one of the known values
    body('service_type')
        .optional({ checkFalsy: true })
        .trim()
        .isIn(VALID_SERVICES)
            .withMessage('Invalid service type selected.')
        .escape(),

    // Message — optional, max 2000 chars
    body('message')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 2000 })
            .withMessage('Message must not exceed 2,000 characters.')
        .escape(),

    // GDPR consent — must be boolean true if provided
    body('gdpr_consent')
        .optional({ checkFalsy: true })
        .isBoolean()
            .withMessage('Invalid consent value.'),

    // ── Calculator fields (all optional) ──────────────────────

    body('room_length_m')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0.5, max: 100 })
            .withMessage('Room length must be between 0.5 and 100 metres.')
        .toFloat(),

    body('room_width_m')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0.5, max: 100 })
            .withMessage('Room width must be between 0.5 and 100 metres.')
        .toFloat(),

    body('flooring_type')
        .optional({ checkFalsy: true })
        .trim()
        .isIn(['carpet_budget', 'carpet_premium', 'vinyl', 'laminate', 'wood', ''])
            .withMessage('Invalid flooring type.')
        .escape(),

    body('include_underlay')
        .optional({ checkFalsy: true })
        .isBoolean()
            .withMessage('Invalid underlay option.')
        .toBoolean(),

    body('include_fitting')
        .optional({ checkFalsy: true })
        .isBoolean()
            .withMessage('Invalid fitting option.')
        .toBoolean(),

    body('estimated_cost')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 1_000_000 })
            .withMessage('Invalid estimated cost.')
        .toFloat(),
];


// ── Validation Result Handler ────────────────────────────────
/**
 * Must be placed AFTER a validation chain in the route handler array.
 * Collects all validation errors and returns a structured 422 response.
 *
 * Example usage:
 *   router.post('/leads', validateLeadSubmission, validateResult, leadController.create);
 */
function validateResult(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        // Map to a clean array of { field, message } objects
        const formatted = errors.array().map(err => ({
            field:   err.path  || err.param,
            message: err.msg,
        }));

        return res.status(422).json({
            success: false,
            error:   'Please check the highlighted fields and try again.',
            fields:  formatted,
        });
    }

    next();
}


// ── Honeypot Field Check ─────────────────────────────────────
/**
 * Bots often fill hidden form fields.
 * If the 'website' field (hidden from real users) contains any value,
 * silently discard the submission without giving bots feedback.
 */
function honeypotCheck(req, res, next) {
    const honeypot = req.body['website'] || req.body['url'] || '';
    if (honeypot.trim().length > 0) {
        // Return a 200 so bots think they succeeded — no information leakage
        return res.status(200).json({
            success: true,
            message: 'Thank you! We\'ll be in touch shortly.',
        });
    }
    next();
}


module.exports = {
    validateLeadSubmission,
    validateResult,
    honeypotCheck,
};
