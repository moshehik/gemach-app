// PP-02 "סיכום יתרות לגבייה": הלוגיקה (build/toRows) מול נתוני הדמה, ה-API (הרשאת דף הזמנות, extras, ייצוא) ובלי ברקוד.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb } from '../schedule-tests/fixtures.mjs';
import { allOrders, payloadFor } from './pp02-13-19.fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/schedule/print/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const PP02 = await L('lib/schedule/print/pages/PP-02.js');
const R = await L('lib/schedule/print/registry.js');

const get = (qs = '') => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
beforeEach(() => {
  installDb({ extra: { order: allOrders() } });
  invalidateSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
});

test('registry: ready, info-only page without any barcode (owner removed it), money permission, orderInfo extra', () => {
  const p = R.getPrintPage('PP-02');
  assert.equal(p.status, 'ready');
  assert.equal(p.barcode, null, 'PP-02 decision: no barcode');
  assert.equal(p.info, true);
  assert.deepEqual(p.stages, ['order']);
  assert.deepEqual(p.extras, ['orderInfo']);
});

test('only orders with balance > 0, nearest event first, deleted payments ignored, no-amount orders excluded', async () => {
  const { payload } = await payloadFor(['PP-02']);
  const pg = payload.pages[0];
  assert.equal(pg.pageCode, null, 'no ALL-… header code');
  const d = pg.data;
  assert.deepEqual(d.rows.map((r) => r.orderId), [7002, 1001, 7003, 7004], 'sorted by event date; undated last');
  assert.equal(d.rows.find((r) => r.orderId === 7001), undefined, 'fully paid -> not listed');
  assert.equal(d.rows.find((r) => r.orderId === 1002), undefined, 'no amount on the order -> no known balance');
  const r1001 = d.rows.find((r) => r.orderId === 1001);
  assert.deepEqual([r1001.total, r1001.paid, r1001.balance], [1200, 400, 800]);
  const r7003 = d.rows.find((r) => r.orderId === 7003);
  assert.deepEqual([r7003.total, r7003.paid, r7003.balance], [600, 250, 350], 'the deleted 100 is not counted');
  assert.equal(d.rows[0].daysToEvent, 3, '1.10 -> 4.10');
  assert.equal(r1001.daysToEvent, 14);
  assert.equal(d.rows[3].daysToEvent, null);
  assert.equal(d.totals.orders, 4);
  assert.equal(d.totals.balance, 1000 + 800 + 350 + 400);
  assert.equal(d.totalLabel, 'סה״כ יתרות לגבייה (4 הזמנות)');
  assert.match(d.sum, /^₪2,550 · סה״כ לגבייה$/);
  assert.equal(d.stats[0].value, 4);
  assert.equal(d.stats[1].label, 'הקרובה ביותר:');
  assert.equal(d.stats[1].value, 'כ״ג תשרי', '4.10.2026 = כ״ג תשרי');
  assert.equal(d.rows[0].eventHebrew, 'יום ראשון כ״ג תשרי');
  assert.equal(d.empty, false);
});

test('empty day: no balances -> empty page and no bold stats crash', async () => {
  const { payload } = await payloadFor(['PP-02'], { orders: allOrders().filter((o) => o.orderId >= 7001 && o.orderId <= 7001) });
  const d = payload.pages[0].data;
  assert.equal(d.empty, true);
  assert.equal(d.totals.balance, 0);
  assert.deepEqual(d.stats.map((s) => s.label), ['הזמנות עם יתרה', 'מסודר לפי תאריך האירוע, הקרוב קודם']);
});

test('daysBetween is calendar math (no timezone drift across DST)', () => {
  assert.equal(PP02.daysBetween('2026-10-01', '2026-10-04'), 3);
  assert.equal(PP02.daysBetween('2026-10-20', '2026-10-31'), 11);
  assert.equal(PP02.daysBetween('2026-03-26', '2026-03-28'), 2); // Israel DST night 27.3
  assert.equal(PP02.daysBetween('2026-10-05', '2026-10-01'), -4);
});

test('toRows: Hebrew columns, numbers stay numbers, Gregorian + Hebrew date, no barcode/signature columns', async () => {
  const { payload } = await payloadFor(['PP-02']);
  const rows = PP02.toRows(payload.pages[0].data);
  assert.equal(rows.length, 4);
  assert.deepEqual(Object.keys(rows[0]), ['הזמנה', 'לקוחה', 'טלפון', 'תאריך אירוע', 'תאריך עברי', 'ימים לאירוע', 'חיוב', 'שולם', 'יתרה לגבייה']);
  assert.equal(rows[0]['תאריך אירוע'], '04/10/2026');
  assert.equal(typeof rows[0]['יתרה לגבייה'], 'number');
  assert.equal(rows[3]['ימים לאירוע'], null);
  assert.equal(PP02.SHEET_NAME, 'סיכום יתרות לגבייה');
});

test('API: 403 without the orders page permission, 200 for head management; one extras query, scoped to the stage orders', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const denied = await get('?page=PP-02&date=2026-10-01');
  assert.equal(denied.status, 403);
  assert.equal(denied.__json.page, 'PP-02');

  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await get('?page=PP-02&date=2026-10-01');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.pages[0].key, 'PP-02');
  assert.equal(r.__json.pages[0].data.rows.length, 4);
  const calls = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order' && c.args && c.args.select && c.args.select.payments);
  assert.equal(calls.length, 1, 'one orderInfo query');
  assert.ok(calls[0].args.where.orderId.in.includes(7002));

  const x = await get('?page=PP-02&date=2026-10-01&format=rows');
  assert.equal(x.status, 200);
  assert.equal(x.__json.sheets[0].sheetName, 'סיכום יתרות לגבייה');
  assert.equal(x.__json.sheets[0].rows.length, 4);
});
