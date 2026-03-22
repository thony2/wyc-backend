(function () {
  'use strict';

  // ── Data from FAB ─────────────────────────────────────────────────────────
  var fab     = document.getElementById('fab');
  var PRICE   = fab ? (parseFloat(fab.dataset.price)   || 0) : 0;
  var FITTING = fab ? (parseFloat(fab.dataset.fitting)  || 6) : 6;
  var width   = 4;

  // ── Swatch backgrounds — CSP safe ────────────────────────────────────────
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
  var mainImg         = document.getElementById('product-main-img');
  var swatchNameEl    = document.getElementById('swatch-name');
  var stepSwatchNameEl= document.getElementById('step-swatch-name');
  var allSwatches     = document.querySelectorAll('.swatch');

  if (mainImg) mainImg.style.transition = 'opacity 0.12s ease';

  allSwatches.forEach(function (sw) {
    sw.addEventListener('click', function () {
      // Sync all swatches with matching name
      allSwatches.forEach(function (s) {
        s.classList.toggle('active', s.dataset.name === sw.dataset.name);
      });
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
      if (swatchNameEl)     swatchNameEl.textContent     = name;
      if (stepSwatchNameEl) stepSwatchNameEl.textContent = name;
    });
  });

  // ── Width buttons ─────────────────────────────────────────────────────────
  document.querySelectorAll('.dim-w-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.dim-w-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      width = parseFloat(btn.dataset.width);
      updateCalc();
    });
  });

  // ── Length input ──────────────────────────────────────────────────────────
  var lenInput = document.getElementById('fp-length');
  if (lenInput) lenInput.addEventListener('input', updateCalc);

  // ── Addon toggles ─────────────────────────────────────────────────────────
  document.querySelectorAll('.addon-row').forEach(function (row) {
    row.addEventListener('click', function (e) {
      e.preventDefault();
      row.classList.toggle('active');
      var cb = row.querySelector('input.addon-cb');
      if (cb) cb.checked = row.classList.contains('active');
      updateCalc();
    });
  });

  // ── Calculator ────────────────────────────────────────────────────────────
  function getArea() {
    var l = lenInput ? (parseFloat(lenInput.value) || 0) : 0;
    return parseFloat((l * width).toFixed(2));
  }

  function fmtGBP(v) {
    return '\u00a3' + v.toFixed(2);
  }

  function updateCalc() {
    var area      = getArea();
    var underlayRow = document.querySelector('.addon-row[data-type="underlay"]');
    var fittingRow  = document.querySelector('.addon-row[data-type="fitting"]');
    var underlayOn  = underlayRow && underlayRow.classList.contains('active');
    var fittingOn   = fittingRow  && fittingRow.classList.contains('active');
    var underlay    = underlayOn ? area * 5        : 0;
    var fitting     = fittingOn  ? area * FITTING  : 0;
    var flooring    = area * PRICE;
    var total       = flooring + underlay + fitting;

    // Update FAB total
    var fabPriceEl = document.getElementById('fab-price');
    var fabM2El    = document.getElementById('fab-m2');
    var fabBreakEl = document.getElementById('fab-breakdown');

    if (fabPriceEl) {
      fabPriceEl.textContent = area > 0 ? fmtGBP(total) : '\u00a30.00';
    }
    if (fabM2El) {
      fabM2El.textContent = area > 0 ? area + ' m\u00b2' : '';
    }
    if (fabBreakEl) {
      if (area > 0) {
        var parts = ['Flooring ' + fmtGBP(flooring)];
        if (underlay > 0) parts.push('Underlay ' + fmtGBP(underlay));
        if (fitting  > 0) parts.push('Fitting '  + fmtGBP(fitting));
        fabBreakEl.textContent = parts.join('  \u00b7  ');
      } else {
        fabBreakEl.textContent = 'Enter dimensions to calculate';
      }
    }
  }

  // ── FAB visibility ────────────────────────────────────────────────────────
  var fabVisible = false;
  var heroFrame  = document.querySelector('.hero-frame');

  function updateFabVisibility() {
    if (!fab) return;
    var ref = heroFrame || mainImg;
    var shouldShow = ref ? ref.getBoundingClientRect().bottom < 60 : true;
    if (shouldShow === fabVisible) return;
    fabVisible = shouldShow;
    fab.classList.toggle('fab--visible', fabVisible);
  }

  window.addEventListener('scroll', updateFabVisibility, { passive: true });
  window.addEventListener('resize', updateFabVisibility, { passive: true });

  // Always show FAB after 1.5 seconds — mobile users rarely scroll far enough
  setTimeout(function () {
    if (fab) fab.classList.add('fab--visible');
  }, 1500);

  updateCalc();
  updateFabVisibility();

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

      var html = '<div class="also-header">'
        + '<h2 class="also-title">More ' + catLabel + '</h2>'
        + '<a href="/#range" class="also-view-all">View all <i class="fa-solid fa-arrow-right"></i></a>'
        + '</div>'
        + '<div class="also-grid">';

      others.forEach(function (p) {
        var pSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        var img   = p.img_url || '';
        var price = parseFloat(p.price).toFixed(2);
        html += '<a class="also-card" href="/flooring/' + cat + '/' + pSlug + '">'
          + '<div class="also-card-img"><img src="' + img + '" alt="' + p.name
          + '" loading="lazy" width="400" height="300"></div>'
          + '<div class="also-card-body">'
          + '<div class="also-card-name">' + p.name + '</div>'
          + '<div class="also-card-price">From \u00a3' + price + '/m\u00b2</div>'
          + '</div></a>';
      });

      html += '</div>';
      alsoSection.innerHTML = html;
    })
    .catch(function () {});
})();

