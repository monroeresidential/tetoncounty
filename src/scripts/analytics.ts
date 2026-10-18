declare global {
    interface Window {
        dataLayer: unknown[];
        gtag: (...args: unknown[]) => void;
    }
}

// Keep development, previews, and the workers.dev diagnostic host out of reports.
if (import.meta.env.PROD && window.location.origin === 'https://tetoncounty.us') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function (..._args: unknown[]) {
        window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', 'G-W6SWY98HLR');

    // Load asynchronously without adding executable inline scripts to the CSP.
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-W6SWY98HLR';
    document.head.append(script);
}

export {};
