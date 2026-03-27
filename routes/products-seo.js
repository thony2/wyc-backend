'use strict';

/**
 * routes/products-seo.js
 *
 * GET /flooring/:category/:slug
 *
 * Serves a fully server-rendered HTML product page.
 * Google and other bots get complete HTML with all SEO tags + JSON-LD.
 *
 * Mounted in server.js:
 *   app.use('/flooring', require('./routes/products-seo'));
 */

const express    = require('express');
const router     = express.Router();
const { Pool }   = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const SITE_URL   = process.env.SITE_URL || 'https://www.westyorkshirecarpets.com';
const SITE_NAME  = 'West Yorkshire Carpets';
const PHONE      = '07449 188 303';
const PHONE_HREF = 'tel:07449188303';
const WA_BASE    = 'https://wa.me/447449188303?text=';

// ── Slug ──────────────────────────────────────────────────────────────────────
function toSlug(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Labels ────────────────────────────────────────────────────────────────────
const CAT_LABELS = {
  carpets:  'Carpet',
  vinyl:    'Vinyl Flooring',
  laminate: 'Laminate Flooring',
  wood:     'Real Wood Flooring',
};

// ── Room presets per category ─────────────────────────────────────────────────
const PRESETS = {
  carpets:  [
    { label: 'Single bedroom', len: '3.0' },
    { label: 'Double bedroom', len: '3.5' },
    { label: 'Master bedroom', len: '4.2' },
    { label: 'Living room',    len: '5.5' },
  ],
  vinyl:    [
    { label: 'Kitchen',     len: '2.5' },
    { label: 'Hallway',     len: '3.0' },
    { label: 'Living room', len: '5.5' },
    { label: 'Open plan',   len: '7.0' },
  ],
  laminate: [
    { label: 'Kitchen',     len: '2.5' },
    { label: 'Hallway',     len: '3.0' },
    { label: 'Living room', len: '5.5' },
    { label: 'Open plan',   len: '7.0' },
  ],
  wood:     [
    { label: 'Kitchen',     len: '2.5' },
    { label: 'Hallway',     len: '3.0' },
    { label: 'Living room', len: '5.5' },
    { label: 'Open plan',   len: '7.0' },
  ],
};

// ── Pile-style tooltip definitions ────────────────────────────────────────────
const PILE_TIPS = {
  'Saxony':     'A dense, cut-pile carpet with an upright, velvety finish. Exceptionally soft underfoot \u2014 ideal for bedrooms and living rooms.',
  'Twist':      'Tightly twisted yarn gives a textured, hardwearing surface. Hides footprints well \u2014 perfect for hallways and stairs.',
  'Loop Pile':  'Uncut loops create a firm, durable surface. Easy to clean and resilient \u2014 great for busy family areas.',
  'Berber':     'Chunky, natural-look loops in earthy tones. Extremely durable with excellent thermal insulation.',
  'Velvet':     'Ultra-smooth, close-cut pile for a luxurious, formal look. The finest finish available in carpet.',
  'Herringbone':'A classic woven pattern creating a V-shaped zigzag. Timeless, elegant and highly durable.',
};

// ── Feature chips ─────────────────────────────────────────────────────────────
const FEAT_DEF = {
  stain:      { icon: 'fa-droplet-slash',   label: 'Stain Resistant'  },
  pet:        { icon: 'fa-paw',             label: 'Pet Friendly'     },
  bleach:     { icon: 'fa-spray-can',       label: 'Bleach Cleanable' },
  soft:       { icon: 'fa-feather',         label: 'Ultra Soft'       },
  luxury:     { icon: 'fa-gem',             label: 'Luxury Pile'      },
  insulation: { icon: 'fa-temperature-low', label: 'Warm Underfoot'   },
  waterproof: { icon: 'fa-shield-halved',   label: '100% Waterproof'  },
  scratch:    { icon: 'fa-shield',          label: 'Scratch Resistant' },
  easyClean:  { icon: 'fa-broom',           label: 'Easy Clean'       },
};

// ── Room chips ────────────────────────────────────────────────────────────────
const ROOMS_DEF = [
  { key: 'living',   icon: 'fa-couch',     label: 'Living Room' },
  { key: 'bedroom',  icon: 'fa-bed',       label: 'Bedroom'     },
  { key: 'kitchen',  icon: 'fa-utensils',  label: 'Kitchen'     },
  { key: 'bathroom', icon: 'fa-shower',    label: 'Bathroom'    },
  { key: 'hallway',  icon: 'fa-door-open', label: 'Hallway'     },
  { key: 'stairs',   icon: 'fa-stairs',    label: 'Stairs'      },
  { key: 'office',   icon: 'fa-briefcase', label: 'Office'      },
  { key: 'dining',   icon: 'fa-chair',     label: 'Dining Room' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeJson(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// Spec bar row (continuous track style, percentage width)
function specBarRow(label, val, max, valLabel) {
  const pct = Math.round((val / max) * 100);
  return `<div class="spec-bar-row">
    <div class="spec-bar-name">${label}</div>
    <div class="spec-bar-track"><div class="spec-bar-fill" style="width:${pct}%"></div></div>
    <div class="spec-bar-val">${valLabel}</div>
  </div>`;
}

// Detail table row
function dtRow(key, val) {
  if (!val) return '';
  return `<div class="dt-row"><span class="dt-key">${key}</span><span class="dt-val">${esc(val)}</span></div>`;
}

// ── Build the full page ───────────────────────────────────────────────────────
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
  const fitting  = parseFloat(p.fitting_price || 6).toFixed(2);
  const wasPrice = p.original_price ? parseFloat(p.original_price).toFixed(2) : null;
  const saving   = wasPrice ? (parseFloat(wasPrice) - parseFloat(price)).toFixed(2) : null;

  const metaDesc = p.description
    ? `${p.description} Available from \u00a3${price}/m\u00b2. Free measure & quote across West Yorkshire. Call ${PHONE}.`
    : `${p.name} ${catLabel} from West Yorkshire Carpets. From \u00a3${price}/m\u00b2. Free professional fitting available. Call ${PHONE}.`;

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type':    'Product',
    name:        p.name,
    description: p.description || `${p.name} ${catLabel} from ${SITE_NAME}`,
    image:       imgUrl,
    url:         pageUrl,
    brand:       { '@type': 'Brand', name: SITE_NAME },
    category:    catLabel,
    offers: {
      '@type':         'Offer',
      url:             pageUrl,
      priceCurrency:   'GBP',
      price:           parseFloat(price),
      priceSpecification: {
        '@type':            'UnitPriceSpecification',
        price:              parseFloat(price),
        priceCurrency:      'GBP',
        referenceQuantity:  { '@type': 'QuantitativeValue', value: 1, unitCode: 'MTK' },
      },
      availability: 'https://schema.org/InStock',
      seller:       { '@type': 'Organization', name: SITE_NAME, telephone: PHONE },
    },
    ...(colours.length > 0 && { color: colours.map(c => c.name).join(', ') }),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',     item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: catLabel,   item: `${SITE_URL}/#range` },
      { '@type': 'ListItem', position: 3, name: p.name,     item: pageUrl },
    ],
  };

  // ── Feature chips HTML ─────────────────────────────────────────────────────
  const featuresHTML = features.map(f => {
    const d = FEAT_DEF[f]; if (!d) return '';
    return `<div class="feat-chip"><i class="fa-solid ${d.icon}" aria-hidden="true"></i><span>${d.label}</span></div>`;
  }).filter(Boolean).join('');

  // ── Room chips HTML ────────────────────────────────────────────────────────
  const roomsHTML = ROOMS_DEF.filter(r => rooms.includes(r.key)).map(r =>
    `<div class="suitable-tag"><i class="fa-solid ${r.icon}" aria-hidden="true"></i><span>${r.label}</span></div>`
  ).join('');

  // ── Colour swatches HTML ───────────────────────────────────────────────────
  const SWATCH_VISIBLE = 8;
  const coloursHTML = colours.map((c, i) => {
    const bg      = c.img_url ? `data-bg="${esc(c.img_url)}"` : `data-hex="${esc(c.hex || '#999')}"`;
    const imgAttr = c.img_url ? `data-img="${esc(c.img_url)}"` : '';
    const hidden  = i >= SWATCH_VISIBLE ? ' swatch--hidden' : '';
    return `<div class="swatch${i === 0 ? ' active' : ''}${hidden}" ${bg} ${imgAttr} data-name="${esc(c.name)}" role="button" aria-label="Select colour ${esc(c.name)}" tabindex="0"></div>`;
  }).join('');
  const showMoreBtn = colours.length > SWATCH_VISIBLE
    ? `<button class="swatch-show-more" id="swatch-show-more" type="button">Show ${colours.length - SWATCH_VISIBLE} more colour${colours.length - SWATCH_VISIBLE !== 1 ? 's' : ''}</button>`
    : '';

  // ── Badge HTML ─────────────────────────────────────────────────────────────
  const badgeHTML = p.badge && p.badge_type
    ? `<span class="product-badge badge--${p.badge_type}">${esc(p.badge)}</span>`
    : '';

  // ── Pile style info button ─────────────────────────────────────────────────
  const infoTip = PILE_TIPS[p.carpet_style] || (p.carpet_style ? `${p.carpet_style} \u2014 a quality carpet pile style suited to a range of rooms.` : '');
  const infoBtn = p.carpet_style && infoTip
    ? `<button class="info-btn" data-tooltip="${esc(infoTip)}" aria-label="About ${esc(p.carpet_style)}" type="button"><i class="fa-solid fa-circle-info" aria-hidden="true"></i></button>`
    : '';
  const eyebrowLabel = p.carpet_style ? `${catLabel} / ${p.carpet_style}` : catLabel;

  // ── Presets HTML ───────────────────────────────────────────────────────────
  const presetsHTML = (PRESETS[catSlug] || PRESETS.carpets).map(pr =>
    `<button class="preset-chip" data-len="${pr.len}" type="button">${pr.label}</button>`
  ).join('');

  // ── Step numbers ───────────────────────────────────────────────────────────
  const colourStep = colours.length > 1 ? '01' : null;
  const configStep = colours.length > 1 ? '02' : '01';

  // ── Specs HTML ─────────────────────────────────────────────────────────────
  let specBarsHTML  = '';
  let detailRowsHTML = '';

  if (catSlug === 'carpets') {
    if (p.durability) specBarsHTML += specBarRow('Durability', p.durability, 5, `${p.durability} / 5`);
    if (p.softness)   specBarsHTML += specBarRow('Softness',   p.softness,   5, `${p.softness} / 5`);
    detailRowsHTML += dtRow('Fibre',  p.fibre);
    detailRowsHTML += dtRow('Style',  p.carpet_style);
    detailRowsHTML += dtRow('Thickness', p.thickness);
    detailRowsHTML += dtRow('Density',   p.density);
  } else if (catSlug === 'vinyl') {
    if (p.durability) specBarsHTML += specBarRow('Durability', p.durability, 5, `${p.durability} / 5`);
    detailRowsHTML += dtRow('Board Thickness', p.thickness_mm ? p.thickness_mm + 'mm' : '');
    detailRowsHTML += dtRow('Wear Layer',       p.wear_layer_mm ? p.wear_layer_mm + 'mm' : '');
    detailRowsHTML += dtRow('Plank Width',      p.plank_width_mm ? p.plank_width_mm + 'mm' : '');
    detailRowsHTML += dtRow('Installation',     p.installation_method);
    detailRowsHTML += dtRow('Lay Pattern',      p.lay_pattern);
    detailRowsHTML += dtRow('Underfloor Heating', p.ufh_compatible ? 'Compatible' : '');
  } else if (catSlug === 'laminate') {
    if (p.durability) specBarsHTML += specBarRow('Durability', p.durability, 5, `${p.durability} / 5`);
    detailRowsHTML += dtRow('Board Thickness', p.thickness_mm ? p.thickness_mm + 'mm' : '');
    detailRowsHTML += dtRow('AC Rating',       p.ac_rating);
    detailRowsHTML += dtRow('Board Design',    p.board_design);
    detailRowsHTML += dtRow('Plank Width',     p.plank_width_mm ? p.plank_width_mm + 'mm' : '');
    detailRowsHTML += dtRow('Installation',    p.installation_method);
    detailRowsHTML += dtRow('Underfloor Heating', p.ufh_compatible ? 'Compatible' : '');
  } else {
    if (p.durability) specBarsHTML += specBarRow('Durability', p.durability, 5, `${p.durability} / 5`);
    detailRowsHTML += dtRow('Species & Finish', p.species_finish);
    detailRowsHTML += dtRow('Board Thickness',  p.thickness_mm ? p.thickness_mm + 'mm' : '');
    detailRowsHTML += dtRow('Plank Width',      p.plank_width_mm ? p.plank_width_mm + 'mm' : '');
    detailRowsHTML += dtRow('Surface Finish',   p.surface_finish);
    detailRowsHTML += dtRow('Lay Pattern',      p.lay_pattern);
    detailRowsHTML += dtRow('Installation',     p.installation_method);
    detailRowsHTML += dtRow('Underfloor Heating', p.ufh_compatible ? 'Compatible' : '');
  }

  const specsHTML = (specBarsHTML || detailRowsHTML) ? `
    <div class="page-section reveal">
      <div class="section-eyebrow" style="margin-bottom:16px">
        <div class="section-tag">Performance &amp; Specifications</div>
      </div>
      ${specBarsHTML}
      ${detailRowsHTML ? `<div class="detail-table">${detailRowsHTML}</div>` : ''}
    </div>` : '';

  // ── Colour section ─────────────────────────────────────────────────────────
  const colourSection = colours.length > 1 ? `
    <div class="page-section reveal">
      <div class="section-eyebrow">
        <div class="section-step">${colourStep}</div>
        <div class="section-tag">Choose colour</div>
      </div>
      <div class="section-heading">Selected Finish</div>
      <div class="swatch-grid" id="swatch-grid" role="list" aria-label="Available colours">
        ${coloursHTML}
      </div>
      ${showMoreBtn}
      <div class="swatch-meta">
        <div class="swatch-name" id="swatch-name">${esc(colours[0]?.name || '')}</div>
        <div class="swatch-count">${colours.length} colour${colours.length > 1 ? 's' : ''}</div>
      </div>
    </div>
    <div class="divider"></div>` : '';

  // ── Features section ───────────────────────────────────────────────────────
  const featSection = featuresHTML ? `
    <div class="feat-section reveal">
      <div class="feat-section-label">You&rsquo;ll love it because</div>
      <div class="feat-grid">${featuresHTML}</div>
    </div>
    <div class="divider"></div>` : '';

  // ── Suitable for section ───────────────────────────────────────────────────
  const suitableSection = roomsHTML ? `
    <div class="page-section reveal">
      <div class="section-eyebrow" style="margin-bottom:16px">
        <div class="section-tag">Suitable for</div>
      </div>
      <div class="suitable-grid">${roomsHTML}</div>
    </div>
    <div class="divider"></div>` : '';

  // ── CTA href base (before calc params) ────────────────────────────────────
  const ctaBase = `/?product=${encodeURIComponent(p.name)}&price=${price}&category=${catSlug}#contact`;

  // ═══════════════════════════════════════════════════════════════════════════
  // HTML
  // ═══════════════════════════════════════════════════════════════════════════
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.name)} | ${catLabel} | ${SITE_NAME}</title>
<meta name="description" content="${esc(metaDesc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${pageUrl}">
<!-- Open Graph -->
<meta property="og:type"        content="product">
<meta property="og:url"         content="${pageUrl}">
<meta property="og:title"       content="${esc(p.name)} | ${catLabel} | ${SITE_NAME}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:image"       content="${imgUrl}">
<meta property="og:image:width"  content="800">
<meta property="og:image:height" content="600">
<meta property="og:site_name"   content="${SITE_NAME}">
<meta property="og:locale"      content="en_GB">
<meta property="product:price:amount"   content="${price}">
<meta property="product:price:currency" content="GBP">
<!-- Twitter Card -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${esc(p.name)} | ${SITE_NAME}">
<meta name="twitter:description" content="${esc(metaDesc)}">
<meta name="twitter:image"       content="${imgUrl}">
<!-- JSON-LD -->
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
<!-- Preconnect -->
<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- Fonts & Icons -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link rel="icon" href="/assets/favicon/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/product-page.css">
</head>
<body>

