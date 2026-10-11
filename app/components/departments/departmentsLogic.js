// departmentsLogic.js - הלוגיקה הטהורה של ניהול המחלקות החדש (/admin/departments), נבדקת ב-scripts/test_a5_departments.mjs.
// בלי React ובלי alias: המרת שורת /api/departments (+ העובדים הפעילים מ-/api/employees?slim=1) לשורת הרשימה, אפשרויות סינון / מיון, "זוגות" שורה 2
// (אפס / ריק לא מוצג), בדיקות קלט של טפסי יצירה / שינוי שם (אותם כללים כמו השרת - השרת נשאר הסמכות), וגיליון Excel.
import { deptIcon } from '../employees-list/employeesLogic.js';

export { deptIcon };

// roleId 1 (מנהל) ו-2 (מתכנת) הם תפקידי מערכת: מנגנון ההרשאות (lib/auth.js ROLE_LEVELS) מסתמך עליהם, והשרת חוסם את מחיקתם
// (app/api/departments/[roleId]/route.js SYSTEM_ROLE_IDS - בדיקת סנכרון ב-scripts/test_a5_departments.mjs). כאן רק משקפים זאת בממשק.
export const SYSTEM_ROLE_IDS = Object.freeze([1, 2]);
export const isSystemRole = (roleId) => SYSTEM_ROLE_IDS.includes(roleId);

export const SHEET_TITLE = 'מחלקות ועובדים';

/** שם עובד להצגה (fullName, אחרת פרטי + משפחה). */
export const employeeName = (e) => String((e && (e.fullName || `${e.firstName || ''} ${e.lastName || ''}`)) || '').trim();

/** מפה roleId -> שמות העובדים הפעילים (ממוינים בעברית), מרשימת /api/employees?slim=1 (פעילים בלבד). */
export function activeNamesByRole(employees) {
  const m = new Map();
  (employees || []).forEach((e) => {
    if (!e || e.isActive === false || e.roleId == null) return;
    const n = employeeName(e);
    if (!n) return;
    if (!m.has(e.roleId)) m.set(e.roleId, []);
    m.get(e.roleId).push(n);
  });
  m.forEach((arr) => arr.sort((a, b) => a.localeCompare(b, 'he')));
  return m;
}

/**
 * שורת רשימה ממחלקה של השרת: { id: roleId, roleId, name, employees (כל המשויכים, כולל לא פעילים - כמו חסימת המחיקה בשרת), names (הפעילים), namesKnown, inactive, system }.
 */
export function deptRow(d, byRole = new Map()) {
  const count = Number(d && d._count && d._count.employees) || 0;
  const known = byRole instanceof Map; // null = רשימת העובדים עוד לא נטענה (או נכשלה): בלי שמות ובלי "לא פעילים"
  const names = known ? (byRole.get(d.roleId) || []).slice() : [];
  return {
    id: d.roleId, roleId: d.roleId, name: String(d.name || ''), employees: count, names, namesKnown: known,
    inactive: known ? Math.max(0, count - names.length) : 0, system: isSystemRole(d.roleId),
  };
}

/** מה חוסם מחיקה (אותם כללים כמו השרת): 'system' | 'employees' | null. השרת נשאר הסמכות - ההודעה האמיתית מגיעה ממנו אם המצב השתנה. */
export function deleteBlock(r) {
  if (r.system) return 'system';
  if (r.employees > 0) return 'employees';
  return null;
}
export const DELETE_TIPS = Object.freeze({
  system: 'תפקיד מערכת - לא ניתן למחיקה',
  employees: 'יש עובדים משויכים - המחיקה תיחסם',
  none: 'מחיקת המחלקה',
});
/** ההודעה כשמנסים למחוק מחלקה חסומה (אותו נוסח כמו השרת). */
export function deleteBlockedMessage(r) {
  if (r.system) return 'לא ניתן למחוק מחלקה זו: זהו תפקיד מערכת (מנהל/מתכנת) שמנגנון ההרשאות מסתמך עליו';
  return `לא ניתן למחוק את המחלקה "${r.name}": משויכים אליה ${r.employees} עובדים. יש להעביר אותם למחלקה אחרת בכרטיס העובד ולנסות שוב.`;
}

