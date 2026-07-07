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
    booking_date     TEXT,
    booking_time     TEXT,
    booking_type     TEXT,
    booking_notes    TEXT,
    lead_number      INTEGER,
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

        // New product columns
        await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS fitting_price REAL DEFAULT 6.00`);
        await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS colours TEXT DEFAULT '[]'`);
        await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS features TEXT DEFAULT '[]'`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS colour_family TEXT DEFAULT ''`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS fibre TEXT DEFAULT ''`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS carpet_style TEXT DEFAULT ''`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS thickness TEXT DEFAULT ''`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS density TEXT DEFAULT ''`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS softness_label TEXT DEFAULT ''`);

    // ── Phase 2: category-specific product attributes ────────────────────────
    // Hard floor: board thickness (vinyl/laminate/wood)
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS thickness_mm REAL DEFAULT NULL`);
    // Vinyl: wear layer thickness
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS wear_layer_mm REAL DEFAULT NULL`);
    // Laminate: AC wear rating (AC3/AC4/AC5)
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ac_rating TEXT DEFAULT ''`);
    // Laminate: board design (Wood Effect / Stone Effect)
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS board_design TEXT DEFAULT ''`);
    // Hard floor: plank width in mm
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS plank_width_mm REAL DEFAULT NULL`);
    // Wood: species and finish description
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS species_finish TEXT DEFAULT ''`);
    // Wood: surface finish (Oiled/Lacquered/Brushed/Smoked)
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS surface_finish TEXT DEFAULT ''`);
    // Wood/Vinyl: lay pattern (Straight/Herringbone/Chevron)
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS lay_pattern TEXT DEFAULT ''`);
    // Hard floor: installation method (Click/Glue/Nail/Loose Lay)
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS installation_method TEXT DEFAULT ''`);
    // Hard floor: underfloor heating compatible
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ufh_compatible INTEGER DEFAULT 0`);

        if (process.env.ADMIN_DEFAULT_PASSWORD) {
    const hash = bcrypt.hashSync(process.env.ADMIN_DEFAULT_PASSWORD, 10);
    await db.query(`
        INSERT INTO admin_users (username, password_hash, role)
        VALUES ($1, $2, 'admin')
        ON CONFLICT (username) DO NOTHING
    `, ['admin', hash]);
} else {
    console.warn('[Migration] ADMIN_DEFAULT_PASSWORD not set — skipping default admin creation');
}

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
