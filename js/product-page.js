(function () {
'use strict';

var fab     = document.getElementById('fab');
var PRICE   = fab ? (parseFloat(fab.dataset.price)   || 0) : 0;
var FITTING = fab ? (parseFloat(fab.dataset.fitting)  || 6) : 6;
var width   = 4;
var currentDisplayPrice = 0;
var animFrameId = null;

// Keyboard awareness (iOS safe)
if (window.visualViewport) {
  var lastVH = window.visualViewport.height;
  window.visualViewport.addEventListener('resize', function () {
    var current = window.visualViewport.height;
    if (current < lastVH * 0.85) {
      document.body.classList.add('keyboard-open');
    } else {
      document.body.classList.remove('keyboard-open');
    }
  });
}

// Set initial FAB swatch thumb from main product image
var fabThumbInit = document.getElementById('fab-swatch-thumb');
var fabThumbSmInit = document.getElementById('fab-swatch-thumb-sm');
var mainImgInit  = document.getElementById('product-main-img');
if (mainImgInit && mainImgInit.src) {
  if (fabThumbInit)   fabThumbInit.style.backgroundImage   = 'url(' + mainImgInit.src + ')';
  if (fabThumbSmInit) fabThumbSmInit.style.backgroundImage = 'url(' + mainImgInit.src + ')';
}

// Swatch backgrounds (CSP safe)
document.querySelectorAll('.swatch').forEach(function (sw) {
  if (sw.dataset.bg) {
    sw.style.backgroundImage    = 'url(' + sw.dataset.bg + ')';
    sw.style.backgroundSize     = 'cover';
    sw.style.backgroundPosition = 'center';
  } else if (sw.dataset.hex) {
    sw.style.backgroundColor = sw.dataset.hex;
  }
});

// Swatch interaction
var mainImg          = document.getElementById('product-main-img');
var swatchNameEl     = document.getElementById('swatch-name');
var stepSwatchNameEl = document.getElementById('step-swatch-name');
var allSwatches      = document.querySelectorAll('.swatch');

allSwatches.forEach(function (sw) {
  sw.addEventListener('click', function () {
    allSwatches.forEach(function (s) {
      s.classList.toggle('active', s.dataset.name === sw.dataset.name);
    });
    var img  = sw.dataset.img;
    var name = sw.dataset.name;
    if (img && mainImg) {
      mainImg.style.filter  = 'blur(4px)';
      mainImg.style.opacity = '0.7';
      var newImg = new Image();
      newImg.src = img;
      newImg.onload = function () {
        mainImg.src           = img;
        mainImg.alt           = name;
        mainImg.style.filter  = 'blur(0)';
        mainImg.style.opacity = '1';
      };
    }
    if (swatchNameEl)     swatchNameEl.textContent     = name;
    if (stepSwatchNameEl) stepSwatchNameEl.textContent = name;
    // Update FAB swatch thumb
    var fabThumb = document.getElementById('fab-swatch-thumb');
    if (fabThumb && img) {
      fabThumb.style.backgroundImage = 'url(' + img + ')';
      fabThumb.style.backgroundSize  = 'cover';
    }
    var fabThumbSm = document.getElementById('fab-swatch-thumb-sm');
    if (fabThumbSm && img) {
      fabThumbSm.style.backgroundImage = 'url(' + img + ')';
      fabThumbSm.style.backgroundSize  = 'cover';
    }
  });
});

// Width buttons
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

// Length input
var lenInput = document.getElementById('fp-length');

if (lenInput && fab) {
  lenInput.addEventListener('focus', function () {
    if (!fab.classList.contains('fab--visible')) {
      fab.classList.add('fab--ghost');
      fab.classList.add('fab--visible');
    }
  });
  lenInput.addEventListener('input', updateCalc);
}

// Addon toggles
document.querySelectorAll('.addon-row').forEach(function (row) {
  row.addEventListener('click', function (e) {
    e.preventDefault();
    row.classList.toggle('active');
    var cb = row.querySelector('input.addon-cb');
    if (cb) cb.checked = row.classList.contains('active');
    updateCalc();
  });
});

// Price ticker
function animatePrice(targetPrice) {
  var fabPriceEl = document.getElementById('fab-price');
  if (!fabPriceEl) return;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  var start     = currentDisplayPrice;
  var end       = targetPrice;
  var duration  = 300;
  var startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var current  = start + (end - start) * progress;
    var rounded  = current.toFixed(2);
    if (fabPriceEl.textContent !== '\u00a3' + rounded) {
      fabPriceEl.textContent = '\u00a3' + rounded;
    }
    currentDisplayPrice = current;
    if (progress < 1) {
      animFrameId = window.requestAnimationFrame(step);
    } else {
      animFrameId = null;
      currentDisplayPrice = end;
    }
  }
  animFrameId = window.requestAnimationFrame(step);
}

// Calculator
function updateCalc() {
  var length = lenInput ? (parseFloat(lenInput.value) || 0) : 0;
  var area   = parseFloat((length * width).toFixed(2));

  var underlayRow = document.querySelector('.addon-row[data-type="underlay"]');
  var fittingRow  = document.querySelector('.addon-row[data-type="fitting"]');
  var underlayOn  = underlayRow && underlayRow.classList.contains('active');
  var fittingOn   = fittingRow  && fittingRow.classList.contains('active');

  var flooring = area * PRICE;
  var underlay = underlayOn ? area * 5       : 0;
  var fitting  = fittingOn  ? area * FITTING : 0;
  var total    = flooring + underlay + fitting;

  var fabM2El    = document.getElementById('fab-m2');
  var fabBreakEl = document.getElementById('fab-breakdown');

  animatePrice(length > 0 ? total : 0);

  var fabPriceSubEl = document.getElementById('fab-price-sub');
  if (fabPriceSubEl) {
    fabPriceSubEl.textContent = length > 0 ? area + ' m² · Fully Installed' : 'Enter dimensions';
  }
  // Sync mobile bar
  var fabPriceMobile = document.getElementById('fab-price-mobile');
  var fabPriceSubMobile = document.getElementById('fab-price-sub-mobile');
  if (fabPriceMobile) {
    fabPriceMobile.textContent = length > 0 ? '£' + total.toFixed(2) : '£0.00';
  }
  if (fabPriceSubMobile) {
    fabPriceSubMobile.textContent = length > 0 ? area + ' m² · Fully Installed' : 'Enter dimensions';
  }
  // Legacy fab-m2 fallback
  var fabM2El = document.getElementById('fab-m2');
  if (fabM2El) {
    fabM2El.textContent = length > 0 ? area + ' m\u00b2' : '';
  }

  if (fabBreakEl) {
    if (length > 0) {
      var parts = ['Material (' + width + 'm width) \u00a3' + flooring.toFixed(2)];
      if (underlay > 0) parts.push('Underlay \u00a3' + underlay.toFixed(2));
      if (fitting  > 0) parts.push('Fitting \u00a3'  + fitting.toFixed(2));
      fabBreakEl.textContent = parts.join('  \u00b7  ');
    } else {
      fabBreakEl.textContent = 'Enter length for an instant quote';
    }
  }

  // Update drawer receipt
  updateDrawer(length, area, flooring, underlay, fitting, total);

  if (length > 0 && fab) {
    fab.classList.add('fab--visible');
    fab.classList.remove('fab--ghost');
  }

  // Update Book Free Measure href with receipt params
  var measureBtn = document.getElementById('fab-measure');
  var measureBtnMobile = document.getElementById('fab-measure-mobile');
  if (measureBtn && length > 0) {
    var productName = document.querySelector('.product-name') ? document.querySelector('.product-name').textContent.trim() : '';
    var params = new URLSearchParams();
    params.set('product',  productName);
    params.set('price',    (area * PRICE).toFixed(2));
    params.set('area',     area);
    params.set('width',    width);
    params.set('flooring', flooring.toFixed(2));
    params.set('underlay', underlay.toFixed(2));
    params.set('fitting',  fitting.toFixed(2));
    params.set('total',    total.toFixed(2));
    measureBtn.href = '/?' + params.toString() + '#contact';
    if (measureBtnMobile) measureBtnMobile.href = '/?' + params.toString() + '#contact';
  }

  // Enable/disable PDF button
  var pdfBtn = document.getElementById('fab-pdf-btn');
  if (pdfBtn) pdfBtn.disabled = length <= 0;
}

// Drawer receipt updater
function fmtGBP(v) {
  return '\u00a3' + v.toFixed(2);
}

function updateDrawer(length, area, flooring, underlay, fitting, total) {
  // Desktop glass panel rows
  var rFlooringLabel = document.getElementById('fab-r-flooring-label');
  var rFlooringPrice = document.getElementById('fab-r-flooring-price');
  var rUnderlay      = document.getElementById('fab-r-underlay');
  var rUnderlayPrice = document.getElementById('fab-r-underlay-price');
  var rFitting       = document.getElementById('fab-r-fitting');
  var rFittingPrice  = document.getElementById('fab-r-fitting-price');
  var rTotal         = document.getElementById('fab-r-total');

  if (length > 0) {
    if (rFlooringLabel) rFlooringLabel.textContent = 'Carpet (' + area + 'm²)';
    if (rFlooringPrice) rFlooringPrice.textContent = fmtGBP(flooring);
    if (rUnderlay)      rUnderlay.style.display     = underlay > 0 ? '' : 'none';
    if (rUnderlayPrice) rUnderlayPrice.textContent  = fmtGBP(underlay);
    if (rFitting)       rFitting.style.display       = fitting > 0  ? '' : 'none';
    if (rFittingPrice)  rFittingPrice.textContent    = fmtGBP(fitting);
    if (rTotal)         rTotal.textContent           = fmtGBP(total);
  } else {
    if (rFlooringLabel) rFlooringLabel.textContent = 'Carpet';
    if (rFlooringPrice) rFlooringPrice.textContent = '—';
    if (rTotal)         rTotal.textContent         = '—';
  }

  // Mobile drawer rows
  var rmFlooringDetail = document.getElementById('fab-rm-flooring-detail');
  var rmFlooringPrice  = document.getElementById('fab-rm-flooring-price');
  var rmUnderlay       = document.getElementById('fab-rm-underlay');
  var rmUnderlayPrice  = document.getElementById('fab-rm-underlay-price');
  var rmFitting        = document.getElementById('fab-rm-fitting');
  var rmFittingPrice   = document.getElementById('fab-rm-fitting-price');
  var rmTotal          = document.getElementById('fab-rm-total');

  if (length > 0) {
    if (rmFlooringDetail) rmFlooringDetail.textContent = length + 'm × ' + width + 'm = ' + area + 'm²';
    if (rmFlooringPrice)  rmFlooringPrice.textContent  = fmtGBP(flooring);
    if (rmUnderlay)       rmUnderlay.style.display      = underlay > 0 ? '' : 'none';
    if (rmUnderlayPrice)  rmUnderlayPrice.textContent   = fmtGBP(underlay);
    if (rmFitting)        rmFitting.style.display        = fitting > 0  ? '' : 'none';
    if (rmFittingPrice)   rmFittingPrice.textContent     = fmtGBP(fitting);
    if (rmTotal)          rmTotal.textContent            = fmtGBP(total);
  } else {
    if (rmFlooringDetail) rmFlooringDetail.textContent = '—';
    if (rmFlooringPrice)  rmFlooringPrice.textContent  = '—';
    if (rmTotal)          rmTotal.textContent          = '—';
  }
}

// Drawer toggle
var fabGrabber = document.getElementById('fab-grabber');
var fabDrawer  = document.getElementById('fab-drawer');
var drawerOpen = false;

function openDrawer() {
  if (!fab || !fabDrawer) return;
  drawerOpen = true;
  fab.classList.add('fab--open');
}

function closeDrawer() {
  if (!fab || !fabDrawer) return;
  drawerOpen = false;
  fab.classList.remove('fab--open');
}

if (fabGrabber) {
  fabGrabber.addEventListener('click', function () {
    drawerOpen ? closeDrawer() : openDrawer();
  });
}

// Tap mobile price area to open drawer
var fabMobileMain = document.querySelector('.fab-mobile-main .fab-zone-a');
if (fabMobileMain) {
  fabMobileMain.addEventListener('click', function () {
    drawerOpen ? closeDrawer() : openDrawer();
  });
  fabMobileMain.style.cursor = 'pointer';
}

// Desktop: no hover drawer — layout handles info display

// Close drawer on tap outside
document.addEventListener('click', function (e) {
  if (drawerOpen && fab && !fab.contains(e.target)) {
    closeDrawer();
  }
});

// Escape key
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && drawerOpen) closeDrawer();
});

