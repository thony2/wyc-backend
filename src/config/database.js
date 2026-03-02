/**
 * ============================================================
 * West Yorkshire Carpets — Database Configuration
 * src/config/database.js
 *
 * Provides a unified database interface that supports both
 * SQLite (local/small VPS) and PostgreSQL (production scale).
 * Switch via DB_TYPE environment variable.
 *
 * Usage:
 *   const db = require('./database');
 *   const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
 * ============================================================
 */

'use strict';

const path   = require('path');
const fs     = require('fs');
const logger = require('../utils/logger');

// ── SQLite setup ─────────────────────────────────────────────

function createSQLiteConnection() {
    // Resolve data directory relative to project root (one level above /src)
    const dataDir  = path.resolve(__dirname, '../../data');
    const dbPath   = process.env.SQLITE_PATH
        ? path.resolve(process.cwd(), process.env.SQLITE_PATH)
        : path.join(dataDir, 'wyc_leads.db');

    // Ensure the data directory exists before opening the file
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.info(`[DB] Created data directory at ${dataDir}`);
    }

    // better-sqlite3 is synchronous — ideal for a low-traffic lead API
    const Database = require('better-sqlite3');

    const db = new Database(dbPath, {
        // WAL mode: dramatically faster concurrent reads; safe for single-writer apps
        fileMustExist: false,
        verbose: process.env.NODE_ENV === 'development'
            ? msg => logger.debug(`[SQLite] ${msg}`)
            : null,
    });

    // Enforce WAL journalling and foreign key checks on every connection
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');    // Safe with WAL; faster than FULL

    logger.info(`[DB] SQLite connected → ${dbPath}`);
    return db;
}

// ── PostgreSQL setup ─────────────────────────────────────────
// Only loaded when DB_TYPE=postgres — avoids requiring pg if unused

function createPostgresPool() {
    const { Pool } = require('pg');

    const pool = new Pool({
        host:     process.env.PGHOST     || 'localhost',
        port:     parseInt(process.env.PGPORT || '5432', 10),
        database: process.env.PGDATABASE       || 'wyc_leads',
        user:     process.env.PGUSER     || 'wyc_user',
        password: process.env.PGPASSWORD,
        max:      10,          // max pool size
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ssl: process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }  // Required for Heroku/Render/Railway
            : false,
    });

    pool.on('error', err => {
        logger.error('[DB] PostgreSQL pool error:', err.message);
    });

    // Wrap pg pool to provide a similar API surface to better-sqlite3
    // so controllers don't need to know which DB is in use.
    const wrapper = {
        prepare: (sql) => ({
            // Synchronous-style .run() for inserts/updates
            run: async (...params) => {
                const client = await pool.connect();
                try {
                    const result = await client.query(
                        convertPlaceholders(sql), params
                    );
                    return { changes: result.rowCount, lastInsertRowid: null };
                } finally {
                    client.release();
                }
            },
            // .get() returns first row or undefined
            get: async (...params) => {
                const { rows } = await pool.query(
                    convertPlaceholders(sql), params
                );
                return rows[0] || undefined;
            },
            // .all() returns all rows
            all: async (...params) => {
                const { rows } = await pool.query(
                    convertPlaceholders(sql), params
                );
                return rows;
            },
        }),
        // Direct query for flexibility
        query: (sql, params) => pool.query(convertPlaceholders(sql), params),
        pragma: () => {},  // no-op — not applicable to Postgres
        _isPostgres: true,
    };

    logger.info(`[DB] PostgreSQL pool connected → ${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`);
    return wrapper;
}

/**
 * Converts SQLite-style ? placeholders to PostgreSQL $1, $2, ... style.
 * @param {string} sql - Query with ? placeholders
 * @returns {string} - Query with $n placeholders
 */
function convertPlaceholders(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

// ── Initialise schema on first run ───────────────────────────

function runMigrations(db) {
    const migrations = [
        `ALTER TABLE leads ADD COLUMN booking_date   TEXT`,
        `ALTER TABLE leads ADD COLUMN booking_time   TEXT`,
        `ALTER TABLE leads ADD COLUMN booking_type   TEXT`,
        `ALTER TABLE leads ADD COLUMN booking_notes  TEXT`,
        `ALTER TABLE leads ADD COLUMN lead_number    INTEGER`,
    ];
    for (const sql of migrations) {
        try { db.exec(sql); logger.info(`[DB] Migration: ${sql.slice(0,60)}`); }
        catch(e) { /* already exists — safe */ }
    }
    // Backfill lead_number for existing records
    try {
        db.exec(`
            UPDATE leads SET lead_number = (
                SELECT COUNT(*) FROM leads l2
                WHERE l2.created_at <= leads.created_at
            )
            WHERE lead_number IS NULL
        `);
    } catch(e) {}
}

function runSchema(db) {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
        logger.warn('[DB] schema.sql not found — skipping auto-migration');
        return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    // SQLite accepts the whole file at once via exec()
    if (db.exec) {
        db.exec(schema);
        logger.info('[DB] Schema applied successfully');
    }
}

// ── Factory ──────────────────────────────────────────────────

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
