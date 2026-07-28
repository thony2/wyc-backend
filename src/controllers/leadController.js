'use strict';

const { v4: uuidv4 } = require('uuid');
const db             = require('../config/database');
const emailService   = require('../services/emailService');
const logger         = require('../utils/logger');

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || 'unknown';
}

function anonymiseIp(ip) {
    if (!ip || ip === 'unknown') return 'unknown';
    if (ip.includes('.')) return ip.replace(/\.\d+$/, '.0');
    if (ip.includes(':')) return ip.replace(/:[^:]+$/, ':0');
    return 'unknown';
}

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

        const leadId        = uuidv4();
        const now           = new Date().toISOString();
        const gdprConsentAt = (gdpr_consent === true || gdpr_consent === 'true') ? now : null;
        const anonIp        = anonymiseIp(clientIp);
        const userAgent     = (req.headers['user-agent'] || '').substring(0, 255);

        await db.query(`
            INSERT INTO leads (
                id, name, email, phone, postcode,
                service_type, message,
                room_length_m, room_width_m, flooring_type,
                include_underlay, include_fitting, estimated_cost,
                gdpr_consent_at, ip_address, user_agent, source,
                status, created_at, updated_at
            ) VALUES (
                $1,$2,$3,$4,$5,
                $6,$7,
                $8,$9,$10,
                $11,$12,$13,
                $14,$15,$16,$17,
                'new',$18,$19
            )
        `, [
            leadId, name||null, email||null, phone||null, (postcode||'').toUpperCase(),
            service_type||'Not specified', message||null,
            room_length_m||null, room_width_m||null, flooring_type||null,
            include_underlay?1:0, include_fitting?1:0, estimated_cost||null,
            gdprConsentAt, anonIp, userAgent, 'website',
            now, now,
        ]);

        await db.query(`
            INSERT INTO audit_log (lead_id, action, actor, detail, ip_address)
            VALUES ($1,$2,$3,$4,$5)
        `, [
            leadId, 'created', 'api',
            JSON.stringify({
                service_type: service_type || 'Not specified',
                has_email:    !!email,
                has_message:  !!message,
                gdpr_consent: !!gdprConsentAt,
                request_id:   requestId,
            }),
            anonIp,
        ]);

        logger.info(`[Lead] New submission — id: ${leadId}, service: ${service_type}, postcode: ${postcode}`);

        const reference = leadId.split('-')[0].toUpperCase();

        if (process.env.MAIL_ENABLED === 'true') {
            emailService.sendAdminNotification({
                leadId, name, phone,
                email:         email         || 'Not provided',
                postcode,
                service_type:  service_type  || 'Not specified',
                message:       message       || 'No message provided',
                estimated_cost,
                created_at:    new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }),
            }).catch(err => logger.error(`[Email] Failed for lead ${leadId}: ${err.message}`));

            // sendCustomerConfirmation already guards on its own (no-op if no email
            // was provided, or if MAIL_ENABLED isn't 'true') -- calling it here
            // unconditionally is intentional, not a missing check.
            emailService.sendCustomerConfirmation({
                name, email, reference,
            }).catch(err => logger.error(`[Email] Customer confirmation failed for lead ${leadId}: ${err.message}`));
        }

        return res.status(201).json({
            success:   true,
            message:   "Thank you! We'll be in touch within 24 hours.",
            reference,
        });

    } catch (err) {
        logger.error(`[Lead] Insert failed — req: ${requestId}, error: ${err.message}`);
        return res.status(500).json({
            success: false,
            error:   "We're sorry, something went wrong. Please call us on 07449 188 303.",
        });
    }
}

module.exports = { create };
