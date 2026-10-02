// קובץ Excel של כמה דפים (lib/schedule/print/xlsx.js, עם חבילת xlsx האמיתית) + שער הנתיב של POST /api/pdf
// (lib/printAccess.js printPathPageKeys: /schedule/print/<keys> בלבד, בלי נתיבים מקוננים).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const require = createRequire(process.env.PROJ + '/package.json');
const XLSX = require('xlsx');
const { buildScheduleWorkbook } = await L('lib/schedule/print/xlsx.js');
const PA = await L('lib/printAccess.js');

test('buildScheduleWorkbook: one RTL sheet per page, Hebrew names, numbers stay numbers, phones stay text', () => {
  const wb = buildScheduleWorkbook(XLSX, [
    { key: 'PP-01', sheetName: 'דוח הזמנות כללי', rows: [{ 'הזמנה': 40113, 'לקוחה': 'מרים', 'טלפון': '050-5550101', 'חיוב': 1200 }] },
    { key: 'PP-15', sheetName: 'רשימת אירועים', rows: [] },
    { key: 'PP-15b', sheetName: 'רשימת אירועים', rows: [{ 'הזמנה': 1 }] },
  ]);
  assert.deepEqual(wb.Workbook, { Views: [{ RTL: true }] });
  assert.deepEqual(wb.SheetNames, ['דוח הזמנות כללי', 'רשימת אירועים', 'רשימת אירועים 2']);
  const ws = wb.Sheets['דוח הזמנות כללי'];
  assert.equal(ws.A1.v, 'הזמנה');
  assert.equal(ws.A2.t, 'n'); assert.equal(ws.A2.v, 40113);
  assert.equal(ws.C2.t, 's'); assert.equal(ws.C2.v, '050-5550101');
  assert.equal(ws.D2.t, 'n'); assert.equal(ws.D2.v, 1200);
  assert.ok(ws['!autofilter']);
  assert.equal(wb.Sheets['רשימת אירועים'].A2.v, 'אין שורות בדף זה');
  // the real writer accepts it (buffer, not a file)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true });
  assert.ok(buf.length > 1000);
  const back = XLSX.read(buf, { type: 'buffer' });
  assert.deepEqual(back.SheetNames, wb.SheetNames);
  assert.equal(back.Workbook.Views[0].RTL, true);
});

test('printPathPageKeys: exact print paths, /schedule/print/<keys> only, everything else closed', () => {
  assert.deepEqual(PA.printPathPageKeys('/print/order'), PA.PRINT_ORDER_PAGE_KEYS);
  assert.deepEqual(PA.printPathPageKeys('/print/alterations'), PA.PRINT_ALTERATIONS_PAGE_KEYS);
  assert.deepEqual(PA.printPathPageKeys('/schedule/print/PP-01'), ['page:schedule']);
  assert.deepEqual(PA.printPathPageKeys('/schedule/print/PP-01,PP-15'), ['page:schedule']);
  for (const bad of ['/schedule/print', '/schedule/print/', '/schedule/print/PP-01/x', '/schedule/print/PP-01?x=1', '/schedule/print/..', '/schedule/print/%2e%2e', '/schedule', '/admin', '/print/delivery-courier', '', null]) {
    assert.equal(PA.printPathPageKeys(bad), null, String(bad));
  }
  assert.ok(Object.keys(PA.PRINT_PATH_PAGE_KEYS).includes('/schedule/print'));
});
