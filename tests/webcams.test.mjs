import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseWebcams, webcamImageOrigin } from '../src/lib/webcams.ts';
import { handleApi } from '../src/worker.mjs';

const feature = (path, extra = {}) => ({
  type: 'Feature', id: path, geometry: { type: 'Point', coordinates: [-110.95621, 43.49868] },
  properties: { name: `Camera ${path}`, image_url: `${webcamImageOrigin}/${path}`, approximate: false, source: 'wydot', ...extra },
});
const feed = features => ({ type: 'FeatureCollection', features });

test('webcam feed keeps only same-bucket JPEG cameras and groups them by corridor', () => {
  const cameras = parseWebcams(feed([
    feature('Teton_Pass/latest/east.jpg'),
    feature('Teton_Valley_ID/latest/tetoncam-driggs.jpg', { name: 'TetonCam (Driggs)', source: 'direct', approximate: true }),
    feature('Somewhere_New/latest/cam.jpg'),
    feature('Teton_Valley_ID/latest/faa-north.jpg', { source: 'faa' }),
    feature('Teton_Pass/latest/east.jpg'),
    feature('x/latest/cam.jpg', { image_url: 'https://elsewhere.example/x.jpg' }),
    feature('x/latest/cam.jpg', { image_url: `${webcamImageOrigin.replace('https', 'http')}/x.jpg` }),
    feature('x/latest/page.html'),
    feature('x/latest/cam.jpg', { image_url: `${webcamImageOrigin}/x.jpg?redirect=1` }),
    { ...feature('x/latest/nowhere.jpg'), geometry: { type: 'Point', coordinates: [] } },
  ]));
  assert.deepEqual(cameras.map(c => [c.id, c.area]), [
    ['Teton_Pass/latest/east.jpg', 'teton-pass'],
    ['Teton_Valley_ID/latest/tetoncam-driggs.jpg', 'teton-valley'],
    ['Teton_Valley_ID/latest/faa-north.jpg', 'teton-valley'],
    ['Somewhere_New/latest/cam.jpg', 'more'],
  ]);
  assert.equal(cameras[2].credit, 'Federal Aviation Administration');
  assert.equal(cameras[0].credit, 'Wyoming Department of Transportation');
  assert.equal(cameras[1].credit, 'TetonCam');
  assert.equal(cameras[1].approximate, true);
  assert.throws(() => parseWebcams({ features: [] }));
});

test('the webcam API proxies the feed and fails closed', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const request = new Request('https://dev.tetoncounty.us/api/webcams');
  globalThis.fetch = async () => Response.json(feed([feature('Wilson/latest/west.jpg')]));
  const ok = await handleApi(request, {});
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('Cache-Control'), 'public, max-age=60');
  assert.equal((await ok.json()).cameras[0].area, 'teton-pass');
  for (const upstream of [async () => new Response('', { status: 500 }), async () => Response.json(feed([])), async () => { throw new Error('offline'); }]) {
    globalThis.fetch = upstream;
    assert.equal((await handleApi(request, {})).status, 503);
  }
});

test('webcam page is public, linked, and allowed to load camera images', async () => {
  const html = await readFile('dist/webcams/index.html', 'utf8');
  if (!html.includes('Development preview')) assert(!html.includes('<meta name="robots"'));
  assert(html.includes('<a aria-current="page" href="/webcams/">Webcams</a>'));
  assert(/<dialog class="lightbox"[^>]*aria-labelledby="lightbox-title"/.test(html), 'Lightbox dialog is labelled');
  for (const label of ['Previous camera', 'Next camera', 'Close']) assert(html.includes(`<span class="sr-only">${label}</span>`), label);
  assert((await readFile('dist/sitemap.xml', 'utf8')).includes('/webcams/</loc>'));
  assert((await readFile('public/_headers', 'utf8')).match(/img-src [^;]*/)[0].includes(webcamImageOrigin));
});
