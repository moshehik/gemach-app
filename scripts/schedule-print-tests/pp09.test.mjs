// PP-09 "צ׳ק ליסט הכנה": שורה לכל הזמנה להכנה, תיבות לכל שמלה, "תיקון בוצע" רק להזמנות עם תיקון, ברקוד PRP-<הזמנה>.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { g2Payload } from './pp-g2.fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const R = await L('lib/schedule/print/registry.js');
const { payloadToRows } = await L('lib/schedule/print/data.js');
const { parseScheduleCode } = await L('lib/schedule/print/barcode.js');

test('registry: ready, order-level barcode, itemInfo extra only', () => {
  const p = R.getPrintPage('PP-09');
  assert.equal(p.status, 'ready');
  assert.deepEqual(p.extras, ['itemInfo']);
  assert.deepEqual(p.extraPageKeys, []);
  assert.deepEqual(p.barcode, { prefix: 'PRP', page: true, rows: 'order' });
});

test('rows: by order number, dresses count, repair flag from itemInfo, order barcode, sum line', async () => {
  const { payload } = await g2Payload(['PP-09']);
  const pg = payload.pages[0];
  assert.equal(pg.pageCode, 'ALL-PRP-261001');
  const d = pg.data;
  assert.equal(d.title, 'צ׳ק ליסט הכנה');
  assert.equal(d.sub, 'בדיקה, גיהוץ ואריזה לכל הזמנה');
  assert.equal(d.rows.length, 12);
  assert.equal(d.sum, '12 הזמנות · 18 שמלות');
  assert.deepEqual(d.rows.map((r) => r.orderId), [...d.rows.map((r) => r.orderId)].sort((a, b) => a - b));
  const r0 = d.rows.find((r) => r.orderId === 41000);
  assert.equal(r0.name, 'מרים אברמוביץ');
  assert.equal(r0.dresses, 1);
  assert.equal(r0.hasRepair, true);
  assert.equal(r0.code, 'PRP-41000');
  assert.deepEqual(parseScheduleCode(r0.code), { kind: 'order', stage: 'prep', prefix: 'PRP', orderId: 41000 });
  const r1 = d.rows.find((r) => r.orderId === 41011);
  assert.equal(r1.dresses, 2);
  assert.equal(r1.hasRepair, false);
  assert.equal(d.totals.dresses, 18);
});

test('toRows + empty day', async () => {
  const { payload } = await g2Payload(['PP-09']);
  const r = payloadToRows(payload)[0];
  assert.equal(r.sheetName, 'צ׳ק ליסט הכנה');
  assert.deepEqual(Object.keys(r.rows[0]), ['הזמנה', 'לקוחה', 'שמלות', 'יש תיקון', 'הערות להזמנה', 'ברקוד הזמנה']);
  assert.equal(r.rows.length, 12);
  assert.equal(typeof r.rows[0]['שמלות'], 'number');
  const empty = await g2Payload(['PP-09'], { orders: [] });
  assert.equal(empty.payload.pages[0].data.empty, true);
  assert.equal(empty.payload.pages[0].data.sum, '0 הזמנות · 0 שמלות');
});