<!-- ═══ SITE HEADER (desktop) ══════════════════════════════════════════════ -->
<header class="site-header">
  <div class="header-inner">
    <a href="/" class="header-logo" aria-label="${SITE_NAME} — Home">
      <img src="/images/logo2.svg" alt="${SITE_NAME}" width="140" height="36" loading="eager">
    </a>
    <div class="header-actions">
      <a href="${PHONE_HREF}" class="btn-phone">
        <i class="fa-solid fa-phone" aria-hidden="true"></i>
        <span>${PHONE}</span>
      </a>
      <a href="/#contact" class="btn-header-primary">Free Quote</a>
    </div>
  </div>
</header>

<!-- ═══ BREADCRUMB (desktop) ═══════════════════════════════════════════════ -->
<nav class="site-breadcrumb" aria-label="Breadcrumb">
  <div class="breadcrumb-inner">
    <a href="/">Home</a>
    <span class="breadcrumb-sep" aria-hidden="true">›</span>
    <a href="/#range">${catLabel}</a>
    <span class="breadcrumb-sep" aria-hidden="true">›</span>
    <span class="breadcrumb-curr" aria-current="page">${esc(p.name)}</span>
  </div>
</nav>

<!-- ═══ HERO (mobile only) ══════════════════════════════════════════════════ -->
<div class="hero" id="hero-bg" style="background-image:url('${imgUrl}')" role="img" aria-label="${esc(p.name)} ${catLabel}">
  <div class="hero-nav">
    <a href="/" class="hero-brand" aria-label="${SITE_NAME} — Home">
      <img src="/images/logo2.svg" alt="${SITE_NAME}" width="120" height="30" loading="eager">
    </a>
    <a href="${PHONE_HREF}" class="hero-phone-btn" aria-label="Call ${PHONE}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.69 12a19.79 19.79 0 01-3.07-8.67A2 2 0 013.63 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 17z"/></svg>
    </a>
  </div>
  <div class="hero-foot">
    ${badgeHTML ? `<div class="hero-badge-wrap">${badgeHTML}</div>` : ''}
    <h1 class="hero-title">${esc(p.name)}</h1>
  </div>
