// employeesLogic.js - הלוגיקה הטהורה של רשימת העובדים החדשה (נבדקת ב-scripts/test_a5_employees_list.mjs): המרת שורת /api/employees
// + נוכחות (/api/employees/presence) לשורת הרשימה, מחלקות ואייקונים, וניסוח "מחובר / במשמרת". בלי React ובלי imports עם alias.

/** קוד העובד המוצג (שורת "קוד עובד" בישן): legacyId, אחרת 5 התווים הראשונים של המזהה - לעולם לא UUID מלא. */
export function employeeCode(e) {
  if (e && e.legacyId != null && e.legacyId !== '') return String(e.legacyId);
  return String((e && e.id) || '').slice(0, 5);
}

/** שם מלא להצגה: שם פרטי + משפחה (כמו הרשימה הישנה), ובהיעדרם fullName. */
export function employeeFullName(e) {
  const n = `${(e && e.firstName) || ''} ${(e && e.lastName) || ''}`.trim();
  return n || (e && e.fullName) || '';
}

/** מפה roleId -> שם מחלקה (מתוך הרשימה המלאה), לשורות שחזרו בלי department (תוצאות חיפוש AI). */
export function deptNamesByRole(list) {
  const m = new Map();
  (list || []).forEach((e) => { if (e && e.department && e.roleId != null && e.department.name) m.set(e.roleId, e.department.name); });
  return m;
}

/** שם המחלקה: department.name; אחרת לפי roleId מהמפה; אחרת "מחלקה N" (כמו הישן שהציג את roleId); בלי כלום - "ללא מחלקה". */
export function employeeDeptName(e, byRole) {
  if (e && e.department && e.department.name) return e.department.name;
  if (e && e.roleId != null && e.roleId !== '') return (byRole && byRole.get(e.roleId)) || `מחלקה ${e.roleId}`;
  return 'ללא מחלקה';
}

/** אייקון המחלקה לפי מילות מפתח בשם (הפלטה: shield / note / dress / scissors / store / truck / gear / users); ברירת מחדל building. */
export function deptIcon(name) {
  const n = String(name || '');
  if (/הנהל/.test(n)) return 'shield';
  if (/מזכיר|משרד/.test(n)) return 'note';
  if (/תופר|תפיר|תיקון/.test(n)) return 'scissors';
  if (/מכיר|השכר/.test(n)) return 'dress';
  if (/מחסן/.test(n)) return 'store';
  if (/משלוח|שליח/.test(n)) return 'truck';
  if (/מתכנת/.test(n)) return 'gear';
  if (/לקוח/.test(n)) return 'users';
  return 'building';
}

/** "3:42" (שעות:דקות) ממספר דקות. */
export function shiftText(minutes) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** מייל תקין להצגה: חייב חלק לפני ה-@ (בנתונים מ-Access נשמרו הרבה ערכים של "@gmail.com" בלבד - מוסתרים). */
export function displayEmail(email) {
  const v = String(email || '').trim();
  return /^[^@s]+@[^@s]+.[^@s]+$/.test(v) ? v : '';
}

/** שורת הרשימה מ-Employee (+ נוכחות לפי employeeId). */
export function employeeRow(e, presence, byRole) {
  const p = (presence && presence[e.id]) || null;
  const dept = employeeDeptName(e, byRole);
  const last = p && p.lastEntry ? p.lastEntry : null;
  return {
    id: e.id,
    code: employeeCode(e),
    full: employeeFullName(e),
    dept,
    roleId: e.roleId == null || e.roleId === '' ? null : Number(e.roleId), // סדר קבוצות המחלקות בהדפסה (a5-print/pkSpecs.js deptOrder)
    phone: e.phone1 || '',
    email: displayEmail(e.email),
    active: e.isActive === undefined ? true : !!e.isActive,
    pwd: !!e.needsPasswordReset,
    conn: !!(p && p.connected),
    shiftMin: p && p.connected ? p.shiftMinutes : null,
    last,
    ts: last || '',
    site: p && p.lastSite ? p.lastSite : null, // החיבור האחרון לאתר (לא כניסה למשמרת)
  };
}

/** אפשרויות קבוצת "מחלקה": מחלקה לכל שם שמופיע בנתונים (לפי שם), עם אייקון. */
export function deptOptions(rows) {
  const names = [...new Set(rows.map((r) => r.dept))].sort((a, b) => a.localeCompare(b, 'he'));
  return names.map((name) => ({ k: `d:${name}`, l: name, i: deptIcon(name), test: (r) => r.dept === name }));
}

export const STATUS_OPTIONS = [
  { k: 'active', l: 'פעילים', i: 'userck', test: (r) => r.active },
  { k: 'inactive', l: 'לא פעילים', i: 'ban', test: (r) => !r.active },
  { k: 'conn', l: 'מחוברים עכשיו', i: 'online', test: (r) => r.conn },
  { k: 'pwd', l: 'נדרש עדכון סיסמה', i: 'key', test: (r) => r.pwd },
];

/** הטקסט לחיפוש (hay): שם, טלפון, מייל, קוד, מחלקה. */
export const employeeHay = (r) => [r.full, r.phone, r.email, r.code, r.dept].join(' ');
