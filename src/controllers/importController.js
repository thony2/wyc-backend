'use strict';

/**
 * src/controllers/importController.js
 *
 * Supplier scraping and product import, extracted from routes/scraper.js
 * (5A step 4 — see MASTER_CHECKLIST.md). Mounted at /api/panel in
 * src/routes/import.js, same paths as before (/scrape-family, /scrape-bulk,
 * /import-family).
 *
 * One change made during this move, beyond relocation: all 5 of this file's
 * client-facing raw-error-message responses are replaced with
 * logger.error internally + a generic message externally, matching the
 * pattern already used correctly in leadController.js, adminController.js,
 * productPublicController.js, and (as of 5A step 3) adminAuthController.js/
 * productAdminController.js. Considered and rejected keeping the detailed
 * messages on the reasoning that this is an admin-only diagnostic tool where
 * the specific failure reason (timeout vs 404 vs DNS) is operationally
 * useful: the detail isn't lost, it's just moved to where it belongs —
 * server logs (`railway logs`, per README's Maintenance section) — rather
 * than round-tripped through the API response, consistent with how every
 * other file in this codebase now handles it.
 */

const axios      = require('axios');
const cloudinary = require('cloudinary').v2;
const logger     = require('../utils/logger');
const { detectPlugin } = require('../services/suppliers/index');
const { assertSafeExternalUrl } = require('../utils/urlSafety');
const db         = require('../config/database');

const MAX_BULK_URLS = 50;
const MIN_DELAY_MS  = 3000;
const MAX_DELAY_MS  = 8000;

function randomDelay() {
    const ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-GB,en;q=0.9',
        },
        timeout:      20000,
        maxRedirects: 5,
    });
    return response.data;
}

async function scrapeFamily(req, res) {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'url is required.' });
    }

    const plugin = detectPlugin(url);
    if (!plugin) {
        return res.status(422).json({
            error: 'This supplier is not yet supported. Supported suppliers: Carpet Line Direct, Victoria Carpets, Cormar Carpets, Woodpecker Flooring, Karndean, Quick-Step, Egger, Kronotex.',
            supported: false,
        });
    }

    let html;
    try {
        html = await fetchPage(url);
    } catch (err) {
        logger.error(`[Import] scrapeFamily fetch error for ${url}: ${err.message}`);
        return res.status(502).json({ error: 'Could not fetch the supplier page. It may be down, blocking automated requests, or the URL may be wrong.' });
    }

    let result;
    try {
        result = await plugin.parse(html, url);
    } catch (err) {
        logger.error(`[Import] scrapeFamily parse error for ${url}: ${err.message}`);
        return res.status(500).json({ error: 'Failed to parse the supplier page. The site may have changed its layout since this plugin was written.' });
    }

    if (!result.colours || result.colours.length === 0) {
        return res.status(422).json({
            error: 'No colour variants found on this page. Make sure the URL points to a specific product family or product page, not a category listing.',
        });
    }

    return res.json({
        ...result,
        url,
        supplierDomain: new URL(url).hostname.replace(/^www\./, ''),
    });
}

async function scrapeBulk(req, res) {
    const { urls } = req.body;

    if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'urls must be a non-empty array.' });
    }
    if (urls.length > MAX_BULK_URLS) {
        return res.status(400).json({ error: `Maximum ${MAX_BULK_URLS} URLs per batch.` });
    }

    res.writeHead(200, {
        'Content-Type':      'application/x-ndjson',
        'Cache-Control':      'no-cache',
        'X-Accel-Buffering': 'no', // ask any reverse proxy in front of this not to buffer either
    });

    for (let i = 0; i < urls.length; i++) {
        const url = typeof urls[i] === 'string' ? urls[i].trim() : '';
        let line;

        if (!url) {
            line = { url: urls[i] ?? null, success: false, error: 'Empty or invalid URL.' };
        } else {
            const plugin = detectPlugin(url);
            if (!plugin) {
                line = { url, success: false, error: 'Unsupported supplier for this URL.' };
            } else {
                try {
                    const html   = await fetchPage(url);
                    const result = await plugin.parse(html, url);
                    if (!result.colours || result.colours.length === 0) {
                        line = { url, success: false, error: 'No colour variants found on this page.' };
                    } else {
                        line = {
                            url,
                            success: true,
                            data: {
                                ...result,
                                url,
                                supplierDomain: new URL(url).hostname.replace(/^www\./, ''),
                            },
                        };
                    }
                } catch (err) {
                    logger.error(`[Import] scrapeBulk error for ${url}: ${err.message}`);
                    line = { url, success: false, error: 'Could not fetch or parse this page.' };
                }
            }
        }

        line.progress = { done: i + 1, total: urls.length };
        res.write(JSON.stringify(line) + '\n');

        if (i < urls.length - 1) {
            await randomDelay();
        }
    }

    res.end();
}

