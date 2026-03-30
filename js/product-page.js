(function () {
'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   STATE — prices read from hidden #product-data element (CSP-safe)
   ───────────────────────────────────────────────────────────────────────────── */
var productData    = document.getElementById('product-data');
var PRICE          = productData ? (parseFloat(productData.dataset.price)   || 0) : 0;
var FITTING        = productData ? (parseFloat(productData.dataset.fitting)  || 6) : 6;
var UNDERLAY_PRICE = 5;

var selectedWidth  = 4;
var selectedColour = { name: '', hex: '', img: '' };

/* FAB state */
var fab             = null;   /* resolved in initFab */
var fabCurrentPrice = 0;
var fabAnimId       = null;
var fabDrawerOpen   = false;

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────────────────── */
function fmtGBP(v) {
  return '\u00a3' + parseFloat(v).toFixed(2);
}

/* ─────────────────────────────────────────────────────────────────────────────
   SWATCH BACKGROUNDS  (CSP-safe: set via JS, never via inline style attr)
   ───────────────────────────────────────────────────────────────────────────── */
function initSwatchBg() {
  document.querySelectorAll('.swatch').forEach(function (sw) {
    var url = sw.dataset.bg || sw.dataset.img;
    if (url) {
      sw.style.backgroundImage    = 'url(' + url + ')';
      sw.style.backgroundSize     = 'cover';
      sw.style.backgroundPosition = 'center';
    } else if (sw.dataset.hex) {
      sw.style.backgroundColor = sw.dataset.hex;
    }
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   SWATCH SHOW-MORE TOGGLE
   ───────────────────────────────────────────────────────────────────────────── */
function initShowMore() {
  var btn   = document.getElementById('swatch-show-more');
  var strip = document.getElementById('swatch-strip');
  if (!btn || !strip) return;

  var expanded = false;
  btn.addEventListener('click', function () {
    expanded = !expanded;
    strip.classList.toggle('expanded', expanded);
    btn.textContent = expanded ? 'Close' : 'Show more colours';
    if (expanded) initSwatchBg();
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   SWATCH SELECTION + RESET
   ───────────────────────────────────────────────────────────────────────────── */
function initSwatches() {
  var allSwatches  = document.querySelectorAll('.swatch');
  if (!allSwatches.length) return;

  // Capture original image URL once at init
  var mainImg     = document.getElementById('product-main-img');
  var tabletImg   = document.getElementById('tablet-main-img');
  var heroBg      = document.getElementById('hero-bg');
  var originalUrl = mainImg ? (mainImg.dataset.original || mainImg.src) : '';

  // Seed selected colour from first active swatch
  var first = document.querySelector('.swatch.active') || allSwatches[0];
  if (first) {
    selectedColour = {
      name: first.dataset.name || '',
      hex:  first.dataset.hex  || '',
      img:  first.dataset.img  || first.dataset.bg || ''
    };
  }

  // Reset helpers
  function showReset(show) {
    var heroReset   = document.getElementById('hero-img-reset');
    var tabletReset = document.getElementById('tablet-img-reset');
    var desktopReset= document.getElementById('desktop-img-reset');
    if (heroReset)    heroReset.classList.toggle('visible', show);
    if (tabletReset)  tabletReset.classList.toggle('visible', show);
    if (desktopReset) desktopReset.classList.toggle('visible', show);
  }

  function resetImages() {
    if (!originalUrl) return;
    // Restore all targets
    if (mainImg)   { mainImg.src   = originalUrl; }
    if (tabletImg) { tabletImg.src = originalUrl; }
    if (heroBg)    { heroBg.style.backgroundImage = 'url(' + originalUrl + ')'; }
    // Restore active swatch to first
    allSwatches.forEach(function (s, i) { s.classList.toggle('active', i === 0); });
    selectedColour = {
      name: first ? (first.dataset.name || '') : '',
      hex:  first ? (first.dataset.hex  || '') : '',
      img:  originalUrl
    };
    var nameEl = document.getElementById('swatch-name');
    if (nameEl) nameEl.textContent = selectedColour.name;
    showReset(false);
  }

  // Wire reset buttons
  ['hero-img-reset', 'tablet-img-reset', 'desktop-img-reset'].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', resetImages);
  });

  // Swatch click
  allSwatches.forEach(function (sw) {
    sw.addEventListener('click', function () {
      allSwatches.forEach(function (s) { s.classList.toggle('active', s === sw); });

      selectedColour = {
        name: sw.dataset.name || '',
        hex:  sw.dataset.hex  || '',
        img:  sw.dataset.img  || sw.dataset.bg || ''
      };

      updateFabThumbs(selectedColour.img || selectedColour.hex);

      // Update name label
      document.querySelectorAll('#swatch-name').forEach(function (el) {
        el.textContent = selectedColour.name;
      });

      // Update all image targets
      if (selectedColour.img) {
        setImage(mainImg,   selectedColour.img);
        setImage(tabletImg, selectedColour.img);
        if (heroBg) heroBg.style.backgroundImage = 'url(' + selectedColour.img + ')';
      }

      // Show reset only if not the default
      var isDefault = selectedColour.img === originalUrl || sw === allSwatches[0];
      showReset(!isDefault);
    });

    sw.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sw.click(); }
    });
  });
}

function setImage(imgEl, url) {
  if (!imgEl || !url) return;
  imgEl.style.filter  = 'blur(4px)';
  imgEl.style.opacity = '0.7';
  var tmp = new Image();
  tmp.src = url;
  tmp.onload = function () {
    imgEl.src           = url;
    imgEl.style.filter  = '';
    imgEl.style.opacity = '1';
  };
  tmp.onerror = function () {
    imgEl.style.filter  = '';
    imgEl.style.opacity = '1';
  };
}

// Keep setMainImage as thin wrapper for PDF compatibility
function setMainImage(imgUrl, altText) {
  var mainImg = document.getElementById('product-main-img');
  setImage(mainImg, imgUrl);
  if (mainImg && altText) mainImg.alt = altText;
}

/* ─────────────────────────────────────────────────────────────────────────────
   WIDTH SEGMENT CONTROL
   ───────────────────────────────────────────────────────────────────────────── */
function initWidthBtns() {
  document.querySelectorAll('.seg-btn[data-width]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.seg-btn[data-width]').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      selectedWidth = parseFloat(btn.dataset.width);
      calcPrice();
    });
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROOM PRESETS
   ───────────────────────────────────────────────────────────────────────────── */
function initPresets() {
  var lenInput = document.getElementById('room-len');
  document.querySelectorAll('.preset-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      document.querySelectorAll('.preset-chip').forEach(function (c) {
        c.classList.remove('active');
      });
      chip.classList.add('active');
      if (lenInput && chip.dataset.len) {
        lenInput.value = chip.dataset.len;
        calcPrice();
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   CALCULATOR
   ───────────────────────────────────────────────────────────────────────────── */
function initCalc() {
  var lenInput = document.getElementById('room-len');
  if (!lenInput) return;

  lenInput.addEventListener('input', function () {
    document.querySelectorAll('.preset-chip').forEach(function (c) {
      c.classList.remove('active');
    });
    calcPrice();
  });

  ['svc-fitting', 'svc-underlay'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', calcPrice);
  });
}

function calcPrice() {
  var lenInput  = document.getElementById('room-len');
  var len       = lenInput ? parseFloat(lenInput.value) : NaN;
  var estimCard = document.getElementById('estimate-card');
  var pdfBtn    = document.getElementById('estimate-pdf-btn');

  if (isNaN(len) || len <= 0) {
    if (estimCard) estimCard.classList.remove('visible');
    if (pdfBtn)    pdfBtn.disabled = true;
    updateFab(0, 0, 0, 0, 0, 0);
    return;
  }

  var area         = parseFloat((len * selectedWidth).toFixed(2));
  var withFitting  = document.getElementById('svc-fitting')
    ? document.getElementById('svc-fitting').checked : true;
  var withUnderlay = document.getElementById('svc-underlay')
    ? document.getElementById('svc-underlay').checked : true;

  // Each line is independent — carpet always = PRICE * area
  var carpetCost   = parseFloat((area * PRICE).toFixed(2));
  var fittingCost  = withFitting  ? parseFloat((area * FITTING).toFixed(2))        : 0;
  var underlayCost = withUnderlay ? parseFloat((area * UNDERLAY_PRICE).toFixed(2)) : 0;
  var total        = parseFloat((carpetCost + fittingCost + underlayCost).toFixed(2));

  var totalEl = document.getElementById('est-total');
  var bkEl    = document.getElementById('est-breakdown');

  if (totalEl) totalEl.textContent = fmtGBP(total);
  if (bkEl) {
    var lines = ['<strong>Carpet</strong>: ' + fmtGBP(carpetCost)];
    if (withFitting)  lines.push('Fitting: '  + fmtGBP(fittingCost));
    if (withUnderlay) lines.push('Underlay: ' + fmtGBP(underlayCost));
    bkEl.innerHTML = lines.join('<br>');
  }

  if (estimCard) estimCard.classList.add('visible');
  if (pdfBtn)    pdfBtn.disabled = false;

  // Update CTA href with pre-fill params for contact form
  var ctaBtn = document.getElementById('estimate-cta-btn');
  if (ctaBtn) {
    var nameEl = document.querySelector('h1.hero-title') || document.querySelector('.desktop-name');
    var name   = nameEl ? nameEl.textContent.trim() : '';
    var params = new URLSearchParams();
    params.set('product',  name);
    params.set('price',    carpetCost.toFixed(2));
    params.set('area',     area);
    params.set('width',    selectedWidth);
    params.set('flooring', carpetCost.toFixed(2));
    params.set('underlay', underlayCost.toFixed(2));
    params.set('fitting',  fittingCost.toFixed(2));
    params.set('total',    total.toFixed(2));
    ctaBtn.dataset.href = '/?' + params.toString() + '#contact';
  }

  updateFab(len, area, carpetCost, underlayCost, fittingCost, total);
}

/* ─────────────────────────────────────────────────────────────────────────────
   ESTIMATE CTA — navigate to contact form with pre-filled params
   ───────────────────────────────────────────────────────────────────────────── */
function initEstimateCta() {
  var btn = document.getElementById('estimate-cta-btn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var href = btn.dataset.href;
    if (href) window.location.href = href;
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   GET PRICE BUTTON — scrolls to configurator
   ───────────────────────────────────────────────────────────────────────────── */
function initGetPriceBtn() {
  var btn = document.getElementById('get-price-btn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var target = document.getElementById('config-section');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   PDF QUOTE
   ───────────────────────────────────────────────────────────────────────────── */
function initPDF() {
  var btn = document.getElementById('estimate-pdf-btn');
  if (btn) btn.addEventListener('click', downloadQuotePDF);
}

function downloadQuotePDF() {
  var jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDF) {
    alert('PDF library not loaded \u2014 please refresh and try again.');
    return;
  }

  var lenInput = document.getElementById('room-len');
  var len      = lenInput ? parseFloat(lenInput.value) : 0;
  if (!len || len <= 0) return;

  var area         = parseFloat((len * selectedWidth).toFixed(2));
  var withFitting  = document.getElementById('svc-fitting')
    ? document.getElementById('svc-fitting').checked  : true;
  var withUnderlay = document.getElementById('svc-underlay')
    ? document.getElementById('svc-underlay').checked : true;

  var carpetCost   = parseFloat((area * PRICE).toFixed(2));
  var fittingCost  = withFitting  ? parseFloat((area * FITTING).toFixed(2))        : 0;
  var underlayCost = withUnderlay ? parseFloat((area * UNDERLAY_PRICE).toFixed(2)) : 0;
  var total        = parseFloat((carpetCost + fittingCost + underlayCost).toFixed(2));

  var nameEl      = document.querySelector('h1.hero-title') || document.querySelector('.desktop-name');
  var productName = nameEl ? nameEl.textContent.trim() : 'Product';
  var imgEl       = document.getElementById('product-main-img');
  var imgUrl      = imgEl ? imgEl.src : '';
  var colourEl    = document.getElementById('swatch-name');
  var colourName  = colourEl ? colourEl.textContent.trim() : '';

  var now     = new Date();
  var validTo = new Date(now);
  validTo.setDate(validTo.getDate() + 30);
  var fmtDate = function (d) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  var refNo = 'WYC-' + now.getFullYear()
    + '-' + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '-' + String(Math.floor(Math.random() * 9000) + 1000);

  var doc  = new jsPDF({ unit: 'mm', format: 'a4' });
  var W    = 210, H = 297, lm = 16, rm = 16;
  var cw   = W - lm - rm;
  var col1w = cw * 0.55;
  var col2x = lm + col1w + 6;
  var col2w = cw * 0.45 - 6;

  var ink    = [26,23,20], ink2 = [92,87,79], ink3 = [156,149,137];
  var red    = [184,50,50], border = [232,227,217], bg = [247,247,246], white = [255,255,255];

  var setC = function (r,g,b) { doc.setTextColor(r,g,b); };
  var setF = function (r,g,b) { doc.setFillColor(r,g,b); };
  var setD = function (r,g,b) { doc.setDrawColor(r,g,b); };
  var rule  = function (x1,y1,x2,y2,lw) {
    doc.setLineWidth(lw||0.3); setD.apply(null,border); doc.line(x1,y1,x2,y2);
  };
  var lbl = function (txt,x,y) {
    doc.setFont('helvetica','bold'); doc.setFontSize(7);
    setC.apply(null,ink3); doc.text(txt.toUpperCase(),x,y);
  };

  setF.apply(null,red); doc.rect(0,0,W,3,'F');

  doc.setFont('helvetica','bold'); doc.setFontSize(18); setC.apply(null,ink);
  doc.text('Estimate',W-rm,14,{align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(8); setC.apply(null,ink3);
  doc.text('Ref: '+refNo,W-rm,20,{align:'right'});
  rule(lm,25,W-rm,25,0.3);

  var y = 31;
  lbl('Date',lm,y); lbl('Valid Until',lm+50,y); lbl('Prepared For',lm+110,y);
  y += 5;
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setC.apply(null,ink);
  doc.text(fmtDate(now),lm,y);
  doc.text(fmtDate(validTo),lm+50,y);
  doc.text('Customer Copy',lm+110,y);
  rule(lm,y+4,W-rm,y+4,0.3);
  y += 10;

  var bodyTop = y;
  lbl('Product',lm,y); y += 5;
  doc.setFont('helvetica','bold'); doc.setFontSize(14); setC.apply(null,ink);
  doc.text(productName,lm,y,{maxWidth:col1w}); y += 7;

  if (colourName) {
    doc.setFont('helvetica','normal'); doc.setFontSize(9); setC.apply(null,ink2);
    doc.text('Colour: '+colourName,lm,y); y += 5;
  }

  y += 2;
  setF.apply(null,red); doc.roundedRect(lm,y,38,7,2,2,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(9); setC.apply(null,white);
  doc.text('\u00a3'+PRICE.toFixed(2)+' / m\u00b2',lm+19,y+4.8,{align:'center'});
  y += 12;

  rule(lm,y,lm+col1w,y); y += 6;
  lbl('Room Measurements',lm,y); y += 5;
  doc.setFont('helvetica','normal'); doc.setFontSize(10); setC.apply(null,ink);
  doc.text(len+' m  \u00d7  '+selectedWidth+' m',lm,y); y += 5;
  doc.text('Total area: '+area+' m\u00b2',lm,y); y += 10;

  rule(lm,y,lm+col1w,y); y += 6;
  lbl('Price Breakdown',lm,y); y += 6;

  var rows = [
    { label:'Carpet (\u00a3'+PRICE.toFixed(2)+'/m\u00b2)',             val:fmtGBP(carpetCost),                                     main:true  },
    { label:'Underlay (+\u00a3'+UNDERLAY_PRICE.toFixed(2)+'/m\u00b2)', val:withUnderlay ? fmtGBP(underlayCost) : 'Not included',   main:false },
    { label:'Fitting (+\u00a3'+FITTING.toFixed(2)+'/m\u00b2)',          val:withFitting  ? fmtGBP(fittingCost)  : 'Not included',   main:false },
  ];
  rows.forEach(function (row) {
    doc.setFont('helvetica',row.main?'bold':'normal'); doc.setFontSize(9.5);
    setC.apply(null,row.main?ink:ink2);
    doc.text(row.label,lm,y);
    doc.text(row.val,lm+col1w,y,{align:'right'});
    rule(lm,y+2,lm+col1w,y+2,0.2); y += 8;
  });

  y += 2;
  setF.apply(null,bg); doc.roundedRect(lm,y,col1w,18,3,3,'F');
  setD.apply(null,border); doc.setLineWidth(0.5); doc.roundedRect(lm,y,col1w,18,3,3,'S');
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5); setC.apply(null,ink2);
  doc.text('ESTIMATED TOTAL',lm+5,y+7);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setC.apply(null,ink3);
  doc.text('inc. selected extras',lm+5,y+12);
  doc.setFont('helvetica','bold'); doc.setFontSize(18); setC.apply(null,red);
  doc.text(fmtGBP(total),lm+col1w-5,y+12,{align:'right'});

  setF.apply(null,red); doc.rect(0,H-16,W,0.8,'F');
  setF(26,23,20); doc.rect(0,H-15.2,W,15.2,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5); setC.apply(null,white);
  doc.text('Ready to book? Call 07449 188 303 or visit westyorkshirecarpets.com',W/2,H-9,{align:'center'});
  doc.setFont('helvetica','normal'); doc.setFontSize(7); setC.apply(null,ink3);
  doc.text('Free measuring \u00b7 Professional fitting \u00b7 West Yorkshire \u00b7 Valid 30 days',W/2,H-4.5,{align:'center'});

  var safeName = productName.replace(/[^a-z0-9]/gi,'-').toLowerCase();

  var embedImg = function (onDone) {
    if (!imgUrl) { onDone(); return; }
    var tmp = new Image();
    tmp.crossOrigin = 'anonymous';
    tmp.onload = function () {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = tmp.naturalWidth; canvas.height = tmp.naturalHeight;
        canvas.getContext('2d').drawImage(tmp,0,0);
        doc.addImage(canvas.toDataURL('image/jpeg',0.88),'JPEG',col2x,bodyTop,col2w,58,undefined,'FAST');
      } catch (e) {}
      onDone();
    };
    tmp.onerror = function () { onDone(); };
    tmp.src = imgUrl + (imgUrl.includes('?') ? '&' : '?') + '_pdf=1';
  };

  embedImg(function () { doc.save('wyc-estimate-'+safeName+'.pdf'); });
}

/* ─────────────────────────────────────────────────────────────────────────────
   LIKE & SHARE
   ───────────────────────────────────────────────────────────────────────────── */
function initLikeShare() {
  var API       = 'https://wyc-backend-production-ed78.up.railway.app';
  var likeBtn   = document.getElementById('like-btn');
  var likeCount = document.getElementById('like-count');

  if (likeBtn) {
    var productId = likeBtn.dataset.id;
    var liked     = sessionStorage.getItem('liked-'+productId) === '1';

    if (liked) {
      likeBtn.classList.add('liked');
      var svgInit = likeBtn.querySelector('svg');
      if (svgInit) svgInit.style.fill = 'currentColor';
    }

    likeBtn.addEventListener('click', function () {
      liked = !liked;
      likeBtn.classList.toggle('liked', liked);
      var svgEl = likeBtn.querySelector('svg');
      if (svgEl) svgEl.style.fill = liked ? 'currentColor' : 'none';
      likeBtn.style.transform = 'scale(1.2)';
      setTimeout(function () { likeBtn.style.transform = ''; }, 200);

      if (liked) {
        sessionStorage.setItem('liked-'+productId, '1');
        fetch(API+'/api/products/'+productId+'/like', {method:'POST'})
          .then(function (r) { return r.json(); })
          .then(function (d) { if (likeCount && d.likes !== undefined) likeCount.textContent = d.likes; })
          .catch(function () {});
      } else {
        sessionStorage.removeItem('liked-'+productId);
        if (likeCount) likeCount.textContent = Math.max(0, parseInt(likeCount.textContent,10)-1);
      }
    });
  }

  var shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({title:document.title, url:window.location.href}).catch(function(){});
      } else {
        navigator.clipboard.writeText(window.location.href).then(function () {
          var icon = shareBtn.querySelector('svg');
          if (icon) icon.style.stroke = '#059669';
          setTimeout(function () { if (icon) icon.style.stroke = ''; }, 1500);
        }).catch(function(){});
      }
    });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOOLTIP MODAL — pile style info
   ───────────────────────────────────────────────────────────────────────────── */
function initTooltip() {
  var modal = document.createElement('div');
  modal.className = 'tooltip-modal';
  modal.innerHTML =
    '<div class="tooltip-box">' +
      '<button class="tooltip-close" id="tooltip-close" aria-label="Close">' +
        '<i class="fa-solid fa-xmark"></i>' +
      '</button>' +
      '<div class="tooltip-box-title" id="tooltip-title"></div>' +
      '<div class="tooltip-box-text"  id="tooltip-text"></div>' +
    '</div>';
  document.body.appendChild(modal);

  var titleEl  = document.getElementById('tooltip-title');
  var textEl   = document.getElementById('tooltip-text');
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

  document.querySelectorAll('.info-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var catTag = btn.closest('.cat-tag');
      // Strip the info icon text, leaving just the label
      var label  = catTag ? catTag.textContent.replace(/\s*[ⓘi]\s*$/,'').trim() : '';
      openModal(label, btn.dataset.tooltip || '');
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCROLL REVEALS
   ───────────────────────────────────────────────────────────────────────────── */
function initReveal() {
  if (!window.IntersectionObserver) {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.07 });
  document.querySelectorAll('.reveal').forEach(function (el) { obs.observe(el); });
}

/* ─────────────────────────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────────────────────────── */
initSwatchBg();
initShowMore();
initSwatches();
initFab();
initWidthBtns();
initPresets();
initCalc();
initEstimateCta();
initGetPriceBtn();
initPDF();
initLikeShare();
initTooltip();
initReveal();

}());
/* ─────────────────────────────────────────────────────────────────────────────
   FAB — updateFabThumbs
   Updates both desktop circle and mobile circle whenever a swatch is selected.
   Accepts either a URL string or a hex colour string (#rrggbb).
   ───────────────────────────────────────────────────────────────────────────── */
function updateFabThumbs(imgOrHex) {
  var desktop = document.getElementById('fab-swatch-thumb');
  var mobile  = document.getElementById('fab-swatch-thumb-sm');
  if (!imgOrHex) return;

  var isHex = imgOrHex.charAt(0) === '#';
  [desktop, mobile].forEach(function (el) {
    if (!el) return;
    if (isHex) {
      el.style.backgroundImage = '';
      el.style.backgroundColor = imgOrHex;
    } else {
      el.style.backgroundImage = 'url(' + imgOrHex + ')';
      el.style.backgroundSize  = 'cover';
      el.style.backgroundColor = '';
    }
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   FAB — animateFabPrice
   Smooth ease-out counter over 300ms on the desktop price element.
   Cancel-guard prevents overlapping rAF loops on rapid input.
   ───────────────────────────────────────────────────────────────────────────── */
function animateFabPrice(target) {
  var el = document.getElementById('fab-price');
  if (!el) return;

  if (fabAnimId) { cancelAnimationFrame(fabAnimId); fabAnimId = null; }

  var start     = fabCurrentPrice;
  var duration  = 300;
  var startTime = null;

  function step(ts) {
    if (!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    var current  = start + (target - start) * progress;
    el.textContent  = '\u00a3' + current.toFixed(2);
    fabCurrentPrice = current;
    if (progress < 1) {
      fabAnimId = requestAnimationFrame(step);
    } else {
      fabAnimId       = null;
      fabCurrentPrice = target;
      el.textContent  = '\u00a3' + target.toFixed(2);
    }
  }
  fabAnimId = requestAnimationFrame(step);
}

/* ─────────────────────────────────────────────────────────────────────────────
   FAB — updateFab
   Single source of truth for all FAB state.
   Called from calcPrice() on every valid input change and on reset.
   ───────────────────────────────────────────────────────────────────────────── */
function updateFab(len, area, flooring, underlay, fitting, total) {
  if (!fab) return;

  var hasVal = len > 0;

  /* ── Animated price (desktop) ─────────────────────────────────────────── */
  animateFabPrice(hasVal ? total : 0);

  /* ── Subtitle text ────────────────────────────────────────────────────── */
  var subtitle = hasVal
    ? (area + '\u00a0m\u00b2\u00a0\u00b7\u00a0Fully Installed')
    : 'Enter dimensions';
  var subEl  = document.getElementById('fab-price-sub');
  var subMob = document.getElementById('fab-price-sub-mobile');
  if (subEl)  subEl.textContent  = subtitle;
  if (subMob) subMob.textContent = subtitle;

  /* ── Mobile static price ──────────────────────────────────────────────── */
  var mobPrice = document.getElementById('fab-price-mobile');
  if (mobPrice) mobPrice.textContent = hasVal ? ('\u00a3' + total.toFixed(2)) : '\u00a30.00';

  /* ── Desktop glass panel receipt rows ─────────────────────────────────── */
  var rFlooringLabel = document.getElementById('fab-r-flooring-label');
  var rFlooringPrice = document.getElementById('fab-r-flooring-price');
  var rUnderlay      = document.getElementById('fab-r-underlay');
  var rUnderlayPrice = document.getElementById('fab-r-underlay-price');
  var rFitting       = document.getElementById('fab-r-fitting');
  var rFittingPrice  = document.getElementById('fab-r-fitting-price');
  var rTotal         = document.getElementById('fab-r-total');

  if (hasVal) {
    if (rFlooringLabel) rFlooringLabel.textContent = 'Carpet\u00a0(' + area + '\u00a0m\u00b2)';
    if (rFlooringPrice) rFlooringPrice.textContent = '\u00a3' + flooring.toFixed(2);
    if (rUnderlay)      rUnderlay.classList.toggle('fab-panel-row--hidden', underlay <= 0);
    if (rUnderlayPrice) rUnderlayPrice.textContent = '\u00a3' + underlay.toFixed(2);
    if (rFitting)       rFitting.classList.toggle('fab-panel-row--hidden',  fitting  <= 0);
    if (rFittingPrice)  rFittingPrice.textContent  = '\u00a3' + fitting.toFixed(2);
    if (rTotal)         rTotal.textContent          = '\u00a3' + total.toFixed(2);
  } else {
    if (rFlooringLabel) rFlooringLabel.textContent = 'Carpet';
    if (rFlooringPrice) rFlooringPrice.textContent = '\u2014';
    if (rUnderlay)      rUnderlay.classList.add('fab-panel-row--hidden');
    if (rFitting)       rFitting.classList.add('fab-panel-row--hidden');
    if (rTotal)         rTotal.textContent          = '\u2014';
  }

  /* ── Mobile drawer receipt rows ───────────────────────────────────────── */
  var rmFlooringLabel = document.getElementById('fab-rm-flooring-label');
  var rmFlooringPrice = document.getElementById('fab-rm-flooring-price');
  var rmUnderlay      = document.getElementById('fab-rm-underlay');
  var rmUnderlayPrice = document.getElementById('fab-rm-underlay-price');
  var rmFitting       = document.getElementById('fab-rm-fitting');
  var rmFittingPrice  = document.getElementById('fab-rm-fitting-price');
  var rmTotal         = document.getElementById('fab-rm-total');

  if (hasVal) {
    if (rmFlooringLabel) rmFlooringLabel.textContent = 'Carpet\u00a0(' + area + '\u00a0m\u00b2)';
    if (rmFlooringPrice) rmFlooringPrice.textContent = '\u00a3' + flooring.toFixed(2);
    if (rmUnderlay)      rmUnderlay.classList.toggle('fab-panel-row--hidden', underlay <= 0);
    if (rmUnderlayPrice) rmUnderlayPrice.textContent = '\u00a3' + underlay.toFixed(2);
    if (rmFitting)       rmFitting.classList.toggle('fab-panel-row--hidden',  fitting  <= 0);
    if (rmFittingPrice)  rmFittingPrice.textContent  = '\u00a3' + fitting.toFixed(2);
    if (rmTotal)         rmTotal.textContent          = '\u00a3' + total.toFixed(2);
  } else {
    if (rmFlooringLabel) rmFlooringLabel.textContent = 'Carpet';
    if (rmFlooringPrice) rmFlooringPrice.textContent = '\u2014';
    if (rmUnderlay)      rmUnderlay.classList.add('fab-panel-row--hidden');
    if (rmFitting)       rmFitting.classList.add('fab-panel-row--hidden');
    if (rmTotal)         rmTotal.textContent          = '\u2014';
  }

  /* ── Visibility ───────────────────────────────────────────────────────── */
  if (hasVal) {
    fab.classList.add('fab--visible');
    fab.classList.remove('fab--ghost');
  }

  /* ── Measure button hrefs (pre-filled contact form) ───────────────────── */
  if (hasVal) {
    var nameEl = document.querySelector('h1.hero-title') || document.querySelector('.desktop-name');
    var name   = nameEl ? nameEl.textContent.trim() : '';
    var params = new URLSearchParams();
    params.set('product',  name);
    params.set('price',    flooring.toFixed(2));
    params.set('area',     area);
    params.set('width',    selectedWidth);
    params.set('flooring', flooring.toFixed(2));
    params.set('underlay', underlay.toFixed(2));
    params.set('fitting',  fitting.toFixed(2));
    params.set('total',    total.toFixed(2));
    var href = '/?' + params.toString() + '#contact';
    var mBtn = document.getElementById('fab-measure');
    var mMob = document.getElementById('fab-measure-mobile');
    if (mBtn) mBtn.href = href;
    if (mMob) mMob.href = href;
  }

  /* ── PDF button state ─────────────────────────────────────────────────── */
  var pdfBtn       = document.getElementById('fab-pdf-btn');
  var pdfBtnDrawer = document.getElementById('fab-pdf-btn-drawer');
  if (pdfBtn)       pdfBtn.disabled       = !hasVal;
  if (pdfBtnDrawer) pdfBtnDrawer.disabled = !hasVal;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FAB — initFab
   Wires all FAB interactions. Called once after DOM is ready.
   ───────────────────────────────────────────────────────────────────────────── */
function initFab() {
  fab = document.getElementById('fab');
  if (!fab) return;

  /* iOS virtual keyboard: hide FAB when keyboard pushes viewport */
  if (window.visualViewport) {
    var lastVH = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', function () {
      var cur = window.visualViewport.height;
      document.body.classList.toggle('keyboard-open', cur < lastVH * 0.82);
      lastVH = cur;
    });
  }

  /* Seed swatch thumb from the initial product image */
  var mainImg = document.getElementById('product-main-img');
  if (mainImg && mainImg.src) updateFabThumbs(mainImg.src);

  /* Ghost on length-input focus (before a value is entered) */
  var lenInput = document.getElementById('room-len');
  if (lenInput) {
    lenInput.addEventListener('focus', function () {
      if (!fab.classList.contains('fab--visible')) {
        fab.classList.add('fab--ghost');
      }
    });
    lenInput.addEventListener('blur', function () {
      var len = parseFloat(lenInput.value);
      if (!(len > 0) && !fab.classList.contains('fab--visible')) {
        fab.classList.remove('fab--ghost');
      }
    });
  }

  /* PDF buttons (desktop circle + mobile drawer) */
  var pdfBtn       = document.getElementById('fab-pdf-btn');
  var pdfBtnDrawer = document.getElementById('fab-pdf-btn-drawer');
  if (pdfBtn)       pdfBtn.addEventListener('click', downloadQuotePDF);
  if (pdfBtnDrawer) pdfBtnDrawer.addEventListener('click', downloadQuotePDF);

  /* Mobile: grabber opens/closes drawer */
  var grabber = document.getElementById('fab-grabber');
  if (grabber) {
    grabber.addEventListener('click', function () {
      fabDrawerOpen = !fabDrawerOpen;
      fab.classList.toggle('fab--open', fabDrawerOpen);
    });
  }

  /* Mobile: tapping price area also opens drawer */
  var mobileZone = document.querySelector('.fab-mobile-main .fab-zone-a');
  if (mobileZone) {
    mobileZone.style.cursor = 'pointer';
    mobileZone.addEventListener('click', function () {
      fabDrawerOpen = !fabDrawerOpen;
      fab.classList.toggle('fab--open', fabDrawerOpen);
    });
  }

  /* Close drawer on outside tap */
  document.addEventListener('click', function (e) {
    if (fabDrawerOpen && fab && !fab.contains(e.target)) {
      fabDrawerOpen = false;
      fab.classList.remove('fab--open');
    }
  });

  /* Close drawer on Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && fabDrawerOpen) {
      fabDrawerOpen = false;
      fab.classList.remove('fab--open');
    }
  });

  /* Render initial hidden state */
  updateFab(0, 0, 0, 0, 0, 0);
}
