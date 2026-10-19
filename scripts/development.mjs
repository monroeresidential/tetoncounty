import { spawnSync } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const command = process.argv[2];
assert(['build', 'check'].includes(command), 'Use development.mjs build or check.');
const result = spawnSync('npm', ['run', command], {
  stdio: 'inherit',
  env: { ...process.env, SITE_URL: 'https://dev.tetoncounty.us', PUBLIC_SITE_ENV: 'development' },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const headers = await readFile('dist/_headers', 'utf8');
await writeFile('dist/_headers', `${headers}\n/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n`);
assert.equal(await readFile('dist/robots.txt', 'utf8'), 'User-agent: *\nDisallow: /\n');
const files = await readdir('dist', { recursive: true });
for (const file of files.filter(file => file.endsWith('.html'))) {
  const html = await readFile(`dist/${file}`, 'utf8');
  assert(html.includes('content="noindex,nofollow,noarchive"'), `Missing noindex: ${file}`);
  assert(html.includes('Development preview'), `Missing development banner: ${file}`);
  assert(html.includes('href="https://dev.tetoncounty.us/'), `Incorrect development canonical: ${file}`);
}
for (const file of files.filter(file => file.startsWith('_astro/') && file.endsWith('.js'))) {
  assert(!(await readFile(`dist/${file}`, 'utf8')).includes('G-S96WQNBJC4'), 'Production analytics leaked into development bundle.');
}
console.log('Verified development HTML, crawler exclusions, and analytics isolation.');
