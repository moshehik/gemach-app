// ============================================================================
// pollCache.js - מטמון בזיכרון האינסטנס + דלי אסימונים לנקודת הקצה המאוחדת GET /api/poll
// ============================================================================
//
// למה: בדיקת הרקע של "לא נקראו" (פעמון + דיווחי תקלות) היא invocation + שאילתות DB לכל טאב, כל כמה דקות.
// הקובץ הזה מחזיק (א) מטמון של שני המונים לכל עובד בנפרד, (ב) הגבלת קצב לכל עובד. ר' docs/cpu-phase1a-poll-2026-10-06.md.
//
// אותו דפוס כמו lib/settingsCache.js: Map עם TTL, לכל אינסטנס חם בנפרד. חשוב: ב-Vercel כל נתיב API הוא פונקציה נפרדת,
// ולכן "ביטול מטמון" מנתיב אחר (למשל POST /api/notifications/read) לא מגיע לאינסטנס של /api/poll. לכן לא מחווטים כתיבות
// לכאן; הדיוק אחרי פעולה של המשתמש עצמו מובטח בכך שהלקוח שולח ?fresh=1 (עוקף מטמון) מיד אחרי הפעולה, ושאר המקרים
// (עובד אחר שולח הודעה, הסוכן עונה לדיווח דרך סקריפט) מתכנסים תוך ה-TTL. ה-helpers invalidate* נשארים לשימוש אינסטנס-מקומי ולבדיקות.
//
// ללא תלויות (בטוח לייבוא בכל מקום ולבדיקות).
// ============================================================================

export const ER_TTL_MS = 30 * 1000;   // מונה דיווחי תקלות: סקריפט הסוכן כותב ישירות ל-DB, אי אפשר לחווט ביטול - 30 שנ'
export const NF_TTL_MS = 30 * 1000;   // מונה התראות: אותה סיבה (ביטול בין-אינסטנסים לא אמין) - 30 שנ'
export const STALE_MAX_MS = 10 * 60 * 1000; // כשמוגבלי-קצב מגישים ערך מטמון גם אם פג עד כמה זמן
export const BUCKET_CAPACITY = 3;     // מותר "פרץ" קטן (ניווט + סימון כנקרא + פתיחה) לפני שמגבילים
export const BUCKET_REFILL_MS = 20 * 1000; // ואז אסימון אחד לכל 20 שנ' (= מעל בקשה אחת ל-20 שנ' בקצב מתמשך מוגבל)
const MAX_ENTRIES = 500;              // תקרת בטיחות לזיכרון (מספר העובדים קטן בהרבה)

export function createPollCache({
  now = () => Date.now(),
  erTtlMs = ER_TTL_MS,
  nfTtlMs = NF_TTL_MS,
  staleMaxMs = STALE_MAX_MS,
  bucketCapacity = BUCKET_CAPACITY,
  bucketRefillMs = BUCKET_REFILL_MS,
} = {}) {
  const stores = { er: new Map(), nf: new Map() };
  const ttl = { er: erTtlMs, nf: nfTtlMs };
  const buckets = new Map(); // employeeId -> { tokens, at }

  function trim(map) {
    if (map.size <= MAX_ENTRIES) return;
    const t = now();
    for (const [k, v] of map) if (t - v.at > staleMaxMs) map.delete(k);
    if (map.size > MAX_ENTRIES) map.clear();
  }

  /** kind: 'er' | 'nf'. מחזיר { value, fresh } או null. fresh=false = פג תוקף אבל עוד בתוך staleMaxMs. */
  function get(kind, id) {
    const e = stores[kind].get(id);
    if (!e) return null;
    const age = now() - e.at;
    if (age > staleMaxMs) { stores[kind].delete(id); return null; }
    return { value: e.value, fresh: age < ttl[kind] };
  }

  function set(kind, id, value) {
    stores[kind].set(id, { value, at: now() });
    trim(stores[kind]);
  }

  /** ביטול של מונה אחד (או של כולם בסוג, בלי id). */
  function invalidate(kind, id) {
    if (id === undefined || id === null) stores[kind].clear();
    else stores[kind].delete(id);
  }

  function clear() {
    stores.er.clear();
    stores.nf.clear();
    buckets.clear();
  }

  /** דלי אסימונים לכל עובד: true = מותר, false = מוגבל (המטמון יוגש ולא תהיה שגיאה). */
  function takeToken(id) {
    const t = now();
    let b = buckets.get(id);
    if (!b) b = { tokens: bucketCapacity, at: t };
    const refill = Math.floor((t - b.at) / bucketRefillMs);
    if (refill > 0) {
      b.tokens = Math.min(bucketCapacity, b.tokens + refill);
      b.at += refill * bucketRefillMs;
    }
    if (b.tokens <= 0) { buckets.set(id, b); return false; }
    b.tokens -= 1;
    buckets.set(id, b);
    if (buckets.size > MAX_ENTRIES) buckets.clear();
    return true;
  }

  return { get, set, invalidate, clear, takeToken, stores };
}

// סינגלטון של האינסטנס. נשמר על globalThis כדי ש-HMR בפיתוח לא ישכפל אותו (כמו prisma ב-app/lib/prisma.js).
const G = typeof globalThis !== 'undefined' ? globalThis : {};
export const pollCache = G.__gemachPollCache || (G.__gemachPollCache = createPollCache());

/** ביטול מונה דיווחי התקלות (של עובד, או של כולם). אינסטנס-מקומי בלבד - ר' ההערה למעלה. */
export function invalidateErrorReportCounts(employeeId) {
  pollCache.invalidate('er', employeeId);
}

/** ביטול מונה ההתראות (של עובד, או של כולם). אינסטנס-מקומי בלבד. */
export function invalidateNotificationCounts(employeeId) {
  pollCache.invalidate('nf', employeeId);
}
