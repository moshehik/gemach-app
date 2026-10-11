// בדיקת יחידה לניהול המחלקות החדש (/admin/departments): המרת שורה, חסימת מחיקה (תפקידי מערכת / עובדים משויכים - מסונכרן עם השרת), בדיקות טפסי יצירה / שינוי שם,
// סינון / מיון / זוגות שורה 2, גיליון ההדפסה "מחלקות ועובדים", ורישום המשטח + חוזה סטטי (בלי window.confirm/alert, הדף הישן קפוא, שערי ה-API לא שונו). אין DB / דפדפן / רשת.
// הרצה: node scripts/test_a5_departments.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../app/components/departments/departmentsLogic.js';
import { computeVisible, initialSelection } from '../app/components/a5-list/listLogic.js';
import { departmentsDoc } from '../app/components/a5-print/pkSpecsAdmin.js';
import { PRINT_DOCS } from '../app/components/a5-print/pkRegistry.js';
import { PDF_HTML_SURFACE_KEYS } from '../lib/printAccessKeys.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const raw = (roleId, name, n) => ({ id: `u${roleId}`, roleId, name, _count: { employees: n } });
const emps = [
  { id: 'a', firstName: 'שרה', lastName: 'כהן', roleId: 3, isActive: true },
  { id: 'b', firstName: 'דנה', lastName: 'לוי', roleId: 3, isActive: true },
  { id: 'c', fullName: 'משה ישן', roleId: 3, isActive: false },
  { id: 'd', firstName: 'רינה', lastName: 'אבני', roleId: 4, isActive: true },
];
const byRole = D.activeNamesByRole(emps);
const rows = [raw(0, 'הנהלה ראשית', 1), raw(1, 'הנהלה', 2), raw(2, 'מתכנת', 2), raw(3, 'תופרת', 3), raw(4, 'מזכירה', 1), raw(6, 'מסך לקוחות', 0)].map((d) => D.deptRow(d, byRole));

console.log('שורות');
t('activeNamesByRole: רק פעילים, ממוינים בעברית; deptRow: מונה כולל לא פעילים, "לא פעילים" = ההפרש', () => {
  assert.deepEqual(byRole.get(3), ['דנה לוי', 'שרה כהן']);
  const r = rows.find((x) => x.roleId === 3);
  assert.equal(r.employees, 3); assert.equal(r.inactive, 1); assert.equal(r.namesKnown, true);
  assert.equal(r.id, 3);
});
t('רשימת העובדים עוד לא נטענה (null): בלי שמות ובלי "לא פעילים" שגוי', () => {
  const r = D.deptRow(raw(3, 'תופרת', 3), null);
  assert.equal(r.namesKnown, false); assert.equal(r.inactive, 0); assert.deepEqual(r.names, []); assert.equal(r.employees, 3);
});
t('תפקידי מערכת 1 / 2 בלבד - מסונכרן עם השרת (SYSTEM_ROLE_IDS)', () => {
  assert.deepEqual([...D.SYSTEM_ROLE_IDS], [1, 2]);
  const m = strip(read('../app/api/departments/[roleId]/route.js')).match(/const SYSTEM_ROLE_IDS = \[([^\]]*)\]/);
  assert.deepEqual(m[1].split(',').map((x) => Number(x.trim())), [1, 2]);
  assert.deepEqual(rows.filter((r) => r.system).map((r) => r.roleId), [1, 2]);
});
t('deleteBlock: מערכת > עובדים > אפשר; ההודעות כמו בשרת', () => {
  assert.equal(D.deleteBlock(rows[1]), 'system'); assert.equal(D.deleteBlock(rows.find((r) => r.roleId === 3)), 'employees'); assert.equal(D.deleteBlock(rows.find((r) => r.roleId === 6)), null);
  const route = read('../app/api/departments/[roleId]/route.js');
  assert.ok(route.includes('לא ניתן למחוק מחלקה זו: זהו תפקיד מערכת (מנהל/מתכנת) שמנגנון ההרשאות מסתמך עליו'));
  assert.ok(route.includes('לא ניתן למחוק את המחלקה "${existing.name}": משויכים אליה ${employeeCount} עובדים. יש להעביר אותם למחלקה אחרת בכרטיס העובד ולנסות שוב.'));
  assert.equal(D.deleteBlockedMessage(rows[1]), 'לא ניתן למחוק מחלקה זו: זהו תפקיד מערכת (מנהל/מתכנת) שמנגנון ההרשאות מסתמך עליו');
  assert.equal(D.deleteBlockedMessage(rows.find((r) => r.roleId === 3)), 'לא ניתן למחוק את המחלקה "תופרת": משויכים אליה 3 עובדים. יש להעביר אותם למחלקה אחרת בכרטיס העובד ולנסות שוב.');
});

