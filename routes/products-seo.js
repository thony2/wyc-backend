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
      ? `style="background-image:url('${c.img_url}');background-size:cover"`
      : `style="background:${c.hex || '#999'}"`;
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
<link rel="preload" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap"></noscript>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<link rel="icon" href="/assets/favicon/favicon.svg" type="image/svg+xml">

<style>
/* ── Reset & base ──────────────────────────────────────────────────────── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --red:#E03040;--navy:#1B3A5C;--gold:#C49A3C;
  --ink:#1A1714;--ink2:#5C574F;--ink3:#9C9589;
  --bg:#F8F6F1;--surface:#F2EFE8;--white:#FFFFFF;--border:#E8E3D9;
  --success:#27AE60;--radius:12px;
}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--ink);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img{max-width:100%;height:auto;display:block}

/* ── Header ─────────────────────────────────────────────────────────────── */
.site-header{position:sticky;top:0;z-index:100;background:var(--white);border-bottom:1px solid var(--border);padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.header-logo img{height:36px;width:auto}
.header-actions{display:flex;align-items:center;gap:12px}
.btn-phone{display:flex;align-items:center;gap:7px;color:var(--ink2);font-size:.875rem;font-weight:500;padding:8px 14px;border:1px solid var(--border);border-radius:8px;transition:all .15s}
.btn-phone:hover{border-color:var(--navy);color:var(--navy)}
.btn-primary{background:var(--red);color:#fff;padding:10px 20px;border-radius:8px;font-size:.875rem;font-weight:600;transition:background .15s}
.btn-primary:hover{background:#B8202F}
.btn-back{display:inline-flex;align-items:center;gap:7px;color:var(--ink3);font-size:.85rem;padding:8px 0;transition:color .15s}
.btn-back:hover{color:var(--ink)}
.btn-back i{font-size:.75rem}

/* ── Breadcrumb ──────────────────────────────────────────────────────────── */
.breadcrumb{background:var(--white);border-bottom:1px solid var(--border);padding:12px 24px}
.breadcrumb-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--ink3)}
.breadcrumb a{color:var(--ink3);transition:color .15s}
.breadcrumb a:hover{color:var(--navy)}
.breadcrumb-sep{opacity:.5}
.breadcrumb-current{color:var(--ink);font-weight:500}

/* ── Main layout ─────────────────────────────────────────────────────────── */
.product-page{max-width:1200px;margin:0 auto;padding:40px 24px 80px}
.product-grid{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:start}
@media(max-width:900px){.product-grid{grid-template-columns:1fr;gap:32px}}

/* ── Image column ────────────────────────────────────────────────────────── */
.product-img-wrap{position:sticky;top:80px}
.product-main-img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--radius);background:var(--surface)}
.product-swatches{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.swatch{width:44px;height:44px;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:all .15s;flex-shrink:0}
.swatch:hover{transform:scale(1.08)}
.swatch.active{border-color:var(--navy);box-shadow:0 0 0 2px rgba(27,58,92,.2)}
.swatch-label{font-size:.8rem;color:var(--ink3);margin-top:8px}

/* ── Detail column ───────────────────────────────────────────────────────── */
.product-cat-label{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--red);margin-bottom:8px}
.product-name{font-family:'Cormorant Garamond',serif;font-size:2.6rem;font-weight:600;color:var(--ink);line-height:1.1;margin-bottom:16px}
@media(max-width:600px){.product-name{font-size:2rem}}
.product-price-row{display:flex;align-items:baseline;gap:10px;margin-bottom:8px;flex-wrap:wrap}
.product-price{font-size:2rem;font-weight:700;color:var(--navy)}
.product-price small{font-size:1rem;font-weight:400;color:var(--ink3)}
.product-was{font-size:1.1rem;color:var(--ink3);text-decoration:line-through}
.product-save{background:rgba(224,48,64,.1);color:var(--red);font-size:.8rem;font-weight:700;padding:3px 10px;border-radius:20px}
.product-fitting{font-size:.875rem;color:var(--ink3);margin-bottom:20px}
.product-fitting strong{color:var(--ink2)}
.product-desc{font-size:.975rem;color:var(--ink2);line-height:1.75;margin-bottom:24px}

