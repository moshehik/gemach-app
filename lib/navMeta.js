// סוג הניווט של טעינת דף, לשדה PageVisitLog.navigationType (docs/cpu-measurement-2026-10-06.md). קליינט בלבד, בלי תלויות.
//   המסמך הראשון בלשונית:  'navigate' | 'reload' | 'back_forward' | 'prerender'  (performance.getEntriesByType('navigation')[0].type)
//   + '+newtab' כשנראה שנפתח בלשונית/חלון חדש (window.opener, או ניווט ראשון בלשונית עם היסטוריה באורך 1)
//   כל מעבר דף נוסף באותו מסמך (ניווט בצד הלקוח של Next, בלי טעינה מחדש): 'spa'
// למה: כדי להפריד "כניסה חדשה/רענון" (שמעלה את כל ה-boot של האפליקציה) מניווט פנימי זול.

export function detectNavigationType(env = globalThis) {
  try {
    const entries = env.performance && typeof env.performance.getEntriesByType === 'function' ? env.performance.getEntriesByType('navigation') : [];
    const t = entries && entries[0] && entries[0].type;
    if (t === 'navigate' || t === 'reload' || t === 'back_forward' || t === 'prerender') return t;
    // דפדפנים ישנים: performance.navigation.type (0 navigate, 1 reload, 2 back_forward)
    const legacy = env.performance && env.performance.navigation && env.performance.navigation.type;
    if (legacy === 1) return 'reload';
    if (legacy === 2) return 'back_forward';
    if (legacy === 0) return 'navigate';
  } catch { /* ignore */ }
  return 'unknown';
}

export function detectNewTab(env = globalThis) {
  try {
    if (env.opener) return true; // נפתח מ-window.open / target=_blank בלי noopener
    const h = env.history && env.history.length;
    const ref = env.document && env.document.referrer;
    // לשונית חדשה לגמרי: היסטוריה באורך 1 (אין "אחורה" בתוך הלשונית). בלי referrer = הוקלד/סימניה/קישור חיצוני
    if (h === 1 && !ref) return true;
  } catch { /* ignore */ }
  return false;
}

/** מחזיר פונקציה next(): בקריאה הראשונה סוג הטעינה של המסמך (+newtab), בכל קריאה הבאה 'spa'. */
export function createNavTypeTracker(env = globalThis) {
  let first = true;
  return function next() {
    if (!first) return 'spa';
    first = false;
    const t = detectNavigationType(env);
    return t === 'navigate' || t === 'prerender' ? (detectNewTab(env) ? `${t}+newtab` : t) : t;
  };
}

// מופע יחיד לדף (מסמך) - PageTracker קורא לו בכל מעבר דף
const tracker = typeof window !== 'undefined' ? createNavTypeTracker(window) : null;
export function nextNavigationType() {
  return tracker ? tracker() : undefined;
}
