'use client';

// ocScheduleAccess — מי רשאי/ת להדפיס את דפי הלו״ז להזמנה בודדת (PP-07 דף הכנה, PP-12 דף משלוח): GET /api/schedule/print?format=access,
// מטמון ברמת המודול עם תפוגה של 5 דקות (וגם רענון בכל mount של תפריט/חלון כשהמטמון פג). משמש את תפריט ההדפסה ואת חלון המייל (צרופת "דף משלוח"). לא ידוע / טרם נטען / תקלה = {} = מוסתר
// (הבטוח יותר: בלי קישור/צרופה שנכשלים ב-403); עובדת עם page:orders בלבד לא תראה אותם (REQUESTS-W7 #8). השרת אוכף בכל מקרה.
import { useEffect, useState } from 'react';
import { accessFromResponse } from './ocDocsLogic';

// מטמון עם תפוגה (5 דקות): שינוי הרשאות באמצע יום משתקף בלי רענון מלא; בתוך התקופה כל הכרטיסים חולקים תשובה אחת
export const SCHEDULE_ACCESS_TTL_MS = 5 * 60 * 1000;
let accessCache = null;
let accessAt = 0;
let accessPromise = null;
const fresh = () => !!accessCache && Date.now() - accessAt < SCHEDULE_ACCESS_TTL_MS;
/** לבדיקות */
export function resetScheduleAccessCache() { accessCache = null; accessAt = 0; accessPromise = null; }

export function loadScheduleAccess() {
  if (fresh()) return Promise.resolve(accessCache);
  if (!accessPromise) {
    accessPromise = fetch(`/api/schedule/print?format=access`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        let body = null;
        try { body = await res.json(); } catch { /* לא JSON */ }
        const a = accessFromResponse(res.status, body);
        if (Object.keys(a).length) { accessCache = a; accessAt = Date.now(); }
        return a;
      })
      .catch(() => ({}))
      .finally(() => { accessPromise = null; });
  }
  return accessPromise;
}

/** { prep?: boolean, delivery?: boolean } - ריק עד שהשרת ענה */
export function useScheduleAccess() {
  const [access, setAccess] = useState(accessCache || {});
  useEffect(() => {
    let off = false;
    if (!fresh()) loadScheduleAccess().then((a) => { if (!off) setAccess(a); });
    return () => { off = true; };
  }, []);
  return access;
}
