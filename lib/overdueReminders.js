// lib/overdueReminders.js - עוזרים טהורים ל-app/components/OverdueRemindersWatcher.js (cpu-phase0, 6.10.2026).
// הרכיב שלף /api/orders/overdue בכל טעינת דף (גם כשאין איחורים - אז לא נשמר "הוצג"), ולכן כל ניווט מלא = בקשה.
// עכשיו נשמר גם "נבדק" (לכל עובד, sessionStorage) והבדיקה מדולגת אם נבדק לפני פחות מ-55 דקות.

// 55 דק' ולא 60: טיימר השעה של הרכיב נורה בדיוק ~60 דק' אחרי הבדיקה הקודמת ואסור שהסימון "הטרי" יחסום אותו.
export const OVERDUE_CHECK_FRESH_MS = 55 * 60 * 1000;

export function overdueCheckKey(authToken) {
  return `overdueRemindersLastCheckedAt:${authToken || ''}`;
}

// raw = ערך מה-storage (מחרוזת/null). ערך לא תקין / עתידי = לא טרי (בודקים).
export function isOverdueCheckFresh(raw, now = Date.now(), freshMs = OVERDUE_CHECK_FRESH_MS) {
  const t = Number(raw);
  if (!Number.isFinite(t) || t <= 0 || t > now) return false;
  return now - t < freshMs;
}
