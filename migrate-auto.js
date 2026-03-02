'use strict';
const bcrypt = require('bcryptjs');

module.exports = async function(db) {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS leads (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    email            TEXT,
    phone            TEXT NOT NULL,
    postcode         TEXT NOT NULL,
    service_type     TEXT NOT NULL DEFAULT 'Not specified',
    message          TEXT,
    room_length_m    REAL,
    room_width_m     REAL,
    flooring_type    TEXT,
    include_underlay INTEGER DEFAULT 0,
    include_fitting  INTEGER DEFAULT 0,
    estimated_cost   REAL,
    gdpr_consent_at  TEXT,
    status           TEXT NOT NULL DEFAULT 'new',
    ip_address       TEXT,
    user_agent       TEXT,
    source           TEXT DEFAULT 'website',
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);
            CREATE TABLE IF NOT EXISTS admin_users (
                id            SERIAL PRIMARY KEY,
                username      TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role          TEXT DEFAULT 'editor',
                last_login    TEXT,
                created_at    TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS categories (
                id            SERIAL PRIMARY KEY,
                name          TEXT NOT NULL UNIQUE,
                slug          TEXT NOT NULL UNIQUE,
                description   TEXT,
                display_order INTEGER DEFAULT 0,
                created_at    TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS products (
                id             SERIAL PRIMARY KEY,
                name           TEXT NOT NULL,
                category_slug  TEXT NOT NULL,
                subcategory    TEXT,
                sku            TEXT UNIQUE,
                price          REAL NOT NULL CHECK(price >= 0),
                original_price REAL,
                stock_level    INTEGER DEFAULT 0,
                description    TEXT,
                img_url        TEXT,
                badge          TEXT,
                badge_type     TEXT,
                rooms          TEXT DEFAULT '[]',
                durability     INTEGER DEFAULT 3,
                softness       INTEGER DEFAULT 3,
                is_featured    INTEGER DEFAULT 0,
                is_deal        INTEGER DEFAULT 0,
                is_active      INTEGER DEFAULT 1,
                created_at     TIMESTAMP DEFAULT NOW(),
                updated_at     TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS offers (
                id               SERIAL PRIMARY KEY,
                product_id       INTEGER REFERENCES products(id) ON DELETE CASCADE,
                offer_name       TEXT NOT NULL,
                discounted_price REAL NOT NULL,
                start_date       TEXT NOT NULL,
                end_date         TEXT NOT NULL,
                is_featured      INTEGER DEFAULT 0,
                is_active        INTEGER DEFAULT 1,
                created_at       TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS audit_log (
                id         SERIAL PRIMARY KEY,
                lead_id    TEXT,
                user_id    INTEGER,
                username   TEXT,
                action     TEXT NOT NULL,
                table_name TEXT,
                record_id  INTEGER,
                details    TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Seed admin user
        const hash = bcrypt.hashSync('Admin@WYC2026!', 10);
        await db.query(`
            INSERT INTO admin_users (username, password_hash, role)
            VALUES ($1, $2, 'admin')
            ON CONFLICT (username) DO NOTHING
        `, ['admin', hash]);

        // Seed categories
        const cats = [
            ['Carpets','carpets','Plush, twist & berber',1],
            ['Vinyl','vinyl','100% waterproof LVT',2],
            ['Laminate','laminate','Scratch-resistant',3],
            ['Wood','wood','Genuine engineered oak',4],
        ];
        for (const c of cats) {
            await db.query(`
                INSERT INTO categories (name,slug,description,display_order)
                VALUES ($1,$2,$3,$4) ON CONFLICT (slug) DO NOTHING
            `, c);
        }

        console.log('[Admin] Tables ready');
    } catch(e) {
        console.error('[Admin] Migration error:', e.message);
    }
};
