import { closedWarning, deltaCopy, denverDay, denverHour, wyoming511, type PassHistory, type PassReport, type TravelTime } from '../lib/pass.ts';

const root = document.querySelector<HTMLElement>('[data-pass]');
const $ = <T extends HTMLElement>(selector: string) => root!.querySelector<T>(selector)!;
const refreshMs = 5 * 60 * 1000;
const svgNs = 'http://www.w3.org/2000/svg';
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver' });
const headlines = { open: 'Open', restricted: 'Restricted', closed: 'Closed', unknown: 'Status unknown' };
let passable = false;
let shownHistory: PassHistory | null = null;

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

function renderStatus(report: PassReport | null) {
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

  // Drive times over a closed or unconfirmed pass would mislead; tetonpasscam.com withholds them too.
  const withheld = $('[data-pass-withheld]');
  const directions = $('[data-pass-directions]');
  const times = report?.travelTimes ?? [];
  passable = status === 'open' || status === 'restricted';
  const show = passable && times.length > 0;
  withheld.hidden = show;
  directions.hidden = !show;
  withheld.textContent = status === 'closed'
    ? 'The pass is closed, so drive times over it do not apply. The detour is US-26/US-89 via Swan Valley and Alpine.'
    : 'Drive times are withheld until the pass status can be confirmed.';
  if (show) for (const direction of ['eb', 'wb']) $(`[data-pass-times="${direction}"]`).replaceChildren(...times.filter(row => row.slug.endsWith(`-${direction}`)).map(timeRow));
  const oldest = times.reduce<string | null>((min, row) => (!min || row.capturedAt < min ? row.capturedAt : min), null);
  $('[data-pass-updated]').textContent = show && oldest ? `Updated ${clock(oldest)}` : '';

  const weather = report?.weather;
  const weatherCard = $('[data-pass-weather]');
  weatherCard.hidden = !weather || status === 'unknown';
  if (weather) {
    const facts: [string, number | null, string][] = [['Air', weather.airF, '°F'], ['Road surface', weather.surfaceF, '°F'], ['Wind gusts', weather.windGustMph === null ? null : Math.round(weather.windGustMph), ' mph'], ['Visibility', weather.visibilityFt === null ? null : Math.round(weather.visibilityFt / 528) / 10, ' mi']];
    $('[data-pass-weather-list]').replaceChildren(...facts.filter(([, value]) => value !== null).map(([label, value, unit]) => { const div = element('div'); div.append(element('dt', undefined, label), element('dd', undefined, `${value}${unit}`)); return div; }));
    $('[data-pass-weather-updated]').textContent = weather.reportedAt ? `${report!.weatherStale ? 'Outdated — ' : ''}Teton Pass weather station, ${clock(weather.reportedAt)}` : '';
  }
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>) {
  const node = document.createElementNS(svgNs, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function renderChart(history: PassHistory | null) {
  shownHistory = history;
  const chart = $('[data-pass-chart]');
  const note = $('[data-pass-chart-note]');
  if (!history) { chart.replaceChildren(); note.textContent = 'The drive-time history is unavailable right now.'; return; }
  const { weekdayClass, season } = denverDay();
  const typical = history.typicals.filter(t => t.weekdayClass === weekdayClass && t.season === season).sort((a, b) => a.hour - b.hour);
  const today = history.today.map(row => ({ hour: denverHour(row.capturedAt), value: row.durationSec / 60 })).filter(point => point.hour >= 4 && point.hour <= 23);
  if (!typical.length && !today.length) { chart.replaceChildren(); note.textContent = 'No drive times recorded for this route yet today.'; return; }
  // Draw at the container's own width so axis labels stay at real text size on phones.
  const width = Math.max(300, Math.round(chart.clientWidth || 720)), height = width < 560 ? 220 : 280, left = 42, right = 10, top = 12, bottom = 30;
  const hours = [...typical.map(t => t.hour), ...today.map(p => p.hour)];
  const minHour = Math.min(5, ...hours), maxHour = Math.max(22, ...hours);
  const values = [...typical.flatMap(t => [t.p25Sec / 60, t.p75Sec / 60, t.medianSec / 60]), ...today.map(p => p.value)];
  const low = Math.floor(Math.min(...values) - 1), high = Math.ceil(Math.max(...values) + 1);
  const x = (hour: number) => left + (hour - minHour) / (maxHour - minHour) * (width - left - right);
  const y = (minutes: number) => top + (high - minutes) / (high - low) * (height - top - bottom);
  const line = (points: [number, number][]) => points.map(([h, v], i) => `${i ? 'L' : 'M'}${x(h).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const plot = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': 'pass-chart-title' });
  const title = svg('title', { id: 'pass-chart-title' });
  title.textContent = `${history.route.name}: today’s drive times compared with a typical ${weekdayClass}.`;
  plot.append(title);
  for (const minutes of [low, Math.round((low + high) / 2), high]) {
    plot.append(svg('line', { x1: left, x2: width - right, y1: y(minutes), y2: y(minutes), class: 'grid' }));
    const label = svg('text', { x: left - 8, y: y(minutes) + 4, 'text-anchor': 'end' }); label.textContent = `${minutes}m`; plot.append(label);
  }
  for (let hour = Math.ceil(minHour); hour <= maxHour; hour += width < 560 ? 6 : 3) {
    const label = svg('text', { x: x(hour), y: height - 10, 'text-anchor': 'middle' });
    label.textContent = `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;
    plot.append(label);
  }
  if (typical.length) {
    plot.append(svg('path', { d: line(typical.map(t => [t.hour, t.p75Sec / 60])) + line([...typical].reverse().map(t => [t.hour, t.p25Sec / 60])).replace('M', 'L') + 'Z', class: 'band' }));
    plot.append(svg('path', { d: line(typical.map(t => [t.hour, t.medianSec / 60])), class: 'typical' }));
  }
  if (today.length) {
    plot.append(svg('path', { d: line(today.map(p => [p.hour, p.value])), class: 'today' }));
    const last = today[today.length - 1];
    plot.append(svg('circle', { cx: x(last.hour), cy: y(last.value), r: 5, class: 'today-dot' }));
  }
  chart.replaceChildren(plot);
  const last = today[today.length - 1];
  const now = last && typical.find(t => t.hour === Math.floor(last.hour));
  // Earlier readings are history, not a drive time to plan on, while the pass is closed or unconfirmed.
  note.textContent = !passable
    ? 'Drive times recorded earlier today. They don’t describe current conditions while the pass status is closed or unconfirmed.'
    : !typical.length
    ? `Typical ${season} ${weekdayClass} times are still being collected for this route.`
    : last && now ? `Latest: ${Math.round(last.value)} min. A typical ${weekdayClass} at this hour runs ${Math.round(now.p25Sec / 60)}–${Math.round(now.p75Sec / 60)} min.` : `Typical ${weekdayClass} drive times for ${history.route.name}.`;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    return response.ok ? await response.json() as T : null;
  } catch { return null; }
}

if (root) {
  const select = $<HTMLSelectElement>('[data-pass-route]');
  const requested = new URLSearchParams(location.search).get('route');
  if (requested && [...select.options].some(option => option.value === requested)) select.value = requested;
  const loadChart = async () => renderChart(await getJson<PassHistory>(`/api/pass-history?route=${encodeURIComponent(select.value)}`));
  const load = async () => { renderStatus(await getJson<PassReport>('/api/pass')); await loadChart(); };
  select.addEventListener('change', () => {
    const url = new URL(location.href);
    url.searchParams.set('route', select.value);
    history.replaceState(null, '', url);
    loadChart();
  });
  load();
  // Refresh only while visible; tetonpasscam.com itself updates about every 10 minutes.
  let last = Date.now();
  const refresh = () => {
    if (document.visibilityState !== 'visible' || Date.now() - last < refreshMs) return;
    last = Date.now();
    load();
  };
  setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', refresh);
  let drawnWidth = 0;
  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (shownHistory && Math.abs(width - drawnWidth) > 24) { drawnWidth = width; renderChart(shownHistory); }
  }).observe($('[data-pass-chart]'));
}
