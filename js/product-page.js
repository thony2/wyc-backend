(function () {
  'use strict';

  // ── Swatch backgrounds — set via JS to avoid CSP inline-style block ───────
  document.querySelectorAll('.swatch').forEach(function (sw) {
    if (sw.dataset.bg) {
      sw.style.backgroundImage    = 'url(' + sw.dataset.bg + ')';
      sw.style.backgroundSize     = 'cover';
      sw.style.backgroundPosition = 'center';
    } else if (sw.dataset.hex) {
      sw.style.backgroundColor = sw.dataset.hex;
    }
  });

  // ── Swatch interaction ────────────────────────────────────────────────────
  var swatches = document.querySelectorAll('.swatch');
  var mainImg  = document.getElementById('product-main-img');
  var label    = document.getElementById('swatch-label');

  if (mainImg) mainImg.style.transition = 'opacity 0.12s ease';

  swatches.forEach(function (sw) {
    sw.addEventListener('click', function () {
      swatches.forEach(function (s) { s.classList.remove('active'); });
      sw.classList.add('active');
      var img  = sw.dataset.img;
      var name = sw.dataset.name;
      if (img && mainImg) {
        mainImg.style.opacity = '0';
        setTimeout(function () {
          mainImg.src = img;
          mainImg.alt = name;
          mainImg.style.opacity = '1';
        }, 120);
      }
      if (label) label.textContent = name;
    });
  });

  // ── Also available ────────────────────────────────────────────────────────
  var alsoSection = document.getElementById('also-section');
  if (!alsoSection) return;

  var cat      = alsoSection.dataset.cat;
  var slug     = alsoSection.dataset.slug;
  var catLabel = alsoSection.dataset.label;
  var apiBase  = alsoSection.dataset.api;

  if (!cat || !apiBase) return;

  fetch(apiBase + '/api/products?category=' + cat)
    .then(function (r) { return r.json(); })
    .then(function (products) {
      var others = products.filter(function (p) {
        return p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') !== slug && p.is_active;
      }).slice(0, 4);

      if (others.length === 0) return;

      var html = '<div class="also-section"><h2 class="also-title">More ' + catLabel + '</h2><div class="also-grid">';
      others.forEach(function (p) {
        var pSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        var img   = p.img_url || '';
        var price = parseFloat(p.price).toFixed(2);
        html += '<a class="also-card" href="/flooring/' + cat + '/' + pSlug + '">'
          + '<div class="also-card-img"><img src="' + img + '" alt="' + p.name + '" loading="lazy" width="400" height="300"></div>'
          + '<div class="also-card-body">'
          + '<div class="also-card-name">' + p.name + '</div>'
          + '<div class="also-card-price">From \u00a3' + price + '/m\u00b2</div>'
          + '</div></a>';
      });
      html += '</div></div>';
      alsoSection.innerHTML = html;
    })
    .catch(function () {});
})();

