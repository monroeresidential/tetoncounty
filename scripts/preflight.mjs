import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
const environment = process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : 'production';
assert(['production', 'dev'].includes(environment), 'Unknown deployment environment.');
const target = environment === 'dev' ? config.env?.dev : config;
assert(target?.d1_databases?.[0]?.database_id && !target.d1_databases[0].database_id.includes('REPLACE_'), 'Configure the database before deploying.');
assert(target.vars?.TURNSTILE_SITE_KEY && !target.vars.TURNSTILE_SITE_KEY.includes('PENDING'), 'Configure the Turnstile widget before deploying.');
const html = await readFile('dist/index.html', 'utf8');
assert(html.includes(`<link rel="canonical" href="${target.vars.SITE_URL}/"`), 'Build origin does not match the deployment target. Rebuild for the correct environment.');
if (environment === 'dev') {
  assert.notEqual(target.name, config.name, 'Development must deploy to a separate Worker.');
  assert.notEqual(target.d1_databases[0].database_id, config.d1_databases[0].database_id, 'Development cannot use the production database.');
  assert.equal(target.vars.ENVIRONMENT, 'development');
  assert.equal(target.vars.FORMSPREE_FORM_ID, '', 'Development email delivery must be disabled.');
  assert.equal(target.workers_dev, false, 'Disable the alternate public Worker hostname.');
  assert.equal(target.preview_urls, false, 'Disable public version preview URLs.');
  assert.deepEqual(target.triggers.crons, [], 'Development must not run production notification jobs.');
  assert.deepEqual(target.routes, [{ pattern: 'dev.tetoncounty.us', custom_domain: true }]);
  assert(html.includes('Development preview') && html.includes('content="noindex,nofollow,noarchive"'));
  assert((await readFile('dist/_headers', 'utf8')).includes('X-Robots-Tag: noindex, nofollow, noarchive'));
} else {
  assert(!html.includes('Development preview'), 'A development build cannot be deployed to production.');
}
console.log(`Deployment preflight passed for ${environment}: ${target.name}.`);
