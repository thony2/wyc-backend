(function () {
    'use strict';

    const API_URL = 'https://wyc-backend-production-ed78.up.railway.app/api/leads';

    function getCalculatorData() {
        const length = parseFloat(document.getElementById('calc-length')?.value);
        const width  = parseFloat(document.getElementById('calc-width')?.value);
        if (!length || !width || isNaN(length) || isNaN(width)) return {};
        const totalText = document.getElementById('calc-total')?.textContent || '';
        const estimated = parseFloat(totalText.replace(/[^0-9.]/g, '')) || null;
        return {
            room_length_m:    length,
            room_width_m:     width,
            flooring_type:    document.getElementById('calc-type')?.value || null,
            include_underlay: document.getElementById('calc-underlay')?.checked || false,
            include_fitting:  document.getElementById('calc-fitting')?.checked || false,
            estimated_cost:   estimated,
        };
    }

    function setLoading(btn, isLoading) {
        if (!btn) return;
        if (isLoading) {
            btn.disabled = true;
            btn.dataset.originalHtml = btn.innerHTML;
            btn.innerHTML = '<span class="btn-spinner"></span><span>Sending…</span>';
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalHtml || '<span>Send Request</span>';
        }
    }

    function showSuccess(form) {
        Array.from(form.elements).forEach(el => {
            if (el.closest('.form-group')) {
                el.closest('.form-group').style.display = 'none';
            }
        });
        const submitBtn  = form.querySelector('button[type="submit"]');
        const formNote   = form.querySelector('.form-note');
        const consentDiv = form.querySelector('.form-group--consent');
        const honeypot   = form.querySelector('.honeypot-field');
        if (submitBtn)  submitBtn.style.display  = 'none';
        if (formNote)   formNote.style.display   = 'none';
        if (consentDiv) consentDiv.style.display = 'none';
        if (honeypot)   honeypot.style.display   = 'none';

        const successEl = document.createElement('div');
        successEl.className = 'form-success';
        successEl.innerHTML = `
            <div class="form-success__icon">
                <i class="fa-solid fa-circle-check"></i>
            </div>
            <h4 class="form-success__title">Request sent — thank you!</h4>
            <p class="form-success__message">
                We'll be in touch within 24 hours to arrange your 
                free, no-obligation measure.
            </p>
            <p class="form-success__message">
                Prefer to speak now? Call us on
                <a href="tel:07449188303" 
                   style="color:#DE3848;font-weight:600;">
                   07449 188 303
                </a>
            </p>
        `;
        form.appendChild(successEl);
        successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function showError(form, message) {
        let errorEl = form.querySelector('.form-error-general');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'form-error-general';
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                form.insertBefore(errorEl, submitBtn);
            } else {
                form.appendChild(errorEl);
            }
        }
        errorEl.innerHTML = `
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>${message}</span>
        `;
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function clearErrors(form) {
        form.querySelectorAll('.form-error-general, .field-error').forEach(el => el.remove());
        form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const form      = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        clearErrors(form);

        const payload = {
            name:         (document.getElementById('f-name')?.value     || '').trim(),
            email:        (document.getElementById('f-email')?.value    || '').trim(),
            phone:        (document.getElementById('f-phone')?.value    || '').trim(),
            postcode:     (document.getElementById('f-postcode')?.value || '').trim(),
            service_type: (document.getElementById('f-service')?.value  || '').trim(),
            message:      (document.getElementById('f-message')?.value  || '').trim(),
            gdpr_consent: document.getElementById('f-consent')?.checked || false,
            website:      (document.getElementById('f-website')?.value  || '').trim(),
            ...getCalculatorData(),
        };

        if (!payload.name || payload.name.length < 2) {
            showError(form, 'Please enter your full name.');
            return;
        }
        if (!payload.phone || payload.phone.length < 10) {
            showError(form, 'Please enter a valid phone number.');
            return;
        }
        if (!payload.postcode || payload.postcode.length < 3) {
            showError(form, 'Please enter your postcode.');
            return;
        }

        setLoading(submitBtn, true);

        try {
    const response = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.success) {
        showSuccess(form);
        history.replaceState(null, '', window.location.pathname);
    } else if (response.status === 429) {
        showError(form, 'Too many requests. Please wait a few minutes or call us on <a href="tel:07449188303" style="color:#DE3848;font-weight:600;">07449 188 303</a>.');
    } else if (response.status === 422 && data.fields) {
        const firstError = data.fields[0];
        showError(form, firstError.message);
    } else {
        showError(form, data.error || 'Something went wrong. Please call us on <a href="tel:07449188303" style="color:#DE3848;font-weight:600;">07449 188 303</a>.');
    }
} catch (err) {
    showError(form, 'Could not reach the server. Please check your connection or call us on <a href="tel:07449188303" style="color:#DE3848;font-weight:600;">07449 188 303</a>.');
} finally {
    setLoading(submitBtn, false);
}
    }

    function prefillFromUrl() {
        // Reads /?product=Abyss#lead-form and pre-fills the message field
        const params = new URLSearchParams(window.location.search);
        const product = params.get('product');
        if (!product) return;
        const msgField = document.getElementById('f-message');
        if (msgField && !msgField.value) {
            msgField.value = `I'm interested in ${product} — please contact me to arrange a free measure.`;
        }
    }

    function init() {
        const form = document.getElementById('lead-form');
        if (!form) return;
        form.addEventListener('submit', handleSubmit);
        prefillFromUrl();

        const style = document.createElement('style');
        style.textContent = `
            .form-error-general {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 14px 16px;
                background: rgba(222,56,72,0.07);
                border: 1px solid rgba(222,56,72,0.25);
                border-radius: 4px;
                font-size: 0.86rem;
                color: #2E2F36;
                line-height: 1.6;
                margin-bottom: 16px;
            }
            .form-error-general i { color: #DE3848; flex-shrink: 0; margin-top: 2px; }
            .form-success { text-align: center; padding: 28px 20px; background: #F0EEE4; border-radius: 8px; margin-top: 16px; animation: fadeUp 0.4s ease both; }
            .form-success__icon { font-size: 2rem; color: #27AE60; margin-bottom: 12px; }
            .form-success__title { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; font-weight: 600; color: #2E2F36; margin: 0 0 8px; }
            .form-success__message { font-size: 0.9rem; color: #A2A8B0; line-height: 1.6; margin: 0 0 8px; }
            .btn-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.35); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `;
        document.head.appendChild(style);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
