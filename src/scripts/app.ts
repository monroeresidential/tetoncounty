import type * as Leaflet from 'leaflet';
declare const L: typeof Leaflet;
type FormConfig = {
    enabled: boolean;
    mode: string;
    siteKey: string;
};
type MapPoint = {
    id: string;
    name: string;
    town: string;
    latitude: number;
    longitude: number;
};
type DirectoryForm = HTMLFormElement & {
    elements: HTMLFormControlsCollection & {
        q: HTMLInputElement;
        town: HTMLSelectElement;
        season: HTMLSelectElement;
    };
};
type SuggestionForm = HTMLFormElement & {
    elements: HTMLFormControlsCollection & {
        type: HTMLSelectElement;
        listingId: HTMLSelectElement;
        placeName: HTMLInputElement;
        town: HTMLSelectElement;
        website: HTMLInputElement;
    };
};
declare global {
    interface Window {
        turnstile?: {
            render(selector: string, options: {
                sitekey: string;
                action: string;
                callback: (token: string) => void;
                'expired-callback': () => void;
                'error-callback': () => void;
            }): string;
            reset(id: string): void;
        };
    }
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T => {
    const element = root.querySelector<T>(selector);
    if (!element)
        throw new Error(`Missing page element: ${selector}`);
    return element;
};
const $$ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T[] => [...root.querySelectorAll<T>(selector)];
const menu = document.querySelector<HTMLButtonElement>('.menu-toggle');
menu?.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); $('#navigation').classList.toggle('open', open); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu) {
    menu.setAttribute('aria-expanded', 'false');
    $('#navigation').classList.remove('open');
} });
const directory = document.querySelector<HTMLElement>('[data-directory]');
if (directory)
    initDirectory(directory);
function initDirectory(directory: HTMLElement) {
    const form = $<DirectoryForm>('.filter-form', directory), cards = $$('[data-listing]', directory), params = new URLSearchParams(location.search);
    const query = form.elements.q, town = form.elements.town, season = form.elements.season;
    let activeCategory = directory.dataset.baseCategory || '', activeView = 'list';
    let map: import('leaflet').Map | undefined;
    let markers: import('leaflet').FeatureGroup;
    let mapLoading: Promise<void> | null = null;
    let visibleIds = new Set<string>(cards.map(c => c.dataset.listing!));
    const points = JSON.parse($('#map-data').textContent || '[]') as MapPoint[];
    const validOption = (select: HTMLSelectElement, value: string | null) => $$<HTMLOptionElement>('option', select).some(o => o.value === value);
    function readUrl() { const p = new URLSearchParams(location.search); query.value = p.get('q') || ''; town.value = validOption(town, p.get('town')) ? p.get('town')! : directory.dataset.baseTown || ''; season.value = validOption(season, p.get('season')) ? p.get('season')! : ''; const cat = p.get('category'); activeCategory = $$('[data-category-filter]', directory).some(b => b.dataset.categoryFilter === cat) ? cat! : directory.dataset.baseCategory || ''; }
    function updateMap() {
        if (!map)
            return;
        markers.clearLayers();
        for (const point of points.filter(p => visibleIds.has(p.id))) {
            const popup = document.createElement('div'), link = document.createElement('a'), area = document.createElement('div');
            popup.className = 'map-popup';
            link.href = '/places/' + point.id + '/';
            link.textContent = point.name;
            area.textContent = point.town;
            popup.append(link, area);
            L.circleMarker([point.latitude, point.longitude], { radius: 7, color: '#fff', weight: 2, fillColor: '#234d3d', fillOpacity: 1 }).bindPopup(popup).addTo(markers);
        }
        const bounds = markers.getBounds();
        if (bounds.isValid())
            map.fitBounds(bounds, { padding: [35, 35], maxZoom: 13 });
    }
    async function showMap() {
        $('#map-panel').hidden = false;
        if (map) {
            map.invalidateSize();
            updateMap();
            return;
        }
        if (mapLoading)
            return mapLoading;
        mapLoading = (async () => {
            try {
                const css = document.createElement('link');
                css.rel = 'stylesheet';
                css.href = '/assets/leaflet.css';
                document.head.append(css);
                await new Promise<void>((resolve, reject) => { const script = document.createElement('script'); script.src = '/assets/leaflet.js'; script.onload = () => resolve(); script.onerror = reject; document.head.append(script); });
                map = L.map('places-map', { scrollWheelZoom: false }).setView([43.65, -111.08], 10);
                L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
                markers = L.featureGroup().addTo(map);
                updateMap();
            }
            catch {
                $('.map-error').textContent = 'The map couldn’t load. Every place is still available in the list below.';
                mapLoading = null;
            }
        })();
        return mapLoading;
    }
    function apply(writeUrl = true) {
        const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        visibleIds = new Set();
        for (const card of cards) {
            const match = (!activeCategory || card.dataset.category === activeCategory) && (!town.value || card.dataset.town === town.value) && (!season.value || (card.dataset.seasons || '').split(' ').includes(season.value)) && terms.every(t => (card.dataset.search || '').includes(t));
            card.hidden = !match;
            if (match)
                visibleIds.add(card.dataset.listing!);
        }
        $$('[data-category-filter]', directory).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.categoryFilter === activeCategory)));
        $('#result-count').textContent = `${visibleIds.size} ${visibleIds.size === 1 ? 'place or experience' : 'places & experiences'}`;
        $('.empty-state').hidden = visibleIds.size !== 0;
        if (writeUrl) {
            const next = new URLSearchParams();
            if (query.value.trim())
                next.set('q', query.value.trim());
            if (town.value)
                next.set('town', town.value);
            if (season.value)
                next.set('season', season.value);
            if (activeCategory)
                next.set('category', activeCategory);
            if (activeView === 'map')
                next.set('view', 'map');
            history.replaceState(null, '', location.pathname + (next.size ? '?' + next : ''));
        }
        updateMap();
    }
    function reset() { query.value = ''; town.value = directory.dataset.baseTown || ''; season.value = ''; activeCategory = directory.dataset.baseCategory || ''; apply(); }
    query.addEventListener('input', () => apply());
    town.addEventListener('change', () => { if (directory.dataset.baseTown && town.value !== directory.dataset.baseTown) {
        const p = new URLSearchParams({ town: town.value, q: query.value, season: season.value });
        location.href = '/explore/?' + p;
    }
    else
        apply(); });
    season.addEventListener('change', () => apply());
    form.addEventListener('submit', e => { e.preventDefault(); apply(); });
    $$('[data-category-filter]', directory).forEach(b => b.addEventListener('click', () => { activeCategory = b.dataset.categoryFilter || ''; if (directory.dataset.baseCategory && activeCategory !== directory.dataset.baseCategory) {
        const p = new URLSearchParams({ category: activeCategory, q: query.value, town: town.value, season: season.value });
        location.href = '/explore/?' + p;
    }
    else
        apply(); }));
    $$('.clear-filters', directory).forEach(b => b.addEventListener('click', reset));
    function setView(view: string) { activeView = view; $$('[data-view]').forEach(b => { const on = b.dataset.view === view; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('active', on); }); $('#map-panel').hidden = view !== 'map'; if (view === 'map')
        showMap(); apply(); }
    $$('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view || 'list')));
    window.addEventListener('popstate', () => { readUrl(); apply(false); setView(new URLSearchParams(location.search).get('view') === 'map' ? 'map' : 'list'); });
    readUrl();
    apply(false);
    if (params.get('view') === 'map')
        setView('map');
}
const suggestion = document.querySelector<SuggestionForm>('#suggest-form');
if (suggestion)
    initSuggestion(suggestion);
