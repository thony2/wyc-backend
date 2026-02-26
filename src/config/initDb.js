/**
 * ============================================================
 * West Yorkshire Carpets — Database Initialiser
 * src/config/initDb.js
 *
 * Run once before starting the server:
 *   node src/config/initDb.js
 *
 * This is idempotent — safe to run multiple times.
 * ============================================================
 */

'use strict';

require('dotenv').config();

const path = require('path');
const fs   = require('fs');

console.log('\n▶  West Yorkshire Carpets — Database Initialiser\n');

try {
    // Ensure data directory exists
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`✓  Created data directory: ${dataDir}`);
    }

    // getDatabase() triggers schema.sql execution on first call
    const db = require('./database');

    // Verify tables were created
    const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();

    console.log('✓  Database initialised successfully');
    console.log('✓  Tables created:');
    tables.forEach(t => console.log(`     • ${t.name}`));

    console.log('\n  You can now start the server with: npm run dev\n');

} catch (err) {
    console.error('\n✗  Initialisation failed:', err.message);
    console.error('  Ensure all dependencies are installed: npm install\n');
    process.exit(1);
}
