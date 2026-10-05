// עוזרים טהורים לכרטיס העובד (app/employees/[id]/page.js): קריאת תשובת שרת בלי להניח הצלחה,
// ניסוח סיבת הכישלון בעברית, וההחלטה מי רשאי לשנות סיסמה של מי (נקראת מ-
// app/api/employees/[id]/password/route.js). אין כאן גישה ל-DB / רשת / עוגיות - הכול נבדק ב-
// scripts/test_employee_card_save.mjs.
//
// הרקע: handleSave הציג "הפרטים נשמרו בהצלחה!" גם כשהשרת החזיר 403/500 (לא נבדק res.ok),
// ושינוי סיסמה בכרטיס של עובד אחר נדחה תמיד (הנתיב איפשר רק שינוי עצמי).

import { HEAD_MANAGEMENT_ROLES, canManageRoles } from './roles.js';

const HEBREW = /[\u0590-\u05FF]/;

// ברירות מחדל לפי קוד HTTP, כשהשרת לא החזיר הסבר בעברית (חלק מהנתיבים מחזירים
// 'Forbidden' / 'Internal Server Error' באנגלית - לא מציגים את זה למשתמש).
export function reasonForStatus(status) {
  if (status === 400) return 'הנתונים שהוזנו אינם תקינים';
  if (status === 401) return 'פג תוקף ההתחברות - יש להתחבר מחדש';
  if (status === 403) return 'אין הרשאה לבצע את הפעולה';
  if (status === 404) return 'הרשומה לא נמצאה';
  if (status === 409) return 'הרשומה השתנתה בינתיים - יש לרענן ולנסות שוב';
  if (status >= 500) return 'שגיאת שרת - ננסה שוב בעוד רגע';
  return 'הפעולה נכשלה';
}

// הסיבה שתוצג: הודעה בעברית מהשרת (error או message) אם יש, אחרת ברירת המחדל לפי הסטטוס.
export function serverReason(data, status) {
  for (const key of ['error', 'message']) {
    const v = data && typeof data === 'object' ? data[key] : null;
    if (typeof v === 'string' && v.trim() && HEBREW.test(v)) return v.trim();
  }
  return reasonForStatus(status);
}

// "<הפעולה> נכשלה: <סיבה>" - הטקסט שמוצג בטוסט השגיאה.
export function failureMessage(action, data, status) {
  return `${action}: ${serverReason(data, status)}`;
}

// שולח בקשה ומחזיר תמיד אובייקט אחיד {ok, status, data, networkError}. res.ok הוא הקובע - לא
// קיום גוף JSON. גוף שאינו JSON (למשל דף שגיאה של שרת) לא זורק, פשוט data = {}.
// fetchImpl ניתן להזרקה לבדיקות.
export async function requestJson(url, init, fetchImpl = globalThis.fetch) {
  let res;
  try {
    res = await fetchImpl(url, init);
  } catch (e) {
    return { ok: false, status: 0, data: {}, networkError: true };
  }
  let data = {};
  try {
    const parsed = await res.json();
    if (parsed && typeof parsed === 'object') data = parsed;
  } catch (e) { /* גוף ריק / לא JSON */ }
  // נתיבי הסיסמה מחזירים גם {success:false} - אם status תקין אבל success===false זה עדיין כישלון.
  const ok = !!res.ok && data.success !== false;
  return { ok, status: res.status, data, networkError: false };
}

// הודעת שגיאה מוכנה לתצוגה מתוצאת requestJson שנכשלה.
export function describeFailure(action, result) {
  if (result.networkError) return `${action}: אין תקשורת עם השרת - בדוק את החיבור ונסה שוב`;
  return failureMessage(action, result.data, result.status);
}

// --- שינוי סיסמה: מי רשאי לשנות סיסמה של מי -----------------------------------------------
// self    - העובד המחובר משנה את סיסמתו: נדרשת הסיסמה הישנה (או mustResetPassword).
// manager - הנהלה ראשית / מתכנת משנים סיסמה של עובד אחר שאינו בכיר מהם: נדרשת הסיסמה של
//           המנהל עצמו (אימות מחדש), לא הסיסמה הישנה של העובד שהמנהל לא אמור להכיר.
// כל השאר (עובד רגיל, מנהל סניף) נדחים - מנהל סניף ממשיך להשתמש ב"קבע סיסמה ידנית" /
// "אפס ושלח למייל" שדורשות קוד מנהל.
export function decidePasswordChangeMode({ sessionEmployeeId, targetId, actor, target }) {
  if (sessionEmployeeId && sessionEmployeeId === targetId) return { mode: 'self' };
  if (!actor) {
    return { mode: 'deny', status: 401, message: 'יש להתחבר מחדש כדי לשנות סיסמה' };
  }
  if (!HEAD_MANAGEMENT_ROLES.includes(actor.roleId)) {
    return { mode: 'deny', status: 403, message: 'שינוי סיסמה לעובד אחר מותר להנהלה ראשית ולמתכנת בלבד' };
  }
  if (!target) {
    return { mode: 'deny', status: 404, message: 'עובד לא נמצא' };
  }
  if (!canManageRoles(actor.roleId, target.roleId)) {
    return { mode: 'deny', status: 403, message: 'אין הרשאה לשנות סיסמה לעובד בכיר יותר' };
  }
  return { mode: 'manager' };
}
