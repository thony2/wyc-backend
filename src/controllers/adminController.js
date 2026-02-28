/**
 * ============================================================
 * West Yorkshire Carpets — Admin Controller
 * src/controllers/adminController.js
 *
 * Handles admin-only operations on lead data.
 * All routes require the ADMIN_TOKEN bearer token.
 *
 * Functions exported:
 *   listLeads(req, res)     — GET  /api/admin/leads
 *   getLead(req, res)       — GET  /api/admin/leads/:id
 *   updateStatus(req, res)  — PATCH /api/admin/leads/:id/status
 *   deleteLead(req, res)    — DELETE /api/admin/leads/:id
 *   exportCsv(req, res)     — GET  /api/admin/leads/export.csv
 *   getDashboard(req, res)  — GET  /api/admin/dashboard
 * ============================================================
 */

'use strict';

const db         = require('../config/database');
const csvService = require('../services/csvService');
const logger     = require('../utils/logger');

// ── Prepared Statements ──────────────────────────────────────

const stmtListLeads = db.prepare(`
    SELECT *
    FROM leads
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
`);

const stmtCountLeads = db.prepare(`
    SELECT COUNT(*) AS total FROM leads WHERE (:status IS NULL OR status = :status)
`);

const stmtGetLead = db.prepare(`
    SELECT * FROM leads WHERE id = ?
`);

const stmtGetAuditLog = db.prepare(`
    SELECT id, action, actor, detail, ip_address, created_at
    FROM audit_log
    WHERE lead_id = ?
    ORDER BY created_at ASC
`);

const stmtSetBooking = db.prepare(`
    UPDATE leads
    SET booking_date  = ?,
        booking_time  = ?,
        booking_type  = ?,
        booking_notes = ?,
        updated_at    = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
`);

const stmtGetCalendar = db.prepare(`
    SELECT id, name, phone, postcode, service_type,
           status, booking_date, booking_time, booking_type, booking_notes
    FROM leads
    WHERE booking_date BETWEEN ? AND ?
    ORDER BY booking_date ASC, booking_time ASC
`);

const stmtGetUnscheduled = db.prepare(`
    SELECT id, name, phone, postcode, service_type, status, created_at
    FROM leads
    WHERE booking_date IS NULL
      AND status NOT IN ('won', 'lost', 'spam')
    ORDER BY created_at DESC
    LIMIT 20
`);

const stmtUpdateStatus = db.prepare(`
    UPDATE leads SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE id = ?
`);

const stmtDeleteLead = db.prepare(`
    DELETE FROM leads WHERE id = ?
`);

const stmtInsertAudit = db.prepare(`
    INSERT INTO audit_log (lead_id, action, actor, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
`);

const stmtDashboard = db.prepare(`
    SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'new'       THEN 1 ELSE 0 END) AS new_count,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) AS contacted_count,
        SUM(CASE WHEN status = 'quoted'    THEN 1 ELSE 0 END) AS quoted_count,
        SUM(CASE WHEN status = 'won'       THEN 1 ELSE 0 END) AS won_count,
        SUM(CASE WHEN status = 'lost'      THEN 1 ELSE 0 END) AS lost_count,
        SUM(CASE WHEN status = 'spam'      THEN 1 ELSE 0 END) AS spam_count,
        SUM(CASE WHEN created_at >= date('now', '-7 days') THEN 1 ELSE 0 END) AS last_7_days,
        SUM(CASE WHEN created_at >= date('now', '-30 days') THEN 1 ELSE 0 END) AS last_30_days
    FROM leads
`);

const stmtLeadsByService = db.prepare(`
    SELECT service_type, COUNT(*) AS count
    FROM leads
    GROUP BY service_type
    ORDER BY count DESC
`);

const stmtRecentLeads = db.prepare(`
    SELECT id, name, phone, postcode, service_type, status, created_at
    FROM leads
    ORDER BY created_at DESC
    LIMIT 5
`);

// ── Helper: get client IP ────────────────────────────────────
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || 'unknown';
}

// ── VALID STATUS VALUES ──────────────────────────────────────
const VALID_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost', 'spam'];

// ============================================================
// GET /api/admin/leads
// Returns paginated list of leads, optionally filtered by status.
// Query params: ?page=1&limit=20&status=new
// ============================================================

