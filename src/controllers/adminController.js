'use strict';

const db         = require('../config/database');
const csvService = require('../services/csvService');
const logger     = require('../utils/logger');

const VALID_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost', 'spam'];

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || 'unknown';
}

async function audit(leadId, action, actor, detail, ip) {
    try {
        await db.query(
            'INSERT INTO audit_log (lead_id, action, actor, detail, ip_address) VALUES ($1,$2,$3,$4,$5)',
            [leadId, action, actor, detail ? JSON.stringify(detail) : null, ip]
        );
    } catch (e) {
        // Audit failures must never break the main request
    }
}

async function getDashboard(req, res) {
    try {
        const [stats, byService, recentLeads] = await Promise.all([
            db.query(`
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'new'       THEN 1 ELSE 0 END) AS new_count,
                    SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) AS contacted_count,
                    SUM(CASE WHEN status = 'quoted'    THEN 1 ELSE 0 END) AS quoted_count,
                    SUM(CASE WHEN status = 'won'       THEN 1 ELSE 0 END) AS won_count,
                    SUM(CASE WHEN status = 'lost'      THEN 1 ELSE 0 END) AS lost_count,
                    SUM(CASE WHEN status = 'spam'      THEN 1 ELSE 0 END) AS spam_count,
                    SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days'  THEN 1 ELSE 0 END) AS last_7_days,
                    SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS last_30_days
                FROM leads
            `),
            db.query(`
                SELECT service_type, COUNT(*) AS count
                FROM leads
                GROUP BY service_type
                ORDER BY count DESC
            `),
            db.query(`
                SELECT id, name, phone, postcode, service_type, status, created_at
                FROM leads
                ORDER BY created_at DESC
                LIMIT 5
            `),
        ]);

        return res.json({
            success: true,
            data: {
                summary:      stats.rows[0],
                by_service:   byService.rows,
                recent_leads: recentLeads.rows,
                generated_at: new Date().toISOString(),
            },
        });
    } catch (err) {
        logger.error(`[Admin] getDashboard error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to generate dashboard.' });
    }
}

async function listLeads(req, res) {
    try {
        const page   = Math.max(1, parseInt(req.query.page  || '1',   10));
        const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit || '500', 10)));
        const offset = (page - 1) * limit;
        const status = req.query.status || null;

        let leadsResult, countResult;

        if (status && VALID_STATUSES.includes(status)) {
            [leadsResult, countResult] = await Promise.all([
                db.query(`SELECT * FROM leads WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [status, limit, offset]),
                db.query(`SELECT COUNT(*) AS total FROM leads WHERE status = $1`, [status]),
            ]);
        } else {
            [leadsResult, countResult] = await Promise.all([
                db.query(`SELECT * FROM leads ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
                db.query(`SELECT COUNT(*) AS total FROM leads`),
            ]);
        }

        const total = parseInt(countResult.rows[0]?.total || 0);

        return res.json({
            success: true,
            data:    leadsResult.rows,
            meta:    { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        logger.error(`[Admin] listLeads error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to retrieve leads.' });
    }
}

async function getLead(req, res) {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ success: false, error: 'Lead ID is required.' });

        const [leadResult, auditLog] = await Promise.all([
            db.query(`SELECT * FROM leads WHERE id = $1`, [id]),
            db.query(`SELECT id, action, actor, detail, ip_address, created_at FROM audit_log WHERE lead_id = $1 ORDER BY created_at ASC`, [id]),
        ]);

        if (!leadResult.rows.length) {
            return res.status(404).json({ success: false, error: 'Lead not found.' });
        }

        await audit(id, 'viewed', 'admin', null, getClientIp(req));

        return res.json({
            success: true,
            data:    { ...leadResult.rows[0], audit_log: auditLog.rows },
        });
    } catch (err) {
        logger.error(`[Admin] getLead error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to retrieve lead.' });
    }
}

async function updateStatus(req, res) {
    try {
        const { id }     = req.params;
        const { status } = req.body;

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.` });
        }

        const existing = await db.query(`SELECT status FROM leads WHERE id = $1`, [id]);
        if (!existing.rows.length) {
            return res.status(404).json({ success: false, error: 'Lead not found.' });
        }

        await db.query(`UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
        await audit(id, 'updated', 'admin', { field: 'status', from: existing.rows[0].status, to: status }, getClientIp(req));

        return res.json({ success: true, message: `Lead status updated to "${status}".` });
    } catch (err) {
        logger.error(`[Admin] updateStatus error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to update lead status.' });
    }
}

