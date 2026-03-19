'use strict';

/**
 * routes/scraper.js
 *
 * POST /api/panel/scrape-family  — scrapes a CLD family page + PDF spec sheet.
 *                                   Returns structured JSON for review.
 *                                   Nothing written to DB.
 *
 * POST /api/panel/import-family  — takes reviewed data, uploads images to
 *                                   Cloudinary, inserts one product row.
 */

const express    = require('express');
const router     = express.Router();
const axios      = require('axios');
const cheerio    = require('cheerio');
const cloudinary = require('cloudinary').v2;
const { Pool }   = require('pg');
const jwt        = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ─── JWT guard ────────────────────────────────────────────────────────────────

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

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapDurability(s) {
  if (!s) return 3;
  const l = s.toLowerCase();
  if (l.includes('heavy'))   return 5;
  if (l.includes('general')) return 3;
  if (l.includes('light'))   return 2;
  return 3;
}

function mapSoftness(s) {
  if (!s) return 3;
  const l = s.toLowerCase();
  if (l.includes('heavy'))   return 4;
  if (l.includes('general')) return 3;
  if (l.includes('light'))   return 2;
  return 3;
}

function mapCarpetStyleFromText(text) {
  if (!text) return '';
  const t = text.toLowerCase();
  if (t.includes('saxony'))    return 'Saxony';
  if (t.includes('berber'))    return 'Berber';
  if (t.includes('loop pile')) return 'Loop Pile';
  if (t.includes('velvet'))    return 'Velvet';
  if (t.includes('twist'))     return 'Twist';
  return '';
}

function mapFeatures(text) {
  if (!text) return [];
  const t = text.toLowerCase();
  const out = new Set();
  if (t.includes('bleach cleanable') || t.includes('bleach clean'))   out.add('bleach');
  if (t.includes('stain resist'))                                       out.add('stain');
  if (t.includes('easy to clean') || t.includes('ease of maintenance') ||
      t.includes('easy clean'))                                         out.add('easyClean');
  if (t.includes('underfloor heating') || t.includes('underfloor'))   out.add('insulation');
  if (t.includes('pet friendly') || t.includes('pet-friendly'))        out.add('pet');
  if (t.includes('ultra soft') || t.includes('luxurious'))             out.add('soft');
  if (t.includes('waterproof'))                                         out.add('waterproof');
  if (t.includes('scratch resist'))                                     out.add('scratch');
  return [...out];
}

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

function normaliseFibre(raw) {
  if (!raw) return '';
  const r = raw.toLowerCase();
  if (r.includes('polypropylene'))                        return '100% Polypropylene';
  if (r.includes('recycled') && r.includes('polyester'))  return '100% Recycled Polyester';
  if (r.includes('polyester'))                            return '100% Polyester';
  if (r.includes('wool'))                                 return '100% Wool';
  return raw.trim();
}

function extractFibreFromPdf(text) {
  if (!text) return '';
  const labelled =
    text.match(/pile\s+content\s*[:\-]\s*([^\n\r,;]+)/i) ||
    text.match(/pile\s+composition\s*[:\-]\s*([^\n\r,;]+)/i) ||
    text.match(/fibre\s+content\s*[:\-]\s*([^\n\r,;]+)/i) ||
    text.match(/content\s*[:\-]\s*(\d{2,3}%[^\n\r,;]+)/i);
  if (labelled) return normaliseFibre(labelled[1].trim());
  const pct = text.match(/(\d{2,3}%\s*(?:polypropylene|polyester|wool|nylon|recycled\s+polyester)[^\n\r,;]*)/i);
  if (pct) return normaliseFibre(pct[1].trim());
  return '';
}

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
  return '#A0A0A0';
}

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

function dominantColourFamily(colours) {
  const counts = {};
  colours.forEach(c => {
    const f = colourFamilyFromName(c.supplierName);
    counts[f] = (counts[f] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutrals';
}

// ─── PDF fetch helper ─────────────────────────────────────────────────────────

async function fetchAndParsePdf(pdfUrl) {
  let pdfParse;
  try { pdfParse = require('pdf-parse'); } catch {
    console.warn('[scraper] pdf-parse not installed — skipping PDF');
    return '';
  }
  try {
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      },
    });
    const data = await pdfParse(Buffer.from(response.data));
    return data.text || '';
  } catch (err) {
    console.warn('[scraper] PDF parse failed:', err.message);
    return '';
  }
}

