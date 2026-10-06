// cpu-phase0 (2026-10-06): getAllCachedSettings no longer pulls the 2.5MB BRAND_LOGO value; hasBrandLogo() answers "is there a logo" without it;
// getCachedSetting('BRAND_LOGO') (used by /api/logo) still returns the full row. In-memory prisma shim, no DB.
//   node --import ./scripts/cpu-reduction-tests/register.mjs --test scripts/cpu-reduction-tests/brand-logo-cache.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const SC = await L('lib/settingsCache.js');
const LOGO = 'data:image/png;base64,AAAA';
const row = (i, key, value) => ({ id: `id-${i}`, key, value, name: key, category: 'x', notes: null, type: 'text' });
const seed = (withLogo = true) => {
  globalThis.__SETTINGS = [row(1, 'gmach_name', 'G'), row(2, 'k2', 'v2'), ...(withLogo ? [row(3, 'BRAND_LOGO', LOGO)] : [])];
  globalThis.__MOCK_CALLS.length = 0;
  SC.invalidateSettingsCache();
};

test('getAllCachedSettings (cache path) excludes BRAND_LOGO in the query itself', async () => {
  seed();
  const all = await SC.getAllCachedSettings();
  assert.deepEqual(all.map((r) => r.key).sort(), ['gmach_name', 'k2']);
  const q = globalThis.__MOCK_CALLS.find((c) => c.op === 'findMany');
  assert.deepEqual(q.args.where.key.notIn, SC.LARGE_VALUE_SETTING_KEYS);
});

test('an explicit client (transaction) still gets every row', async () => {
  seed();
  const tx = { systemSetting: { findMany: async () => globalThis.__SETTINGS.map((r) => ({ ...r })) } };
  const all = await SC.getAllCachedSettings(tx);
  assert.ok(all.some((r) => r.key === 'BRAND_LOGO'));
});

test('getCachedSetting(BRAND_LOGO) returns the full row even when allCache is warm', async () => {
  seed();
  await SC.getAllCachedSettings(); // warm allCache without the logo
  const r = await SC.getCachedSetting('BRAND_LOGO');
  assert.equal(r && r.value, LOGO);
  assert.equal((await SC.getCachedSetting('gmach_name')).value, 'G'); // other keys still served from allCache
});

test('hasBrandLogo: true/false, cached, invalidated, and never selects the value', async () => {
  seed(true);
  assert.equal(await SC.hasBrandLogo(), true);
  const q = globalThis.__MOCK_CALLS.find((c) => c.op === 'findFirst');
  assert.deepEqual(q.args.select, { id: true });
  await SC.hasBrandLogo();
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.op === 'findFirst').length, 1, 'second call served from cache');
  globalThis.__SETTINGS = globalThis.__SETTINGS.filter((r) => r.key !== 'BRAND_LOGO');
  SC.invalidateSettingsCache('BRAND_LOGO');
  assert.equal(await SC.hasBrandLogo(), false);
  seed(true);
  globalThis.__SETTINGS.find((r) => r.key === 'BRAND_LOGO').value = '';
  assert.equal(await SC.hasBrandLogo(), false, 'empty value = no logo');
});

test('layout.js injects the presence marker and the export route reads everything directly', () => {
  const layout = fs.readFileSync(process.env.PROJ + '/app/layout.js', 'utf8');
  assert.match(layout, /hasBrandLogo\(\)/);
  assert.match(layout, /\{ key: 'BRAND_LOGO', value: '1' \}/);
  const exp = fs.readFileSync(process.env.PROJ + '/app/api/admin/database/export/route.js', 'utf8');
  assert.match(exp, /prisma\.systemSetting\.findMany\(\)/);
});
