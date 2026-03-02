'use strict';
const bcrypt = require('bcryptjs');

module.exports = function(db) {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                slug TEXT NOT NULL UNIQUE,
                description TEXT,
                display_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category_slug TEXT NOT NULL,
                subcategory TEXT,
                sku TEXT UNIQUE,
                price REAL NOT NULL CHECK(price >= 0),
                original_price REAL,
                stock_level INTEGER DEFAULT 0,
                description TEXT,
                img_url TEXT,
                badge TEXT,
                badge_type TEXT,
                rooms TEXT DEFAULT '[]',
                durability INTEGER DEFAULT 3,
                softness INTEGER DEFAULT 3,
                is_featured INTEGER DEFAULT 0,
                is_deal INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS offers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                offer_name TEXT NOT NULL,
                discounted_price REAL NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                is_featured INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'editor',
                last_login TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT,
                action TEXT NOT NULL,
                table_name TEXT,
                record_id INTEGER,
                details TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
        `);

        // Seed default admin if none exists
        const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
        if (!existing) {
            const hash = bcrypt.hashSync('Admin@WYC2026!', 10);
            db.prepare(`INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, 'admin')`).run('admin', hash);
            console.log('[Admin] Default admin user created');
        }

        // Seed categories
        const cats = [
            ['Carpets',  'carpets',  'Plush, twist & berber', 1],
            ['Vinyl',    'vinyl',    '100% waterproof LVT',   2],
            ['Laminate', 'laminate', 'Scratch-resistant',     3],
            ['Wood',     'wood',     'Genuine engineered oak',4],
        ];
        const catStmt = db.prepare(`INSERT OR IGNORE INTO categories (name,slug,description,display_order) VALUES (?,?,?,?)`);
        cats.forEach(c => catStmt.run(...c));

        console.log('[Admin] Tables ready');
    } catch(e) {
        console.error('[Admin] Migration error:', e.message);
    }
};
