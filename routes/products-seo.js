'use strict';

/**
 * routes/products-seo.js
 *
 * GET /flooring/:category/:slug
 *
 * Serves a fully server-rendered HTML product page.
 * - Google and other bots get complete HTML with all SEO tags + JSON-LD
 * - Human visitors get the same beautiful page, with a CTA to open the
 *   full catalogue overlay back on the homepage
 *
 * Mounted in server.js:
 *   const seoRoutes = require('./routes/products-seo');
 *   app.use('/flooring', seoRoutes);
 *
 * This route is PUBLIC — no auth required.
 */

const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const SITE_URL   = process.env.SITE_URL || 'https://www.westyorkshirecarpets.com';
const SITE_NAME  = 'West Yorkshire Carpets';
const PHONE      = '07449 188 303';
const PHONE_HREF = 'tel:07449188303';

// ── Slug generation ────────────────────────────────────────────────────────────
function toSlug(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Feature labels ─────────────────────────────────────────────────────────────
const FEAT_LABELS = {
  bleach:     'Bleach Cleanable',
  stain:      'Stain Resistant',
  easyClean:  'Easy Clean',
  pet:        'Pet Friendly',
  waterproof: '100% Waterproof',
  soft:       'Ultra Soft',
  insulation: 'Warm Underfoot',
  scratch:    'Scratch Resistant',
};

const ROOM_LABELS = {
  living:   'Living Room',
  bedroom:  'Bedroom',
  kitchen:  'Kitchen',
  bathroom: 'Bathroom',
  hallway:  'Hallway',
  stairs:   'Stairs',
};

const CAT_LABELS = {
  carpets:  'Carpet',
  vinyl:    'Vinyl Flooring',
  laminate: 'Laminate Flooring',
  wood:     'Real Wood Flooring',
};

// ── Safe JSON parse helper ─────────────────────────────────────────────────────
function safeJson(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}

// ── Build star rating HTML ─────────────────────────────────────────────────────
function stars(n, max) {
  let html = '';
  for (let i = 1; i <= max; i++) {
    html += `<span class="star${i <= n ? ' star--on' : ''}" aria-hidden="true">★</span>`;
  }
  return `<span class="rating-stars" aria-label="${n} out of ${max}">${html}</span>`;
}

// ── Build spec rows ────────────────────────────────────────────────────────────
function specRow(label, value) {
  if (!value) return '';
  return `<div class="spec-row"><span class="spec-label">${label}</span><span class="spec-value">${value}</span></div>`;
}

// ── Build the full HTML page ───────────────────────────────────────────────────
function buildProductPage(p) {
  const slug     = toSlug(p.name);
  const catSlug  = p.category_slug;
  const catLabel = CAT_LABELS[catSlug] || catSlug;
  const pageUrl  = `${SITE_URL}/flooring/${catSlug}/${slug}`;
  const imgUrl   = p.img_url || `${SITE_URL}/images/og-image.jpg`;

  const features = safeJson(p.features);
  const rooms    = safeJson(p.rooms);
  const colours  = safeJson(p.colours);

  const price    = parseFloat(p.price).toFixed(2);
  const wasPrice = p.original_price ? parseFloat(p.original_price).toFixed(2) : null;
  const saving   = wasPrice ? (parseFloat(wasPrice) - parseFloat(price)).toFixed(2) : null;

  // Meta description
  const metaDesc = p.description
    ? `${p.description} Available from £${price}/m². Free measure & quote across West Yorkshire. Call ${PHONE}.`
    : `${p.name} ${catLabel} from West Yorkshire Carpets. From £${price}/m². Free professional fitting available. Call ${PHONE}.`;

  // Features HTML
  const featuresHTML = features
    .filter(f => FEAT_LABELS[f])
    .map(f => `<div class="feat-chip"><i class="fa-solid ${getFeatIcon(f)}" aria-hidden="true"></i>${FEAT_LABELS[f]}</div>`)
    .join('');

  // Rooms HTML
  const roomsHTML = rooms
    .filter(r => ROOM_LABELS[r])
    .map(r => `<span class="room-chip">${ROOM_LABELS[r]}</span>`)
    .join('');

  // Colours HTML
  const coloursHTML = colours.map((c, i) => {
    const bg = c.img_url
      ? `data-bg="${c.img_url}"`
      : `data-hex="${c.hex || '#999'}"`;
    return `<div class="swatch${i === 0 ? ' active' : ''}" title="${c.name}" ${bg} data-name="${c.name}" data-img="${c.img_url || ''}"></div>`;
  }).join('');

  // Specs section
  let specsHTML = '';
  if (catSlug === 'carpets') {
    specsHTML = `
      <div class="spec-group">
        ${p.fibre        ? specRow('Fibre', p.fibre) : ''}
        ${p.carpet_style ? specRow('Style', p.carpet_style) : ''}
        ${p.thickness    ? specRow('Pile Height', p.thickness) : ''}
        ${p.density      ? specRow('Density', p.density) : ''}
        ${specRow('Durability', stars(p.durability || 3, 5) + ` <small>${p.durability || 3}/5</small>`)}
        ${specRow('Softness', stars(p.softness || 3, 5) + ` <small>${p.softness || 3}/5</small>`)}
      </div>`;
  } else {
    specsHTML = `
      <div class="spec-group">
        ${p.thickness_mm       ? specRow('Board Thickness', p.thickness_mm + 'mm') : ''}
        ${p.wear_layer_mm      ? specRow('Wear Layer', p.wear_layer_mm + 'mm') : ''}
        ${p.ac_rating          ? specRow('AC Rating', p.ac_rating) : ''}
        ${p.board_design       ? specRow('Board Design', p.board_design) : ''}
        ${p.plank_width_mm     ? specRow('Plank Width', p.plank_width_mm + 'mm') : ''}
        ${p.species_finish     ? specRow('Species & Finish', p.species_finish) : ''}
        ${p.surface_finish     ? specRow('Surface Finish', p.surface_finish) : ''}
        ${p.lay_pattern        ? specRow('Lay Pattern', p.lay_pattern) : ''}
        ${p.installation_method? specRow('Installation', p.installation_method) : ''}
        ${p.ufh_compatible     ? specRow('Underfloor Heating', 'Compatible') : ''}
        ${specRow('Durability', stars(p.durability || 3, 5) + ` <small>${p.durability || 3}/5</small>`)}
      </div>`;
  }

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description || `${p.name} ${catLabel} from ${SITE_NAME}`,
    image: imgUrl,
    url: pageUrl,
    brand: { '@type': 'Brand', name: SITE_NAME },
    category: catLabel,
    offers: {
      '@type': 'Offer',
      url: pageUrl,
      priceCurrency: 'GBP',
      price: parseFloat(price),
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: parseFloat(price),
        priceCurrency: 'GBP',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MTK' },
      },
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: SITE_NAME, telephone: PHONE },
    },
    ...(colours.length > 0 && {
      color: colours.map(c => c.name).join(', '),
    }),
  };

  // Breadcrumb JSON-LD
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: catLabel, item: `${SITE_URL}/#range` },
      { '@type': 'ListItem', position: 3, name: p.name, item: pageUrl },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${p.name} | ${catLabel} | ${SITE_NAME}</title>
