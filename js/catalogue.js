(function () {
    'use strict';
    
    let PRODUCTS = [];

    
        const ROOMS = [
        { key: 'living',   label: 'Living Room', icon: 'fa-couch' },
        { key: 'bedroom',  label: 'Bedroom',     icon: 'fa-bed' },
        { key: 'kitchen',  label: 'Kitchen',     icon: 'fa-utensils' },
        { key: 'bathroom', label: 'Bathroom',    icon: 'fa-shower' },
        { key: 'hallway',  label: 'Hallway',     icon: 'fa-door-open' },
        { key: 'stairs',   label: 'Stairs',      icon: 'fa-stairs' },
    ];

        const BADGE_CLASS = {
        seller:  'badge--seller',
        sale:    'badge--sale',
        premium: 'badge--premium',
        new:     'badge--new',
    };

        const CATEGORY_META = {
        all:      { title: 'Full Range',        desc: 'Browse our complete collection of premium flooring' },
        carpets:  { title: 'Carpets',           desc: 'Plush, twist & berber — supreme comfort underfoot' },
        vinyl:    { title: 'Vinyl Flooring',    desc: '100% waterproof LVT — kitchens & bathrooms perfected' },
        laminate: { title: 'Laminate',          desc: 'Scratch-resistant wood effects — tough enough for families' },
        wood:     { title: 'Real Wood',         desc: 'Genuine engineered & solid oak — floors that last a lifetime' },
        deals:    { title: 'Weekly Deals 🔥',   desc: 'This week\'s best prices — limited stock available' },
    };

        const CAT_LABEL = {
        carpets: 'Carpet', vinyl: 'Vinyl', laminate: 'Laminate', wood: 'Real Wood',
    };

    
    const state = {
        activeCategory:   'all',
        activePriceRange: 'all',
        activeRooms: [],
        activeFeatures: [],
        activeSpecial: null,
        activeColourFamily: '',
        activeFibre: '',
        activeCarpetStyle: '',
        activeSoftnessLabel: '',
        activeThickness: '',
        activeDensity: '',
        activeInstallMethod: '',
        activeLayPattern: '',
        activeAcRating: '',
        activeBoardDesign: '',
        activeSurfaceFinish: '',
        activeSort:       'default',
        isOpen:           false,
    };

    
    let DOM = {};

    
    function lockScroll() {
        const sb = window.innerWidth - document.documentElement.clientWidth;
        // Lock both html and body to prevent any scroll passthrough
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow    = 'hidden';
        document.body.style.paddingRight = sb + 'px';
        document.documentElement.style.paddingRight = sb + 'px';
        const hdr = document.getElementById('site-header');
        if (hdr) hdr.style.paddingRight = sb + 'px';
    }

    function unlockScroll() {
        document.documentElement.style.overflow = '';
        document.documentElement.style.paddingRight = '';
        document.body.style.overflow    = '';
        document.body.style.paddingRight = '';
        const hdr = document.getElementById('site-header');
        if (hdr) hdr.style.paddingRight = '';
    }

    
    function open(category) {
        category = category || 'all';

        if (state.isOpen) {
            setCategory(category);
            return;
        }

        state.activeCategory   = category;
        state.activePriceRange = 'all';
        state.activeSort       = 'default';
        if (DOM.sortSelect) DOM.sortSelect.value = 'default';

        syncHeader();
        syncTabs();
        syncPriceFilters();

        DOM.overlay.removeAttribute('hidden');
        lockScroll();
        state.isOpen = true;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (window.closeNavMenu) window.closeNavMenu();
                DOM.overlay.classList.add('is-open');
                document.body.classList.add('cat-open');
                document.documentElement.classList.add('cat-open');
                DOM.overlay.setAttribute('aria-hidden', 'false');
                renderGrid();
            });
        });

        setTimeout(() => DOM.closeBtn && DOM.closeBtn.focus(), 120);
    }

    function close() {
        if (!state.isOpen) return;
        if (DOM.qv && !DOM.qv.hasAttribute('hidden')) {
            _hideQV(false);
        }

        DOM.overlay.classList.remove('is-open');
        DOM.overlay.classList.add('is-closing');
        document.body.classList.remove('cat-open');
        document.documentElement.classList.remove('cat-open');
        DOM.overlay.setAttribute('aria-hidden', 'true');
        state.isOpen = false;

        setTimeout(() => {
            DOM.overlay.classList.remove('is-closing');
            DOM.overlay.setAttribute('hidden', '');
            unlockScroll();
        }, 300);
    }

    
    function setCategory(category) {
        state.activeCategory = category;
        syncHeader();
        syncTabs();
        renderGrid();
        if (DOM.body) DOM.body.scrollTop = 0;
        // Show/hide category-specific filter groups
        document.querySelectorAll('.cfd-cat-group').forEach(g => {
            const gc = g.dataset.cat;
            g.style.display = (category === 'all' || category === 'deals' || category === gc) ? '' : 'none';
        });
    }

    function setPrice(range) {
        state.activePriceRange = range;
        syncPriceFilters();
        renderGrid();
    }

    function setSort(sortKey) {
        state.activeSort = sortKey;
        renderGrid();
    }

    function getFilteredProducts() {
        let products = PRODUCTS.slice();
        if (state.activeCategory === 'deals') {
            products = products.filter(p => p.deal);
        } else if (state.activeCategory !== 'all') {
            products = products.filter(p => p.category === state.activeCategory);
        }

        if (state.activePriceRange === 'budget') {
            products = products.filter(p => p.price < 20);
        } else if (state.activePriceRange === 'mid') {
            products = products.filter(p => p.price >= 20 && p.price <= 40);
        } else if (state.activePriceRange === 'premium') {
            products = products.filter(p => p.price > 40);
        }
        if (state.activeRooms && state.activeRooms.length > 0) {
            products = products.filter(p => Array.isArray(p.rooms) && state.activeRooms.some(r => p.rooms.includes(r)));
        }
        if (state.activeFeatures && state.activeFeatures.length > 0) {
            products = products.filter(p => Array.isArray(p.features) && state.activeFeatures.every(f => p.features.includes(f)));
        }
        if (state.activeColourFamily) products = products.filter(p => p.colour_family === state.activeColourFamily);
        if (state.activeFibre) products = products.filter(p => p.fibre === state.activeFibre);
        if (state.activeCarpetStyle) products = products.filter(p => p.carpet_style === state.activeCarpetStyle);
        if (state.activeSoftnessLabel) products = products.filter(p => p.softness_label === state.activeSoftnessLabel);
        if (state.activeThickness) products = products.filter(p => p.thickness === state.activeThickness);
        if (state.activeDensity) products = products.filter(p => p.density === state.activeDensity);
        if (state.activeSpecial === 'deals') {
            products = products.filter(p => p.deal);
        } else if (state.activeSpecial === 'liked') {
            products = products.sort((a, b) => (b.likes||0) - (a.likes||0)).filter(p => (p.likes||0) > 0);
        } else if (state.activeSpecial === 'new') {
            products = products.filter(p => p.badge === 'New In');
        }

        if (state.activeSort === 'price-asc') {
            products.sort((a, b) => a.price - b.price);
        } else if (state.activeSort === 'price-desc') {
            products.sort((a, b) => b.price - a.price);
        } else if (state.activeSort === 'name') {
            products.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            products.sort((a, b) => {
                const score = p => (p.featured ? 2 : 0) + (p.badgeType === 'seller' ? 1 : 0);
                return score(b) - score(a);
            });
        }

        return products;
    }

    
    function syncHeader() {
        const meta = CATEGORY_META[state.activeCategory] || CATEGORY_META.all;
        if (DOM.title) DOM.title.textContent = meta.title;
        if (DOM.desc)  DOM.desc.textContent  = meta.desc;
    }

    function syncTabs() {
        if (!DOM.tabs) return;
        DOM.tabs.querySelectorAll('.cat-tab').forEach(btn => {
            const active = btn.dataset.cat === state.activeCategory;
            btn.classList.toggle('is-active', active);
            if (active) {
                // Scroll only within the tabs strip — never move the panel/page
                const tabsEl = DOM.tabs;
                const btnLeft = btn.offsetLeft;
                const btnWidth = btn.offsetWidth;
                const containerWidth = tabsEl.offsetWidth;
                const target = btnLeft - (containerWidth / 2) + (btnWidth / 2);
                tabsEl.scrollTo({ left: target, behavior: 'smooth' });
            }
        });
    }

    function syncPriceFilters() {
        // price filter synced via drawer chips
    }

    
    function renderGrid() {
        const products = getFilteredProducts();

        if (!DOM.grid) return;

        const scrollTop = DOM.catBody ? DOM.catBody.scrollTop : 0;

        if (products.length === 0) {
            DOM.grid.innerHTML = '';
            if (DOM.empty) DOM.empty.removeAttribute('hidden');
            return;
        }

        if (DOM.empty) DOM.empty.setAttribute('hidden', '');

        DOM.grid.innerHTML = products
            .map((product, index) => buildCardHTML(product, index))
            .join('');

        if (DOM.catBody) DOM.catBody.scrollTop = scrollTop;
        updateChipCounts();
        updateTabCounts();
    }

    function buildCardHTML(p, index) {
        const badgeHTML = p.badge && p.badgeType
            ? `<div class="cat-card-badge ${BADGE_CLASS[p.badgeType] || ''}">${p.badge}</div>` : '';
        const saveHTML = p.originalPrice
            ? `<span class="cat-card-save">Save £${(p.originalPrice - p.price).toFixed(2)}</span>` : '';
        const swatchesHTML = p.colours.slice(0, 5).map((c, i) =>
            c.img_url
              ? `<span class="cat-swatch cat-swatch--img${i===0?' active':''}" style="background-image:url('${c.img_url}');background-size:cover" title="${c.name}" data-pid="${p.id}" onclick="event.stopPropagation();catSwatchClick(this)" aria-label="${c.name}"></span>`
              : `<span class="cat-swatch${i===0?' active':''}" style="background:${c.hex}" title="${c.name}" data-pid="${p.id}" onclick="event.stopPropagation();catSwatchClick(this)" aria-label="${c.name}"></span>`
        ).join('');
        const extraHTML = p.colours.length > 5 ? `<span class="cat-swatch-more">+${p.colours.length - 5}</span>` : '';
        const delay = Math.min(index * 55, 300);
        return `
            <article class="cat-card${p.badgeType === 'sale' ? ' is-sale' : ''}"
                     data-product-id="${p.id}"
                     style="animation-delay: ${delay}ms"
                     tabindex="0" role="group"
                     aria-label="${p.name}, ${CAT_LABEL[p.category] || p.category}, £${p.price.toFixed(2)} per square metre">
                <div class="cat-card-img-wrap" data-action="quick-view" data-id="${p.id}" style="cursor:pointer">
                    <img src="${p.img}" alt="${p.name} flooring" class="cat-card-img" loading="lazy" decoding="async">
                    ${badgeHTML}${saveHTML}
                    <div class="cat-card-qv-overlay">
                        <button class="cat-card-qv-btn" data-action="quick-view" data-id="${p.id}" type="button" aria-label="Quick view ${p.name}">
                            <i class="fa-solid fa-expand" aria-hidden="true"></i> Quick View
                        </button>
                    </div>
                </div>
                <div class="cat-card-body">
                    <span class="cat-card-cat-label">${CAT_LABEL[p.category] || p.category}</span>
                    <h3 class="cat-card-name">${p.name}</h3>
                    <div class="cat-card-pricing">
                        ${p.originalPrice ? `<span class="cat-card-price-was">£${p.originalPrice.toFixed(2)} /m²</span>` : ''}
                        <div class="cat-card-price${p.originalPrice ? ' is-sale' : ''}">£${p.price.toFixed(2)} <span class="cat-card-price-unit">m²</span></div>
                    </div>
                    ${p.colours.length > 0 ? `
                    <div class="cat-card-colours">
                        <span class="cat-card-colour-count">${p.colours.length} colour${p.colours.length !== 1 ? 's' : ''}</span>
                        <div class="cat-card-swatches">${swatchesHTML}${extraHTML}</div>
                    </div>` : '<div style="flex:1"></div>'}
                    <div class="cat-card-actions">
                        <button class="cat-card-calc" data-action="quick-view" data-id="${p.id}" type="button">
                            <i class="fa-solid fa-calculator"></i> Calculate Price
                        </button>
                        <button class="cat-card-like" data-action="like" data-id="${p.id}" type="button" title="Save">
                            <i class="fa-regular fa-heart"></i>
                        </button>
                    </div>
                </div>
            </article>`;
    }

    
    function openQuickView(productId) {
        const p = PRODUCTS.find(prod => prod.id === productId);
        if (!p || !DOM.qv || !DOM.qvPanel) return;

        DOM.qvPanel.innerHTML = buildQuickViewHTML(p);
        _currentQVProduct = p;
        DOM.qv.removeAttribute('hidden');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                DOM.qv.classList.add('is-open');
            });
        });

        const qvClose = DOM.qvPanel.querySelector('.qv-close');
        if (qvClose) qvClose.addEventListener('click', closeQuickView);

        const enquireBtn = DOM.qvPanel.querySelector('[data-action="qv-enquire"]');
        if (enquireBtn) enquireBtn.addEventListener('click', () => enquireAbout(productId));

        const sampleBtn = DOM.qvPanel.querySelector('[data-action="qv-sample"]');
        if (sampleBtn) sampleBtn.addEventListener('click', () => requestSample(productId));

        setTimeout(() => qvClose && qvClose.focus(), 100);
    }

    function closeQuickView() {
        _currentQVProduct = null;
        _hideQV(true);
    }

    function _hideQV(animated) {
        if (!DOM.qv) return;
        DOM.qv.setAttribute('hidden', '');
        DOM.qv.classList.remove('is-open', 'is-closing');
    }

    function buildQuickViewHTML(p) {
        const badgeHTML = p.badge && p.badgeType
            ? `<div class="cat-card-badge ${BADGE_CLASS[p.badgeType] || ''} qv-badge-abs">${p.badge}</div>` : '';
        const wasPriceHTML = p.originalPrice
            ? `<span class="qv-price-was">£${p.originalPrice.toFixed(2)}</span>` : '';
        const saveHTML = p.originalPrice
            ? `<span class="qv-save-tag">Save £${(p.originalPrice - p.price).toFixed(2)}</span>` : '';
        const swatchesHTML = p.colours.map((c, i) =>
            c.img_url
              ? `<div class="qv-swatch qv-swatch--img${i===0?' active':''}${i>=8?' qv-swatch-hidden':''}" title="${c.name}"
                     style="background-image:url('${c.img_url}');background-size:cover;cursor:pointer"
                     onclick="qvSwatchClick(this,'${c.name.replace(/'/g,String.fromCharCode(92,39))}',${i})"
                     aria-label="${c.name}"></div>`
              : `<div class="qv-swatch${i===0?' active':''}${i>=8?' qv-swatch-hidden':''}" style="background:${c.hex};cursor:pointer" title="${c.name}"
                     onclick="qvSwatchClick(this,'${c.name.replace(/'/g,String.fromCharCode(92,39))}',${i})"
                     aria-label="${c.name}"></div>`
        ).join('');
        const showMoreBtn = p.colours.length > 8
            ? `<button class="qv-swatch-more-btn" type="button" onclick="qvToggleSwatches(this)">Show more (${p.colours.length - 8})</button>` : '';
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
        const featuresHTML = p.features.map(f => {
            const d = FEAT_DEF[f]; if (!d) return '';
            return `<div class="qv-feature-item"><div class="qv-feature-icon"><i class="fa-solid ${d.icon}" aria-hidden="true"></i></div><span class="qv-feature-label">${d.label}</span></div>`;
        }).join('');
        const roomsHTML = ROOMS.map(r => {
            const on = p.rooms.includes(r.key);
            return `<div class="qv-room-item ${on?'qv-room-item--on':'qv-room-item--off'}"><i class="fa-solid ${r.icon}" aria-hidden="true"></i><span>${r.label}</span></div>`;
        }).join('');
        const durabilityBars = buildBars(p.durability, 5);
        const softnessBars   = buildBars(p.softness, 5);
        const fittingRate    = (p.fitting_price || 6).toFixed(2);
        return `
            <button class="qv-close" type="button" aria-label="Close quick view"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            <div class="qv-inner">
                <div class="qv-image-col">
                    <div class="qv-main-img-wrap" onclick="if(window.openColourLightbox)openColourLightbox(window._colourLightboxIndex||0)" style="cursor:zoom-in;">
                        <img id="qv-main-img" src="${p.img}" alt="${p.name}" class="qv-main-img">
                        ${badgeHTML}
                        <div class="qv-img-zoom-hint"><i class="fa-solid fa-magnifying-glass-plus"></i></div>
                    </div>
                </div>
                <div class="qv-detail-col">
                    <div class="qv-detail-top">
                        <div class="qv-breadcrumb">${CAT_LABEL[p.category] || p.category}</div>
                        <div class="qv-header-icons">
                            <button class="qv-icon-btn qv-wish-btn" type="button" aria-label="Save to wishlist"><i class="fa-regular fa-heart"></i></button>
                            <button class="qv-icon-btn" type="button" aria-label="Share" onclick="navigator.share?navigator.share({url:window.location.href}):navigator.clipboard.writeText(window.location.href)"><i class="fa-solid fa-share-nodes"></i></button>
                        </div>
                    </div>
                    <h2 class="qv-name">${p.name}</h2>
                    <div class="qv-price-row">
                        <div class="qv-price">£${p.price.toFixed(2)}<small>/m²</small></div>
                        ${wasPriceHTML}${saveHTML}
                    </div>
                    <div class="qv-fitting-line">
                        <i class="fa-solid fa-scissors" aria-hidden="true"></i>
                        Professional fitting from <strong>£${fittingRate}/m²</strong>
                    </div>
                    ${p.colours.length > 0 ? `
                    <div class="qv-colour-section">
                        <div class="qv-col-sublabel">Colour: <span class="qv-colour-name" id="qv-colour-name">${p.colours[0]?.name||''}</span></div>
                        <div class="qv-swatches">${swatchesHTML}${showMoreBtn}</div>
                    </div>` : ''}
                    <p class="qv-desc">${p.description}</p>
                    <div class="qv-actions">
                        <button class="qv-enquire" type="button" data-action="qv-enquire">
                            <i class="fa-solid fa-calendar-check" aria-hidden="true"></i> Book Free Measure
                        </button>
                        <button class="qv-calc-scroll-btn" type="button" onclick="document.getElementById('qv-calc-section')?.scrollIntoView({behavior:'smooth',block:'start'})">
                            <i class="fa-solid fa-calculator" aria-hidden="true"></i> Calculate Price
                        </button>
                    </div>
                    <p class="qv-note">Free in-home measure included. No obligation. We come to you.</p>

                    <div class="qv-divider"></div>
                    <h3 class="qv-col-title">Why You'll Love It</h3>
                    ${featuresHTML ? `<div class="qv-features-grid">${featuresHTML}</div>` : '<p class="qv-no-features">Contact us for full product details.</p>'}
                    <div class="qv-col-sublabel" style="margin:16px 0 10px">Perfect For</div>
                    <div class="qv-room-grid">${roomsHTML}</div>
                    <div class="qv-comfort">
                        <div class="qv-col-sublabel" style="margin-bottom:12px">Comfort &amp; Performance</div>
                        ${(()=>{
                            const mkBars=(v,max)=>Array.from({length:max},(_,i)=>`<div class="qv-bar-seg ${i<v?'qv-bar-seg--on':'qv-bar-seg--off'}"></div>`).join('');
                            const row=(label,bars,val)=>`<div class="qv-bar-row"><span class="qv-bar-label">${label}</span><div class="qv-bar">${bars}</div><span class="qv-bar-val">${val}</span></div>`;
                            const spec=(label,val)=>val?`<div class="qv-spec-row"><span class="qv-spec-label">${label}</span><span class="qv-spec-val">${val}</span></div>`:'';
                            const cat = p.category || '';
                            let html = row('Durability', mkBars(p.durability||0, 5), (p.durability||0)+'/5');

                            if (cat === 'carpets') {
                                // Carpet: softness bar + pile attributes
                                html += row('Softness', mkBars(p.softness||0, 5), (p.softness||0)+'/5');
                                const tMap={'Extra Short':1,'Short':2,'Medium':3,'Deep':4};
                                const dMap={'Loose':1,'Medium':2,'Compact':3,'Extra Compact':4};
                                const tv=tMap[p.thickness]||0;
                                const dv=dMap[p.density]||0;
                                if (tv) html += row('Pile Height', mkBars(tv,4), p.thickness);
                                if (dv) html += row('Density', mkBars(dv,4), p.density);
                                if (p.fibre) html += spec('Fibre', p.fibre);
                                if (p.carpet_style) html += spec('Style', p.carpet_style);
                            } else if (cat === 'vinyl') {
                                // Vinyl: waterproof + thickness + wear layer
                                if (p.thickness_mm) html += spec('Board Thickness', p.thickness_mm + 'mm');
                                if (p.wear_layer_mm) html += spec('Wear Layer', p.wear_layer_mm + 'mm');
                                if (p.plank_width_mm) html += spec('Plank Width', p.plank_width_mm + 'mm');
                                if (p.installation_method) html += spec('Installation', p.installation_method);
                                if (p.lay_pattern) html += spec('Lay Pattern', p.lay_pattern);
                                if (p.ufh_compatible) html += spec('Underfloor Heating', 'Compatible');
                            } else if (cat === 'laminate') {
                                // Laminate: board thickness + AC rating
                                if (p.thickness_mm) html += spec('Board Thickness', p.thickness_mm + 'mm');
                                if (p.ac_rating) html += spec('AC Rating', p.ac_rating);
                                if (p.board_design) html += spec('Design', p.board_design);
                                if (p.plank_width_mm) html += spec('Plank Width', p.plank_width_mm + 'mm');
                                if (p.installation_method) html += spec('Installation', p.installation_method);
                                if (p.ufh_compatible) html += spec('Underfloor Heating', 'Compatible');
                            } else if (cat === 'wood') {
                                // Wood: species + thickness + width + finish
                                if (p.species_finish) html += spec('Species &amp; Finish', p.species_finish);
                                if (p.thickness_mm) html += spec('Board Thickness', p.thickness_mm + 'mm');
                                if (p.plank_width_mm) html += spec('Plank Width', p.plank_width_mm + 'mm');
                                if (p.surface_finish) html += spec('Surface Finish', p.surface_finish);
                                if (p.lay_pattern) html += spec('Lay Pattern', p.lay_pattern);
                                if (p.installation_method) html += spec('Installation', p.installation_method);
                                if (p.ufh_compatible) html += spec('Underfloor Heating', 'Compatible');
                            } else {
                                // Fallback
                                html += row('Softness', mkBars(p.softness||0, 5), (p.softness||0)+'/5');
                            }
                            return html;
                        })()}
                    </div>

                    <div class="qv-divider"></div>
                <div class="qv-calc-col" id="qv-calc-section">
                    <h3 class="qv-col-title">Calculate Your Price</h3>
                    <p class="qv-calc-sub">Pre-loaded with <strong>£${p.price.toFixed(2)}/m²</strong>. Adjust for your room.</p>
                    <div class="qv-calc-mode">
                        <button class="qv-calc-mode-btn active" data-mode="dims" onclick="qvSetMode(this)">Length × Width</button>
                        <button class="qv-calc-mode-btn" data-mode="area" onclick="qvSetMode(this)">Total m²</button>
                    </div>
                    <div id="qv-dims" class="qv-calc-inputs">
                        <div class="qv-calc-field"><label>Length (m)</label><input type="number" id="qv-length" min="0" step="0.1" placeholder="4.5" oninput="qvCalc()"></div>
                        <div class="qv-calc-field"><label>Width (m)</label><input type="number" id="qv-width" min="0" step="0.1" placeholder="3.2" oninput="qvCalc()"></div>
                    </div>
                    <div id="qv-area-panel" class="qv-calc-inputs qv-panel-hidden">
                        <div class="qv-calc-field" style="grid-column:1/-1"><label>Total Area (m²)</label><input type="number" id="qv-area-input" min="0" step="0.5" placeholder="14.4" oninput="qvCalc()"></div>
                    </div>
                    <div class="qv-calc-checks">
                        <label class="qv-calc-check"><input type="checkbox" id="qv-underlay" onchange="qvCalc()"> Include underlay <em>(+£5/m²)</em></label>
                        <label class="qv-calc-check"><input type="checkbox" id="qv-fitting-chk" onchange="qvCalc()"> Include fitting <em>(+£${fittingRate}/m²)</em></label>
                    </div>
                    <div class="qv-calc-result">
                        <div class="qv-calc-result-top">
                            <span class="qv-calc-label">Estimated Total</span>
                            <span class="qv-calc-area-out" id="qv-area-out">0 m²</span>
                        </div>
                        <div class="qv-calc-total" id="qv-calc-total">£0.00</div>
                        <div class="qv-calc-breakdown">
                            <div class="qv-calc-row"><span>Flooring</span><span id="qv-floor-out">—</span></div>
                            <div class="qv-calc-row"><span>Underlay</span><span id="qv-und-out">—</span></div>
                            <div class="qv-calc-row"><span>Fitting</span><span id="qv-fit-out">—</span></div>
                        </div>
                    </div>
                    <button class="qv-pdf-btn" type="button" onclick="qvDownloadPDF()" id="qv-pdf-btn" disabled style="width:100%;justify-content:center;margin-top:0">
                        <i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i> Download Quote as PDF
                    </button>
                    <div class="qv-discount-wrap" id="qv-discount-wrap">
                        <div class="qv-discount-top">
                            <span class="qv-discount-badge"><i class="fa-solid fa-tag"></i> 20% OFF</span>
                            <span class="qv-discount-label">Email us — we'll send your 20% off</span>
                            <span class="qv-discount-price" id="qv-discount-price">—</span>
                        </div>
                        <div class="qv-discount-row">
                            <input type="email" class="qv-discount-input" id="qv-discount-email" placeholder="your@email.com" autocomplete="email">
                            <button class="qv-discount-send" type="button" onclick="qvSendDiscount()">Send</button>
                        </div>
                        <p class="qv-discount-msg" id="qv-discount-msg" hidden></p>
                    </div>
                    <p class="qv-note" style="margin-top:8px">* Estimate only. Wastage &amp; door bars not included.</p>
                    </div>
                </div>
            </div>`;
    }

    function buildBars(value, max) {
        return Array.from({ length: max }, (_, i) =>
            `<div class="bar-seg ${i < value ? 'bar-seg--on' : ''}" aria-hidden="true"></div>`
        ).join('');
    }

    let _currentQVProduct = null;

    function catSwatchClick(el) {
        const card = el.closest('.cat-card');
        if (!card) return;
        card.querySelectorAll('.cat-swatch').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
        // Open lightbox if colour has an image
        const pid = el.dataset.pid;
        const p   = window.getProduct ? window.getProduct(pid) : null;
        if (!p) return;
        const swatches = [...card.querySelectorAll('.cat-swatch')];
        const index    = swatches.indexOf(el);
        if (index === -1) return;
        const c = p.colours[index];
        if (c && c.img_url) {
            _currentQVProduct = p;
            openColourLightbox(index);
        }
    }

    function qvSwatchClick(el, name, index) {
        document.querySelectorAll('.qv-swatch').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
        const n = document.getElementById('qv-colour-name');
        if (n) n.textContent = name;
        if (_currentQVProduct && index !== undefined) {
            const c = _currentQVProduct.colours[index];
            if (c && c.img_url) {
                // Update main image instead of opening lightbox
                const mainImg = document.getElementById('qv-main-img');
                if (mainImg) {
                    mainImg.style.opacity = '0';
                    mainImg.style.transition = 'opacity 0.2s ease';
                    setTimeout(() => {
                        mainImg.src = c.img_url;
                        mainImg.onload = () => { mainImg.style.opacity = '1'; };
                        // If image is cached it won't fire onload
                        if (mainImg.complete) mainImg.style.opacity = '1';
                    }, 150);
                }
                // Keep lightbox index in sync for if they click the main image
                _colourLightboxIndex = index;
            }
        }
    }

    function qvToggleSwatches(btn) {
        const wrap = btn.closest('.qv-swatches');
        if (!wrap) return;
        const allSwatches = wrap.querySelectorAll('.qv-swatch');
        const isExpanded = btn.dataset.expanded === '1';
        allSwatches.forEach((s, i) => {
            if (i >= 8) s.style.display = isExpanded ? '' : 'inline-block';
        });
        btn.dataset.expanded = isExpanded ? '0' : '1';
        btn.textContent = isExpanded ? 'Show more (' + (allSwatches.length - 8) + ')' : 'Show less';
    }

    document.addEventListener('click', function(e) {
        const wishBtn = e.target.closest('.qv-wish-btn');
        if (!wishBtn) return;
        wishBtn.classList.toggle('is-liked');
        const icon = wishBtn.querySelector('i');
        if (icon) icon.className = wishBtn.classList.contains('is-liked') ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    });

    let _colourLightboxIndex = 0;
    function openColourLightbox(index) {
        if (!_currentQVProduct) return;
        _colourLightboxIndex = index;
        const colours = _currentQVProduct.colours.filter(c => c.img_url);
        // If no colour images, fall back to main product image
        if (!colours.length) {
            const mainSrc = document.getElementById('qv-main-img')?.src || _currentQVProduct.img;
            if (!mainSrc) return;
            let overlay = document.getElementById('colour-lightbox');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'colour-lightbox';
                overlay.innerHTML = `
                    <div class="clb-backdrop" onclick="closeColourLightbox()"></div>
                    <div class="clb-box">
                        <button class="clb-close" onclick="closeColourLightbox()" type="button"><i class="fa-solid fa-xmark"></i></button>
                        <img class="clb-img" id="clb-img" src="" alt="">
                        <div class="clb-label" id="clb-label"></div>
                    </div>`;
                document.body.appendChild(overlay);
            }
            const img = overlay.querySelector('#clb-img');
            if (img) { img.src = mainSrc; img.alt = _currentQVProduct.name; }
            const lbl = overlay.querySelector('#clb-label');
            if (lbl) lbl.textContent = _currentQVProduct.name;
            // Hide nav arrows when only one image
            overlay.querySelectorAll('.clb-prev,.clb-next,.clb-dots').forEach(el => el.style.display = 'none');
            overlay.style.display = 'flex';
            overlay.classList.add('is-open');
            document.body.style.overflow = 'hidden';
            return;
        }
        const imgColours = _currentQVProduct.colours;
        // Find index in full colours array
        let overlay = document.getElementById('colour-lightbox');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'colour-lightbox';
            overlay.innerHTML = `
                <div class="clb-backdrop" onclick="closeColourLightbox()"></div>
                <div class="clb-box">
                    <button class="clb-close" onclick="closeColourLightbox()" type="button"><i class="fa-solid fa-xmark"></i></button>
                    <button class="clb-arrow clb-prev" onclick="shiftColourLightbox(-1)" type="button"><i class="fa-solid fa-chevron-left"></i></button>
                    <img class="clb-img" id="clb-img" src="" alt="">
                    <button class="clb-arrow clb-next" onclick="shiftColourLightbox(1)" type="button"><i class="fa-solid fa-chevron-right"></i></button>
                    <div class="clb-label" id="clb-label"></div>
                    <div class="clb-dots" id="clb-dots"></div>
                </div>`;
            document.body.appendChild(overlay);
        }
        renderColourLightbox();
        overlay.style.display = 'flex';
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function renderColourLightbox() {
        if (!_currentQVProduct) return;
        const colours = _currentQVProduct.colours;
        const c = colours[_colourLightboxIndex];
        if (!c) return;
        const img = document.getElementById('clb-img');
        const lbl = document.getElementById('clb-label');
        const dots = document.getElementById('clb-dots');
        if (img) { img.src = c.img_url || ''; img.alt = c.name; }
        if (lbl) lbl.textContent = c.name;
        if (dots) dots.innerHTML = colours.map((col, i) =>
            `<span class="clb-dot${i===_colourLightboxIndex?' active':''}" onclick="shiftColourLightboxTo(${i})"></span>`
        ).join('');
    }

    function shiftColourLightbox(dir) {
        if (!_currentQVProduct) return;
        const len = _currentQVProduct.colours.length;
        _colourLightboxIndex = (_colourLightboxIndex + dir + len) % len;
        renderColourLightbox();
    }

    function shiftColourLightboxTo(i) {
        _colourLightboxIndex = i;
        renderColourLightbox();
    }

    function closeColourLightbox() {
        const overlay = document.getElementById('colour-lightbox');
        if (overlay) {
            overlay.classList.remove('is-open');
            overlay.style.display = '';
        }
        document.body.style.overflow = '';
    }

    function qvDownloadPDF() {
        if (!_currentQVProduct) return;
        const p = _currentQVProduct;

        // ── Gather calc state ─────────────────────────────────────────────────
        const mode = document.querySelector('.qv-calc-mode-btn.active')?.dataset.mode || 'dims';
        let area = 0, length = 0, width = 0;
        if (mode === 'dims') {
            length = parseFloat(document.getElementById('qv-length')?.value) || 0;
            width  = parseFloat(document.getElementById('qv-width')?.value)  || 0;
            area   = parseFloat((length * width).toFixed(2));
        } else {
            area = Math.max(0, parseFloat(document.getElementById('qv-area-input')?.value) || 0);
        }
        const inclUnderlay = document.getElementById('qv-underlay')?.checked    || false;
        const inclFitting  = document.getElementById('qv-fitting-chk')?.checked || false;
        const underlayAmt  = inclUnderlay ? area * 5 : 0;
        const fittingRate  = p.fitting_price || 6;
        const fittingAmt   = inclFitting ? area * fittingRate : 0;
        const flooringAmt  = area * p.price;
        const total        = flooringAmt + underlayAmt + fittingAmt;
        const colourName   = document.getElementById('qv-colour-name')?.textContent || (p.colours?.[0]?.name || '');

        // ── Dates ─────────────────────────────────────────────────────────────
        const now      = new Date();
        const validTo  = new Date(now); validTo.setDate(validTo.getDate() + 30);
        const fmtDate  = d => d.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
        const refNo    = 'WYC-' + now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + String(Math.floor(Math.random()*9000)+1000);

        // ── jsPDF init ────────────────────────────────────────────────────────
        const { jsPDF } = window.jspdf;
        if (!jsPDF) { alert('PDF library not loaded — please try again in a moment.'); return; }
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const W = 210, H = 297;
        const lm = 16, rm = 16, cw = W - lm - rm;
        const col2x = lm + cw * 0.55 + 6; // right column x
        const col1w = cw * 0.55;
        const col2w = cw * 0.45 - 6;

        // Helper shortcuts
        const ink    = [26,  23,  20 ];
        const ink2   = [92,  87,  79 ];
        const ink3   = [156, 149, 137];
        const red    = [224, 48,  64 ];
        const border = [232, 227, 217];
        const bg     = [248, 249, 250];
        const white  = [255, 255, 255];

        const setC = (r,g,b) => doc.setTextColor(r,g,b);
        const setF = (r,g,b) => doc.setFillColor(r,g,b);
        const setD = (r,g,b) => doc.setDrawColor(r,g,b);
        const rule = (x1,y1,x2,y2,lw=0.3) => { doc.setLineWidth(lw); setD(...border); doc.line(x1,y1,x2,y2); };
        const label = (txt, x, y) => {
            doc.setFont('helvetica','bold'); doc.setFontSize(7); setC(...ink3);
            doc.text(txt.toUpperCase(), x, y);
        };

        // ── TOP HEADER: logo + accent line ────────────────────────────
        // Red accent bar — thin, top of page
        setF(...red); doc.rect(0, 0, W, 3, 'F');

        // Logo — loaded from same-origin file (no CORS needed)
        // Logo bottom aligns with Ref: line at y≈22 → height=14mm, width=42mm
        const logoW = 42, logoH = 14;
        // Logo will be embedded at save time — placeholder position reserved

        // Document title — top right
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        setC(...ink);
        doc.text('Estimate', W - rm, 14, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        setC(...ink3);
        doc.text('Ref: ' + refNo, W - rm, 20, { align: 'right' });

        // Thin full-width rule under header
        rule(lm, 25, W - rm, 25, 0.3);

        // ── META ROW: date, valid until, ref ──────────────────────────────────
        let y = 31;
        label('Date', lm, y);
        label('Valid Until', lm + 50, y);
        label('Prepared For', lm + 110, y);
        y += 5;
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); setC(...ink);
        doc.text(fmtDate(now),    lm,       y);
        doc.text(fmtDate(validTo), lm + 50, y);
        doc.text('Customer Copy', lm + 110, y);

        rule(lm, y + 4, W - rm, y + 4, 0.3);
        y += 10;

        // ── TWO-COLUMN BODY ───────────────────────────────────────────────────
        const bodyTop = y;

        // LEFT COLUMN ─────────────────────────────────────────────────────────

        // PRODUCT section
        label('Product', lm, y);
        y += 5;
        doc.setFont('helvetica','bold'); doc.setFontSize(14); setC(...ink);
        doc.text(p.name, lm, y, { maxWidth: col1w });
        y += 7;

        if (colourName) {
            doc.setFont('helvetica','normal'); doc.setFontSize(9); setC(...ink2);
            doc.text('Colour: ' + colourName, lm, y);
            y += 5;
        }

        const cat = p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1) : '';
        if (cat) {
            doc.setFont('helvetica','normal'); doc.setFontSize(8); setC(...ink3);
            doc.text(cat, lm, y);
            y += 4;
        }

        // Price per m²  pill
        y += 2;
        setF(...red);
        doc.roundedRect(lm, y, 38, 7, 2, 2, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(9); setC(...white);
        doc.text('£' + p.price.toFixed(2) + ' / m²', lm + 19, y + 4.8, { align: 'center' });
        y += 12;

        // ROOM section
        rule(lm, y, lm + col1w, y);
        y += 6;
        label('Room Measurements', lm, y);
        y += 5;
        doc.setFont('helvetica','normal'); doc.setFontSize(10); setC(...ink);
        if (mode === 'dims' && length && width) {
            doc.text(length + ' m  ×  ' + width + ' m', lm, y);
            y += 5;
        }
        doc.text('Total area: ' + (area || 0) + ' m²', lm, y);
        y += 10;

        // PRICE BREAKDOWN section
        rule(lm, y, lm + col1w, y);
        y += 6;
        label('Price Breakdown', lm, y);
        y += 6;

        const bRows = [
            { label: 'Flooring (' + p.price.toFixed(2) + '/m²)', val: area > 0 ? '£' + flooringAmt.toFixed(2) : '—', main: true },
            { label: 'Underlay (+£5.00/m²)',                       val: inclUnderlay ? '£' + underlayAmt.toFixed(2) : 'Not included', main: false },
            { label: 'Fitting (+£' + fittingRate.toFixed(2) + '/m²)', val: inclFitting ? '£' + fittingAmt.toFixed(2) : 'Not included', main: false },
        ];

        bRows.forEach(row => {
            doc.setFont('helvetica', row.main ? 'bold' : 'normal');
            doc.setFontSize(9.5);
            setC(... (row.main ? ink : ink2));
            doc.text(row.label, lm, y);
            doc.setFont('helvetica', row.main ? 'bold' : 'normal');
            setC(... (row.main ? ink : ink2));
            doc.text(row.val, lm + col1w, y, { align: 'right' });
            rule(lm, y + 2, lm + col1w, y + 2, 0.2);
            y += 8;
        });

        // TOTAL box
        y += 2;
        setF(...bg); doc.roundedRect(lm, y, col1w, 18, 3, 3, 'F');
        setD(...border); doc.setLineWidth(0.5);
        doc.roundedRect(lm, y, col1w, 18, 3, 3, 'S');
        // Left side label
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); setC(...ink2);
        doc.text('ESTIMATED TOTAL', lm + 5, y + 7);
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setC(...ink3);
        doc.text('inc. selected extras', lm + 5, y + 12);
        // Right side total
        doc.setFont('helvetica','bold'); doc.setFontSize(18); setC(...red);
        doc.text(area > 0 ? '£' + total.toFixed(2) : '£0.00', lm + col1w - 5, y + 12, { align: 'right' });
        y += 24;

        // ── 20% Discount callout ──────────────────────────────────────────
        y += 10;  // extra gap so right-column card has more height
        const discountTotal = (total * 0.8);
        setD(...red); doc.setLineWidth(0.5);
        // Dashed border (draw as short segments)
        const dashLen = 3, gapLen = 2;
        const boxW = col1w, boxH = 18;
        for (let x = lm; x < lm + boxW; x += dashLen + gapLen) {
            doc.line(x, y, Math.min(x + dashLen, lm + boxW), y);
            doc.line(x, y + boxH, Math.min(x + dashLen, lm + boxW), y + boxH);
        }
        for (let yy = y; yy < y + boxH; yy += dashLen + gapLen) {
            doc.line(lm, yy, lm, Math.min(yy + dashLen, y + boxH));
            doc.line(lm + boxW, yy, lm + boxW, Math.min(yy + dashLen, y + boxH));
        }
        // Red badge
        setF(...red); doc.roundedRect(lm + 4, y + 4, 22, 5.5, 1.5, 1.5, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(6.5); setC(...white);
        doc.text('20% OFF', lm + 15, y + 8, { align: 'center' });
        // Text
        doc.setFont('helvetica','normal'); doc.setFontSize(8); setC(...ink2);
        doc.text('With discount you could pay just:', lm + 29, y + 7.5);
        doc.setFont('helvetica','bold'); doc.setFontSize(11); setC(...red);
        doc.text(area > 0 ? '£' + discountTotal.toFixed(2) : '—', lm + 29, y + 14);
        doc.setFont('helvetica','italic'); doc.setFontSize(6.5); setC(...ink3);
        doc.text('Share your email below to receive your discount', lm + col1w - 4, y + 14, { align: 'right' });
        y += boxH + 6;

        // Disclaimer
        doc.setFont('helvetica','italic'); doc.setFontSize(7); setC(...ink3);
        doc.text('* Estimate only. Excludes wastage, door bars, gripper rods & subfloor prep.', lm, y, { maxWidth: col1w });
        y += 5;

        const leftColBottom = y; // capture for right column alignment

        // RIGHT COLUMN ────────────────────────────────────────────────────────
        let ry = bodyTop;

        // Product image — fetch & embed if available
        // Use currently displayed image — already loaded in browser, no CORS
        const imgUrl = document.getElementById('qv-main-img')?.src || p.image_url || p.img || '';
        const imgH   = 58;
        const imgW   = col2w;

        // Draw image box (placeholder border — will be filled async below)
        setD(...border); doc.setLineWidth(0.4);
        doc.roundedRect(col2x, ry, imgW, imgH, 3, 3, 'S');
        // "No image" fallback text
        doc.setFont('helvetica','normal'); doc.setFontSize(8); setC(...ink3);
        doc.text('Product Image', col2x + imgW/2, ry + imgH/2, { align:'center', baseline:'middle' });

        ry += imgH + 8;

        // ── CONTACT CARD ──────────────────────────────────────────────────────
        const cardX = col2x, cardY = ry, cardW = col2w;
        const charcoal = [32, 32, 38];

        const taglineH = 9;
        const totalCardH = Math.max(76, leftColBottom - cardY - taglineH);
        const headerH = 13;
        const footerH = 11;
        const bodyH = totalCardH - headerH - footerH;

        // 6 rows — phone, address, web, tiktok, instagram, facebook
        const contactRows = [
            { src:'images/contact/iconphone.png',    text:'07449 188 303' },
            { src:'images/contact/iconlocation.png', text:'14-16 Northgate, Dewsbury WF13 1DT' },
            { src:'images/contact/iconweb.png',      text:'westyorkshirecarpets.com' },
            { src:'images/contact/icontiktok.png',   text:'@14northgateroad' },
            { src:'images/contact/iconinstagram.png',text:'@westyorkshire_carpet' },
            { src:'images/contact/iconfacebook.png', text:'@14northgateroad' },
        ];
        const nRows = contactRows.length;
        const rH = bodyH / nRows;

        // ── Card base: white, fully rounded, light border
        setF(255,255,255); doc.roundedRect(cardX, cardY, cardW, totalCardH, 3, 3, 'F');
        setD(218, 213, 203); doc.setLineWidth(0.3);
        doc.roundedRect(cardX, cardY, cardW, totalCardH, 3, 3, 'S');

        // ── Header: full charcoal, rounded top, square bottom
        setF(...charcoal); doc.roundedRect(cardX, cardY, cardW, headerH, 3, 3, 'F');
        setF(...charcoal); doc.rect(cardX, cardY + headerH - 4, cardW, 4, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(7.8); setC(255,255,255);
        doc.text('WEST YORKSHIRE CARPETS', cardX + cardW/2, cardY + 8.5, { align:'center', charSpace: 0.2 });

        // ── 6 rows: icon + value, vertically centred
        contactRows.forEach((row, i) => {
            const rY = cardY + headerH + i * rH;
            const midY = rY + rH / 2;
            if (i > 0) {
                setD(232, 227, 217); doc.setLineWidth(0.2);
                doc.line(cardX + 9, rY, cardX + cardW - 3, rY);
            }
            doc.setFont('helvetica','normal'); doc.setFontSize(6.8); setC(...ink);
            doc.text(row.text, cardX + 10, midY + 2.3, { maxWidth: cardW - 13 });
        });

        // ── Footer: red, square top / rounded bottom
        const footerY = cardY + headerH + bodyH;
        setF(...red); doc.rect(cardX, footerY, cardW, footerH - 3, 'F');
        setF(...red); doc.roundedRect(cardX, footerY + footerH - 3 - 3, cardW, 6, 3, 3, 'F');
        const badges = ['Free Measuring', 'Fully Insured', 'Prof. Fitting'];
        const bCol = cardW / 3;
        // True vertical centre: footerH=11, cap-height ~3.5pt → midpoint at footerY+5.5, adjust for baseline
        const badgeY = footerY + 6.2;
        badges.forEach((b, i) => {
            doc.setFont('helvetica','bold'); doc.setFontSize(5.2); setC(255,255,255);
            doc.text(b, cardX + bCol * i + bCol / 2, badgeY, { align:'center' });
        });

        // ── Tagline below card
        const tagY = cardY + totalCardH + 4;
        doc.setFont('helvetica','italic'); doc.setFontSize(7); setC(...ink3);
        doc.text('Family-run, locally trusted flooring specialists', cardX + cardW/2, tagY, { align:'center', maxWidth: cardW });

        ry = tagY + 5;

        // ── FOOTER ────────────────────────────────────────────────────────────
        // Thin red line above footer
        setF(...red); doc.rect(0, H - 16, W, 0.8, 'F');
        // Footer bar
        setF(26,23,20); doc.rect(0, H - 15.2, W, 15.2, 'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5); setC(...white);
        doc.text('Ready to book? Call 07449 188 303 or visit westyorkshirecarpets.com', W/2, H - 9, { align:'center' });
        doc.setFont('helvetica','normal'); doc.setFontSize(7); setC(156,149,137);
        doc.text('Free measuring · Professional fitting · West Yorkshire · This estimate is valid for 30 days from date of issue', W/2, H - 4.5, { align:'center' });

        // ── Save — then try to embed product image if available ───────────────
        const safeName = p.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const fileName = 'wyc-estimate-' + safeName + '.pdf';

        // Load logo (same origin — no CORS) then product image, then save
        const embedProductImage = (onDone) => {
            if (!imgUrl) { onDone(); return; }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width  = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
                    doc.addImage(dataUrl, 'JPEG', col2x, bodyTop, col2w, imgH, undefined, 'FAST');
                } catch(e) {
                    // CORS blocked — show website link instead
                    setF(248,249,250); doc.roundedRect(col2x, bodyTop, col2w, imgH, 3, 3, 'F');
                    setD(...border); doc.setLineWidth(0.4); doc.roundedRect(col2x, bodyTop, col2w, imgH, 3, 3, 'S');
                    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setC(...ink3);
                    doc.text('View product at', col2x + col2w/2, bodyTop + imgH/2 - 3, { align:'center' });
                    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); setC(...ink2);
                    doc.text('westyorkshirecarpets.com', col2x + col2w/2, bodyTop + imgH/2 + 4, { align:'center' });
                }
                onDone();
            };
            img.onerror = () => onDone();
            img.src = imgUrl + (imgUrl.includes('?') ? '&' : '?') + '_pdf=1';
        };

        // Helper: load an image and return canvas dataUrl, or null on fail
        const loadImgDataUrl = (src, type, cb) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth; c.height = img.naturalHeight;
                    c.getContext('2d').drawImage(img, 0, 0);
                    cb(c.toDataURL('image/' + type));
                } catch(e) { cb(null); }
            };
            img.onerror = () => cb(null);
            img.src = src;
        };

        // Step 1: load logo
        loadImgDataUrl('images/logo2.png', 'png', (logoData) => {
            if (logoData) {
                try { doc.addImage(logoData, 'PNG', lm, 8, logoW, logoH); } catch(e) {}
            }

            // Step 2: load contact icons and draw them into card rows
            // 6 icon rows — phone, location, web, tiktok, instagram, facebook
            const iconSrcs = [
                'images/contact/iconphone.png',
                'images/contact/iconlocation.png',
                'images/contact/iconweb.png',
                'images/contact/icontiktok.png',
                'images/contact/iconinstagram.png',
                'images/contact/iconfacebook.png',
            ];
            let iconsLoaded = 0;
            const iconSize = 3.8;

            iconSrcs.forEach((src, i) => {
                loadImgDataUrl(src, 'png', (data) => {
                    if (data) {
                        const rY = cardY + headerH + i * rH;
                        const iconY = rY + rH/2 - iconSize/2;
                        try { doc.addImage(data, 'PNG', cardX + 3.8, iconY, iconSize, iconSize); } catch(e) {}
                    }
                    iconsLoaded++;
                    if (iconsLoaded === iconSrcs.length) {
                        embedProductImage(() => doc.save(fileName));
                    }
                });
            });
        });
    }

    function qvSetMode(btn) {
        document.querySelectorAll('.qv-calc-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        const d = document.getElementById('qv-dims');
        const a = document.getElementById('qv-area-panel');
        if (d) d.classList.toggle('qv-panel-hidden', mode !== 'dims');
        if (a) a.classList.toggle('qv-panel-hidden', mode !== 'area');
        qvCalc();
    }

    function qvCalc() {
        if (!_currentQVProduct) return;
        const p    = _currentQVProduct;
        const mode = document.querySelector('.qv-calc-mode-btn.active')?.dataset.mode || 'dims';
        let area   = 0;
        if (mode === 'dims') {
            const l = parseFloat(document.getElementById('qv-length')?.value) || 0;
            const w = parseFloat(document.getElementById('qv-width')?.value)  || 0;
            area = parseFloat((l * w).toFixed(2));
        } else {
            area = Math.max(0, parseFloat(document.getElementById('qv-area-input')?.value) || 0);
        }
        const underlay = document.getElementById('qv-underlay')?.checked     ? area * 5 : 0;
        const fitting  = document.getElementById('qv-fitting-chk')?.checked  ? area * (p.fitting_price || 6) : 0;
        const flooring = area * p.price;
        const total    = flooring + underlay + fitting;
        const fmt = v => v > 0 ? '£' + v.toFixed(2) : '—';
        const el  = id => document.getElementById(id);
        if (el('qv-area-out'))   el('qv-area-out').textContent   = area ? area + ' m²' : '0 m²';
        if (el('qv-calc-total')) el('qv-calc-total').textContent = area > 0 ? '£' + total.toFixed(2) : '£0.00';
        if (el('qv-floor-out'))  el('qv-floor-out').textContent  = area > 0 ? '£' + flooring.toFixed(2) : '—';
        if (el('qv-und-out'))    el('qv-und-out').textContent    = fmt(underlay);
        if (el('qv-fit-out'))    el('qv-fit-out').textContent    = fmt(fitting);
        // Update 20% discount teaser
        const discountEl = el('qv-discount-price');
        if (discountEl) discountEl.textContent = area > 0 ? '£' + (total * 0.8).toFixed(2) : '—';
        // Enable PDF button only when area is entered
        const pdfBtn = el('qv-pdf-btn');
        if (pdfBtn) pdfBtn.disabled = area <= 0;
    }


    
    async function handleLike(productId, btn) {
        const icon = btn.querySelector('i');
        const isLiked = btn.classList.contains('is-liked');
        const action = isLiked ? 'unlike' : 'like';

        // Optimistic UI update
        btn.classList.toggle('is-liked', !isLiked);
        icon.className = isLiked ? 'fa-regular fa-heart' : 'fa-solid fa-heart';
        btn.style.color = isLiked ? '' : '#E03040';
        btn.style.transform = 'scale(1.25)';
        setTimeout(() => btn.style.transform = '', 250);

        // Persist in sessionStorage
        if (isLiked) {
            sessionStorage.removeItem(`liked-${productId}`);
        } else {
            sessionStorage.setItem(`liked-${productId}`, '1');
        }

        // Send to backend
        try {
            const res = await fetch(`https://wyc-backend-production-ed78.up.railway.app/api/products/${productId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            if (res.ok) {
                const data = await res.json();
                const countEl = document.getElementById(`like-count-${productId}`);
                if (countEl) countEl.textContent = data.likes > 0 ? data.likes : '';
            }
        } catch(e) {
            console.warn('Like failed silently', e);
        }
    }

    function restoreLikes() {
        document.querySelectorAll('.cat-card-like').forEach(btn => {
            const pid = btn.dataset.id;
            if (sessionStorage.getItem(`liked-${pid}`)) {
                btn.classList.add('is-liked');
                const icon = btn.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-heart';
                btn.style.color = '#E03040';
            }
        });
    }

    function enquireAbout(productId) {
        if (window.closeNavMenu) window.closeNavMenu();
        const p = PRODUCTS.find(prod => prod.id === productId);
        if (!p) return;

        close();

        setTimeout(() => {
            const section     = document.getElementById('contact');
            const msgField    = document.getElementById('f-message');
            const serviceField = document.getElementById('f-service');

            if (section) {
                // On mobile scroll to the form directly, on desktop to the section
                const isMobile = window.innerWidth < 768;
                const formEl = document.getElementById('lead-form');
                const target = isMobile && formEl ? formEl : section;
                const hdr = document.getElementById('site-header');
                const offset = hdr ? hdr.getBoundingClientRect().height : 0;
                const top = target.getBoundingClientRect().top + window.scrollY - offset - 12;
                window.scrollTo({ top, behavior: 'smooth' });
            }

            // Focus Full Name field so user can start typing immediately
            setTimeout(() => {
                const nameField = document.getElementById('f-name');
                if (nameField) {
                    nameField.focus();
                    nameField.style.borderColor = 'var(--red)';
                    setTimeout(() => { nameField.style.borderColor = ''; }, 2000);
                }
            }, 600);

            if (msgField) {
                msgField.value = `I'm interested in the ${p.name} (£${p.price.toFixed(2)}/m²). Please contact me to arrange a free measure and quote.`;
            }

            if (serviceField) {
                const serviceMap = {
                    carpets:  'Carpet Fitting',
                    vinyl:    'Vinyl Installation',
                    laminate: 'Laminate / Wood',
                    wood:     'Laminate / Wood',
                };
                const target = serviceMap[p.category];
                if (target) {
    for (let i = 0; i < serviceField.options.length; i++) {
        if (serviceField.options[i].text.trim() === target) {
            serviceField.selectedIndex = i;
            const dd = document.getElementById('form-service-dropdown');
            const lbl = document.getElementById('form-service-label');
            if (lbl) lbl.textContent = target;
            if (dd) {
                dd.querySelectorAll('.form-dropdown-item').forEach(item => {
                    const isMatch = item.dataset.value === target;
                    item.classList.toggle('is-selected', isMatch);
                    item.setAttribute('aria-selected', String(isMatch));
                });
            }
            break;
        }
    }
}
            }

            showToast(`Enquiry pre-filled for "${p.name}"`);
        }, 380);
    }

    function requestSample(productId) {
        const p = PRODUCTS.find(prod => prod.id === productId);
        if (!p) return;

        close();

        setTimeout(() => {
            const section  = document.getElementById('contact');
            const msgField = document.getElementById('f-message');

            if (section) {
                // On mobile scroll to the form directly, on desktop to the section
                const isMobile = window.innerWidth < 768;
                const formEl = document.getElementById('lead-form');
                const target = isMobile && formEl ? formEl : section;
                const hdr = document.getElementById('site-header');
                const offset = hdr ? hdr.getBoundingClientRect().height : 0;
                const top = target.getBoundingClientRect().top + window.scrollY - offset - 12;
                window.scrollTo({ top, behavior: 'smooth' });
            }

            if (msgField) {
                msgField.value = `Could you please send me a free sample of the ${p.name}? I'd like to see the colour and texture before making a decision.`;
                msgField.style.borderColor = 'var(--red)';
                setTimeout(() => { msgField.style.borderColor = ''; }, 2000);
            }

            showToast(`Sample request pre-filled for "${p.name}"`);
        }, 380);
    }

    
    let _toastTimer = null;

    function showToast(message) {
        if (!DOM.toast) return;
        DOM.toast.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i> ${message}`;
        DOM.toast.classList.add('is-visible');

        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => {
            DOM.toast.classList.remove('is-visible');
        }, 3500);
    }

    
    function bindTriggers() {
        document.querySelectorAll('[data-catalogue]').forEach(el => {
            el.addEventListener('click', e => {
                e.preventDefault();
                open(el.dataset.catalogue);
            });
        });

        document.querySelectorAll('.flooring-card').forEach(card => {
            const cat  = card.dataset.id;
            const link = card.querySelector('.card-link');
            if (cat && link) {
                link.addEventListener('click', e => {
                    e.preventDefault();
                    open(cat);
                });
            }
        });
    }

    function getCountForFilter(filterKey, value) {
        let products = PRODUCTS.slice();
        if (state.activeCategory === 'deals') products = products.filter(p => p.deal);
        else if (state.activeCategory !== 'all') products = products.filter(p => p.category === state.activeCategory);
        if (state.activePriceRange === 'budget') products = products.filter(p => p.price < 20);
        else if (state.activePriceRange === 'mid') products = products.filter(p => p.price >= 20 && p.price <= 40);
        else if (state.activePriceRange === 'premium') products = products.filter(p => p.price > 40);
        if (filterKey !== 'room' && state.activeRooms && state.activeRooms.length > 0)
            products = products.filter(p => state.activeRooms.some(r => p.rooms && p.rooms.includes(r)));
        if (filterKey !== 'feature' && state.activeFeatures && state.activeFeatures.length > 0)
            products = products.filter(p => state.activeFeatures.every(f => p.features && p.features.includes(f)));
        if (filterKey !== 'colour_family' && state.activeColourFamily) products = products.filter(p => p.colour_family === state.activeColourFamily);
        if (filterKey !== 'fibre' && state.activeFibre) products = products.filter(p => p.fibre === state.activeFibre);
        if (filterKey !== 'carpet_style' && state.activeCarpetStyle) products = products.filter(p => p.carpet_style === state.activeCarpetStyle);
        if (filterKey !== 'installation_method' && state.activeInstallMethod) products = products.filter(p => p.installation_method === state.activeInstallMethod);
        if (filterKey !== 'lay_pattern' && state.activeLayPattern) products = products.filter(p => p.lay_pattern === state.activeLayPattern);
        if (filterKey !== 'ac_rating' && state.activeAcRating) products = products.filter(p => p.ac_rating === state.activeAcRating);
        if (filterKey !== 'board_design' && state.activeBoardDesign) products = products.filter(p => p.board_design === state.activeBoardDesign);
        if (filterKey !== 'surface_finish' && state.activeSurfaceFinish) products = products.filter(p => p.surface_finish === state.activeSurfaceFinish);
        if (filterKey !== 'thickness' && state.activeThickness) products = products.filter(p => p.thickness === state.activeThickness);
        if (filterKey !== 'density' && state.activeDensity) products = products.filter(p => p.density === state.activeDensity);
        if (filterKey !== 'softness_label' && state.activeSoftnessLabel) products = products.filter(p => p.softness_label === state.activeSoftnessLabel);
        if (filterKey === 'room') return products.filter(p => p.rooms && p.rooms.includes(value)).length;
        if (filterKey === 'feature') return products.filter(p => p.features && p.features.includes(value)).length;
        if (filterKey === 'colour_family') return products.filter(p => p.colour_family === value).length;
        if (filterKey === 'fibre') return products.filter(p => p.fibre === value).length;
        if (filterKey === 'carpet_style') return products.filter(p => p.carpet_style === value).length;
        if (filterKey === 'thickness') return products.filter(p => p.thickness === value).length;
        if (filterKey === 'density') return products.filter(p => p.density === value).length;
        if (filterKey === 'softness_label') return products.filter(p => p.softness_label === value).length;
        return 0;
    }

    function updateChipCounts() {
        const drawer = document.getElementById('cat-filter-drawer');
        if (!drawer) return;
        drawer.querySelectorAll('.cfd-chip[data-filter][data-value]').forEach(chip => {
            const f = chip.dataset.filter;
            const v = chip.dataset.value;
            if (f === 'price' || f === 'special') return;
            if (f === 'room' && v === 'all') return;
            const count = getCountForFilter(f, v);
            let badge = chip.querySelector('.chip-count');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'chip-count';
                chip.appendChild(badge);
            }
            badge.textContent = count > 0 ? count : '';
            badge.style.display = count > 0 ? 'inline' : 'none';
            chip.style.opacity = count === 0 ? '0.4' : '1';
        });
    }

    function updateTabCounts() {
        document.querySelectorAll('.cat-tab[data-cat]').forEach(tab => {
            const cat = tab.dataset.cat;
            let count;
            if (cat === 'all') count = PRODUCTS.length;
            else if (cat === 'deals') count = PRODUCTS.filter(p => p.deal).length;
            else count = PRODUCTS.filter(p => p.category === cat).length;
            let badge = tab.querySelector('.tab-count');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'tab-count';
                tab.appendChild(badge);
            }
            badge.textContent = count;
        });
    }

    function bindOverlayEvents() {
        DOM.backdrop.addEventListener('click', close);

        DOM.closeBtn.addEventListener('click', close);

        // Escape handled by master keydown listener below

        DOM.tabs.addEventListener('click', e => {
            const btn = e.target.closest('.cat-tab');
            if (btn) setCategory(btn.dataset.cat);
        });

        // ── Filter drawer ──
        function positionFilterDrawer() {
            if (!DOM.filterBtn || !DOM.filterDrawer) return;
            const btn    = DOM.filterBtn.getBoundingClientRect();
            const panel  = DOM.panel ? DOM.panel.getBoundingClientRect() : null;
            const vw     = window.innerWidth;
            const vh     = window.innerHeight;
            const isMobile = vw < 640;
            const MARGIN   = 12;
            const GAP      = 12; // consistent gap between header and drawer on both breakpoints

            // ── Top: relative to panel top so drawer always stays inside body ─
            // Use panel.top + cat-header height as the anchor.
            // cat-header is sticky inside #cat-panel — measure it directly.
            let top;
            if (panel) {
                const catHeader = DOM.panel.querySelector('.cat-header');
                const headerH   = catHeader ? catHeader.getBoundingClientRect().height : 0;
                top = Math.round(panel.top + headerH + GAP);
            } else {
                top = Math.round(btn.bottom + GAP);
            }
            // Safety: never above viewport
            top = Math.max(top, MARGIN);
            const maxH = Math.min(520, vh - top - MARGIN);

            // ── Width ─────────────────────────────────────────────────────────
            const w = isMobile
                ? vw - MARGIN * 2        // mobile: edge-to-edge with margins
                : Math.min(460, vw - MARGIN * 2);

            // ── Horizontal placement ──────────────────────────────────────────
            let left, right;
            if (isMobile) {
                left  = MARGIN;
                right = 'auto';
            } else {
                // Align right edge of drawer with right edge of button, clamped
                let r = vw - btn.right;
                r = Math.max(MARGIN, r);
                if (btn.right - w < MARGIN) r = vw - w - MARGIN;
                left  = 'auto';
                right = Math.round(r);
            }

            const d = DOM.filterDrawer.style;
            d.position  = 'fixed';
            d.top       = top + 'px';
            d.maxHeight = maxH + 'px';
            d.width     = w + 'px';
            d.left      = isMobile ? left + 'px' : 'auto';
            d.right     = isMobile ? 'auto' : right + 'px';
        }

        // Reposition on resize (only when open)
        let _filterResizeRAF = null;
        function _onFilterResize() {
            if (!DOM.filterDrawer || !DOM.filterDrawer.classList.contains('is-open')) return;
            cancelAnimationFrame(_filterResizeRAF);
            _filterResizeRAF = requestAnimationFrame(positionFilterDrawer);
        }
        window.addEventListener('resize', _onFilterResize, { passive: true });

        // Close when catalogue body scrolls (drawer is fixed, content moves away)
        const _catBody = DOM.catBody || document.getElementById('cat-body');
        if (_catBody) {
            _catBody.addEventListener('scroll', () => {
                if (DOM.filterDrawer && DOM.filterDrawer.classList.contains('is-open')) {
                    closeFilterDrawer();
                }
            }, { passive: true });
        }

        function openFilterDrawer() {
            if (!DOM.filterDrawer) return;
            positionFilterDrawer();
            DOM.filterDrawer.removeAttribute('hidden');
            requestAnimationFrame(() => DOM.filterDrawer.classList.add('is-open'));
            DOM.filterBtn && DOM.filterBtn.classList.add('is-active');
        }
        function closeFilterDrawer() {
            if (!DOM.filterDrawer) return;
            DOM.filterDrawer.classList.remove('is-open');
            DOM.filterBtn && DOM.filterBtn.classList.remove('is-active');
            setTimeout(() => DOM.filterDrawer.setAttribute('hidden', ''), 200);
        }
        function updateFilterBadge() {
            let count = 0;
            if (state.activePriceRange !== 'all') count++;
            count += (state.activeRooms || []).length;
            count += (state.activeFeatures || []).length;
            if (state.activeSpecial) count++;
            if (state.activeColourFamily) count++;
            if (state.activeFibre) count++;
            if (state.activeCarpetStyle) count++;
            if (state.activeSoftnessLabel) count++;
            if (state.activeThickness) count++;
            if (state.activeDensity) count++;
            if (DOM.filterBadge) {
                DOM.filterBadge.textContent = count;
                DOM.filterBadge.hidden = count === 0;
            }
            DOM.filterBtn && DOM.filterBtn.classList.toggle('has-active', count > 0);
        }
        if (DOM.filterBtn) {
            DOM.filterBtn.addEventListener('click', () => {
                DOM.filterDrawer && !DOM.filterDrawer.classList.contains('is-open')
                    ? openFilterDrawer() : closeFilterDrawer();
            });
        }
        if (DOM.filterClose) DOM.filterClose.addEventListener('click', closeFilterDrawer);
        if (DOM.cfdApply) DOM.cfdApply.addEventListener('click', closeFilterDrawer);
        // Colour show more toggle
        const colourToggle = document.getElementById('cfd-colour-toggle');
        if (colourToggle) {
            colourToggle.addEventListener('click', e => {
                e.stopPropagation();
                const hidden = document.querySelectorAll('.cfd-colour-more[hidden]');
                const visible = document.querySelectorAll('.cfd-colour-more:not([hidden])');
                if (hidden.length > 0) {
                    hidden.forEach(el => el.removeAttribute('hidden'));
                    colourToggle.textContent = '− Show less';
                } else {
                    visible.forEach(el => el.setAttribute('hidden', ''));
                    colourToggle.textContent = '+ Show more';
                }
            });
        }

        if (DOM.cfdReset) DOM.cfdReset.addEventListener('click', () => {
            state.activePriceRange = 'all';
            state.activeRooms = [];
            state.activeFeatures = [];
            state.activeSpecial = null;
            state.activeColourFamily = '';
            state.activeFibre = '';
            state.activeCarpetStyle = '';
            state.activeSoftnessLabel = '';
            state.activeThickness = '';
            state.activeDensity = '';
            if (DOM.filterDrawer) {
                DOM.filterDrawer.querySelectorAll('.cfd-chip').forEach(c => c.classList.remove('is-selected'));
                DOM.filterDrawer.querySelectorAll('.cfd-chip[data-value="all"]').forEach(c => c.classList.add('is-selected'));
            }
            updateFilterBadge();
            renderGrid();
        });
        if (DOM.filterDrawer) {
            DOM.filterDrawer.addEventListener('click', e => {
                const chip = e.target.closest('.cfd-chip');
                if (!chip) return;
                const f = chip.dataset.filter, v = chip.dataset.value;
                if (f === 'price') {
                    DOM.filterDrawer.querySelectorAll('[data-filter="price"]').forEach(c => c.classList.remove('is-selected'));
                    chip.classList.add('is-selected');
                    state.activePriceRange = v;
                }
                if (f === 'room') {
                    if (v === 'all') {
                        state.activeRooms = [];
                        DOM.filterDrawer.querySelectorAll('[data-filter="room"]').forEach(c => c.classList.remove('is-selected'));
                        DOM.filterDrawer.querySelector('[data-filter="room"][data-value="all"]').classList.add('is-selected');
                    } else {
                        const idx = state.activeRooms.indexOf(v);
                        if (idx === -1) state.activeRooms.push(v);
                        else state.activeRooms.splice(idx, 1);
                        chip.classList.toggle('is-selected', state.activeRooms.includes(v));
                        const allBtn = DOM.filterDrawer.querySelector('[data-filter="room"][data-value="all"]');
                        if (allBtn) allBtn.classList.toggle('is-selected', state.activeRooms.length === 0);
                    }
                }
                if (f === 'feature') {
                    if (!state.activeFeatures) state.activeFeatures = [];
                    const idx = state.activeFeatures.indexOf(v);
                    if (idx === -1) state.activeFeatures.push(v);
                    else state.activeFeatures.splice(idx, 1);
                    chip.classList.toggle('is-selected', state.activeFeatures.includes(v));
                }
                if (f === 'special') {
                    state.activeSpecial = state.activeSpecial === v ? null : v;
                    DOM.filterDrawer.querySelectorAll('[data-filter="special"]').forEach(c => c.classList.remove('is-selected'));
                    if (state.activeSpecial) chip.classList.add('is-selected');
                }
                const singleFilters = {
                    colour_family: 'activeColourFamily',
                    fibre: 'activeFibre',
                    carpet_style: 'activeCarpetStyle',
                    softness_label: 'activeSoftnessLabel',
                    thickness: 'activeThickness',
                    density: 'activeDensity'
                };
                if (singleFilters[f]) {
                    const stateKey = singleFilters[f];
                    const isActive = chip.classList.contains('is-selected');
                    DOM.filterDrawer.querySelectorAll(`[data-filter="${f}"]`).forEach(c => c.classList.remove('is-selected'));
                    if (!isActive) { chip.classList.add('is-selected'); state[stateKey] = v; }
                    else { state[stateKey] = ''; }
                }
                updateFilterBadge();
                renderGrid();
            });
        }



const sortDropdown = document.getElementById('cat-sort-dropdown');
const sortLabel    = document.getElementById('cat-sort-label');

if (sortDropdown) {
    sortDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        const item = e.target.closest('.cat-sort-item');
        if (item) {
            sortDropdown.querySelectorAll('.cat-sort-item').forEach(i => {
                i.classList.remove('is-selected');
                i.setAttribute('aria-selected', 'false');
            });
            item.classList.add('is-selected');
            item.setAttribute('aria-selected', 'true');
            sortLabel.textContent = item.textContent;
            DOM.sortSelect.value = item.dataset.value;
            sortDropdown.classList.remove('is-open');
            sortDropdown.setAttribute('aria-expanded', 'false');
            setSort(item.dataset.value);
            return;
        }
        const isOpen = sortDropdown.classList.contains('is-open');
        sortDropdown.classList.toggle('is-open', !isOpen);
        sortDropdown.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('click', function(e) {
        if (!sortDropdown.contains(e.target)) {
            sortDropdown.classList.remove('is-open');
            sortDropdown.setAttribute('aria-expanded', 'false');
        }
    });

    sortDropdown.addEventListener('keydown', function(e) {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            sortDropdown.classList.toggle('is-open');
        }
        if (e.key === 'Escape') {
            sortDropdown.classList.remove('is-open');
        }
    });
}

        DOM.grid.addEventListener('click', e => {
            const qvBtn      = e.target.closest('[data-action="quick-view"]');
            const enquireBtn = e.target.closest('[data-action="enquire"]');
            const likeBtn = e.target.closest('[data-action="like"]');
            if (qvBtn) { e.stopPropagation(); openQuickView(qvBtn.dataset.id); }
            if (enquireBtn) enquireAbout(enquireBtn.dataset.id);
            if (likeBtn) { e.stopPropagation(); handleLike(likeBtn.dataset.id, likeBtn); }
        });

        if (DOM.resetBtn) {
            DOM.resetBtn.addEventListener('click', () => {
                state.activePriceRange = 'all';
                state.activeCategory   = 'all';
                state.activeSort       = 'default';
                if (DOM.sortSelect) DOM.sortSelect.value = 'default';
                
                syncHeader();
                syncTabs();
                syncPriceFilters();
                renderGrid();
            });
        }

        if (DOM.qv) {
            DOM.qv.addEventListener('click', e => {
                if (e.target === DOM.qv) closeQuickView();
            });
        }

        DOM.panel.addEventListener('click', e => e.stopPropagation());
    }

    
    async function init() {
        const overlay = document.getElementById('cat-overlay');
        if (!overlay) {
            console.warn('[WYCCatalogue] Overlay HTML not found. See integration instructions.');
            return;
        }

        DOM = {
            overlay,
            backdrop:     overlay.querySelector('#cat-backdrop'),
            panel:        overlay.querySelector('#cat-panel'),
            closeBtn:     overlay.querySelector('#cat-close'),
            title:        overlay.querySelector('#cat-title'),
            desc:         overlay.querySelector('#cat-desc'),
            tabs:         overlay.querySelector('#cat-tabs'),
            filterBtn:      overlay.querySelector('#cat-filter-btn'),
            filterDrawer:   overlay.querySelector('#cat-filter-drawer'),
            filterClose:    overlay.querySelector('#cat-filter-close'),
            filterBadge:    overlay.querySelector('#cat-filter-badge'),
            cfdReset:       overlay.querySelector('#cfd-reset'),
            cfdApply:       overlay.querySelector('#cfd-apply'),
            catBody:        overlay.querySelector('#cat-body'),

            sortSelect:   overlay.querySelector('#cat-sort'),
            body:         overlay.querySelector('#cat-body'),
            grid:         overlay.querySelector('#cat-grid'),
            empty:        overlay.querySelector('#cat-empty'),
            resetBtn:     overlay.querySelector('#cat-reset-btn'),
            qv:           overlay.querySelector('#cat-qv'),
            qvPanel:      overlay.querySelector('#cat-qv-panel'),
            toast:        document.getElementById('cat-toast'),
        };

        try {
            const res = await fetch('https://wyc-backend-production-ed78.up.railway.app/api/products');
            const data = await res.json();
            PRODUCTS = data.map(p => ({
                id:            String(p.id),
                name:          p.name,
                category:      p.category_slug,
                price:         parseFloat(p.price),
                originalPrice: p.original_price ? parseFloat(p.original_price) : null,
                badge:         p.badge || null,
                badgeType:     p.badge_type || null,
                img:           p.img_url || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=700&q=80',
                description:   p.description || '',
                specs:         {},
                durability:    p.durability || 3,
                softness:      p.softness || 3,
                featured:      !!p.is_featured,
                deal:          !!p.is_deal,
                fitting_price: parseFloat(p.fitting_price) || 6.00,
                likes:         parseInt(p.likes) || 0,
                colour_family: p.colour_family || '',
                fibre:          p.fibre || '',
                carpet_style:   p.carpet_style || '',
                softness_label: p.softness_label || '',
                thickness:      p.thickness || '',
                density:        p.density || '',
                thickness_mm:   p.thickness_mm || null,
                wear_layer_mm:  p.wear_layer_mm || null,
                ac_rating:      p.ac_rating || '',
                board_design:   p.board_design || '',
                plank_width_mm: p.plank_width_mm || null,
                species_finish: p.species_finish || '',
                surface_finish: p.surface_finish || '',
                lay_pattern:    p.lay_pattern || '',
                installation_method: p.installation_method || '',
                ufh_compatible: p.ufh_compatible || 0,
                colours:       (() => { try { if (!p.colours) return []; if (Array.isArray(p.colours)) return p.colours; return JSON.parse(p.colours); } catch(e) { return []; } })(),
                features:      (() => { try { if (!p.features) return []; if (Array.isArray(p.features)) return p.features; return JSON.parse(p.features); } catch(e) { return []; } })(),
                rooms:         (() => { try { if (!p.rooms) return []; if (Array.isArray(p.rooms)) return p.rooms; const s = String(p.rooms).trim(); if (s.startsWith('{')) return s.slice(1,-1).split(',').map(x=>x.replace(/"/g,'').trim()).filter(Boolean); const parsed = JSON.parse(s); return Array.isArray(parsed) ? parsed : []; } catch(e) { return []; } })(),
            }));
        } catch(e) {
            console.error('[WYCCatalogue] Failed to load products from API:', e);
        }

        bindTriggers();
        bindOverlayEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    
    window.WYCCatalogue = { open, close };


    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        const lb = document.getElementById('colour-lightbox');
        if (lb && lb.classList.contains('is-open')) {
            closeColourLightbox();
            return;
        }
        if (DOM.qv && !DOM.qv.hasAttribute('hidden')) {
            closeQuickView();
            return;
        }
        if (state.isOpen) {
            close();
        }
    });

    // Expose calculator + swatch functions to global scope for inline onclick handlers
    window.getProduct           = id => PRODUCTS.find(x => String(x.id) === String(id));
    window.qvSetMode            = qvSetMode;
    window.qvCalc               = qvCalc;
    window.qvSwatchClick        = qvSwatchClick;
    window.catSwatchClick       = catSwatchClick;
    window.openColourLightbox   = openColourLightbox;
    Object.defineProperty(window, '_colourLightboxIndex', { get: () => _colourLightboxIndex, set: v => { _colourLightboxIndex = v; } });
    window.closeColourLightbox  = closeColourLightbox;
    window.qvDownloadPDF        = qvDownloadPDF;

    function qvToggleDiscount() {
        document.getElementById('qv-discount-email')?.focus();
    }

    async function qvSendDiscount() {
        const emailEl = document.getElementById('qv-discount-email');
        const msgEl   = document.getElementById('qv-discount-msg');
        const email   = emailEl ? emailEl.value.trim() : '';

        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            if (msgEl) { msgEl.textContent = 'Please enter a valid email.'; msgEl.style.color = 'var(--red)'; msgEl.removeAttribute('hidden'); }
            return;
        }

        const sendBtn = document.querySelector('.qv-discount-send');
        if (sendBtn) { sendBtn.textContent = 'Sending…'; sendBtn.disabled = true; }

        try {
            await fetch('https://wyc-backend-production-ed78.up.railway.app/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    name: 'Discount Signup',
                    message: 'Requested 20% discount code via product calculator.',
                    source: 'discount_widget',
                    website: ''
                })
            });
            document.getElementById('qv-discount-expand')?.setAttribute('hidden', '');
            if (msgEl) {
                msgEl.textContent = 'Done! Check your inbox — we\'ve sent your 20% off instructions.';
                msgEl.style.color = 'var(--green, #1A6B4A)';
                msgEl.removeAttribute('hidden');
            }
        } catch (e) {
            if (msgEl) { msgEl.textContent = 'Something went wrong — please try again.'; msgEl.style.color = 'var(--red)'; msgEl.removeAttribute('hidden'); }
        } finally {
            if (sendBtn) { sendBtn.textContent = 'Send'; sendBtn.disabled = false; }
        }
    }

    window.qvToggleDiscount = qvToggleDiscount;
    window.qvSendDiscount   = qvSendDiscount;
    window.shiftColourLightbox  = shiftColourLightbox;
    window.shiftColourLightboxTo = shiftColourLightboxTo;

})();