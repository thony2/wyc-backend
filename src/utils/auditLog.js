'use strict';

/**
 * src/utils/auditLog.js
 *
 * Shared audit-log writer for the product/offer admin actions, extracted from
 * routes/panel.js as part of migrating it into src/ (5A step 3 — see
 * MASTER_CHECKLIST.md). Previously embedded directly in routes/panel.js;
 * pulled out here so productAdminController.js doesn't need its own copy.
 *
 * Not the same function as adminController.js's own audit() helper (for lead
 * actions) — deliberately kept separate rather than merged, because merging
 * them would require settling the audit_log.lead_id schema question first
 * (see the note below), and that's a bigger change than this migration
 * should carry.
 *
 * Known schema smell, not fixed here: audit_log's "lead_id" column is reused
 * to store product IDs and offer IDs too, disambiguated only by the `table`
 * field embedded in the JSON `detail` blob below. Works, but is a trap for
 * any future query against audit_log that assumes lead_id means what it
 * says. Flagged during the 1 Aug 2026 documentation reconciliation pass;
 * fixing it properly means a migration adding a generic record_id +
 * record_type pair, which is out of scope for a routing consolidation.
 */

async function auditProductAction(db, user, action, table, recordId, details, ip) {
    try {
        await db.query(
            `INSERT INTO audit_log (lead_id, action, actor, detail, ip_address)
             VALUES ($1, $2, $3, $4, $5)`,
            [recordId || null, action, user.username, JSON.stringify({ table, ...details }), ip || null]
        );
    } catch (e) {
        // Audit failures must never break the main request.
    }
}

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || 'unknown';
}

module.exports = { auditProductAction, getClientIp };