console.log('טפסים');
t('nextRoleId: הגדול + 1 (כמו הדף הישן), רשימה ריקה = 0', () => { assert.equal(D.nextRoleId(rows), 7); assert.equal(D.nextRoleId([]), 0); });
t('validateCreate: שם חובה, מספר שלם 0 ומעלה (אותן הודעות כמו השרת)', () => {
  assert.deepEqual(D.validateCreate({ roleId: '7', name: '  מחסן ' }), { ok: true, name: 'מחסן', roleId: 7 });
  assert.equal(D.validateCreate({ roleId: '7', name: '  ' }).error, 'חובה להזין שם מחלקה');
  for (const bad of ['', '-1', '1.5', 'a', '1e3']) assert.equal(D.validateCreate({ roleId: bad, name: 'x' }).error, 'חובה להזין מספר מחלקה תקין (מספר שלם, 0 ומעלה)', bad);
  assert.equal(D.validateCreate({ roleId: '0', name: 'x' }).ok, true);
  assert.equal(D.validateRename(' ').ok, false); assert.equal(D.validateRename(' א ').name, 'א');
  const post = read('../app/api/departments/route.js');
  assert.ok(post.includes('חובה להזין שם מחלקה') && post.includes('חובה להזין מספר מחלקה תקין (מספר שלם, 0 ומעלה)'));
});

console.log('סינון / מיון / שורה');
const sel = (o) => ({ ...initialSelection(D.FILTERS), ...o });
const vis = (s, q = '', sort = D.DEFAULT_SORT) => computeVisible({ items: rows, words: q ? [q] : [], hay: D.hayOf, filters: D.FILTERS, sel: sel(s), sorts: D.SORTS, sort, localSearch: true }).map((r) => r.roleId);
t('סינון: סוג (מערכת / רגילה), עובדים (עם / בלי); OR בתוך קבוצה, AND בין קבוצות', () => {
  assert.deepEqual(vis({ kind: ['system'] }), [1, 2]);
  assert.deepEqual(vis({ staff: ['none'] }), [6]);
  assert.deepEqual(vis({ kind: ['regular'], staff: ['has'] }), [0, 3, 4]);
  assert.deepEqual(vis({ kind: ['system', 'regular'] }), [0, 1, 2, 3, 4, 6]);
});
t('חיפוש בשם ובמספר; מיון לפי מספר (ברירת מחדל), שם, עובדים, סוג', () => {
  assert.deepEqual(vis({}, 'תופר'), [3]); assert.deepEqual(vis({}, '6'), [6]);
  assert.deepEqual(vis({}, '', { k: 'employees', dir: -1 }).slice(0, 2), [3, 2]);
  assert.deepEqual(vis({}, '', { k: 'type', dir: 1 }).slice(0, 2), [1, 2]);
  assert.deepEqual(vis({}, '', { k: 'roleId', dir: -1 })[0], 6);
  assert.deepEqual(D.DEFAULT_SORT, { k: 'roleId', dir: 1 });
});
t('deptPairs: מספר תמיד; עובדים רק כשיש; "תפקיד מערכת" רק כשכן (אפס לא מוצג)', () => {
  assert.deepEqual(D.deptPairs(rows.find((r) => r.roleId === 6)).map((p) => p.key), ['num']);
  assert.deepEqual(D.deptPairs(rows[1]).map((p) => p.key), ['num', 'emp', 'sys']);
  assert.deepEqual(D.deptPairs(rows.find((r) => r.roleId === 0)).map((p) => p.key), ['num', 'emp']);
});
t('Excel: מספר, שם, עובדים, סוג, פעילים', () => {
  const x = D.departmentsExcelRows(rows);
  assert.equal(x.head.length, 5); assert.deepEqual(x.rows[3], [3, 'תופרת', 3, 'מחלקה רגילה', 'דנה לוי, שרה כהן']);
});

