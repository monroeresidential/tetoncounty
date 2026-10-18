import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { listingSchema } from '../src/lib/listing-schema.ts';
import { loadListings } from '../src/data.ts';
import { listingIds } from '../src/listing-ids.mjs';

const listings = await loadListings();
const read = path => readFile(`dist/${path}`, 'utf8');

test('content schema accepts the inventory and rejects invalid public records', () => {
  for (const listing of listings) assert(listingSchema.safeParse(listing).success, listing.id);
  for (const patch of [
    { category: 'unknown' }, { sourceUrls: [] }, { website: 'javascript:alert(1)' },
    { sourceCheckedAt: 'not-a-date' }, { latitude: 43, longitude: undefined },
    { latitude: 0, longitude: 0 }, { id: '../private' },
  ]) assert.equal(listingSchema.safeParse({ ...listings[0], ...patch }).success, false);
});

test('public JSON and the form allowlist match every curated listing', async () => {
  const exported = JSON.parse(await read('data/listings.json'));
  assert.equal(exported.count, listings.length);
  assert.equal(exported.listings.filter(item => item.trail).length, 31);
  assert.deepEqual(new Set(exported.listings.map(item => item.id)), listingIds);
  assert.deepEqual(exported.listings.map(({ url, ...item }) => item), listings);
});

test('each listing is rendered as readable HTML with its canonical URL and structured data', async () => {
  const sitemap = await read('sitemap.xml');
  for (const listing of listings) {
    const html = await read(`places/${listing.id}/index.html`);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
    const place = graph.find(item => item['@type'] === 'Place');
    assert.equal(place.name, listing.name);
    assert.equal(place.description, listing.description);
    assert(html.includes(`<link rel="canonical" href="${place.url}"`));
    assert(sitemap.includes(`<loc>${place.url}</loc>`));
    assert(html.includes(`/suggest/?type=correction&amp;listing=${listing.id}`));
    assert.equal(place.address?.streetAddress, listing.address);
  }
});

test('Astro emits external executable scripts compatible with the production CSP', async () => {
  for (const path of ['index.html', 'explore/index.html', 'suggest/index.html']) {
    const html = await read(path);
    assert.match(html, /<meta name="generator" content="Astro v/);
    assert.match(html, /<script type="module" src="\/_astro\//);
    for (const [full, attributes, body] of html.matchAll(/<script([^>]*)>(.*?)<\/script>/gs)) {
      if (body.trim()) assert(/type="application\/(?:ld\+)?json"/.test(attributes), `Unexpected executable inline script: ${full}`);
    }
    assert(!html.includes('LOCAL_PREVIEW'));
  }
});

test('hiking and town pages preserve their directory boundaries without JavaScript', async () => {
  for (const [path, expected] of [
    ['hiking/index.html', listings.filter(l => l.trail)],
    ['towns/victor/index.html', listings.filter(l => l.town === 'Victor')],
    ['towns/driggs/index.html', listings.filter(l => l.town === 'Driggs')],
  ]) {
    const html = await read(path);
    const ids = [...html.matchAll(/data-listing="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(ids, expected.map(l => l.id));
    const points = JSON.parse(html.match(/<script type="application\/json" id="map-data">(.*?)<\/script>/s)[1]);
    assert(points.every(point => ids.includes(point.id)));
  }
});
