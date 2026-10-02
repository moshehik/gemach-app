// ייצוא Excel של דפי הקבוצה (03 בשתי גרסאות, 04, 08, 09): format=rows -> buildScheduleWorkbook עם חבילת xlsx האמיתית.
// בודק: גיליון לכל דף בשם העברי, RTL, מספרים כמספרים (הזמנה, שמלות), טלפון וברקוד כטקסט, שורה לכל פריט/מדבקה/הזמנה.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { g2Payload } from './pp-g2.fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const require = createRequire(process.env.PROJ + '/package.json');
const XLSX = require('xlsx');
const { buildScheduleWorkbook } = await L('lib/schedule/print/xlsx.js');
const { payloadToRows } = await L('lib/schedule/print/data.js');

test('xlsx of PP-03 (b) + PP-04 + PP-08 + PP-09: one RTL sheet each, typed cells, item codes as text', async () => {
  const { payload } = await g2Payload(['PP-03', 'PP-04', 'PP-08', 'PP-09'], { versions: { 'PP-03': 'b' } });
  const sheets = payloadToRows(payload);
  assert.deepEqual(sheets.map((s) => s.key), ['PP-03', 'PP-04', 'PP-08', 'PP-09']);
  const wb = buildScheduleWorkbook(XLSX, sheets);
  assert.deepEqual(wb.SheetNames, ['דף תיקונים לביצוע', 'מדבקות תיקון', 'מדבקות שמלה', 'צ׳ק ליסט הכנה']);
  assert.equal(wb.Workbook.Views[0].RTL, true);

  const rep = wb.Sheets['דף תיקונים לביצוע'];
  const header = (ws) => Object.keys(ws).filter((k) => /^[A-Z]+1$/.test(k)).map((k) => ws[k].v);
  assert.deepEqual(header(rep), ['תאריך אירוע', 'הזמנה', 'לקוחה', 'טלפון', 'דגם', 'מידה', 'תיקון צוואר', 'תיקון אורך', 'תיקון שרוול', 'תיאור תיקון', 'הערות להזמנה', 'ברקוד פריט']);
  assert.equal(rep.B2.t, 'n');
  assert.equal(typeof rep.B2.v, 'number');
  assert.equal(rep.D2.t, 's');
  assert.match(rep.D2.v, /^05\d-555-\d{4}$/);
  assert.match(rep.L2.v, /^REP-\d+-\d+$/);
  assert.ok(rep['!ref'].endsWith(String(sheets[0].rows.length + 1)), 'one row per item + header');

  assert.ok(wb.Sheets['מדבקות תיקון']['!ref'].endsWith(String(sheets[1].rows.length + 1)));
  const dress = wb.Sheets['מדבקות שמלה'];
  assert.equal(dress.B2.t, 's');
  assert.equal(dress.A2.t, 'n');
  assert.equal(sheets[2].rows.length, 18);
  const chk = wb.Sheets['צ׳ק ליסט הכנה'];
  assert.equal(chk.C2.t, 'n', 'dresses count is a number');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true });
  const back = XLSX.read(buf, { type: 'buffer' });
  assert.deepEqual(back.SheetNames, wb.SheetNames);
  assert.equal(back.Workbook.Views[0].RTL, true);
});

test('empty pages still get a sheet with the "no rows" note (no crash)', async () => {
  const { payload } = await g2Payload(['PP-03', 'PP-04', 'PP-08', 'PP-09'], { orders: [] });
  const wb = buildScheduleWorkbook(XLSX, payloadToRows(payload));
  assert.equal(wb.SheetNames.length, 4);
  for (const n of wb.SheetNames) assert.equal(wb.Sheets[n].A2.v, 'אין שורות בדף זה');
});
