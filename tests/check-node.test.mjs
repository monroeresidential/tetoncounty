import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkNodeVersion, minimumByMajor } from '../scripts/check-node.mjs';

test('patched releases on the supported lines pass', () => {
  for (const version of ['v22.23.4', 'v22.30.0', 'v24.22.1', 'v24.23.0', 'v26.12.1', 'v26.13.0', '24.22.1']) {
    assert.equal(checkNodeVersion(version).ok, true, version);
  }
});

test('unpatched releases and unsupported lines fail', () => {
  for (const version of ['v22.23.3', 'v22.12.0', 'v24.22.0', 'v24.21.0', 'v24.18.0', 'v26.12.0', 'v26.10.0']) {
    const result = checkNodeVersion(version);
    assert.equal(result.ok, false, version);
    assert.match(result.message, /predates the October 21, 2026 security release/);
  }
  for (const version of ['v18.20.8', 'v20.19.5', 'v21.7.3', 'v23.11.1', 'v25.1.0', 'v27.0.0']) {
    const result = checkNodeVersion(version);
    assert.equal(result.ok, false, version);
    assert.match(result.message, /not a supported release line/);
  }
  assert.equal(checkNodeVersion('lts').ok, false);
  assert.equal(checkNodeVersion('').ok, false);
});

test('the running Node passes the same guard the build uses', () => {
  assert.equal(checkNodeVersion(process.version).ok, true, process.version);
});

test('the pinned build version matches the guard, engines, and CI', async () => {
  const pinned = (await readFile('.nvmrc', 'utf8')).trim();
  assert.equal(pinned, minimumByMajor[24]);
  assert.equal((await readFile('.node-version', 'utf8')).trim(), pinned);
  assert.match(pinned, /^\d+\.\d+\.\d+$/, 'pin an exact patch version, never a bare major or "lts"');
  const { engines } = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(engines.node, '>=24.22.1 <25 || >=26.12.1 <27');
  const workflow = await readFile('.github/workflows/check.yml', 'utf8');
  assert.match(workflow, /node-version-file: '?\.nvmrc'?/);
});
