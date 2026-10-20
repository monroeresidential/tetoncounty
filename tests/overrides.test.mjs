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