// ── Like & Share ──────────────────────────────────────────────────────────
(function () {
  var API = 'https://wyc-backend-production-ed78.up.railway.app';

  // Like button
  var likeBtn   = document.getElementById('like-btn');
  var likeCount = document.getElementById('like-count');
  if (likeBtn) {
    var productId = likeBtn.dataset.id;
    var liked = sessionStorage.getItem('liked-' + productId) === '1';
    if (liked) {
      likeBtn.classList.add('liked');
      likeBtn.querySelector('i').className = 'fa-solid fa-heart';
    }
    likeBtn.addEventListener('click', function () {
      liked = !liked;
      likeBtn.classList.toggle('liked', liked);
      likeBtn.querySelector('i').className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      likeBtn.style.transform = 'scale(1.2)';
      setTimeout(function () { likeBtn.style.transform = ''; }, 200);
      if (liked) {
        sessionStorage.setItem('liked-' + productId, '1');
        fetch(API + '/api/products/' + productId + '/like', {method:'POST'})
          .then(function (r) { return r.json(); })
          .then(function (d) { if (likeCount && d.likes !== undefined) likeCount.textContent = d.likes; })
          .catch(function () {});
      } else {
        sessionStorage.removeItem('liked-' + productId);
        if (likeCount) likeCount.textContent = Math.max(0, parseInt(likeCount.textContent) - 1);
      }
    });
  }

  // Share button
  var shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({
          title: document.title,
          url: window.location.href
        }).catch(function () {});
      } else {
        navigator.clipboard.writeText(window.location.href).then(function () {
          shareBtn.querySelector('i').className = 'fa-solid fa-check';
          setTimeout(function () {
            shareBtn.querySelector('i').className = 'fa-solid fa-share-nodes';
          }, 1500);
        }).catch(function () {});
      }
    });
  }
})();

// ── Info tooltip modal ────────────────────────────────────────────────────
(function(){
  // Create modal DOM once
  var modal = document.createElement('div');
  modal.className = 'tooltip-modal';
  modal.innerHTML =
    '<div class="tooltip-box">' +
      '<button class="tooltip-close" id="tooltip-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
      '<div class="tooltip-box-title" id="tooltip-title"></div>' +
      '<div class="tooltip-box-text" id="tooltip-text"></div>' +
    '</div>';
  document.body.appendChild(modal);

  var titleEl = document.getElementById('tooltip-title');
  var textEl  = document.getElementById('tooltip-text');
  var closeBtn = document.getElementById('tooltip-close');

  function openModal(title, text) {
    titleEl.textContent = title;
    textEl.textContent  = text;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Open on info button click
  document.querySelectorAll('.info-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var style = btn.closest('.cat-tag') ?
        btn.closest('.cat-tag').textContent.trim().replace('ⓘ','').trim() : '';
      var text = btn.dataset.tooltip || '';
      openModal(style, text);
    });
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
  });
})();
