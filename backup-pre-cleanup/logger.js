/**
 * ============================================================
 * West Yorkshire Carpets — Structured Logger
 * src/utils/logger.js
 *
 * Uses Winston for structured, level-filtered logging.
 * In production: outputs JSON to logs/ directory.
 * In development: outputs colourised human-readable format.
 * ============================================================
 */

'use strict';

const winston = require('winston');
const path    = require('path');
const fs      = require('fs');

// Ensure logs directory exists
const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

// Human-readable format for development
const devFormat = combine(
    colorize({ all: true }),
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ level, message, timestamp: ts, stack }) =>
        `${ts} [${level}] ${stack || message}`
    )
);

// JSON format for production log aggregation (Datadog, Logtail, etc.)
const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
);

const transports = [
    // Always log to console
    new winston.transports.Console({
        format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    }),
];

// In production, additionally write to rotating log files
if (process.env.NODE_ENV === 'production') {
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level:    'error',
            maxsize:  5_242_880,  // 5 MB
            maxFiles: 5,
            format:   prodFormat,
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize:  10_485_760, // 10 MB
            maxFiles: 10,
            format:   prodFormat,
        })
    );
}

const logger = winston.createLogger({
    level:      process.env.LOG_LEVEL || 'info',
    transports,
    exitOnError: false,
});

module.exports = logger;
