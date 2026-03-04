/**
 * ============================================================
 * West Yorkshire Carpets — CSV Export Service
 * src/services/csvService.js
 *
 * Generates RFC 4180-compliant CSV output from lead records.
 * Does NOT use external dependencies — pure Node.js.
 *
 * Handles edge cases:
 *   - Values containing commas → wrapped in double quotes
 *   - Values containing double quotes → escaped as ""
 *   - Values containing newlines → replaced with space
 *   - NULL / undefined → empty string
 *   - Numbers → output as-is (no quoting)
 * ============================================================
 */

'use strict';

// ── Column definitions ───────────────────────────────────────
// Define once so order is explicit and easy to adjust in future.

const COLUMNS = [
    { header: 'Reference',         key: 'id',               transform: v => v ? v.split('-')[0].toUpperCase() : '' },
    { header: 'Submitted At',      key: 'created_at',       transform: formatUkDateTime },
    { header: 'Name',              key: 'name' },
    { header: 'Phone',             key: 'phone' },
    { header: 'Email',             key: 'email' },
    { header: 'Postcode',          key: 'postcode' },
    { header: 'Service Type',      key: 'service_type' },
    { header: 'Message',           key: 'message' },
    { header: 'Room Length (m)',   key: 'room_length_m' },
    { header: 'Room Width (m)',    key: 'room_width_m' },
    { header: 'Flooring Type',     key: 'flooring_type' },
    { header: 'Underlay',          key: 'include_underlay',  transform: v => v ? 'Yes' : 'No' },
    { header: 'Fitting',           key: 'include_fitting',   transform: v => v ? 'Yes' : 'No' },
    { header: 'Estimated Cost',    key: 'estimated_cost',   transform: v => v ? `£${parseFloat(v).toFixed(2)}` : '' },
    { header: 'GDPR Consent',      key: 'gdpr_consent_at',  transform: v => v ? `Yes (${formatUkDateTime(v)})` : 'Not recorded' },
    { header: 'Status',            key: 'status' },
    { header: 'Source',            key: 'source' },
];


/**
 * Generates a UTF-8 CSV string from an array of lead objects.
 *
 * @param {Array<Object>} leads - Array of lead row objects
 * @returns {string} - CSV content with BOM for Excel compatibility
 */
function generateCsv(leads) {
    return new Promise((resolve, reject) => {
        try {
            const lines = [];

            // ── Header row ──
            const headerRow = COLUMNS.map(col => quoteField(col.header)).join(',');
            lines.push(headerRow);

            // ── Data rows ──
            for (const lead of leads) {
                const row = COLUMNS.map(col => {
                    let value = lead[col.key];

                    // Apply transform function if defined
                    if (col.transform) {
                        value = col.transform(value);
                    }

                    return quoteField(value);
                });
                lines.push(row.join(','));
            }

            // Add UTF-8 BOM at the start so Excel opens it correctly on Windows
            const bom = '\uFEFF';
            resolve(bom + lines.join('\r\n'));

        } catch (err) {
            reject(err);
        }
    });
}


/**
 * Wraps a field value in double quotes if it contains special characters,
 * and escapes any existing double quotes within the value.
 *
 * @param {*} value - Raw field value
 * @returns {string} - Safe CSV field string
 */
function quoteField(value) {
    if (value === null || value === undefined) return '';

    // Convert to string
    const str = String(value)
        .replace(/\r\n|\r|\n/g, ' ')  // Flatten newlines
        .trim();

    // Quote if value contains comma, double quote, or leading/trailing spaces
    if (str.includes(',') || str.includes('"') || str.includes('\r') || str.includes('\n') || str !== value) {
        // Escape existing double quotes by doubling them (RFC 4180)
        return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
}


/**
 * Converts an ISO 8601 UTC timestamp to UK date/time format.
 * e.g. "2025-03-15T14:32:00Z" → "15/03/2025 14:32"
 *
 * @param {string} iso - ISO 8601 string
 * @returns {string} - Formatted UK date string
 */
function formatUkDateTime(iso) {
    if (!iso) return '';
    try {
        const date = new Date(iso);
        return date.toLocaleString('en-GB', {
            timeZone:   'Europe/London',
            day:        '2-digit',
            month:      '2-digit',
            year:       'numeric',
            hour:       '2-digit',
            minute:     '2-digit',
            hour12:     false,
        }).replace(',', '');
    } catch {
        return iso;
    }
}


module.exports = { generateCsv };
