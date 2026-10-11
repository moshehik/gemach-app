// שער סטטי נגד סטייה של כותרת הדפים: כל דף רשימה חדש בונה את הכותרת / החיפוש / הכרטיס דרך A5ListPage (ערכת a5-list) ולא ידנית, והמילה בכותרת ה-<small> אחת ("ניהול").
// ממדי הכותרת עצמם נמדדו בדפדפן (docs/a5-staff-models/*-fidelity.md). הרצה: node scripts/test_a5_list_header.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const PAGES = [
  'app/components/employees-list/EmployeesListA5.js', 'app/components/models-list/ModelsListA5.js', 'app/components/orders-list/OrdersListA5.js',
  'app/components/customers-list/CustomersListA5.js', 'app/components/email-logs/EmailLogsA5.js', 'app/components/departments/DepartmentsA5.js',
];
// כל קובץ בתיקיות הרשימות הנוספות (היסטוריות) שמצייר A5List
for (const dir of ['app/components/history-lists']) {
  try { for (const f of readdirSync(new URL(`../${dir}`, import.meta.url))) if (/\.js$/.test(f) && /<A5List\b/.test(read(`${dir}/${f}`))) PAGES.push(`${dir}/${f}`); } catch { /* התיקייה לא קיימת */ }
}

t('כל דף רשימה משתמש ב-<A5ListPage> ואין בו topbar / card-h / A5SearchSlot בכתיבה ידנית', () => {
  for (const p of PAGES) {
    const s = strip(read(p));
    assert.match(s, /<A5ListPage\b/, `${p}: חסר A5ListPage`);
    assert.ok(!/className="topbar"/.test(s), `${p}: topbar ידני`);
    assert.ok(!/className="card-h"/.test(s), `${p}: card-h ידני`);
    assert.ok(!/<A5SearchSlot\b/.test(s), `${p}: משבצת חיפוש ידנית`);
    assert.ok(!/className="layout one"/.test(s), `${p}: layout ידני`);
  }
});
t('מילת ה-<small> אחת: אף דף לא מעביר small= משלו (ברירת המחדל "ניהול" בערכה)', () => {
  assert.match(read('app/components/a5-list/A5ListPage.js'), /small = 'ניהול'/);
  for (const p of PAGES) assert.ok(!/<A5ListPage[^>]*\bsmall=/.test(strip(read(p)).replace(/\n/g, ' ')), `${p}: small= מותאם`);
});
t('לשוניות: רק דרך A5Tabs (בתוך .main לפני הכרטיס); אין nav.tabs ידני', () => {
  const kit = read('app/components/a5-list/A5ListPage.js');
  assert.match(kit, /<main className="main">\s*\{tabs\}\s*<section/);
  for (const p of PAGES) assert.ok(!/<nav className="tabs"/.test(strip(read(p))), `${p}: nav.tabs ידני`);
});
t('מתג "ישן / חדש" רק דרך tools של הערכה (placement="header") - מקום אחד בכותרת', () => {
  for (const p of PAGES) {
    const s = strip(read(p));
    for (const m of s.matchAll(/<PageVariantToggle\b[^>]*>/g)) assert.match(m[0], /placement="header"/, p);
    if (/<PageVariantToggle/.test(s)) assert.match(s, /tools=\{<PageVariantToggle/, `${p}: המתג לא ב-tools`);
  }
});
t('כותרת הכרטיס: גובה מינימום 68px בכללי הערכה (דף בלי לחצן פעולה לא מזיז את סרגל התוצאות)', () => {
  assert.match(read('app/components/a5-list/a5-page.css'), /\.card\.hist>\.card-h\{min-height:68px/);
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
