import { mkdir, writeFile } from 'node:fs/promises';

// Example: PAGESPEED_API_KEY=... node scripts/pagespeed.mjs https://tetoncounty.us/ after
// The key stays in the process environment, never in source or report filenames.
const [target = 'https://tetoncounty.us/', label = 'latest'] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a simple report label.');
const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
endpoint.searchParams.set('url', target);
endpoint.searchParams.set('strategy', 'mobile');
for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) endpoint.searchParams.append('category', category);
if (process.env.PAGESPEED_API_KEY) endpoint.searchParams.set('key', process.env.PAGESPEED_API_KEY);
let response;
try {
  response = await fetch(endpoint, { signal: AbortSignal.timeout(180_000) });
} catch {
  throw new Error('PageSpeed request could not complete. Check connectivity and try again.');
}
if (!response.ok) throw new Error(`PageSpeed returned HTTP ${response.status}; check the API key, quota, and target URL.`);
const report = await response.json();
if (!report.lighthouseResult || report.lighthouseResult.runtimeError) throw new Error('Lighthouse could not finish this page; inspect the target before retrying.');
await mkdir('.local', { recursive: true });
await writeFile(`.local/pagespeed-${label}.json`, JSON.stringify(report));
const { categories, audits, fetchTime } = report.lighthouseResult;
console.log(JSON.stringify({ target, fetchTime, scores: Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, Math.round(value.score * 100)])), metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift'].map(key => [key, audits[key].displayValue])), bytes: audits['total-byte-weight'].numericValue }, null, 2));
