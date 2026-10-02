// Code 39: קידוד תקין (כוכביות התחלה/סיום, 9 רכיבים לתו, 3 רחבים, רווח צר בין תווים, תווים חוקיים בלבד),
// סכימת הקודים של הלו״ז (DOT-40113, REP-40113-2, ALL-PRP-261014) ופענוח שאינו נוגע ב-parseBarcode של השמלות.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const B = await L('lib/schedule/print/barcode.js');

test('every Code 39 pattern has 9 elements, exactly 3 wide, and the table covers 0-9 A-Z - . space *', () => {
  const keys = Object.keys(B.CODE39);
  assert.equal(keys.length, 40); // 0-9, A-Z, '-', '.', ' ', '*' (the design's table; $ / + % are not needed for PP codes)
  for (const [ch, p] of Object.entries(B.CODE39)) {
    assert.equal(p.length, 9, ch);
    assert.equal((p.match(/w/g) || []).length, 3, ch + ' must have 3 wide elements');
    assert.match(p, /^[nw]{9}$/, ch);
  }
  // patterns are unique (a scanner could not tell two characters apart otherwise)
  assert.equal(new Set(Object.values(B.CODE39)).size, 40);
});

test('code39Bars: start/stop *, 5 bars per character, inter-character gap, widths 1x/3x unit', () => {
  const enc = B.code39Bars('DOT-40113', 1);
  assert.equal(enc.text, 'DOT-40113');
  const chars = '*DOT-40113*'.length; // 11
  assert.equal(enc.bars.length, chars * 5);
  for (const b of enc.bars) assert.ok(b.w === 1 || b.w === 3, 'bar width ' + b.w);
  // total width: each char = 6 narrow + 3 wide = 6*1 + 3*3 = 15 units, plus a narrow gap after each char except the last
  assert.equal(enc.width, chars * 15 + (chars - 1) * 1);
  // first bar of '*' (nwnnwnwnn) is narrow at x=0, second element is a wide space -> second bar starts at 1+3
  assert.deepEqual(enc.bars[0], { x: 0, w: 1 });
  assert.deepEqual(enc.bars[1], { x: 4, w: 1 });
  // lower-case is accepted and upper-cased
  assert.equal(B.code39Bars('rep-1-2').text, 'REP-1-2');
});

test('invalid characters are rejected (Hebrew, lowercase handled, * inside, empty)', () => {
  assert.equal(B.isValidCode39('ALL-PRP-261014'), true);
  assert.equal(B.isValidCode39('DOT 1'), true);
  assert.equal(B.isValidCode39('א'), false);
  assert.equal(B.isValidCode39('A*B'), false);
  assert.equal(B.isValidCode39(''), false);
  assert.throws(() => B.code39Bars('שלום'));
});

test('code39Svg: one rect per bar, mm sizes, data-code and aria-label, escaped', () => {
  const svg = B.code39Svg('DOT-40113', { height: 6, unit: 0.19 });
  assert.ok(svg.startsWith('<svg class="pp-bcsvg" data-code="DOT-40113"'));
  assert.equal((svg.match(/<rect /g) || []).length, 11 * 5);
  assert.match(svg, /width="[\d.]+mm" height="6mm"/);
  assert.match(svg, /aria-label="ברקוד DOT-40113"/);
});

test('schedule code scheme: orderCode / itemCode / dayCode / parseScheduleCode', () => {
  assert.equal(B.orderCode('DOT', 40113), 'DOT-40113');
  assert.equal(B.itemCode('REP', 40113, 2), 'REP-40113-2');
  assert.equal(B.dayCode('PRP', '2026-10-14'), 'ALL-PRP-261014');
  assert.deepEqual(B.parseScheduleCode('dot-40113'), { kind: 'order', stage: 'dout', prefix: 'DOT', orderId: 40113 });
  assert.deepEqual(B.parseScheduleCode('REP-40113-2'), { kind: 'item', stage: 'repair', prefix: 'REP', orderId: 40113, n: 2 });
  assert.deepEqual(B.parseScheduleCode('ALL-PRP-261014'), { kind: 'day', stage: 'prep', prefix: 'PRP', day: '2026-10-14' });
  // info-only stages have no "done" - their prefixes never resolve to an action
  assert.deepEqual(B.parseScheduleCode('ORD-40113'), { kind: 'none' });
  assert.deepEqual(B.parseScheduleCode('ALL-EVT-261014'), { kind: 'none' });
  assert.deepEqual(B.parseScheduleCode('XYZ-1'), { kind: 'none' });
  assert.deepEqual(B.parseScheduleCode(''), { kind: 'none' });
  // a dress-item barcode (digits only) is NOT a schedule code - stays with lib/rentalBarcodeMatch.js
  assert.deepEqual(B.parseScheduleCode('45120402'), { kind: 'none' });
});

test('every stage with a "done" source or marks has a prefix; page registry uses the same table', async () => {
  const { STAGES } = await L('lib/schedule/stages.js');
  for (const s of STAGES) assert.ok(B.STAGE_CODE_PREFIX[s.key], s.key);
  assert.equal(Object.keys(B.PREFIX_TO_STAGE).length, STAGES.length);
});