function listLeads(req, res) {
    try {
        const page   = Math.max(1, parseInt(req.query.page   || '1',  10));
        const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const offset = (page - 1) * limit;
        const status = req.query.status || null;

        // Fetch page of leads
        let leads;
        if (status && VALID_STATUSES.includes(status)) {
            leads = db.prepare(`
    SELECT * FROM leads
    WHERE status = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
`).all(status, limit, offset);
        } else {
            leads = db.prepare(`
    SELECT * FROM leads
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
`).all(limit, offset);
        }

        const totalRow = stmtCountLeads.get({ status: status || null });
        const total    = totalRow?.total || 0;

        // Log admin access
        stmtInsertAudit.run(null, 'viewed', 'admin', JSON.stringify({ page, limit, status }), getClientIp(req));

        return res.json({
            success: true,
            data:    leads,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });

    } catch (err) {
        logger.error(`[Admin] listLeads error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to retrieve leads.' });
    }
}

// ============================================================
// GET /api/admin/leads/:id
// Returns a single lead with its full audit history.
// ============================================================

function getLead(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Lead ID is required.' });
        }

        const lead = stmtGetLead.get(id);

        if (!lead) {
            return res.status(404).json({ success: false, error: 'Lead not found.' });
        }

        const auditLog = stmtGetAuditLog.all(id);

        // Log the view
        stmtInsertAudit.run(id, 'viewed', 'admin', null, getClientIp(req));

        return res.json({
            success: true,
            data:    { ...lead, audit_log: auditLog },
        });

    } catch (err) {
        logger.error(`[Admin] getLead error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to retrieve lead.' });
    }
}

// ============================================================
// PATCH /api/admin/leads/:id/status
// Body: { "status": "contacted" }
// ============================================================

function updateStatus(req, res) {
    try {
        const { id }     = req.params;
        const { status } = req.body;

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                error:   `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`,
            });
        }

        const existing = stmtGetLead.get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Lead not found.' });
        }

        const result = stmtUpdateStatus.run(status, id);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'Lead not found or already up to date.' });
        }

        // Audit the status change with old and new values
        stmtInsertAudit.run(
            id, 'updated', 'admin',
            JSON.stringify({ field: 'status', from: existing.status, to: status }),
            getClientIp(req),
        );

        logger.info(`[Admin] Lead ${id} status updated: ${existing.status} → ${status}`);

        return res.json({
            success: true,
            message: `Lead status updated to "${status}".`,
        });

    } catch (err) {
        logger.error(`[Admin] updateStatus error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to update lead status.' });
    }
}

// ============================================================
// DELETE /api/admin/leads/:id
// GDPR-compliant: anonymises PII rather than hard-deletes,
// unless query param ?hard=true is passed with caution.
// ============================================================

function deleteLead(req, res) {
    try {
        const { id }   = req.params;
        const hardDelete = req.query.hard === 'true';

        const existing = stmtGetLead.get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Lead not found.' });
        }

        if (hardDelete) {
    const result = stmtDeleteLead.run(id);
    try { stmtInsertAudit.run(id, 'deleted', 'admin', JSON.stringify({ hard: true }), getClientIp(req)); } catch(auditErr) { /* audit optional */ }
    logger.warn(`[Admin] Hard-deleted lead ${id}`);
    return res.json({ success: true, message: 'Lead permanently deleted.' });
}

        // Soft anonymisation — preserves record for analytics; removes all PII
        db.prepare(`
            UPDATE leads SET
                name      = '[Anonymised]',
                email     = NULL,
                phone     = '[Anonymised]',
                ip_address = NULL,
                user_agent = NULL,
                status    = 'spam',
                updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            WHERE id = ?
        `).run(id);

        stmtInsertAudit.run(id, 'anonymised', 'admin', JSON.stringify({ requested: true }), getClientIp(req));

        logger.info(`[Admin] Lead ${id} anonymised (GDPR soft delete)`);
        return res.json({ success: true, message: 'Lead data anonymised in compliance with GDPR.' });

    } catch (err) {
        logger.error(`[Admin] deleteLead error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to process request.' });
    }
}

