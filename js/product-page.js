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
   SWATCH SHOW-MORE
   ───────────────────────────────────────────────────────────────────────────── */
function initShowMore() {
  var btn  = document.getElementById('swatch-show-more');
  var grid = document.getElementById('swatch-grid');
  if (!btn || !grid) return;

  btn.addEventListener('click', function () {
    grid.classList.add('expanded');
    btn.style.display = 'none';
    // Re-apply backgrounds to newly visible swatches
    initSwatchBg();
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   SWATCH SELECTION
   ───────────────────────────────────────────────────────────────────────────── */
function initSwatches() {
  var allSwatches = document.querySelectorAll('.swatch');
  if (!allSwatches.length) return;

  // Seed state from first active swatch
  var first = document.querySelector('.swatch.active') || allSwatches[0];
  if (first) {
    selectedColour = {
      name: first.dataset.name || '',
      hex:  first.dataset.hex  || '',
      img:  first.dataset.img  || first.dataset.bg || ''
    };
    setMainImage(selectedColour.img, selectedColour.name);
  }

  allSwatches.forEach(function (sw) {
    sw.addEventListener('click', function () {
      allSwatches.forEach(function (s) { s.classList.toggle('active', s === sw); });

      selectedColour = {
        name: sw.dataset.name || '',
        hex:  sw.dataset.hex  || '',
        img:  sw.dataset.img  || sw.dataset.bg || ''
      };

      document.querySelectorAll('#swatch-name').forEach(function (el) {
        el.textContent = selectedColour.name;
      });

      setMainImage(selectedColour.img, selectedColour.name);

      var heroBg = document.getElementById('hero-bg');
      if (heroBg && selectedColour.img) {
        heroBg.style.backgroundImage = 'url(' + selectedColour.img + ')';
      }
    });

    // Keyboard support
    sw.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sw.click(); }
    });
  });
}

function setMainImage(imgUrl, altText) {
  var mainImg = document.getElementById('product-main-img');
  if (!mainImg || !imgUrl) return;
  mainImg.style.filter  = 'blur(4px)';
  mainImg.style.opacity = '0.7';
  var tmp = new Image();
  tmp.src = imgUrl;
  tmp.onload = function () {
    mainImg.src           = imgUrl;
    mainImg.alt           = altText || '';
    mainImg.style.filter  = '';
    mainImg.style.opacity = '1';
  };
  tmp.onerror = function () {
    mainImg.style.filter  = '';
    mainImg.style.opacity = '1';
  };
}

// Mirror initial main image onto mobile hero background
(function seedHeroBg() {
  var mainImg = document.getElementById('product-main-img');
  var heroBg  = document.getElementById('hero-bg');
  if (heroBg && mainImg && mainImg.src) {
    heroBg.style.backgroundImage = 'url(' + mainImg.src + ')';
  }
}());

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
   ALSO AVAILABLE
   ───────────────────────────────────────────────────────────────────────────── */
function initAlsoAvailable() {
  var section = document.getElementById('also-section');
  if (!section) return;

  var cat      = section.dataset.cat;
  var slug     = section.dataset.slug;
  var catLabel = section.dataset.label;
  var apiBase  = section.dataset.api;
  if (!cat || !apiBase) return;

  fetch(apiBase+'/api/products?category='+cat)
    .then(function (r) { return r.json(); })
    .then(function (products) {
      var others = products.filter(function (p) {
        return p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-') !== slug && p.is_active;
      }).slice(0,4);

      if (!others.length) return;

      var lowestPrice = Math.min.apply(null, others.map(function (p) { return parseFloat(p.price); }));

      var html =
        '<div class="also-header">' +
          '<div class="also-title">More '+catLabel+'</div>' +
          '<a class="also-link" href="/#range">View all \u2192</a>' +
        '</div>' +
        '<p class="also-sub">Quality flooring across every budget \u00b7 from \u00a3'+lowestPrice.toFixed(2)+' / m\u00b2</p>' +
        '<div class="also-grid">';

      others.forEach(function (p) {
        var pSlug    = p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
        var imgSrc   = p.img_url || '';
        var fallback = (p.colours && Array.isArray(p.colours) && p.colours[0] && p.colours[0].hex) ? p.colours[0].hex : '#D4D2CE';
        var price    = parseFloat(p.price).toFixed(2);

        html +=
          '<a class="also-card" href="/flooring/'+cat+'/'+pSlug+'">' +
            '<div class="also-card-img">' +
              (imgSrc
                ? '<img src="'+imgSrc+'" alt="'+p.name+'" loading="lazy" width="400" height="300">'
                : '<div style="width:100%;height:100%;background:'+fallback+'"></div>'
              ) +
            '</div>' +
            '<div class="also-card-body">' +
              '<div class="also-card-name">'+p.name+'</div>' +
              '<div class="also-card-price">From \u00a3'+price+'/m\u00b2</div>' +
            '</div>' +
          '</a>';
      });

      html += '</div>';
      section.innerHTML = html;
    })
    .catch(function () {});
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
initWidthBtns();
initPresets();
initCalc();
initEstimateCta();
initGetPriceBtn();
initPDF();
initLikeShare();
initTooltip();
initAlsoAvailable();
initReveal();

}());
