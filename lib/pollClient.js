// ============================================================================
// pollClient.js - דוגם אחד משותף לכל הטאב: מוני "לא נקראו" של דיווחי התקלות והפעמון
// ============================================================================
//
// לפני: כפתור דיווח התקלות והפעמון (NotificationBell / menu/MenuBell) דגמו כל אחד לבד כל 120 שנ' (שני invocations, כל אחד
// עם אימות + שאילתות). עכשיו: טיימר אחד לטאב, בקשה אחת GET /api/poll (app/api/poll/route.js) שמחזירה את שני המונים,
// ומנויים (subscribe) שמקבלים את התוצאה. ר' docs/cpu-phase1a-poll-2026-10-06.md.
//
// כללים:
//   * הטיימר פועל רק כשיש לפחות מנוי אחד, דרך onActiveInterval של lib/idleGuard.js: נעצר בטאב מוסתר / שנשכח פתוח (30 דקות בלי פעילות),
//     ובחזרה (גלוי / תזוזה) נשלחת בקשה מיידית אחת ואז חוזרים לקצב הרגיל. קצב: POLL_INTERVAL_MS = 300 שנ' (היה 120).
//   * דה-דופליקציה: שני רכיבים שעולים יחד (פעמון + כפתור) = בקשה אחת (בקשה בדרך משותפת; תוצאה טרייה מ-DEDUPE_MS נעשית שימוש חוזר).
//   * אחרי פעולה של המשתמש עצמו (סימון כנקרא, סגירת חלון הדיווחים, דף /messages) - pollAfterAction(): רענון מיידי (דחוי שנייה אחת
//     כדי שרצף פעולות יהיה בקשה אחת) שעוקף את מטמון השרת (?fresh=1), כך שהנקודה האדומה נכונה.
//   * הכתובת כוללת light=1 בכוונה: (א) app/layout.js לא רושם בקשות כאלה ב-PageVisitLog; (ב) שער ה-fetch של idleGuard מחזיר מקומית
//     {success:false, paused:true} בטאב מושהה (חגורה ובורסה מעל הטיימר).
//   * 401 (אין משתמש מחובר, עמדת לקוחות): מפסיקים את הטיימר ומסמנים authFailed; בקשת רענון מפורשת (ניווט) מנסה שוב.
//   * תשובה עם X-Poll-Limited (השרת הגביל קצב והגיש מטמון) לא דורסת מונה שכבר ידוע.
//
// הקובץ חסר תלות ב-React וב-DOM ברמת המודול (בטוח ל-SSR); כל התלויות ניתנות להזרקה לבדיקות (scripts/poll-client.test.mjs).
// ============================================================================

import { onActiveInterval as realOnActiveInterval } from './idleGuard.js';

export const POLL_URL = '/api/poll?light=1';
export const POLL_URL_FRESH = '/api/poll?light=1&fresh=1';
export const POLL_INTERVAL_MS = 300000;
/** תוצאה טרייה מזה לא נשלחת שוב (רענון לא-כפוי). */
export const DEDUPE_MS = 5000;
/** מנוי חדש לא מפעיל בקשה אם יש תוצאה טרייה מזה. */
export const SUBSCRIBE_MAX_AGE_MS = 10000;
/** ניווט (שינוי נתיב): לא מרעננים אם דגמנו בדקה האחרונה. */
export const NAV_REFRESH_MAX_AGE_MS = 60000;
/** פתיחת הפעמון: לא מרעננים אם דגמנו ב-30 השניות האחרונות (הרשימה המלאה נטענת בכל מקרה). */
export const OPEN_REFRESH_MAX_AGE_MS = 30000;
/** דחייה של רענון-אחרי-פעולה: רצף פעולות (סימון כמה הודעות) = בקשה אחת. */
export const ACTION_DEBOUNCE_MS = 1000;

const EMPTY_SECTION = Object.freeze({ known: false, rev: 0, unread: 0 });
export const EMPTY_SNAPSHOT = Object.freeze({
  known: false,
  authFailed: false,
  rev: 0,
  errorReports: Object.freeze({ ...EMPTY_SECTION, isProgrammer: false, isManager: false }),
  notifications: EMPTY_SECTION,
});

