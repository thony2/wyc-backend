/**
 * ============================================================
 * West Yorkshire Carpets — Lead Controller
 * src/controllers/leadController.js
 *
 * Handles all business logic for lead creation.
 * Kept deliberately thin — validation is in middleware,
 * database access is via the db singleton.
 *
 * Functions exported:
 *   create(req, res)  — POST /api/leads
 * ============================================================
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const db             = require('../config/database');
const emailService   = require('../services/emailService');
const logger         = require('../utils/logger');

// ── Prepared statements (created once, reused across requests) ─
// better-sqlite3 performance best practice: prepare at module load time

const insertLead = db.prepare(`
    INSERT INTO leads (
        id, name, email, phone, postcode,
        service_type, message,
        room_length_m, room_width_m, flooring_type,
        include_underlay, include_fitting, estimated_cost,
        gdpr_consent_at,
        ip_address, user_agent, source,
        status, created_at, updated_at
    ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?,
        ?, ?, ?,
        'new',
        strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
        strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    )
`);

const insertAuditLog = db.prepare(`
    INSERT INTO audit_log (lead_id, action, actor, detail, ip_address)
    VALUES (?, ?, ?, ?, ?)
`);


// ── Helper: Extract IP address ───────────────────────────────

function getClientIp(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        'unknown'
    );
}


// ── Helper: Anonymise IP for GDPR-safe storage ───────────────
// Truncates the last octet of IPv4 (e.g. 192.168.1.123 → 192.168.1.0)
// and the last group of IPv6 addresses.

function anonymiseIp(ip) {
    if (!ip || ip === 'unknown') return 'unknown';
    // IPv4
    if (ip.includes('.')) {
        return ip.replace(/\.\d+$/, '.0');
    }
    // IPv6
    if (ip.includes(':')) {
        return ip.replace(/:[^:]+$/, ':0');
    }
    return 'unknown';
}


// ── Controller: create ───────────────────────────────────────

/**
 * POST /api/leads
 *
 * Receives validated + sanitised body from the middleware chain,
 * persists to database, fires admin email, returns JSON confirmation.
 *
 * On success: 201 Created
 * On failure: 500 Internal Server Error (generic message — never expose internals)
 */
async function create(req, res) {
    const requestId = req.requestId || 'unknown';
    const clientIp  = getClientIp(req);

    try {
        const {
            name, email, phone, postcode,
            service_type, message,
            room_length_m, room_width_m, flooring_type,
            include_underlay, include_fitting, estimated_cost,
            gdpr_consent,
        } = req.body;

        // Generate a UUID for this lead
        const leadId = uuidv4();

        // Record GDPR consent timestamp if explicitly provided
        const gdprConsentAt = gdpr_consent === true || gdpr_consent === 'true'
            ? new Date().toISOString()
            : null;

        // Execute insert in a transaction for atomicity
        const insertTransaction = db.transaction(() => {
            insertLead.run(
                leadId,
                name                                 || null,
                email                                || null,
                phone                                || null,
                (postcode || '').toUpperCase(),
                service_type                         || 'Not specified',
                message                              || null,
                room_length_m                        || null,
                room_width_m                         || null,
                flooring_type                        || null,
                include_underlay  ? 1 : 0,
                include_fitting   ? 1 : 0,
                estimated_cost                       || null,
                gdprConsentAt,
                anonymiseIp(clientIp),              // Store anonymised IP
                (req.headers['user-agent'] || '').substring(0, 255),
                'website',
            );

            // Write audit log entry
            insertAuditLog.run(
                leadId,
                'created',
                'api',
                JSON.stringify({
                    service_type: service_type || 'Not specified',
                    has_email:    !!email,
                    has_message:  !!message,
                    gdpr_consent: !!gdprConsentAt,
                    request_id:   requestId,
                }),
                anonymiseIp(clientIp),
            );
        });

        insertTransaction();

        logger.info(`[Lead] New submission — id: ${leadId}, service: ${service_type}, postcode: ${postcode}, req: ${requestId}`);

        // ── Fire-and-forget admin email notification ──────────
        // Don't await — a failed email should never block the API response.
        // Errors are caught internally within the email service.
        if (process.env.MAIL_ENABLED === 'true') {
            emailService.sendAdminNotification({
                leadId,
                name,
                phone,
                email:        email || 'Not provided',
                postcode,
                service_type: service_type || 'Not specified',
                message:      message      || 'No message provided',
                estimated_cost,
                created_at:   new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }),
            }).catch(err => {
                logger.error(`[Email] Failed to send admin notification for lead ${leadId}: ${err.message}`);
            });
        }

        // ── Return success response ───────────────────────────
        return res.status(201).json({
            success:   true,
            message:   'Thank you! We\'ll be in touch within 24 hours.',
            reference: leadId.split('-')[0].toUpperCase(), // Short ref for customer (e.g. "A3B2C1D4")
        });

    } catch (err) {
        logger.error(`[Lead] Insert failed — req: ${requestId}, error: ${err.message}`, { stack: err.stack });

        // Return a generic 500 — never expose database errors to the client
        return res.status(500).json({
            success: false,
            error:   'We\'re sorry, something went wrong on our end. Please call us directly on 07449 188 303.',
        });
    }
}


module.exports = { create };
