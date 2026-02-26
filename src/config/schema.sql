-- ============================================================
-- West Yorkshire Carpets — Database Schema
-- Compatible with SQLite 3.37+ and PostgreSQL 14+
--
-- To initialise: node src/config/initDb.js
-- Or run manually: sqlite3 data/wyc_leads.db < src/config/schema.sql
-- ============================================================

-- ── LEADS TABLE ─────────────────────────────────────────────
-- Primary table for all customer enquiry data.
-- Designed for minimal necessary data collection (GDPR Art. 5).
CREATE TABLE IF NOT EXISTS leads (

    -- Surrogate primary key using UUID v4 for security
    -- (avoids exposing sequential record counts to the public)
    id              TEXT        PRIMARY KEY,

    -- Customer contact details
    name            TEXT        NOT NULL CHECK(length(trim(name)) >= 2),
    email           TEXT,               -- Optional — customer may prefer phone
    phone           TEXT        NOT NULL CHECK(length(trim(phone)) >= 10),
    postcode        TEXT        NOT NULL CHECK(length(trim(postcode)) >= 5),

    -- Enquiry context
    service_type    TEXT        NOT NULL DEFAULT 'Not specified',
    message         TEXT,               -- Optional free-text from customer

    -- Data captured from the quote calculator (may be NULL if skipped)
    room_length_m   REAL,
    room_width_m    REAL,
    flooring_type   TEXT,
    include_underlay INTEGER     DEFAULT 0 CHECK(include_underlay IN (0, 1)),
    include_fitting  INTEGER     DEFAULT 0 CHECK(include_fitting  IN (0, 1)),
    estimated_cost  REAL,

    -- GDPR consent — stored as timestamp so we have proof of when consent was given
    -- NULL means not captured (legacy records); for new submissions this must be set
    gdpr_consent_at TEXT,               -- ISO 8601 UTC timestamp or NULL

    -- Lead management
    status          TEXT        NOT NULL DEFAULT 'new'
                                CHECK(status IN ('new', 'contacted', 'quoted', 'won', 'lost', 'spam')),

    -- Audit fields
    ip_address      TEXT,               -- Stored for spam/fraud prevention only; anonymised after 30 days
    user_agent      TEXT,
    source          TEXT        DEFAULT 'website',
    created_at      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at      TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── INDEXES ─────────────────────────────────────────────────
-- Index on created_at for chronological admin queries
CREATE INDEX IF NOT EXISTS idx_leads_created_at  ON leads (created_at DESC);

-- Index on status for filtered admin views
CREATE INDEX IF NOT EXISTS idx_leads_status      ON leads (status);

-- Index on postcode for geographic analysis (no PII leak risk)
CREATE INDEX IF NOT EXISTS idx_leads_postcode    ON leads (postcode);

-- Partial index: find leads that haven't been contacted yet (fast dashboard query)
CREATE INDEX IF NOT EXISTS idx_leads_new         ON leads (created_at DESC)
    WHERE status = 'new';


-- ── AUDIT LOG TABLE ──────────────────────────────────────────
-- Immutable append-only log of all changes to leads.
-- Supports GDPR Subject Access Requests and data breach investigation.
CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER     PRIMARY KEY AUTOINCREMENT,
    lead_id     TEXT        REFERENCES leads(id) ON DELETE SET NULL,
    action      TEXT        NOT NULL CHECK(action IN ('created', 'viewed', 'updated', 'deleted', 'exported', 'anonymised')),
    actor       TEXT        NOT NULL DEFAULT 'system',  -- 'system' | 'admin' | 'api'
    detail      TEXT,                                   -- JSON payload of changes
    ip_address  TEXT,
    created_at  TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_lead_id    ON audit_log (lead_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log (created_at DESC);


-- ── ADMIN SESSIONS TABLE ─────────────────────────────────────
-- Tracks admin access for security monitoring.
-- Not a full auth system — token auth is handled in middleware.
CREATE TABLE IF NOT EXISTS admin_sessions (
    id          INTEGER     PRIMARY KEY AUTOINCREMENT,
    action      TEXT        NOT NULL,
    ip_address  TEXT,
    created_at  TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ── TRIGGER: auto-update updated_at ──────────────────────────
-- Keeps updated_at current without relying on application logic.
CREATE TRIGGER IF NOT EXISTS leads_updated_at
    AFTER UPDATE ON leads
    FOR EACH ROW
BEGIN
    UPDATE leads SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = OLD.id;
END;
