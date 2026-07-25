'use strict';

/**
 * routes/scraper.js
 *
 * POST /api/panel/scrape-family  — detect supplier, scrape, return structured data
 * POST /api/panel/import-family  — import scraped+reviewed data into the database
 *
 * Both endpoints are JWT-protected via requireAuth middleware below.
 * Mounted at /api/panel in server.js:
 *   app.use('/api/panel', scraperRouter);
 */

const express    = require('express');
const router     = express.Router();
const axios      = require('axios');
const cloudinary = require('cloudinary').v2;
const jwt        = require('jsonwebtoken');
const { detectPlugin } = require('./suppliers/index');
const db         = require('../src/config/database');

// ── JWT auth guard ─────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorised.' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired — please log in again.' });
  }
}

router.use(requireAuth);

// ── Shared fetch helper ────────────────────────────────────────────────────────
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

// ── POST /scrape-family ────────────────────────────────────────────────────────
router.post('/scrape-family', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required.' });
  }

  // Detect supplier plugin
  const plugin = detectPlugin(url);
  if (!plugin) {
    return res.status(422).json({
      error: 'This supplier is not yet supported. Supported suppliers: Carpet Line Direct, Victoria Carpets, Cormar Carpets, Woodpecker Flooring, Karndean, Quick-Step, Egger, Kronotex.',
      supported: false,
    });
  }

  // Fetch the page
  let html;
  try {
    html = await fetchPage(url);
  } catch (err) {
    return res.status(502).json({ error: `Could not fetch supplier page: ${err.message}` });
  }

  // Run the supplier parser
  let result;
  try {
    result = await plugin.parse(html, url);
  } catch (err) {
    console.error('[scraper] parse error:', err);
    return res.status(500).json({ error: `Failed to parse page: ${err.message}` });
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
});

// ── POST /import-family ────────────────────────────────────────────────────────
router.post('/import-family', async (req, res) => {
  const { family } = req.body;

  if (!family)                             return res.status(400).json({ error: 'family payload required.' });
  if (!family.wycName?.trim())             return res.status(400).json({ error: 'WYC product name is required.' });
  if (!family.price || family.price <= 0)  return res.status(400).json({ error: 'A valid price is required.' });
  if (!family.colours?.length)             return res.status(400).json({ error: 'No colour variants to import.' });

  // ── Branding safety check ────────────────────────────────────────────────────
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

  // ── Process each colour image ────────────────────────────────────────────────
  for (const colour of family.colours) {
    const wycName  = (colour.wycName || colour.supplierName || 'colour').trim();
    const publicId = `wyc-products/${family.wycName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/${wycName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    // No image provided — skip upload, store null
    if (!colour.imgUrl) {
      imageResults.skipped++;
      processedColours.push({ name: wycName, hex: colour.hex, img_url: null });
      continue;
    }

    try {
      const dlResponse = await axios.get(colour.imgUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
      });
      const mimeType = dlResponse.headers['content-type'] || 'image/jpeg';
      const dataUri  = `data:${mimeType};base64,${Buffer.from(dlResponse.data).toString('base64')}`;
      const upload   = await cloudinary.uploader.upload(dataUri, { public_id: publicId, overwrite: true });

      processedColours.push({ name: wycName, hex: colour.hex, img_url: upload.secure_url });
      imageResults.uploaded++;
    } catch (err) {
      console.error(`[import] upload failed for "${wycName}":`, err.message);
      imageResults.errors.push({ colour: wycName, error: err.message });
      imageResults.fallback++;
      // Keep with supplier URL as fallback (or null if no URL)
      processedColours.push({ name: wycName, hex: colour.hex, img_url: colour.imgUrl });
    }
  }

  // ── Build product record ─────────────────────────────────────────────────────
  const BADGE_LABELS = { new: 'New In', seller: 'Best Seller', sale: 'Sale', premium: 'Premium' };
  const badgeType = family.badgeType || null;
  const badge     = badgeType ? (BADGE_LABELS[badgeType] || null) : null;
  const specs     = family.specs || {};

  // Default img_url = first colour with a real image
  const defaultImg = processedColours.find(c => c.img_url)?.img_url || null;

  // Build product object based on category
  const product = {
    name:             family.wycName.trim(),
    category_slug:    category,
    price:            parseFloat(family.price),
    original_price:   family.originalPrice ? parseFloat(family.originalPrice) : null,
    description:      '',
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

  // Category-specific fields
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
    // Hard floors
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

  // ── Insert into database ─────────────────────────────────────────────────────
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
    console.error('[import] db error:', err.message);
    return res.status(500).json({ error: `Database error: ${err.message}` });
  }
});

module.exports = router;
