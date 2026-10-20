export type FormConfig = {
    enabled: boolean;
    mode: string;
    siteKey: string;
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
type FormServiceOptions = {
    action: 'suggest' | 'housing';
    container: string;
    onToken(token: string): void;
    show(message: string, kind?: string): void;
};

// Loads the submission config and, when the service is live, renders an explicit Turnstile widget.
// `widget` is undefined in local preview or when the service is not connected.
export async function connectFormService({ action, container, onToken, show }: FormServiceOptions): Promise<{ config: FormConfig; widget: string | undefined }> {
    let config: FormConfig = { enabled: false, mode: 'production', siteKey: '' }, widget: string | undefined;
    try {
        const response = await fetch('/api/config');
        if (!response.ok)
            throw new Error();
        config = await response.json();
        if (config.mode === 'local-preview') {
            show('Local preview: submissions are saved on this computer for testing and are not sent to the live guide.');
            return { config, widget };
        }
        if (!config.enabled || !config.siteKey) {
            show('The live submission service is not connected yet. Please check back when the guide launches.', 'error');
            return { config, widget };
        }
        if (config.mode === 'development')
            show('Development preview: requests are saved only to the test database. No emails are sent.');
        await new Promise<void>((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.onload = () => resolve(); script.onerror = reject; document.head.append(script); });
        widget = window.turnstile!.render(container, { sitekey: config.siteKey, action, callback: value => onToken(value), 'expired-callback': () => onToken(''), 'error-callback': () => { onToken(''); show('Verification could not load. Check your connection and try again.', 'error'); } });
    }
    catch {
        show('The submission service could not be reached. Please reload and try again.', 'error');
    }
    return { config, widget };
}
