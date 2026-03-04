/**
 * ============================================================
 * West Yorkshire Carpets — Email Service
 * src/services/emailService.js
 *
 * Sends transactional emails via SMTP using Nodemailer.
 * Compatible with Gmail, Mailgun, Brevo, AWS SES, and any
 * standard SMTP server.
 *
 * Configuration: set MAIL_ENABLED=true and SMTP_* variables in .env
 * ============================================================
 */

'use strict';

const nodemailer = require('nodemailer');
const logger     = require('../utils/logger');

// ── Create Transporter (lazy — only when mail is enabled) ────

let _transporter = null;

function getTransporter() {
    if (_transporter) return _transporter;

    _transporter = nodemailer.createTransport({
        host:   process.env.SMTP_HOST || 'smtp.gmail.com',
        port:   parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',  // true = TLS on port 465
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        // Reasonable timeouts to prevent hanging
        connectionTimeout: 10_000,
        greetingTimeout:   10_000,
        socketTimeout:     15_000,
    });

    // Verify connection on first use (logs warning if misconfigured)
    _transporter.verify().catch(err => {
        logger.warn(`[Email] SMTP connection verification failed: ${err.message}`);
        logger.warn('[Email] Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
    });

    return _transporter;
}


// ── Admin Notification Email ─────────────────────────────────

/**
 * Sends a formatted HTML email to the admin when a new lead is submitted.
 *
 * @param {Object} lead - Lead data (from leadController.create)
 * @returns {Promise<void>}
 */
async function sendAdminNotification(lead) {
    if (process.env.MAIL_ENABLED !== 'true') return;

    const transporter = getTransporter();

    const costLine = lead.estimated_cost
        ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Estimated Cost</td><td style="padding:6px 0;font-weight:600;color:#DE3848;">£${parseFloat(lead.estimated_cost).toFixed(2)}</td></tr>`
        : '';

    const messageLine = lead.message && lead.message !== 'No message provided'
        ? `<div style="margin-top:20px;padding:16px;background:#F0EEE4;border-left:3px solid #DE3848;border-radius:4px;">
               <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#A2A8B0;">Customer Message</p>
               <p style="margin:0;font-size:14px;color:#2E2F36;line-height:1.6;">${escapeHtml(lead.message)}</p>
           </div>`
        : '';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead — West Yorkshire Carpets</title>
</head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#F0EEE4;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EEE4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:#2E2F36;padding:28px 32px;">
              <h1 style="margin:0;font-size:22px;font-weight:600;color:#fff;letter-spacing:-.01em;">
                West Yorkshire Carpets
              </h1>
              <p style="margin:4px 0 0;font-size:12px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#A2A8B0;">
                New Lead Notification
              </p>
            </td>
          </tr>

          <!-- Alert banner -->
          <tr>
            <td style="background:#DE3848;padding:14px 32px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#fff;">
                &#x1F514;&nbsp; New enquiry received · ${escapeHtml(lead.created_at)}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px;">

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:14px;width:140px;">Name</td>
                  <td style="padding:6px 0;font-weight:600;color:#2E2F36;font-size:15px;">${escapeHtml(lead.name)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:14px;">Phone</td>
                  <td style="padding:6px 0;font-size:15px;">
                    <a href="tel:${escapeHtml(lead.phone)}" style="color:#DE3848;font-weight:600;text-decoration:none;">${escapeHtml(lead.phone)}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:14px;">Email</td>
                  <td style="padding:6px 0;font-size:15px;">
                    ${lead.email && lead.email !== 'Not provided'
                        ? `<a href="mailto:${escapeHtml(lead.email)}" style="color:#DE3848;font-weight:500;text-decoration:none;">${escapeHtml(lead.email)}</a>`
                        : '<span style="color:#A2A8B0;">Not provided</span>'
                    }
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:14px;">Postcode</td>
                  <td style="padding:6px 0;font-weight:600;color:#2E2F36;font-size:15px;">${escapeHtml(lead.postcode)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:14px;">Service</td>
                  <td style="padding:6px 0;font-weight:600;color:#2E2F36;font-size:15px;">${escapeHtml(lead.service_type)}</td>
                </tr>
                ${costLine}
              </table>

              ${messageLine}

              <!-- Reference -->
              <div style="margin-top:24px;padding:12px 16px;background:#F0EEE4;border-radius:6px;display:inline-block;">
                <span style="font-size:12px;color:#A2A8B0;font-weight:600;letter-spacing:.08em;text-transform:uppercase;">Reference</span>
                <span style="font-size:14px;font-weight:700;color:#2E2F36;margin-left:10px;font-family:monospace;">${lead.leadId.split('-')[0].toUpperCase()}</span>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8F7F2;border-top:1px solid #E8E5D8;padding:20px 32px;">
              <p style="margin:0;font-size:12px;color:#A2A8B0;line-height:1.5;">
                This email was generated automatically by the West Yorkshire Carpets lead management system.<br>
                Do not reply to this email. View and manage all leads via the admin API.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Plain text fallback for email clients that don't render HTML
    const text = `
NEW LEAD — West Yorkshire Carpets
==================================
Received: ${lead.created_at}
Reference: ${lead.leadId.split('-')[0].toUpperCase()}

Name:     ${lead.name}
Phone:    ${lead.phone}
Email:    ${lead.email}
Postcode: ${lead.postcode}
Service:  ${lead.service_type}
${lead.estimated_cost ? `Estimate: £${parseFloat(lead.estimated_cost).toFixed(2)}` : ''}

Message:
${lead.message}
==================================
Manage leads: ${process.env.ALLOWED_ORIGIN || 'http://localhost:3001'}/api/admin/leads
`;

    try {
        await transporter.sendMail({
            from:    process.env.MAIL_FROM    || '"West Yorkshire Carpets" <noreply@westyorkshirecarpets.co.uk>',
            to:      process.env.MAIL_TO      || 'admin@westyorkshirecarpets.co.uk',
            subject: `New Flooring Enquiry — ${lead.name} (${lead.postcode})`,
            text,
            html,
        });

        logger.info(`[Email] Admin notification sent for lead ${lead.leadId}`);

    } catch (err) {
        // Log but don't rethrow — a failed email must never block the API response
        logger.error(`[Email] Send failed for lead ${lead.leadId}: ${err.message}`);
        throw err; // Rethrow so caller's .catch() can log it at the right level
    }
}


// ── Customer Confirmation Email ──────────────────────────────
// Optional: send a confirmation to the customer on submission.

async function sendCustomerConfirmation({ name, email, reference }) {
    if (!email || process.env.MAIL_ENABLED !== 'true') return;

    const transporter = getTransporter();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#F0EEE4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EEE4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
          <tr><td style="background:#2E2F36;padding:28px 32px;">
            <h1 style="margin:0;font-size:20px;color:#fff;">West Yorkshire Carpets</h1>
          </td></tr>
          <tr><td style="padding:32px;">
            <h2 style="margin:0 0 16px;font-size:24px;color:#2E2F36;">Thank you, ${escapeHtml(name)}!</h2>
            <p style="color:#6b7280;line-height:1.7;">We've received your flooring enquiry and one of our team will be in touch within 24 hours to arrange your free, no-obligation measure.</p>
            <p style="color:#6b7280;line-height:1.7;">In the meantime, if you have any questions don't hesitate to call us directly:</p>
            <a href="tel:07449188303" style="display:inline-block;margin:16px 0;padding:13px 28px;background:#DE3848;color:#fff;font-weight:600;border-radius:4px;text-decoration:none;font-size:16px;">&#x1F4DE; 07449 188 303</a>
            <p style="margin-top:24px;padding-top:20px;border-top:1px solid #E8E5D8;font-size:12px;color:#A2A8B0;">Your reference: <strong style="color:#2E2F36;font-family:monospace;">${reference}</strong></p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from:    process.env.MAIL_FROM || '"West Yorkshire Carpets" <noreply@westyorkshirecarpets.co.uk>',
        to:      email,
        subject: `We've received your enquiry — West Yorkshire Carpets (Ref: ${reference})`,
        text:    `Thank you, ${name}!\n\nWe've received your enquiry (Ref: ${reference}) and will be in touch within 24 hours.\n\nCall us: 07449 188 303\n\nWest Yorkshire Carpets`,
        html,
    });
}


// ── HTML escape helper ───────────────────────────────────────
// Prevents XSS in email HTML templates if data were somehow malformed.

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


module.exports = {
    sendAdminNotification,
    sendCustomerConfirmation,
};