<meta name="description" content="${metaDesc.replace(/"/g, '&quot;')}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${pageUrl}">

<!-- Open Graph -->
<meta property="og:type"        content="product">
<meta property="og:url"         content="${pageUrl}">
<meta property="og:title"       content="${p.name} | ${catLabel} | ${SITE_NAME}">
<meta property="og:description" content="${metaDesc.replace(/"/g, '&quot;')}">
<meta property="og:image"       content="${imgUrl}">
<meta property="og:image:width"  content="800">
<meta property="og:image:height" content="600">
<meta property="og:site_name"   content="${SITE_NAME}">
<meta property="og:locale"      content="en_GB">
<meta property="product:price:amount"   content="${price}">
<meta property="product:price:currency" content="GBP">

<!-- Twitter Card -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${p.name} | ${SITE_NAME}">
<meta name="twitter:description" content="${metaDesc.replace(/"/g, '&quot;')}">
<meta name="twitter:image"       content="${imgUrl}">

<!-- JSON-LD Structured Data -->
<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd, null, 2)}</script>

<!-- Preconnect -->
<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>

<!-- Fonts & Icons -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<link rel="icon" href="/assets/favicon/favicon.svg" type="image/svg+xml">

<link rel="stylesheet" href="/css/product-page.css">
</head>
<body>

