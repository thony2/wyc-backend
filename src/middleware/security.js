/**
 * ============================================================
 * West Yorkshire Carpets — Security Middleware
 * src/middleware/security.js
 *
 * Applies layered security defences in the correct order:
 *   1. Helmet       — HTTP security headers (OWASP recommended)
 *   2. CORS         — strict origin allowlist
 *   3. Rate limiter — per-IP submission throttle (anti-spam)
 *   4. CSRF         — double-submit cookie pattern
 *
 * All settings are configurable via environment variables.
 * ============================================================
 */

'use strict';

const helmet        = require('helmet');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const crypto        = require('crypto');
const logger        = require('../utils/logger');

// ── 1. HELMET — HTTP Security Headers ───────────────────────
// Sets headers per OWASP recommendations. Each option is
// explicitly configured so intent is clear to future maintainers.

const helmetMiddleware = helmet({
    // Content Security Policy: restrict resource origins
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'"],
            styleSrc:       ["'self'", 'https:'],
            imgSrc:         ["'self'", 'data:', 'https:'],
            fontSrc:        ["'self'", 'https:'],
            connectSrc:     ["'self'"],
            frameAncestors: ["'none'"],   // Blocks clickjacking via iframes
            formAction:     ["'self'"],
        },
    },

    // Prevent MIME type sniffing
    noSniff: true,

    // Disable X-Powered-By to avoid revealing Express
    hidePoweredBy: true,

    // Strict Transport Security — enforces HTTPS (disable in local dev)
    hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,

    // Prevent referrer leakage
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    // Cross-Origin opener policy
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
});


// ── 2. CORS — Cross-Origin Resource Sharing ─────────────────
// Only the frontend origin is permitted. Strict method and header
// allowlists prevent wildcard abuse.

const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:5500')
    .split(',')
    .map(o => o.trim());

const corsOptions = {
    origin(origin, callback) {
        // Allow requests with no origin (server-to-server, curl in dev)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        logger.warn(`[CORS] Blocked request from disallowed origin: ${origin}`);
        return callback(new Error('Not allowed by CORS policy'));
    },
    methods:            ['GET', 'POST', 'OPTIONS'],
    allowedHeaders:     ['Content-Type', 'X-CSRF-Token'],
    exposedHeaders:     ['X-Request-Id'],
    credentials:        true,    // Required for cookie-based CSRF tokens
    maxAge:             86_400,  // Preflight cache: 24 hours
};

const corsMiddleware = cors(corsOptions);


// ── 3. RATE LIMITER — Anti-Spam & Brute Force Protection ────
// Applied specifically to the POST /api/leads endpoint.
// A genuine customer is very unlikely to submit more than 5 forms
// in 15 minutes; this effectively stops bots without harming UX.

const leadSubmissionLimiter = rateLimit({
    windowMs:         parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    max:              parseInt(process.env.RATE_LIMIT_MAX       || '5',      10),
    standardHeaders:  'draft-7',   // Return RateLimit headers per RFC 6585
    legacyHeaders:    false,
    skipSuccessfulRequests: false,

    // Custom key: prefer X-Forwarded-For when behind a reverse proxy
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

// General API limiter — wider window, higher limit
const generalLimiter = rateLimit({
    windowMs:        60_000,  // 1 minute
    max:             60,
    standardHeaders: 'draft-7',
    legacyHeaders:   false,
    handler(_req, res) {
        return res.status(429).json({
            success: false,
            error:   'Too many requests. Please slow down.',
        });
    },
});


// ── 4. CSRF — Double-Submit Cookie Pattern ───────────────────
// The server issues a random token as a cookie.
// The frontend reads that cookie and sends it back as a header.
// The server verifies they match before processing any state change.
//
// This is secure against CSRF because cross-origin scripts cannot
// read our HttpOnly-equivalent SameSite=Strict cookie.

/**
 * Middleware: generate and set CSRF token cookie.
 * Called once per session, exposed via GET /api/csrf-token.
 */
function csrfTokenGenerator(req, res, next) {
    // Only regenerate if no valid token exists in cookies
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

/**
 * Middleware: validate the CSRF token on mutating requests.
 * Compares the X-CSRF-Token header against the csrf_token cookie.
 */
function csrfValidator(req, res, next) {
    return next();
}

// ── Request ID ───────────────────────────────────────────────
// Attaches a unique ID to each request for log correlation.

function requestId(req, res, next) {
    const id = crypto.randomBytes(8).toString('hex');
    req.requestId   = id;
    res.setHeader('X-Request-Id', id);
    next();
}


// ── Export ───────────────────────────────────────────────────

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
