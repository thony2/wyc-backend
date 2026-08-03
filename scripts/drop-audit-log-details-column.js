'use strict';
/**
 * scripts/drop-audit-log-details-column.js
 *
 * Drops audit_log.details (plural) — confirmed dead code, see 0.5-H in
 * MASTER_CHECKLIST.md. Nothing in the codebase reads or writes it; only the
 * singular audit_log.detail column is used (routes/panel.js's audit()
 * helper, adminController.js, leadController.js, and the admin panel's own
 * display of the audit log all confirmed to use "detail", never "details").
 *
 * This is deliberately NOT part of scripts/migrate.js. That script runs
 * automatically on every deploy/dev session (1C, 2 Aug 2026 — replaces the
 * old migrate-auto.js) and is designed only for safe, additive, idempotent
 * changes (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS). Dropping
 * a column is destructive and shouldn't be something
 * that could ever run silently and automatically — it belongs in a script
 * a person deliberately chooses to run once, the same way
 * reset-admin-password.js works.
 *
 * Before dropping, this script reports how many rows (if any) currently
 * have a non-null value in the column, so you get one last chance to notice
 * anything unexpected before it's gone. Safe to run more than once — if the
 * column has already been dropped, it says so and exits cleanly rather than
 * erroring.
 *
 * Usage:
 *   npm run db:drop-audit-details-column
 */

require('dotenv').config();
const db = require('../src/config/database');

async function dropAuditLogDetailsColumn() {
    // 1. Check whether the column still exists at all — makes this script
    //    safe to run more than once without erroring.
    const columnCheck = await db.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'audit_log' AND column_name = 'details'`
    );

    if (columnCheck.rows.length === 0) {
        console.log('\n✓  audit_log.details does not exist (already dropped, or never existed).');
        console.log('   Nothing to do.\n');
        process.exit(0);
    }

    // 2. Report what's actually in the column before removing it.
    const countResult = await db.query(
        `SELECT
             COUNT(*) AS total_rows,
             COUNT(details) AS rows_with_non_null_details
         FROM audit_log`
    );
    const { total_rows, rows_with_non_null_details } = countResult.rows[0];

    console.log(`\n  audit_log has ${total_rows} row(s) total.`);
    console.log(`  ${rows_with_non_null_details} of them have a non-null value in "details".`);

    if (Number(rows_with_non_null_details) > 0) {
        console.log('\n  ⚠  That is unexpected — the codebase audit found nothing that writes to this');
        console.log('     column. If this number is not 0, stop and check where that data came from');
        console.log('     before proceeding, in case something outside this codebase depends on it.\n');
    }

    // 3. Drop it.
    try {
        await db.query(`ALTER TABLE audit_log DROP COLUMN IF EXISTS details`);
        console.log('✓  Dropped audit_log.details.\n');
        process.exit(0);
    } catch (err) {
        console.error('\n✗  Failed to drop the column:', err.message, '\n');
        process.exit(1);
    }
}

dropAuditLogDetailsColumn().catch((err) => {
    console.error('\n✗  Unexpected error:', err.message, '\n');
    process.exit(1);
});
