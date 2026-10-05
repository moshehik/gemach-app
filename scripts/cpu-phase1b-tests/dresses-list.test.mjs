// GET /api/dresses (CPU phase 1B): no `fields` -> the OLD full shape (old/cached clients, any other caller);
// fields=summary -> counts instead of items (catalog list); fields=kiosk -> grouped items with count (customer-interface).
// In-memory prisma shim, no DB, no server.
//   node --import ./scripts/cpu-phase1b-tests/register.mjs --test scripts/cpu-phase1b-tests/dresses-list.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/dresses/route.js');

// ---- fixture: ~121 models x ~108 items (the real MAIN catalog: 13,151 DressItem rows over 121 models) ----
const SIZES = ['34', '36', '38', '40', '42', '44', '46', '48', 'M', 'L'];
const LOCS = [null, null, null, null, 'חנות', 'מחסן', 'רזרבה'];
function makeModels(nModels = 121, perModel = 108) {
  const models = [];
  let serial = 1;
  for (let m = 0; m < nModels; m++) {
    const items = [];
    for (let k = 0; k < perModel; k++) {
      items.push({
        id: `item-${m}-${k}-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`,
        sizeText: k % 17 === 0 ? null : SIZES[k % SIZES.length],
        quantity: 1,
        location: LOCS[k % LOCS.length],
        inRepair: k % 23 === 0,
        notInUse: k % 29 === 0,
        isDeleted: k % 31 === 0,
        serialNumber: serial++,
        dressBarcode: 1000000 + m * 1000 + k,
        _count: { orderItems: k % 9 },
      });
    }
    models.push({
      id: `model-${m}-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`, name: `דגם ${m}`, barcodePrefix: 100 + m, priceCategory: m % 3 ? 'A' : 'B',
      notes: null, inInspection: false, imageUrl: `/api/attachment/img-${m}`, thumbnailUrl: `/api/attachment/th-${m}`,
      entryDateToRepo: new Date('2024-01-01T00:00:00Z'), exitDateFromRepo: null, inactiveReason: null, isDeleted: false, items,
    });
  }
  return models;
}
const MODELS = makeModels();
globalThis.__CALLS = [];
globalThis.__PRISMA = {
  systemSetting: { findMany: async () => [{ key: 'inventory_include_warehouse', value: 'false' }, { key: 'allow_renting_reserve_items', value: 'false' }], findUnique: async () => null },
  dressModel: {
    findMany: async (args) => {
      globalThis.__CALLS.push({ op: 'findMany', args });
      const wantCount = !!args.select.items.select._count;
      const rows = MODELS.slice(args.skip || 0, (args.skip || 0) + args.take);
      return rows.map((m) => ({ ...m, items: m.items.map((i) => { const { _count, ...rest } = i; return wantCount ? { ...rest, _count } : rest; }) }));
    },
    count: async () => MODELS.length,
  },
};

const get = async (qs = '') => {
  const res = await route.GET(new Request(`http://test.local/api/dresses${qs}`));
  const text = await res.text();
  return { status: res.status, text, json: JSON.parse(text) };
};
const OLD_ITEM_KEYS = ['id', 'sizeText', 'serialNumber', 'barcode', 'quantity', 'location', 'inRepair', 'notInUse', 'isDeleted', 'isUnusable', 'rentalsCount'];
const kb = (t) => Buffer.byteLength(t) / 1024;

test('no fields param: the old full shape (every item with its 11 keys, rentalsCount from the orderItems count)', async () => {
  globalThis.__CALLS = [];
  const { status, json } = await get('?limit=3&filterStatus=active');
  assert.equal(status, 200);
  assert.equal(json.data.length, 3);
  assert.deepEqual(Object.keys(json.data[0]), ['id', 'name', 'barcodePrefix', 'priceCategory', 'notes', 'inInspection', 'imageUrl', 'thumbnailUrl', 'entryDateToRepo', 'exitDateFromRepo', 'inactiveReason', 'isDeleted', 'sizes', 'inStock', 'items']);
  assert.equal(json.data[0].items.length, 108);
  assert.deepEqual(Object.keys(json.data[0].items[0]), OLD_ITEM_KEYS);
  assert.equal(json.data[0].items[5].rentalsCount, 5 % 9);
  assert.equal(json.data[0].items[0].isUnusable, true, 'k=0 is inRepair/notInUse/isDeleted');
  assert.ok(globalThis.__CALLS[0].args.select.items.select._count, 'full mode still asks for the per-item orderItems count');
  assert.equal(json.total, 121);
  assert.equal(json.limit, 3);
});