/** ברירת המחדל למספר מחלקה חדשה: הגדול ביותר + 1 (כמו הדף הישן). */
export const nextRoleId = (rows) => (rows || []).reduce((max, d) => Math.max(max, d.roleId), -1) + 1;

/** בדיקת קלט של טופס "מחלקה חדשה": { ok, name, roleId, error }. */
export function validateCreate({ roleId, name }) {
  const n = String(name || '').trim();
  if (!n) return { ok: false, error: 'חובה להזין שם מחלקה' };
  const s = String(roleId == null ? '' : roleId).trim();
  const id = /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  if (!Number.isSafeInteger(id) || id < 0) return { ok: false, error: 'חובה להזין מספר מחלקה תקין (מספר שלם, 0 ומעלה)' };
  return { ok: true, name: n, roleId: id };
}
/** בדיקת קלט של שינוי שם. */
export function validateRename(name) {
  const n = String(name || '').trim();
  return n ? { ok: true, name: n } : { ok: false, error: 'חובה להזין שם מחלקה' };
}

/* ------------------------------ סינון / מיון ------------------------------ */

export const FILTERS = [
  {
    key: 'kind', label: 'סוג מחלקה', icon: 'building', def: [],
    options: [
      { k: 'system', l: 'תפקיד מערכת', i: 'lock', test: (r) => r.system },
      { k: 'regular', l: 'מחלקה רגילה', i: 'building', test: (r) => !r.system },
    ],
  },
  {
    key: 'staff', label: 'עובדים', icon: 'users', def: [],
    options: [
      { k: 'has', l: 'עם עובדים', i: 'user', test: (r) => r.employees > 0 },
      { k: 'none', l: 'בלי עובדים', i: 'ban', test: (r) => r.employees === 0 },
    ],
  },
];

export const SORTS = [
  { k: 'name', l: 'שם מחלקה', i: 'building', get: (r) => r.name },
  { k: 'roleId', l: 'מספר מחלקה', i: 'hash', get: (r) => r.roleId },
  { k: 'employees', l: 'מספר עובדים', i: 'users', get: (r) => r.employees },
  { k: 'type', l: 'סוג', i: 'lock', get: (r) => (r.system ? 0 : 1) },
];
export const DEFAULT_SORT = Object.freeze({ k: 'roleId', dir: 1 }); // כמו הדף הישן: לפי מספר מחלקה

/** טקסט החיפוש: שם + מספר. */
export const hayOf = (r) => `${r.name} ${r.roleId}`;

/* ---------------------------------- שורה ---------------------------------- */

/** ה"זוגות" של שורה 2: מספר מחלקה, עובדים (רק כשיש), תפקיד מערכת (רק כשכן). */
export function deptPairs(r) {
  const out = [{ key: 'num', icon: 'hash', tip: 'מספר מחלקה', text: String(r.roleId), bdi: true }];
  if (r.employees > 0) out.push({ key: 'emp', icon: 'user', tip: r.employees === 1 ? 'עובד משויך' : 'עובדים משויכים', text: String(r.employees), bold: true });
  if (r.system) out.push({ key: 'sys', icon: 'lock', tip: 'תפקיד מערכת: מנגנון ההרשאות מזהה מנהלים ומתכנתים לפי המספר, ולכן אי אפשר למחוק', text: 'תפקיד מערכת' });
  return out;
}

/** שורות Excel: מספר, שם, כמה עובדים, סוג, העובדים הפעילים. */
export function departmentsExcelRows(rows) {
  return {
    head: ['מספר מחלקה', 'שם מחלקה', 'עובדים', 'סוג', 'עובדים פעילים'],
    rows: (rows || []).map((r) => [r.roleId, r.name, r.employees, r.system ? 'תפקיד מערכת' : 'מחלקה רגילה', r.names.join(', ')]),
  };
}
