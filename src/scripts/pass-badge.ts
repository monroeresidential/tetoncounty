// Site-wide Teton Pass badge in the topline. It reads the same proxied status as /teton-pass/ and, like that page,
// shows "status unknown" rather than "open" whenever the status can't be confirmed.
const badge = document.querySelector<HTMLAnchorElement>('[data-pass-badge]');
const labels: Record<string, string> = { open: 'Teton Pass open', restricted: 'Teton Pass restricted', closed: 'Teton Pass closed', unknown: 'Teton Pass status unknown' };

if (badge) {
  fetch('/api/pass', { headers: { Accept: 'application/json' } })
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null)
    .then((report: { status?: string } | null) => {
      const status = report?.status && report.status in labels ? report.status : 'unknown';
      badge.dataset.status = status;
      badge.querySelector('[data-pass-badge-text]')!.textContent = labels[status];
      badge.setAttribute('aria-label', `${labels[status]}. See Teton Pass status and drive times.`);
      badge.hidden = false;
    });
}