test('unknown fields value behaves like no fields (old shape)', async () => {
  const a = await get('?limit=2&fields=bogus');
  const b = await get('?limit=2');
  assert.equal(a.text, b.text);
});

test('fields=summary: no items array, counts that equal what the old UI computed from items', async () => {
  const full = (await get('?limit=50&filterStatus=active')).json.data;
  globalThis.__CALLS = [];
  const sum = (await get('?limit=50&filterStatus=active&fields=summary')).json.data;
  assert.equal(sum.length, full.length);
  assert.ok(!globalThis.__CALLS[0].args.select.items.select._count, 'summary skips the per-item orderItems count subquery');
  for (let i = 0; i < full.length; i++) {
    const f = full[i], s = sum[i];
    assert.equal('items' in s, false);
    assert.equal(s.id, f.id);
    assert.equal(s.imageUrl, f.imageUrl);
    assert.deepEqual(s.sizes, f.sizes);
    assert.equal(s.inStock, f.inStock);
    // the three things dashboard/dresses/page.js derived from items:
    assert.equal(s.itemsCount, f.items.filter((x) => !x.isDeleted).length, 'column "כמות פריטים"');
    assert.equal(s.inUseItemsCount > 0, f.items.some((x) => !x.notInUse), 'old isInactive test');
    assert.equal(s.activeItemsCount > 0, f.items.some((x) => !x.notInUse && !x.isDeleted), 'old hasActiveItems test');
  }
});

test('fields=summary payload size: 120-model fixture stays small (the full shape is ~1.4 MB)', async () => {
  const full = await get('?limit=500&filterStatus=active');
  const sum = await get('?limit=500&filterStatus=active&fields=summary');
  console.log(`      full=${kb(full.text).toFixed(0)} KB  summary=${kb(sum.text).toFixed(0)} KB  (${full.json.data.length} models)`);
  assert.ok(kb(full.text) > 1000, 'fixture is as heavy as the real MAIN catalog');
  assert.ok(kb(sum.text) < 60, 'summary < 60 KB');
  assert.ok(kb(sum.text) < kb(full.text) / 20);
});

test('fields=summary caps limit at 500; the old shape keeps its 10000 cap (kiosk loads everything)', async () => {
  const s = (await get('?limit=9999&fields=summary')).json;
  assert.equal(s.limit, 500);
  const f = (await get('?limit=9999')).json;
  assert.equal(f.limit, 9999);
});

test('fields=summary with advRentalsCountMin still gets rentalsCount (needed for the filter) but does not return it', async () => {
  globalThis.__CALLS = [];
  const { json } = await get('?limit=5&fields=summary&advRentalsCountMin=1');
  assert.ok(globalThis.__CALLS[0].args.select.items.select._count);
  assert.equal(json.data.length, 5);
  assert.ok(!('items' in json.data[0]));
});