console.log('הדפסה');
t('departmentsDoc: שורה למחלקה; "+N לא פעילים" רק כשיש; בלי עובדים = מקף; הספירות פעם אחת בכותרת; ריק = empty; סינון בכותרת רק כשיש', () => {
  const d = departmentsDoc({ rows, state: { sel: {}, q: '' }, filters: D.FILTERS });
  assert.equal(d.kind, 'flow'); assert.equal(d.atoms.length, rows.length); assert.equal(d.head.sum, '6 מחלקות · 9 עובדים'); assert.equal(d.head.sub, '');
  const tr = d.atoms[3].html;
  assert.ok(tr.includes('דנה לוי') && tr.includes('(+1 לא פעילים)'));
  assert.ok(d.atoms[5].html.includes('pk-dim'));
  assert.ok(!d.atoms[4].html.includes('לא פעילים'));
  const f = departmentsDoc({ rows: rows.slice(0, 1), state: { sel: { kind: ['system'] }, q: 'ה' }, filters: D.FILTERS });
  assert.equal(f.head.sub, 'תפקיד מערכת · חיפוש: ״ה״'); assert.equal(f.head.sum, 'מחלקה אחת · עובד אחד');
  assert.ok(departmentsDoc({ rows: [] }).empty);
  assert.match(departmentsDoc({ rows: [D.deptRow(raw(3, 'תופרת', 3), null)] }).atoms[0].html, /3 עובדים/);
});
t('הרישום: המסמך והמשטח ידועים לשרת', () => {
  assert.equal(PRINT_DOCS['departments-employees'].build, departmentsDoc);
  assert.deepEqual(PDF_HTML_SURFACE_KEYS[PRINT_DOCS['departments-employees'].surface], ['page:admin']);
});

console.log('חוזה סטטי');
t('הרכיב החדש: בלי window.confirm/alert/prompt/customConfirm; חלונות כהים (Dlg / a5.confirm); מתג המסך; כותרת מהערכה', () => {
  const s = strip(read('../app/components/departments/DepartmentsA5.js'));
  assert.ok(!/window\.(confirm|alert|prompt)|customConfirm|\balert\(/.test(s));
  assert.match(s, /<Dlg labelledBy="dpt-form-t"/); assert.match(s, /a5\.confirm\(/);
  assert.match(s, /<PageVariantToggle screen="departments" placement="header" systemTip \/>/);
  assert.match(s, /<A5ListPage/); assert.ok(!/className="topbar"/.test(s), 'כותרת אחידה מהערכה, לא ידנית');
});
t('Switch + דף דק; ה-API של המחלקות לא שונה (שערים: GET כל מחובר, כתיבה הנהלה ראשית)', () => {
  const sw = read('../app/components/departments/DepartmentsSwitch.js');
  assert.match(sw, /<VariantFrame screen="departments" variant="legacy"><LegacyDepartmentsPage \/><\/VariantFrame>/);
  assert.match(sw, /<VariantFrame screen="departments" variant="a5"><DepartmentsA5 \/><\/VariantFrame>/);
  const page = read('../app/admin/departments/page.js');
  assert.match(page, /DepartmentsSwitch/);
  const api = strip(read('../app/api/departments/route.js'));
  assert.match(api, /export async function GET\(\) \{\s*if \(!\(await checkAuth\(\)\)\)/);
  assert.match(api, /export async function POST\(request\) \{\s*if \(!\(await checkAuth\('הנהלה ראשית'\)\)\)/);
  const one = strip(read('../app/api/departments/[roleId]/route.js'));
  assert.equal([...one.matchAll(/checkAuth\('הנהלה ראשית'\)/g)].length, 2);
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
