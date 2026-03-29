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
  return `<div class="dt-row"><span class="dt-key">${label}</span><span class="dt-val">${value}</span></div>`;
}

function barRow(label, v, max, valLabel) {
  const pct = Math.round((v / max) * 100);
  return `<div class="spec-bar-row">
    <div class="spec-bar-name">${label}</div>
    <div class="spec-bar-track"><div class="spec-bar-fill" style="width:${pct}%"></div></div>
    <div class="spec-bar-val">${valLabel}</div>
  </div>`;
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

  const metaDesc = p.description
    ? `${p.description} Available from £${price}/m². Free measure & quote across West Yorkshire. Call ${PHONE}.`
    : `${p.name} ${catLabel} from West Yorkshire Carpets. From £${price}/m². Free professional fitting available. Call ${PHONE}.`;

  // Feature chips
  const FEAT_DEF = {
    stain:      {icon:'fa-droplet-slash',   label:'Stain Resistant'},
    pet:        {icon:'fa-paw',             label:'Pet Friendly'},
    bleach:     {icon:'fa-spray-can',       label:'Bleach Cleanable'},
    soft:       {icon:'fa-feather',         label:'Ultra Soft'},
    luxury:     {icon:'fa-gem',             label:'Luxury Pile'},
    insulation: {icon:'fa-temperature-low', label:'Warm Underfoot'},
    waterproof: {icon:'fa-shield-halved',   label:'100% Waterproof'},
    scratch:    {icon:'fa-shield',          label:'Scratch Resistant'},
    easyClean:  {icon:'fa-broom',           label:'Easy Clean'},
  };
  const featuresHTML = features.map(f => {
    const d = FEAT_DEF[f]; if (!d) return '';
    return `<div class="feat-chip"><i class="fa-solid ${d.icon}" aria-hidden="true"></i><span>${d.label}</span></div>`;
  }).filter(Boolean).join('');

  // Room chips
  const ROOMS_DEF = [
    {key:'living',   icon:'fa-couch',       label:'Living Room'},
    {key:'bedroom',  icon:'fa-bed',         label:'Bedroom'},
    {key:'kitchen',  icon:'fa-utensils',    label:'Kitchen'},
    {key:'bathroom', icon:'fa-shower',      label:'Bathroom'},
    {key:'hallway',  icon:'fa-door-open',   label:'Hallway'},
    {key:'stairs',   icon:'fa-stairs',      label:'Stairs'},
    {key:'office',   icon:'fa-briefcase',   label:'Office'},
    {key:'dining',   icon:'fa-chair',       label:'Dining Room'},
  ];
  const roomsHTML = ROOMS_DEF.filter(r => rooms.includes(r.key)).map(r =>
    `<div class="suitable-tag"><i class="fa-solid ${r.icon}" aria-hidden="true"></i>${r.label}</div>`
  ).join('');

  // Colour swatches — first 10 visible, rest hidden (JS show-more reveals them)
  const coloursHTML = colours.map((c, i) => {
    const bg      = c.img_url ? `data-bg="${c.img_url}"` : `data-hex="${c.hex || '#999'}"`;
    const hidden  = i >= 10 ? ' swatch--hidden' : '';
    const active  = i === 0 ? ' active' : '';
    return `<div class="swatch${active}${hidden}" title="${c.name}" ${bg} data-name="${c.name}" data-img="${c.img_url || ''}" role="listitem" tabindex="0" aria-label="${c.name}"></div>`;
  }).join('');

  // Step numbers
  const stepColour = colours.length > 1 ? '01' : null;
  const stepCalc   = colours.length > 1 ? '02' : '01';

  // Specs section
  const tMap = {'Extra Short':1,'Short':2,'Medium':3,'Deep':4};
  const dMap = {'Loose':1,'Medium':2,'Compact':3,'Extra Compact':4};
  let specsHTML = '';
  if (catSlug === 'carpets') {
    const tv = tMap[p.thickness] || 0;
    const dv = dMap[p.density]   || 0;
    const bars = [
      barRow('Durability', p.durability||0, 5, (p.durability||0)+'/5'),
      barRow('Softness',   p.softness||0,   5, (p.softness||0)+'/5'),
      tv ? barRow('Pile Height', tv, 4, p.thickness) : '',
      dv ? barRow('Density',     dv, 4, p.density)   : '',
    ].filter(Boolean).join('');
    const rows = [
      p.fibre        ? specRow('Fibre', p.fibre) : '',
      p.carpet_style ? specRow('Style', p.carpet_style) : '',
    ].filter(Boolean).join('');
    specsHTML = `${bars}${rows ? `<div class="detail-table">${rows}</div>` : ''}\`;
  } else if (catSlug === 'vinyl') {
    const bars = barRow('Durability', p.durability||0, 5, (p.durability||0)+'/5');
    const rows = [
      p.thickness_mm        ? specRow('Board Thickness', p.thickness_mm+'mm') : '',
      p.wear_layer_mm       ? specRow('Wear Layer', p.wear_layer_mm+'mm') : '',
      p.plank_width_mm      ? specRow('Plank Width', p.plank_width_mm+'mm') : '',
      p.installation_method ? specRow('Installation', p.installation_method) : '',
      p.lay_pattern         ? specRow('Lay Pattern', p.lay_pattern) : '',
      p.ufh_compatible      ? specRow('Underfloor Heating', 'Compatible') : '',
    ].filter(Boolean).join('');
    specsHTML = `${bars}${rows ? `<div class="detail-table">${rows}</div>` : ''}\`;
  } else if (catSlug === 'laminate') {
    const bars = barRow('Durability', p.durability||0, 5, (p.durability||0)+'/5');
    const rows = [
      p.thickness_mm        ? specRow('Board Thickness', p.thickness_mm+'mm') : '',
      p.ac_rating           ? specRow('AC Rating', p.ac_rating) : '',
      p.board_design        ? specRow('Board Design', p.board_design) : '',
      p.plank_width_mm      ? specRow('Plank Width', p.plank_width_mm+'mm') : '',
      p.installation_method ? specRow('Installation', p.installation_method) : '',
      p.ufh_compatible      ? specRow('Underfloor Heating', 'Compatible') : '',
    ].filter(Boolean).join('');
    specsHTML = `${bars}${rows ? `<div class="detail-table">${rows}</div>` : ''}\`;
  } else {
    const bars = barRow('Durability', p.durability||0, 5, (p.durability||0)+'/5');
    const rows = [
      p.species_finish      ? specRow('Species & Finish', p.species_finish) : '',
      p.thickness_mm        ? specRow('Board Thickness', p.thickness_mm+'mm') : '',
      p.plank_width_mm      ? specRow('Plank Width', p.plank_width_mm+'mm') : '',
      p.surface_finish      ? specRow('Surface Finish', p.surface_finish) : '',
      p.lay_pattern         ? specRow('Lay Pattern', p.lay_pattern) : '',
      p.installation_method ? specRow('Installation', p.installation_method) : '',
      p.ufh_compatible      ? specRow('Underfloor Heating', 'Compatible') : '',
    ].filter(Boolean).join('');
    specsHTML = `${bars}${rows ? `<div class="detail-table">${rows}</div>` : ''}\`;
  }

  // Carpet style tooltip text
  const STYLE_TIPS = {
    'Saxony': 'A dense, cut-pile carpet with an upright, velvety finish. Exceptionally soft underfoot — ideal for bedrooms and living rooms.',
    'Twist': 'Tightly twisted yarn gives a textured, hardwearing surface. Hides footprints well — perfect for hallways and stairs.',
    'Loop Pile': 'Uncut loops create a firm, durable surface. Easy to clean and resilient — great for busy family areas.',
    'Berber': 'Chunky, natural-look loops in earthy tones. Extremely durable with excellent thermal insulation.',
    'Velvet': 'Ultra-smooth, close-cut pile for a luxurious, formal look. The finest finish available in carpet.',
    'Herringbone': 'A classic woven pattern creating a V-shaped zigzag. Timeless, elegant and highly durable.',
  };

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description || `${p.name} ${catLabel} from ${SITE_NAME}`,
    image: imgUrl, url: pageUrl,
    brand: { '@type': 'Brand', name: SITE_NAME },
    category: catLabel,
    offers: {
      '@type': 'Offer', url: pageUrl, priceCurrency: 'GBP',
      price: parseFloat(price),
      priceSpecification: { '@type': 'UnitPriceSpecification', price: parseFloat(price), priceCurrency: 'GBP', referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MTK' } },
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: SITE_NAME, telephone: PHONE },
    },
    ...(colours.length > 0 && { color: colours.map(c => c.name).join(', ') }),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'H  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${p.name} | ${catLabel} | ${SITE_NAME}</title>
<meta name="description" content="${metaDesc.replace(/"/g, '&quot;')}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${pageUrl}">
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
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${p.name} | ${SITE_NAME}">
<meta name="twitter:description" content="${metaDesc.replace(/"/g, '&quot;')}">
<meta name="twitter:image"       content="${imgUrl}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link rel="icon" href="/assets/favicon/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/product-page.css">
</head>
<body>

<!-- Prices for JS — CSP-safe, no inline script needed -->
<div id="product-data"
  data-price="${price}"
  data-fitting="${(parseFloat(p.fitting_price) || 6).toFixed(2)}"
  style="display:none" aria-hidden="true"></div>

<!-- ── DESKTOP HEADER (hidden <768px) ──────────────────────────────────────── -->
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

<!-- ── DESKTOP BREADCRUMB (hidden <768px) ──────────────────────────────────── -->
<nav class="site-breadcrumb" aria-label="Breadcrumb">
  <div class="breadcrumb-inner">
    <a href="/">Home</a>
    <span class="breadcrumb-sep" aria-hidden="true">›</span>
    <a href="/#range">${catLabel}</a>
    <span class="breadcrumb-sep" aria-hidden="true">›</span>
    <span class="breadcrumb-curr" aria-current="page">${p.name}</span>
  </div>
</nav>

<main>

  <!-- ── MOBILE HERO (hidden ≥768px) ─────────────────────────────────────── -->
  <div class="hero" id="hero-bg" style="background-image:url(${imgUrl})">
    <div class="hero-nav">
      <a href="/" class="hero-brand" aria-label="${SITE_NAME} — Home">
        <img src="/images/logo2.svg" alt="${SITE_NAME}" width="110" height="28">
      </a>
      <a href="${PHONE_HREF}" class="hero-phone-btn" aria-label="Call ${PHONE}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 15z"/></svg>
      </a>
    </div>
    <div class="hero-foot">
      ${p.badge && p.badge_type ? `<div class="hero-badge-wrap"><span class="product-badge badge--${p.badge_type}">${p.badge}</span></div>` : ''}
      <div class="hero-eyebrow">
        ${p.carpet_style || catLabel}
        ${p.carpet_style ? `<button class="info-btn" data-tooltip="${(STYLE_TIPS[p.carpet_style] || p.carpet_style + ' — a quality carpet pile style.').replace(/"/g, '&quot;')}" aria-label="About ${p.carpet_style}" type="button"><i class="fa-solid fa-circle-info" aria-hidden="true"></i></button>` : ''}
      </div>
      <h1 class="hero-title">${p.name}</h1>
    </div>
    <button class="hero-img-reset" id="hero-img-reset" aria-label="Reset to original image">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      Reset colour
    </button>
  </div>

  <!-- ── TABLET IMAGE (768px–1023px) ─────────────────────────────────────── -->
  <div class="tablet-img-wrap">
    <div class="tablet-img-frame">
      <img
        id="tablet-main-img"
        src="${imgUrl}"
        data-original="${imgUrl}"
        alt="${p.name} ${catLabel} — ${SITE_NAME}"
        width="800" height="600"
        loading="eager" fetchpriority="high"
      >
      ${p.badge && p.badge_type ? `<div class="img-badge-wrap"><span class="product-badge badge--${p.badge_type}">${p.badge}</span></div>` : ''}
      <button class="img-reset-btn" id="tablet-img-reset" aria-label="Reset image">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Reset
      </button>
    </div>
  </div>

  <!-- ── PRODUCT LAYOUT ───────────────────────────────────────────────────── -->
  <div class="product-layout">

    <!-- ── LEFT COL: sticky image (≥1024px) ─────────────────────────────── -->
    <div class="col-image">
      <div class="main-img-frame">
        <img
          id="product-main-img"
          src="${imgUrl}"
          data-original="${imgUrl}"
          alt="${p.name} ${catLabel} — ${SITE_NAME}"
          width="800" height="800"
          loading="eager" fetchpriority="high"
        >
        ${p.badge && p.badge_type ? `<div class="img-badge-wrap"><span class="product-badge badge--${p.badge_type}">${p.badge}</span></div>` : ''}
        <button class="img-reset-btn" id="desktop-img-reset" aria-label="Reset image">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Reset
        </button>
      </div>
      <div class="trust-strip trust-strip--desktop" aria-label="Trust signals">
        <div class="trust-cell">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <div class="trust-name">Free Measure</div><div class="trust-sub">West Yorkshire</div>
        </div>
        <div class="trust-cell">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7" stroke-width="2.5"/></svg>
          <div class="trust-name">Price Match</div><div class="trust-sub">Best price promise</div>
        </div>
        <div class="trust-cell">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div class="trust-name">Fast Fitting</div><div class="trust-sub">Quick turnaround</div>
        </div>
      </div>
    </div>

    <!-- ── RIGHT COL: card body (mobile lifts over hero) ────────────────── -->
    <div class="col-content">

      <!-- Desktop name (hidden on mobile — hero has h1) -->
      <div class="desktop-name-wrap">
        <div class="desktop-eyebrow">
          <span class="cat-tag">
            ${p.carpet_style || catLabel}
            ${p.carpet_style ? `<button class="info-btn" data-tooltip="${(STYLE_TIPS[p.carpet_style] || p.carpet_style + ' — a quality carpet pile style.').replace(/"/g, '&quot;')}" aria-label="About ${p.carpet_style}" type="button"><i class="fa-solid fa-circle-info" aria-hidden="true"></i></button>` : ''}
          </span>
        </div>
        <div class="desktop-name">${p.name}</div>
      </div>

      <!-- Meta row -->
      <div class="meta-row reveal">
        <div class="meta-category">${catLabel}</div>
        <div class="meta-actions">
          <button class="btn-like" id="like-btn" data-id="${p.id}" aria-label="Like this product">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            <span id="like-count">${p.likes || 0}</span>
          </button>
          <button class="btn-share" id="share-btn" aria-label="Share this product">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </div>

      ${p.description ? `<p class="editorial reveal d1">${p.description}</p>` : ''}

      <div class="rating-row reveal d2">
        <div class="stars" aria-label="5 stars">
          <span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span>
        </div>
        <span class="rating-score">4.9</span>
        <span class="rating-count">· Rated Excellent</span>
        <span class="tp-pill">Trustpilot</span>
      </div>

      <div class="divider"></div>

      <!-- Price block -->
      <div class="price-block reveal d3">
        <div class="price-line">
          <div class="price-figure"><sup>£</sup>${price}</div>
          <div class="price-per">per m²</div>
          ${wasPrice ? `<span class="price-was">£${wasPrice}</span>` : ''}
          ${saving   ? `<span class="price-save">Save £${saving}</span>` : ''}
        </div>
        <div class="price-addons">
          Fitting from <strong>£${(parseFloat(p.fitting_price) || 6).toFixed(2)}/m²</strong>
          &nbsp;·&nbsp; Underlay from <strong>£5.00/m²</strong>
        </div>

        <!-- Trust strip (mobile/tablet only — hidden on desktop) -->
        <div class="trust-strip" aria-label="Trust signals">
          <div class="trust-cell">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            <div class="trust-name">Free<br>Measure</div><div class="trust-sub">W. Yorkshire</div>
          </div>
          <div class="trust-cell">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7" stroke-width="2.5"/></svg>
            <div class="trust-name">Price<br>Match</div><div class="trust-sub">Best price</div>
          </div>
          <div class="trust-cell">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div class="trust-name">Fast<br>Fitting</div><div class="trust-sub">Quick turnaround</div>
          </div>
        </div>

        <div class="cta-block">
          <button class="btn-primary" id="get-price-btn" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Get Your Price &amp; Quote
          </button>
        </div>
      </div>

      <div class="divider"></div>

      ${colours.length > 1 ? `
      <!-- ── COLOUR ─────────────────────────────────────────────────────── -->
      <div class="page-section reveal">
        <div class="section-eyebrow">
          <span class="section-step">${stepColour}</span>
          <span class="section-tag">Choose colour</span>
        </div>
        <div class="section-heading">Selected Finish</div>
        <div class="swatch-strip" id="swatch-strip" role="list" aria-label="Available colours">
          ${coloursHTML}
        </div>
        <div class="swatch-footer">
          <span class="swatch-name" id="swatch-name">${colours[0]?.name || ''}</span>
          ${colours.length > 10 ? `<button class="swatch-toggle-link" id="swatch-show-more" type="button">Show more colours</button>` : ''}
        </div>
      </div>
      <div class="divider"></div>
      ` : ''}

      <!-- ── CONFIGURATOR ──────────────────────────────────────────────── -->
      <div class="page-section reveal" id="config-section">
        <div class="section-eyebrow">
          <span class="section-step">${stepCalc}</span>
          <span class="section-tag">Calculate your price</span>
        </div>
        <div class="section-heading">Your Room</div>

        <div class="presets" role="group" aria-label="Room size presets">
          <button class="preset-chip" data-len="3.0" type="button">Single bedroom</button>
          <button class="preset-chip" data-len="3.5" type="button">Double bedroom</button>
          <button class="preset-chip" data-len="4.2" type="button">Master bedroom</button>
          <button class="preset-chip" data-len="5.5" type="button">Living room</button>
        </div>

        <div class="dim-grid">
          <div>
            <label class="dim-label" for="room-len">Room length (m)</label>
            <input type="number" class="dim-input" id="room-len"
              min="0" step="0.1" placeholder="e.g. 4.5"
              autocomplete="off" inputmode="decimal">
          </div>
          <div>
            <label class="dim-label">Roll width</label>
            <div class="seg-control">
              <button class="seg-btn active" data-width="4" type="button">4 m</button>
              <button class="seg-btn" data-width="5" type="button">5 m</button>
            </div>
          </div>
        </div>
        <p class="dim-helper">Standard carpet roll widths. Choose the closest to your room width — this minimises waste and reduces your final cost.</p>

        <div class="service-list">
          <div class="service-row">
            <div class="svc-left">
              <div class="svc-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
              </div>
              <div>
                <div class="svc-name">Expert Fitting</div>
                <div class="svc-price">+£${(parseFloat(p.fitting_price) || 6).toFixed(2)} per m²</div>
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="8" width="20" height="12" rx="2"/><path d="M6 8V6a2 2 0 012-2h8a2 2 0 012 2v2"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
              </div>
              <div>
                <div class="svc-name">Premium Underlay</div>
                <div class="svc-price">+£5.00 per m²</div>
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
        <div class="estimate-card" id="estimate-card" aria-live="polite">
          <div class="estimate-card-inner">
            <div class="estimate-top">
              <div>
                <div class="estimate-label">Estimated total</div>
                <div class="estimate-total" id="est-total">£—</div>
              </div>
              <div class="estimate-breakdown" id="est-breakdown"></div>
            </div>
            <div class="estimate-divider"></div>
            <button class="estimate-cta" id="estimate-cta-btn" type="button">
              Request Full Quote for This Room →
            </button>
            <button class="estimate-pdf-btn" id="estimate-pdf-btn" type="button" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download PDF Quote
            </button>
          </div>
        </div>

        <a href="/#contact" class="nudge-card">
          <div class="nudge-icon">📐</div>
          <div class="nudge-body">
            <div class="nudge-title">Not sure of your dimensions?</div>
            <div class="nudge-sub">Book a free home measure — no obligation. West Yorkshire area.</div>
          </div>
          <div class="nudge-arrow">→</div>
        </a>
      </div>

      ${roomsHTML ? `
      <div class="divider"></div>
      <div class="page-section reveal">
        <div class="section-eyebrow" style="margin-bottom:16px">
          <span class="section-tag">Suitable for</span>
        </div>
        <div class="suitable-grid" aria-label="Suitable rooms">${roomsHTML}</div>
      </div>
      ` : ''}

      ${featuresHTML ? `
      <div class="divider"></div>
      <div class="page-section reveal">
        <div class="section-eyebrow" style="margin-bottom:16px">
          <span class="section-tag">You'll love it because</span>
        </div>
        <div class="feat-grid" aria-label="Product features">${featuresHTML}</div>
      </div>
      ` : ''}

      ${specsHTML ? `
      <div class="divider"></div>
      <div class="page-section reveal">
        <div class="section-eyebrow" style="margin-bottom:16px">
          <span class="section-tag">Performance &amp; Specifications</span>
        </div>
        ${specsHTML}
      </div>
      ` : ''}

      <!-- Also available — populated by JS -->
      <div id="also-section"
        data-cat="${catSlug}"
        data-slug="${slug}"
        data-label="${catLabel}"
        data-api="https://wyc-backend-production-ed78.up.railway.app">
      </div>

    </div><!-- /col-content -->
  </div><!-- /product-layout -->