export function createPoller({
  fetchFn = (...a) => fetch(...a),
  now = () => Date.now(),
  onActiveInterval = realOnActiveInterval,
  setTimeoutFn = (f, ms) => setTimeout(f, ms),
  clearTimeoutFn = (id) => clearTimeout(id),
  intervalMs = POLL_INTERVAL_MS,
} = {}) {
  let snapshot = EMPTY_SNAPSHOT;
  const listeners = new Set();
  let stopTimer = null;
  let inflight = null;
  let queuedForce = null;
  let lastFetchAt = -Infinity;
  let actionTimer = null;
  let requests = 0; // לבדיקות / אבחון

  const emit = () => {
    for (const fn of [...listeners]) {
      try { fn(snapshot); } catch { /* מנוי שבור לא מפיל את האחרים */ }
    }
  };

  function ensureTimer() {
    if (stopTimer || !listeners.size || snapshot.authFailed) return;
    // resumeStaleMs: 0 = בחזרה מהשהיה תמיד מנסים רענון (הדה-דופליקציה מונעת כפילות)
    stopTimer = onActiveInterval(() => { refresh(); }, intervalMs, { resumeStaleMs: 0 });
  }
  function clearTimer() {
    if (stopTimer) { try { stopTimer(); } catch { /* */ } stopTimer = null; }
  }

  function apply(data) {
    const rev = snapshot.rev + 1;
    const er = data.errorReports;
    const nf = data.notifications;
    snapshot = {
      known: true,
      authFailed: false,
      rev,
      errorReports: er && typeof er.unread === 'number'
        ? { known: true, rev, unread: er.unread, isProgrammer: !!er.isProgrammer, isManager: er.isManager ?? er.isProgrammer ?? false }
        : snapshot.errorReports,
      notifications: nf && typeof nf.unread === 'number'
        ? { known: true, rev, unread: nf.unread }
        : snapshot.notifications,
    };
  }

  async function doFetch(fresh) {
    requests += 1;
    let res;
    try {
      res = await fetchFn(fresh ? POLL_URL_FRESH : POLL_URL, { cache: 'no-store', credentials: 'same-origin' });
    } catch {
      return snapshot;
    }
    if (res && res.status === 401) {
      lastFetchAt = now();
      clearTimer();
      if (!snapshot.authFailed) { snapshot = { ...snapshot, authFailed: true }; emit(); }
      return snapshot;
    }
    if (!res || !res.ok) return snapshot;
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!data || data.paused || !data.success) return snapshot; // paused = שער ה-idle ענה מקומית
    lastFetchAt = now();
    const limited = !!(res.headers && typeof res.headers.get === 'function' && res.headers.get('X-Poll-Limited') === '1');
    if (limited && snapshot.known && !snapshot.authFailed) return snapshot;
    apply(data);
    emit();
    ensureTimer(); // אחרי 401 שחלף (התחברות) - חוזרים לדגום
    return snapshot;
  }

  /**
   * רענון. force: אחרי פעולה של המשתמש - עוקף מטמון שרת ודה-דופליקציה (ואם בקשה כבר בדרך, שולח אחת נוספת מיד אחריה כי
   * התשובה שבדרך אולי קדמה לפעולה). maxAgeMs: תוצאה טרייה מזה (ברירת מחדל DEDUPE_MS) מספיקה.
   */
  function refresh({ force = false, maxAgeMs = DEDUPE_MS } = {}) {
    if (!force) {
      if (inflight) return inflight;
      if (now() - lastFetchAt < maxAgeMs) return Promise.resolve(snapshot);
    } else if (inflight) {
      if (!queuedForce) {
        queuedForce = inflight.then(() => { queuedForce = null; return start(true); });
      }
      return queuedForce;
    }
    return start(force);
  }

  function start(fresh) {
    const p = doFetch(fresh).finally(() => { if (inflight === p) inflight = null; });
    inflight = p;
    return p;
  }

  /** מנוי: listener(snapshot) נקרא בכל תוצאה (ומיד אם כבר יש). מחזיר ביטול מנוי. */
  function subscribe(listener) {
    listeners.add(listener);
    if (snapshot.known || snapshot.authFailed) { try { listener(snapshot); } catch { /* */ } }
    ensureTimer();
    refresh({ maxAgeMs: SUBSCRIBE_MAX_AGE_MS });
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        clearTimer();
        if (actionTimer !== null) { clearTimeoutFn(actionTimer); actionTimer = null; }
      }
    };
  }

  /** רענון מיידי (דחוי ב-ACTION_DEBOUNCE_MS) אחרי פעולה של המשתמש עצמו שמשנה את המונים. */
  function afterAction() {
    if (!listeners.size) return;
    if (actionTimer !== null) clearTimeoutFn(actionTimer);
    actionTimer = setTimeoutFn(() => { actionTimer = null; refresh({ force: true }); }, ACTION_DEBOUNCE_MS);
  }

  return {
    subscribe,
    refresh,
    afterAction,
    getSnapshot: () => snapshot,
    requestCount: () => requests,
    listenerCount: () => listeners.size,
  };
}

// ---------------------------------------------------------------------------
// הדוגם של הדפדפן (סינגלטון, נוצר בעצלות). בשרת (SSR) - null / no-op.
// ---------------------------------------------------------------------------
let browserPoller = null;

export function getPoller() {
  if (typeof window === 'undefined') return null;
  if (!browserPoller) browserPoller = createPoller();
  return browserPoller;
}

/** רענון לפי דרישה (למשל בניווט: { maxAgeMs: 60000 } = לא אם דגמנו בדקה האחרונה). */
export function pollRefresh(opts) {
  const p = getPoller();
  return p ? p.refresh(opts) : Promise.resolve(EMPTY_SNAPSHOT);
}

/** לקרוא אחרי פעולה של המשתמש עצמו שמשנה מונה (סימון כנקרא, ארכיון, שליחת הודעה, סגירת חלון הדיווחים). */
export function pollAfterAction() {
  const p = getPoller();
  if (p) p.afterAction();
}
