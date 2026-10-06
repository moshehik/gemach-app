// Browser-cache headers on the reference GETs (CPU phase 1B): Cache-Control private/max-age=60/swr=300 + weak ETag + 304, ?fresh=1 = no-store,
// bodies byte-identical to before. In-memory prisma, no DB, no server.
//   node --no-warnings --import ./scripts/cpu-phase1b-tests/register.mjs --test scripts/cpu-phase1b-tests/http-cache.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const HC = await L('lib/httpCache.js');
const SC = await L('lib/settingsCache.js');
const settingsRoute = await L('app/api/settings/route.js');
const labelsRoute = await L('app/api/settings/labels/route.js');
const pricelistsRoute = await L('app/api/pricelists/route.js');
const categoriesRoute = await L('app/api/pricelists/categories/route.js');
const modelsRoute = await L('app/api/inventory/models/route.js');
const locationsRoute = await L('app/api/customers/locations/route.js');

const CC = 'private, max-age=60, stale-while-revalidate=300';
const NWD = JSON.stringify({ version: 2, days: [{ date: '2031-01-05', note: 'פרט פנימי' }], ranges: [], recurringHebrew: [] });
const SETTINGS = [
  { id: 'a1', key: 'alpha', value: 'a', name: 'alpha', category: 'א', type: 'text', notes: null, legacyId: null, updatedAt: new Date('2026-10-01') },
  { id: 'a2', key: 'non_working_days_extra', value: NWD, name: 'nwd', category: 'יומן', type: 'text', notes: null, legacyId: null, updatedAt: new Date('2026-10-01') },
  { id: 'a3', key: 'ui_labels_mapping', value: '{"item_barcode":"קוד"}', name: 'labels', category: 'ui_label', type: 'json', notes: null, legacyId: null, updatedAt: new Date('2026-10-01') },
];
let PRICELISTS = [{ id: 'p1', category: 'A', fromSize: 34, toSize: 40, price: 100 }, { id: 'p2', category: 'B', fromSize: 42, toSize: 48, price: 120 }];
globalThis.__PRISMA = {
  systemSetting: {
    findMany: async () => SETTINGS.map((s) => ({ ...s })),
    findUnique: async ({ where }) => SETTINGS.find((s) => s.key === where.key) || null,
  },
  priceList: { findMany: async (args) => (args.select ? PRICELISTS.map((p) => ({ category: p.category })) : PRICELISTS.map((p) => ({ ...p }))) },
  dressModel: { findMany: async () => [{ id: 'm1', name: 'דגם 1', barcodePrefix: 101 }, { id: 'm2', name: 'דגם 2', barcodePrefix: 102 }] },
  customer: { findMany: async (args) => (args.select.city ? [{ city: 'ירושלים' }, { city: 'בני ברק' }] : [{ street: 'הרצל' }, { street: 'יפו' }]) },
};
const req = (url, headers = {}) => new Request(`http://test.local${url}`, { headers });
const headersOf = (res) => Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));

