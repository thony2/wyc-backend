'use strict';
/**
 * scripts/reset-admin-password.js
 *
 * Resets the admin user's password in the database.
 * Reads the new password from the ADMIN_DEFAULT_PASSWORD environment variable.
 *
 * Usage:
 *   npm run admin:reset-password
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db     = require('../src/config/database');

async function resetAdminPassword() {
    const newPassword = process.env.ADMIN_DEFAULT_PASSWORD;

    // 1. Refuse to run without the env variable set
    if (!newPassword) {
        console.error('\n✗  Error: ADMIN_DEFAULT_PASSWORD is not set in your .env file.');
        console.error('   Add it and run this script again.\n');
        process.exit(1);
    }

    // 2. Enforce a minimum password strength
    if (newPassword.length < 12) {
        console.error('\n✗  Error: Password must be at least 12 characters long.\n');
        process.exit(1);
    }

    // 3. Hash the new password (12 rounds is the production-appropriate cost)
    console.log('\n  Hashing new password...');
    const hash = bcrypt.hashSync(newPassword, 12);

    // 4. Update the record in the database
    try {
        const result = await db.query(
            `UPDATE admin_users
             SET password_hash = $1, updated_at = NOW()
             WHERE username = 'admin'
             RETURNING username`,
            [hash]
        );

        if (result.rows.length === 0) {
            console.error('\n✗  No admin user found in the database.');
            console.error('   Has the server been started at least once to run migrations?\n');
            process.exit(1);
        }

        console.log(`\n✓  Password successfully updated for user: "${result.rows[0].username}"`);
        console.log('   Log in with your new password now.\n');
        process.exit(0);

    } catch (err) {
        console.error('\n✗  Database error:', err.message, '\n');
        process.exit(1);
    }
}

resetAdminPassword();