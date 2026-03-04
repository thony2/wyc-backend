/**
 * ============================================================
 * West Yorkshire Carpets — Security Middleware
 * src/middleware/security.js
 * ============================================================
 */

'use strict';

const helmet        = require('helmet');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const crypto        = require('crypto');
const logger        = require('../utils/logger');

// ── 1. HELMET ────────────────────────────────────────────────
// Admin panel needs unsafe-inline for its embedded styles/scripts.
// All other routes use strict CSP.

const strictHelmet = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'"],
            styleSrc:       ["'self'", 'https:'],
            imgSrc:         ["'self'", 'data:', 'https:'],
            fontSrc:        ["'self'", 'https:'],
            connectSrc:     ["'self'"],
            frameAncestors: ["'none'"],
            formAction:     ["'self'"],
        },
    },
    noSniff:          true,
    hidePoweredBy:    true,
    hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    referrerPolicy:            { policy: 'strict-origin-when-cross-origin' },
    crossOriginOpenerPolicy:   { policy: 'same-origin-allow-popups' },
});

const adminHelmet = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc:  ["'self'", "'unsafe-inline'"],
            styleSrc:   ["'self'", "'unsafe-inline'", 'https:'],
            imgSrc:     ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
        },
    },
    noSniff:       true,
    hidePoweredBy: true,
});

function helmetMiddleware(req, res, next) {
    if (req.path.startsWith('/admin')) return adminHelmet(req, res, next);
    return strictHelmet(req, res, next);
}


// ── 2. CORS ──────────────────────────────────────────────────

const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:5500')
    .split(',')
    .map(o => o.trim());

const corsOptions = {
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        logger.warn(`[CORS] Blocked request from disallowed origin: ${origin}`);
        return callback(new Error('Not allowed by CORS policy'));
    },
    methods:         ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders:  ['Content-Type', 'X-CSRF-Token', 'Authorization'],
    exposedHeaders:  ['X-Request-Id'],
    credentials:     true,
    maxAge:          86_400,
};

const corsMiddleware = cors(corsOptions);


// ── 3. RATE LIMITERS ─────────────────────────────────────────

const leadSubmissionLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max:      parseInt(process.env.RATE_LIMIT_MAX       || '5',      10),
    standardHeaders: 'draft-7',
    legacyHeaders:   false,
    keyGenerator(req) {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.socket.remoteAddress
            || 'unknown';
    },
    handler(req, res) {
        logger.warn(`[RateLimit] IP ${req.ip} exceeded lead submission limit`);
        return res.status(429).json({
            success: false,
            error:   'Too many requests. Please wait a few minutes before trying again.',
            retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) / 60_000),
        });
    },
});

const generalLimiter = rateLimit({
    windowMs:        60_000,
    max:             60,
    standardHeaders: 'draft-7',
    legacyHeaders:   false,
    handler(_req, res) {
        return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
    },
});


// ── 4. CSRF ──────────────────────────────────────────────────

function csrfTokenGenerator(req, res, next) {
    if (!req.cookies['csrf_token']) {
        const token = crypto.randomBytes(32).toString('hex');
        res.cookie('csrf_token', token, {
            httpOnly: false,
            sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
            secure:   process.env.NODE_ENV === 'production',
            maxAge:   3_600_000,
            path:     '/',
        });
        req.csrfToken = token;
    } else {
        req.csrfToken = req.cookies['csrf_token'];
    }
    next();
}

function csrfValidator(req, res, next) {
    return next();
}


// ── REQUEST ID ───────────────────────────────────────────────

function requestId(req, res, next) {
    const id = crypto.randomBytes(8).toString('hex');
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}


// ── EXPORT ───────────────────────────────────────────────────

module.exports = {
    helmetMiddleware,
    corsMiddleware,
    corsOptions,
    leadSubmissionLimiter,
    generalLimiter,
    csrfTokenGenerator,
    csrfValidator,
    requestId,
};
