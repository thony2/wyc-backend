'use strict';

/**
 * scripts/migrate.js
 *
 * Usage: node scripts/migrate.js  (or: npm run db:migrate)
 *
 * Replaces migrate-auto.js (deleted — 1C, see MASTER_CHECKLIST.md).
 * migrate-auto.js re-ran its entire ~30-statement schema block on every
 * single server boot. It worked, because it was disciplined about
 * `IF NOT EXISTS` everywhere, but it meant every deploy — and every local
 * `npm run dev` restart — paid the cost of ~30 no-op database round trips,
 * and meant schema changes were an invisible side effect of starting the
 * app rather than a deliberate, visible step.
 *
 * This runner tracks which migration files have already been applied in a
 * `_migrations` table, and only runs the ones that haven't. Migration files
 * themselves are still written idempotently (IF NOT EXISTS / ON CONFLICT DO
 * NOTHING) — that's what makes it safe for 001_initial_schema.sql to run
 * for the first time against a database that already has that schema
 * applied (i.e. the current live database): it's a no-op there, gets
 * recorded as applied, and is never executed again.
 *
 * server.js no longer runs any migration logic at all. This script is the
 * one place that does. On Railway, it's chained into the "start" script in
 * package.json ("node scripts/migrate.js && node server.js") so it still
 * runs automatically on every deploy without needing any Railway dashboard
 * configuration outside this repo — but it's now a distinct, visible step,
 * not buried inside server.js's own startup.
 *
 * Exports a single async function, applyMigrations(db) — same shape as
 * migrate-auto.js's own `module.exports = async function(db) {...}` — on
 * purpose: src/tests/leads.test.js requires this file directly and awaits
 * it against a test database, exactly like it did with migrate-auto.js
 * before this migration. That's why the core logic doesn't call
 * process.exit() itself; only the CLI entrypoint at the bottom of this
 * file does, and it's guarded so it doesn't run when this file is
 * `require()`d as a module instead of executed directly.
 *
 * Deliberate behaviour change from migrate-auto.js: that script caught
 * every error, logged it, and let the server boot anyway — meaning a
 * broken migration could leave the app running against an incomplete
 * schema without anyone necessarily noticing. This one does not swallow
 * errors: the CLI entrypoint exits non-zero on failure, which (via the &&
 * chain in package.json) stops the deploy from starting the server at
 * all. Failing loudly is safer than booting quietly broken.
 */

const fs   = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(db) {
    await db.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
            filename    TEXT PRIMARY KEY,
            applied_at  TIMESTAMP DEFAULT NOW()
        )
    `);
}

async function getAppliedMigrations(db) {
    const result = await db.query('SELECT filename FROM _migrations');
    return new Set(result.rows.map(r => r.filename));
}

async function runSqlFile(db, filename) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
    await db.query(sql);
    await db.query('INSERT INTO _migrations (filename) VALUES ($1)', [filename]);
}

async function seedDefaultAdmin(db) {
    if (!process.env.ADMIN_DEFAULT_PASSWORD) {
        console.warn('[Migrate] ADMIN_DEFAULT_PASSWORD not set — skipping default admin creation');
        return;
    }
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(process.env.ADMIN_DEFAULT_PASSWORD, 10);
    await db.query(
        `INSERT INTO admin_users (username, password_hash, role)
         VALUES ($1, $2, 'admin')
         ON CONFLICT (username) DO NOTHING`,
        ['admin', hash]
    );
}

/**
 * Core logic, reusable — takes a db/pool instance, does NOT exit the
 * process. Returns true if any migration file actually ran, false if
 * everything was already applied.
 */
async function applyMigrations(db) {
    await ensureMigrationsTable(db);
    const applied = await getAppliedMigrations(db);

    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort(); // numbered prefixes (001_, 002_, ...) sort correctly as strings

    let ranAny = false;
    for (const filename of files) {
        if (applied.has(filename)) continue;
        console.log(`[Migrate] Running ${filename}...`);
        await runSqlFile(db, filename);
        ranAny = true;
    }

    // Idempotent regardless of whether any .sql files ran this time —
    // matches migrate-auto.js's original behaviour of always checking this.
    await seedDefaultAdmin(db);

    return ranAny;
}

module.exports = applyMigrations;

// CLI entrypoint — only runs when this file is executed directly
// (`node scripts/migrate.js`), not when required as a module.
if (require.main === module) {
    require('dotenv').config();
    const db = require('../src/config/database');

    applyMigrations(db)
        .then(ranAny => {
            console.log(ranAny ? '[Migrate] Done.' : '[Migrate] Nothing to do — already up to date.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Migrate] FAILED:', err.message);
            process.exit(1);
        });
}
