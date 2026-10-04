// lib/schedule/rangeCache.js — מטמון קצר בזיכרון לסיכום החודשי של הלוח (GET /api/board/stages, ממצא הסקירה 2: כל קריאה = חישוב
// הלו״ז לכל יום בחודש). המונים הם מידע בלבד, ולכן אין ביטול יזום: תשובה נשמרת RANGE_CACHE_TTL_MS ונזרקת. גודל חסום
// (RANGE_CACHE_MAX רשומות, הישנה ביותר יוצאת ראשונה).
// מפתח: כל מה שהתשובה תלויה בו - זהות מסד הנתונים (הארגון: כתובת ה-DB של הפריסה + מצב PROD/TEST), שם המארח של הבקשה,
// from, to, branch. התשובה לא תלויה במשתמש (getScheduleDay נקרא עם user=null), ולכן לא דולפת בין משתמשים; ההרשאה
// (page:board / page:schedule) נבדקת בכל בקשה לפני המטמון ו-canOpenSchedule לא נשמר בו.

export const RANGE_CACHE_TTL_MS = 45000;
export const RANGE_CACHE_MAX = 60;

export function rangeCacheKey({ dbTag = '', host = '', from = '', to = '', branch = '' } = {}) {
  return JSON.stringify([String(dbTag), String(host).toLowerCase(), String(from), String(to), String(branch)]);
}

export function createRangeCache({ ttlMs = RANGE_CACHE_TTL_MS, max = RANGE_CACHE_MAX, now = () => Date.now() } = {}) {
  const map = new Map();
  return {
    get(key) {
      const e = map.get(key);
      if (!e) return null;
      if (now() - e.at > ttlMs) { map.delete(key); return null; }
      return e.value;
    },
    set(key, value) {
      map.delete(key);
      map.set(key, { at: now(), value });
      while (map.size > max) map.delete(map.keys().next().value);
    },
    get size() { return map.size; },
  };
}