</div>

<!-- ═══ PRODUCT LAYOUT ══════════════════════════════════════════════════════ -->
<div class="product-layout">

  <!-- ── LEFT COLUMN (desktop sticky image) ─────────────────────────────── -->
  <div class="col-image">
    <div class="main-img-frame">
      <img
        id="product-main-img"
        src="${imgUrl}"
        alt="${esc(p.name)} ${catLabel} — ${SITE_NAME}"
        width="800" height="800"
        loading="eager"
        fetchpriority="high"
      >
      ${badgeHTML ? `<div class="img-badge-wrap">${badgeHTML}</div>` : ''}
    </div>
  </div>

  <!-- ── RIGHT COLUMN / CARD BODY ───────────────────────────────────────── -->
  <div class="col-content card-body">

    <!-- Screen-reader only product name (desktop accessibility) -->
    <span class="sr-only">${esc(p.name)}</span>

    <!-- Meta row -->
    <div class="meta-row reveal">
      <span class="cat-tag">${esc(eyebrowLabel)}${infoBtn}</span>
      <div class="meta-actions">
        <button class="btn-like" id="like-btn" data-id="${p.id}" aria-label="Like this product" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span id="like-count">${p.likes || 0}</span>
        </button>
        <button class="btn-share" id="share-btn" aria-label="Share this product" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3" stroke-width="2"/><circle cx="6" cy="12" r="3" stroke-width="2"/><circle cx="18" cy="19" r="3" stroke-width="2"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke-width="2"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke-width="2"/></svg>
        </button>
      </div>
    </div>

    <!-- Desktop product name (aria-hidden: h1 is in hero for mobile/Google) -->
    <div class="desktop-name-wrap" aria-hidden="true">
      <div class="desktop-name">${esc(p.name)}</div>
    </div>

    <!-- Editorial / description -->
    ${p.description ? `<p class="editorial reveal d1">${esc(p.description)}</p>` : ''}

    <!-- Rating row -->
    <div class="rating-row reveal d2">
      <div class="stars" aria-label="5 stars">
        <span class="star" aria-hidden="true">★</span>
        <span class="star" aria-hidden="true">★</span>
        <span class="star" aria-hidden="true">★</span>
        <span class="star" aria-hidden="true">★</span>
        <span class="star" aria-hidden="true">★</span>
      </div>
      <span class="rating-score">4.9</span>
      <span class="rating-count">&middot; Rated Excellent</span>
    </div>

    <div class="divider"></div>

    <!-- Price block -->
    <div class="price-block reveal d3" id="price-anchor">
      <div class="price-line">
        <div class="price-figure"><sup>&pound;</sup>${price}</div>
        <div class="price-per">per m&sup2;</div>
        ${wasPrice ? `<span class="price-was">&pound;${wasPrice}</span>` : ''}
        ${saving   ? `<span class="price-save">Save &pound;${saving}</span>` : ''}
      </div>
      <div class="price-addons">
        Fitting from <strong>&pound;${fitting}&thinsp;/&thinsp;m&sup2;</strong>
        &nbsp;&middot;&nbsp;
        Underlay from <strong>&pound;5.00&thinsp;/&thinsp;m&sup2;</strong>
      </div>

      <!-- Trust strip -->
      <div class="trust-strip">
        <div class="trust-cell">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <div class="trust-name">Free<br>Measure</div>
          <div class="trust-sub">W. Yorkshire</div>
        </div>
        <div class="trust-cell">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7" stroke-width="2.5"/></svg>
          <div class="trust-name">Price<br>Match</div>
          <div class="trust-sub">Best price promise</div>
        </div>
        <div class="trust-cell">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div class="trust-name">Fast<br>Fitting</div>
          <div class="trust-sub">Quick turnaround</div>
        </div>
      </div>

      <!-- Primary CTA -->
      <div class="cta-block">
        <button class="btn-primary" id="get-price-btn" type="button">
          Get Your Price &amp; Quote
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </div>

    <div class="divider"></div>

    ${featSection}

    ${colourSection}

    <!-- ── CONFIGURATOR ───────────────────────────────────────────────────── -->
    <div class="page-section reveal" id="config-section">
      <div class="section-eyebrow">
        <div class="section-step">${configStep}</div>
        <div class="section-tag">Calculate your price</div>
      </div>
      <div class="section-heading">Your Room</div>

      <!-- Presets -->
      <div class="presets" id="presets">
        ${presetsHTML}
      </div>

      <!-- Dimensions -->
      <div class="dim-grid">
        <div>
          <label class="dim-label" for="room-len">Room length (m)</label>
          <input class="dim-input" id="room-len" type="number" inputmode="decimal" placeholder="e.g. 4.5" min="0" step="0.1">
        </div>
        <div>
          <label class="dim-label">Roll width</label>
          <div class="seg-control">
            <button class="seg-btn active" data-width="4" type="button">4 m</button>
            <button class="seg-btn" data-width="5" type="button">5 m</button>
          </div>
        </div>
      </div>
      <p class="dim-helper">Choose the closest roll width to your room. This minimises waste and keeps your total cost down.</p>

      <!-- Service toggles -->
      <div class="service-list">
        <div class="service-row">
          <div class="svc-left">
            <div class="svc-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div>
              <div class="svc-name">Expert Fitting</div>
              <div class="svc-price">+&pound;${fitting} per m&sup2;</div>
            </div>
          </div>
          <label class="toggle" aria-label="Include expert fitting">
            <input type="checkbox" id="svc-fitting" checked>
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </label>
        </div>
        <div class="service-row">
          <div class="svc-left">
            <div class="svc-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="8" width="20" height="12" rx="2"/><path d="M6 8V6a2 2 0 012-2h8a2 2 0 012 2v2"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
            </div>
            <div>
              <div class="svc-name">Premium Underlay</div>
              <div class="svc-price">+&pound;5.00 per m&sup2;</div>
            </div>
          </div>
          <label class="toggle" aria-label="Include premium underlay">
            <input type="checkbox" id="svc-underlay" checked>
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </label>
        </div>
      </div>

      <!-- Estimate card -->
      <div class="estimate-card" id="estimate-card">
        <div class="estimate-card-inner">
          <div class="estimate-top">
            <div>
              <div class="estimate-label">Estimated total</div>
              <div class="estimate-total" id="est-total">&pound;&mdash;</div>
            </div>
            <div class="estimate-breakdown" id="est-breakdown"></div>
          </div>
          <div class="estimate-divider"></div>
          <button class="estimate-cta" id="estimate-cta-btn" data-href="${ctaBase}" type="button">
            Request Full Quote for This Room &rarr;
          </button>
          <button class="estimate-pdf-btn" id="estimate-pdf-btn" type="button" disabled>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download PDF Estimate
          </button>
        </div>
      </div>

      <!-- Nudge card -->
      <a href="${ctaBase}" class="nudge-card">
        <div class="nudge-icon">&#128208;</div>
        <div class="nudge-body">
          <div class="nudge-title">Not sure of your dimensions?</div>
          <div class="nudge-sub">Book a free home measure &mdash; no obligation. West Yorkshire area.</div>
        </div>
        <div class="nudge-arrow">&rarr;</div>
      </a>
    </div>

    <div class="divider"></div>

    ${suitableSection}

    ${specsHTML}

  </div><!-- /col-content -->

