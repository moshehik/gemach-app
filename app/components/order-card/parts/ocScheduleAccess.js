'use client';

// ocScheduleAccess — מי רשאי/ת להדפיס את דפי הלו״ז להזמנה בודדת (PP-07 דף הכנה, PP-12 דף משלוח): GET /api/schedule/print?format=access,
// פעם אחת בדף (מטמון ברמת המודול). משמש את תפריט ההדפסה ואת חלון המייל (צרופת "דף משלוח"). לא ידוע / טרם נטען / תקלה = {} = מוסתר
// (הבטוח יותר: בלי קישור/צרופה שנכשלים ב-403); עובדת עם page:orders בלבד לא תראה אותם (REQUESTS-W7 #8). השרת אוכף בכל מקרה.
import { useEffect, useState } from 'react';
import { accessFromResponse } from './ocDocsLogic';

let accessCache = null;
let accessPromise = null;

export function loadScheduleAccess() {
  if (accessCache) return Promise.resolve(accessCache);
  if (!accessPromise) {
    accessPromise = fetch(`/api/schedule/print?format=access`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        let body = null;
        try { body = await res.json(); } catch { /* לא JSON */ }
        const a = accessFromResponse(res.status, body);
        if (Object.keys(a).length) accessCache = a;
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
    if (!accessCache) loadScheduleAccess().then((a) => { if (!off) setAccess(a); });
    return () => { off = true; };
  }, []);
  return access;
}
