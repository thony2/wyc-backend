const PRICING = {
    flooring: {
        carpet_budget:  { rate: 5.99 },
        carpet_premium: { rate: 25  },
        vinyl_standard: { rate: 8.50 },
        vinyl_premium:  { rate: 16   },
        vinyl:          { rate: 15  },
        laminate:       { rate: 20  },
        wood:           { rate: 45  },
    },
    underlay: 5,
    fitting:  6,
};

const header = document.getElementById('site-header');
const siteLogo = document.getElementById('site-logo');
window.addEventListener('scroll', () => {
    const isScrolled = window.scrollY > 60;
    header.classList.toggle('scrolled', isScrolled);
    if (siteLogo) {
        siteLogo.src = isScrolled ? 'images/logo2.svg' : 'images/logo.svg';
    }
}, { passive: true });

const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobile-nav');
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileNav.classList.toggle('open');
});

window.closeNavMenu = function() {
    hamburger.classList.remove('open');
    mobileNav.classList.remove('open');
};

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

let calcMode = 'dimensions';

const calcLength   = document.getElementById('calc-length');
const calcWidth    = document.getElementById('calc-width');
const calcAreaIn   = document.getElementById('calc-area-input');
const calcType     = document.getElementById('calc-type');
const calcUnderlay = document.getElementById('calc-underlay');
const calcFitting  = document.getElementById('calc-fitting');
const calcTotalEl  = document.getElementById('calc-total');
const calcAreaEl   = document.getElementById('calc-area');
const outFlooring  = document.getElementById('out-flooring');
const outUnderlay  = document.getElementById('out-underlay');
const outFitting   = document.getElementById('out-fitting');
const dimRow       = document.getElementById('calc-dim-row');
const areaRow      = document.getElementById('calc-area-row');

function setCalcMode(mode) {
    calcMode = mode;
    document.querySelectorAll('.calc-mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === mode)
    );
    if (dimRow)  dimRow.classList.toggle('is-active',  mode === 'dimensions');
    if (areaRow) areaRow.classList.toggle('is-active', mode === 'area');
    calculateQuote();
}

document.querySelectorAll('.calc-mode-btn').forEach(btn =>
    btn.addEventListener('click', () => setCalcMode(btn.dataset.mode))
);

function formatGBP(v) { return v > 0 ? `£${v.toFixed(2)}` : '—'; }

function calculateQuote() {
    let area = 0;
    if (calcMode === 'dimensions') {
        const l = parseFloat(calcLength?.value) || 0;
        const w = parseFloat(calcWidth?.value)  || 0;
        area    = parseFloat((l * w).toFixed(2));
    } else {
        area = Math.max(0, parseFloat(calcAreaIn?.value) || 0);
    }

    const typeKey = calcType?.value || 'carpet_budget';
    const rate    = PRICING.flooring[typeKey]?.rate ?? 10;

    const flooringCost = area * rate;
    const underlayCost = calcUnderlay?.checked ? area * PRICING.underlay : 0;
    const fittingCost  = calcFitting?.checked  ? area * PRICING.fitting  : 0;
    const total        = flooringCost + underlayCost + fittingCost;

    if (calcAreaEl)  calcAreaEl.textContent  = area || 0;
    if (calcTotalEl) calcTotalEl.textContent = area > 0 ? `£${total.toFixed(2)}` : '£0.00';
    if (outFlooring) outFlooring.textContent = area > 0 ? `£${flooringCost.toFixed(2)}` : '—';
    if (outUnderlay) outUnderlay.textContent = formatGBP(underlayCost);
    if (outFitting)  outFitting.textContent  = formatGBP(fittingCost);
}

[calcLength, calcWidth, calcAreaIn, calcType, calcUnderlay, calcFitting]
    .filter(Boolean)
    .forEach(el => {
        el.addEventListener('input',  calculateQuote);
        el.addEventListener('change', calculateQuote);
    });

if (dimRow)  dimRow.classList.add('is-active');
if (areaRow) areaRow.classList.remove('is-active');
calculateQuote();

(function initCalcDropdown() {
    const dropdown     = document.getElementById('calc-dropdown');
    const hiddenSelect = document.getElementById('calc-type');
    const labelEl      = document.getElementById('calc-dropdown-label');
    const list         = document.getElementById('calc-dropdown-list');
    if (!dropdown || !hiddenSelect) return;

    function selectItem(item) {
        list.querySelectorAll('.calc-dropdown-item').forEach(i => {
            i.classList.remove('is-selected');
            i.setAttribute('aria-selected', 'false');
        });
        item.classList.add('is-selected');
        item.setAttribute('aria-selected', 'true');
        labelEl.textContent = item.textContent;
        hiddenSelect.value  = item.dataset.value;
        dropdown.classList.remove('is-open');
        dropdown.setAttribute('aria-expanded', 'false');
        calculateQuote();
    }

    dropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        const item = e.target.closest('.calc-dropdown-item');
        if (item) { selectItem(item); return; }
        const isOpen = dropdown.classList.contains('is-open');
        dropdown.classList.toggle('is-open', !isOpen);
        dropdown.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('is-open');
            dropdown.setAttribute('aria-expanded', 'false');
        }
    });

    dropdown.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dropdown.classList.toggle('is-open');
        }
        if (e.key === 'Escape') {
            dropdown.classList.remove('is-open');
        }
    });
})();

