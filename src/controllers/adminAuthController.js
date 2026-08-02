'use strict';

/**
 * src/controllers/adminAuthController.js
 *
 * Login and change-password, extracted from routes/panel.js (5A step 3 —
 * see MASTER_CHECKLIST.md). Mounted at /api/panel in src/routes/panel.js,
 * same paths as before (/login, /change-password).
 *
 * Two changes made during this move, not just a file relocation:
 * - Switched from bcryptjs's synchronous compareSync/hashSync to the async
 *   compare/hash. This closes the one item that was still listed under
 *   README.md's "Security Summary > Known, currently-open gaps" — sync
 *   bcrypt blocks the Node event loop for the duration of the hash
 *   comparison, which is a real (if modest at current traffic) DoS surface
 *   on a login endpoint specifically, since it's the one endpoint anyone
 *   unauthenticated can hit repeatedly.
 * - Error responses now log the real error via logger.error and return a
 *   generic message, matching leadController.js/adminController.js's
 *   existing pattern instead of routes/panel.js's previous
 *   `{ error: 'Unexpected error' }` catch-all, which was already generic
 *   here specifically but wasn't logging anything server-side on failure.
 */

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/database');
const logger  = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    logger.error('FATAL: JWT_SECRET env var not set');
    process.exit(1);
}

async function login(req, res) {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Missing credentials' });
        }

        const result = await db.query('SELECT * FROM admin_users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        await db.query('UPDATE admin_users SET last_login = NOW() WHERE id = $1', [user.id]);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, username: user.username, role: user.role });
    } catch (e) {
        logger.error(`[Auth] login error: ${e.message}`);
        res.status(500).json({ error: 'Unexpected error' });
    }
}

async function changePassword(req, res) {
    try {
        const { current_password, new_password } = req.body;
        if (!new_password || new_password.length < 8) {
            return res.status(400).json({ error: 'Minimum 8 characters required' });
        }

        const result = await db.query('SELECT * FROM admin_users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];

        if (!(await bcrypt.compare(current_password, user.password_hash))) {
            return res.status(401).json({ error: 'Current password incorrect' });
        }

        const hash = await bcrypt.hash(new_password, 10);
        await db.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

        res.json({ success: true });
    } catch (e) {
        logger.error(`[Auth] changePassword error: ${e.message}`);
        res.status(500).json({ error: 'Failed to change password.' });
    }
}

module.exports = { login, changePassword };
