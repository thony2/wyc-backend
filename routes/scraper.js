'use strict';

/**
 * routes/scraper.js
 *
 * Two endpoints, both require JWT (mounted under /api/panel/ in server.js):
 *
 *   POST /api/panel/scrape-family   — fetches a CLD family page, parses it,
 *                                     returns structured JSON for the admin UI
 *                                     to review.  Nothing is written to the DB.
 *
 *   POST /api/panel/import-family   — receives the reviewed/edited family data,
 *                                     downloads each colour image, uploads to
 *                                     Cloudinary, then inserts one product row.
 */

const express    = require('express');
const router     = express.Router();
const axios      = require('axios');
const cheerio    = require('cheerio');
const cloudinary = require('cloudinary').v2;
const { Pool }   = require('pg');
const jwt        = require('jsonwebtoken');

// Use the same DATABASE_URL that the rest of the app uses.
// pg's built-in connection pooling means this is safe alongside other pools.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ─── JWT auth guard ───────────────────────────────────────────────────────────
// Applied to every route in this file. Checks the same wyc_token the admin
// panel stores in localStorage and sends as Authorization: Bearer <token>.
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorised — please log in to the admin panel.' });
  }
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired — please log in again.' });
  }
}

router.use(requireAuth);

// ─── Mapping helpers ──────────────────────────────────────────────────────────

/**
 * Durability 1-5 from suitability string.
 * Heavy Domestic → 5 | General Domestic → 3 | Light Domestic → 2
 */
function mapDurability(suitability) {
  if (!suitability) return 3;
  const s = suitability.toLowerCase();
  if (s.includes('heavy'))   return 5;
  if (s.includes('general')) return 3;
  if (s.includes('light'))   return 2;
  return 3;
}

/**
 * Softness 1-5 from suitability string.
 * Heavy Domestic → 4 | General Domestic → 3 | Light Domestic → 2
 */
function mapSoftness(suitability) {
  if (!suitability) return 3;
  const s = suitability.toLowerCase();
  if (s.includes('heavy'))   return 4;
  if (s.includes('general')) return 3;
  if (s.includes('light'))   return 2;
  return 3;
}

/**
 * Carpet style inferred from family name.
 * Saxony > Berber > Loop Pile > Velvet > Twist (default)
 */
function mapCarpetStyle(familyName) {
  if (!familyName) return 'Twist';
  const n = familyName.toLowerCase();
  if (n.includes('saxony')) return 'Saxony';
  if (n.includes('berber')) return 'Berber';
  if (n.includes('loop'))   return 'Loop Pile';
  if (n.includes('velvet')) return 'Velvet';
  return 'Twist';
}

/**
 * Feature keys from raw page text.
 * Returns only keys used by the WYC front-end.
 */
function mapFeatures(text) {
  if (!text) return [];
  const t = text.toLowerCase();
  const out = new Set();
  if (t.includes('bleach cleanable') || t.includes('bleach clean'))  out.add('bleach');
  if (t.includes('stain resist'))                                      out.add('stain');
  if (t.includes('easy to clean') || t.includes('ease of maintenance') || t.includes('easy clean')) out.add('easyClean');
  if (t.includes('underfloor heating') || t.includes('underfloor'))  out.add('insulation');
  if (t.includes('pet friendly') || t.includes('pet-friendly'))       out.add('pet');
  if (t.includes('luxurious') || (t.includes('soft') && !t.includes('software'))) out.add('soft');
  if (t.includes('waterproof'))                                        out.add('waterproof');
  if (t.includes('scratch resist'))                                    out.add('scratch');
  return [...out];
}

/**
 * Room keys from raw page text.
 * Falls back to the default carpet set if nothing specific is found.
 */
function mapRooms(text) {
  const DEFAULT = ['living', 'bedroom', 'hallway', 'stairs'];
  if (!text) return DEFAULT;
  const t = text.toLowerCase();
  const out = new Set();
  if (t.includes('living') || t.includes('dining') || t.includes('lounge')) out.add('living');
  if (t.includes('bedroom'))                                                   out.add('bedroom');
  if (t.includes('kitchen'))                                                   out.add('kitchen');
  if (t.includes('bathroom'))                                                  out.add('bathroom');
  if (t.includes('hall'))                                                      out.add('hallway');
  if (t.includes('stair') || t.includes('landing'))                           out.add('stairs');
  return out.size > 0 ? [...out] : DEFAULT;
}

/**
 * Representative hex swatch from colour name keywords.
 * Used for the catalogue card dots — close enough is good enough.
 */
