'use strict';

const winston = require('winston');
const path    = require('path');
const fs      = require('fs');

const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const devFormat = combine(
    colorize({ all: true }),
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ level, message, timestamp: ts, stack }) =>
        `${ts} [${level}] ${stack || message}`
    )
);

const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
);

const transports = [
    new winston.transports.Console({
        format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    }),
];

if (process.env.NODE_ENV === 'production') {
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level:    'error',
            maxsize:  5_242_880,
            maxFiles: 5,
            format:   prodFormat,
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize:  10_485_760,
            maxFiles: 10,
            format:   prodFormat,
        })
    );
}

const logger = winston.createLogger({
    level:       process.env.LOG_LEVEL || 'info',
    transports,
    exitOnError: false,
});

module.exports = logger;
