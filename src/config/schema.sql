-- West Yorkshire Carpets — Database Schema

CREATE TABLE IF NOT EXISTS leads (
    id               TEXT    PRIMARY KEY,
    name             TEXT    NOT NULL CHECK(length(trim(name)) >= 2),
    email            TEXT,
    phone            TEXT    NOT NULL CHECK(length(trim(phone)) >= 10),
    postcode         TEXT    NOT NULL CHECK(length(trim(postcode)) >= 5),
    service_type     TEXT    NOT NULL DEFAULT 'Not specified',
    message          TEXT,
    room_length_m    REAL,
    room_width_m     REAL,
    flooring_type    TEXT,
    include_underlay INTEGER DEFAULT 0 CHECK(include_underlay IN (0, 1)),
    include_fitting  INTEGER DEFAULT 0 CHECK(include_fitting  IN (0, 1)),
    estimated_cost   REAL,
    gdpr_consent_at  TEXT,
    status           TEXT    NOT NULL DEFAULT 'new'
                             CHECK(status IN ('new','contacted','quoted','won','lost','spam')),
    ip_address       TEXT,
    user_agent       TEXT,
    source           TEXT    DEFAULT 'website',
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_postcode   ON leads (postcode);
CREATE INDEX IF NOT EXISTS idx_leads_new        ON leads (created_at DESC) WHERE status = 'new';

CREATE TABLE IF NOT EXISTS audit_log (
    actor      TEXT,
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id    TEXT    REFERENCES leads(id) ON DELETE SET NULL,
    user_id    INTEGER,
    username   TEXT,
    action     TEXT    NOT NULL,
    table_name TEXT,
    record_id  INTEGER,
    details    TEXT,
    created_at TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS admin_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    action     TEXT    NOT NULL,
    ip_address TEXT,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TRIGGER IF NOT EXISTS leads_updated_at
    AFTER UPDATE ON leads FOR EACH ROW
BEGIN
    UPDATE leads SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = OLD.id;
END;

CREATE TABLE IF NOT EXISTS admin_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    DEFAULT 'editor',
    last_login    TEXT,
    created_at    TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL UNIQUE,
    slug          TEXT    NOT NULL UNIQUE,
    description   TEXT,
    display_order INTEGER DEFAULT 0,
    created_at    TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    category_slug  TEXT    NOT NULL,
    subcategory    TEXT,
    sku            TEXT    UNIQUE,
    price          REAL    NOT NULL CHECK(price >= 0),
    original_price REAL,
    stock_level    INTEGER DEFAULT 0,
    description    TEXT,
    img_url        TEXT,
    badge          TEXT,
    badge_type     TEXT,
    rooms          TEXT    DEFAULT '[]',
    durability     INTEGER DEFAULT 3,
    softness       INTEGER DEFAULT 3,
    is_featured    INTEGER DEFAULT 0,
    is_deal        INTEGER DEFAULT 0,
    is_active      INTEGER DEFAULT 1,
    created_at     TEXT    DEFAULT (datetime('now')),
    updated_at     TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offers (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id       INTEGER REFERENCES products(id) ON DELETE CASCADE,
    offer_name       TEXT    NOT NULL,
    discounted_price REAL    NOT NULL,
    start_date       TEXT    NOT NULL,
    end_date         TEXT    NOT NULL,
    is_featured      INTEGER DEFAULT 0,
    is_active        INTEGER DEFAULT 1,
    created_at       TEXT    DEFAULT (datetime('now'))
);
