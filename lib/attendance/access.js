// lib/attendance/access.js — מי רשאי לראות / לערוך נוכחות של מי (טהור, בלי DB - נבדק ב-scripts/test_attendance_summary.mjs).
//
// מודל ההרשאות (זהה לשאר האתר, בלי תפקיד חדש):
//   "מנהל נוכחות" = מי שעובר את השער של /employees היום: checkPageAccess(HEAD_MANAGEMENT_ROLES) - הנהלה ראשית (0) ומתכנת (2),
//   וגם אורח כשחובת ההתחברות כבויה (מצב פתוח, כמו הדפים עצמם). מנהלת סניף (1) - לא (החלטת הבעלים AT-09, כמו היום).
//   עובד רגיל (כל מי שמחובר ואינו "מנהל נוכחות") - רק את הנוכחות של עצמו (AT-10 / AT-12 / AT-13), בלי שכר ובלי Excel.
//   מזהה העובד של "עצמו" נלקח תמיד מהעוגייה המאומתת בשרת (getSessionEmployee) - לעולם לא ממזהה שהלקוח שלח.

/** תוצאה: { ok:true, employeeId, wages } או { ok:false, status, error } */
export function decideReadAccess({ isManager, sessionEmployeeId, requestedEmployeeId, scope }) {
  if (scope === 'month') {
    // טבלת כל העובדים (שכר + שעות של כולם) - כמו GET /api/employees/attendance
    return isManager ? { ok: true, employeeId: null, wages: true } : { ok: false, status: sessionEmployeeId ? 403 : 401, error: 'אין הרשאה' };
  }
  if (isManager) {
    const id = requestedEmployeeId || sessionEmployeeId || null;
    if (!id) return { ok: false, status: 400, error: 'חסר עובד' };
    return { ok: true, employeeId: id, wages: true };
  }
  if (!sessionEmployeeId) return { ok: false, status: 401, error: 'יש להתחבר' };
  if (requestedEmployeeId && requestedEmployeeId !== sessionEmployeeId) return { ok: false, status: 403, error: 'אין הרשאה לנוכחות של עובד אחר' };
  return { ok: true, employeeId: sessionEmployeeId, wages: false };
}

/**
 * הוספה / עריכה / מחיקה / שחזור של משמרת (POST /api/employees/<id>/shifts, PUT/DELETE .../shifts/<shiftId>).
 *   routeEmployeeId - ה-id שבנתיב; shiftEmployeeId - בעל המשמרת לפי ה-DB (בעריכה/מחיקה; undefined בהוספה).
 * משמרת שאינה שייכת לעובד שבנתיב = 404 לכולם (גם למנהל) - אחרת עובד היה שולח את ה-id שלו בנתיב ואת המשמרת של אחר.
 * מחזיר { ok:true, wages } (wages=false: התשובה ללקוח בלי שכר) או { ok:false, status, error }.
 */
export function decideShiftWrite({ isManager, sessionEmployeeId, routeEmployeeId, shiftEmployeeId }) {
  if (!routeEmployeeId) return { ok: false, status: 400, error: 'Invalid Employee ID' };
  if (shiftEmployeeId !== undefined && shiftEmployeeId !== routeEmployeeId) return { ok: false, status: 404, error: 'Shift not found' };
  if (isManager) return { ok: true, wages: true };
  if (!sessionEmployeeId) return { ok: false, status: 401, error: 'Unauthorized' };
  if (sessionEmployeeId !== routeEmployeeId) return { ok: false, status: 403, error: 'אין הרשאה לערוך נוכחות של עובד אחר' };
  return { ok: true, wages: false };
}

const WAGE_KEYS = ['totalCalculated', 'hourlyWageSnapshot', 'travelExpensesSnapshot', 'paymentMethod'];
/** תשובת השרת לעובד רגיל - בלי שדות השכר של המשמרת */
export function stripWages(shift) {
  if (!shift || typeof shift !== 'object') return shift;
  const out = { ...shift };
  for (const k of WAGE_KEYS) delete out[k];
  return out;
}

/** ה-id של העובד בפרמטר: מחרוזת קצרה בלי תווים מוזרים (uuid / מספר ישן); אחרת null */
export function cleanEmployeeId(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null;
}
