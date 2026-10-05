// GET /api/board/orders (CPU phase 1B): the slim endpoint must give the new monthly board exactly the same late-return marks as the full
// GET /api/orders?limit=2000 did, with a payload that is a small fraction. In-memory prisma with a tiny where-evaluator for the operators
// the query uses (AND / OR / some / equality / gte / lte / not null) - no DB, no server.
//   node --no-warnings --import ./scripts/cpu-phase1b-tests/register.mjs --test scripts/cpu-phase1b-tests/board-orders.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/board/orders/route.js');
const BO = await L('lib/boardOrders.js');
const BL = await L('app/components/board/boardLogic.js');
const { buildBoardMonthParams } = await L('app/lib/prefetchRoutes.js');

// ---- where evaluator ----
function ev(row, where) {
  if (where === undefined || where === null) return true;
  for (const [k, v] of Object.entries(where)) {
    if (k === 'AND') { if (!v.every((w) => ev(row, w))) return false; continue; }
    if (k === 'OR') { if (!v.some((w) => ev(row, w))) return false; continue; }
    if (k === 'items' && v && v.some) { if (!(row.items || []).some((it) => ev(it, v.some))) return false; continue; }
    const val = row[k];
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('gte' in v && !(val != null && val >= v.gte)) return false;
      if ('lte' in v && !(val != null && val <= v.lte)) return false;
      if ('not' in v && !(v.not === null ? val !== null && val !== undefined : val !== v.not)) return false;
    } else if (val !== v) return false;
  }
  return true;
}

// ---- fixture: random-ish orders around a month window ----
const FROM = new Date('2026-09-10T00:00:00Z'), TO = new Date('2026-11-10T00:00:00Z');
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const day = (n) => new Date(Date.UTC(2026, 8, 1) + n * 86400e3);
function makeOrders(n = 600) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ev = rnd() < 0.03 ? null : day(Math.floor(rnd() * 80));
    const nItems = 1 + Math.floor(rnd() * 4);
    const items = [];
    for (let k = 0; k < nItems; k++) {
      const taken = rnd() < 0.6;
      const returned = taken && rnd() < 0.5;
      items.push({
        isDeleted: rnd() < 0.1, isTaken: taken && rnd() < 0.85, takenDate: taken && rnd() < 0.7 ? day(Math.floor(rnd() * 80)) : null,
        isReturned: returned && rnd() < 0.85, returnDate: returned && rnd() < 0.7 ? day(Math.floor(rnd() * 80)) : null,
        // heavy fields the old /api/orders shipped
        id: `it-${i}-${k}`, description: 'שמלה ארוכה '.repeat(8), barcode: '1234567', sizeText: '40', price: 120, notes: 'x'.repeat(60),
      });
    }
    out.push({
      orderId: 10000 + i, id: `ord-${i}`, isDeleted: rnd() < 0.05, eventDate: ev, toDate: rnd() < 0.1 ? day(Math.floor(rnd() * 90)) : null, returnDate: rnd() < 0.05 ? day(Math.floor(rnd() * 90)) : null,
      customer: { firstName: 'לקוחה', lastName: `מספר ${i}`, phone1: '0501234567', city: 'ירושלים' }, payments: [{ amount: 100, date: day(1) }], totalAmount: 500, items,
    });
  }
  return out;
}
const ORDERS = makeOrders();
let SETTINGS = {};
globalThis.__CALLS = [];
globalThis.__PRISMA = {
  systemSetting: { findMany: async () => Object.entries(SETTINGS).map(([key, value]) => ({ key, value })), findUnique: async ({ where }) => (where.key in SETTINGS ? { key: where.key, value: SETTINGS[where.key] } : null) },
  order: {
    findMany: async (args) => {
      globalThis.__CALLS.push(args);
      let rows = ORDERS.filter((o) => ev(o, args.where));
      rows.sort((a, b) => (a.eventDate?.getTime() ?? 0) - (b.eventDate?.getTime() ?? 0));
      if (args.take) rows = rows.slice(0, args.take);
      // honour `select` (incl. the nested items.where + select) like Prisma does
      return rows.map((o) => {
        const out = {};
        for (const [k, v] of Object.entries(args.select)) {
          if (k === 'items') out.items = (o.items || []).filter((it) => ev(it, v.where)).map((it) => Object.fromEntries(Object.keys(v.select).map((f) => [f, it[f]])));
          else if (v) out[k] = o[k];
        }
        return out;
      });
    },
  },
};

const qs = `eventDateFrom=${encodeURIComponent(FROM.toISOString())}&eventDateTo=${encodeURIComponent(TO.toISOString())}`;
const get = async (extra = '') => {
  const res = await route.GET(new Request(`http://test.local/api/board/orders?${qs}${extra}`));
  const text = await res.text();
  return { status: res.status, text, json: JSON.parse(text) };
};
const kb = (t) => Buffer.byteLength(t) / 1024;
// what the OLD route returned for the board query (filterStatus=all + eventDateFrom/To): not deleted, in range, optional hide-taken filter. Full rows.
const oldRoute = (hideTaken) => ORDERS.filter((o) => !o.isDeleted && o.eventDate && o.eventDate >= FROM && o.eventDate <= TO && (!hideTaken || o.items.some((i) => !i.isDeleted && !i.isTaken)));
const NOW = new Date('2026-10-20T10:00:00Z');
const CFGS = [{ threshold: 7, nonWorkingDays: null, now: NOW }, { threshold: 2, nonWorkingDays: null, now: NOW }, { threshold: 14, nonWorkingDays: null, now: new Date('2026-11-05T10:00:00Z') }];

