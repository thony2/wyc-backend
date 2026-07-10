/**
 * ============================================================
 * West Yorkshire Carpets — Database Connection Check
 * src/config/initDb.js
 *
 * Run once before starting the server, or any time you want to
 * confirm your .env is pointing at a working PostgreSQL database:
 *   node src/config/initDb.js
 *
 * This only checks the connection and lists existing tables — it
 * does not create or change anything. Safe to run any time.
 * ============================================================
 */

'use strict';

require('dotenv').config();

console.log('\n▶  West Yorkshire Carpets — Database Connection Check\n');

(async () => {
    try {
        const db = require('./database');

        const { rows } = await db.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        );

        console.log('✓  Connected to PostgreSQL successfully');
        console.log(`✓  ${rows.length} table(s) found:`);
        rows.forEach(t => console.log(`     • ${t.table_name}`));

        console.log('\n  You can now start the server with: npm run dev\n');
        process.exit(0);
    } catch (err) {
        console.error('\n✗  Connection check failed:', err.message);
        console.error('  Check PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD in your .env file.\n');
        process.exit(1);
    }
})();
