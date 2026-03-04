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
        activeSort:       'default',
        isOpen:           false,
    };

    
    let DOM = {};

    
    function lockScroll() {
        const sb = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow    = 'hidden';
        document.body.style.paddingRight = sb + 'px';
        const hdr = document.getElementById('site-header');
        if (hdr) hdr.style.paddingRight = sb + 'px';
    }

    function unlockScroll() {
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
        renderGrid();

        DOM.overlay.removeAttribute('hidden');
        lockScroll();
        state.isOpen = true;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                DOM.overlay.classList.add('is-open');
                DOM.overlay.setAttribute('aria-hidden', 'false');
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
        DOM.overlay.setAttribute('hidden', '');
        DOM.overlay.setAttribute('aria-hidden', 'true');
        unlockScroll();
        state.isOpen = false;
    }

    
    function setCategory(category) {
        state.activeCategory = category;
        syncHeader();
        syncTabs();
        renderGrid();
        if (DOM.body) DOM.body.scrollTop = 0;
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
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        });
    }

    function syncPriceFilters() {
        if (!DOM.priceFilters) return;
        DOM.priceFilters.querySelectorAll('.cat-price-btn').forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.price === state.activePriceRange);
        });
    }

    
    function renderGrid() {
        const products = getFilteredProducts();

        if (DOM.count) {
            DOM.count.textContent = products.length
                ? `${products.length} product${products.length !== 1 ? 's' : ''}`
                : '';
        }

        if (!DOM.grid) return;

        if (products.length === 0) {
            DOM.grid.innerHTML = '';
            if (DOM.empty) DOM.empty.removeAttribute('hidden');
            return;
        }

        if (DOM.empty) DOM.empty.setAttribute('hidden', '');

        DOM.grid.innerHTML = products
            .map((product, index) => buildCardHTML(product, index))
            .join('');
    }

    function buildCardHTML(p, index) {
        const badgeHTML = p.badge && p.badgeType
            ? `<div class="cat-card-badge ${BADGE_CLASS[p.badgeType] || ''}">${p.badge}</div>`
            : '';

        const wasPriceHTML = p.originalPrice
            ? `<span class="cat-card-price-was">£${p.originalPrice.toFixed(2)}</span>`
            : '';

        const roomsHTML = ROOMS.map(r => `
            <span class="room-pill ${p.rooms.includes(r.key) ? 'room-pill--on' : ''}"
                  title="${r.label}"
                  aria-label="${r.label} — ${p.rooms.includes(r.key) ? 'suitable' : 'not recommended'}">
                <i class="fa-solid ${r.icon}"></i>
            </span>`).join('');

        const specPills = Object.values(p.specs)
            .slice(0, 3)
            .map(v => `<span>${v}</span>`)
            .join('');

        const delay = Math.min(index * 55, 300);

        return `
            <article class="cat-card${p.badgeType === 'sale' ? ' is-sale' : ''}"
                     data-product-id="${p.id}"
                     style="animation-delay: ${delay}ms"
                     tabindex="0"
                     role="group"
                     aria-label="${p.name}, ${CAT_LABEL[p.category] || p.category}, £${p.price.toFixed(2)} per square metre">
                <div class="cat-card-img-wrap">
                    <img src="${p.img}"
                         alt="${p.name} flooring"
                         class="cat-card-img"
                         loading="lazy"
                         decoding="async">
                    ${badgeHTML}
                    <div class="cat-card-qv-overlay">
                        <button class="cat-card-qv-btn"
                                data-action="quick-view"
                                data-id="${p.id}"
                                type="button"
                                aria-label="Quick view ${p.name}">
                            <i class="fa-solid fa-expand" aria-hidden="true"></i>
                            Quick View
                        </button>
                    </div>
                </div>
                <div class="cat-card-body">
                    <div class="cat-card-meta">
                        <span class="cat-card-cat">${CAT_LABEL[p.category] || p.category}</span>
                        <div class="cat-card-pricing">
                            ${wasPriceHTML}
                            <span class="cat-card-price">£${p.price.toFixed(2)}<small>/m²</small></span>
                        </div>
                    </div>
                    <h3 class="cat-card-name">${p.name}</h3>
                    <div class="cat-card-specs" aria-label="Specifications">${specPills}</div>
                    <div class="cat-card-rooms" aria-label="Room suitability">${roomsHTML}</div>
                    <button class="cat-card-enquire"
                            data-action="enquire"
                            data-id="${p.id}"
                            type="button"
                            aria-label="Enquire about ${p.name}">
                        Enquire About This
                    </button>
                </div>
            </article>`;
    }

    
    function openQuickView(productId) {
        const p = PRODUCTS.find(prod => prod.id === productId);
        if (!p || !DOM.qv || !DOM.qvPanel) return;

        DOM.qvPanel.innerHTML = buildQuickViewHTML(p);
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
        _hideQV(true);
    }

    function _hideQV(animated) {
        if (!DOM.qv) return;
        DOM.qv.setAttribute('hidden', '');
        DOM.qv.classList.remove('is-open', 'is-closing');
    }

    function buildQuickViewHTML(p) {
        const badgeHTML = p.badge && p.badgeType
            ? `<div class="cat-card-badge ${BADGE_CLASS[p.badgeType] || ''}">${p.badge}</div>`
            : '';

        const wasPriceHTML = p.originalPrice
            ? `<div class="qv-price-was">£${p.originalPrice.toFixed(2)}</div>`
            : '';

        const specsHTML = Object.entries(p.specs).map(([k, v]) => `
            <div class="qv-spec-item">
                <span class="qv-spec-key">${k}</span>
                <span class="qv-spec-val">${v}</span>
            </div>`).join('');

        const roomsHTML = ROOMS.map(r => `
            <div class="qv-room ${p.rooms.includes(r.key) ? 'qv-room--on' : ''}"
                 aria-label="${r.label} — ${p.rooms.includes(r.key) ? 'suitable' : 'not recommended'}">
                <i class="fa-solid ${r.icon}" aria-hidden="true"></i>
                <span>${r.label}</span>
            </div>`).join('');

        const coloursHTML = p.colours
            .map(c => `<span class="qv-colour">${c}</span>`)
            .join('');

        const durabilityBars = buildBars(p.durability, 5);
        const softnessBars   = buildBars(p.softness, 5);

        return `
            <button class="qv-close" type="button" aria-label="Close quick view">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
            <div class="qv-inner">
                <div class="qv-image-wrap">
                    <img src="${p.img}" alt="${p.name}" class="qv-image">
                    ${badgeHTML}
                </div>
                <div class="qv-content">
                    <div class="qv-header">
                        <span class="cat-card-cat">${CAT_LABEL[p.category] || p.category}</span>
                        <div class="qv-pricing">
                            ${wasPriceHTML}
                            <div class="qv-price">£${p.price.toFixed(2)}<small>/m²</small></div>
                        </div>
                    </div>

                    <h2 class="qv-name">${p.name}</h2>
                    <p class="qv-desc">${p.description}</p>

                    <div class="qv-bars">
                        <div class="qv-bar-row">
                            <span class="qv-bar-label">Durability</span>
                            <div class="qv-bar" aria-label="Durability ${p.durability} out of 5">
                                ${durabilityBars}
                            </div>
                        </div>
                        <div class="qv-bar-row">
                            <span class="qv-bar-label">Softness</span>
                            <div class="qv-bar" aria-label="Softness ${p.softness} out of 5">
                                ${softnessBars}
                            </div>
                        </div>
                    </div>

                    <div class="qv-section-title">Specifications</div>
                    <div class="qv-specs">${specsHTML}</div>

                    <div class="qv-section-title">Room Suitability</div>
                    <div class="qv-rooms">${roomsHTML}</div>

                    <div class="qv-section-title">Available Colours</div>
                    <div class="qv-colours">${coloursHTML}</div>

                    <div class="qv-actions">
                        <button class="qv-enquire" type="button" data-action="qv-enquire">
                            <i class="fa-solid fa-tape" aria-hidden="true"></i>
                            Enquire &amp; Get Quote
                        </button>
                        <button class="qv-sample" type="button" data-action="qv-sample">
                            Request Free Sample
                        </button>
                    </div>
                    <p class="qv-note">Free measure &amp; quote included with every enquiry. No obligation.</p>
                </div>
            </div>`;
    }

    function buildBars(value, max) {
        return Array.from({ length: max }, (_, i) =>
            `<div class="bar-seg ${i < value ? 'bar-seg--on' : ''}" aria-hidden="true"></div>`
        ).join('');
    }

    
    function enquireAbout(productId) {
        const p = PRODUCTS.find(prod => prod.id === productId);
        if (!p) return;

        close();

        setTimeout(() => {
            const section     = document.getElementById('contact');
            const msgField    = document.getElementById('f-message');
            const serviceField = document.getElementById('f-service');

            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });

            if (msgField) {
                msgField.value = `I'm interested in the ${p.name} (£${p.price.toFixed(2)}/m²). Please contact me to arrange a free measure and quote.`;
                msgField.style.borderColor = 'var(--red)';
                setTimeout(() => { msgField.style.borderColor = ''; }, 2000);
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

            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });

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

    function bindOverlayEvents() {
        DOM.backdrop.addEventListener('click', close);

        DOM.closeBtn.addEventListener('click', close);

        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            if (DOM.qv && !DOM.qv.hasAttribute('hidden')) {
                closeQuickView();
            } else {
                close();
            }
        });

        DOM.tabs.addEventListener('click', e => {
            const btn = e.target.closest('.cat-tab');
            if (btn) setCategory(btn.dataset.cat);
        });

        DOM.priceFilters.addEventListener('click', e => {
            const btn = e.target.closest('.cat-price-btn');
            if (btn) setPrice(btn.dataset.price);
        });

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
            if (qvBtn) { e.stopPropagation(); openQuickView(qvBtn.dataset.id); }
            if (enquireBtn) enquireAbout(enquireBtn.dataset.id);
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
            count:        overlay.querySelector('#cat-count'),
            tabs:         overlay.querySelector('#cat-tabs'),
            priceFilters: overlay.querySelector('#cat-price-filters'),
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
                colours:       [],
                rooms:         (() => { try { return JSON.parse(p.rooms || '[]'); } catch(e) { return []; } })(),
                durability:    p.durability || 3,
                softness:      p.softness || 3,
                featured:      p.is_featured === 1,
                deal:          p.is_deal === 1,
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

})();
