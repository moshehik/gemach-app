// (רץ דרך quick-popup.test.mjs - ה-JSX דורש את register-render.mjs)
// חלונית מהירה של מקטע (quick) מול האשף המלא: רינדור סטטי של PrintWizard - בלי DB ובלי שרת.
//   החלונית: רק דפי השלב, בלי לשוניות / מתג מצב / תצוגה מקדימה / "כל דפי היום". האשף המלא: הכל, כמו קודם.
//   וגם: ScheduleDay מפעיל חלונית מהירה רק כשיש stageKey (לחצני המקטע) - לחצני הכותרת פותחים את האשף המלא.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(PROJ, 'package.json'));
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const { default: PrintWizard } = await import(pathToFileURL(path.join(PROJ, 'app/components/schedule/print/PrintWizard.js')).href);
const { PRINT_PAGES } = await import(pathToFileURL(path.join(PROJ, 'lib/schedule/print/registry.js')).href);

const base = { date: '2026-10-04', branch: '', stageData: null, onClose() {} };
const html = (props) => renderToStaticMarkup(React.createElement(PrintWizard, { ...base, ...props }));

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('ok -', name); };

ok('quick prep: only the prep pages, no tabs / mode switch / preview / all-day button', () => {
  const h = html({ quick: true, initialTab: 'prep', mode: 'print' });
  const prep = PRINT_PAGES.filter((p) => p.stages[0] === 'prep');
  const other = PRINT_PAGES.filter((p) => p.stages[0] !== 'prep');
  assert.ok(prep.length >= 2);
  for (const p of prep) assert.ok(h.includes(p.label), 'missing ' + p.label);
  for (const p of other) assert.ok(!h.includes(p.label), 'leaked ' + p.label);
  assert.ok(h.includes('lz-quick'));
  assert.ok(!h.includes('role="tablist"'));
  assert.ok(!h.includes('aria-label="סוג הפעולה"'));
  assert.ok(!h.includes('lz-wp"'));
  assert.ok(!h.includes('הדפס את כל דפי היום'));
  assert.ok(h.includes('הדפסה · הכנה'));
  assert.ok(h.includes('הדפס נבחרים (') && !h.includes('הורד PDF (') && !h.includes('הורד Excel ('));
});

ok('quick popup: ONE action button, decided by the icon that opened it (print / PDF / Excel)', () => {
  const pr = html({ quick: true, initialTab: 'dout', mode: 'print', canExport: true });
  assert.ok(pr.includes('הדפס נבחרים (') && !pr.includes('הורד PDF (') && !pr.includes('הורד Excel ('));
  const pdf = html({ quick: true, initialTab: 'dout', mode: 'download', format: 'pdf', canExport: true });
  assert.ok(pdf.includes('הורד PDF (') && !pdf.includes('הדפס נבחרים (') && !pdf.includes('הורד Excel ('));
  assert.ok(pdf.includes('הורדת PDF · משלוח הלוך'));
  const xl = html({ quick: true, initialTab: 'dout', mode: 'download', format: 'xlsx', canExport: true });
  assert.ok(xl.includes('הורד Excel (') && !xl.includes('הורד PDF (') && !xl.includes('הדפס נבחרים ('));
  assert.ok(xl.includes('ייצוא Excel · משלוח הלוך'));
  for (const h of [pr, pdf, xl]) assert.ok(!h.includes('aria-label="סוג הקובץ"') && !h.includes('aria-label="סוג הפעולה"'));
});

ok('quick popup without export right: Excel request degrades to PDF only', () => {
  const h = html({ quick: true, initialTab: 'dout', mode: 'download', format: 'xlsx', canExport: false });
  assert.ok(h.includes('הורד PDF (') && !h.includes('הורד Excel ('));
  assert.ok(h.includes('הורדת PDF · משלוח הלוך'));
});

ok('quick without a valid stage falls back to the full wizard', () => {
  const h = html({ quick: true, initialTab: null, mode: 'print' });
  assert.ok(h.includes('lz-tree'));
  assert.ok(!h.includes('lz-quick'));
});

ok('full wizard: category tree (right) + preview pane (left), all-day button, NO print/download or Excel/PDF switches, NO tabs', () => {
  const h = html({ mode: 'print' });
  assert.ok(h.includes('lz-tree') && h.includes('lz-full'));
  assert.ok(h.includes('lz-wp'));
  assert.ok(h.includes('הדפס את כל דפי היום'));
  assert.ok(!h.includes('lz-quick'));
  assert.ok(!h.includes('role="tablist"') && !h.includes('role="tab"'));
  assert.ok(!h.includes('aria-label="סוג הפעולה"') && !h.includes('aria-label="סוג הקובץ"'));
  // כל קטגוריה היא לחצן עם aria-expanded + תיבת סימון משלה; כל דף - תיבת סימון משלו (מקורית, נגישה)
  const cats = new Set(PRINT_PAGES.map((p) => p.stages[0]));
  assert.equal((h.match(/class="lz-cat[ "]/g) || []).length, cats.size);
  assert.equal((h.match(/aria-expanded=/g) || []).length, cats.size);
  assert.equal((h.match(/class="lz-pg[ "]/g) || []).length, PRINT_PAGES.length);
  for (const p of PRINT_PAGES) assert.ok(h.includes(p.label), 'missing ' + p.label);
});

ok('full wizard: the action comes from the opener (title + go-button), Excel degrades to PDF without export right', () => {
  const pr = html({ mode: 'print' });
  assert.ok(pr.includes('הדפסה · דפי הלו״ז') && pr.includes('הדפס נבחרים ('));
  const pdf = html({ mode: 'download', format: 'pdf' });
  assert.ok(pdf.includes('הורדת PDF · דפי הלו״ז') && pdf.includes('הורד PDF (') && !pdf.includes('הורד Excel ('));
  const xl = html({ mode: 'download', format: 'xlsx' });
  assert.ok(xl.includes('ייצוא Excel · דפי הלו״ז') && xl.includes('הורד Excel (') && !xl.includes('הורד PDF ('));
  const noXl = html({ mode: 'download', format: 'xlsx', canExport: false });
  assert.ok(noXl.includes('הורד PDF (') && !noXl.includes('הורד Excel ('));
});

ok('ScheduleDay: header buttons (no stageKey) open the full wizard, section buttons the quick popup', () => {
  const src = fs.readFileSync(path.join(PROJ, 'app/components/schedule/ScheduleDay.js'), 'utf8');
  assert.equal((src.match(/quick: !!stageKey/g) || []).length, 3);
  assert.ok(src.includes('quick={!!wiz.quick}'));
  // הלחצן "הורדה" = PDF, לחצן ה-XL = Excel (האשף לא שואל שוב)
  assert.ok(src.includes("setWiz({ mode: 'download', format: 'pdf'"));
  assert.ok(src.includes("setWiz({ mode: 'download', format: 'xlsx'"));
});

console.log(`quick-popup: ${n} passed`);
