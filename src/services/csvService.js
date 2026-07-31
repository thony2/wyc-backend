'use strict';

const COLUMNS = [
    { header: 'Reference',       key: 'id',               transform: v => v ? v.split('-')[0].toUpperCase() : '' },
    { header: 'Submitted At',    key: 'created_at',       transform: formatUkDateTime },
    { header: 'Name',            key: 'name' },
    { header: 'Phone',           key: 'phone' },
    { header: 'Email',           key: 'email' },
    { header: 'Postcode',        key: 'postcode' },
    { header: 'Service Type',    key: 'service_type' },
    { header: 'Message',         key: 'message' },
    { header: 'Room Length (m)', key: 'room_length_m' },
    { header: 'Room Width (m)',  key: 'room_width_m' },
    { header: 'Flooring Type',   key: 'flooring_type' },
    { header: 'Underlay',        key: 'include_underlay', transform: v => v ? 'Yes' : 'No' },
    { header: 'Fitting',         key: 'include_fitting',  transform: v => v ? 'Yes' : 'No' },
    { header: 'Estimated Cost',  key: 'estimated_cost',   transform: v => v ? `£${parseFloat(v).toFixed(2)}` : '' },
    { header: 'GDPR Consent',    key: 'gdpr_consent_at',  transform: v => v ? `Yes (${formatUkDateTime(v)})` : 'Not recorded' },
    { header: 'Status',          key: 'status' },
    { header: 'Source',          key: 'source' },
];

function generateCsv(leads) {
    return new Promise((resolve, reject) => {
        try {
            const lines = [COLUMNS.map(col => quoteField(col.header)).join(',')];

            for (const lead of leads) {
                const row = COLUMNS.map(col => {
                    let value = lead[col.key];
                    if (col.transform) value = col.transform(value);
                    return quoteField(value);
                });
                lines.push(row.join(','));
            }

            resolve('\uFEFF' + lines.join('\r\n'));
        } catch (err) {
            reject(err);
        }
    });
}

// Excel, Google Sheets, and LibreOffice all treat a cell that *starts* with
// =, +, -, or @ as a formula rather than plain text. Free-text fields (the
// lead's "message" in particular) are never restricted to exclude these
// characters at submission time, so a value like `=HYPERLINK(...)` typed
// into the enquiry form would be executed as a formula by whoever opens the
// exported CSV. A leading single quote tells every major spreadsheet app
// "this is text" without changing what the person sees.
function sanitizeFormula(str) {
    if (/^[=+\-@]/.test(str)) {
        return `'${str}`;
    }
    return str;
}

function quoteField(value) {
    if (value === null || value === undefined) return '';
    let str = String(value).replace(/\r\n|\r|\n/g, ' ').trim();
    str = sanitizeFormula(str);
    if (str.includes(',') || str.includes('"') || str !== value) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function formatUkDateTime(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString('en-GB', {
            timeZone: 'Europe/London',
            day:      '2-digit',
            month:    '2-digit',
            year:     'numeric',
            hour:     '2-digit',
            minute:   '2-digit',
            hour12:   false,
        }).replace(',', '');
    } catch {
        return iso;
    }
}

module.exports = { generateCsv };
