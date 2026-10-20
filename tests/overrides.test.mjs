import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOverrides } from '../src/lib/overrides.ts';
import { loadListings, loadRemovedRedirects } from '../src/data.ts';

const fixture = () => [
  { id: 'alpha', name: 'Alpha', category: 'food-drink', website: 'https://alpha.example/' },
  { id: 'beta', name: 'Beta', category: 'shopping', website: 'https://beta.example/' },
];
const decided = { reason: 'test', decidedAt: '2026-10-20' };

test('applies field overrides and clears fields set to null', () => {
  const { listings, removed } = applyOverrides(fixture(), {
    listings: { alpha: { website: null, ...decided }, beta: { website: 'https://beta.example/new', ...decided } },
    removed: {},
  });
  const alpha = listings.find(l => l.id === 'alpha');
  assert.equal('website' in alpha, false);
  assert.equal(listings.find(l => l.id === 'beta').website, 'https://beta.example/new');
  assert.equal('reason' in alpha, false);
  assert.deepEqual(removed, []);
});

test('removes listings and returns their redirects', () => {
  const { listings, removed } = applyOverrides(fixture(), {
    listings: { beta: { website: null, ...decided } },
    removed: { beta: { redirect: '/categories/shopping/', ...decided } },
  });
  assert.deepEqual(listings.map(l => l.id), ['alpha']);
  assert.deepEqual(removed, [{ id: 'beta', redirect: '/categories/shopping/' }]);
});

test('throws on an override for an unknown listing', () => {
  assert.throws(() => applyOverrides(fixture(), { listings: { ghost: { website: null, ...decided } }, removed: {} }), /Override for unknown listing: ghost/);
  assert.throws(() => applyOverrides(fixture(), { listings: {}, removed: { ghost: { redirect: '/categories/shopping/', ...decided } } }), /Override for unknown listing: ghost/);
});

test('throws on a redirect outside the category pages', () => {
  assert.throws(() => applyOverrides(fixture(), { listings: {}, removed: { alpha: { redirect: '/elsewhere/', ...decided } } }), /redirect/i);
});

test('the shipped overrides file applies to the real listings', async () => {
  const listings = await loadListings();
  assert.ok(listings.length > 0);
  const redirects = await loadRemovedRedirects();
  assert.ok(Array.isArray(redirects));
  const ids = new Set(listings.map(l => l.id));
  for (const { id } of redirects) assert.equal(ids.has(id), false);
});

test('applies a reviewed phone and its source', () => {
  const { listings } = applyOverrides(fixture(), {
    listings: { alpha: { phone: '208-354-2344', phoneSource: 'https://alpha.example/contact', ...decided } },
    removed: {},
  });
  const alpha = listings.find(l => l.id === 'alpha');
  assert.equal(alpha.phone, '208-354-2344');
  assert.equal(alpha.phoneSource, 'https://alpha.example/contact');
});

test('throws on a malformed phone or an empty phoneSource', () => {
  for (const phone of ['(208) 354-2344', '208-354-23', 2083542344])
    assert.throws(() => applyOverrides(fixture(), { listings: { alpha: { phone, ...decided } }, removed: {} }), /invalid phone/);
  assert.throws(() => applyOverrides(fixture(), { listings: { alpha: { phoneSource: ' ', ...decided } }, removed: {} }), /invalid phoneSource/);
});

const auditRemovedLinks = [
  'cryo-therapy-idaho', 'three-peaks-restaurant-and-catering', 'warbirds-cafe', 'grand-teton-floor-and-window-coverings',
  'mountain-high-mounted-shooters', 'berkshire-hathaway', 'chircop-and-associates-pllc', 'davison-spas', 'elements-of-health',
  'foxtrot-gallery', 'grand-valley-lodging', 'movewell', 'mtn-lab-performance-coaching', 'sleigh-rides-at-double-diamond-bar-ranch',
  'super-8-by-wyndham', 'teton-valley-meats', 'the-barntenders', 'the-social-media-secrets-clubtm', 'west-side-yard',
  'yellowstone-teton-tours',
];

