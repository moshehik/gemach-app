// Phase 0 CPU reductions (2026-10-06) - static pins. Run: node --test scripts/cpu-phase0.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ---- 1. neighbour prefetch --------------------------------------------------
test('ROUTE_NEIGHBORS: /orders no longer auto-warms the heavy /board and /rentals data', () => {
  const src = read('app/lib/prefetchRoutes.js');
  const m = src.match(/const ROUTE_NEIGHBORS = \{([\s\S]*?)\n\};/);
  assert.ok(m, 'ROUTE_NEIGHBORS block found');
  const orders = m[1].match(/'\/orders':\s*\[([^\]]*)\]/);
  assert.ok(orders, "'/orders' entry found");
  assert.ok(!/\/board|\/rentals/.test(orders[1]), 'no /board or /rentals under /orders');
  assert.match(orders[1], /\/customers/);
});

test('hover/focus/touch intent prefetch is untouched', () => {
  const src = read('app/components/PrefetchManager.js');
  for (const ev of ['mouseover', 'focusin', 'touchstart']) assert.ok(src.includes(`'${ev}'`), ev);
  assert.ok(read('app/lib/prefetchRoutes.js').includes("'/board': () =>"), 'board prefetcher still exists for intent');
  assert.ok(read('app/lib/prefetchRoutes.js').includes("'/rentals': () =>"), 'rentals prefetcher still exists for intent');
});

// ---- 3. log-visit -----------------------------------------------------------
const VL = await import(pathToFileURL(path.join(ROOT, 'lib/visitLog.js')).href);

test('isNoisyVisitUrl: boot endpoints are noise (any query / full URL), real calls are not', () => {
  for (const u of ['/api/me', '/api/me?x=1', '/api/settings', '/api/settings/labels', '/api/me/design-prefs', '/api/log-visit', '/api/version',
    'https://a.b/api/me', '/api/me/', '/api/settings#h']) assert.equal(VL.isNoisyVisitUrl(u), true, u);
  for (const u of ['/api/orders', '/api/me/recent-pages', '/api/settings/guide', '/api/settingsX', '/orders', '/print/order#12', '', null, undefined, 5]) {
    assert.equal(VL.isNoisyVisitUrl(u), false, String(u));
  }
});

test('NOISY_VISIT_PATHS is the single list and matches the spec', () => {
  assert.deepEqual([...VL.NOISY_VISIT_PATHS].sort(), ['/api/log-visit', '/api/me', '/api/me/design-prefs', '/api/settings', '/api/settings/labels', '/api/version']);
});

test('employee name cache: one DB read per id within TTL, misses cached briefly, errors not cached', async () => {
  let t = 0; let calls = 0; let fail = false;
  const db = { a: { firstName: 'דנה', lastName: 'לוי' }, b: { firstName: '', lastName: '' } };
  const cache = VL.createEmployeeNameCache({ now: () => t, ttlMs: 1000, missTtlMs: 100, load: async (id) => { calls++; if (fail) throw new Error('down'); return db[id] || null; } });
  assert.equal(await cache.get('a'), 'דנה לוי');
  assert.equal(await cache.get('a'), 'דנה לוי');
  assert.equal(calls, 1);
  assert.equal(await cache.get('b'), 'עובד b'); // empty name falls back like the old route
  assert.equal(await cache.get('zzz'), null);
  assert.equal(await cache.get('zzz'), null);
  assert.equal(calls, 3);
  t = 150; assert.equal(await cache.get('zzz'), null); assert.equal(calls, 4, 'miss expired');
  t = 1500; await cache.get('a'); assert.equal(calls, 5, 'hit expired');
  fail = true; t = 9999;
  await assert.rejects(() => cache.get('a'));
  fail = false; assert.equal(await cache.get('a'), 'דנה לוי');
});

test('log-visit route + layout interceptor use the helpers and the 60s window', () => {
  const route = read('app/api/log-visit/route.js');
  assert.match(route, /isNoisyVisitUrl\(e\.pageUrl\)/);
  assert.match(route, /employeeNames\.get\(candidateId\)/);
  assert.ok(!/prisma\.employee\.findUnique\(\{\s*where: \{ id: candidateId/.test(route), 'no per-request employee lookup');
  const layout = read('app/layout.js');
  assert.match(layout, /flushVisitQueue\(false\); \}, 60000\);/);
  assert.match(layout, /visitQueue\.length >= 25/);
  assert.match(layout, /addEventListener\('pagehide', function\(\) \{ flushVisitQueue\(true\)/);
});
