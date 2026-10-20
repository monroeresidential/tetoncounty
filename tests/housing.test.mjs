import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { adaptDb } from '../scripts/sqlite-adapter.mjs';
import { migrateLocal } from '../scripts/local-migrations.mjs';
import { handleApi } from '../src/worker.mjs';

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