const auditReplacements = {
  'corner-drug': 'https://tetonvalleypharmacy.com/',
  'victor-drug': 'https://tetonvalleypharmacy.com/',
  'dominos-pizza': 'https://www.dominos.com/',
  'fuze-av-llc': 'https://fuzehometech.com/',
  'paws-of-teton-valley': 'https://www.pawshelpspets.org/',
  'teton-rock-gym': 'https://tetonrockgym.com/',
  'teton-valley-food-pantry': 'https://www.tvfoodpantry.org/',
  'teton-valley-hospital': 'https://tvhcare.org/',
  'wydaho-rendezvous-teton-bike-festival': 'https://tvtap.org/',
  'dulce-baking-company': 'https://dulcebaking.co/',
  'makerspace': 'https://valleyofthetetonslibrary.org/',
  'valley-of-the-tetons-library': 'https://valleyofthetetonslibrary.org/',
  'ollies-mountain-pet-supply-and-wash': 'https://driggsdogwash.com/',
  'pine-needle-embroidery': 'https://pineneedleembroideryandprint.com/',
  'teton-valley-health-cache-clinic': 'https://tvhcare.org/locations/',
  'farmhouse-208': 'https://farmhouse208.com/',
  'badger-creek-cafe': 'https://www.badgercreekcafe.com/',
  'borbay-studios-and-gallery': 'https://www.borbay.com/',
  'downtown-driggs-association': 'https://www.downtowndriggs.org/',
  'elevate-beauty-salon': 'https://facebook.com/ElevateSalon',
  'friends-of-teton-valley-sports-and-wellness': 'https://sportsandwellness.org/',
  'jared-power-somatic-bodywork': 'https://www.jaredpower.com/',
  'moulton-law-office': 'https://www.tetonvalleylaw.com/',
  'mountain-bike-the-tetons': 'https://www.mountainbiketetons.org/',
  'sabine-soft-furnishings': 'https://sabinesf.com/',
  'teton-homestead': 'https://www.tetonhomestead.com/',
  'teton-regional-land-trust': 'https://www.tetonlandtrust.org/',
  'teton-therapeutic-massage': 'https://facebook.com/TetonTherapeuticMassage',
  'teton-valley-aquatics': 'https://www.tetonvalleyaquatics.org/',
  'the-cottage-at-heron-glass': 'https://www.heronglass.com/cottage.htm',
  'the-fin-and-feather-inn': 'https://finandfeatherinn.com/',
  'wagitude-a-loved-dog-hotel-and-pet-sitting-services': 'https://www.wagitudeloveddoghotel.com/',
  'wilkinson-montesano-builders': 'https://www.wilkinson-montesano.com/',
};

test('audit spam and dead links are gone', async () => {
  const raw = JSON.parse(await readFile(new URL('../data/overrides.json', import.meta.url), 'utf8'));
  for (const id of auditRemovedLinks) {
    assert.equal(raw.listings[id]?.website, null, `${id} override clears website`);
  }
  const listings = await loadListings();
  const byId = new Map(listings.map(l => [l.id, l]));
  for (const id of auditRemovedLinks) {
    const listing = byId.get(id);
    if (listing) assert.equal('website' in listing, false, `${id} still has a website`);
  }
  const dist = fileURLToPath(new URL('../dist', import.meta.url));
  const pattern = /cryotherapyidaho|tetonfloors|threepeaksdinnertable|warbirdscafe/i;
  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(html|json|txt|xml)$/.test(entry.name)) assert.doesNotMatch(await readFile(path, 'utf8'), pattern, path);
    }
  };
  await walk(dist);
});

test('audit replacements are applied', async () => {
  const listings = await loadListings();
  const byId = new Map(listings.map(l => [l.id, l]));
  for (const [id, website] of Object.entries(auditReplacements)) {
    assert.equal(byId.get(id)?.website, website, id);
  }
});

test('pages for listings without a website render no website button', async () => {
  const html = await readFile(new URL('../dist/places/warbirds-cafe/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /listing_website/);
  assert.doesNotMatch(html, /href="null"/);
});

const auditRemoved = {
  'cryo-therapy-idaho': 'wellness',
  'three-peaks-restaurant-and-catering': 'food-drink',
  'jackson-hole-gun-club': 'outdoors',
  'jackson-town-square': 'outdoors',
  servpro: 'services',
  'teton-gravity-research': 'arts-culture',
};

test('removed listings are gone and redirect to their category', async () => {
  const listings = await loadListings();
  const ids = new Set(listings.map(l => l.id));
  const { listingIds } = await import('../src/listing-ids.mjs');
  const redirects = await readFile(new URL('../dist/_redirects', import.meta.url), 'utf8');
  for (const [id, category] of Object.entries(auditRemoved)) {
    assert.equal(ids.has(id), false, `${id} still loaded`);
    assert.equal(listingIds.has(id), false, `${id} still in listing-ids`);
    await assert.rejects(readFile(new URL(`../dist/places/${id}/index.html`, import.meta.url)), `${id} page still built`);
    assert.match(redirects, new RegExp(`^/places/${id}/ /categories/${category}/ 301$`, 'm'));
  }
});

test('tributary merges into the tetonflats record', async () => {
  const listings = await loadListings();
  const byId = new Map(listings.map(l => [l.id, l]));
  assert.equal(byId.has('tributary'), false);
  const merged = byId.get('tributary-formerly-huntsman-springs');
  assert.equal(merged.category, 'outdoors');
  assert.ok(merged.sourceUrls.includes('https://discovertetonvalley.com/live'));
  const images = JSON.parse(await readFile(new URL('../public/data/listing-images.json', import.meta.url), 'utf8'));
  assert.ok(images.images.some(image => image.listingId === 'tributary-formerly-huntsman-springs'));
  const redirects = await readFile(new URL('../dist/_redirects', import.meta.url), 'utf8');
  assert.match(redirects, /^\/places\/tributary\/ \/places\/tributary-formerly-huntsman-springs\/ 301$/m);
});

test('jackson-town-square photo is withdrawn, not orphaned', async () => {
  const images = JSON.parse(await readFile(new URL('../public/data/listing-images.json', import.meta.url), 'utf8'));
  assert.equal(images.images.some(image => image.listingId === 'jackson-town-square'), false);
  const review = JSON.parse(await readFile(new URL('../research/listing-image-review.json', import.meta.url), 'utf8'));
  const entry = review.items.find(item => item.listingId === 'jackson-town-square');
  assert.equal(entry.decision, 'withdrawn');
});
