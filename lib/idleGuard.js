// ============================================================================
// idleGuard.js - טאב שנשכח פתוח לא ממשיך לדגום את השרת
// ============================================================================
//
// בעיה: כל טאב פתוח של האתר מריץ בדיקות רקע (מונה "לא נקראו" של פעמון ההתראות ושל דיווחי התקלות כל 120 שנ',
// ועוד). טאב שנשכח פתוח על מסך שני (גלוי, אבל אף אחד לא נוגע בו) ממשיך לדגום ימים - כל דגימה היא invocation
// ב-Vercel ושאילתת DB ב-Neon, ועל תוכנית Hobby/Free זה מכסת CPU אמיתית. טאב מוסתר נעצר כבר היום, אבל טאב גלוי
// ללא פעילות לא. ר' docs/idle-tab-guard-2026-10-06.md.
//
// הכלל (מקור אמת יחיד):
//   * "פעיל" = הטאב גלוי (document.visibilityState) וגם הייתה פעילות משתמש (עכבר/מקלדת/מגע/גלילה/פוקוס)
//     בתוך IDLE_AFTER_MS (ברירת מחדל 30 דקות).
//   * טאב שאינו פעיל: כל הדגימות והרענונים האוטומטיים ברקע נעצרים (אין בקשות רשת בכלל).
//   * כשחוזרת פעילות (או שהטאב נעשה גלוי): רענון מיידי אחד של מה שהתיישן, וחוזרים לקצב הרגיל.
//   * אחרי LONG_IDLE_MS (8 שעות) בלי פעילות - נשארים מושהים; שום טעינה-מחדש אוטומטית ושום לולאה.
//   * חריגים (IDLE_EXEMPT_PATHS): עמדות שחייבות להישאר חיות גם בלי מגע (עמדת לקוחות, שעון נוכחות) -
//     שם לא נספרת ההשהיה בגלל חוסר פעילות (טאב מוסתר עדיין מושהה).
//
// שני שימושים:
//   1. onActiveInterval(fn, ms, opts) - תחליף ל-setInterval לדגימות רקע (החזרה: פונקציית ביטול).
//   2. שער fetch (installLightPollGate): בקשות '?light=1' (הסימון הקיים של "דגימת רקע" - ר' app/layout.js)
//      מקבלות תשובה מקומית {success:false, paused:true} כשהטאב מושהה, בלי לצאת לרשת. זה מכסה גם עותקים ישנים
//      קפואים (LegacyErrorReportButton.js - נעול ל-blob בהיסטוריה) שאי אפשר לערוך.
//
// הקובץ חסר תלות ב-React וב-DOM ברמת המודול (בטוח ל-SSR). כל התלויות מוזרקות ל-createIdleGuard לבדיקות.
// ביטול מלא (rollback): ר' IDLE_GUARD_ENABLED או git revert של הקומיט.
// ============================================================================

/** מתג חירום: false = חוזרים להתנהגות שלפני השומר: נעצרים רק בטאב מוסתר, ואין עצירה בגלל חוסר פעילות. */
export const IDLE_GUARD_ENABLED = true;
/** אחרי כמה זמן בלי פעילות משתמש הדגימות נעצרות. */
export const IDLE_AFTER_MS = 30 * 60 * 1000;
/** מעבר לזה הטאב "ישן מאוד": נשאר מושהה, ובחזרה נשלח אירוע idleguard:resume עם long:true. */
export const LONG_IDLE_MS = 8 * 60 * 60 * 1000;
/** נתיבים (תחילית, לפי גבול מקטע) שבהם חוסר פעילות לא משהה: עמדות לקוחות / שעון נוכחות. */
export const IDLE_EXEMPT_PATHS = ['/customer-interface', '/punch-clock'];
/** אירועי פעילות. כולם passive; scroll ב-capture כי הוא לא עולה בבועה. */
export const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
/** פעילות נרשמת לכל היותר פעם בשנייה (pointermove יורה עשרות פעמים בשנייה). */
const ACTIVITY_THROTTLE_MS = 1000;