// ─── POST /scrape-family ──────────────────────────────────────────────────────

router.post('/scrape-family', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  // 1. Fetch HTML
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
    return res.status(502).json({ error: `Could not fetch supplier page: ${err.message}` });
  }

  const $ = cheerio.load(html);

  // 2. Family name
  const familyName =
    $('h1').first().text().trim() ||
    $('h2').first().text().trim() ||
    url.split('/').filter(Boolean).pop().replace(/-/g, ' ');

  // 3. Key-value specs from <strong> tags
  const specs = {};
  $('strong, b').each((_, el) => {
    const keyRaw  = $(el).text().replace(/:$/, '').trim();
    const fullTxt = $(el).parent().text();
    const valRaw  = fullTxt.replace($(el).text(), '').replace(/^:?\s*/, '').trim();
    if (keyRaw && valRaw) specs[keyRaw.toLowerCase()] = valRaw;
  });

  const suitability = specs['suitability'] || specs['suitable for'] || '';
  const pileWeight  = specs['pile weight'] || specs['pile content weight'] || '';

  // 4. Find spec sheet PDF link
  let pdfUrl = '';
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().toLowerCase();
    if (href.endsWith('.pdf') && (text.includes('spec') || text.includes('specification'))) {
      pdfUrl = href.startsWith('http') ? href : 'https://www.carpetlinedirect.co.uk' + href;
    }
  });

  // 5. Fetch and parse PDF
  let pdfText = '';
  if (pdfUrl) {
    console.log('[scraper] fetching spec sheet PDF:', pdfUrl);
    pdfText = await fetchAndParsePdf(pdfUrl);
    if (pdfText) console.log('[scraper] PDF text extracted, length:', pdfText.length);
  }

  // 6. Combined text for feature/room detection
  const pageText = $('p, li').map((_, el) => $(el).text()).get().join(' ');
  const allText  = [Object.values(specs).join(' '), pageText, pdfText].join(' ');

  // 7. Fibre — PDF is most reliable
  const fibreFromPdf  = extractFibreFromPdf(pdfText);
  const fibreFromPage = normaliseFibre(
    specs['pile content'] || specs['pile composition'] ||
    specs['fibre'] || specs['content'] || ''
  );
  const fibre = fibreFromPdf || fibreFromPage || 'Mixed Fibres';

  // 8. Carpet style — PDF first, then family name
  const carpetStyle =
    mapCarpetStyleFromText(pdfText) ||
    mapCarpetStyleFromText(familyName) ||
    'Twist';

  // 9. Extract colours
  const colours  = [];
  const seenUrls = new Set();

  $('figure').each((_, el) => {
    const anchor  = $(el).find('a').first();
    const img     = $(el).find('img').first();
    const caption = $(el).find('figcaption').text().trim();
    let imgUrl    = anchor.attr('href') || img.attr('src') || '';
    imgUrl = imgUrl.replace(/-\d+x\d+(\.\w+)$/, '$1');
    if (imgUrl && !imgUrl.startsWith('http')) imgUrl = 'https://www.carpetlinedirect.co.uk' + imgUrl;
    if (!imgUrl || !caption) return;
    if (!/\.(jpe?g|png|webp)/i.test(imgUrl)) return;
    if (/icons|logo|banner|CLD-Web|CLD-Master/i.test(imgUrl)) return;
    if (seenUrls.has(imgUrl)) return;
    seenUrls.add(imgUrl);
    colours.push({ supplierName: caption, imgUrl });
  });

  if (colours.length === 0) {
    $('a').each((_, el) => {
      const href    = $(el).attr('href') || '';
      const altText = $(el).find('img').attr('alt') || '';
      const name    = altText || $(el).next('figcaption, p, span').text().trim();
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
      error: 'No colour variants found. Make sure the URL points to a specific product family page.',
    });
  }

  const enrichedColours = colours.map(c => ({
    supplierName: c.supplierName,
    wycName:      c.supplierName,
    imgUrl:       c.imgUrl,
    hex:          hexFromName(c.supplierName),
    colourFamily: colourFamilyFromName(c.supplierName),
  }));

  const suitStr     = suitability || 'General Domestic';
  const description = [familyName, suitStr, pileWeight ? pileWeight + ' pile weight' : '']
    .filter(Boolean).join(' — ');

  return res.json({
    supplierName: familyName,
    wycName:      familyName,
    url,
    pdfUrl,
    specs: {
      fibre,
      pileWeight,
      suitability:          suitStr,
      carpetStyle,
      durability:           mapDurability(suitStr),
      softness:             mapSoftness(suitStr),
      description,
      features:             mapFeatures(allText),
      rooms:                mapRooms(allText),
      dominantColourFamily: dominantColourFamily(colours),
    },
    colours: enrichedColours,
  });
});

