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

function quoteField(value) {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/\r\n|\r|\n/g, ' ').trim();
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
