-- 001_initial_schema.sql
--
-- Baseline schema, current as of 2 Aug 2026 — converted from migrate-auto.js
-- as part of 1C (see MASTER_CHECKLIST.md). This is a snapshot of where the
-- schema already was, not a replay of its history: migrate-auto.js grew
-- incrementally over months via repeated `ALTER TABLE ... ADD COLUMN IF NOT
-- EXISTS` statements, and reverse-engineering exact historical boundaries
-- between those additions would be archaeology with no operational benefit —
-- nobody needs to replay history step by step, a fresh database just needs
-- to end up in the current shape. Every future schema change is a new,
-- separately numbered file from here on (002_..., 003_..., etc.).
--
-- Deliberately idempotent throughout (IF NOT EXISTS / ON CONFLICT DO
-- NOTHING everywhere), matching migrate-auto.js's own existing discipline —
-- this is what makes it safe to run against the live database, which
-- already has this schema applied. scripts/migrate.js records this file as
-- applied in the _migrations table the first time it runs either way, so it
-- only actually executes once regardless of whether it's a no-op or not.

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

-- Product columns added incrementally over time — see the note at the top
-- of this file for why these aren't split into separate numbered files.
ALTER TABLE products ADD COLUMN IF NOT EXISTS fitting_price REAL DEFAULT 6.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS colours TEXT DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS features TEXT DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS colour_family TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS fibre TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS carpet_style TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS thickness TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS density TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS softness_label TEXT DEFAULT '';

-- Category-specific product attributes (hard floors: vinyl/laminate/wood)
ALTER TABLE products ADD COLUMN IF NOT EXISTS thickness_mm REAL DEFAULT NULL;          -- board thickness
ALTER TABLE products ADD COLUMN IF NOT EXISTS wear_layer_mm REAL DEFAULT NULL;         -- vinyl wear layer
ALTER TABLE products ADD COLUMN IF NOT EXISTS ac_rating TEXT DEFAULT '';               -- laminate AC3/AC4/AC5
ALTER TABLE products ADD COLUMN IF NOT EXISTS board_design TEXT DEFAULT '';            -- laminate Wood/Stone Effect
ALTER TABLE products ADD COLUMN IF NOT EXISTS plank_width_mm REAL DEFAULT NULL;        -- hard floor plank width
ALTER TABLE products ADD COLUMN IF NOT EXISTS species_finish TEXT DEFAULT '';          -- wood species/finish
ALTER TABLE products ADD COLUMN IF NOT EXISTS surface_finish TEXT DEFAULT '';          -- wood Oiled/Lacquered/etc.
ALTER TABLE products ADD COLUMN IF NOT EXISTS lay_pattern TEXT DEFAULT '';             -- wood/vinyl lay pattern
ALTER TABLE products ADD COLUMN IF NOT EXISTS installation_method TEXT DEFAULT '';     -- hard floor Click/Glue/etc.
ALTER TABLE products ADD COLUMN IF NOT EXISTS ufh_compatible INTEGER DEFAULT 0;        -- underfloor heating

-- audit_log columns used by leadController.js, adminController.js, and the
-- product/offer admin controllers. Already present on the live database
-- (confirmed by direct query, 10 Jul 2026) — only matters for a from-scratch
-- database, safe no-op against the live one.
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS detail TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Seed categories — safe to re-run, matches every product's category_slug
INSERT INTO categories (name, slug, description, display_order) VALUES
    ('Carpets',  'carpets',  'Plush, twist & berber',    1),
    ('Vinyl',    'vinyl',    '100% waterproof LVT',      2),
    ('Laminate', 'laminate', 'Scratch-resistant',        3),
    ('Wood',     'wood',     'Genuine engineered oak',   4)
ON CONFLICT (slug) DO NOTHING;

-- Not included here: the default admin user. That step needs bcrypt to hash
-- ADMIN_DEFAULT_PASSWORD, which plain SQL can't do — handled directly in
-- scripts/migrate.js, immediately after this file runs, using the same
-- ON CONFLICT DO NOTHING idempotency as everything else here.