<!-- Header -->
<header class="site-header">
  <a href="/" class="header-logo" aria-label="West Yorkshire Carpets — Home">
    <img src="/images/logo.svg" alt="${SITE_NAME}" width="140" height="36" loading="eager">
  </a>
  <div class="header-actions">
    <a href="${PHONE_HREF}" class="btn-phone"><i class="fa-solid fa-phone" aria-hidden="true"></i><span>${PHONE}</span></a>
    <a href="/#contact" class="btn-primary">Free Quote</a>
  </div>
</header>

<!-- Breadcrumb -->
<nav class="breadcrumb" aria-label="Breadcrumb">
  <div class="breadcrumb-inner">
    <a href="/">Home</a>
    <span class="breadcrumb-sep" aria-hidden="true">›</span>
    <a href="/#range">${catLabel}</a>
    <span class="breadcrumb-sep" aria-hidden="true">›</span>
    <span class="breadcrumb-current" aria-current="page">${p.name}</span>
  </div>
</nav>

<!-- Main content -->
<main class="product-page">
  <div class="product-grid">

    <!-- Image column -->
    <div class="product-img-wrap">
      <img
        id="product-main-img"
        src="${imgUrl}"
        alt="${p.name} ${catLabel} — ${SITE_NAME}"
        class="product-main-img"
        width="800" height="600"
        loading="eager"
        fetchpriority="high"
      >
      ${colours.length > 1 ? `
      <div class="product-swatches" role="list" aria-label="Available colours">
        ${coloursHTML}
      </div>
      <p class="swatch-label" id="swatch-label">${colours[0]?.name || ''}</p>
      ` : ''}
    </div>

    <!-- Detail column -->
    <div class="product-detail">
      ${p.badge && p.badge_type ? `<div class="product-badge badge--${p.badge_type}">${p.badge}</div>` : ''}
      <div class="product-cat-label">${catLabel}</div>
      <h1 class="product-name">${p.name}</h1>

      <div class="product-price-row">
        <div class="product-price">£${price}<small>/m²</small></div>
        ${wasPrice ? `<span class="product-was">£${wasPrice}</span>` : ''}
        ${saving ? `<span class="product-save">Save £${saving}</span>` : ''}
      </div>
      <p class="product-fitting"><i class="fa-solid fa-scissors" aria-hidden="true"></i> Professional fitting from <strong>£${(parseFloat(p.fitting_price) || 6).toFixed(2)}/m²</strong></p>

      ${p.description ? `<p class="product-desc">${p.description}</p>` : ''}

      ${featuresHTML ? `<div class="feat-grid" aria-label="Product features">${featuresHTML}</div>` : ''}
      ${roomsHTML ? `<div class="rooms-row" aria-label="Suitable for">${roomsHTML}</div>` : ''}

      <!-- CTA block -->
      <div class="cta-block">
        <div class="cta-title">Get a Quote for This Product</div>
        <div class="cta-sub">Free in-home measure included. We come to you anywhere in West Yorkshire — no obligation.</div>
        <div class="cta-buttons">
          <a href="${PHONE_HREF}" class="btn-cta-primary"><i class="fa-solid fa-phone" aria-hidden="true"></i> Call ${PHONE}</a>
          <a href="https://wa.me/447449188303?text=Hi%2C+I%27m+interested+in+${encodeURIComponent(p.name)}+flooring" target="_blank" rel="noopener noreferrer" class="btn-cta-secondary"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp Us</a>
          <a href="/?product=${encodeURIComponent(p.name)}#lead-form" class="btn-cta-secondary"><i class="fa-solid fa-calendar-check" aria-hidden="true"></i> Book Free Measure Online</a>
        </div>
        <p class="cta-note">We respond within 24 hours. No spam, no pressure.</p>
      </div>

      <!-- Specs -->
      ${specsHTML ? `<div class="specs-title">Specifications</div>${specsHTML}` : ''}

    </div>
  </div>

  <!-- Also in this range placeholder — populated via JS -->
  <div id="also-section" data-cat="${catSlug}" data-slug="${slug}" data-label="${catLabel}" data-api="https://wyc-backend-production-ed78.up.railway.app"></div>