test('cachedJson: headers, strong determinism of the weak ETag, 304 on a matching If-None-Match (also W/ prefix, lists, *), 200 otherwise', async () => {
  const body = { a: 1, b: ['x'] };
  const r1 = HC.cachedJson(req('/x'), body);
  const h1 = headersOf(r1);
  assert.equal(h1['cache-control'], CC);
  assert.equal(h1.vary, 'Cookie');
  assert.match(h1.etag, /^W\/"[A-Za-z0-9_-]{27}"$/);
  assert.equal(r1.status, 200);
  assert.deepEqual(await r1.json(), body);
  assert.equal(headersOf(HC.cachedJson(req('/x'), { ...body }))['etag'], h1.etag, 'same content -> same ETag');
  assert.notEqual(headersOf(HC.cachedJson(req('/x'), { a: 2 })).etag, h1.etag);
  for (const inm of [h1.etag, h1.etag.replace(/^W\//, ''), `"zzz", ${h1.etag}`, '*']) {
    const r = HC.cachedJson(req('/x', { 'if-none-match': inm }), body);
    assert.equal(r.status, 304, inm);
    assert.equal(await r.text(), '');
    assert.equal(headersOf(r)['cache-control'], CC);
  }
  assert.equal(HC.cachedJson(req('/x', { 'if-none-match': 'W/"other"' }), body).status, 200);
  assert.equal(HC.cachedJson(undefined, body).status, 200, 'no request (direct call) works');
});

test('cachedJson: no-store has no ETag and never a 304; error statuses are never 304', () => {
  const r = HC.cachedJson(req('/x', { 'if-none-match': '*' }), { a: 1 }, { cacheControl: HC.NO_STORE });
  assert.equal(r.status, 200);
  assert.equal(headersOf(r)['cache-control'], 'no-store');
  assert.equal(headersOf(r).etag, undefined);
  assert.equal(HC.cachedJson(req('/x', { 'if-none-match': '*' }), { error: 'x' }, { status: 500 }).status, 500);
});

test('GET /api/settings: body unchanged, private cache headers; ?fresh=1 -> no-store (settings edit screens)', async () => {
  SC.invalidateSettingsCache();
  globalThis.__AUTH = true;
  const a = await settingsRoute.GET(req('/api/settings'));
  assert.equal(headersOf(a)['cache-control'], CC);
  assert.equal(headersOf(a).vary, 'Cookie');
  const body = await a.json();
  assert.deepEqual(body.map((s) => s.key).sort(), ['alpha', 'non_working_days_extra', 'ui_labels_mapping']);
  const fresh = await settingsRoute.GET(req('/api/settings?fresh=1'));
  assert.equal(headersOf(fresh)['cache-control'], 'no-store');
  assert.equal(headersOf(fresh).etag, undefined);
  assert.deepEqual(await fresh.json(), body);
  const etag = headersOf(a).etag;
  assert.equal((await settingsRoute.GET(req('/api/settings', { 'if-none-match': etag }))).status, 304);
});

test('GET /api/settings: the anonymous answer (notes stripped) and the logged-in answer have DIFFERENT ETags and both vary on Cookie - never shared across users', async () => {
  SC.invalidateSettingsCache();
  globalThis.__AUTH = true;
  const logged = await settingsRoute.GET(req('/api/settings'));
  globalThis.__AUTH = false;
  const anon = await settingsRoute.GET(req('/api/settings'));
  assert.notEqual(headersOf(anon).etag, headersOf(logged).etag);
  assert.match(headersOf(anon)['cache-control'], /^private,/);
  assert.equal(headersOf(anon).vary, 'Cookie');
  const anonNwd = (await anon.json()).find((s) => s.key === 'non_working_days_extra');
  assert.ok(!anonNwd.value.includes('פרט פנימי'), 'internal note still stripped for anonymous');
  // the logged-in ETag must NOT validate the anonymous body
  assert.equal((await settingsRoute.GET(req('/api/settings', { 'if-none-match': headersOf(logged).etag }))).status, 200);
  globalThis.__AUTH = true;
});

test('GET /api/settings/labels: same body, cache headers, 304', async () => {
  SC.invalidateSettingsCache();
  const r = await labelsRoute.GET(req('/api/settings/labels'));
  assert.equal(headersOf(r)['cache-control'], CC);
  assert.deepEqual(await r.json(), { item_barcode: 'קוד' });
  assert.equal((await labelsRoute.GET(req('/api/settings/labels', { 'if-none-match': headersOf(r).etag }))).status, 304);
  const none = await labelsRoute.GET(); // no request object (as the older tests call it)
  assert.equal(none.status, 200);
});

test('pricelists / categories / inventory models / customer locations: bodies unchanged, cache headers, 304', async () => {
  const cases = [
    ['pricelists', () => pricelistsRoute.GET(req('/api/pricelists')), (j) => assert.equal(j.length, 2)],
    ['categories', () => categoriesRoute.GET(req('/api/pricelists/categories')), (j) => assert.deepEqual(j, ['A', 'B'])],
    ['models', () => modelsRoute.GET(req('/api/inventory/models?hasActiveItems=true')), (j) => assert.equal(j.models.length, 2)],
    ['locations', () => locationsRoute.GET(req('/api/customers/locations')), (j) => { assert.deepEqual(j.cities, ['בני ברק', 'ירושלים']); assert.deepEqual(j.streets, ['הרצל', 'יפו']); }],
  ];
  for (const [name, call, check] of cases) {
    const r = await call();
    assert.equal(r.status, 200, name);
    assert.equal(headersOf(r)['cache-control'], CC, name);
    check(await r.json());
  }
  // ETag round trip + a changed list changes the ETag (price edited)
  const before = headersOf(await pricelistsRoute.GET(req('/api/pricelists'))).etag;
  PRICELISTS = PRICELISTS.map((p) => (p.id === 'p1' ? { ...p, price: 111 } : p));
  const after = await pricelistsRoute.GET(req('/api/pricelists', { 'if-none-match': before }));
  assert.equal(after.status, 200, 'an edited price list never answers 304 to the old ETag');
  assert.notEqual(headersOf(after).etag, before);
});

test('unauthorized answers carry no cache headers (a 401 must never be cached)', async () => {
  globalThis.__AUTH = false;
  for (const call of [() => pricelistsRoute.GET(req('/api/pricelists')), () => modelsRoute.GET(req('/api/inventory/models')), () => locationsRoute.GET(req('/api/customers/locations'))]) {
    const r = await call();
    assert.equal(r.status, 401);
    assert.ok(!/max-age/.test(r.headers.get('cache-control') || ''));
  }
  globalThis.__AUTH = true;
});

test('static: apiCache refetches with cache:"no-store" (so a mutation-triggered refetch never meets a stale browser entry); edit screens bypass the browser cache', () => {
  const read = (p) => fs.readFileSync(process.env.PROJ + '/' + p, 'utf8');
  assert.match(read('lib/apiCache.js'), /const promise = fetch\(url, \{ cache: 'no-store' \}\)/);
  assert.match(read('app/dashboard/pricelist/page.js'), /fetch\('\/api\/pricelists', \{ cache: 'reload' \}\)/);
  assert.match(read('app/dashboard/pricelist/page.js'), /fetch\('\/api\/pricelists\/categories', \{ cache: 'reload' \}\)/);
  // every settings-editing screen reads ?fresh=1 (server answers no-store)
  for (const f of ['app/admin/settings/SettingsClient.js', 'app/components/settings-sim/SettingsSimPage.js', 'app/admin/bulk-email/page.js', 'app/admin/refund-planner/shared.js']) assert.match(read(f), /\/api\/settings\?fresh=1/, f);
});