// ── Product page calculator ───────────────────────────────────────────────
(function () {
  var calc = document.getElementById('pp-calc');
  if (!calc) return;

  var PRICE   = parseFloat(calc.dataset.price)   || 0;
  var FITTING = parseFloat(calc.dataset.fitting)  || 6;
  var width   = 4;

  function getArea() {
    var mode = document.querySelector('.pp-mode-btn.active');
    if (!mode) return 0;
    if (mode.dataset.mode === 'dims') {
      var l = parseFloat(document.getElementById('pp-length').value) || 0;
      return parseFloat((l * width).toFixed(2));
    } else {
      return Math.max(0, parseFloat(document.getElementById('pp-area-input').value) || 0);
    }
  }

  function fmt(v) { return v > 0 ? '£' + v.toFixed(2) : '—'; }
  function el(id) { return document.getElementById(id); }

  function calc_update() {
    var area     = getArea();
    var underlay = el('pp-underlay').checked ? area * 5        : 0;
    var fitting  = el('pp-fitting').checked  ? area * FITTING  : 0;
    var flooring = area * PRICE;
    var total    = flooring + underlay + fitting;

    el('pp-area-out').textContent = area ? area + ' m²' : '0 m²';
    el('pp-total').textContent    = area > 0 ? '£' + total.toFixed(2) : '£0.00';
    el('pp-floor-out').textContent = area > 0 ? '£' + flooring.toFixed(2) : '—';
    el('pp-und-out').textContent   = fmt(underlay);
    el('pp-fit-out').textContent   = fmt(fitting);

    var cta = el('pp-cta');
    if (cta) {
      if (area > 0) {
        cta.style.opacity = '1';
        cta.style.pointerEvents = 'auto';
      } else {
        cta.style.opacity = '0.5';
        cta.style.pointerEvents = 'none';
      }
    }
  }

  // Mode toggle
  document.querySelectorAll('.pp-mode-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.pp-mode-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var dims = el('pp-dims-panel');
      var area = el('pp-area-panel');
      if (dims) dims.classList.toggle('pp-panel-hidden', btn.dataset.mode !== 'dims');
      if (area) area.classList.toggle('pp-panel-hidden', btn.dataset.mode !== 'area');
      calc_update();
    });
  });

  // Width buttons
  document.querySelectorAll('.pp-width-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.pp-width-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      width = parseFloat(btn.dataset.width);
      calc_update();
    });
  });

  // Inputs
  ['pp-length', 'pp-area-input'].forEach(function(id) {
    var input = el(id);
    if (input) input.addEventListener('input', calc_update);
  });
  ['pp-underlay', 'pp-fitting'].forEach(function(id) {
    var input = el(id);
    if (input) input.addEventListener('change', calc_update);
  });

  calc_update();
})();

// ── Sticky bottom bar ─────────────────────────────────────────────────────
(function () {
  var calc     = document.getElementById('pp-calc');
  var ctaBlock = document.querySelector('.cta-block');
  var h1       = document.querySelector('.product-name');
  var img      = document.getElementById('product-main-img');
  if (!calc || !h1 || !img) return;

  var PRICE = parseFloat(calc.dataset.price) || 0;

  // Read links from existing page buttons
  var phoneHref   = (document.querySelector('a.btn-phone') || {}).href || 'tel:07449188303';
  var waHref      = (document.querySelector('a[href*="wa.me"]') || {}).href || 'https://wa.me/447449188303';
  var measureHref = (document.querySelector('a.pp-calc-cta') || {}).href || '/#contact';

  // Build bar DOM
  var bar = document.createElement('div');
  bar.id = 'sticky-bar';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML =
    '<div class="sb-inner">' +
      '<div class="sb-product">' +
        '<div class="sb-name">' + h1.textContent.trim() + '</div>' +
        '<div class="sb-price">\u00a3' + PRICE.toFixed(2) + '<span>/m\u00b2</span></div>' +
      '</div>' +
      '<div class="sb-actions">' +
        '<a href="' + phoneHref + '" class="sb-btn sb-btn--phone">' +
          '<i class="fa-solid fa-phone" aria-hidden="true"></i>' +
          '<span>07449 188 303</span>' +
        '</a>' +
        '<a href="' + waHref + '" class="sb-btn sb-btn--wa" target="_blank" rel="noopener noreferrer">' +
          '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i>' +
          '<span>WhatsApp</span>' +
        '</a>' +
        '<a href="' + measureHref + '" class="sb-btn sb-btn--measure">' +
          '<i class="fa-solid fa-calendar-check" aria-hidden="true"></i>' +
          '<span>Book Free Measure</span>' +
        '</a>' +
      '</div>' +
    '</div>';
  document.body.appendChild(bar);

  var visible = false;

  function update() {
    var imgRect = img.getBoundingClientRect();
    var ctaRect = ctaBlock ? ctaBlock.getBoundingClientRect() : null;
    var ctaInView = ctaRect &&
      ctaRect.top < window.innerHeight * 0.85 &&
      ctaRect.bottom > 0;
    var shouldShow = imgRect.bottom < 0 && !ctaInView;
    if (shouldShow === visible) return;
    visible = shouldShow;
    bar.classList.toggle('sb--visible', visible);
    bar.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();
