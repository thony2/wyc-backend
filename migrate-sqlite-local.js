/* ============================================================
   WYC — Database Migration
   Run once: node migrate.js
============================================================ */
const Database = require('better-sqlite3');
const path     = require('path');

const db = new Database(path.join(__dirname, 'wyc_leads.db'));

db.exec(`
/* ── CATEGORIES ── */
CREATE TABLE IF NOT EXISTS categories (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL UNIQUE,
    slug          TEXT    NOT NULL UNIQUE,
    description   TEXT,
    display_order INTEGER DEFAULT 0,
    created_at    TEXT    DEFAULT (datetime('now'))
);

/* ── PRODUCTS ── */
CREATE TABLE IF NOT EXISTS products (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    category_slug  TEXT    NOT NULL REFERENCES categories(slug),
    subcategory    TEXT,
    sku            TEXT    UNIQUE,
    price          REAL    NOT NULL CHECK(price >= 0),
    original_price REAL,
    stock_level    INTEGER DEFAULT 0 CHECK(stock_level >= 0),
    description    TEXT,
    img_url        TEXT,
    badge          TEXT,
    badge_type     TEXT,
    pile_type      TEXT,
    pile_height    TEXT,
    weight         TEXT,
    wear_rating    TEXT,
    thickness      TEXT,
    finish         TEXT,
    ac_rating      TEXT,
    wear_layer     TEXT,
    board_format   TEXT,
    top_layer      TEXT,
    rooms          TEXT    DEFAULT '[]',
    durability     INTEGER DEFAULT 3 CHECK(durability BETWEEN 1 AND 5),
    softness       INTEGER DEFAULT 3 CHECK(softness BETWEEN 1 AND 5),
    is_featured    INTEGER DEFAULT 0,
    is_deal        INTEGER DEFAULT 0,
    is_active      INTEGER DEFAULT 1,
    created_at     TEXT    DEFAULT (datetime('now')),
    updated_at     TEXT    DEFAULT (datetime('now'))
);

/* ── OFFERS ── */
CREATE TABLE IF NOT EXISTS offers (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id       INTEGER REFERENCES products(id) ON DELETE CASCADE,
    offer_name       TEXT    NOT NULL,
    discounted_price REAL    NOT NULL CHECK(discounted_price >= 0),
    start_date       TEXT    NOT NULL,
    end_date         TEXT    NOT NULL,
    is_featured      INTEGER DEFAULT 0,
    is_active        INTEGER DEFAULT 1,
    created_at       TEXT    DEFAULT (datetime('now'))
);

/* ── ADMIN USERS ── */
CREATE TABLE IF NOT EXISTS admin_users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT    NOT NULL UNIQUE,
    password_hash TEXT   NOT NULL,
    role         TEXT    DEFAULT 'editor' CHECK(role IN ('admin','editor')),
    last_login   TEXT,
    created_at   TEXT    DEFAULT (datetime('now'))
);

/* ── AUDIT LOG ── */
CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES admin_users(id),
    username   TEXT,
    action     TEXT    NOT NULL,
    table_name TEXT,
    record_id  INTEGER,
    details    TEXT,
    created_at TEXT    DEFAULT (datetime('now'))
);
`);

/* ── SEED CATEGORIES ── */
const cats = db.prepare(`
    INSERT OR IGNORE INTO categories (name, slug, description, display_order)
    VALUES (?, ?, ?, ?)
`);
[
    ['Carpets',  'carpets',  'Plush, twist & berber — supreme comfort underfoot', 1],
    ['Vinyl',    'vinyl',    '100% waterproof LVT — kitchens & bathrooms perfected', 2],
    ['Laminate', 'laminate', 'Scratch-resistant wood effects — tough enough for families', 3],
    ['Wood',     'wood',     'Genuine engineered & solid oak — floors that last a lifetime', 4],
].forEach(c => cats.run(...c));

/* ── SEED PRODUCTS (your existing catalogue data) ── */
const ins = db.prepare(`
    INSERT OR IGNORE INTO products
    (name, category_slug, subcategory, sku, price, original_price,
     stock_level, description, img_url, badge, badge_type,
     rooms, durability, softness, is_featured, is_deal, is_active)
    VALUES
    (@name,@category_slug,@subcategory,@sku,@price,@original_price,
     @stock_level,@description,@img_url,@badge,@badge_type,
     @rooms,@durability,@softness,@is_featured,@is_deal,@is_active)
`);

const products = [
    { name:'Prestige Saxony', category_slug:'carpets', subcategory:'Saxony', sku:'C-001', price:24.99, original_price:null, stock_level:50, description:'A luxuriously deep-pile saxony carpet.', img_url:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=700&q=80', badge:'Best Seller', badge_type:'seller', rooms:'["living","bedroom"]', durability:3, softness:5, is_featured:1, is_deal:0, is_active:1 },
    { name:'Heritage Twist',  category_slug:'carpets', subcategory:'Twist',  sku:'C-002', price:18.50, original_price:24.00, stock_level:35, description:'A classic tightly-twisted carpet.', img_url:'https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=700&q=80', badge:'Sale', badge_type:'sale', rooms:'["living","bedroom","hallway","stairs"]', durability:5, softness:3, is_featured:0, is_deal:1, is_active:1 },
    { name:'Stone Clic Pro',  category_slug:'vinyl',   subcategory:'Rigid Core LVT', sku:'V-001', price:28.99, original_price:null, stock_level:80, description:'A premium stone-effect luxury vinyl tile.', img_url:'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=700&q=80', badge:'Best Seller', badge_type:'seller', rooms:'["kitchen","bathroom","hallway"]', durability:5, softness:1, is_featured:1, is_deal:0, is_active:1 },
    { name:'Nordic White Oak AC5', category_slug:'laminate', subcategory:'AC5', sku:'L-001', price:19.99, original_price:null, stock_level:60, description:'A light Scandinavian-style oak laminate.', img_url:'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=700&q=80', badge:'Best Seller', badge_type:'seller', rooms:'["living","bedroom","hallway"]', durability:5, softness:2, is_featured:1, is_deal:0, is_active:1 },
    { name:'Engineered Oak Natural', category_slug:'wood', subcategory:'Engineered', sku:'W-001', price:54.99, original_price:null, stock_level:25, description:'Real engineered oak with a 4mm top layer.', img_url:'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=700&q=80', badge:'Best Seller', badge_type:'seller', rooms:'["living","bedroom","hallway"]', durability:4, softness:2, is_featured:1, is_deal:0, is_active:1 },
];
products.forEach(p => ins.run(p));

/* ── SEED ADMIN USER ── */
require('dotenv').config();
const bcrypt = require('bcryptjs');
if (process.env.SEED_ADMIN_PASSWORD) {
    const hash = bcrypt.hashSync(process.env.SEED_ADMIN_PASSWORD, 10);
    db.prepare(`
        INSERT OR IGNORE INTO admin_users (username, password_hash, role)
        VALUES ('admin', ?, 'admin')
    `).run(hash);
    console.log('✅ Migration complete. Admin login: admin / [password from SEED_ADMIN_PASSWORD]');
    console.log('⚠️  Change your password immediately after first login!');
} else {
    console.warn('⚠️  SEED_ADMIN_PASSWORD not set in .env — skipping default admin creation');
}
db.close();
