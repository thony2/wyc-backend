'use strict';

/**
 * scripts/check-leads.js
 *
 * Quick CLI check of recent leads — usage: node scripts/check-leads.js
 *
 * Replaces scripts/check-leads.sh (removed 2 Aug 2026), which had two bugs
 * that made it non-functional against the current Postgres-only setup:
 *
 * 1. It called `db.prepare(sql).all()` and used the result synchronously —
 *    but src/config/database.js's Postgres wrapper's `.all()` is async
 *    (returns a Promise). The old script would have printed a pending
 *    Promise object, not real lead data.
 * 2. It never loaded the .env file. server.js is the only place in this
 *    codebase that calls `require('dotenv').config()` — any other script
 *    that requires src/config/database.js directly, standalone, gets
 *    undefined for PGHOST/PGDATABASE/etc. unless something else loads
 *    .env first.
 *
 * Both are fixed here, not worked around — this file loads dotenv itself
 * and properly awaits the query.
 */

require('dotenv').config();
const db = require('../src/config/database');

async function main() {
    const result = await db.query(
        `SELECT name, phone, postcode, service_type, status, created_at
         FROM leads
         ORDER BY created_at DESC
         LIMIT 50`
    );

    console.log(`Total leads shown: ${result.rows.length} (most recent 50)`);
    console.table(result.rows);

    // pg's connection pool keeps the process alive until explicitly ended —
    // without this, the script would just hang after printing the table.
    process.exit(0);
}

main().catch(err => {
    console.error('✗ Failed to check leads:', err.message);
    process.exit(1);
});