// ─── POST /import-family ──────────────────────────────────────────────────────

router.post('/import-family', async (req, res) => {
  const { family } = req.body;

  if (!family)                             return res.status(400).json({ error: 'family payload required' });
  if (!family.wycName?.trim())             return res.status(400).json({ error: 'wycName is required' });
  if (!family.price || family.price <= 0) return res.status(400).json({ error: 'A valid price is required' });
  if (!family.colours?.length)            return res.status(400).json({ error: 'No colour variants to import' });

  const imageResults     = { uploaded: 0, fallback: 0, errors: [] };
  const processedColours = [];

  for (const colour of family.colours) {
    const wycName  = (colour.wycName || colour.supplierName || 'colour').trim();
    const publicId =
      'wyc-products/' +
      family.wycName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '/' +
      wycName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    try {
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
      const dataUri  = `data:${mimeType};base64,${Buffer.from(dlResponse.data).toString('base64')}`;
      const upload   = await cloudinary.uploader.upload(dataUri, { public_id: publicId, overwrite: true });
      processedColours.push({ name: wycName, hex: colour.hex, img_url: upload.secure_url });
      imageResults.uploaded++;
    } catch (err) {
      console.error(`[import] image upload failed for "${wycName}":`, err.message);
      imageResults.fallback++;
      imageResults.errors.push({ colour: wycName, error: err.message });
      processedColours.push({ name: wycName, hex: colour.hex, img_url: colour.imgUrl });
    }
  }

  const BADGE_LABELS = { new: 'New In', seller: 'Best Seller', sale: 'Sale', premium: 'Premium' };
  const badgeType    = family.badgeType || null;
  const badge        = badgeType ? (BADGE_LABELS[badgeType] || null) : null;

  const product = {
    name:           family.wycName.trim(),
    category_slug:  'carpets',
    price:          parseFloat(family.price),
    original_price: family.originalPrice ? parseFloat(family.originalPrice) : null,
    description:    family.specs.description || '',
    img_url:        processedColours[0]?.img_url || null,
    badge,
    badge_type:     badgeType,
    rooms:          JSON.stringify(family.specs.rooms    || []),
    durability:     family.specs.durability  || 3,
    softness:       family.specs.softness    || 3,
    is_featured:    0,
    is_deal:        0,
    is_active:      1,
    fitting_price:  6.00,
    colours:        JSON.stringify(processedColours),
    features:       JSON.stringify(family.specs.features || []),
    colour_family:  family.specs.dominantColourFamily || 'neutrals',
    fibre:          family.specs.fibre      || 'Mixed Fibres',
    carpet_style:   family.specs.carpetStyle || 'Twist',
    softness_label: 'Soft',
    thickness:      'Medium',
    density:        'Medium',
    stock_level:    0,
    likes:          0,
  };

  const cols        = Object.keys(product);
  const values      = Object.values(product);
  const colList     = cols.map(c => `"${c}"`).join(', ');
  const placeholder = cols.map((_, i) => `$${i + 1}`).join(', ');

  try {
    const result = await pool.query(
      `INSERT INTO products (${colList}) VALUES (${placeholder}) RETURNING id, name`,
      values
    );
    return res.status(201).json({ success: true, product: result.rows[0], imageResults });
  } catch (err) {
    console.error('[import] db insert error:', err.message);
    return res.status(500).json({ error: `Database error: ${err.message}` });
  }
});

module.exports = router;
