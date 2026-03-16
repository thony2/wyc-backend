'use strict';

const path   = require('path');
const fs     = require('fs');
const logger = require('../utils/logger');

function createSQLiteConnection() {
    const dataDir = path.resolve(__dirname, '../../data');
    const dbPath  = process.env.SQLITE_PATH
        ? path.resolve(process.cwd(), process.env.SQLITE_PATH)
        : path.join(dataDir, 'wyc_leads.db');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const Database = require('better-sqlite3');
    const db = new Database(dbPath, {
        fileMustExist: false,
        verbose: process.env.NODE_ENV === 'development'
            ? msg => logger.debug(`[SQLite] ${msg}`)
            : null,
    });

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');

    logger.info(`[DB] SQLite connected → ${dbPath}`);
    return db;
}

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

function runMigrations(db) {
    const migrations = [
        `ALTER TABLE leads ADD COLUMN booking_date  TEXT`,
        `ALTER TABLE leads ADD COLUMN booking_time  TEXT`,
        `ALTER TABLE leads ADD COLUMN booking_type  TEXT`,
        `ALTER TABLE leads ADD COLUMN booking_notes TEXT`,
        `ALTER TABLE leads ADD COLUMN lead_number   INTEGER`,
    ];
    for (const sql of migrations) {
        try { db.exec(sql); } catch (e) { /* column already exists — safe */ }
    }
    try {
        db.exec(`
            UPDATE leads SET lead_number = (
                SELECT COUNT(*) FROM leads l2 WHERE l2.created_at <= leads.created_at
            ) WHERE lead_number IS NULL
        `);
    } catch (e) {}
}

function runSchema(db) {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) return;
    const schema = fs.readFileSync(schemaPath, 'utf8');
    if (db.exec) {
        db.exec(schema);
        logger.info('[DB] Schema applied');
    }
}

let _instance = null;

function getDatabase() {
    if (_instance) return _instance;

    const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();

    if (dbType === 'postgres') {
        _instance = createPostgresPool();
    } else {
        _instance = createSQLiteConnection();
        runSchema(_instance);
        runMigrations(_instance);
    }

    return _instance;
}

module.exports = getDatabase();