function hexFromName(name) {
  const n = name.toLowerCase();
  if (/grey|gray|ash|slate|charcoal|silver|smoke|steel|storm|graphite|pewter|flint|mist|fog|pebble|dove/.test(n)) return '#9E9E9E';
  if (/beige|sand|stone|linen|taupe|biscuit|natural|parchment|mushroom|buff|oat|barley|wheat|straw|hessian/.test(n)) return '#C8B89A';
  if (/brown|mocha|chocolate|walnut|chestnut|coffee|toffee|caramel|hazel|umber|cinnamon|nutmeg|sienna/.test(n)) return '#795548';
  if (/cream|ivory|pearl|white|vanilla|almond|magnolia|chalk|snow|frost|polar|crystal|sugar|milk|porcelain|latte/.test(n)) return '#F5F0E8';
  if (/black|noir|onyx|ebony|jet|midnight|raven|shadow|ink/.test(n)) return '#212121';
  if (/blue|navy|teal|cobalt|sapphire|azure|denim|indigo|ocean|lake|marine/.test(n)) return '#1565C0';
  if (/green|sage|olive|moss|fern|forest|jade|mint|emerald|pistachio/.test(n)) return '#558B2F';
  if (/gold|amber|honey|mustard|ochre|bronze|autumn|saffron/.test(n)) return '#F9A825';
  if (/red|rose|blush|coral|rust|terracotta|burgundy|wine|berry|plum|pink|mauve|peach|dusky/.test(n)) return '#C62828';
  return '#A0A0A0'; // neutral fallback
}

/**
 * Colour family slug from colour name keywords.
 * Drives the catalogue filter drawer.
 */
function colourFamilyFromName(name) {
  const n = name.toLowerCase();
  if (/grey|gray|ash|slate|charcoal|silver|smoke|steel|storm|graphite|pewter|flint|mist|fog|pebble|dove/.test(n)) return 'greys';
  if (/beige|sand|stone|linen|taupe|biscuit|natural|parchment|mushroom|buff|oat|barley|wheat|straw|hessian/.test(n)) return 'beiges';
  if (/brown|mocha|chocolate|walnut|chestnut|coffee|toffee|caramel|hazel|umber|cinnamon|nutmeg|sienna/.test(n)) return 'browns';
  if (/cream|ivory|pearl|white|vanilla|almond|magnolia|chalk|snow|frost|polar|crystal|sugar|milk|porcelain|latte/.test(n)) return 'creams';
  if (/black|noir|onyx|ebony|jet|midnight|raven|shadow|ink/.test(n)) return 'blacks';
  if (/blue|navy|teal|cobalt|sapphire|azure|denim|indigo|ocean|lake|marine/.test(n)) return 'blues';
  if (/green|sage|olive|moss|fern|forest|jade|mint|emerald|pistachio/.test(n)) return 'greens';
  if (/gold|amber|honey|mustard|ochre|bronze|autumn|saffron/.test(n)) return 'golds';
  if (/red|rose|blush|coral|rust|terracotta|burgundy|wine|berry|plum|pink|mauve|peach|dusky/.test(n)) return 'reds';
  return 'neutrals';
}

/**
 * Normalise a raw fibre string from the supplier to one of the five
 * canonical values the WYC front-end expects.
 */
function normaliseFibre(raw) {
  if (!raw) return 'Mixed Fibres';
  const r = raw.toLowerCase();
  if (r.includes('polypropylene'))                       return '100% Polypropylene';
  if (r.includes('recycled') && r.includes('polyester')) return '100% Recycled Polyester';
  if (r.includes('polyester'))                           return '100% Polyester';
  if (r.includes('wool'))                                return '100% Wool';
  if (raw.trim().length > 0)                             return raw.trim();
  return 'Mixed Fibres';
}

/**
 * Dominant colour family across all colour variants in a family.
 * Used as the product-level colour_family for filtering.
 */
