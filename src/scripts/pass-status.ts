import { closedWarning, deltaCopy, wyoming511, type PassReport, type TravelTime } from '../lib/pass.ts';

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver' });
const headlines = { open: 'Open', restricted: 'Restricted', closed: 'Closed', unknown: 'Status unknown' };

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function sublabel(slug: string) {
  return slug.includes('tetonvillage') ? 'JHMR' : slug.includes('airport') ? 'Jackson Hole Airport' : 'Town Square';
}

function timeRow(row: TravelTime) {
  const item = element('li', row.stale ? 'is-stale' : undefined);
  const place = element('div');
  place.append(element('span', 'pass-route-name', row.name), element('span', 'pass-route-sub', sublabel(row.slug)));
  const minutes = element('div', 'pass-minutes');
  minutes.append(element('span', 'pass-minutes-value', `${Math.round(row.durationSec / 60)} min`));
  const delta = deltaCopy(row);
  if (delta) minutes.append(element('span', `pass-delta is-${delta.tone}`, delta.text));
  else if (row.stale) minutes.append(element('span', 'pass-delta', `as of ${clock(row.capturedAt)}`));
  item.append(place, minutes);
  return item;
}

// Drive times over a closed or unconfirmed pass would mislead; tetonpasscam.com withholds them too.
export function visibleTimes(report: PassReport | null, routes: string[] | null): TravelTime[] {
  if (report?.status !== 'open' && report?.status !== 'restricted') return [];
  return routes ? report.travelTimes.filter(row => routes.some(route => row.slug.startsWith(`${route}-`))) : report.travelTimes;
}

export async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    return response.ok ? await response.json() as T : null;
  } catch { return null; }
}

export function mountPassStatus(root: HTMLElement) {
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const routes = root.dataset.passRoutes?.split(',').map(route => route.trim()).filter(Boolean) ?? null;

  function render(report: PassReport | null) {
    const status = report?.status ?? 'unknown';
    const banner = $('[data-pass-banner]');
    banner.dataset.status = status;
    $('[data-pass-state]').textContent = status === 'restricted' && report?.restrictions[0] ? `Restricted — ${report.restrictions[0]}` : headlines[status];
    const warning = $('[data-pass-warning]');
    warning.hidden = status !== 'closed';
    warning.textContent = closedWarning;
    const detail = $('[data-pass-detail]');
    detail.replaceChildren();
    if (!report) detail.append('We can’t reach the pass data right now. Check ');
    else if (status === 'unknown') detail.append('We can’t confirm the pass status right now. Check ');
    if (!report || status === 'unknown') {
      const link = element('a', undefined, 'Wyoming 511');
      link.href = wyoming511;
      detail.append(link, ' before you drive.');
    } else {
      detail.append(report.lastConfirmed ? `Last confirmed ${report.lastConfirmed.status} at ${clock(report.lastConfirmed.at)} · WYDOT` : 'No confirmed WYDOT status yet.');
      if (report.isStale) detail.append(element('span', 'pass-stale', `Data may be outdated — last WYDOT report ${report.wydotReportTime ? clock(report.wydotReportTime) : 'unavailable'}`));
    }
    const advisories = $('[data-pass-advisories]');
    advisories.replaceChildren(...(status === 'unknown' || !report ? [] : report.advisories.map(advisory => element('li', undefined, `Advisory: ${advisory.toLowerCase()}`))));
    advisories.hidden = !advisories.children.length;

    const withheld = $('[data-pass-withheld]');
    const directions = $('[data-pass-directions]');
    const times = visibleTimes(report, routes);
    const show = times.length > 0;
    withheld.hidden = show;
    directions.hidden = !show;
    withheld.textContent = status === 'closed'
      ? 'The pass is closed, so drive times over it do not apply. The detour is US-26/US-89 via Swan Valley and Alpine.'
      : 'Drive times are withheld until the pass status can be confirmed.';
    if (show) for (const direction of ['eb', 'wb']) $(`[data-pass-times="${direction}"]`).replaceChildren(...times.filter(row => row.slug.endsWith(`-${direction}`)).map(timeRow));
    const oldest = times.reduce<string | null>((min, row) => (!min || row.capturedAt < min ? row.capturedAt : min), null);
    $('[data-pass-updated]').textContent = show && oldest ? `Updated ${clock(oldest)}` : '';

    const weatherCard = root.querySelector<HTMLElement>('[data-pass-weather]');
    if (!weatherCard) return;
    const weather = report?.weather;
    weatherCard.hidden = !weather || status === 'unknown';
    if (weather) {
      const facts: [string, number | null, string][] = [['Air', weather.airF, '°F'], ['Road surface', weather.surfaceF, '°F'], ['Wind gusts', weather.windGustMph === null ? null : Math.round(weather.windGustMph), ' mph'], ['Visibility', weather.visibilityFt === null ? null : Math.round(weather.visibilityFt / 528) / 10, ' mi']];
      $('[data-pass-weather-list]').replaceChildren(...facts.filter(([, value]) => value !== null).map(([label, value, unit]) => { const div = element('div'); div.append(element('dt', undefined, label), element('dd', undefined, `${value}${unit}`)); return div; }));
      $('[data-pass-weather-updated]').textContent = weather.reportedAt ? `${report!.weatherStale ? 'Outdated — ' : ''}Teton Pass weather station, ${clock(weather.reportedAt)}` : '';
    }
  }

  return {
    async load() {
      const report = await getJson<PassReport>('/api/pass');
      render(report);
      return report;
    },
  };
}