test('late-return marks per day are identical to the full /api/orders data (3 thresholds, hide_taken off and on)', async () => {
  for (const hide of [false, true]) {
    SETTINGS = hide ? { hide_taken_orders_from_orders_list: 'true' } : {};
    // settings cache is 30s: drop it between the two variants
    const SC = await L('lib/settingsCache.js');
    if (SC.invalidateSettingsCache) SC.invalidateSettingsCache();
    const slim = (await get()).json.data;
    const full = oldRoute(hide);
    for (const cfg of CFGS) {
      const a = BL.groupOrdersByDate(full), b = BL.groupOrdersByDate(slim);
      const lateByDay = (g) => Object.fromEntries(Object.entries(g).map(([k, list]) => [k, list.filter((o) => BL.isOrderLate(o, cfg)).length]).filter(([, n]) => n > 0));
      assert.deepEqual(lateByDay(b), lateByDay(a), `hide=${hide} threshold=${cfg.threshold}`);
      assert.equal(slim.filter((o) => BL.isOrderLate(o, cfg)).length, full.filter((o) => BL.isOrderLate(o, cfg)).length);
    }
    assert.ok(full.filter((o) => BL.isOrderLate(o, CFGS[1])).length > 5, 'the fixture really contains late orders');
  }
});

test('payload: only orders that can be late, only the 5 fields + 5 item fields; a fraction of the full list', async () => {
  SETTINGS = {};
  const SC = await L('lib/settingsCache.js'); if (SC.invalidateSettingsCache) SC.invalidateSettingsCache();
  const slim = await get();
  const full = JSON.stringify({ data: oldRoute(false), total: oldRoute(false).length });
  console.log(`      full=${kb(full).toFixed(0)} KB  slim=${kb(slim.text).toFixed(0)} KB  (${slim.json.data.length} of ${oldRoute(false).length} orders)`);
  assert.ok(slim.json.data.length < oldRoute(false).length);
  assert.deepEqual(Object.keys(slim.json.data[0]).sort(), ['eventDate', 'items', 'orderId', 'returnDate', 'toDate']);
  assert.deepEqual(Object.keys(slim.json.data[0].items[0]).sort(), ['isDeleted', 'isReturned', 'isTaken', 'returnDate', 'takenDate']);
  assert.ok(kb(slim.text) < kb(full) / 5);
  assert.equal(slim.json.total, slim.json.data.length);
});

test('query shape: not deleted, event date range, a late-candidate item, take = limit, no customer/payments in select', async () => {
  globalThis.__CALLS = [];
  const SC = await L('lib/settingsCache.js'); if (SC.invalidateSettingsCache) SC.invalidateSettingsCache();
  await get('&limit=300');
  const a = globalThis.__CALLS[0];
  assert.equal(a.take, 300);
  assert.ok(!('customer' in a.select) && !('payments' in a.select));
  const flat = JSON.stringify(a.where);
  assert.match(flat, /"isDeleted":false/);
  assert.match(flat, /"isReturned":false/);
  assert.deepEqual(a.where.AND[2].items.some, BO.LATE_CANDIDATE_ITEM);
});

test('limit: default 2000, capped at 5000; garbage -> default', () => {
  assert.equal(BO.parseBoardLimit(undefined), 2000);
  assert.equal(BO.parseBoardLimit('abc'), 2000);
  assert.equal(BO.parseBoardLimit('99999'), 5000);
  assert.equal(BO.parseBoardLimit('10'), 10);
});

test('bad / missing / absurd ranges are 400', async () => {
  for (const q of ['', 'eventDateFrom=x&eventDateTo=y', `eventDateFrom=${TO.toISOString()}&eventDateTo=${FROM.toISOString()}`, 'eventDateFrom=2020-01-01T00:00:00Z&eventDateTo=2026-01-01T00:00:00Z']) {
    const res = await route.GET(new Request(`http://test.local/api/board/orders?${q}`));
    assert.equal(res.status, 400, q);
  }
});

test('auth: anonymous -> 401; logged in without page:board -> 403', async () => {
  globalThis.__AUTH = false;
  assert.equal((await route.GET(new Request(`http://test.local/api/board/orders?${qs}`))).status, 401);
  globalThis.__AUTH = true;
  globalThis.__PAGE_OK = (k) => k !== 'page:board';
  assert.equal((await route.GET(new Request(`http://test.local/api/board/orders?${qs}`))).status, 403);
  globalThis.__PAGE_OK = undefined;
});

test('static: the new board page uses the slim endpoint and its own cache namespace; the legacy board + old /api/orders are untouched', () => {
  const read = (p) => fs.readFileSync(process.env.PROJ + '/' + p, 'utf8');
  const page = read('app/components/board/BoardPage.js');
  assert.match(page, /cacheNamespace\('board-slim'\)/);
  assert.match(page, /fetch\(`\/api\/board\/orders\?\$\{queryParams\.toString\(\)\}`/);
  assert.ok(!/fetch\(`\/api\/orders/.test(page));
  const legacy = read('app/board/LegacyBoardPage.js');
  assert.match(legacy, /cacheNamespace\('board'\)/);
  assert.match(legacy, /fetch\(`\/api\/orders\?\$\{queryParams\.toString\(\)\}`/);
  // the same param builder feeds both (legacy key + slim request), so the month window is identical
  const p = buildBoardMonthParams(new Date('2026-10-04T00:00:00Z'));
  assert.ok(p.get('eventDateFrom') && p.get('eventDateTo'));
});
