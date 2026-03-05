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

const db = require('./src/config/database');
require('./migrate-auto')(db).catch(e => logger.error(`[Migration] ${e.message}`));

const leadRoutes     = require('./src/routes/leads');
const adminRoutes    = require('./src/routes/admin');
const productsRouter = require('./routes/products');
const panelRouter    = require('./routes/admin');

const app  = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

const ADMIN_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://wyc-backend-production-ed78.up.railway.app",
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

app.use(compression());
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
app.use('/api/products', productsRouter(db));
app.use('/api/panel', panelRouter(db));

app.use('/admin', (req, res, next) => {
    res.setHeader('Content-Security-Policy', ADMIN_CSP);
    next();
}, express.static(path.join(__dirname, 'admin'), { index: 'index.html', etag: false, lastModified: false }));

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
