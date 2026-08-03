'use strict';
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
} = require('./src/middleware/security');

// Migrations no longer run here — see scripts/migrate.js (1C, see
// MASTER_CHECKLIST.md). Chained into "start"/"dev" in package.json instead,
// so they still run automatically on every deploy/dev session, but as a
// distinct, visible step rather than a side effect buried in server.js.
// No db require here either — every router now requires the shared pool
// directly (src/config/database.js), and server.js itself has no direct
// use for it. Requiring it just to leave it unused would open a real
// Postgres connection pool for nothing (module.exports = getDatabase()
// runs immediately on require).

const leadRoutes     = require('./src/routes/leads');
const adminRoutes    = require('./src/routes/authGuard');
const productsRouter = require('./src/routes/products');
const panelRouter    = require('./src/routes/panel');
const importRouter   = require('./src/routes/import');
const seoRouter      = require('./src/routes/products-seo');

const app  = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

const ADMIN_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://wyc-backend-production-ed78.up.railway.app https://api.cloudinary.com",
].join('; ');

app.use(requestId);

app.use((req, res, next) => {
    if (req.path === '/admin' || req.path.startsWith('/admin/')) {
        res.setHeader('Content-Security-Policy', ADMIN_CSP);
        return next();
    }
    return helmetMiddleware(req, res, next);
});

app.use(corsMiddleware);
app.options('*', corsMiddleware);

app.use(morgan('combined', {
    stream: { write: msg => logger.info(msg.trim()) },
    skip:   req => req.path === '/health',
}));

app.use(compression({
  // /scrape-bulk streams results back one at a time as each URL finishes;
  // compression buffers the response to decide how best to compress it,
  // which would silently hold results back until the whole batch is done --
  // defeating the point. Skip compression for that one route only.
  filter: (req, res) => {
    if (req.path.includes('/scrape-bulk')) return false;
    return compression.filter(req, res);
  },
}));
app.use(cookieParser());
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use('/api', generalLimiter);

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.get('/health', (_req, res) => {
    res.json({
        status:  'ok',
        service: 'WYC API',
        uptime:  Math.floor(process.uptime()),
        env:     process.env.NODE_ENV || 'development',
    });
});

app.use('/api', leadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productsRouter);
app.use('/api/panel', panelRouter);
app.use('/api/panel', importRouter);
app.use('/flooring', seoRouter);

app.get('/admin', (req, res) => {
    res.setHeader('Content-Security-Policy', ADMIN_CSP);
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});
app.use('/admin', (req, res, next) => {
    res.setHeader('Content-Security-Policy', ADMIN_CSP);
    next();
}, express.static(path.join(__dirname, 'admin'), { etag: false, lastModified: false }));

app.use((req, res) => {
    res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found.` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    logger.error(`[Server] Unhandled error: ${err.message}`);
    if (err.message === 'Not allowed by CORS policy') {
        return res.status(403).json({ success: false, error: 'Request origin not allowed.' });
    }
    const message = process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.';
    res.status(err.status || 500).json({ success: false, error: message, reqId: req.requestId });
});

const server = app.listen(PORT, () => {
    logger.info(`\n  ✓  West Yorkshire Carpets API`);
    logger.info(`  ✓  Environment : ${process.env.NODE_ENV || 'development'}`);
    logger.info(`  ✓  Listening   : http://localhost:${PORT}`);
    logger.info(`  ✓  Database    : ${process.env.DB_TYPE || 'sqlite'}`);
    logger.info(`  ✓  Mail        : ${process.env.MAIL_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
    logger.info(`  ✓  Origin      : ${process.env.ALLOWED_ORIGIN || 'http://localhost:5500'}\n`);
});

function shutdown(signal) {
    logger.info(`[Server] ${signal} — shutting down...`);
    server.close(() => { logger.info('[Server] Closed. Exiting.'); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', reason => logger.error('[Server] Unhandled rejection:', reason));

module.exports = app;