async function deleteLead(req, res) {
    try {
        const { id }     = req.params;
        const hardDelete = req.query.hard === 'true';

        const existing = await db.query(`SELECT id FROM leads WHERE id = $1`, [id]);
        if (!existing.rows.length) {
            return res.status(404).json({ success: false, error: 'Lead not found.' });
        }

        if (hardDelete) {
            await db.query(`DELETE FROM leads WHERE id = $1`, [id]);
            await audit(id, 'deleted', 'admin', { hard: true }, getClientIp(req));
            return res.json({ success: true, message: 'Lead permanently deleted.' });
        }

        await db.query(
            `UPDATE leads SET
                name = '[Anonymised]', email = NULL, phone = '[Anonymised]',
                ip_address = NULL, user_agent = NULL, status = 'spam', updated_at = NOW()
             WHERE id = $1`,
            [id]
        );
        await audit(id, 'anonymised', 'admin', { requested: true }, getClientIp(req));

        return res.json({ success: true, message: 'Lead data anonymised in compliance with GDPR.' });
    } catch (err) {
        logger.error(`[Admin] deleteLead error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to process request.' });
    }
}

async function exportCsv(req, res) {
    try {
        const { status, from, to } = req.query;

        let sql = `
            SELECT id, name, email, phone, postcode, service_type, message,
                   room_length_m, room_width_m, flooring_type,
                   CASE WHEN include_underlay = TRUE THEN 'Yes' ELSE 'No' END AS include_underlay,
                   CASE WHEN include_fitting  = TRUE THEN 'Yes' ELSE 'No' END AS include_fitting,
                   estimated_cost,
                   CASE WHEN gdpr_consent_at IS NOT NULL THEN 'Yes' ELSE 'No' END AS gdpr_consent,
                   status, source, created_at
            FROM leads WHERE 1=1
        `;

        const params = [];
        let i = 1;

        if (status && VALID_STATUSES.includes(status)) { sql += ` AND status = $${i++}`;      params.push(status); }
        if (from)                                       { sql += ` AND created_at >= $${i++}`; params.push(from); }
        if (to)                                         { sql += ` AND created_at <= $${i++}`; params.push(to + 'T23:59:59Z'); }

        sql += ' ORDER BY created_at DESC';

        const result = await db.query(sql, params);
        await audit(null, 'exported', 'admin', { count: result.rows.length, status, from, to }, getClientIp(req));

        const csvContent = await csvService.generateCsv(result.rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="wyc-leads-${new Date().toISOString().slice(0, 10)}.csv"`);

        return res.send(csvContent);
    } catch (err) {
        logger.error(`[Admin] exportCsv error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to generate CSV export.' });
    }
}

async function setBooking(req, res) {
    try {
        const { id } = req.params;
        const { booking_date, booking_time, booking_type, booking_notes } = req.body;

        const existing = await db.query(`SELECT id FROM leads WHERE id = $1`, [id]);
        if (!existing.rows.length) {
            return res.status(404).json({ success: false, error: 'Lead not found.' });
        }

        const validTypes = ['measurement', 'installation', 'callback', 'quote', null, ''];
        if (booking_type && !validTypes.includes(booking_type)) {
            return res.status(400).json({ success: false, error: 'Invalid booking type.' });
        }

        await db.query(
            `UPDATE leads SET booking_date = $1, booking_time = $2, booking_type = $3, booking_notes = $4, updated_at = NOW() WHERE id = $5`,
            [booking_date || null, booking_time || null, booking_type || null, booking_notes || null, id]
        );

        await audit(id, 'updated', 'admin', { field: 'booking', booking_date, booking_type }, getClientIp(req));

        return res.json({ success: true, message: 'Booking saved.' });
    } catch (err) {
        logger.error(`[Admin] setBooking error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to save booking.' });
    }
}

async function getCalendar(req, res) {
    try {
        let month = req.query.month;

        if (!month && req.query.year) {
            const m = String(req.query.month || new Date().getMonth() + 1).padStart(2, '0');
            month = `${req.query.year}-${m}`;
        }

        if (!month) month = new Date().toISOString().slice(0, 7);

        const from = `${month}-01`;
        const to   = `${month}-31`;

        const [bookings, unscheduled] = await Promise.all([
            db.query(
                `SELECT id, name, phone, postcode, service_type, status,
                        booking_date, booking_time, booking_type, booking_notes
                 FROM leads
                 WHERE booking_date BETWEEN $1 AND $2
                 ORDER BY booking_date ASC, booking_time ASC`,
                [from, to]
            ),
            db.query(
                `SELECT id, name, phone, postcode, service_type, status, created_at
                 FROM leads
                 WHERE booking_date IS NULL AND status NOT IN ('won','lost','spam')
                 ORDER BY created_at DESC
                 LIMIT 20`
            ),
        ]);

        return res.json({
            success: true,
            data:    { bookings: bookings.rows, unscheduled: unscheduled.rows, month },
        });
    } catch (err) {
        logger.error(`[Admin] getCalendar error: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Failed to load calendar.' });
    }
}

module.exports = { listLeads, getLead, updateStatus, deleteLead, exportCsv, getDashboard, setBooking, getCalendar };