updateCalc();


// PDF download
function downloadQuotePDF() {
  var jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDF) {
    alert('PDF library not loaded — please refresh and try again.');
    return;
  }
  var lenInput = document.getElementById('fp-length');
  var length = lenInput ? (parseFloat(lenInput.value) || 0) : 0;
  if (length <= 0) return;

  var area     = parseFloat((length * width).toFixed(2));
  var underlayRow = document.querySelector('.addon-row[data-type="underlay"]');
  var fittingRow  = document.querySelector('.addon-row[data-type="fitting"]');
  var underlayOn  = underlayRow && underlayRow.classList.contains('active');
  var fittingOn   = fittingRow  && fittingRow.classList.contains('active');
  var flooring = area * PRICE;
  var underlay = underlayOn ? area * 5 : 0;
  var fitting  = fittingOn  ? area * FITTING : 0;
  var total    = flooring + underlay + fitting;

  var productName = document.querySelector('.product-name') ? document.querySelector('.product-name').textContent.trim() : 'Product';
  var imgUrl = document.getElementById('product-main-img') ? document.getElementById('product-main-img').src : '';
  var colourName = document.getElementById('step-swatch-name') ? document.getElementById('step-swatch-name').textContent.trim() : '';

  var now     = new Date();
  var validTo = new Date(now); validTo.setDate(validTo.getDate() + 30);
  var fmtDate = function(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };
  var refNo   = 'WYC-' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + String(Math.floor(Math.random()*9000)+1000);

  var doc = new jsPDF({ unit: 'mm', format: 'a4' });
  var W = 210, H = 297, lm = 16, rm = 16;
  var cw = W - lm - rm;
  var col2x = lm + cw * 0.55 + 6;
  var col1w = cw * 0.55;
  var col2w = cw * 0.45 - 6;

  var ink    = [26,23,20], ink2 = [92,87,79], ink3 = [156,149,137];
  var red    = [224,48,64], border = [232,227,217], bg = [248,249,250], white = [255,255,255];

  var setC = function(r,g,b) { doc.setTextColor(r,g,b); };
  var setF = function(r,g,b) { doc.setFillColor(r,g,b); };
  var setD = function(r,g,b) { doc.setDrawColor(r,g,b); };
  var rule  = function(x1,y1,x2,y2,lw) { lw = lw || 0.3; doc.setLineWidth(lw); setD.apply(null,border); doc.line(x1,y1,x2,y2); };
  var label = function(txt,x,y) { doc.setFont('helvetica','bold'); doc.setFontSize(7); setC.apply(null,ink3); doc.text(txt.toUpperCase(),x,y); };

  setF.apply(null,red); doc.rect(0,0,W,3,'F');

  doc.setFont('helvetica','bold'); doc.setFontSize(18); setC.apply(null,ink);
  doc.text('Estimate', W-rm, 14, { align:'right' });
  doc.setFont('helvetica','normal'); doc.setFontSize(8); setC.apply(null,ink3);
  doc.text('Ref: ' + refNo, W-rm, 20, { align:'right' });

  rule(lm,25,W-rm,25,0.3);

  var y = 31;
  label('Date',lm,y); label('Valid Until',lm+50,y); label('Prepared For',lm+110,y);
  y += 5;
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setC.apply(null,ink);
  doc.text(fmtDate(now),lm,y);
  doc.text(fmtDate(validTo),lm+50,y);
  doc.text('Customer Copy',lm+110,y);
  rule(lm,y+4,W-rm,y+4,0.3);
  y += 10;

  var bodyTop = y;

  label('Product',lm,y); y += 5;
  doc.setFont('helvetica','bold'); doc.setFontSize(14); setC.apply(null,ink);
  doc.text(productName,lm,y,{ maxWidth:col1w }); y += 7;

  if (colourName) {
    doc.setFont('helvetica','normal'); doc.setFontSize(9); setC.apply(null,ink2);
    doc.text('Colour: ' + colourName,lm,y); y += 5;
  }

  y += 2;
  setF.apply(null,red); doc.roundedRect(lm,y,38,7,2,2,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(9); setC.apply(null,white);
  doc.text('£' + PRICE.toFixed(2) + ' / m²',lm+19,y+4.8,{ align:'center' });
  y += 12;

  rule(lm,y,lm+col1w,y); y += 6;
  label('Room Measurements',lm,y); y += 5;
  doc.setFont('helvetica','normal'); doc.setFontSize(10); setC.apply(null,ink);
  doc.text(length + ' m  ×  ' + width + ' m',lm,y); y += 5;
  doc.text('Total area: ' + area + ' m²',lm,y); y += 10;

  rule(lm,y,lm+col1w,y); y += 6;
  label('Price Breakdown',lm,y); y += 6;

  var bRows = [
    { label: 'Flooring (£' + PRICE.toFixed(2) + '/m²)', val: '£' + flooring.toFixed(2), main: true },
    { label: 'Underlay (+£5.00/m²)', val: underlayOn ? '£' + underlay.toFixed(2) : 'Not included', main: false },
    { label: 'Fitting (+£' + FITTING.toFixed(2) + '/m²)', val: fittingOn ? '£' + fitting.toFixed(2) : 'Not included', main: false }
  ];
  bRows.forEach(function(row) {
    doc.setFont('helvetica', row.main ? 'bold' : 'normal');
    doc.setFontSize(9.5);
    setC.apply(null, row.main ? ink : ink2);
    doc.text(row.label,lm,y);
    doc.text(row.val,lm+col1w,y,{ align:'right' });
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
  doc.text('£' + total.toFixed(2),lm+col1w-5,y+12,{ align:'right' });
  y += 24;

  setF.apply(null,red); doc.rect(0,H-16,W,0.8,'F');
  setF(26,23,20); doc.rect(0,H-15.2,W,15.2,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5); setC.apply(null,white);
  doc.text('Ready to book? Call 07449 188 303 or visit westyorkshirecarpets.com',W/2,H-9,{ align:'center' });
  doc.setFont('helvetica','normal'); doc.setFontSize(7); setC.apply(null,ink3);
  doc.text('Free measuring · Professional fitting · West Yorkshire · This estimate is valid for 30 days',W/2,H-4.5,{ align:'center' });

  var safeName = productName.replace(/[^a-z0-9]/gi,'-').toLowerCase();
  var fileName = 'wyc-estimate-' + safeName + '.pdf';

  var embedImg = function(onDone) {
    if (!imgUrl) { onDone(); return; }
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img,0,0);
        doc.addImage(canvas.toDataURL('image/jpeg',0.88),'JPEG',col2x,bodyTop,col2w,58,undefined,'FAST');
      } catch(e) {}
      onDone();
    };
    img.onerror = function() { onDone(); };
    img.src = imgUrl + (imgUrl.includes('?') ? '&' : '?') + '_pdf=1';
  };

  embedImg(function() {
    doc.save(fileName);
  });
}

