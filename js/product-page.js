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
