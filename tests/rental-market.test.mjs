import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRentalSnapshot, rentDifference, dollars } from '../src/lib/rental-market.ts';

const snapshot = JSON.parse(await readFile('data/rental-market.json', 'utf8'));

test('rental snapshot preserves source groups and missing comparable data', () => {
  validateRentalSnapshot(snapshot);
  assert.equal(snapshot.comparisons.length, 11);
  assert.equal(snapshot.observedAt, null);
  assert.equal(snapshot.comparisons.some(r => r.group === 'communities' && r.town === 'Driggs' && r.plan === '2x2'), false);
  const driggs = snapshot.comparisons.find(r => r.group === 'all-direct' && r.town === 'Driggs' && r.plan === '1x1');
  assert.equal(driggs.median, 1845);
  assert.equal(driggs.records, 2);
  const sponsor = snapshot.sponsor.find(r => r.plan === '1x1');
  assert.equal(sponsor.medianBase + sponsor.monthlyCam, 1866.5);
  assert.equal(dollars(sponsor.medianBase + sponsor.monthlyCam), '$1,866.50');
});

test('invalid rent updates fail rather than silently publishing wrong comparisons', () => {
  for (const mutate of [
    s => { s.comparisons.push(s.comparisons[0]); },
    s => { s.comparisons[0].median = null; },
    s => { s.comparisons[0].median = s.comparisons[0].max + 1; },
    s => { s.comparisons[0].properties = s.comparisons[0].records + 1; },
    s => { s.sponsor[0].monthlyCam = -1; },
    s => { s.observedAt = '2026-10-18'; },
    s => { s.status = 'current'; },
  ]) { const changed = structuredClone(snapshot); mutate(changed); assert.throws(() => validateRentalSnapshot(changed)); }
  assert.equal(rentDifference(1650, 1900), 'Teton Flats $250 lower/mo');
  assert.equal(rentDifference(2350, 2250), 'Teton Flats $100 higher/mo');
  assert.equal(rentDifference(1650, 1650), 'Same median base rent');
});

test('Live page ships readable draft comparisons without misleading live offers', async () => {
  const html = await readFile('dist/live/index.html', 'utf8');
  assert.equal((html.match(/data-rent-panel /g) || []).length, 4);
  assert(html.includes('Preview rent snapshot'));
  assert(html.includes('$1,866.50'));
  assert(html.includes('Additional fees'));
  assert(html.includes('Not supplied'));
  assert(html.includes('No matching 2 beds / 2 baths community sample.'));
  assert.match(html, /name="robots" content="noindex/);
  assert(!html.includes('"@type":"Offer"'));
  assert(!html.includes('C_reference_snippets_stale'));
  const exported = JSON.parse(await readFile('dist/data/rental-market.json', 'utf8'));
  assert.deepEqual(exported.comparisons, snapshot.comparisons);
  assert.equal(exported.observedAt, null);
  for (const [, attrs, body] of html.matchAll(/<script([^>]*)>(.*?)<\/script>/gs)) if (body.trim()) assert(/type="application\/(?:ld\+)?json"/.test(attrs), 'No executable inline scripts under CSP');
});
