import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePassStatus, parsePassHistory, deltaCopy, denverDay } from '../src/lib/pass.ts';
import { visibleTimes } from '../src/scripts/pass-status.ts';
import { handleApi } from '../src/worker.mjs';

const live = { status: 'open', pollerDead: false, isStale: false, lastConfirmed: { status: 'open', at: '2026-10-19T18:40:25Z' }, advisories: ['Falling Rock'], restrictions: [], wydotReportTime: '2026-10-19T17:11:00Z',
  weather: { airF: 46, surfaceF: 69, windGustMph: 10.6, visibilityFt: 6562, reportedAt: '2026-10-19T18:38:00Z' }, weatherStale: false,
  travelTimes: [{ slug: 'victor-jackson-eb', name: 'Victor → Jackson', durationSec: 2161, typicalSec: 2403, capturedAt: '2026-10-19T18:40:25Z', stale: false }, { slug: 'not-a-route', name: 'x', durationSec: 1, typicalSec: 1, capturedAt: '2026-10-19T18:40:25Z', stale: false }],
  shareCode: 'private-field', alerts: [{ note: 'unverified' }] };

test('pass status never degrades toward open and drops fields the page does not show', () => {
  const report = parsePassStatus(live);
  assert.equal(report.status, 'open');
  assert.deepEqual(report.travelTimes.map(t => t.slug), ['victor-jackson-eb']);
  assert.equal('alerts' in report || 'shareCode' in report, false);
  for (const broken of [null, {}, { ...live, pollerDead: true }, { ...live, pollerDead: undefined }, { ...live, status: 'OPEN' }, { ...live, status: 'reopened' }]) assert.equal(parsePassStatus(broken).status, 'unknown');
  assert.equal(parsePassStatus({ ...live, isStale: undefined }).isStale, true);
  assert.equal(parsePassStatus({ ...live, travelTimes: [{ ...live.travelTimes[0], stale: undefined }] }).travelTimes[0].stale, true);
});

test('drive-time comparisons match tetonpasscam.com wording and thresholds', () => {
  const row = { slug: 'victor-jackson-eb', name: 'Victor → Jackson', durationSec: 2400, typicalSec: 2400, capturedAt: '', stale: false };
  assert.equal(deltaCopy({ ...row, durationSec: 2101 }).text, 'about usual');
  assert.equal(deltaCopy({ ...row, durationSec: 2100 }).text, '5 min faster than usual');
  assert.equal(deltaCopy({ ...row, durationSec: 2700 }).text, '5 min slower than usual');
  assert.equal(deltaCopy({ ...row, stale: true }), null);
  assert.equal(deltaCopy({ ...row, typicalSec: null }), null);
  assert.deepEqual(denverDay(new Date('2026-12-05T18:00:00Z')), { weekdayClass: 'weekend', season: 'winter' });
  assert.deepEqual(denverDay(new Date('2026-10-19T18:00:00Z')), { weekdayClass: 'weekday', season: 'summer' });
});

test('history keeps valid rows for the requested route only', () => {
  const history = parsePassHistory({ route: { slug: 'driggs-airport-wb', name: 'Airport → Driggs' }, typicals: [{ weekdayClass: 'weekday', season: 'summer', hour: 7, medianSec: 3000, p25Sec: 2900, p75Sec: 3100 }, { weekdayClass: 'holiday', season: 'summer', hour: 7, medianSec: 1, p25Sec: 1, p75Sec: 1 }], today: [{ capturedAt: '2026-10-19T13:00:00Z', durationSec: 3000 }, { capturedAt: 'nope', durationSec: 1 }] }, 'driggs-airport-wb');
  assert.equal(history.typicals.length, 1);
  assert.equal(history.today.length, 1);
  assert.throws(() => parsePassHistory({ route: { slug: 'victor-jackson-eb' } }, 'driggs-airport-wb'));
});

test('the pass API proxies tetonpasscam.com, rejects unknown routes, and fails closed', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requested = [];
  globalThis.fetch = async url => { requested.push(String(url)); return Response.json(String(url).includes('history') ? { route: { slug: 'victor-jackson-eb', name: 'Victor → Jackson' }, typicals: [], today: [] } : live); };
  const ok = await handleApi(new Request('https://tetoncounty.us/api/pass'), {});
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).status, 'open');
  assert.equal((await handleApi(new Request('https://tetoncounty.us/api/pass-history?route=victor-jackson-eb'), {})).status, 200);
  assert.deepEqual(requested, ['https://tetonpasscam.com/api/status', 'https://tetonpasscam.com/api/history?route=victor-jackson-eb']);
  assert.equal((await handleApi(new Request('https://tetoncounty.us/api/pass-history?route=../admin'), {})).status, 400);
  globalThis.fetch = async () => new Response('', { status: 502 });
  assert.equal((await handleApi(new Request('https://tetoncounty.us/api/pass'), {})).status, 503);
});

test('Teton Pass page is linked, listed, and links to tetonpasscam.com with tracking', async () => {
  const html = await readFile('dist/teton-pass/index.html', 'utf8');
  assert(html.includes('<a aria-current="page" href="/teton-pass/">Teton Pass</a>'));
  assert((await readFile('dist/sitemap.xml', 'utf8')).includes('/teton-pass/</loc>'));
  assert.match(html, /href="https:\/\/tetonpasscam\.com\/\?utm_source=[^"]+utm_campaign=tetoncounty_teton_pass&amp;utm_content=cta_button"/);
  assert(html.includes('https://www.wyoroad.info/highway/conditions/RoadClosures.html'));
});

test('every page carries a hidden-until-loaded Teton Pass badge linking to the pass page', async () => {
  for (const file of ['index.html', 'explore/index.html', 'webcams/index.html']) {
    const html = await readFile(`dist/${file}`, 'utf8');
    assert.match(html, /<a class="pass-badge" href="\/teton-pass\/" data-pass-badge hidden>/, file);
  }
});

test('pass status renderer shows drive times only over a passable pass and filters by route', () => {
  const rows = ['victor-jackson-eb', 'victor-jackson-wb', 'victor-tetonvillage-eb', 'driggs-jackson-eb'].map(slug => ({ slug, name: slug, durationSec: 2000, typicalSec: 2000, capturedAt: '2026-10-19T18:40:25Z', stale: false }));
  const report = status => ({ ...parsePassStatus(live), status, travelTimes: rows });
  assert.deepEqual(visibleTimes(null, null), []);
  assert.deepEqual(visibleTimes(report('closed'), null), []);
  assert.deepEqual(visibleTimes(report('unknown'), null), []);
  assert.equal(visibleTimes(report('open'), null).length, 4);
  assert.equal(visibleTimes(report('restricted'), []).length, 0);
  assert.deepEqual(visibleTimes(report('open'), ['victor-jackson']).map(t => t.slug), ['victor-jackson-eb', 'victor-jackson-wb']);
  assert.deepEqual(visibleTimes(report('open'), ['victor-jackson', 'driggs-jackson']).map(t => t.slug), ['victor-jackson-eb', 'victor-jackson-wb', 'driggs-jackson-eb']);
});
