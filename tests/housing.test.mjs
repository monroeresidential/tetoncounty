import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { adaptDb } from '../scripts/sqlite-adapter.mjs';
import { migrateLocal } from '../scripts/local-migrations.mjs';
import { handleApi } from '../src/worker.mjs';
import { deliverNotifications } from '../src/lib/form-notifications.ts';
import { readFile } from 'node:fs/promises';
import { isDevelopment } from '../src/config.ts';

const origin = 'https://tetoncounty.us';
const valid = { requester: 'employer', name: 'HR Tester', email: 'hr@example.com', phone: '', company: 'Test Resort', units: '4', bedrooms: 'either', moveIn: '2026-12-01', stayLength: 'Ski season, about 5 months', message: '', consent: 'yes', companyUrl: '' };
const suggestion = { type: 'contact', name: 'Local tester', email: 'test@example.com', message: 'A test-only message for the private queue.', consent: 'yes', companyUrl: '' };
async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  await migrateLocal(sqlite);
  t.after(() => sqlite.close());
  return { sqlite, env: { DB: adaptDb(sqlite), LOCAL_PREVIEW: true, SITE_URL: origin } };
}
const post = (path, body, headers = {}) => new Request(origin + path, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const housing = (body = valid, headers) => post('/api/housing-inquiries', body, headers);
const count = (sqlite, table) => sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

test('stores a valid employer inquiry and queues a notification', async t => {
  const { sqlite, env } = await fixture(t);
  const response = await handleApi(housing(), env);
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.ok, true);
  const row = sqlite.prepare('SELECT * FROM housing_inquiries').get();
  assert.equal(row.id, result.id);
  assert.equal(row.units, 4);
  assert.equal(row.requester, 'employer');
  assert.equal(row.move_in, '2026-12-01');
  const queued = sqlite.prepare('SELECT * FROM housing_notifications').all();
  assert.equal(queued.length, 1);
  assert.equal(queued[0].status, 'pending');
  assert.equal(count(sqlite, 'submissions'), 0);
});

test('rejects invalid inquiries without storage', async t => {
  const { sqlite, env } = await fixture(t);
  const patches = [{ requester: 'agency' }, { company: '' }, { requester: 'individual', units: '3' }, { units: '0' }, { units: '51' }, { units: '2.5' }, { bedrooms: '3' }, { moveIn: 'next week' }, { stayLength: '' }, { email: 'nope' }, { consent: 'no' }, { companyUrl: 'spam' }, { phone: 'x'.repeat(41) }];
  for (const patch of patches) assert.equal((await handleApi(housing({ ...valid, ...patch }), env)).status, 400, JSON.stringify(patch));
  assert.equal(count(sqlite, 'housing_inquiries'), 0);
});

test('individual inquiry without company is accepted', async t => {
  const { env } = await fixture(t);
  assert.equal((await handleApi(housing({ ...valid, requester: 'individual', company: '', units: '1' }), env)).status, 201);
  assert.equal((await handleApi(housing({ ...valid, requester: 'individual', company: '', units: '2' }), env)).status, 201);
});

test('production requires the housing Turnstile action', async t => {
  const { sqlite, env } = await fixture(t);
  delete env.LOCAL_PREVIEW;
  env.TURNSTILE_SECRET = 'test-secret';
  env.TURNSTILE_SITE_KEY = 'test-key';
  const original = globalThis.fetch;
  const result = { success: true, hostname: 'tetoncounty.us', action: 'suggest' };
  globalThis.fetch = async () => Response.json(result);
  t.after(() => { globalThis.fetch = original; });
  const body = { ...valid, turnstileToken: 'token' };
  assert.equal((await handleApi(housing(body), env)).status, 400);
  assert.equal(count(sqlite, 'housing_inquiries'), 0);
  result.action = 'housing';
  assert.equal((await handleApi(housing(body), env)).status, 201);
  // The suggestion form still expects its own action.
  assert.equal((await handleApi(post('/api/submissions', { ...suggestion, turnstileToken: 'token' }), env)).status, 400);
});

test('suggestion and housing rate limits are independent', async t => {
  const { env } = await fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await handleApi(post('/api/submissions', suggestion), env)).status, 201);
  assert.equal((await handleApi(housing(), env)).status, 201);
  for (let i = 0; i < 4; i++) assert.equal((await handleApi(housing(), env)).status, 201);
  assert.equal((await handleApi(housing(), env)).status, 429);
});

test('cross-origin and non-JSON housing requests are refused', async t => {
  const { sqlite, env } = await fixture(t);
  assert.equal((await handleApi(housing(valid, { origin: 'https://elsewhere.example' }), env)).status, 403);
  assert.equal((await handleApi(housing(valid, { 'content-type': 'text/plain' }), env)).status, 415);
  assert.equal((await handleApi(new Request(origin + '/api/housing-inquiries'), env)).status, 405);
  assert.equal(count(sqlite, 'housing_inquiries'), 0);
});

