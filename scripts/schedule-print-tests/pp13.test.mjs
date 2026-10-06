// PP-13 "דף איסוף מקומי": בלי עמודת סניף, יתרה לתשלום מה-extra orderBalance, ברקוד PCK לשורה ולדף, שעות קבלה, הרשאה.
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
const PP13 = await L('lib/schedule/print/pages/PP-13.js');
const R = await L('lib/schedule/print/registry.js');
const B = await L('lib/schedule/print/barcode.js');

const get = (qs = '') => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
beforeEach(() => {
  installDb({ extra: { order: allOrders() } });
  invalidateSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
});

test('registry: ready, PCK barcode (page + per order), money permission, orderBalance extra', () => {
  const p = R.getPrintPage('PP-13');
  assert.equal(p.status, 'ready');
  assert.deepEqual(p.barcode, { prefix: 'PCK', page: true, rows: 'order' });
  assert.deepEqual(p.stages, ['pick']);
  assert.deepEqual(p.extras, ['orderBalance']);
});

test('rows from stage 6: no branch anywhere, balance / paid-in-full / unknown, "done" for fully collected, PCK-<order> codes', async () => {
  const { payload } = await payloadFor(['PP-13']);
  const pg = payload.pages[0];
  assert.equal(pg.pageCode, 'ALL-PCK-261015', 'page barcode in the header');
  const d = pg.data;
  assert.deepEqual(d.rows.map((r) => r.orderId).sort(), [1007, 7011, 7012, 7013].sort());
  assert.equal(d.rows.find((r) => r.orderId === 1008), undefined, 'delivery-out orders are not local pickups');
  const by = (id) => d.rows.find((r) => r.orderId === id);
  assert.equal(by(7011).balance, 0, 'paid in full');
  assert.equal(by(7012).balance, null, 'no amount -> blank (not 0)');
  assert.equal(by(7013).balance, 300, 'deleted payment ignored: 500 - 200');
  assert.equal(by(7013).done, true);
  assert.equal(by(7011).done, false);
  assert.equal(by(7011).code, 'PCK-7011');
  assert.ok(B.isValidCode39(by(7011).code));
  assert.deepEqual(B.parseScheduleCode(by(7011).code), { kind: 'order', stage: 'pick', prefix: 'PCK', orderId: 7011 });
  for (const r of d.rows) for (const k of Object.keys(r)) assert.ok(!/branch|סניף/i.test(k), 'no branch field: ' + k);
  assert.equal(JSON.stringify(d).includes('גב״ש'), false, 'the pickup branch name never reaches the page data');
  assert.equal(d.sum, '4 הזמנות · 6 שמלות');
  assert.equal(d.sub, 'מי מגיעה לקחת את השמלות היום');
});

test('pickup hours come from standard_pickup_hours (default 20:00-21:30) and read "A עד B"', async () => {
  const { payload } = await payloadFor(['PP-13']);
  assert.equal(payload.pages[0].data.pickupHours, '20:00 עד 21:30');
  assert.equal(PP13.pickupHoursText('18:00-19:30'), '18:00 עד 19:30');
  assert.equal(PP13.pickupHoursText('אחרי 17:00'), 'אחרי 17:00', 'free text stays as written');
  assert.equal(PP13.pickupHoursText(''), '');
  assert.equal(payload.pages[0].data.pickupLabel, 'קבלת השמלות היום:');
});

test('a day that is not today does not say "today"', async () => {
  const { payload } = await payloadFor(['PP-13'], { date: '2026-10-19' });
  const d = payload.pages[0].data;
  assert.equal(d.pickupLabel, 'קבלת השמלות:');
  assert.equal(d.sub, 'מי מגיעה לקחת את השמלות ביום זה');
});

test('orderBalance extra: one query, only the stage-6 orders, no payments query for pages that did not ask', async () => {
  const { extras } = await payloadFor(['PP-13']);
  assert.deepEqual(Object.keys(extras), ['orderBalance']);
  assert.deepEqual(Object.keys(extras.orderBalance).map(Number).sort(), [1007, 7011, 7012, 7013].sort());
  const calls = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order' && c.args && c.args.select && c.args.select.payments && c.args.where && c.args.where.orderId);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'findMany');
  assert.ok(!('take' in calls[0].args) || calls[0].args.take > 0);
});

test('toRows: Hebrew columns without a branch column; amounts as numbers; "נאסף" כן/לא; barcode text', async () => {
  const { payload } = await payloadFor(['PP-13']);
  const rows = PP13.toRows(payload.pages[0].data);
  assert.deepEqual(Object.keys(rows[0]), ['הזמנה', 'לקוחה', 'טלפון', 'תאריך אירוע', 'תאריך עברי', 'שמלות', 'יתרה לתשלום', 'נאסף', 'ברקוד']);
  assert.ok(!Object.keys(rows[0]).some((k) => /סניף/.test(k)));
  const r7013 = rows.find((r) => r['הזמנה'] === 7013);
  assert.equal(r7013['יתרה לתשלום'], 300);
  assert.equal(r7013['נאסף'], 'כן');
  assert.equal(r7013['תאריך אירוע'], '19/10/2026');
});

test('API: 403 without the orders permission; 200 for head management; header barcode in the payload', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  assert.equal((await get('?page=PP-13&date=2026-10-15')).status, 403);
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await get('?page=PP-13&date=2026-10-15');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.pages[0].pageCode, 'ALL-PCK-261015');
  assert.equal(r.__json.pages[0].def.chip, 'איסוף מקומי');
  assert.equal(r.__json.pages[0].data.rows.length, 4);
});