(function initFormServiceDropdown() {
    const dropdown     = document.getElementById('form-service-dropdown');
    const hiddenSelect = document.getElementById('f-service');
    const labelEl      = document.getElementById('form-service-label');
    if (!dropdown || !hiddenSelect) return;

    function selectItem(item) {
        dropdown.querySelectorAll('.form-dropdown-item').forEach(i => {
            i.classList.remove('is-selected');
            i.setAttribute('aria-selected', 'false');
        });
        item.classList.add('is-selected');
        item.setAttribute('aria-selected', 'true');
        labelEl.textContent = item.textContent;
        hiddenSelect.value  = item.dataset.value;
        dropdown.classList.remove('is-open');
        dropdown.setAttribute('aria-expanded', 'false');
    }

    dropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        const item = e.target.closest('.form-dropdown-item');
        if (item) { selectItem(item); return; }
        const isOpen = dropdown.classList.contains('is-open');
        dropdown.classList.toggle('is-open', !isOpen);
        dropdown.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('is-open');
            dropdown.setAttribute('aria-expanded', 'false');
        }
    });

    dropdown.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dropdown.classList.toggle('is-open');
        }
        if (e.key === 'Escape') {
            dropdown.classList.remove('is-open');
        }
    });
})();

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const id = this.getAttribute('href');
        if (id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            target.scrollIntoView({ behavior: 'instant' });
            return;
        }

        const from     = window.scrollY;
        const to       = target.getBoundingClientRect().top + window.scrollY;
        const dist     = Math.abs(to - from);
        const duration = Math.min(Math.max(dist * 0.4, 400), 900);
        let   started  = null;

        const ease = t => t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;

        function step(ts) {
            if (!started) started = ts;
            const p = ease(Math.min((ts - started) / duration, 1));
            window.scrollTo(0, from + (to - from) * p);
            if (ts - started < duration) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    });
});

(function initLightbox() {
    const overlay  = document.getElementById('lightbox-overlay');
    const lbImg    = document.getElementById('lightbox-img');
    const lbCap    = document.getElementById('lightbox-caption');
    const lbCount  = document.getElementById('lightbox-counter');
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn  = document.getElementById('lightbox-prev');
    const nextBtn  = document.getElementById('lightbox-next');
    if (!overlay) return;

    let items = [];
    let current = 0;

    function lbOpen(i) {
        current = ((i % items.length) + items.length) % items.length;
        lbImg.src  = items[current].src;
        lbImg.alt  = items[current].alt;
        lbCap.textContent   = items[current].caption;
        lbCount.textContent = (current + 1) + ' / ' + items.length;
        prevBtn.hidden = nextBtn.hidden = items.length < 2;
        overlay.removeAttribute('hidden');
        requestAnimationFrame(() => overlay.classList.add('open'));
        document.body.style.overflow = 'hidden';
        closeBtn.focus();
    }

    function lbClose() {
        overlay.classList.remove('open');
        overlay.addEventListener('transitionend', () =>
            overlay.setAttribute('hidden', ''), { once: true });
        document.body.style.overflow = '';
    }

    function bindGallery() {
        items = [];
        document.querySelectorAll('.gallery-item').forEach(function(el, i) {
            const imgEl = el.querySelector('img');
            const capEl = el.querySelector('.gallery-overlay span');
            items.push({
                src:     imgEl ? imgEl.getAttribute('src') : '',
                alt:     imgEl ? imgEl.alt : '',
                caption: capEl ? capEl.textContent.trim() : ''
            });
            el.style.cursor = 'pointer';
            el.setAttribute('tabindex', '0');
            el.onclick = function() { lbOpen(i); };
        });
    }

    closeBtn.addEventListener('click', lbClose);
    prevBtn.addEventListener('click',  function() { lbOpen(current - 1); });
    nextBtn.addEventListener('click',  function() { lbOpen(current + 1); });
    overlay.addEventListener('click',  function(e) { if (e.target === overlay) lbClose(); });
    document.addEventListener('keydown', function(e) {
        if (!overlay.classList.contains('open')) return;
        if (e.key === 'Escape')     lbClose();
        if (e.key === 'ArrowLeft')  lbOpen(current - 1);
        if (e.key === 'ArrowRight') lbOpen(current + 1);
    });

    bindGallery();
})();