function insertInquiry(sqlite, id = 'housing-reference') {
  sqlite.prepare('INSERT INTO housing_inquiries (id, requester, name, email, phone, company, units, bedrooms, move_in, stay_length, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, 'employer', valid.name, valid.email, '', valid.company, 4, 'either', valid.moveIn, valid.stayLength, '', '2026-10-20T17:00:00Z');
}
function insertSuggestion(sqlite) {
  sqlite.prepare('INSERT INTO submissions (id, type, listing_id, name, email, place_name, town, website, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('suggestion-reference', 'contact', null, suggestion.name, suggestion.email, '', '', '', suggestion.message, '2026-10-20T17:00:00Z');
}
const housingStatus = sqlite => sqlite.prepare('SELECT * FROM housing_notifications').get();

test('housing rows are delivered only to the housing form', async t => {
  const { sqlite, env } = await fixture(t);
  const live = { ...env, LOCAL_PREVIEW: false, FORMSPREE_FORM_ID: 'meaedrjo', FORMSPREE_HOUSING_FORM_ID: 'xkjoayyr' };
  insertSuggestion(sqlite);
  insertInquiry(sqlite);
  const calls = [];
  const fetcher = async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return Response.json({ ok: true }); };
  await deliverNotifications(live, { fetcher });
  await deliverNotifications(live, { fetcher, queue: 'housing' });
  assert.deepEqual(calls.map(c => c.url).sort(), ['https://formspree.io/f/meaedrjo', 'https://formspree.io/f/xkjoayyr']);
  const body = calls.find(c => c.url.endsWith('xkjoayyr')).body;
  assert.equal(body.units, 4);
  assert.equal(body.company, 'Test Resort');
  assert.equal(body.moveIn, '2026-12-01');
  assert.match(body.subject, /^TetonCounty\.us: Housing inquiry — Test Resort, 4 unit\(s\)/);
  assert.equal(body.source, origin + '/corporate-housing/');
  assert.equal(housingStatus(sqlite).status, 'sent');
});

test('an empty housing form ID leaves inquiries pending and still sends suggestions', async t => {
  const { sqlite, env } = await fixture(t);
  const live = { ...env, LOCAL_PREVIEW: false, FORMSPREE_FORM_ID: 'meaedrjo', FORMSPREE_HOUSING_FORM_ID: '' };
  insertSuggestion(sqlite);
  insertInquiry(sqlite);
  const urls = [];
  const fetcher = async url => { urls.push(url); return Response.json({ ok: true }); };
  await deliverNotifications(live, { fetcher });
  await deliverNotifications(live, { fetcher, queue: 'housing' });
  assert.deepEqual(urls, ['https://formspree.io/f/meaedrjo']);
  assert.equal(housingStatus(sqlite).status, 'pending');
  assert.equal(housingStatus(sqlite).attempts, 0);
});

test('invalid housing form ID throws', async t => {
  const { env } = await fixture(t);
  await assert.rejects(deliverNotifications({ ...env, LOCAL_PREVIEW: false, FORMSPREE_HOUSING_FORM_ID: 'https://elsewhere.example/' }, { queue: 'housing' }), /Invalid Formspree form ID/);
});

test('development never forwards housing inquiries', async t => {
  const { sqlite, env } = await fixture(t);
  insertInquiry(sqlite);
  let called = false;
  await deliverNotifications({ ...env, LOCAL_PREVIEW: false, ENVIRONMENT: 'development', FORMSPREE_HOUSING_FORM_ID: 'xkjoayyr' }, { queue: 'housing', fetcher: async () => { called = true; return Response.json({ ok: true }); } });
  assert.equal(called, false);
  assert.equal(housingStatus(sqlite).status, 'pending');
});

// Built-page checks; run `npm run build` first.
const page = () => readFile('dist/corporate-housing/index.html', 'utf8');
const pageText = html => html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#36;/g, '$');

test('corporate housing page is public, linked, and in the sitemap', async () => {
  const html = await page();
  assert(html.includes('<a aria-current="page" href="/corporate-housing/">Corporate housing</a>'));
  assert((await readFile('dist/sitemap.xml', 'utf8')).includes('/corporate-housing/</loc>'));
  const llms = await readFile('dist/llms.txt', 'utf8');
  assert(llms.includes('/corporate-housing/'));
  assert(!llms.includes('Apartment lead generation is not part of this release.'));
  if (!isDevelopment) assert(!/<meta name="robots"[^>]*noindex/.test(html));
});

test('corporate housing never implies furnished units', async () => {
  const html = await page();
  const staged = html.match(/<figure class="[^"]*\bhousing-staged\b[\s\S]*?<\/figure>/g) ?? [];
  assert(staged.length >= 8, `expected every interior photo, found ${staged.length}`);
  for (const figure of staged) assert(figure.includes('leased unfurnished'), figure);
  const text = pageText(html).toLowerCase();
  assert(!text.includes('furnished apartment'));
  assert(!text.includes('fully furnished'));
});

test('corporate housing shows no prices or invented terms', async () => {
  const text = pageText(await page());
  assert(!/\$\s*\d/.test(text));
  assert(!text.includes('/mo'));
});

test('corporate housing form posts to its own endpoint', async () => {
  const html = await page();
  for (const marker of ['id="housing-form"', 'name="companyUrl"', 'name="consent"', 'id="housing-turnstile"']) assert(html.includes(marker), marker);
  assert(!html.includes('/api/submissions'));
});

test('commute block withholds times without JavaScript', async () => {
  const html = await page();
  assert.match(html, /<div[^>]*data-pass-directions[^>]*\bhidden\b/);
  assert.match(html.match(/<noscript>[\s\S]*?<\/noscript>/g)?.join('') ?? '', /Wyoming 511/);
});
