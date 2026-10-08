// lib/menu/adminRecents.js — "כלי ניהול שנפתחו לאחרונה" לפאנל "ניהול" המקוצר (בקשת הבעלים 4.10.2026,
// docs/admin-menu-short-2026-10-04.md).
//
// מודול טהור, בלי DOM ובלי React: כל פונקציה מקבלת רשימה / אובייקט אחסון ומחזירה ערך חדש; לעולם לא זורקת.
// האחסון: localStorage של הדפדפן (היסטוריית הניווט ב-sessionStorage נמחקת עם הטאב — קצרה מדי ל"אחרונים" של כלי ניהול),
// מפתח נפרד לכל עובד (ADMIN_RECENTS_KEY_PREFIX + מזהה העובד, או 'guest'), עד ADMIN_RECENTS_CAP רשומות, החדש ראשון.
// נשמרים רק נתיבי כלים (href של שורת מאגר "ניהול", למשל '/admin/statistics') וזמן — בלי שמות לקוחות או נתונים אחרים.
// מה שמוצג נקבע תמיד מחדש מול המאגר הנוכחי של העץ (composeAdminItems ב-buildMenuTree.js): רשומה של כלי שכבר אסור /
// לא קיים פשוט לא מוצגת. בהתנתקות (MenuA5Shell handleLogout) כל המפתחות של המודול נמחקים, כמו clearNavHistoryStorage.

export const ADMIN_RECENTS_VERSION = 1;
export const ADMIN_RECENTS_CAP = 8;
export const ADMIN_RECENTS_KEY_PREFIX = 'gm_admin_recents_v1:';
// רק נגד אחסון מושחת: אנחנו כותבים עד ADMIN_RECENTS_CAP רשומות קצרות (~600 בתים)
export const ADMIN_RECENTS_MAX_RAW_CHARS = 8 * 1024;
const MAX_HREF = 200;

/** מפתח האחסון לעובד (מזהה מחרוזת / מספר), או 'guest' כשאין התחברות. */
export function adminRecentsKey(userId) {
  const id = typeof userId === 'string' && userId ? userId : (typeof userId === 'number' && Number.isFinite(userId) ? String(userId) : 'guest');
  return `${ADMIN_RECENTS_KEY_PREFIX}${id}`;
}

// נתיב כלי פנימי בלבד: מתחיל ב-'/', לא '//' ולא '/\', בלי תווי בקרה, בלי query/hash (הכלים במאגר הם נתיבים נקיים).
export function cleanAdminHref(href) {
  if (typeof href !== 'string') return '';
  const s = href.trim();
  if (!s || s.length > MAX_HREF || !s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return '';
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029\ufeff\\?#]/.test(s)) return '';
  return s;
}

/**
 * ביקור בכלי ניהול: הכלי עובר לראש הרשימה (בלי כפילות), עד ADMIN_RECENTS_CAP רשומות.
 * מחזיר את אותה רשימה (זהות) כשאין שינוי — הכלי כבר ראשון או ה-href אינו תקין.
 * @param {Array<{href:string,ts:number}>} list
 * @param {string} href
 * @param {number} [now]
 */
export function recordAdminVisit(list, href, now) {
  const cur = Array.isArray(list) ? list : [];
  const h = cleanAdminHref(href);
  if (!h) return cur;
  if (cur.length && cur[0] && cur[0].href === h) return cur;
  const ts = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  return [{ href: h, ts }, ...cur.filter((e) => e && e.href !== h)].slice(0, ADMIN_RECENTS_CAP);
}

/** hrefs בלבד, החדש ראשון — הקלט של composeAdminItems / applyAdminRecents. */
export function adminRecentHrefs(list) {
  return (Array.isArray(list) ? list : []).map((e) => e && e.href).filter(Boolean);
}

export function serializeAdminRecents(list) {
  const clean = (Array.isArray(list) ? list : []).slice(0, ADMIN_RECENTS_CAP).map((e) => ({ href: e.href, ts: e.ts }));
  return JSON.stringify({ v: ADMIN_RECENTS_VERSION, list: clean });
}

/** קריאה סלחנית: כל דבר שבור → []; רשומות פגומות / כפולות נזרקות; עד ADMIN_RECENTS_CAP. */
export function deserializeAdminRecents(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > ADMIN_RECENTS_MAX_RAW_CHARS) return [];
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return []; }
  if (!parsed || typeof parsed !== 'object' || parsed.v !== ADMIN_RECENTS_VERSION || !Array.isArray(parsed.list)) return [];
  const out = [];
  const seen = new Set();
  for (const e of parsed.list) {
    if (out.length >= ADMIN_RECENTS_CAP) break;
    const h = cleanAdminHref(e && e.href);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    out.push({ href: h, ts: typeof e.ts === 'number' && Number.isFinite(e.ts) ? e.ts : 0 });
  }
  return out;
}