</main>

<!-- ── FOOTER ──────────────────────────────────────────────────────────────── -->
<footer>
  <div class="footer-logo">
    <svg class="footer-logo-mark" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect width="26" height="26" rx="4" fill="#B83232"/>
      <path d="M6 6L13 13L6 20M13 6L20 13L13 20" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <div class="footer-brand-text">West Yorkshire<br>Carpets</div>
  </div>
  <nav class="footer-links" aria-label="Footer navigation">
    <a href="/#range"   class="footer-link">Browse Flooring</a>
    <a href="/#quote"   class="footer-link">Price Calculator</a>
    <a href="/#contact" class="footer-link">Free Measure</a>
    <a href="/#contact" class="footer-link">Contact Us</a>
  </nav>
  <div class="footer-rule"></div>
  <div class="footer-legal">
    &copy; 2026 ${SITE_NAME}. All rights reserved.
    <a href="/privacy-policy.html">Privacy Policy</a>
    <a href="/terms.html">Terms</a>
  </div>
</footer>

<!-- ── FLOATING ACTION BAR ─────────────────────────────────────────────────── -->
<div id="fab" data-price="${price}" data-fitting="${(parseFloat(p.fitting_price) || 6).toFixed(2)}" aria-live="polite">

  <div class="fab-zone-a">
    <div class="fab-swatch-thumb" id="fab-swatch-thumb"></div>
    <div>
      <div class="fab-price" id="fab-price">&pound;0.00</div>
      <div class="fab-price-sub" id="fab-price-sub">Enter dimensions</div>
    </div>
  </div>

  <div class="fab-hover-wrapper">
    <div class="fab-glass-panel" role="tooltip" aria-label="Quote breakdown">
      <h4 class="fab-panel-title">Quotation Details</h4>
      <div class="fab-panel-row" id="fab-r-flooring">
        <span id="fab-r-flooring-label">Carpet</span>
        <span id="fab-r-flooring-price">&mdash;</span>
      </div>
      <div class="fab-panel-row fab-panel-row--hidden" id="fab-r-underlay">
        <span>Underlay</span>
        <span id="fab-r-underlay-price">&mdash;</span>
      </div>
      <div class="fab-panel-row fab-panel-row--hidden" id="fab-r-fitting">
        <span>Fitting</span>
        <span id="fab-r-fitting-price">&mdash;</span>
      </div>
      <div class="fab-panel-row fab-panel-total">
        <span>Total inc. VAT</span>
        <span id="fab-r-total">&mdash;</span>
      </div>
    </div>
    <button class="fab-circle-btn" id="fab-pdf-btn" type="button" aria-label="Download PDF quote" disabled>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </button>
  </div>

  <div class="fab-hover-wrapper">
    <div class="fab-glass-panel fab-glass-panel--concierge" role="tooltip" aria-label="Contact options">
      <h4 class="fab-panel-title">Get Help</h4>
      <a href="${PHONE_HREF}" class="fab-concierge-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.63 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 15z"/></svg>
        <span>${PHONE}</span>
      </a>
      <a href="https://wa.me/447449188303?text=Hi%2C+I%27m+interested+in+${encodeURIComponent(p.name)}+flooring" target="_blank" rel="noopener noreferrer" class="fab-concierge-item fab-concierge-item--wa">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M3 21l1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
        <span>WhatsApp Expert</span>
      </a>
    </div>
    <button class="fab-circle-btn" type="button" aria-label="Contact options">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
    </button>
  </div>

  <a href="/?product=${encodeURIComponent(p.name)}&price=${price}&category=${catSlug}#contact"
     class="fab-btn-main" id="fab-measure">
    Book Free Measure
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
  </a>

  <div class="fab-mobile-bar" id="fab-mobile-bar">
    <div class="fab-grabber" id="fab-grabber"><span class="fab-grabber-line"></span></div>
    <div class="fab-mobile-main">
      <div class="fab-zone-a">
        <div class="fab-swatch-thumb-sm" id="fab-swatch-thumb-sm"></div>
        <div>
          <div class="fab-price" id="fab-price-mobile">&pound;0.00</div>
          <div class="fab-price-sub" id="fab-price-sub-mobile">Enter dimensions</div>
        </div>
      </div>
      <a href="/?product=${encodeURIComponent(p.name)}&price=${price}&category=${catSlug}#contact"
         class="fab-btn-main" id="fab-measure-mobile">Book Free Measure</a>
    </div>
    <div class="fab-drawer" id="fab-drawer">
      <div class="fab-drawer-inner">
        <h4 class="fab-panel-title">Quotation Details</h4>
        <div class="fab-panel-row" id="fab-rm-flooring">
          <span id="fab-rm-flooring-label">Carpet</span>
          <span id="fab-rm-flooring-price">&mdash;</span>
        </div>
        <div class="fab-panel-row fab-panel-row--hidden" id="fab-rm-underlay">
          <span>Underlay</span>
          <span id="fab-rm-underlay-price">&mdash;</span>
        </div>
        <div class="fab-panel-row fab-panel-row--hidden" id="fab-rm-fitting">
          <span>Fitting</span>
          <span id="fab-rm-fitting-price">&mdash;</span>
        </div>
        <div class="fab-panel-row fab-panel-total">
          <span>Total inc. VAT</span>
          <span id="fab-rm-total">&mdash;</span>
        </div>
        <button class="fab-drawer-pdf-btn" id="fab-pdf-btn-drawer" type="button" aria-label="Download PDF quote" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download PDF Quote
        </button>
      </div>
    </div>
  </div>

</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="/js/product-page.js"></script>

</body>
</html>      </div>
    </div>
  </div>

</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
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
