import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { validateRentalSnapshot, rentalTowns, rentalPlans } from '../src/lib/rental-market.ts';

const input = process.argv[2];
assert(input, 'Usage: npm run rents:import -- /path/to/teton_flats_vs_market.csv');
const raw = await readFile(input, 'utf8');
function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += c;
  }
  assert(!quoted, 'Unclosed CSV quote');
  if (field || row.length) { row.push(field); rows.push(row); }
  const [headers, ...body] = rows;
  return body.map(cells => {
    assert.equal(cells.length, headers.length, 'Invalid CSV row length');
    return Object.fromEntries(headers.map((header, i) => [header, cells[i]]));
  });
}
const rows = parseCsv(raw);
const number = (value, name) => { assert(value?.trim(), `Missing ${name}`); const n = Number(value); assert(Number.isFinite(n), `Invalid ${name}`); return n; };
const groups = { A_market_communities: 'communities', B_all_current_direct: 'all-direct' };
const selected = rows.filter(row => groups[row.comp_set] && rentalTowns.includes(row.town) && rentalPlans.includes(row.bucket) && Number(row.n_rows) > 0);
const sponsor = rentalPlans.map(plan => {
  const values = rows.filter(row => rentalPlans.includes(row.bucket) && row.bucket === plan && row.tf_median_base);
  assert(values.length, `Missing sponsor plan ${plan}`);
  const base = number(values[0].tf_median_base, 'sponsor base');
  const subtotal = number(values[0].tf_median_base_plus_cam, 'sponsor subtotal');
  const records = number(values[0].tf_units, 'sponsor records');
  for (const row of values) assert(Number(row.tf_median_base) === base && Number(row.tf_median_base_plus_cam) === subtotal && Number(row.tf_units) === records, 'Conflicting sponsor values across overlapping groups');
  return { plan, records, medianBase: base, monthlyCam: Math.round((subtotal - base) * 100) / 100 };
});
const snapshot = {
  version: 1, status: 'draft', sourceFile: basename(input), sourceSha256: createHash('sha256').update(raw).digest('hex'),
  observedAt: null, importedAt: new Date().toISOString(), sponsor,
  comparisons: selected.map(row => ({
    town: row.town, plan: row.bucket, group: groups[row.comp_set], records: number(row.n_rows, 'records'), properties: number(row.n_props, 'properties'),
    min: number(row.min, 'min'), median: number(row.median, 'median'), max: number(row.max, 'max'),
    examples: row.comps.split(' | ').map(example => {
      const match = example.match(/^(.*) \$([\d,]+(?:\.\d+)?)$/);
      assert(match, `Unparseable comparison: ${example}`);
      return { name: match[1], baseRent: Number(match[2].replaceAll(',', '')) };
    }),
  })),
};
validateRentalSnapshot(snapshot);
await writeFile('data/rental-market.json', JSON.stringify(snapshot, null, 2) + '\n');
console.log(`Imported ${snapshot.comparisons.length} separate town/plan/group summaries. Stale snippets, all-town totals, and overlapping bedroom buckets excluded. Snapshot remains an undated draft.`);
