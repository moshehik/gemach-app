// דפי הכנה (12.10.2026): סדר פריטים (דגם עולה, בתוך הדגם מידה עולה) ב-PP-07 / PP-08 + תווית הדגם בלי כפל ("522 - 522") ב-PP-03/04/08 + sizeCompare המשותף.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const PP07 = await L('lib/schedule/print/pages/PP-07.js');
const PP08 = await L('lib/schedule/print/pages/PP-08.js');
const { modelLabel, sizeCompare } = await L('lib/schedule/print/repairItems.js');
const { getPrintPage } = await L('lib/schedule/print/registry.js');

const sd = (stages) => ({ date: '2026-10-15', weekday: 'יום חמישי', isToday: true, nonWorkingDay: false, settings: {}, stages });
const prepRow = (orderId, items) => ({
  orderId, stage: 'prep', customer: { name: 'לאה דוד', firstName: 'לאה', lastName: 'דוד', phone1: '050-1234567', phone2: '' },
  eventKey: '2026-10-20', eventDateHebrew: null, dressCount: items.length, notes: '', items,
});
const it = (id, prefix, size, model) => ({ orderItemId: id, model: model === undefined ? String(prefix) : model, modelPrefix: prefix, size, location: null, inRepair: false });

// הזמנה בנווה: הדגם הוא המספר עצמו (שם = מספר), פריטים בסדר הכנסה "שגוי"
const SCRAMBLED = [it('i1', 522, '10'), it('i2', 4512, '6'), it('i3', 522, '6'), it('i4', 522, '8'), it('i5', 522, '06.1'), it('i6', 522, null), it('i7', 522, '00.5')];
const EXPECTED_IDS = ['i7', 'i3', 'i5', 'i4', 'i1', 'i6', 'i2']; // 522: 00.5, 6, 06.1, 8, 10, (ריק) ואז 4512: 6

test('PP-07: dresses of an order are printed model ascending, size ascending (also when the day payload arrives scrambled); xlsx rows follow the same order', () => {
  const day = sd([{ key: 'prep', items: [prepRow(10, SCRAMBLED)] }]);
  for (const version of ['a', 'b']) {
    const d = PP07.build({ day, version, extras: { prepInfo: {} } });
    const dr = d.rows[0].dresses;
    assert.deepEqual(dr.map((x) => x.size), ['00.5', '6', '06.1', '8', '10', '', '6'], 'version ' + version);
    assert.deepEqual(dr.map((x) => x.n), [1, 2, 3, 4, 5, 6, 7], 'n = position in the printed list');
    assert.deepEqual(dr.map((x) => x.model), ['522', '522', '522', '522', '522', '522', '4512']);
    assert.deepEqual(PP07.toRows(d).map((r) => r['מידה']), ['00.5', '6', '06.1', '8', '10', '', '6']);
  }
  // the input array is not mutated
  assert.deepEqual(day.stages[0].items[0].items.map((x) => x.orderItemId), ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7']);
});

test('PP-07: a model name that differs from the number is shown as is (no number appended); sizes still ordered', () => {
  const day = sd([{ key: 'prep', items: [prepRow(11, [it('a', 4512, '12', 'תחרה קלאסית'), it('b', 4512, '8', 'תחרה קלאסית')])] }]);
  const d = PP07.build({ day, version: 'a', extras: {} });
  assert.deepEqual(d.rows[0].dresses.map((x) => [x.model, x.size]), [['תחרה קלאסית', '8'], ['תחרה קלאסית', '12']]);
});

test('PP-08: stickers per order follow the model/size order but the barcode number k stays the dress position in the order (itemInfo), orders by order id', () => {
  const day = sd([{ key: 'prep', items: [prepRow(20, SCRAMBLED), prepRow(19, [it('x2', 522, '10'), it('x1', 522, '8')])] }]);
  // k per item = its place in the order (ids sorted) as itemInfo gives it
  const itemInfo = { 20: {}, 19: { x2: { n: 1, alt: false }, x1: { n: 2, alt: false } } };
  SCRAMBLED.forEach((x, i) => { itemInfo[20][x.orderItemId] = { n: i + 1, alt: false }; });
  const page = getPrintPage('PP-08');
  const d = PP08.build({ day, page, extras: { itemInfo, orderInfo: {} } });
  assert.deepEqual(d.labels.map((l) => l.orderId), [19, 19, 20, 20, 20, 20, 20, 20, 20]);
  assert.deepEqual(d.labels.filter((l) => l.orderId === 19).map((l) => [l.size, l.n]), [['8', 2], ['10', 1]], 'sorted by size; k unchanged');
  const o20 = d.labels.filter((l) => l.orderId === 20);
  assert.deepEqual(o20.map((l) => l.size), ['00.5', '6', '06.1', '8', '10', '', '6']);
  assert.deepEqual(o20.map((l) => l.n), [7, 3, 5, 4, 1, 6, 2]);
  assert.deepEqual(o20.map((l) => l.code), ['PRP-20-7', 'PRP-20-3', 'PRP-20-5', 'PRP-20-4', 'PRP-20-1', 'PRP-20-6', 'PRP-20-2']);
  // name = number: the sticker says "522" once, never "522 - 522"
  assert.ok(d.labels.every((l) => !/(\d+) - \1\b/.test(l.model)), d.labels.map((l) => l.model).join('|'));
  assert.equal(o20[0].model, '522');
});

test('modelLabel: name = number prints once; real name + number "name - number"; no name -> number; no number -> name; nothing -> "דגם לא ידוע"', () => {
  assert.equal(modelLabel({ model: '522', modelPrefix: 522 }), '522');
  assert.equal(modelLabel({ model: ' 522 ', modelPrefix: '0522' }), '0522', 'same number: the stored code, once');
  assert.equal(modelLabel({ model: 'דגם 522', modelPrefix: 522 }), '522');
  assert.equal(modelLabel({ model: 'תחרה קלאסית', modelPrefix: 4512 }), 'תחרה קלאסית - 4512');
  assert.equal(modelLabel({ model: '', modelPrefix: 4512 }), '4512');
  assert.equal(modelLabel({ model: 'תחרה', modelPrefix: null }), 'תחרה');
  assert.equal(modelLabel({}), 'דגם לא ידוע');
  assert.equal(modelLabel(null), 'דגם לא ידוע');
});

test('sizeCompare (PP-03/04): the shared numeric-first order - 10 after 8, empty last', () => {
  assert.deepEqual(['10', '8', '', '06.1', 'XL', '6'].sort(sizeCompare), ['6', '06.1', '8', '10', 'XL', '']);
});
