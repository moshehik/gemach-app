// "הרשימה עלולה להיות חלקית" (lib/schedule/print/notices.js): meta.truncated / meta.warnings / meta.skipped /
// PP-16 lateTruncated מוצגים כבאנר ב-PrintShell (מסך + הדפסה) וכגיליון "הערות" ראשון בקובץ ה-Excel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const require = createRequire(process.env.PROJ + '/package.json');
const XLSX = require('xlsx');
const { printNotices } = await L('lib/schedule/print/notices.js');
const { buildScheduleWorkbook, NOTICES_SHEET } = await L('lib/schedule/print/xlsx.js');

const TRUNC_WARNING = 'נסרקו רק 2000 הזמנות ראשונות - ייתכן שחסרות שורות (schedule_max_scan_rows).';
const COUNTER_WARNING = 'לשלב 4 (הכנה) אין עדיין שדה "בוצע" במסד - המונה "בוצע" שלו לא זמין.';

test('complete payload -> no notices', () => {
  assert.deepEqual(printNotices({ meta: { truncated: false, warnings: [], skipped: [] }, pages: [] }), []);
  assert.deepEqual(printNotices(null), []);
});

test('truncated + warnings + skipped + PP-16 lateTruncated -> one notice each; the counter-only warning is not printed', () => {
  const n = printNotices({
    meta: { truncated: true, warnings: [COUNTER_WARNING, TRUNC_WARNING], skipped: [{ key: 'PP-01', label: 'דוח הזמנות כללי' }] },
    pages: [{ key: 'PP-16', def: { label: 'דף קבלת החזרות' }, data: { lateTruncated: true, lateMax: 150 } }],
  });
  assert.equal(n.length, 3, JSON.stringify(n));
  assert.match(n[0], /חלקית/);
  assert.match(n[0], /נסרקו רק 2000/);
  assert.match(n[1], /דוח הזמנות כללי/);
  assert.match(n[2], /150/);
  assert.ok(!n.some((x) => /המונה "בוצע"/.test(x)));
  // truncated without its warning text still yields a notice
  assert.equal(printNotices({ meta: { truncated: true, warnings: [] }, pages: [] }).length, 1);
});

test('Excel: notices become the first sheet "הערות"; none -> no extra sheet', () => {
  const sheets = [{ sheetName: 'רשימת אירועים', rows: [{ 'הזמנה': 1 }] }];
  const wb = buildScheduleWorkbook(XLSX, sheets, ['הרשימה עלולה להיות חלקית: x']);
  assert.deepEqual(wb.SheetNames, [NOTICES_SHEET, 'רשימת אירועים']);
  assert.equal(wb.Sheets[NOTICES_SHEET].A1.v, 'שימו לב');
  assert.equal(wb.Sheets[NOTICES_SHEET].A2.v, 'הרשימה עלולה להיות חלקית: x');
  assert.deepEqual(buildScheduleWorkbook(XLSX, sheets).SheetNames, ['רשימת אירועים']);
});

// PrintShell is JSX: rendered in a child process with the render hooks (register-render.mjs), like render.mjs
test('PrintShell renders the banner above the sheets (and nothing when complete)', () => {
  const script = `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { pathToFileURL } from 'node:url';
    const { PrintDocument } = await import(pathToFileURL(process.env.PROJ + '/app/components/schedule/print/PrintShell.js').href);
    const meta = { date: '2026-10-01', gmach: { name: 'ג' }, truncated: true, warnings: [${JSON.stringify(TRUNC_WARNING)}], skipped: [] };
    const a = renderToStaticMarkup(React.createElement(PrintDocument, { payload: { meta, pages: [] } }));
    const b = renderToStaticMarkup(React.createElement(PrintDocument, { payload: { meta: { ...meta, truncated: false, warnings: [] }, pages: [] } }));
    console.log(JSON.stringify({ a, b }));`;
  const r = spawnSync(process.execPath, ['--no-warnings', '--import', pathToFileURL(path.join(process.env.PROJ, 'scripts/schedule-print-tests/register-render.mjs')).href, '--input-type=module', '-e', script], { cwd: process.env.PROJ, encoding: 'utf8', env: process.env });
  assert.equal(r.status, 0, r.stderr);
  const { a, b } = JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  assert.match(a, /class="pp-notices"/);
  assert.match(a, /נסרקו רק 2000/);
  assert.ok(a.indexOf('pp-notices') < a.indexOf('pp-paper') + 200, 'banner sits at the top of the paper');
  assert.ok(!b.includes('pp-notices'));
});
