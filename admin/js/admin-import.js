/* admin/js/admin-import.js
 * Extracted from admin/index.html on 25 Jul 2026 during the admin.html split.
 * Two self-contained IIFEs, in their original order: single-URL product import,
 * then the bulk-scrape feature (added 25 Jul 2026) that submits through the same
 * /api/panel/import-family endpoint. Each has its own local helpers -- no shared
 * state between them beyond that.
 */


(function () {
  'use strict';

  // ── Lookup tables ────────────────────────────────────────────────────────

  var IMP_FEATURES = [
    { key: 'bleach',     label: 'Bleach Cleanable' },
    { key: 'stain',      label: 'Stain Resistant'  },
    { key: 'easyClean',  label: 'Easy Clean'        },
    { key: 'pet',        label: 'Pet Friendly'      },
    { key: 'waterproof', label: 'Waterproof'        },
    { key: 'soft',       label: 'Ultra Soft'        },
    { key: 'insulation', label: 'Warm Underfoot'    },
    { key: 'scratch',    label: 'Scratch Resistant' },
  ];

  var IMP_ROOMS = [
    { key: 'living',   label: 'Living Room' },
    { key: 'bedroom',  label: 'Bedroom'     },
    { key: 'kitchen',  label: 'Kitchen'     },
    { key: 'bathroom', label: 'Bathroom'    },
    { key: 'hallway',  label: 'Hallway'     },
    { key: 'stairs',   label: 'Stairs'      },
  ];

  var IMP_BADGE_LABELS = {
    new:     'New In',
    seller:  'Best Seller',
    sale:    'Sale',
    premium: 'Premium',
  };

  // ── State ────────────────────────────────────────────────────────────────
  var impData = null;

  // ── DOM helpers ──────────────────────────────────────────────────────────
  function el(id)      { return document.getElementById(id); }
  function hide(id)    { el(id).style.display = 'none';  }
  function show(id)    { el(id).style.display = '';       }
  function block(id)   { el(id).style.display = 'block'; }
  function flex(id)    { el(id).style.display = 'flex';  }

  function setErr(id, msg)  { var e = el(id); e.textContent = msg; e.style.display = 'block'; }
  function clearErr(id)     { var e = el(id); e.textContent = '';  e.style.display = 'none';  }

  function authHeader() {
    var t = localStorage.getItem('wyc_token');
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function stars(n, max) {
    return '<span class="imp-stars">' + '★'.repeat(n) +
      '<span style="opacity:.25">' + '★'.repeat(max - n) + '</span></span> ' +
      n + '/' + max;
  }

  function setProgress(pct, label) {
    el('impProgressFill').style.width = pct + '%';
    if (label !== undefined) el('impProgressLabel').textContent = label;
  }

  // ── SCRAPE ───────────────────────────────────────────────────────────────
  window.impScrape = async function () {
    var url = el('impUrlInput').value.trim();
    clearErr('impStep1Error');

    if (!url) {
      setErr('impStep1Error', 'Please paste a Carpet Line Direct URL.');
      el('impUrlInput').focus();
      return;
    }
    if (false) {
      setErr('impStep1Error', "That doesn't look like a Carpet Line Direct URL — please check and try again.");
      el('impUrlInput').focus();
      return;
    }

    el('impScrapeBtn').disabled = true;
    hide('impStep2');
    hide('impStep3');
    flex('impLoading');

    try {
      var res  = await fetch('/api/panel/scrape-family', {
        method:  'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
        body:    JSON.stringify({ url: url }),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scrape failed — please try again.');

      impData = data;
      renderReview(data);
    } catch (err) {
      setErr('impStep1Error', err.message);
    } finally {
      hide('impLoading');
      el('impScrapeBtn').disabled = false;
    }
  };

  // ── RENDER REVIEW ────────────────────────────────────────────────────────
  function renderReview(data) {
    // Source pill
    el('impSourceUrl').textContent = data.url;
    block('impSourcePill');

    // Names
    el('impWycName').value = '';

    // Specs
    el('impSpecFibre').value             = data.specs.fibre;
    el('impSpecStyle').value             = data.specs.carpetStyle;
    el('impSpecSuitability').textContent = data.specs.suitability;
    el('impSpecDurability').innerHTML    = stars(data.specs.durability, 5);
    el('impSpecSoftness').innerHTML      = stars(data.specs.softness, 5);
    el('impSpecDesc').value              = '';
    // Feature checkboxes
    el('impFeaturesChecks').innerHTML = IMP_FEATURES.map(function (f) {
      return '<label class="imp-check-label"><input type="checkbox" data-feat="' + f.key + '" ' +
        (data.specs.features.indexOf(f.key) !== -1 ? 'checked' : '') + ' />' + f.label + '</label>';
    }).join('');

    // Room checkboxes
    el('impRoomsChecks').innerHTML = IMP_ROOMS.map(function (r) {
      return '<label class="imp-check-label"><input type="checkbox" data-room="' + r.key + '" ' +
        (data.specs.rooms.indexOf(r.key) !== -1 ? 'checked' : '') + ' />' + r.label + '</label>';
    }).join('');

    // Colour count
    el('impColourCount').textContent =
      data.colours.length + ' colour variant' + (data.colours.length !== 1 ? 's' : '') + ' found';

    // Colour rows
    el('impColourBody').innerHTML = data.colours.map(function (c, i) {
      var families = ['greys','beiges','browns','creams','blacks','blues','greens','golds','reds','neutrals'];
      var opts = families.map(function(f) {
        return '<option value="' + f + '"' + (f === c.colourFamily ? ' selected' : '') + '>' + f.charAt(0).toUpperCase() + f.slice(1) + '</option>';
      }).join('');
      return '<tr>' +
        '<td style="width:72px;"><img src="' + esc(c.imgUrl) + '" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;display:block;" alt="' + esc(c.supplierName) + '" onerror="this.style.opacity=\'0.25\'" /></td>' +
        '<td><input type="text" data-ci="' + i + '" value="" placeholder="' + esc(c.supplierName) + '" style="width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;color:#1a2332;background:#fff;outline:none;box-sizing:border-box;" /></td>' +
        '<td style="width:120px;"><div style="display:flex;align-items:center;gap:6px;"><input type="color" data-hex="' + i + '" value="' + esc(c.hex) + '" style="width:32px;height:32px;border:1px solid #e5e7eb;border-radius:6px;cursor:pointer;padding:2px;" /><span data-hexlabel="' + i + '" style="font-size:11px;color:#9ca3af;font-family:monospace;">' + esc(c.hex) + '</span></div></td>' +
        '<td style="width:130px;"><select data-family="' + i + '" style="width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;color:#1a2332;background:#fff;outline:none;">' + opts + '</select></td>' +
        '</tr>';
    }).join('');
    el('impColourBody').querySelectorAll('input[type=color]').forEach(function(picker) {
      picker.addEventListener('input', function() {
        var label = el('impColourBody').querySelector('[data-hexlabel="' + this.dataset.hex + '"]');
        if (label) label.textContent = this.value;
      });
    });

    // Reset action area state
    clearErr('impStep2Error');
    hide('impProgress');
    el('impImportBtn').disabled = false;
    setProgress(0);

    // Price + badge reset
    el('impPrice').value    = '';
    el('impWasPrice').value = '';
    el('impBadge').value    = '';

    block('impStep2');
    el('impStep2').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── IMPORT ───────────────────────────────────────────────────────────────
  window.impImport = async function () {
    clearErr('impStep2Error');

    var wycName  = el('impWycName').value.trim();
    var priceRaw = el('impPrice').value;
    var wasRaw   = el('impWasPrice').value;
    var badgeKey = el('impBadge').value;

    if (!wycName) {
      setErr('impStep2Error', 'Please enter a WYC product name.');
      el('impWycName').focus();
      return;
    }
    var price = parseFloat(priceRaw);
    if (!priceRaw || isNaN(price) || price <= 0) {
      setErr('impStep2Error', 'Please enter a valid selling price.');
      el('impPrice').focus();
      return;
    }

    // Collect checked features
    var features = [];
    document.querySelectorAll('#impFeaturesChecks input[data-feat]:checked')
      .forEach(function (e) { features.push(e.dataset.feat); });

    // Collect checked rooms
    var rooms = [];
    document.querySelectorAll('#impRoomsChecks input[data-room]:checked')
      .forEach(function (e) { rooms.push(e.dataset.room); });

    if (rooms.length === 0) {
      setErr('impStep2Error', 'Please tick at least one room suitability option.');
      return;
    }

    // Collect colour names, hex and family from editable inputs
    var colours = impData.colours.map(function (c, i) {
      var nameInp   = document.querySelector('input[data-ci="' + i + '"]');
      var hexInp    = document.querySelector('input[data-hex="' + i + '"]');
      var familySel = document.querySelector('select[data-family="' + i + '"]');
      var name   = nameInp   && nameInp.value.trim()   ? nameInp.value.trim()   : c.supplierName;
      var hex    = hexInp    ? hexInp.value            : c.hex;
      var family = familySel ? familySel.value         : c.colourFamily;
      return Object.assign({}, c, { wycName: name, hex: hex, colourFamily: family });
    });

    var payload = {
      family: {
        wycName:       wycName,
        price:         price,
        originalPrice: wasRaw && parseFloat(wasRaw) > 0 ? parseFloat(wasRaw) : null,
        badge:         badgeKey ? (IMP_BADGE_LABELS[badgeKey] || null) : null,
        badgeType:     badgeKey || null,
        specs: Object.assign({}, impData.specs, { features: features, rooms: rooms, fibre: el('impSpecFibre').value, carpetStyle: el('impSpecStyle').value, description: el('impSpecDesc').value.trim() }),
        colours:       colours,
      },
    };

    // Show progress
    el('impImportBtn').disabled = true;
    block('impProgress');
    setProgress(8, 'Uploading ' + colours.length + ' image' + (colours.length !== 1 ? 's' : '') + ' to Cloudinary…');

    var fakePct = 8;
    var fakeTimer = setInterval(function () {
      fakePct = Math.min(fakePct + 4, 85);
      setProgress(fakePct);
    }, 900);

    try {
      var res  = await fetch('/api/panel/import-family', {
        method:  'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
        body:    JSON.stringify(payload),
      });

      clearInterval(fakeTimer);
      setProgress(100, 'Saving to database…');

      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed — please try again.');

      // Show success
      hide('impStep2');
      var ir = data.imageResults;
      el('impSuccessTitle').textContent  = '"' + data.product.name + '" is live on your website';
      el('impSuccessDetail').textContent =
        colours.length + ' colour variant' + (colours.length !== 1 ? 's' : '') +
        ' imported. Customers can browse this product right now.';

      var statsHtml = '';
      if (ir.uploaded > 0)
        statsHtml += '<li><span class="imp-ok">✓</span> ' + ir.uploaded + ' image' + (ir.uploaded !== 1 ? 's' : '') + ' uploaded to Cloudinary</li>';
      if (ir.fallback > 0)
        statsHtml += '<li><span class="imp-warn">⚠</span> ' + ir.fallback + ' image' + (ir.fallback !== 1 ? 's' : '') + ' kept supplier URL — re-upload from Products if needed</li>';
      statsHtml += '<li><span class="imp-ok">✓</span> Product ID: ' + data.product.id + '</li>';
      el('impSuccessStats').innerHTML = statsHtml;

      block('impStep3');
      el('impStep3').scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
      clearInterval(fakeTimer);
      hide('impProgress');
      el('impImportBtn').disabled = false;
      setProgress(0);
      setErr('impStep2Error', err.message);
    }
  };

  // ── RESET ────────────────────────────────────────────────────────────────
  window.impReset = function () {
    impData = null;
    el('impUrlInput').value  = '';
    el('impPrice').value     = '';
    el('impWasPrice').value  = '';
    el('impBadge').value     = '';
    el('impImportBtn').disabled = false;
    clearErr('impStep1Error');
    clearErr('impStep2Error');
    hide('impProgress');
    hide('impStep2');
    hide('impStep3');
    hide('impLoading');
    setProgress(0);
    el('impStep1').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

})();



(function () {
  'use strict';

  function el(id)    { return document.getElementById(id); }
  function hide(id)  { el(id).style.display = 'none';  }
  function block(id) { el(id).style.display = 'block'; }

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function authHeader() {
    var t = localStorage.getItem('wyc_token');
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }

  var bscrapeResults = []; // successfully-scraped families from the current batch

  window.bulkScrapeShow = function () {
    block('bscrapeSection');
    hide('bscrapeToggleWrap');
  };
  window.bulkScrapeHide = function () {
    hide('bscrapeSection');
    el('bscrapeToggleWrap').style.display = 'block';
  };

  function bscrapeUrlList() {
    return el('bscrapeUrls').value
      .split('\n')
      .map(function (l) { return l.trim(); })
      .filter(Boolean);
  }

  window.bulkScrapeUpdateCount = function () {
    var n = bscrapeUrlList().length;
    el('bscrapeCount').textContent = n + ' URL' + (n !== 1 ? 's' : '');
  };

  window.bulkScrapeStart = async function () {
    var urls = bscrapeUrlList();
    el('bscrapeError').style.display = 'none';

    if (urls.length === 0) {
      el('bscrapeError').textContent = 'Paste at least one URL.';
      el('bscrapeError').style.display = 'block';
      return;
    }
    if (urls.length > 50) {
      el('bscrapeError').textContent = 'Maximum 50 URLs per batch — split into smaller batches.';
      el('bscrapeError').style.display = 'block';
      return;
    }

    bscrapeResults = [];
    el('bscrapeStartBtn').disabled = true;
    block('bscrapeProgress');
    hide('bscrapeReview');
    el('bscrapeResultsList').innerHTML = '';
    el('bscrapeProgressFill').style.width = '0%';
    el('bscrapeProgressLabel').textContent = 'Scraping…';
    el('bscrapeProgressCount').textContent = '0 / ' + urls.length;

    try {
      var res = await fetch('/api/panel/scrape-bulk', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
        body: JSON.stringify({ urls: urls }),
      });

      if (!res.ok) {
        var errData = await res.json();
        throw new Error(errData.error || 'Bulk scrape failed to start.');
      }

      var reader  = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer  = '';

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });

        var lines = buffer.split('\n');
        buffer = lines.pop(); // keep any incomplete trailing line for the next chunk

        for (var i = 0; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          bscrapeHandleResult(JSON.parse(lines[i]), urls.length);
        }
      }
      if (buffer.trim()) {
        try { bscrapeHandleResult(JSON.parse(buffer), urls.length); } catch (e) { /* ignore trailing partial */ }
      }

      el('bscrapeProgressLabel').textContent = 'Done';
      bscrapeRenderReview();
    } catch (err) {
      el('bscrapeError').textContent = err.message;
      el('bscrapeError').style.display = 'block';
    } finally {
      el('bscrapeStartBtn').disabled = false;
    }
  };

  function bscrapeHandleResult(line, total) {
    var pct = Math.round((line.progress.done / total) * 100);
    el('bscrapeProgressFill').style.width = pct + '%';
    el('bscrapeProgressCount').textContent = line.progress.done + ' / ' + total;

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12px;padding:6px 10px;' +
      'border-radius:6px;background:' + (line.success ? '#f0fbf4' : '#fff3f4') + ';' +
      'color:' + (line.success ? '#1e7e42' : '#c0392b') + ';';
    row.innerHTML = (line.success ? '✓ ' : '✕ ') + esc(line.url) + (line.success ? '' : ' — ' + esc(line.error));
    el('bscrapeResultsList').appendChild(row);
    row.scrollIntoView({ block: 'nearest' });

    if (line.success) bscrapeResults.push(line.data);
  }

  function bscrapeRenderReview() {
    if (bscrapeResults.length === 0) return; // nothing succeeded -- leave the results list as the record

    el('bscrapeReviewCount').textContent = bscrapeResults.length;
    el('bscrapeCards').innerHTML = bscrapeResults.map(function (family, fi) {
      var coloursHtml = family.colours.map(function (c, ci) {
        return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
          '<img src="' + esc(c.imgUrl || '') + '" style="width:36px;height:36px;object-fit:cover;border-radius:4px;' +
            'border:1px solid #e5e7eb;flex-shrink:0;background:#f5f0eb;" onerror="this.style.visibility=\'hidden\'" />' +
          '<input type="text" class="bscrapeColourName" data-fi="' + fi + '" data-ci="' + ci + '" value="" ' +
            'placeholder="' + esc(c.supplierName) + '" ' +
            'style="flex:1;padding:6px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;' +
            'color:#1a2332;background:#fff;outline:none;" />' +
          '</div>';
      }).join('');

      return '<div class="bscrape-card" data-fi="' + fi + '" ' +
          'style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:14px;">' +
        '<div style="display:flex;gap:16px;margin-bottom:14px;">' +
          '<div style="flex:1;">' +
            '<label style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;' +
              'display:block;margin-bottom:4px;">WYC Product Name</label>' +
            '<input type="text" class="bscrapeWycName" data-fi="' + fi + '" placeholder="Enter a WYC name — required" ' +
              'style="width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;box-sizing:border-box;" />' +
          '</div>' +
          '<div style="width:120px;">' +
            '<label style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;' +
              'display:block;margin-bottom:4px;">Price (£)</label>' +
            '<input type="number" class="bscrapePrice" data-fi="' + fi + '" step="0.01" min="0.01" ' +
              'style="width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;box-sizing:border-box;" />' +
          '</div>' +
        '</div>' +
        '<label style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;' +
          'display:block;margin-bottom:6px;">Colour Names (' + family.colours.length + ')</label>' +
        coloursHtml +
        '<div class="bscrape-card-status" data-fi="' + fi + '" style="margin-top:10px;font-size:12px;"></div>' +
      '</div>';
    }).join('');

    block('bscrapeReview');
    el('bscrapeReview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  window.bulkScrapeImportAll = async function () {
    el('bscrapeImportAllBtn').disabled = true;
    el('bscrapeImportResults').innerHTML = '';
    var successCount = 0, failCount = 0;

    for (var fi = 0; fi < bscrapeResults.length; fi++) {
      var family    = bscrapeResults[fi];
      var card      = document.querySelector('.bscrape-card[data-fi="' + fi + '"]');
      var statusEl  = document.querySelector('.bscrape-card-status[data-fi="' + fi + '"]');
      var wycNameEl = document.querySelector('.bscrapeWycName[data-fi="' + fi + '"]');
      var priceEl   = document.querySelector('.bscrapePrice[data-fi="' + fi + '"]');
      var wycName   = wycNameEl.value.trim();
      var price     = parseFloat(priceEl.value);

      if (!wycName) {
        statusEl.style.color = '#c0392b';
        statusEl.textContent = 'Skipped — WYC name is required.';
        failCount++;
        continue;
      }
      if (!price || price <= 0) {
        statusEl.style.color = '#c0392b';
        statusEl.textContent = 'Skipped — a valid price is required.';
        failCount++;
        continue;
      }

      var colours = family.colours.map(function (c, ci) {
        var nameEl = document.querySelector('.bscrapeColourName[data-fi="' + fi + '"][data-ci="' + ci + '"]');
        var name = nameEl && nameEl.value.trim() ? nameEl.value.trim() : c.supplierName;
        return Object.assign({}, c, { wycName: name });
      });

      statusEl.style.color = '#6b7280';
      statusEl.textContent = 'Importing…';

      try {
        // The scraped description text (e.g. "Cormar Moorland Twist — Bedrooms...")
        // echoes the supplier's own product name -- there's no review field for it in
        // this bulk flow the way there is in the single-URL import, so it's cleared
        // here rather than forwarded as-is. Matches the single-import flow's default
        // (always blank unless the admin explicitly types one).
        var specsWithoutDescription = Object.assign({}, family.specs, { description: '' });

        var res = await fetch('/api/panel/import-family', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
          body: JSON.stringify({
            family: {
              wycName:  wycName,
              price:    price,
              category: family.category,
              specs:    specsWithoutDescription,
              colours:  colours,
            },
          }),
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Import failed.');

        statusEl.style.color = '#1e7e42';
        statusEl.textContent = '✓ Imported successfully.';
        card.style.opacity = '0.6';
        successCount++;
      } catch (err) {
        statusEl.style.color = '#c0392b';
        statusEl.textContent = '✕ ' + err.message;
        failCount++;
      }
    }

    el('bscrapeImportResults').innerHTML =
      '<div style="padding:14px 18px;background:#f0fbf4;border:1px solid #b8e6c4;border-radius:8px;' +
      'font-size:13px;color:#1e7e42;">' +
      successCount + ' imported successfully' +
      (failCount > 0 ? ', ' + failCount + ' need attention (see above)' : '.') +
      '</div>';
    el('bscrapeImportAllBtn').disabled = false;
  };

})();
