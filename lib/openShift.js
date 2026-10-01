// lib/openShift.js - "המשמרת הפתוחה הנוכחית" של עובד: משותף ל-/api/me (השעון בתפריט) ול-/api/attendance (רישום יציאה).
//
// למה: לעובד יכולות להיות כמה משמרות פתוחות (exitTime: null) - למשל משמרות ישנות מ-Access שאף פעם לא נסגרו.
// בעבר נבחרה "המשמרת הפתוחה" לפי id יורד, אבל ה-id הוא UUID אקראי, כלומר בחירה שרירותית: אחרי שהעובד סגר את המשמרת של
// היום, /api/me החזיר משמרת ישנה ושעון התפריט המשיך להראות "משמרת פתוחה". הכלל הנכון: המשמרת הפתוחה עם שעת הכניסה
// המאוחרת ביותר (entryTime יורד); שוויון / חוסר שעה נפתרים באופן דטרמיניסטי.
// הבחירה נעשית ב-JS ולא ב-ORDER BY כדי לא להיות תלויים בהתנהגות NULL של כל מסד (Postgres מול ה-SQLite של מצב לא מקוון).

const toMs = (v) => {
  if (!v) return null;
  const t = v instanceof Date ? v.getTime() : Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/**
 * בוחר מבין משמרות פתוחות את העדכנית ביותר: entryTime יורד; משמרת בלי שעת כניסה תקינה אחרונה; שוויון -> id יורד.
 * לא משנה את המערך שהתקבל. אין משמרות -> null.
 */
export function pickLatestOpenShift(shifts) {
  if (!Array.isArray(shifts) || shifts.length === 0) return null;
  let best = null;
  let bestMs = null;
  for (const s of shifts) {
    if (!s) continue;
    const ms = toMs(s.entryTime);
    if (best === null) { best = s; bestMs = ms; continue; }
    let better;
    if (ms !== null && bestMs === null) better = true;
    else if (ms === null && bestMs !== null) better = false;
    else if (ms !== bestMs) better = ms > bestMs;
    else better = String(s.id ?? '') > String(best.id ?? '');
    if (better) { best = s; bestMs = ms; }
  }
  return best;
}

/**
 * קורא (בלבד) את המשמרות הפתוחות של העובד ומחזיר את העדכנית שבהן, או null. משמרת שנמחקה (isDeleted) אינה נחשבת פתוחה.
 * @param {{ shift: { findMany: Function } }} prismaLike
 * @param {string} employeeId
 */
export async function findLatestOpenShift(prismaLike, employeeId) {
  const open = await prismaLike.shift.findMany({
    where: { employeeId, exitTime: null, isDeleted: false },
  });
  return pickLatestOpenShift(open);
}
