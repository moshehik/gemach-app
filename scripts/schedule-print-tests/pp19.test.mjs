// PP-19 "רשימת איסוף מלקוחות לפי עיר": שלב 9 (איסוף שליח חזור) מקובץ לפי עיר, עצירות רצות, ברקוד DBK, דגל "חסרה כתובת", הרשאת משלוחים.
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
const PP19 = await L('lib/schedule/print/pages/PP-19.js');
const R = await L('lib/schedule/print/registry.js');
const B = await L('lib/schedule/print/barcode.js');

const get = (qs = '') => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
beforeEach(() => {
  installDb({ extra: { order: allOrders() } });
  invalidateSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
});

test('registry: ready, DBK barcode, deliveries permission, no extras (the stage rows carry address + phones)', () => {
  const p = R.getPrintPage('PP-19');
  assert.equal(p.status, 'ready');
  assert.deepEqual(p.barcode, { prefix: 'DBK', page: true, rows: 'order' });
  assert.deepEqual(p.stages, ['dback']);
  assert.equal(p.extras, undefined);
});

test('grouped by city (bigger city first, "no city" last), stops numbered 1..n across the page, missing street last in its city', async () => {
  const { payload, extras } = await payloadFor(['PP-19']);
  assert.deepEqual(extras, {}, 'no extra query for this page');
  const pg = payload.pages[0];
  assert.equal(pg.pageCode, 'ALL-DBK-261015');
  const d = pg.data;
  assert.deepEqual(d.groups.map((g) => g.city), ['ירושלים', 'בית שמש', 'ללא עיר']);
  assert.deepEqual(d.groups.map((g) => g.rows.length), [3, 2, 1]);
  assert.deepEqual(d.groups.flatMap((g) => g.rows.map((r) => r.stop)), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(d.groups[0].rows.map((r) => r.orderId), [7024, 7021, 7022], 'by street (אגריפס, יפו), the one without a street last');
  assert.equal(d.groups[0].rows[2].street, '', 'rendered as the "חסרה כתובת" flag');
  assert.deepEqual(d.groups.map((g) => g.dresses), [4, 3, 1]);
  assert.deepEqual(d.totals, { cities: 2, stops: 6, dresses: 8 });
  assert.equal(d.sum, '2 ערים · 6 עצירות · 8 שמלות');
  assert.equal(d.empty, false);
});

test('row data: both phones, order note, DBK-<order> code that scans back to stage dback; already-collected order marked done', async () => {
  const { payload } = await payloadFor(['PP-19']);
  const rows = payload.pages[0].data.groups.flatMap((g) => g.rows);
  const r = rows.find((x) => x.orderId === 7021);
  assert.equal(r.phone, '050-1111111');
  assert.equal(r.phone2, '052-2222222');
  assert.equal(r.notes, 'לקרוא לפני ההגעה');
  assert.equal(r.dressCount, 2);
  assert.equal(r.code, 'DBK-7021');
  assert.ok(B.isValidCode39(r.code));
  assert.deepEqual(B.parseScheduleCode(r.code), { kind: 'order', stage: 'dback', prefix: 'DBK', orderId: 7021 });
  assert.equal(rows.find((x) => x.orderId === 1022).done, true, 'returnCondition already recorded -> "נאסף"');
  assert.equal(rows.find((x) => x.orderId === 7021).done, false);
  assert.equal(rows.every((x) => !('model' in x) && !('size' in x)), true, 'dress count only, no model details');
});

test('only dback orders: a delivery-out-only order and a draft never appear', async () => {
  const { payload } = await payloadFor(['PP-19']);
  const ids = payload.pages[0].data.groups.flatMap((g) => g.rows.map((r) => r.orderId));
  assert.ok(!ids.includes(1009), 'delivery out only');
  assert.ok(!ids.includes(9001), 'draft delivery');
});

test('empty day: empty flag, zero stops, sum without a cities part', () => {
  const day = { date: '2026-10-01', stages: [{ key: 'dback', items: [] }] };
  const d = PP19.build({ day, page: R.getPrintPage('PP-19') });
  assert.equal(d.empty, true);
  assert.deepEqual(d.groups, []);
  assert.equal(d.sum, '0 עצירות · 0 שמלות');
  assert.deepEqual(PP19.toRows(d), []);
});

test('toRows: stop, city, name, order, street, both phones, dresses, note, collected, barcode', async () => {
  const { payload } = await payloadFor(['PP-19']);
  const rows = PP19.toRows(payload.pages[0].data);
  assert.equal(rows.length, 6);
  assert.deepEqual(Object.keys(rows[0]), ['עצירה', 'עיר', 'לקוחה', 'הזמנה', 'רחוב ומספר', 'טלפון 1', 'טלפון 2', 'שמלות', 'הערה', 'נאסף', 'ברקוד']);
  assert.equal(rows[0]['עצירה'], 1);
  assert.equal(rows[5]['עיר'], '', 'no-city group has an empty city cell, not the placeholder');
  assert.equal(PP19.SHEET_NAME.length <= 31, true);
});

test('API: deliveries permission gate (403 for an employee without it), 200 + payload for head management', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const denied = await get('?page=PP-19&date=2026-10-15');
  assert.equal(denied.status, 403);
  assert.equal(denied.__json.page, 'PP-19');
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await get('?page=PP-19&date=2026-10-15');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.pages[0].data.totals.stops, 6);
  const x = await get('?page=PP-19&date=2026-10-15&format=rows');
  assert.equal(x.status, 200);
  assert.equal(x.__json.sheets[0].rows.length, 6);
});
