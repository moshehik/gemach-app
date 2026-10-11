// שומר חלונות צפות (2026-10-11, owner: "כל החלוניות הצפות כהות ומעוצבות בהתאם לתכנית"): בדיקה סטטית על קוד המסכים החדשים
// (רשימת עובדים / דגמים, כרטיס דגם, אשף דגם חדש, ערכת a5-list) ועל StatisticsModal המשותף:
//   1. אין window.alert / confirm / prompt / customConfirm / customAuthPrompt ואין lucide ב-StatisticsModal.
//   2. StatisticsModal נרנדר בשורש כהה (.gm-ds .dlg-dark, מסגרת #scrim/#dlg של הפלטה) - לא ב-.modal-backdrop / .modal הבהירים - ומקבל את אותו API (isOpen, onClose, contextQuery, pageContext, position).
//   3. הקבצים הבאים של החלונות משתמשים בטוקני --k-* ולא בכחול קבוע על כחול: statistics-modal.css (אין color: navy), ושורות .hv-r בחלון פרטי פריט.
// הרצה: node scripts/test_a5_floating_windows.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const walk = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap((f) => {
  const rel = `${dir}/${f}`;
  return statSync(new URL(`../${rel}`, import.meta.url)).isDirectory() ? walk(rel) : [rel];
});
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const NEW_DIRS = ['app/components/a5-list', 'app/components/a5-print', 'app/components/dress-card', 'app/components/employees-list', 'app/components/models-list', 'app/components/email-logs', 'app/components/departments'];
const NEW_FILES = [...NEW_DIRS.flatMap(walk), ...walk('app/components/dress-new').filter((f) => !/LegacyNewDressPage/.test(f))].filter((f) => /\.js$/.test(f));

console.log('אין חלונות מערכת בדפדפן');
t('אין alert / confirm / prompt / customConfirm / customAuthPrompt בקוד המסכים החדשים', () => {
  const re = /(^|[^.\w$])(alert|confirm|prompt)\(|window\.(alert|confirm|prompt|customConfirm|customAlert|customPrompt|customAuthPrompt)\b|customConfirm\(|customAuthPrompt\(/;
  const bad = NEW_FILES.filter((f) => re.test(stripComments(read(f))));
  assert.deepEqual(bad, [], `קבצים עם חלון דפדפן: ${bad.join(', ')}`);
});

console.log('StatisticsModal (משותף)');
const SM = stripComments(read('app/components/StatisticsModal.js'));
t('אותו API: isOpen / onClose / contextQuery / pageContext / position', () => {
  assert.match(SM, /export default function StatisticsModal\(\{ isOpen, onClose, contextQuery, pageContext, position \}\)/);
});
t('שורש כהה: .gm-ds + dlg-dark + DialogFrame (#scrim/#dlg), ב-portal ל-body', () => {
  assert.match(SM, /gm-ds gm-no dlg-dark/);
  assert.match(SM, /<DialogFrame layer=\{1\}/);
  assert.match(SM, /createPortal\(content, document\.body\)/);
});
t('בלי המודאל הבהיר הישן (.modal-backdrop / .modal / .modal-head / lucide)', () => {
  assert.doesNotMatch(SM, /modal-backdrop|className="modal|modal-head|modal-body|modal-foot|from 'lucide-react'/);
});
t('אישור המחיקה והודעת השגיאה = חלונות כהים בשכבה 2 (ConfirmDialog / MessageDialog), לא customConfirm / alert', () => {
  assert.match(SM, /<ConfirmDialog /);
  assert.match(SM, /<MessageDialog /);
  assert.match(SM, /<DialogFrame layer=\{2\}/);
  assert.doesNotMatch(SM, /customConfirm|\balert\(/);
});
t('Escape סוגר קודם את שכבה 2 ואז את החלון', () => {
  assert.match(SM, /if \(confirmClear\) setConfirmClear\(false\); else if \(notice\) setNotice\(null\); else onClose\(\)/);
});

console.log('CSS של החלונות');
const CSS = read('app/components/statistics-modal.css');
t('statistics-modal.css: מוגבל ל-.gm-ds.stm-root, צבעים מטוקני --k-* (בלי כחול קבוע על כהה)', () => {
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.trim()).filter(Boolean);
  const unscoped = rules.filter((r) => !/^@/.test(r) && !/^\s*(from|to|\d+%)/.test(r) && !/\.gm-ds\.stm-root/.test(r.split('{')[0]) && !/^\s*0%|^\s*40%/.test(r));
  assert.deepEqual(unscoped.map((r) => r.split('{')[0].trim()), [], 'סלקטור ללא .gm-ds.stm-root');
  assert.doesNotMatch(CSS.replace(/\/\*[\s\S]*?\*\//g, ''), /color:\s*(var\(--(gm-)?navy[^)]*\)|#0f2c52|#0a2242)\s*[;}]/i, 'טקסט כחול קבוע');
});
const DCSS = read('app/components/dress-card/css/dress-card.css');
t('dress-card.css: חלון פרטי פריט וברקוד מקבלים טוקני --k-* בחלון כהה', () => {
  assert.match(DCSS, /\.gm-ds\.gm-dc\.dlg-dark :is\(#dlg,#dlg2\) \.hv-r b\{color:var\(--k-ink\)\}/);
  assert.match(DCSS, /\.gm-ds\.gm-dc\.dlg-dark :is\(#dlg,#dlg2\) \.dc-barc\{color:var\(--k-ink\)\}/);
});

console.log(`\n${passed} passed`);