// Also available
// Wire PDF button
var pdfBtn = document.getElementById('fab-pdf-btn');
if (pdfBtn) {
  pdfBtn.addEventListener('click', function() {
    downloadQuotePDF();
  });
}

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
      + '</div><div class="also-grid">';
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

// Like & Share
(function () {
var API = 'https://wyc-backend-production-ed78.up.railway.app';

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
      fetch(API + '/api/products/' + productId + '/like', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (likeCount && d.likes !== undefined) likeCount.textContent = d.likes; })
        .catch(function () {});
    } else {
      sessionStorage.removeItem('liked-' + productId);
      if (likeCount) likeCount.textContent = Math.max(0, parseInt(likeCount.textContent) - 1);
    }
  });
}

var shareBtn = document.getElementById('share-btn');
if (shareBtn) {
  shareBtn.addEventListener('click', function () {
    if (navigator.share) {
      navigator.share({ title: document.title, url: window.location.href }).catch(function () {});
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

// Info tooltip modal
(function () {
var modal = document.createElement('div');
modal.className = 'tooltip-modal';
modal.innerHTML =
  '<div class="tooltip-box">' +
    '<button class="tooltip-close" id="tooltip-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
    '<div class="tooltip-box-title" id="tooltip-title"></div>' +
    '<div class="tooltip-box-text" id="tooltip-text"></div>' +
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
    var style  = catTag ? catTag.textContent.trim().replace(/[ⓘi]/g, '').trim() : '';
    var text   = btn.dataset.tooltip || '';
    openModal(style, text);
  });
});

closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
})();
