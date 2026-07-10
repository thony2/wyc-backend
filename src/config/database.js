'use strict';

const logger = require('../utils/logger');

function createPostgresPool() {
    const { Pool } = require('pg');

    const pool = new Pool({
        host:                    process.env.PGHOST     || 'localhost',
        port:                    parseInt(process.env.PGPORT || '5432', 10),
        database:                process.env.PGDATABASE || 'wyc_leads',
        user:                    process.env.PGUSER     || 'wyc_user',
        password:                process.env.PGPASSWORD,
        max:                     10,
        idleTimeoutMillis:       30_000,
        connectionTimeoutMillis: 5_000,
        ssl: process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
    });

    pool.on('error', err => logger.error('[DB] PostgreSQL pool error:', err.message));

    const wrapper = {
        prepare: (sql) => ({
            run: async (...params) => {
                const client = await pool.connect();
                try {
                    const result = await client.query(convertPlaceholders(sql), params);
                    return { changes: result.rowCount, lastInsertRowid: null };
                } finally {
                    client.release();
                }
            },
            get:  async (...params) => {
                const { rows } = await pool.query(convertPlaceholders(sql), params);
                return rows[0] || undefined;
            },
            all:  async (...params) => {
                const { rows } = await pool.query(convertPlaceholders(sql), params);
                return rows;
            },
        }),
        query:      (sql, params) => pool.query(convertPlaceholders(sql), params),
        pragma:     () => {},
        _isPostgres: true,
    };

    logger.info(`[DB] PostgreSQL connected → ${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`);
    return wrapper;
}

function convertPlaceholders(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

let _instance = null;

function getDatabase() {
    if (_instance) return _instance;

    const dbType = (process.env.DB_TYPE || 'postgres').toLowerCase();

    if (dbType === 'sqlite') {
        throw new Error(
            '[DB] SQLite support has been removed. This project now requires ' +
            'PostgreSQL. Set DB_TYPE=postgres (or remove the DB_TYPE variable ' +
            'entirely) and provide PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD ' +
            'in your .env file. See .env.example.'
        );
    }

    _instance = createPostgresPool();
    return _instance;
}

module.exports = getDatabase();