function initSuggestion(suggestion: SuggestionForm) {
    const status = $('#form-status'), button = $<HTMLButtonElement>('.submit-button', suggestion), type = suggestion.elements.type;
    let config: FormConfig = { enabled: false, mode: 'production', siteKey: '' }, token = '', widget: string | undefined;
    const params = new URLSearchParams(location.search);
    if (['addition', 'correction', 'contact'].includes(params.get('type') || ''))
        type.value = params.get('type')!;
    if (params.get('listing') && [...suggestion.elements.listingId.options].some(o => o.value === params.get('listing'))) {
        suggestion.elements.listingId.value = params.get('listing')!;
        type.value = 'correction';
    }
    function setType() {
        const correction = type.value === 'correction', addition = type.value === 'addition';
        $('#listing-field').hidden = !correction;
        suggestion.elements.listingId.required = correction;
        suggestion.elements.listingId.disabled = !correction;
        $('#place-fields').hidden = !addition;
        suggestion.elements.placeName.required = addition;
        (['placeName', 'town', 'website'] as const).forEach(name => suggestion.elements[name].disabled = !addition);
    }
    setType();
    type.addEventListener('change', setType);
    function show(message: string, kind = '') { status.textContent = message; status.className = 'form-status ' + kind; }
    function readiness() { button.disabled = !(config?.mode === 'local-preview' || token); }
    (async () => {
        try {
            const response = await fetch('/api/config');
            if (!response.ok)
                throw new Error();
            config = await response.json();
            if (config.mode === 'local-preview') {
                show('Local preview: submissions are saved on this computer for testing and are not sent to the live guide.');
                readiness();
                return;
            }
            if (!config.enabled || !config.siteKey) {
                show('The live submission service is not connected yet. Please check back when the guide launches.', 'error');
                return;
            }
            await new Promise<void>((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.onload = () => resolve(); script.onerror = reject; document.head.append(script); });
            widget = window.turnstile!.render('#turnstile', { sitekey: config.siteKey, action: 'suggest', callback: value => { token = value; readiness(); }, 'expired-callback': () => { token = ''; readiness(); }, 'error-callback': () => { token = ''; readiness(); show('Verification could not load. Check your connection and try again.', 'error'); } });
        }
        catch {
            show('The submission service could not be reached. Please reload and try again.', 'error');
        }
    })();
    suggestion.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!suggestion.reportValidity())
            return;
        button.disabled = true;
        button.textContent = 'Sending…';
        const data = Object.fromEntries(new FormData(suggestion)) as Record<string, FormDataEntryValue>;
        data.turnstileToken = token;
        try {
            const response = await fetch('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error || 'Your request could not be saved. Please try again.');
            show(`${config.mode === 'local-preview' ? 'Saved locally for testing.' : 'Thanks — your request is saved for review.'} Reference: ${result.id}. ${config.mode === 'local-preview' ? 'No email was sent.' : 'Nothing is published until it has been reviewed.'}`, 'success');
            suggestion.reset();
            setType();
            status.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
        }
        catch (error) {
            show(error instanceof Error ? error.message : 'Your request could not be saved. Please try again.', 'error');
        }
        finally {
            token = '';
            if (window.turnstile && widget != null)
                window.turnstile.reset(widget);
            button.textContent = 'Send for review →';
            readiness();
        }
    });
}
