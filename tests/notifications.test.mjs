import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { adaptDb } from '../scripts/sqlite-adapter.mjs';
import { migrateLocal } from '../scripts/local-migrations.mjs';
import { deliverNotifications } from '../src/lib/form-notifications.ts';
import { handleApi } from '../src/worker.mjs';

const origin = 'https://tetoncounty.us';
const valid = { type: 'addition', name: 'Local tester', email: 'test@example.com', placeName: 'Test-only place', town: 'Victor', website: 'https://example.com/', message: 'A test-only suggestion for the private review queue.', consent: 'yes', companyUrl: '', turnstileToken: 'private-token' };
async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  await migrateLocal(sqlite);
  t.after(() => sqlite.close());
  return { sqlite, env: { DB: adaptDb(sqlite), SITE_URL: origin, FORMSPREE_FORM_ID: 'meaedrjo', TURNSTILE_SECRET: 'test-secret', TURNSTILE_SITE_KEY: 'test-key' } };
}
function insert(sqlite, id = 'test-reference', type = 'addition') {
  sqlite.prepare('INSERT INTO submissions (id, type, listing_id, name, email, place_name, town, website, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, type, type === 'correction' ? 'butter-cafe' : null, valid.name, valid.email, valid.placeName, valid.town, valid.website, valid.message, '2026-10-18T17:00:00Z');
}
function notification(sqlite, id = 'test-reference') {
  return sqlite.prepare('SELECT * FROM submission_notifications WHERE submission_id = ?').get(id);
}

test('the migration queues new requests atomically without emailing old requests', async t => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(readFileSync('migrations/0001_submissions.sql', 'utf8'));
  insert(sqlite, 'existing');
  await migrateLocal(sqlite);
  await migrateLocal(sqlite);
  assert.equal(notification(sqlite, 'existing'), undefined);
  insert(sqlite);
  assert.equal(notification(sqlite).status, 'pending');
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM submission_notifications').get().n, 1);
});

test('all request types reach only the configured form with reply-to and the saved reference', async t => {
  const { sqlite, env } = await fixture(t);
  for (const type of ['addition', 'correction', 'contact']) insert(sqlite, type, type);
  const sent = [];
  await deliverNotifications(env, { fetcher: async (url, options) => {
    assert.equal(url, 'https://formspree.io/f/meaedrjo');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Accept, 'application/json');
    const body = JSON.parse(options.body);
    assert.equal(body.email, valid.email);
    assert.equal(body.message, valid.message);
    assert(body.subject.startsWith('TetonCounty.us:'));
    assert(!options.body.includes('private-token'));
    assert(!options.body.includes('test-secret'));
    assert.equal(body.turnstileToken, undefined);
    assert.equal(body.to, undefined);
    sent.push(body);
    return Response.json({ ok: true });
  } });
  assert.equal(sent.length, 3);
  assert.equal(sent.find(b => b.reference === 'correction').listingUrl, origin + '/places/butter-cafe/');
  assert.equal(sent.find(b => b.reference === 'contact').placeName, undefined);
  for (const body of sent) assert.equal(notification(sqlite, body.reference).status, 'sent');
  await deliverNotifications(env, { fetcher: async () => assert.fail('Already sent request was delivered twice') });
});

test('temporary failures retry after backoff and stop after acceptance', async t => {
  const { sqlite, env } = await fixture(t);
  insert(sqlite);
  let timestamp = 1000;
  await deliverNotifications(env, { now: () => timestamp, fetcher: async () => new Response('', { status: 503 }) });
  assert.equal(notification(sqlite).status, 'pending');
  assert.equal(notification(sqlite).last_error, 'http_503');
  await deliverNotifications(env, { now: () => timestamp, fetcher: async () => assert.fail('Retried too early') });
  timestamp = notification(sqlite).next_attempt_at;
  await deliverNotifications(env, { now: () => timestamp, fetcher: async () => Response.json({ ok: true }) });
  assert.equal(notification(sqlite).status, 'sent');
  assert.equal(notification(sqlite).attempts, 2);
});

test('provider rejections and non-acceptance are recorded as failures', async t => {
  const { sqlite, env } = await fixture(t);
  for (const [id, response] of [['rejected', new Response('', { status: 422 })], ['challenge', Response.json({ ok: false })]]) {
    insert(sqlite, id);
    await deliverNotifications(env, { submissionId: id, fetcher: async () => response });
    assert.equal(notification(sqlite, id).status, 'failed');
    assert.equal(notification(sqlite, id).sent_at, null);
  }
});

