// Excel של PP-02 + PP-13 + PP-19 יחד (lib/schedule/print/xlsx.js, חבילת xlsx האמיתית): גיליון RTL לכל דף, מספרים כמספרים, טלפון כטקסט,
// ובלי עמודת סניף בדף 13 / בלי עמודות ברקוד-חתימה בדף 02.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { payloadFor } from './pp02-13-19.fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const require = createRequire(process.env.PROJ + '/package.json');
const XLSX = require('xlsx');
const { buildScheduleWorkbook } = await L('lib/schedule/print/xlsx.js');
const { payloadToRows } = await L('lib/schedule/print/data.js');

test('payloadToRows + buildScheduleWorkbook: three RTL sheets with the right headers and typed cells', async () => {
  const { payload } = await payloadFor(['PP-02', 'PP-13', 'PP-19']);
  const sheets = payloadToRows(payload);
  assert.deepEqual(sheets.map((s) => s.key), ['PP-02', 'PP-13', 'PP-19']);
  assert.deepEqual(sheets.map((s) => s.rows.length), [4, 4, 6]);
  const wb = buildScheduleWorkbook(XLSX, sheets);
  assert.equal(wb.Workbook.Views[0].RTL, true);
  assert.deepEqual(wb.SheetNames, ['סיכום יתרות לגבייה', 'דף איסוף מקומי', 'איסוף מלקוחות לפי עיר']);

  const s02 = wb.Sheets['סיכום יתרות לגבייה'];
  assert.equal(s02.A1.v, 'הזמנה');
  assert.equal(s02.A2.t, 'n');
  assert.equal(s02.C2.t, 's', 'phone stays text');
  const header02 = Object.keys(sheets[0].rows[0]);
  assert.equal(header02.includes('יתרה לגבייה'), true);
  const balCol = String.fromCharCode(65 + header02.indexOf('יתרה לגבייה'));
  assert.equal(s02[balCol + '2'].t, 'n');
  assert.equal(s02[balCol + '2'].v, 1000);

  const header13 = Object.keys(sheets[1].rows[0]);
  assert.equal(header13.some((h) => /סניף/.test(h)), false, 'no branch column in the pickup sheet');

  const s19 = wb.Sheets['איסוף מלקוחות לפי עיר'];
  assert.equal(s19.A2.v, 1, 'first stop');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true });
  assert.ok(buf.length > 1500);
  assert.deepEqual(XLSX.read(buf, { type: 'buffer' }).SheetNames, wb.SheetNames);
});
