import { denverDay, denverHour, type PassHistory } from '../lib/pass.ts';
import { getJson, mountPassStatus } from './pass-status.ts';

const root = document.querySelector<HTMLElement>('[data-pass]');
const $ = <T extends HTMLElement>(selector: string) => root!.querySelector<T>(selector)!;
const refreshMs = 5 * 60 * 1000;
const svgNs = 'http://www.w3.org/2000/svg';
let passable = false;
let shownHistory: PassHistory | null = null;

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

if (root) {
  const select = $<HTMLSelectElement>('[data-pass-route]');
  const requested = new URLSearchParams(location.search).get('route');
  if (requested && [...select.options].some(option => option.value === requested)) select.value = requested;
  const loadChart = async () => renderChart(await getJson<PassHistory>(`/api/pass-history?route=${encodeURIComponent(select.value)}`));
  const status = mountPassStatus(root);
  const load = async () => {
    const report = await status.load();
    passable = report?.status === 'open' || report?.status === 'restricted';
    await loadChart();
  };
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