test('local preview and missing configuration never send email', async t => {
  const { sqlite, env } = await fixture(t);
  insert(sqlite);
  const fetcher = async () => assert.fail('Unexpected outbound email');
  await deliverNotifications({ ...env, LOCAL_PREVIEW: true }, { fetcher });
  await deliverNotifications({ ...env, ENVIRONMENT: 'development' }, { fetcher });
  await deliverNotifications({ ...env, FORMSPREE_FORM_ID: undefined }, { fetcher });
  assert.equal(notification(sqlite).attempts, 0);
  await assert.rejects(deliverNotifications({ ...env, FORMSPREE_FORM_ID: 'https://elsewhere.example/' }, { fetcher }));
});

test('concurrent deliveries claim a request only once and expired leases recover', async t => {
  const { sqlite, env } = await fixture(t);
  insert(sqlite);
  let calls = 0;
  const fetcher = async () => { calls++; return Response.json({ ok: true }); };
  await Promise.all([deliverNotifications(env, { fetcher }), deliverNotifications(env, { fetcher })]);
  assert.equal(calls, 1);
  insert(sqlite, 'interrupted');
  sqlite.prepare("UPDATE submission_notifications SET status = 'sending', attempts = 1, next_attempt_at = 0 WHERE submission_id = 'interrupted'").run();
  await deliverNotifications(env, { fetcher });
  assert.equal(notification(sqlite, 'interrupted').status, 'sent');
});

test('retry attempts are bounded, including a crash during the last attempt', async t => {
  const { sqlite, env } = await fixture(t);
  insert(sqlite);
  sqlite.prepare('UPDATE submission_notifications SET attempts = 7').run();
  await deliverNotifications(env, { fetcher: async () => new Response('', { status: 429 }) });
  assert.equal(notification(sqlite).status, 'failed');
  assert.equal(notification(sqlite).attempts, 8);
  sqlite.prepare("UPDATE submission_notifications SET status = 'sending', next_attempt_at = 0").run();
  await deliverNotifications(env, { fetcher: async () => assert.fail('Exhausted request was sent') });
  assert.equal(notification(sqlite).status, 'failed');
});

test('a valid production request is saved before notification and email failure is not a submission failure', async t => {
  const { sqlite, env } = await fixture(t);
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async url => {
    if (url.includes('challenges.cloudflare.com')) return Response.json({ success: true, hostname: 'tetoncounty.us', action: 'suggest' });
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM submissions').get().n, 1);
    return new Response('', { status: 503 });
  };
  const background = [];
  const request = new Request(origin + '/api/submissions', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(valid) });
  const response = await handleApi(request, env, { waitUntil: promise => background.push(promise) });
  assert.equal(response.status, 201);
  const { id } = await response.json();
  await Promise.all(background);
  assert.equal(notification(sqlite, id).status, 'pending');
  assert.equal(sqlite.prepare('SELECT status FROM submissions WHERE id = ?').get(id).status, 'pending');
});

test('development requires its own verified hostname and never sends even with a production form ID', async t => {
  const { sqlite, env } = await fixture(t);
  env.ENVIRONMENT = 'development';
  env.SITE_URL = 'https://dev.tetoncounty.us';
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let hostname = 'tetoncounty.us';
  globalThis.fetch = async url => {
    assert(url.startsWith('https://challenges.cloudflare.com/'), 'Development tried to send an email');
    return Response.json({ success: true, hostname, action: 'suggest' });
  };
  const submit = () => handleApi(new Request(env.SITE_URL + '/api/submissions', {
    method: 'POST', headers: { origin: env.SITE_URL, 'content-type': 'application/json' }, body: JSON.stringify(valid),
  }), env);
  assert.equal((await submit()).status, 400);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM submissions').get().n, 0);
  hostname = 'dev.tetoncounty.us';
  const response = await submit();
  assert.equal(response.status, 201);
  const { id } = await response.json();
  assert.equal(notification(sqlite, id).attempts, 0);
  assert.equal((await (await handleApi(new Request(env.SITE_URL + '/api/config'), env)).json()).mode, 'development');
});
