'use strict';

const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const crypto    = require('crypto');
const logger    = require('../utils/logger');

const helmetMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", 'https://cdnjs.cloudflare.com'],
            styleSrc:       ["'self'", "'unsafe-inline'", 'https:'],
            imgSrc:         ["'self'", 'data:', 'https:'],
            fontSrc:        ["'self'", 'https:'],
            connectSrc:     ["'self'", 'https://wyc-backend-production-ed78.up.railway.app'],
            frameAncestors: ["'none'"],
            formAction:     ["'self'"],
        },
    },
    noSniff:        true,
    hidePoweredBy:  true,
    hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    referrerPolicy:          { policy: 'strict-origin-when-cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
});

const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:5500')
    .split(',')
    .map(o => o.trim());

const corsMiddleware = cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        logger.warn(`[CORS] Blocked: ${origin}`);
        return callback(new Error('Not allowed by CORS policy'));
    },
    methods:        ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
    exposedHeaders: ['X-Request-Id'],
    credentials:    true,
    maxAge:         86_400,
});

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

function requestId(req, res, next) {
    const id = crypto.randomBytes(8).toString('hex');
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}

module.exports = {
    helmetMiddleware,
    corsMiddleware,
    leadSubmissionLimiter,
    generalLimiter,
    csrfTokenGenerator,
    csrfValidator,
    requestId,
};