export function isExemptPath(pathname, list = IDLE_EXEMPT_PATHS) {
  if (typeof pathname !== 'string') return false;
  return list.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * יוצר שומר. כל התלויות ניתנות להזרקה (בדיקות עם שעון ומסמך מזויפים):
 *   doc / win - אובייקטים עם addEventListener; doc.visibilityState / doc.hidden; win.location.pathname
 *   now - () => ms; setIntervalFn / clearIntervalFn
 */
export function createIdleGuard({
  doc,
  win,
  now = () => Date.now(),
  setIntervalFn = (f, ms) => setInterval(f, ms),
  clearIntervalFn = (id) => clearInterval(id),
  idleAfterMs = IDLE_AFTER_MS,
  longIdleMs = LONG_IDLE_MS,
  exemptPaths = IDLE_EXEMPT_PATHS,
  enabled = IDLE_GUARD_ENABLED,
} = {}) {
  let lastActivity = now();
  let lastSignalAt = 0;
  const listeners = new Set(); // (reason, info) => void - נקרא כשצריך לבדוק חידוש / השהיה

  const isHidden = () => !!doc && (doc.visibilityState === 'hidden' || doc.hidden === true);
  const exempt = () => {
    try { return isExemptPath(win && win.location && win.location.pathname, exemptPaths); } catch { return false; }
  };
  const idleMs = () => Math.max(0, now() - lastActivity);

  /** האם הטאב פעיל כרגע. limitMs: סף חוסר-פעילות מותאם לרישום מסוים. */
  function isActive(limitMs = idleAfterMs) {
    if (isHidden()) return false; // גם עם המתג כבוי: טאב מוסתר נעצר כמו שהיה לפני השומר
    if (!enabled) return true;
    if (exempt()) return true;
    return idleMs() < limitMs;
  }

  function emit(reason, info) {
    for (const fn of [...listeners]) {
      try { fn(reason, info); } catch { /* מאזין שבור לא מפיל את השאר */ }
    }
  }

  /** נרשמת פעילות. מחזיר true אם זו חזרה מהשהיה ארוכה מספיק כדי שמישהו יצטרך להתעורר. */
  function markActivity(force = false) {
    const t = now();
    if (!force && t - lastSignalAt < ACTIVITY_THROTTLE_MS) return false;
    const before = t - lastActivity;
    lastActivity = t;
    lastSignalAt = t;
    emit('activity', { idleMs: before, long: before >= longIdleMs });
    if (before >= longIdleMs && win && typeof win.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      try { win.dispatchEvent(new CustomEvent('idleguard:resume', { detail: { idleMs: before, long: true } })); } catch { /* */ }
    }
    return true;
  }

  const onActivity = () => { markActivity(false); };
  const onVisibility = () => {
    if (isHidden()) emit('hidden', {});
    else markActivity(true); // חזרה לטאב = פעילות (גם אם לא זזה העכבר)
  };

  let installed = false;
  function install() {
    if (installed || !doc || !win) return;
    installed = true;
    const opts = { passive: true, capture: true };
    for (const ev of ACTIVITY_EVENTS) {
      try { (ev === 'scroll' ? win : doc).addEventListener(ev, onActivity, opts); } catch { /* */ }
    }
    try { win.addEventListener('focus', onActivity, true); } catch { /* */ }
    // capture: חייב לרוץ לפני מאזיני visibilitychange של הרכיבים (שבודקים isActive בתוך המאזין שלהם)
    try { doc.addEventListener('visibilitychange', onVisibility, true); } catch { /* */ }
  }
  install();

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /**
   * תחליף ל-setInterval עבור דגימות רקע.
   *   - רץ כל ms רק כשהטאב פעיל; בטאב מושהה מבטל את ה-interval לגמרי (אפס התעוררויות).
   *   - בחזרה לפעילות: אם עבר ms מההרצה האחרונה - הרצה מיידית אחת, ואז ממשיך בקצב הרגיל.
   *   - opts.stopAfterIdleMs: סף חוסר-פעילות מותאם (ברירת מחדל IDLE_AFTER_MS).
   *   - opts.immediate: להריץ גם עכשיו (ברירת מחדל false - הקורא בדרך כלל כבר הריץ בעצמו).
   *   - opts.resumeStaleMs: בחזרה מהשהיה מריצים מיד רק אם עבר לפחות כל כך מההרצה האחרונה (ברירת מחדל = ms;
   *     0 = תמיד, כמו הפעמונים שרועננו בכל חזרה לטאב).
   * מחזיר stop().
   */
  function onActiveInterval(fn, ms, { stopAfterIdleMs = idleAfterMs, immediate = false, resumeStaleMs = ms } = {}) {
    let timer = null;
    let lastRun = now();
    let stopped = false;

    const run = () => {
      lastRun = now();
      try { return fn(); } catch { return undefined; }
    };
    const stopTimer = () => {
      if (timer !== null) { clearIntervalFn(timer); timer = null; }
    };
    const startTimer = () => {
      if (timer === null && !stopped) timer = setIntervalFn(tick, ms);
    };
    function tick() {
      if (stopped) return;
      if (!isActive(stopAfterIdleMs)) { stopTimer(); return; } // נעצר; יתעורר ב-wake()
      run();
    }
    // נקרא בכל איתות (פעילות / חזרה לגלוי / הסתרה)
    const wake = (reason) => {
      if (stopped) return;
      if (reason === 'hidden') { stopTimer(); return; }
      if (!isActive(stopAfterIdleMs)) return;
      if (timer === null) {
        // היה מושהה: רענון מיידי אחד של מה שהתיישן, ואז חזרה לקצב הרגיל
        if (now() - lastRun >= resumeStaleMs) run();
        startTimer();
      }
    };
    const unsub = subscribe(wake);

    if (isActive(stopAfterIdleMs)) {
      startTimer();
      if (immediate) run();
    }
    return () => { stopped = true; stopTimer(); unsub(); };
  }

  /**
   * שער ל-fetch: בקשות '?light=1' (דגימות רקע) בטאב מושהה מקבלות תשובה מקומית ולא יוצאות לרשת.
   * מחזיר פונקציית ביטול. בטוח לקריאה כפולה על אותו win.
   */
  function installLightPollGate(target = win) {
    if (!target || typeof target.fetch !== 'function' || target.__idleGuardGateInstalled) return () => {};
    target.__idleGuardGateInstalled = true;
    const baseFetch = target.fetch;
    target.fetch = function (input, ...rest) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url && url.indexOf('light=1') !== -1 && !isActive()) {
          return Promise.resolve(new Response(JSON.stringify({ success: false, paused: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
      } catch { /* כל תקלה כאן = ממשיכים לרשת כרגיל */ }
      return baseFetch.call(this, input, ...rest);
    };
    return () => {
      if (target.fetch !== baseFetch) target.fetch = baseFetch;
      target.__idleGuardGateInstalled = false;
    };
  }

  return { isActive, idleMs, markActivity, subscribe, onActiveInterval, installLightPollGate, install };
}

// ---------------------------------------------------------------------------
// שומר הדפדפן (סינגלטון). נוצר בעצלות; בשרת (SSR) לא נוגעים ב-window.
// ---------------------------------------------------------------------------
let browserGuard = null;

export function getIdleGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (!browserGuard) {
    browserGuard = createIdleGuard({ doc: document, win: window });
    browserGuard.installLightPollGate(window);
  }
  return browserGuard;
}

/** האם הטאב פעיל כרגע (גלוי + פעילות אחרונה). בשרת: true. */
export function isUserActive(limitMs) {
  const g = getIdleGuard();
  return g ? g.isActive(limitMs) : true;
}

/** תחליף ל-setInterval לדגימות רקע בדפדפן. בשרת: no-op. ר' createIdleGuard().onActiveInterval. */
export function onActiveInterval(fn, ms, opts) {
  const g = getIdleGuard();
  return g ? g.onActiveInterval(fn, ms, opts) : () => {};
}

// התקנה עצמית בעת הטעינה הראשונה בדפדפן: שער ה-light=1 חייב להיות פעיל גם בעותקים ישנים קפואים שלא מייבאים אותנו
// (LegacyErrorReportButton.js נטען רק דרך ErrorReportButton.js, שמייבא את הקובץ הזה).
if (typeof window !== 'undefined') getIdleGuard();