function dominantColourFamily(colours) {
  const counts = {};
  colours.forEach(c => {
    const f = colourFamilyFromName(c.supplierName);
    counts[f] = (counts[f] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutrals';
}

// ─── POST /scrape-family ──────────────────────────────────────────────────────

router.post('/scrape-family', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  let html;
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 20000,
      maxRedirects: 5,
    });
    html = response.data;
  } catch (err) {
    console.error('[scraper] fetch error:', err.message);
    return res.status(502).json({ error: `Could not fetch supplier page: ${err.message}` });
  }

  const $ = cheerio.load(html);

  // ── Family name ────────────────────────────────────────────────────────────
  // CLD uses h1 for the family heading; h2 as fallback
  let familyName =
    $('h1').first().text().trim() ||
    $('h2').first().text().trim() ||
    url.split('/').filter(Boolean).pop().replace(/-/g, ' ');

  // ── Key-value specs from <strong> tags ────────────────────────────────────
  const specs = {};
  $('strong, b').each((_, el) => {
    const keyRaw  = $(el).text().replace(/:$/, '').trim();
    const parent  = $(el).parent();
    const fullTxt = parent.text();
    const valRaw  = fullTxt.replace($(el).text(), '').replace(/^:?\s*/, '').trim();
    if (keyRaw && valRaw) {
      specs[keyRaw.toLowerCase()] = valRaw;
    }
  });

  // ── Accumulate raw text for feature + room mapping ────────────────────────
  let featText = Object.values(specs).join(' ');
  let roomText = Object.values(specs).join(' ');

  $('p, li, td').each((_, el) => {
    const txt = $(el).text();
    if (/bleach|stain|clean|underfloor|pet|soft|luxurious|waterproof|scratch/i.test(txt)) {
      featText += ' ' + txt;
    }
    if (/living|bedroom|dining|kitchen|bathroom|hall|stair|landing|lounge/i.test(txt)) {
      roomText += ' ' + txt;
    }
  });

  const suitability = specs['suitability'] || specs['suitable for'] || '';
  const pileWeight  = specs['pile weight'] || specs['pile content weight'] || '';
  const fibreRaw    = specs['pile content'] || specs['pile composition'] || specs['fibre'] || specs['content'] || '';

  // ── Extract colours ────────────────────────────────────────────────────────
  // CLD renders colours as a Gutenberg gallery — each colour is a <figure>
  // containing an <a href="full-size.jpg"><img src="thumb-300x300.jpg"></a>
  // followed by a <figcaption>Colour Name</figcaption>.
  const colours = [];
  const seenUrls = new Set();

  // Primary strategy: figure elements with figcaption
  $('figure').each((_, el) => {
    const anchor  = $(el).find('a').first();
    const img     = $(el).find('img').first();
    const caption = $(el).find('figcaption').text().trim();

    // Full-size image is the anchor href; fall back to img src (minus -300x300)
    let imgUrl = anchor.attr('href') || img.attr('src') || '';

    // Strip the WordPress thumbnail suffix to get the full-res image
    imgUrl = imgUrl.replace(/-\d+x\d+(\.\w+)$/, '$1');

    // Absolute URL guard
    if (imgUrl && !imgUrl.startsWith('http')) {
      imgUrl = 'https://www.carpetlinedirect.co.uk' + imgUrl;
    }

    if (!imgUrl || !caption) return;
    if (!/\.(jpe?g|png|webp)/i.test(imgUrl)) return;
    if (/icons|logo|banner|CLD-Web|CLD-Master/i.test(imgUrl)) return;
    if (seenUrls.has(imgUrl)) return;

    seenUrls.add(imgUrl);
    colours.push({ supplierName: caption, imgUrl });
  });

  // Fallback strategy: bare <a href="image.jpg"> not inside <figure>
  if (colours.length === 0) {
    $('a').each((_, el) => {
      const href    = $(el).attr('href') || '';
      const altText = $(el).find('img').attr('alt') || '';
      const capText = $(el).next('figcaption, p, span').text().trim();
      const name    = altText || capText;

      if (!/\.(jpe?g|png|webp)/i.test(href)) return;
      if (/icons|logo|banner|CLD-Web|CLD-Master/i.test(href)) return;
      if (!name || name.length > 60) return;
      if (seenUrls.has(href)) return;

      seenUrls.add(href);
      colours.push({ supplierName: name, imgUrl: href });
    });
  }

  if (colours.length === 0) {
    return res.status(422).json({
      error:
        'No colour variants found on this page. ' +
        'The page may require JavaScript to render, or the URL may not be a product family page.',
    });
  }

  // ── Enrich each colour ─────────────────────────────────────────────────────
  const enrichedColours = colours.map(c => ({
    supplierName: c.supplierName,
    wycName:      c.supplierName,           // editable in the review UI
    imgUrl:       c.imgUrl,
    hex:          hexFromName(c.supplierName),
    colourFamily: colourFamilyFromName(c.supplierName),
  }));

  const fibre       = normaliseFibre(fibreRaw);
  const suitStr     = suitability || 'General Domestic';
  const description = `${familyName} — ${suitStr}. ${pileWeight} pile weight.`
    .replace(/\s{2,}/g, ' ')
    .trim();

  return res.json({
    supplierName: familyName,
    wycName:      familyName,
    url,
    specs: {
      fibre,
      pileWeight,
      suitability:          suitStr,
      carpetStyle:          mapCarpetStyle(familyName),
      durability:           mapDurability(suitStr),
      softness:             mapSoftness(suitStr),
      description,
      features:             mapFeatures(featText),
      rooms:                mapRooms(roomText),
      dominantColourFamily: dominantColourFamily(colours),
    },
    colours: enrichedColours,
  });
});

