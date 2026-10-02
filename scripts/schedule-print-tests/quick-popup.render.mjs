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
  assert.ok(h.includes('הדפסה והורדה · הכנה'));
  assert.ok(h.includes('הדפס (') && h.includes('הורד PDF (') && h.includes('הורד Excel ('));
});

ok('quick popup always offers print + PDF + Excel; the opener is highlighted', () => {
  const h = html({ quick: true, initialTab: 'dout', mode: 'download', format: 'pdf', canExport: true });
  assert.ok(h.includes('הדפס (') && h.includes('הורד PDF (') && h.includes('הורד Excel ('));
  assert.ok(!h.includes('aria-label="סוג הקובץ"'));
  assert.match(h, /class="btn lg primary"[^>]*>(?:(?!<\/button>).)*הורד PDF/);
});

ok('quick popup without export right = print + PDF only', () => {
  const h = html({ quick: true, initialTab: 'dout', mode: 'print', canExport: false });
  assert.ok(h.includes('הדפס (') && h.includes('הורד PDF ('));
  assert.ok(!h.includes('הורד Excel ('));
});

ok('quick without a valid stage falls back to the full wizard', () => {
  const h = html({ quick: true, initialTab: null, mode: 'print' });
  assert.ok(h.includes('role="tablist"'));
  assert.ok(!h.includes('lz-quick'));
});

ok('full wizard unchanged: tabs, mode switch, preview pane, all-day button', () => {
  const h = html({ mode: 'print' });
  assert.ok(h.includes('role="tablist"'));
  assert.ok(h.includes('aria-label="סוג הפעולה"'));
  assert.ok(h.includes('lz-wp'));
  assert.ok(h.includes('הדפס את כל דפי היום'));
  assert.ok(!h.includes('lz-quick'));
});

ok('ScheduleDay: header buttons (no stageKey) open the full wizard, section buttons the quick popup', () => {
  const src = fs.readFileSync(path.join(PROJ, 'app/components/schedule/ScheduleDay.js'), 'utf8');
  assert.equal((src.match(/quick: !!stageKey/g) || []).length, 3);
  assert.ok(src.includes('quick={!!wiz.quick}'));
});

console.log(`quick-popup: ${n} passed`);
