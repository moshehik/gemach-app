// PP-04 "מדבקות תיקון": מדבקה לכל פריט שטרם בוצע, ממוין כמו "תוויות לתופרות" הקיים, ברקוד פריט REP-<הזמנה>-<n>, 18 בעמוד.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { g2Payload, g2Orders } from './pp-g2.fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const R = await L('lib/schedule/print/registry.js');
const { payloadToRows } = await L('lib/schedule/print/data.js');
const { STICKERS_PER_PAGE, build } = await L('lib/schedule/print/pages/PP-04.js');
const { chunk } = await L('lib/schedule/print/repairItems.js');

test('registry: ready, slim sticker sheet, alterations gate, header + item barcodes', () => {
  const p = R.getPrintPage('PP-04');
  assert.equal(p.status, 'ready');
  assert.equal(p.slim, true);
  assert.equal(p.versions, undefined);
  assert.deepEqual(p.barcode, { prefix: 'REP', page: true, rows: 'item' });
  assert.ok(p.extraPageKeys.includes('page:alterations'));
  assert.equal(STICKERS_PER_PAGE, 18, '3 columns x 6 rows (design)');
});

test('one sticker per pending alteration item; fields and sort order match labelsRep() of the design', async () => {
  const { payload } = await g2Payload(['PP-04']);
  const pg = payload.pages[0];
  assert.equal(pg.pageCode, 'ALL-REP-261015');
  const d = pg.data;
  assert.equal(d.title, 'מדבקות תיקון');
  assert.equal(d.sub, 'מדבקה לכל שמלה');
  assert.equal(d.sum, '9 מדבקות');
  assert.equal(d.labels.length, 9);
  assert.equal(d.perPage, 18);
  // sort: event date, model, size, customer name
  const cmp = (a, b) => String(a).localeCompare(String(b), 'he', { numeric: true });
  const sorted = [...d.labels].sort((a, b) => cmp(a.eventKey, b.eventKey) || cmp(a.model, b.model) || cmp(a.size, b.size) || cmp(a.name, b.name));
  assert.deepEqual(d.labels.map((l) => l.code), sorted.map((l) => l.code));
  const s = d.labels.find((l) => l.orderId === 40152 && l.det);
  assert.equal(s.name, 'חנה גולדברג');
  assert.equal(s.fix, 'אורך: הארכה 3');
  assert.equal(s.det, 'לשמור על התחרה בשולי השמלה');
  assert.equal(s.eventShort, 'ד׳ חשוון', 'event 15.10.2026 = ד׳ חשוון');
  const both = d.labels.find((l) => l.fix.includes('צוואר') && l.fix.includes('אורך'));
  assert.match(both.fix, /^צוואר: הצרה \d \| אורך: /, 'same text as the existing labels page (neck | length | sleeve)');
});

test('codes: REP-<order>-<n>, unique, valid Code 39', async () => {
  const { payload } = await g2Payload(['PP-04']);
  const { isValidCode39 } = await L('lib/schedule/print/barcode.js');
  const codes = payload.pages[0].data.labels.map((l) => l.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const c of codes) {
    assert.match(c, /^REP-\d+-\d+$/);
    assert.ok(isValidCode39(c));
  }
});

test('pages of 18: chunk() splits exactly and keeps the order; 40 stickers = 3 sheets (18, 18, 4)', async () => {
  const { payload } = await g2Payload(['PP-04'], { long: true });
  const labels = payload.pages[0].data.labels;
  assert.ok(labels.length > 90);
  const groups = chunk(labels, 18);
  assert.equal(groups.length, Math.ceil(labels.length / 18));
  assert.ok(groups.slice(0, -1).every((g) => g.length === 18));
  assert.deepEqual(groups.flat().map((l) => l.code), labels.map((l) => l.code));
  assert.deepEqual(chunk(Array.from({ length: 40 }, (_, i) => i), 18).map((g) => g.length), [18, 18, 4]);
  assert.deepEqual(chunk([], 18), []);
});

test('done items get no sticker; empty day = empty page; toRows one row per sticker', async () => {
  const orders = g2Orders();
  for (const it of orders[0].items) it.alterationDone = true; // order 40100: all done -> no sticker
  const { payload } = await g2Payload(['PP-04'], { orders });
  const d = payload.pages[0].data;
  assert.equal(d.labels.some((l) => l.orderId === 40100), false);
  assert.equal(d.labels.length, 8);
  const rows = payloadToRows(payload)[0];
  assert.equal(rows.sheetName, 'מדבקות תיקון');
  assert.equal(rows.rows.length, 8);
  assert.deepEqual(Object.keys(rows.rows[0]), ['תאריך אירוע', 'הזמנה', 'לקוחה', 'דגם', 'מידה', 'תיקונים', 'פירוט', 'ברקוד פריט']);
  const empty = await g2Payload(['PP-04'], { orders: [] });
  assert.equal(empty.payload.pages[0].data.empty, true);
  assert.equal(empty.payload.pages[0].data.sum, '0 מדבקות');
  assert.equal(build({ day: { stages: [], date: '2026-10-01' }, page: R.getPrintPage('PP-04'), extras: {} }).empty, true);
});
