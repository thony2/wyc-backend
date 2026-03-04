/**
 * ============================================================
 * West Yorkshire Carpets — Lead Management API
 * server.js  |  Entry Point
 *
 * Start:
 *   Development:  npm run dev   (nodemon, auto-restart)
 *   Production:   npm start     (or via PM2 / systemd)
 *
 * First run:
 *   1. cp .env.example .env   (fill in your values)
 *   2. npm install
 *   3. node src/config/initDb.js
 *   4. npm run dev
 * ============================================================
 */

'use strict';

// Load environment variables FIRST — before any other require
require('dotenv').config();

const express      = require('express');
const cookieParser = require('cookie-parser');
const compression  = require('compression');
const morgan       = require('morgan');
const path         = require('path');

const logger       = require('./src/utils/logger');
const {
    helmetMiddleware,
    corsMiddleware,
    generalLimiter,
    requestId,
}                  = require('./src/middleware/security');

const db = require("./src/config/database");
require('./migrate-auto')(db).catch(e => console.error('[Admin] Migration failed:', e.message));
const leadRoutes   = require('./src/routes/leads');
const adminRoutes  = require('./src/routes/admin');

// ── Initialise App ───────────────────────────────────────────
const app  = express();
const PORT = parseInt(process.env.PORT || '3001', 10);


// ============================================================
// GLOBAL MIDDLEWARE — applied to every request (order matters)
// ============================================================

// 1. Unique request ID — attach before anything logs
app.use(requestId);

/// 2. HTTP security headers (Helmet)
app.use((req, res, next) => {
    if (req.path === '/admin' || req.path.startsWith('/admin/')) {
        res.setHeader('Content-Security-Policy',
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self' https://wyc-backend-production-ed78.up.railway.app"
        );
        return next();
    }
    return helmetMiddleware(req, res, next);
});

// 3. CORS — must come before routes
app.use(corsMiddleware);
// Handle OPTIONS preflight for all routes
app.options('*', corsMiddleware);

// 4. Request logging (skip health-check to reduce noise)
app.use(morgan('combined', {
    stream: { write: msg => logger.info(msg.trim()) },
    skip:   (req) => req.path === '/health',
}));

// 5. Gzip/Brotli compression — reduces response payload
app.use(compression());

// 6. Cookie parser — required for CSRF double-submit
app.use(cookieParser());

// 7. JSON body parser — strict 16KB limit prevents payload attacks
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

// 8. Global rate limiter (generous — specific tighter limits on /api/leads)
app.use('/api', generalLimiter);

// 9. Trust proxy — required when behind Nginx / Heroku / Railway / Render
//    to get real client IP (used by rate limiter)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}


// ============================================================
// ROUTES
// ============================================================

// ── Health check — used by load balancers / uptime monitors
app.get('/health', (_req, res) => {
    res.json({
        status:  'ok',
        service: 'WYC Lead API',
        uptime:  Math.floor(process.uptime()),
        env:     process.env.NODE_ENV || 'development',
    });
});

// ── API v1 routes
app.use('/api', leadRoutes);       // POST /api/leads, GET /api/csrf-token
app.use('/api/admin', adminRoutes); // GET|PATCH|DELETE /api/admin/...
// Products & Admin Panel
const productsRouter = require('./routes/products');
const adminRouter    = require('./routes/admin');
app.use('/api/products', productsRouter(db));
app.use('/api/panel', adminRouter(db));
// Admin panel — served with relaxed CSP for inline styles/scripts
app.get('/dashboard', (req, res) => {
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https:"
    );
    res.sendFile(require('path').join(__dirname, 'dashboard.html'));
});
app.use('/admin', (req, res, next) => {
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://wyc-backend-production-ed78.up.railway.app"
    );
    next();
}, require('express').static(require('path').join(__dirname, 'admin')));

// ── 404 handler — all unmatched routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error:   `Route ${req.method} ${req.path} not found.`,
    });
});

// ── Global error handler — catches any unhandled errors in route handlers
// Important: must have 4 parameters (err, req, res, next) for Express to treat it as an error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // Log full stack in development, suppress in production
    const message = process.env.NODE_ENV === 'development'
        ? err.message
        : 'An unexpected error occurred. Please try again.';

    logger.error(`[Server] Unhandled error — req: ${req.requestId}, path: ${req.path}`, {
        message: err.message,
        stack:   err.stack,
    });

    // CORS error from our cors middleware
    if (err.message === 'Not allowed by CORS policy') {
        return res.status(403).json({ success: false, error: 'Request origin not allowed.' });
    }

    res.status(err.status || 500).json({
        success: false,
        error:   message,
        reqId:   req.requestId,
    });
});


// ============================================================
// START SERVER
// ============================================================

const server = app.listen(PORT, () => {
    logger.info(`\n  ✓  West Yorkshire Carpets API`);
    logger.info(`  ✓  Environment : ${process.env.NODE_ENV || 'development'}`);
    logger.info(`  ✓  Listening   : http://localhost:${PORT}`);
    logger.info(`  ✓  Database    : ${process.env.DB_TYPE || 'sqlite'}`);
    logger.info(`  ✓  Mail        : ${process.env.MAIL_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
    logger.info(`  ✓  Origin      : ${process.env.ALLOWED_ORIGIN || 'http://localhost:5500'}\n`);
});

// ── Graceful shutdown on SIGTERM / SIGINT ────────────────────
// Ensures in-flight requests complete and DB is closed cleanly.

function shutdown(signal) {
    logger.info(`[Server] ${signal} received — shutting down gracefully...`);
    server.close(() => {
        logger.info('[Server] HTTP server closed. Exiting.');
        process.exit(0);
    });

    // Force exit after 10 seconds if connections haven't closed
    setTimeout(() => {
        logger.warn('[Server] Forced shutdown after timeout');
        process.exit(1);
    }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Log unhandled promise rejections (shouldn't occur if code is correct)
process.on('unhandledRejection', (reason) => {
    logger.error('[Server] Unhandled Promise Rejection:', reason);
});

module.exports = app; // Exported for testing
