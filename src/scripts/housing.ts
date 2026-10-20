import './analytics.ts';
import { connectFormService, type FormConfig } from './form-service.ts';
import { mountPassStatus } from './pass-status.ts';
import { isPlainClick, setUpLightbox } from './lightbox.ts';

type HousingForm = HTMLFormElement & {
    elements: HTMLFormControlsCollection & {
        requester: RadioNodeList;
        company: HTMLInputElement;
        units: HTMLInputElement;
    };
};

const form = document.querySelector<HousingForm>('#housing-form');
if (form) initHousing(form);

// Every photo and floor plan links to its full-size file; plain clicks open them in one lightbox instead.
const photos = [...document.querySelectorAll<HTMLAnchorElement>('[data-gallery-item]')];
const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');
if (dialog && photos.length) {
    const lightbox = setUpLightbox(dialog, {
        length: () => photos.length,
        render(index, parts) {
            const link = photos[index], alt = link.querySelector('img')?.alt ?? '';
            parts.image.src = link.href;
            parts.image.alt = alt;
            parts.title.textContent = link.dataset.title ?? alt;
            parts.count.textContent = `${index + 1} of ${photos.length}`;
            parts.meta.textContent = link.dataset.note ?? '';
            parts.full.href = link.href;
        },
        preload: index => { new Image().src = photos[index].href; },
        opener: index => photos[index],
    });
    photos.forEach((link, index) => link.addEventListener('click', event => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        lightbox.show(index);
    }));
}

const pass = document.querySelector<HTMLElement>('[data-pass]');
if (pass) {
    const passStatus = mountPassStatus(pass);
    const refreshMs = 5 * 60 * 1000;
    let last = Date.now();
    void passStatus.load();
    // Refresh only while visible, like /teton-pass/.
    const refresh = () => {
        if (document.visibilityState !== 'visible' || Date.now() - last < refreshMs)
            return;
        last = Date.now();
        void passStatus.load();
    };
    setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
}

function initHousing(form: HousingForm) {
    const status = form.ownerDocument.querySelector<HTMLElement>('#housing-status')!, button = form.querySelector<HTMLButtonElement>('.submit-button')!;
    const { requester, company, units } = form.elements;
    let config: FormConfig = { enabled: false, mode: 'production', siteKey: '' }, token = '', widget: string | undefined;

    function setRequester() {
        const employer = requester.value === 'employer';
        form.querySelectorAll<HTMLElement>('[data-employer-only]').forEach(wrapper => {
            wrapper.hidden = !employer;
            wrapper.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach(input => input.disabled = !employer);
        });
        company.required = employer;
        units.max = employer ? '50' : '2';
    }
    function show(message: string, kind = '') { status.textContent = message; status.className = 'form-status ' + kind; }
    function readiness() { button.disabled = !(config.mode === 'local-preview' || token); }

    setRequester();
    form.querySelectorAll('input[name="requester"]').forEach(radio => radio.addEventListener('change', setRequester));

    connectFormService({ action: 'housing', container: '#housing-turnstile', onToken: value => { token = value; readiness(); }, show }).then(result => {
        ({ config, widget } = result);
        if (config.mode === 'local-preview')
            readiness();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.reportValidity())
            return;
        button.disabled = true;
        const label = button.textContent;
        button.textContent = 'Sending…';
        const data = Object.fromEntries(new FormData(form)) as Record<string, FormDataEntryValue>;
        data.turnstileToken = token;
        try {
            const response = await fetch('/api/housing-inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error || 'Your inquiry could not be saved. Please try again.');
            show(config.mode === 'local-preview' ? `Saved locally for testing. Reference: ${result.id}. No email was sent.`
                : config.mode === 'development' ? `Saved to the development test database. Reference: ${result.id}. No email was sent.`
                : `Thanks — your inquiry is in. Reference: ${result.id}. We'll reply by email.`, 'success');
            window.gtag?.('event', 'housing_inquiry');
            form.reset();
            setRequester();
            status.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
        }
        catch (error) {
            show(error instanceof Error ? error.message : 'Your inquiry could not be saved. Please try again.', 'error');
        }
        finally {
            token = '';
            if (window.turnstile && widget != null)
                window.turnstile.reset(widget);
            button.textContent = label;
            readiness();
        }
    });
}
