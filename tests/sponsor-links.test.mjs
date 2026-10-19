import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { sponsorLink, sponsorCampaign } from '../src/lib/sponsor.ts';
import { siteUrl } from '../src/config.ts';

const host = new URL(siteUrl).host;
const pages = (await readdir('dist', { recursive: true })).filter(file => file.endsWith('.html'));
const pagePath = file => '/' + file.replace(/index\.html$/, '').replace(/\.html$/, '');

test('sponsor links name the page as the campaign and the placement as the content', () => {
  assert.deepEqual(sponsorCampaign('/'), { campaign: 'tetoncounty_home', term: undefined });
  assert.deepEqual(sponsorCampaign('/webcams/'), { campaign: 'tetoncounty_webcams', term: undefined });
  assert.deepEqual(sponsorCampaign('/places/butter-cafe/'), { campaign: 'tetoncounty_places', term: 'butter-cafe' });
  const url = new URL(sponsorLink('https://tetonflats.com/floorplans', '/live/', 'hero'));
  assert.equal(url.pathname, '/floorplans');
  assert.deepEqual(Object.fromEntries(url.searchParams), { utm_source: host, utm_medium: 'referral', utm_campaign: 'tetoncounty_live', utm_content: 'hero' });
  assert.equal(sponsorLink('https://downtowndriggs.org/', '/', 'source_link'), 'https://downtowndriggs.org/');
  assert.equal(sponsorLink('https://evil.example/?u=tetonflats.com', '/', 'x'), 'https://evil.example/?u=tetonflats.com');
});

test('every rendered Teton Flats link is sponsored and tagged for the page it is on', async () => {
  let links = 0;
  for (const file of pages) {
    const html = await readFile(`dist/${file}`, 'utf8');
    const { campaign, term } = sponsorCampaign(pagePath(file));
    for (const [tag] of html.matchAll(/<a\b[^>]*href="https?:\/\/(?:[\w-]+\.)*tetonflats\.com[^"]*"[^>]*>/g)) {
      links++;
      const params = new URL(tag.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&')).searchParams;
      assert.equal(params.get('utm_source'), host, `${file}: ${tag}`);
      assert.equal(params.get('utm_medium'), 'referral', `${file}: ${tag}`);
      assert.equal(params.get('utm_campaign'), campaign, `${file}: ${tag}`);
      assert.equal(params.get('utm_term'), term ?? null, `${file}: ${tag}`);
      assert.match(params.get('utm_content') ?? '', /^[a-z0-9_]+$/, `${file}: ${tag}`);
      assert.match(tag, /rel="[^"]*\bsponsored\b/, `${file}: ${tag}`);
    }
  }
  assert(links > pages.length, 'Expected sponsor links on every page');
});

// The sponsor feature page and headings next to an existing link are deliberately left as plain text.
test('Teton Flats is linked wherever it appears in body text', async () => {
  for (const file of pages.filter(file => !file.startsWith('live/'))) {
    const text = (await readFile(`dist/${file}`, 'utf8'))
      .replace(/<(script|style|title|h[1-6]|a)\b[\s\S]*?<\/\1>/g, ' ')
      .replace(/<[^>]+>/g, ' ');
    assert(!text.includes('Teton Flats'), `${file}: unlinked "Teton Flats" near "${text.slice(Math.max(0, text.indexOf('Teton Flats') - 60), text.indexOf('Teton Flats') + 20).replace(/\s+/g, ' ')}"`);
  }
});

test('machine-readable exports keep clean source URLs', async () => {
  for (const file of ['data/listings.json', 'llms.txt', 'llms-full.txt']) assert(!(await readFile(`dist/${file}`, 'utf8')).includes('utm_'), file);
  for (const file of pages) for (const [, json] of (await readFile(`dist/${file}`, 'utf8')).matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) assert(!json.includes('utm_'), file);
});