test('fields=kiosk: grouped items, same totals/availability as the old per-item rows (the counters the kiosk computes)', async () => {
  const full = (await get('?limit=500&filterStatus=active')).json.data;
  globalThis.__CALLS = [];
  const kiosk = (await get('?limit=500&filterStatus=active&fields=kiosk')).json.data;
  assert.ok(!globalThis.__CALLS[0].args.select.items.select._count);
  assert.equal(kiosk.length, full.length);
  // the kiosk's own algorithm (customer-interface/page.js getModelSizeInfo), run on both shapes
  const info = (model) => {
    const sizeMap = new Map();
    model.items?.forEach((item) => {
      if (item.notInUse || item.isDeleted || item.isUnusable) return;
      const st = item.sizeText || 'כללי';
      if (!sizeMap.has(st)) sizeMap.set(st, { available: 0, total: 0 });
      const n = item.count || 1;
      const i = sizeMap.get(st);
      i.total += n;
      if (item.quantity > 0) i.available += n;
    });
    return [...sizeMap.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
  };
  const anySizeText = (model, term) => model.items.some((item) => (item.sizeText || 'כללי').toLowerCase().includes(term));
  for (let i = 0; i < full.length; i++) {
    assert.deepEqual(info(kiosk[i]), info(full[i]), `model ${i}`);
    assert.equal(kiosk[i].items.length > 0, full[i].items.length > 0, 'the kiosk keeps only models that have any item');
    for (const term of ['40', 'כללי', 'm']) assert.equal(anySizeText(kiosk[i], term), anySizeText(full[i], term), `search "${term}"`);
    assert.equal(kiosk[i].inStock, full[i].inStock);
    assert.deepEqual(kiosk[i].sizes, full[i].sizes);
  }
  assert.deepEqual(Object.keys(kiosk[0].items[0]).sort(), ['count', 'isUnusable', 'quantity', 'sizeText']);
});

test('fields=kiosk payload size: 120-model fixture, a small fraction of the full shape', async () => {
  const full = await get('?limit=10000&filterStatus=active');
  const kiosk = await get('?limit=10000&filterStatus=active&fields=kiosk');
  console.log(`      full=${kb(full.text).toFixed(0)} KB  kiosk=${kb(kiosk.text).toFixed(0)} KB`);
  assert.ok(kb(kiosk.text) < 250, 'kiosk < 250 KB (synthetic fixture has ~22 distinct size/flag groups per model; real data has fewer)');
  assert.ok(kb(kiosk.text) < kb(full.text) / 10);
});

test('fields=kiosk: warehouse/reserve items stay unusable under the default settings (same isUnusable rule as the old rows)', async () => {
  const kiosk = (await get('?limit=1&fields=kiosk')).json.data[0];
  const usable = kiosk.items.filter((x) => !x.isUnusable).reduce((s, x) => s + x.count, 0);
  const full = (await get('?limit=1')).json.data[0];
  assert.equal(usable, full.items.filter((x) => !x.isUnusable).length);
});

test('static: the catalog page and the kiosk request the slim variants; prefetch key carries the same fields param', () => {
  const read = (p) => fs.readFileSync(process.env.PROJ + '/' + p, 'utf8');
  assert.match(read('app/customer-interface/page.js'), /api\/dresses\$\{dateQuery\}&filterStatus=active&fields=kiosk/);
  assert.match(read('app/lib/prefetchRoutes.js'), /advItemDeleted: advancedFilters\.itemDeleted,[\s\S]{0,300}fields: 'summary'/);
  const page = read('app/dashboard/dresses/page.js');
  assert.match(page, /buildDressesListParams\(/);
  assert.match(page, /dress\.itemsCount !== undefined \? dress\.itemsCount : /, 'falls back to old items for stale cached responses');
});

test('static: every file that fetches the /api/dresses LIST is accounted for (a new consumer must be added here on purpose)', () => {
  const out = execFileSync('git', ['grep', '-l', '-E', '/api/dresses(\\?|\\$\\{|`|\')', '--', 'app', 'components', 'lib', 'public'], { cwd: process.env.PROJ, encoding: 'utf8' });
  const files = out.split('\n').filter(Boolean).filter((f) => /.(js|jsx|mjs|html)$/.test(f) && !f.startsWith('app/api/')).sort();
  // list consumers: dashboard/dresses (summary), customer-interface (kiosk), prefetchRoutes (summary key); the rest only mention the URL
  // in comments or call item/id/rentals/next-code routes
  const known = ['app/customer-interface/page.js', 'app/dashboard/dresses/[id]/page.js', 'app/dashboard/dresses/[id]/print/page.js', 'app/dashboard/dresses/page.js', 'app/lib/prefetchRoutes.js', 'components/ClipboardDebugger.js', 'components/dresses/modern/ModernDressRentalsTab.js', 'components/dresses/modern/ModernNewDressWizard.js', 'components/dresses/modern/ModernDressItemsTab.js', 'components/dresses/modern/ModernDressItemModal.js', 'lib/apiCache.js', 'lib/inventory.js'];
  for (const f of files) assert.ok(known.includes(f), `unexpected /api/dresses consumer: ${f} - decide whether it needs fields=summary/kiosk`);
});