</div><!-- /product-layout -->

<!-- ═══ ALSO AVAILABLE ══════════════════════════════════════════════════════ -->
<div id="also-section"
  data-cat="${catSlug}"
  data-slug="${slug}"
  data-label="${catLabel}"
  data-api="https://wyc-backend-production-ed78.up.railway.app">
</div>

<!-- ═══ FOOTER ═══════════════════════════════════════════════════════════════ -->
<footer>
  <div class="footer-logo">
    <svg class="footer-logo-mark" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect width="26" height="26" rx="4" fill="#B83232"/>
      <path d="M6 6L13 13L6 20M13 6L20 13L13 20" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <div class="footer-brand-text">West Yorkshire<br>Carpets</div>
  </div>
  <nav class="footer-links" aria-label="Footer navigation">
    <a class="footer-link" href="/#range">Browse Flooring</a>
    <a class="footer-link" href="/#quote">Price Calculator</a>
    <a class="footer-link" href="/#contact">Free Measure</a>
    <a class="footer-link" href="/#contact">Contact Us</a>
  </nav>
  <div class="footer-rule"></div>
  <div class="footer-legal">
    &copy; 2026 ${SITE_NAME}. All rights reserved.
    <a href="/privacy-policy.html">Privacy Policy</a>
    <a href="/terms.html">Terms</a>
  </div>
</footer>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<div id="product-data" data-price="${price}" data-fitting="${fitting}" aria-hidden="true" style="display:none"></div>
<script src="/js/product-page.js"></script>
</body>
</html>`;
}

// ── Route handler ──────────────────────────────────────────────────────────────
router.get('/:category/:slug', async (req, res) => {
  const { category, slug } = req.params;

  const validCats = ['carpets', 'vinyl', 'laminate', 'wood'];
  if (!validCats.includes(category)) {
    return res.status(404).send('Not found');
  }

  try {
    const result = await pool.query(
      'SELECT * FROM products WHERE category_slug = $1 AND is_active = 1',
      [category]
    );

    const product = result.rows.find(p => toSlug(p.name) === slug);

    if (!product) {
      return res.status(404).send(`
        <!DOCTYPE html><html><head><title>Product Not Found | ${SITE_NAME}</title>
        <meta name="robots" content="noindex"></head>
        <body style="font-family:sans-serif;text-align:center;padding:80px 24px">
        <h1>Product not found</h1>
        <p>This product may have been removed or renamed.</p>
        <a href="/" style="color:#B83232">&larr; Back to homepage</a>
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

// ── Sitemap ────────────────────────────────────────────────────────────────────
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
