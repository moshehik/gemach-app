// lib/schedule/afterResponse.js — עבודת רקע של "לקיחה" (הכנה אוטומטית + תיקון משוער) אחרי שהתשובה נשלחה, בלי להאט את הלקיחה ובלי להפיל אותה לעולם.
//   עיקרון: next/server after() כשהוא זמין והקריאה בתוך בקשה; מחוץ להקשר בקשה (בדיקות, סקריפטים) after() לא קיים / זורק - אז העבודה רצה כאן ומחכים לה עד timeoutMs.
//   המשימות רצות במקביל (Promise.allSettled), כל אחת מבודדת: כשל באחת לא משפיע על האחרת ולא על התשובה.
//   העובד: after() אוסר cookies() בראוטים, ולכן הקורא קורא את מזהה העובד לפני כל await (getActingEmployeeId) ומעביר אותו ל-actorId; כאן העבודה נעטפת ב-runAsActor
//   (app/lib/prisma.js) כדי ששורות היומן של התוסף יירשמו עם העובדת האמיתית ולא בלי עובד.
import * as nextServer from 'next/server'; // namespace: בסביבה בלי after (shim בבדיקות) הערך undefined ולא שגיאת import
import { runAsActor } from '@/app/lib/prisma';

export const AFTER_FALLBACK_TIMEOUT_MS = 1500;

/**
 * @param {Array<() => Promise<unknown>>} tasks  פונקציות async (לא מבטיחים כבר רצים) - כל אחת נכשלת בשקט
 * @param {{ actorId?: string|null (undefined = בלי עקיפה), afterFn?: Function|null, timeoutMs?: number }} [opts]  afterFn - להזרקה בבדיקות; ברירת מחדל after של Next
 * @returns {Promise<{ mode: 'after'|'inline'|'none', timedOut?: boolean }>}  לעולם לא זורק
 */
export async function runAfterResponse(tasks, { actorId, afterFn = nextServer.after, timeoutMs = AFTER_FALLBACK_TIMEOUT_MS } = {}) {
  const list = (tasks || []).filter((t) => typeof t === 'function');
  if (!list.length) return { mode: 'none' };
  const run = () => Promise.allSettled(list.map((t) => Promise.resolve().then(t)));
  const work = () => (actorId === undefined ? run() : runAsActor(actorId, run)); // actorId לא הועבר = הקריאה בתוך בקשה וה-cookie זמין
  if (typeof afterFn === 'function') {
    try {
      afterFn(work);
      return { mode: 'after' };
    } catch (e) {
      // מחוץ להקשר בקשה (after זורק) - נופלים לריצה מקומית
    }
  }
  let timer;
  const limit = new Promise((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); });
  try {
    const r = await Promise.race([work().catch(() => 'error'), limit]);
    return { mode: 'inline', ...(r === 'timeout' ? { timedOut: true } : {}) };
  } catch (e) {
    return { mode: 'inline' };
  } finally {
    clearTimeout(timer);
  }
}