// ─── POST /import-family ──────────────────────────────────────────────────────

router.post('/import-family', async (req, res) => {
  const { family } = req.body;

  if (!family)                              return res.status(400).json({ error: 'family payload required' });
  if (!family.wycName?.trim())              return res.status(400).json({ error: 'wycName is required' });
  if (!family.price || family.price <= 0)  return res.status(400).json({ error: 'A valid price is required' });
  if (!family.colours?.length)             return res.status(400).json({ error: 'No colour variants to import' });

  const imageResults = { uploaded: 0, fallback: 0, errors: [] };
  const processedColours = [];

  // ── Download + upload each colour image ────────────────────────────────────
  for (const colour of family.colours) {
    const wycName    = (colour.wycName || colour.supplierName || 'colour').trim();
    const publicId   =
      `wyc-products/` +
      `${family.wycName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/` +
      `${wycName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    try {
      // Stream the supplier image into a Buffer
      const dlResponse = await axios.get(colour.imgUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        },
      });

      const mimeType = dlResponse.headers['content-type'] || 'image/jpeg';
      const b64      = Buffer.from(dlResponse.data).toString('base64');
      const dataUri  = `data:${mimeType};base64,${b64}`;

      const upload = await cloudinary.uploader.upload(dataUri, {
        public_id:  publicId,
        overwrite:  true,
        folder:     '',
      });

      processedColours.push({
        name:    wycName,
        hex:     colour.hex,
        img_url: upload.secure_url,
      });
      imageResults.uploaded++;

    } catch (err) {
      console.error(`[import] image upload failed for "${wycName}":`, err.message);
      imageResults.fallback++;
      imageResults.errors.push({ colour: wycName, error: err.message });

      // Keep the colour in the array using the supplier URL as fallback
      // so the product still has all swatches even if one upload failed.
      processedColours.push({
        name:    wycName,
        hex:     colour.hex,
        img_url: colour.imgUrl,
      });
    }
  }

  // ── Build the product record ───────────────────────────────────────────────
  const badgeLabels = {
    new:     'New In',
    seller:  'Best Seller',
    sale:    'Sale',
    premium: 'Premium',
  };

  const badgeType = family.badgeType || null;
  const badge     = badgeType ? (badgeLabels[badgeType] || family.badge || null) : null;

  const product = {
    name:              family.wycName.trim(),
    category_slug:     'carpets',
    price:             parseFloat(family.price),
    original_price:    family.originalPrice ? parseFloat(family.originalPrice) : null,
    description:       family.specs.description || '',
    img_url:           processedColours[0]?.img_url || null,
    badge:             badge,
    badge_type:        badgeType,
    rooms:             JSON.stringify(family.specs.rooms    || []),
    durability:        family.specs.durability  || 3,
    softness:          family.specs.softness    || 3,
    is_featured:       0,
    is_deal:           0,
    is_active:         1,
    fitting_price:     6.00,
    colours:           JSON.stringify(processedColours),
    features:          JSON.stringify(family.specs.features || []),
    colour_family:     family.specs.dominantColourFamily || 'neutrals',
    fibre:             family.specs.fibre       || 'Mixed Fibres',
    carpet_style:      family.specs.carpetStyle || 'Twist',
    softness_label:    'Soft',
    thickness:         'Medium',
    density:           'Medium',
    stock_level:       0,
    likes:             0,
  };

  const cols         = Object.keys(product);
  const values       = Object.values(product);
  const colList      = cols.map(c => `"${c}"`).join(', ');
  const placeholder  = cols.map((_, i) => `$${i + 1}`).join(', ');

  try {
    const result = await pool.query(
      `INSERT INTO products (${colList}) VALUES (${placeholder}) RETURNING id, name`,
      values
    );

    return res.status(201).json({
      success:      true,
      product:      result.rows[0],
      imageResults,
    });

  } catch (err) {
    console.error('[import] db insert error:', err.message);
    return res.status(500).json({ error: `Database error: ${err.message}` });
  }
});

module.exports = router;