const localStore = () => {
  try { return typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined; } catch (e) { return undefined; }
};

/** קריאה מהאחסון (ברירת מחדל localStorage); אחסון חסום / חסר → []. */
export function readAdminRecents(userId, storage) {
  const st = storage !== undefined ? storage : localStore();
  if (!st || typeof st.getItem !== 'function') return [];
  try { return deserializeAdminRecents(st.getItem(adminRecentsKey(userId))); } catch (e) { return []; }
}

/** כתיבה לאחסון; מחזיר true כשנכתב. מצב פרטי / מכסה → false, בלי חריגה. */
export function writeAdminRecents(userId, list, storage) {
  const st = storage !== undefined ? storage : localStore();
  if (!st || typeof st.setItem !== 'function') return false;
  try { st.setItem(adminRecentsKey(userId), serializeAdminRecents(list)); return true; } catch (e) { return false; }
}

/**
 * ניקוי בהתנתקות: מוחק את כל מפתחות המודול (של כל העובדים בדפדפן הזה), כדי שמחשב משותף לא ישמור עקבות.
 * מחזיר את מספר המפתחות שנמחקו (0 כשאין אחסון / שגיאה).
 */
export function clearAdminRecentsStorage(storage) {
  const st = storage !== undefined ? storage : localStore();
  if (!st || typeof st.removeItem !== 'function') return 0;
  try {
    const keys = [];
    const n = typeof st.length === 'number' ? st.length : 0;
    for (let i = 0; i < n; i++) {
      const k = typeof st.key === 'function' ? st.key(i) : null;
      if (typeof k === 'string' && k.startsWith(ADMIN_RECENTS_KEY_PREFIX)) keys.push(k);
    }
    for (const k of keys) st.removeItem(k);
    return keys.length;
  } catch (e) {
    return 0;
  }
}

/** true אם שתי רשימות אחרונים זהות (אותם נתיבים ו-ts באותו סדר). */
export function sameRecents(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((x, i) => x && b[i] && x.href === b[i].href && x.ts === b[i].ts);
}

// --- נעיצה (בקשת הבעלים 8.10.2026): "סיכה צפה" על שורה בפאנל "ניהול" שתקועה בו תמיד, בלי קשר ל"אחרונים" ---------------
// בניגוד ל"אחרונים" (localStorage של הדפדפן) הנעיצה נשמרת לכל עובד ב-DB: Employee.themeColor (העדפות העובד, שדה adminPins —
// lib/designPrefsSchema.js), כך שהיא עוקבת אחרי העובד בכל מחשב ובכל דפדפן. נשמרים רק נתיבי כלים, החדש-נעוץ אחרון (סדר הנעיצה).
export const ADMIN_PINS_CAP = 5;
// נתיבי כלים קצרים (<40 תווים); הגבלה נוקשה יותר מ-MAX_HREF כי הנעיצות נכנסות גם לעוגייה החתומה (מגבלת 3000 תווים, lib/designPrefsSig.js).
const MAX_PIN_HREF = 80;

/** רשימת נתיבים נקייה: נתיבים תקינים בלבד, בלי כפילויות, עד ADMIN_PINS_CAP. קלט לא תקין → []. */
export function sanitizeAdminPins(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const e of list) {
    if (out.length >= ADMIN_PINS_CAP) break;
    const h = cleanAdminHref(typeof e === 'string' ? e : e && e.href);
    if (!h || h.length > MAX_PIN_HREF || seen.has(h)) continue;
    seen.add(h);
    out.push(h);
  }
  return out;
}

/**
 * נעיצה / שחרור של כלי. מחזיר { pins, changed, full }: full=true כשביקשו לנעוץ והמכסה מלאה (לא משנה כלום).
 * @param {string[]} pins
 * @param {string} href
 */
export function toggleAdminPin(pins, href) {
  const cur = sanitizeAdminPins(pins);
  const h = cleanAdminHref(href);
  if (!h) return { pins: cur, changed: false, full: false };
  if (cur.includes(h)) return { pins: cur.filter((x) => x !== h), changed: true, full: false };
  if (cur.length >= ADMIN_PINS_CAP) return { pins: cur, changed: false, full: true };
  return { pins: [...cur, h], changed: true, full: false };
}

/** true אם שתי רשימות נעוצים זהות (אותו סדר). */
export function samePins(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((x, i) => x === b[i]);
}