/* ── Features ────────────────────────────────────────────────────────────── */
.feat-grid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.feat-chip{display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface);border:1px solid var(--border);border-radius:20px;font-size:.8rem;color:var(--ink2);font-weight:500}
.feat-chip i{color:var(--red);font-size:.75rem}

/* ── Rooms ───────────────────────────────────────────────────────────────── */
.rooms-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:24px}
.room-chip{padding:5px 12px;background:var(--white);border:1px solid var(--border);border-radius:20px;font-size:.8rem;color:var(--ink2)}

/* ── Specs ───────────────────────────────────────────────────────────────── */
.specs-title{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--ink3);margin-bottom:12px}
.spec-group{background:var(--white);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:24px}
.spec-row{display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid var(--border);font-size:.875rem}
.spec-row:last-child{border-bottom:none}
.spec-label{color:var(--ink3);font-weight:500}
.spec-value{color:var(--ink);font-weight:600;text-align:right}
.rating-stars{display:inline-flex;gap:2px}
.star{color:var(--border);font-size:1rem}
.star--on{color:var(--gold)}

/* ── CTA ─────────────────────────────────────────────────────────────────── */
.cta-block{background:linear-gradient(135deg, var(--navy) 0%, #142C47 100%);border-radius:var(--radius);padding:28px 24px;margin-bottom:24px}
.cta-title{font-family:'Cormorant Garamond',serif;font-size:1.4rem;font-weight:600;color:#fff;margin-bottom:6px}
.cta-sub{font-size:.875rem;color:rgba(255,255,255,.65);margin-bottom:20px;line-height:1.5}
.cta-buttons{display:flex;flex-direction:column;gap:10px}
.btn-cta-primary{background:var(--red);color:#fff;padding:14px 20px;border-radius:8px;font-size:.95rem;font-weight:600;text-align:center;transition:background .15s;display:block}
.btn-cta-primary:hover{background:#B8202F}
.btn-cta-secondary{background:rgba(255,255,255,.1);color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.2);padding:12px 20px;border-radius:8px;font-size:.875rem;font-weight:500;text-align:center;transition:all .15s;display:block}
.btn-cta-secondary:hover{background:rgba(255,255,255,.18);color:#fff}
.cta-note{font-size:.78rem;color:rgba(255,255,255,.45);margin-top:12px;text-align:center}

/* ── Also available ──────────────────────────────────────────────────────── */
.also-section{margin-top:64px;padding-top:40px;border-top:1px solid var(--border)}
.also-title{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:600;color:var(--ink);margin-bottom:24px}
.also-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.also-card{background:var(--white);border:1px solid var(--border);border-radius:10px;overflow:hidden;transition:box-shadow .2s,transform .2s;display:block}
.also-card:hover{box-shadow:0 8px 24px rgba(27,58,92,.1);transform:translateY(-2px)}
.also-card-img{aspect-ratio:4/3;overflow:hidden;background:var(--surface)}
.also-card-img img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.also-card:hover .also-card-img img{transform:scale(1.04)}
.also-card-body{padding:12px 14px}
.also-card-name{font-size:.9rem;font-weight:600;color:var(--ink);margin-bottom:4px}
.also-card-price{font-size:.85rem;color:var(--red);font-weight:700}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.site-footer{background:var(--navy);color:rgba(255,255,255,.6);padding:40px 24px 24px;margin-top:80px}
.footer-inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:24px}
.footer-logo img{height:32px;opacity:.85}
.footer-links{display:flex;gap:20px;flex-wrap:wrap}
.footer-links a{font-size:.85rem;color:rgba(255,255,255,.5);transition:color .15s}
.footer-links a:hover{color:#fff}
.footer-bottom{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);font-size:.8rem}
.footer-legal a{color:rgba(255,255,255,.4);margin-left:16px;transition:color .15s}
.footer-legal a:hover{color:rgba(255,255,255,.8)}

/* ── Badge ───────────────────────────────────────────────────────────────── */
.product-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px}
.badge--new{background:#27AE60;color:#fff}
.badge--sale{background:var(--red);color:#fff}
.badge--seller{background:var(--navy);color:#fff}
.badge--premium{background:#5b21b6;color:#fff}

@media(max-width:600px){
  .product-page{padding:24px 16px 60px}
  .site-header{padding:0 16px}
  .breadcrumb{padding:10px 16px}
  .header-actions .btn-phone span{display:none}
}
</style>
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
          <a href="/${PHONE_HREF}" class="btn-cta-primary"><i class="fa-solid fa-phone" aria-hidden="true"></i> Call ${PHONE}</a>
          <a href="https://wa.me/447449188303?text=Hi%2C+I%27m+interested+in+${encodeURIComponent(p.name)}+flooring" target="_blank" rel="noopener noreferrer" class="btn-cta-secondary"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp Us</a>
          <a href="/#contact" class="btn-cta-secondary"><i class="fa-solid fa-calendar-check" aria-hidden="true"></i> Book Free Measure Online</a>
        </div>
        <p class="cta-note">We respond within 24 hours. No spam, no pressure.</p>
      </div>

      <!-- Specs -->
      ${specsHTML ? `<div class="specs-title">Specifications</div>${specsHTML}` : ''}

    </div>
  </div>

  <!-- Also in this range placeholder — populated via JS -->
  <div id="also-section"></div>
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

<script>
// ── Swatch interaction ────────────────────────────────────────────────────
(function() {
  var swatches = document.querySelectorAll('.swatch');
  var mainImg  = document.getElementById('product-main-img');
  var label    = document.getElementById('swatch-label');
  swatches.forEach(function(sw) {
    sw.addEventListener('click', function() {
      swatches.forEach(function(s) { s.classList.remove('active'); });
      sw.classList.add('active');
      var img = sw.dataset.img;
      var name = sw.dataset.name;
      if (img && mainImg) {
        mainImg.style.opacity = '0';
        setTimeout(function() {
          mainImg.src = img;
          mainImg.alt = name;
          mainImg.style.opacity = '1';
        }, 120);
      }
      if (label) label.textContent = name;
    });
  });
  if (mainImg) mainImg.style.transition = 'opacity 0.12s ease';
})();

// ── Load "also available" products from same category ─────────────────────
(function() {
  var cat  = '${catSlug}';
  var slug = '${slug}';
  fetch('https://wyc-backend-production-ed78.up.railway.app/api/products?category=' + cat)
    .then(function(r) { return r.json(); })
    .then(function(products) {
      var others = products.filter(function(p) {
        return p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') !== slug && p.is_active;
      }).slice(0, 4);
      if (others.length === 0) return;
      var html = '<div class="also-section"><h2 class="also-title">More ${catLabel}</h2><div class="also-grid">';
      others.forEach(function(p) {
        var pSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        var img   = p.img_url || '';
        var price = parseFloat(p.price).toFixed(2);
        html += '<a class="also-card" href="/flooring/' + cat + '/' + pSlug + '">'
          + '<div class="also-card-img"><img src="' + img + '" alt="' + p.name + '" loading="lazy" width="400" height="300"></div>'
          + '<div class="also-card-body"><div class="also-card-name">' + p.name + '</div>'
          + '<div class="also-card-price">From £' + price + '/m²</div></div></a>';
      });
      html += '</div></div>';
      document.getElementById('also-section').innerHTML = html;
    })
    .catch(function() {});
})();
</script>

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
