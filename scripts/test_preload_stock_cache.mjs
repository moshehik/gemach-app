// node scripts/test_preload_stock_cache.mjs   (בלי DB: prisma מדומה)
// בודק את lib/preloadStockCache.js: תוצאה זהה ללוגיקה הישנה של ה-route, TTL, עקיפה ב-_t (fresh), הפרדה לפי תגית מסד / מונחי מחסן, שגיאות לא נמטמנות, איחוד בקשות במקביל.
import assert from 'node:assert/strict';
import { getStockSnapshot, loadStockSnapshot, clearStockSnapshotCache, stockCacheKey, STOCK_TTL_MS } from '../lib/preloadStockCache.js';

let passed = 0;
const t = async (name, fn) => { clearStockSnapshotCache(); await fn(); passed++; console.log('ok -', name); };

function fakePrisma(items, models) {
  const calls = { dressItem: 0, dressModel: 0 };
  return {
    calls,
    dressItem: { findMany: async () => { calls.dressItem++; return items; } },
    dressModel: { findMany: async () => { calls.dressModel++; return models; } },
  };
}

const items = [
  { id: 'i1', dressModelId: 'm1', sizeText: '38', quantity: 1 },
  { id: 'i2', dressModelId: 'm1', sizeText: '38', quantity: 2 },
  { id: 'i3', dressModelId: 'm1', sizeText: null, quantity: null },
  { id: 'i4', dressModelId: null, sizeText: '40', quantity: 1 },
  { id: 'i5', dressModelId: 'm2', sizeText: '40', quantity: 1 },
];
const models = [{ id: 'm1', barcodePrefix: '101' }, { id: 'm2', barcodePrefix: null }, { id: 'm3', barcodePrefix: '303' }];

await t('grouping identical to the old route logic', async () => {
  const p = fakePrisma(items, models);
  const { stock, prefixToModelId } = await loadStockSnapshot(p, ['מחסן']);
  assert.deepEqual(stock, { m1: { '38': { total: 3, itemId: 'i1' }, 'כללי': { total: 1, itemId: 'i3' } }, m2: { '40': { total: 1, itemId: 'i5' } } });
  assert.deepEqual(prefixToModelId, { '101': 'm1', '303': 'm3' });
});

await t('second call within TTL hits the cache (no DB)', async () => {
  const p = fakePrisma(items, models); let now = 1000;
  const o = { tag: 'x', now: () => now };
  const a = await getStockSnapshot(p, ['מחסן'], o); now += STOCK_TTL_MS - 1;
  const b = await getStockSnapshot(p, ['מחסן'], o);
  assert.equal(p.calls.dressItem, 1); assert.equal(p.calls.dressModel, 1); assert.strictEqual(a, b);
});

await t('reloads after TTL', async () => {
  const p = fakePrisma(items, models); let now = 1000; const o = { now: () => now };
  await getStockSnapshot(p, [], o); now += STOCK_TTL_MS + 1; await getStockSnapshot(p, [], o);
  assert.equal(p.calls.dressItem, 2);
});

await t('fresh=true bypasses the cache and refreshes it', async () => {
  const p = fakePrisma(items, models); let now = 1000; const o = { now: () => now };
  await getStockSnapshot(p, [], o);
  await getStockSnapshot(p, [], { ...o, fresh: true });
  assert.equal(p.calls.dressItem, 2);
  await getStockSnapshot(p, [], o); // אחרי fresh - המטמון חם שוב
  assert.equal(p.calls.dressItem, 2);
});

await t('different db-mode tag or warehouse/reserve terms never share an entry', async () => {
  const p = fakePrisma(items, models);
  await getStockSnapshot(p, ['מחסן'], { tag: 'a' });
  await getStockSnapshot(p, ['מחסן'], { tag: 'b' });
  await getStockSnapshot(p, ['מחסן', 'warehouse'], { tag: 'a' });
  assert.equal(p.calls.dressItem, 3);
  assert.equal(stockCacheKey(['b', 'a'], 't'), stockCacheKey(['a', 'b'], 't')); // סדר המונחים לא משנה
});

await t('errors are not cached (a failed load never poisons later requests)', async () => {
  let fail = true; let now = 1000; let loads = 0;
  const loader = async () => { loads++; if (fail) throw new Error('db down'); return { stock: { ok: 1 }, prefixToModelId: {} }; };
  const o = { loader, now: () => now };
  await assert.rejects(getStockSnapshot({}, [], o), /db down/);
  fail = false; const good = await getStockSnapshot({}, [], o); assert.equal(good.stock.ok, 1); assert.equal(loads, 2);
  now += STOCK_TTL_MS + 1; fail = true;
  await assert.rejects(getStockSnapshot({}, [], o), /db down/);
  fail = false; await getStockSnapshot({}, [], o); assert.equal(loads, 4); // אחרי כשל לא נתקעים על ערך פגום
});

await t('concurrent requests share one load', async () => {
  const p = fakePrisma(items, models);
  await Promise.all(Array.from({ length: 6 }, () => getStockSnapshot(p, [], { tag: 'c' })));
  assert.equal(p.calls.dressItem, 1);
});

console.log(`\n${passed} passed`);
