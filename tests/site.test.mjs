import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { listingSchema } from '../src/lib/listing-schema.ts';
import { loadListings } from '../src/data.ts';
import { listingIds } from '../src/listing-ids.mjs';
import sharp from 'sharp';
import { siteUrl } from '../src/config.ts';

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

test('listing photos are approved, local, responsive, and attached to exact listing IDs', async () => {
  const catalog = JSON.parse(await read('data/listing-images.json')).images;
  const review = JSON.parse(await readFile('research/listing-image-review.json', 'utf8')).items;
  const photos = new Map(catalog.map(photo => [photo.listingId, photo]));
  assert.equal(photos.size, catalog.length, 'One approved image per listing');
  assert.deepEqual(new Set(photos.keys()), new Set(review.filter(item => item.decision === 'approved').map(item => item.listingId)));
  for (const photo of catalog) {
    assert(listingIds.has(photo.listingId));
    assert.equal(photo.status, 'approved');
    assert.equal(new URL(photo.sourceUrl).hostname, 'tetonflats.com');
    assert(photo.rightsBasis && photo.alt && photo.credit);
    assert(photo.variants.some(variant => variant.webp === photo.src));
    for (const variant of photo.variants) for (const format of ['webp', 'avif']) {
      assert.match(variant[format], /^\/images\/listings\/[a-z0-9-]+\.(avif|webp)$/);
      const bytes = await readFile(`dist${variant[format]}`);
      const dimensions = await sharp(bytes).metadata();
      assert.equal(bytes.length, variant[`${format}Bytes`]);
      assert.equal(dimensions.width, variant.width);
      assert.equal(dimensions.height, variant.height);
    }
  }
  for (const listing of listings) {
    const html = await read(`places/${listing.id}/index.html`);
    const place = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'].find(item => item['@type'] === 'Place');
    assert.equal(place.image?.contentUrl, photos.has(listing.id) ? `${siteUrl}${photos.get(listing.id).src}` : undefined);
  }
  const directory = await read('explore/index.html');
  for (const [image] of directory.matchAll(/<img[^>]+src="\/images\/listings\/[^>]+>/g)) {
    assert(image.includes('loading="lazy"'), 'Directory thumbnails must not all load eagerly');
    assert(image.includes('srcset=') && image.includes('sizes='));
  }
  const pending = JSON.parse(await readFile('research/photo-permission-requests.json', 'utf8')).items;
  for (const candidate of pending) {
    assert.equal(candidate.status, 'permission-needed');
    assert.equal(candidate.localAsset, null);
    assert(!photos.has(candidate.listingId), `Unapproved image must stay unpublished: ${candidate.listingId}`);
  }
});