async function importFamily(req, res) {
    const { family } = req.body;

    if (!family)                             return res.status(400).json({ error: 'family payload required.' });
    if (!family.wycName?.trim())             return res.status(400).json({ error: 'WYC product name is required.' });
    if (!family.price || family.price <= 0)  return res.status(400).json({ error: 'A valid price is required.' });
    if (!family.colours?.length)             return res.status(400).json({ error: 'No colour variants to import.' });

    // ── Branding safety check ────────────────────────────────────────────────
    // Refuse to import any colour whose name still exactly matches the supplier's
    // original name. The admin UI pre-fills each colour's name with the supplier's
    // name as a placeholder (not a real value) precisely so this can be caught here
    // if it's never actually changed — this is the one place that's guaranteed to
    // run no matter how the import was triggered, so it's where this gets enforced.
    const unbranded = family.colours.filter(c =>
        c.wycName && c.supplierName &&
        c.wycName.trim().toLowerCase() === c.supplierName.trim().toLowerCase()
    );
    if (unbranded.length > 0) {
        return res.status(422).json({
            error: `${unbranded.length} colour name${unbranded.length !== 1 ? 's' : ''} still ` +
                   `match${unbranded.length === 1 ? 'es' : ''} the supplier's original name. ` +
                   `Please rename before importing.`,
            unbrandedColours: unbranded.map(c => c.supplierName),
        });
    }

    const category = family.category || 'carpets';
    const imageResults = { uploaded: 0, fallback: 0, skipped: 0, errors: [] };
    const processedColours = [];

    // ── Process each colour image ──────────────────────────────────────────
    for (const colour of family.colours) {
        const wycName  = (colour.wycName || colour.supplierName || 'colour').trim();
        const publicId = `wyc-products/${family.wycName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/${wycName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

        if (!colour.imgUrl) {
            imageResults.skipped++;
            processedColours.push({ name: wycName, hex: colour.hex, img_url: null });
            continue;
        }

        try {
            // SSRF guard: refuse to fetch anything that resolves to a private/
            // internal address before making the actual request. See
            // src/utils/urlSafety.js for what this does and does not cover.
            await assertSafeExternalUrl(colour.imgUrl);

            const dlResponse = await axios.get(colour.imgUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                maxRedirects: 3,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
            });
            const mimeType = dlResponse.headers['content-type'] || 'image/jpeg';
            if (!mimeType.startsWith('image/')) {
                throw new Error(`URL did not return an image (got "${mimeType}").`);
            }
            const dataUri  = `data:${mimeType};base64,${Buffer.from(dlResponse.data).toString('base64')}`;
            const upload   = await cloudinary.uploader.upload(dataUri, { public_id: publicId, overwrite: true });

            processedColours.push({ name: wycName, hex: colour.hex, img_url: upload.secure_url });
            imageResults.uploaded++;
        } catch (err) {
            logger.error(`[Import] image upload failed for "${wycName}": ${err.message}`);
            imageResults.errors.push({ colour: wycName, error: 'Upload failed — see server logs for detail.' });
            imageResults.fallback++;
            // Keep with supplier URL as fallback (or null if no URL)
            processedColours.push({ name: wycName, hex: colour.hex, img_url: colour.imgUrl });
        }
    }

    // ── Build product record ───────────────────────────────────────────────
    const BADGE_LABELS = { new: 'New In', seller: 'Best Seller', sale: 'Sale', premium: 'Premium' };
    const badgeType = family.badgeType || null;
    const badge     = badgeType ? (BADGE_LABELS[badgeType] || null) : null;
    const specs     = family.specs || {};

    const defaultImg = processedColours.find(c => c.img_url)?.img_url || null;

    const product = {
        name:             family.wycName.trim(),
        category_slug:    category,
        price:            parseFloat(family.price),
        original_price:   family.originalPrice ? parseFloat(family.originalPrice) : null,
        description:      (specs.description || '').trim(),
        img_url:          defaultImg,
        badge,
        badge_type:       badgeType,
        rooms:            JSON.stringify(specs.rooms    || []),
        durability:       specs.durability  || 3,
        is_featured:      0,
        is_deal:          0,
        is_active:        1,
        fitting_price:    parseFloat(family.fittingPrice) || 6.00,
        colours:          JSON.stringify(processedColours),
        features:         JSON.stringify(specs.features || []),
        colour_family:    specs.dominantColourFamily || 'neutrals',
        stock_level:      0,
        likes:            0,
    };

    if (category === 'carpets') {
        Object.assign(product, {
            fibre:          specs.fibre          || 'Mixed Fibres',
            carpet_style:   specs.carpetStyle    || 'Twist',
            softness:       specs.softness       || 3,
            softness_label: 'Soft',
            thickness:      'Medium',
            density:        'Medium',
        });
    } else {
        Object.assign(product, {
            thickness_mm:        specs.thickness_mm        || null,
            wear_layer_mm:       specs.wear_layer_mm        || null,
            plank_width_mm:      specs.plank_width_mm       || null,
            installation_method: specs.installation_method  || null,
            ufh_compatible:      specs.ufh_compatible ?? 0,
            lay_pattern:         specs.lay_pattern          || null,
        });
        if (category === 'laminate') {
            Object.assign(product, {
                ac_rating:    specs.ac_rating   || null,
                board_design: specs.board_design || 'Wood Effect',
            });
        }
        if (category === 'wood') {
            Object.assign(product, {
                species_finish: specs.species_finish || null,
                surface_finish: specs.surface_finish || null,
            });
        }
    }

    // ── Insert into database ───────────────────────────────────────────────
    const cols        = Object.keys(product);
    const values      = Object.values(product);
    const colList     = cols.map(c => `"${c}"`).join(', ');
    const placeholder = cols.map((_, i) => `$${i + 1}`).join(', ');

    try {
        const result = await db.query(
            `INSERT INTO products (${colList}) VALUES (${placeholder}) RETURNING id, name`,
            values
        );
        return res.status(201).json({
            success:      true,
            product:      result.rows[0],
            imageResults,
        });
    } catch (err) {
        logger.error(`[Import] db insert error: ${err.message}`);
        return res.status(500).json({ error: 'Failed to save the product to the database.' });
    }
}

module.exports = { scrapeFamily, scrapeBulk, importFamily };
