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
    if (document.readyState === 'complete') scheduleAnalytics();
    else window.addEventListener('load', scheduleAnalytics, { once: true });
}

export {};
