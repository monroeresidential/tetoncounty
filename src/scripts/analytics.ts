declare global {
    interface Window {
        dataLayer: unknown[];
        gtag: (...args: unknown[]) => void;
    }
}

// Keep development, previews, and the workers.dev diagnostic host out of reports.
if (import.meta.env.PROD && import.meta.env.PUBLIC_SITE_ENV !== 'development' && window.location.origin === 'https://tetoncounty.us') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function (..._args: unknown[]) {
        window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', 'G-S96WQNBJC4');

    // Queue the page view immediately, then let visible content finish loading
    // before downloading and evaluating Google's larger third-party library.
    const loadAnalytics = () => {
        const script = document.createElement('script');
        script.async = true;
        script.fetchPriority = 'low';
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-S96WQNBJC4';
        document.head.append(script);
    };
    const scheduleAnalytics = () => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(loadAnalytics, { timeout: 1500 });
        else setTimeout(loadAnalytics, 0);
    };
    // Sponsor links carry their placement in utm_content; report it so GA4 can break clicks down by placement.
    const trackSponsorClick = (event: MouseEvent) => {
        if (event.button > 1) return;
        const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
        if (!link || !/(^|\.)tetonflats\.com$/.test(link.hostname)) return;
        window.gtag('event', 'teton_flats_click', { link_placement: new URL(link.href).searchParams.get('utm_content') ?? 'unknown', link_url: link.href, page_path: location.pathname });
    };
    document.addEventListener('click', trackSponsorClick);
    document.addEventListener('auxclick', trackSponsorClick);

    if (document.readyState === 'complete') scheduleAnalytics();
    else window.addEventListener('load', scheduleAnalytics, { once: true });
}

export {};
