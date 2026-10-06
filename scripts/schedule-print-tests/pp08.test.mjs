// PP-08 "מדבקות שמלה": מדבקה לכל שמלה של הזמנות ההכנה, תג משלוח / איסוף · סניף, "שמלה k מתוך N", "יש תיקון", ברקוד PRP-<הזמנה>-<k>.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { g2Payload } from './pp-g2.fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const R = await L('lib/schedule/print/registry.js');
const { payloadToRows } = await L('lib/schedule/print/data.js');

test('registry: ready, slim sticker sheet, no extra permission (prep is shown in the schedule), extras orderInfo + itemInfo', () => {
  const p = R.getPrintPage('PP-08');
  assert.equal(p.status, 'ready');
  assert.equal(p.slim, true);
  assert.deepEqual(p.extraPageKeys, []);
  assert.deepEqual(p.extras, ['orderInfo', 'itemInfo']);
  assert.deepEqual(p.barcode, { prefix: 'PRP', page: true, rows: 'item' });
});

test('one sticker per dress of every prep order; tag, k-of-N, repair flag and PRP codes', async () => {
  const { payload } = await g2Payload(['PP-08']);
  const pg = payload.pages[0];
  assert.equal(pg.pageCode, 'ALL-PRP-261015');
  const d = pg.data;
  assert.equal(d.title, 'מדבקות שמלה');
  assert.equal(d.sub, 'מדבקה לכל שמלה, להדבקה על הקולב או השקית');
  assert.equal(d.labels.length, 18, '12 orders: 18 dresses (design: 18 stickers = one sheet)');
  assert.equal(d.sum, '18 מדבקות');
  assert.deepEqual(d.labels.map((l) => l.orderId), [...d.labels.map((l) => l.orderId)].sort((a, b) => a - b), 'by order number');
  const o = d.labels.filter((l) => l.orderId === 41011);
  assert.equal(o.length, 2);
  assert.deepEqual(o.map((l) => l.code), ['PRP-41011-1', 'PRP-41011-2']);
  assert.deepEqual(o.map((l) => l.n), [1, 2]);
  assert.ok(o.every((l) => l.total === 2));
  assert.equal(o[0].tag, 'איסוף · נווה יעקב', 'pickup: branch of the order');
  assert.equal(o[0].delivery, false);
  const del = d.labels.find((l) => l.orderId === 41000);
  assert.equal(del.tag, 'משלוח');
  assert.equal(del.delivery, true);
  assert.equal(del.hasRepair, true, 'order 41000 (index 0) has an item with a repair');
  assert.equal(d.labels.find((l) => l.orderId === 41011).hasRepair, false);
  assert.match(del.model, / - \d{4}$/);
  assert.equal(del.eventShort, 'ט׳ חשוון', 'event 20.10.2026 = ט׳ חשוון');
});

test('pickup without a branch says just "איסוף"; delivery-return-only order is not a "משלוח" sticker', async () => {
  const { day } = await g2Payload(['PP-08']);
  const mod = (await L('lib/schedule/print/pages/index.js')).getPageModule('PP-08');
  const page = R.getPrintPage('PP-08');
  const noInfo = mod.build({ day, page, extras: {} });
  assert.ok(noInfo.labels.every((l) => l.tag.startsWith('איסוף')), 'without orderInfo nothing is a delivery');
  const backOnly = mod.build({ day, page, extras: { orderInfo: { 41000: { delivery: { isDelivery: true, direction: 'חזור' } } } } });
  assert.equal(backOnly.labels.find((l) => l.orderId === 41000).delivery, false);
  assert.equal(noInfo.labels.find((l) => l.orderId === 41000).tag, 'איסוף', 'no branch -> plain "איסוף"');
});

test('toRows: one row per sticker; empty day empty; queries: orderInfo once + itemInfo once', async () => {
  const { payload, calls } = await g2Payload(['PP-08']);
  const r = payloadToRows(payload)[0];
  assert.equal(r.sheetName, 'מדבקות שמלה');
  assert.equal(r.rows.length, 18);
  assert.deepEqual(Object.keys(r.rows[0]), ['הזמנה', 'לקוחה', 'דגם', 'מידה', 'אירוע', 'שמלה', 'מתוך', 'משלוח / איסוף', 'יש תיקון', 'ברקוד פריט']);
  assert.equal(calls.filter((c) => c.model === 'orderItem').length, 1);
  // orderInfo once (delivery + city only): PP-08 shows no money, so the payments relation is not loaded
  const orderInfoCalls = calls.filter((c) => c.model === 'order' && c.args.select && Object.keys(c.args.select).sort().join(',') === 'customer,deliveryDirection,isDelivery,orderId');
  assert.equal(orderInfoCalls.length, 1);
  assert.equal(calls.filter((c) => c.model === 'order' && c.args.select && c.args.select.payments && c.args.where && c.args.where.orderId).length, 0, 'no payments for a page without money');
  const empty = await g2Payload(['PP-08'], { orders: [] });
  assert.equal(empty.payload.pages[0].data.empty, true);
});