// ============================================================
// GET /api/admin/leads/export.csv
// Downloads all leads as a CSV file.
// Query params: ?status=new&from=2025-01-01&to=2025-12-31
// ============================================================

async function exportCsv(req, res) {
    try {
        const { status, from, to } = req.query;

        let sql = `
            SELECT
                id, name, email, phone, postcode,
                service_type, message,
                room_length_m, room_width_m, flooring_type,
                CASE include_underlay WHEN 1 THEN 'Yes' ELSE 'No' END AS include_underlay,
                CASE include_fitting  WHEN 1 THEN 'Yes' ELSE 'No' END AS include_fitting,
                estimated_cost,
                CASE WHEN gdpr_consent_at IS NOT NULL THEN 'Yes' ELSE 'No' END AS gdpr_consent,
                status, source, created_at
            FROM leads
            WHERE 1=1
        `;

        const params = [];
        if (status && VALID_STATUSES.includes(status)) { sql += ' AND status = ?'; params.push(status); }
        if (from)   { sql += ' AND created_at >= ?'; params.push(from); }
        if (to)     { sql += ' AND created_at <= ?'; params.push(to + 'T23:59:59Z'); }
        sql += ' ORDER BY created_at DESC';

        const leads = db.prepare(sql).all(...params);

        // Log the export
        stmtInsertAudit.run(
            null, 'exported', 'admin',
            JSON.stringify({ count: leads.length, status, from, to }),
            getClientIp(req),
        );

        logger.info(`[Admin] CSV export — ${leads.length} leads`);

        const csvContent = await csvService.generateCsv(leads);

        const filename = `wyc-leads-${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader('Content-Type',        'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csvContent);

    } catch (err) {
        logger.error(`[Admin] exportCsv error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to generate CSV export.' });
    }
}

// ============================================================
// GET /api/admin/dashboard
// Returns summary statistics for the admin dashboard.
// ============================================================

function getDashboard(req, res) {
    try {
        const stats        = stmtDashboard.get();
        const byService    = stmtLeadsByService.all();
        const recentLeads  = stmtRecentLeads.all();

        return res.json({
            success: true,
            data: {
                summary:      stats,
                by_service:   byService,
                recent_leads: recentLeads,
                generated_at: new Date().toISOString(),
            },
        });

    } catch (err) {
        logger.error(`[Admin] getDashboard error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to generate dashboard.' });
    }
}


// ============================================================
// PATCH /api/admin/leads/:id/booking
// Body: { booking_date, booking_time, booking_type, booking_notes }
// ============================================================
function setBooking(req, res) {
    try {
        const { id } = req.params;
        const { booking_date, booking_time, booking_type, booking_notes } = req.body;

        const existing = stmtGetLead.get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Lead not found.' });
        }

        const validTypes = ['measurement', 'installation', 'callback', 'quote', null, ''];
        if (booking_type && !validTypes.includes(booking_type)) {
            return res.status(400).json({ success: false, error: 'Invalid booking type.' });
        }

        stmtSetBooking.run(
            booking_date  || null,
            booking_time  || null,
            booking_type  || null,
            booking_notes || null,
            id
        );

        try {
            stmtInsertAudit.run(id, 'updated', 'admin',
                JSON.stringify({ field: 'booking', booking_date, booking_type }),
                getClientIp(req));
        } catch(e) {}

        logger.info(`[Admin] Lead ${id} booked for ${booking_date}`);
        return res.json({ success: true, message: 'Booking saved.' });

    } catch (err) {
        logger.error(`[Admin] setBooking error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to save booking.' });
    }
}

// ============================================================
// GET /api/admin/calendar?month=2026-03
// Returns all bookings for a given month + unscheduled leads
// ============================================================
function getCalendar(req, res) {
    try {
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const from  = `${month}-01`;
        const to    = `${month}-31`;

        const bookings     = stmtGetCalendar.all(from, to);
        const unscheduled  = stmtGetUnscheduled.all();

        return res.json({
            success: true,
            data: { bookings, unscheduled, month }
        });

    } catch (err) {
        logger.error(`[Admin] getCalendar error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to load calendar.' });
    }
}

module.exports = {
    listLeads,
    getLead,
    updateStatus,
    deleteLead,
    exportCsv,
    getDashboard,
    setBooking,
    getCalendar,
};