</main>

<!-- Footer -->
<footer class="site-footer">
  <div class="footer-inner">
    <a href="/" class="footer-logo"><img src="/images/logo.svg" alt="${SITE_NAME}" width="120" height="30" loading="lazy"></a>
    <nav class="footer-links" aria-label="Footer navigation">
      <a href="/#range">Browse All Flooring</a>
      <a href="/#quote">Price Calculator</a>
      <a href="/#contact">Contact Us</a>
      <a href="/privacy-policy.html">Privacy Policy</a>
    </nav>
  </div>
  <div class="footer-bottom">
    <p>&copy; 2026 ${SITE_NAME}. All rights reserved.</p>
    <div class="footer-legal">
      <a href="/privacy-policy.html">Privacy Policy</a>
      <a href="/terms.html">Terms</a>
    </div>
  </div>
</footer>

<script src="/js/product-page.js"></script>

</body>
</html>`;
}

function getFeatIcon(key) {
  const icons = {
    bleach: 'fa-spray-can', stain: 'fa-droplet-slash', easyClean: 'fa-broom',
    pet: 'fa-paw', waterproof: 'fa-shield-halved', soft: 'fa-feather',
    insulation: 'fa-temperature-low', scratch: 'fa-shield',
  };
  return icons[key] || 'fa-check';
}

// ── Route handler ──────────────────────────────────────────────────────────────
router.get('/:category/:slug', async (req, res) => {
  const { category, slug } = req.params;

  // Validate category
  const validCats = ['carpets', 'vinyl', 'laminate', 'wood'];
  if (!validCats.includes(category)) {
    return res.status(404).send('Not found');
  }

  try {
    // Fetch all active products in this category
    const result = await pool.query(
      'SELECT * FROM products WHERE category_slug = $1 AND is_active = 1',
      [category]
    );

    // Find the product by slug match
    const product = result.rows.find(p => toSlug(p.name) === slug);

    if (!product) {
      return res.status(404).send(`
        <!DOCTYPE html><html><head><title>Product Not Found | ${SITE_NAME}</title>
        <meta name="robots" content="noindex"></head>
        <body style="font-family:sans-serif;text-align:center;padding:80px 24px">
        <h1>Product not found</h1>
        <p>This product may have been removed or renamed.</p>
        <a href="/" style="color:#E03040">← Back to homepage</a>
        </body></html>
      `);
    }

    const html = buildProductPage(product);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.send(html);

  } catch (err) {
    console.error('[product-seo] error:', err.message);
    res.status(500).send('Server error');
  }
});

// ── Sitemap route — returns all product URLs ───────────────────────────────────
router.get('/sitemap.xml', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT name, category_slug, updated_at FROM products WHERE is_active = 1 ORDER BY category_slug, name"
    );

    const urls = result.rows.map(p => {
      const slug = toSlug(p.name);
      const lastmod = p.updated_at
        ? new Date(p.updated_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      return `  <url>
    <loc>${SITE_URL}/flooring/${p.category_slug}/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
