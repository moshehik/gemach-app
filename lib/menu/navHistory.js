// lib/menu/navHistory.js — מחסנית צפייה "אחורה / קדימה" של האפליקציה (R02, SPEC-ברקוד-ואחורה-קדימה סעיף 1.6).
//
// מודול טהור, ללא DOM: כל פונקציה מקבלת מצב ומחזירה מצב חדש (לא משנה את הקלט). המצב ניתן לסריאליזציה
// ל-sessionStorage (נמחק עם הטאב — פחות חשיפה במחשב משותף מאשר localStorage של agy_history).
//
// כללי דפדפן, בדיוק כמו window.SN.hist בעיצוב המאושר:
//   - ביקור חדש אחרי "אחורה" מוחק את כל "קדימה".
//   - כניסה חוזרת לעמוד שכבר ברשימה מעבירה אותו לראש (לא מכפילה).
//   - ביקור בעמוד הנוכחי = לא-כלום.
//   - גבול: עד NAV_HISTORY_CAP רשומות; כשעוברים — הישנה ביותר נופלת.
//   - "נקה" משאיר רק את העמוד הנוכחי; אחורה וקדימה כבויים.
//   - אחורה / קדימה / קפיצה לשורה לא רושמים ביקור חדש (הרכיב מעביר ל-router.push ומסמן fromHistory).
//
// רשומה: { key, path, label, icon, ts }. key = הנתיב המנורמל (normalizeNavPath) אלא אם הקורא נתן מפתח משלו.

import { isForcedLegacyPath } from '../uiVariant.js';

export const NAV_HISTORY_VERSION = 1;
export const NAV_HISTORY_CAP = 10;
export const NAV_HISTORY_STORAGE_KEY = 'gm_nav_history_v1';
export const NAV_HISTORY_MAX_LABEL = 120;
// תקרות קריאה מאחסון (רק נגד אחסון מושחת — אנחנו כותבים עד NAV_HISTORY_CAP רשומות, ~2KB):
// מחרוזת גדולה מזה נזרקת בלי לנתח; מרשימה ארוכה מעובדות רק הרשומות האחרונות (O(n) במקום O(n²)).
export const NAV_HISTORY_MAX_RAW_CHARS = 64 * 1024;
export const NAV_HISTORY_MAX_PARSE_ENTRIES = 100;

const EMPTY = Object.freeze({ list: Object.freeze([]), cur: -1 });

/** נתיב מנורמל: בלי origin, בלי לוכסן סוגר, עם query ו-hash (כי /rentals#rented ו-/rentals#returned הם עמודים שונים). */
export function normalizeNavPath(href) {
  if (typeof href !== 'string') return '';
  let s = href.trim();
  if (!s) return '';
  const m = s.match(/^[a-z][a-z0-9+.-]*:\/\/[^/]*(\/.*)?$/i);
  if (m) s = m[1] || '/';
  if (!s.startsWith('/')) s = `/${s}`;
  const hashIdx = s.indexOf('#');
  const hash = hashIdx === -1 ? '' : s.slice(hashIdx);
  let rest = hashIdx === -1 ? s : s.slice(0, hashIdx);
  const qIdx = rest.indexOf('?');
  const query = qIdx === -1 ? '' : rest.slice(qIdx);
  let path = qIdx === -1 ? rest : rest.slice(0, qIdx);
  // הקשחה: '/\evil.com' ו-'//evil.com' נקראים ע"י הדפדפן ככתובת חיצונית (open redirect דרך router.push).
  // לוכסן הפוך הופך ללוכסן רגיל, ורצף לוכסנים מתכווץ לאחד — התוצאה תמיד נתיב פנימי יחסי לאתר.
  path = path.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  rest = path + (query === '?' ? '' : query);
  return rest + (hash === '#' ? '' : hash);
}

/** האם לרשום את הנתיב בהיסטוריה: לא API, לא פנימי של Next, לא קיוסק / שעון / הדפסה, לא ריק. */
export function shouldRecordPath(href) {
  const p = normalizeNavPath(href);
  if (!p) return false;
  const bare = p.split(/[?#]/)[0];
  if (bare.startsWith('/api/') || bare === '/api' || bare.startsWith('/_next')) return false;
  if (isForcedLegacyPath(bare)) return false;
  return true;
}

function cleanLabel(label, fallback) {
  const s = typeof label === 'string' ? label.replace(/\s+/g, ' ').trim() : '';
  return (s || fallback || '').slice(0, NAV_HISTORY_MAX_LABEL);
}

/** בונה רשומה תקינה מהקלט; מחזיר null אם אין נתיב. */
export function makeEntry(input, now) {
  if (!input) return null;
  const raw = typeof input === 'string' ? { path: input } : input;
  const path = normalizeNavPath(raw.path || raw.href);
  if (!path) return null;
  const key = typeof raw.key === 'string' && raw.key ? raw.key : path;
  const ts = typeof raw.ts === 'number' && Number.isFinite(raw.ts) ? raw.ts : (typeof now === 'number' ? now : Date.now());
  const icon = typeof raw.icon === 'string' && raw.icon ? raw.icon : 'file';
  return { key, path, label: cleanLabel(raw.label, path), icon, ts };
}

function capOf(opts) {
  const c = opts && typeof opts.cap === 'number' && opts.cap >= 1 ? Math.floor(opts.cap) : NAV_HISTORY_CAP;
  return c;
}

export function createNavHistory() {
  return { list: [], cur: -1 };
}

export const current = (state) => (state && state.cur >= 0 && state.list[state.cur]) || null;
export const canGoBack = (state) => !!state && state.cur > 0;
export const canGoForward = (state) => !!state && state.cur >= 0 && state.cur < state.list.length - 1;
export const previousEntry = (state) => (canGoBack(state) ? state.list[state.cur - 1] : null);
export const nextEntry = (state) => (canGoForward(state) ? state.list[state.cur + 1] : null);
/** מיקום להצגה: "עמוד 3 מתוך 8" (1-based). */
export const position = (state) => ({ index: state && state.cur >= 0 ? state.cur + 1 : 0, total: state ? state.list.length : 0 });

/**
 * ביקור חדש. מחזיר את אותו אובייקט state (זהות) כשאין שינוי (עמוד נוכחי / נתיב לא נרשם).
 * @param {{list:Array,cur:number}} state
 * @param {object|string} input   { path|href, key?, label?, icon?, ts? } או מחרוזת נתיב
 * @param {{cap?:number, now?:number}} [opts]
 */
export function visit(state, input, opts = {}) {
  const s = state || createNavHistory();
  const entry = makeEntry(input, opts.now);
  if (!entry) return s;
  const cap = capOf(opts);
  const cur = current(s);
  if (cur && cur.key === entry.key) return s;
  let list = s.list.slice(0, s.cur + 1);                  // ביקור חדש מוחק את "קדימה"
  list = list.filter((e) => e.key !== entry.key);          // אותו עמוד לא מופיע פעמיים — עובר לראש
  list.push(entry);
  while (list.length > cap) list.shift();                  // הישנה ביותר נופלת
  return { list, cur: list.length - 1 };
}

/** עדכון תווית/אייקון של רשומה קיימת (למשל כשכרטיס ההזמנה טען את שם הלקוחה), בלי לשנות סדר. */
export function relabel(state, key, patch) {
  if (!state || !patch) return state;
  const i = state.list.findIndex((e) => e.key === key);
  if (i === -1) return state;
  const e = state.list[i];
  const next = { ...e };
  if (typeof patch.label === 'string' && patch.label.trim()) next.label = cleanLabel(patch.label, e.label);
  if (typeof patch.icon === 'string' && patch.icon) next.icon = patch.icon;
  if (next.label === e.label && next.icon === e.icon) return state;
  const list = state.list.slice();
  list[i] = next;
  return { list, cur: state.cur };
}

export function back(state) {
  if (!canGoBack(state)) return state;
  return { list: state.list, cur: state.cur - 1 };
}
export function forward(state) {
  if (!canGoForward(state)) return state;
  return { list: state.list, cur: state.cur + 1 };
}
/** קפיצה לשורה ברשימה (אינדקס 0-based). לא רושמת ביקור חדש. */
export function go(state, index) {
  if (!state || typeof index !== 'number' || !Number.isInteger(index)) return state;
  if (index < 0 || index >= state.list.length || index === state.cur) return state;
  return { list: state.list, cur: index };
}
/** "נקה": משאיר רק את העמוד הנוכחי. */
export function clear(state) {
  const cur = current(state);
  if (!cur) return createNavHistory();
  if (state.list.length === 1 && state.cur === 0) return state;
  return { list: [cur], cur: 0 };
}

/**
 * הרשימה כפי שהפאנל מציג אותה: החדש למעלה, עם סימון "עכשיו" ו"קדימה" (השורות שמעל הנוכחי).
 * index = האינדקס האמיתי ברשימה (ל-go).
 */
export function recentsView(state) {
  if (!state) return [];
  const out = [];
  for (let i = state.list.length - 1; i >= 0; i--) {
    const e = state.list[i];
    out.push({ ...e, index: i, isCurrent: i === state.cur, isForward: i > state.cur });
  }
  return out;
}

/** תוויות לכפתורים: "אחורה: לוח חודשי" / "אחורה (אין עמוד קודם)". */
export function buttonLabels(state) {
  const p = previousEntry(state);
  const n = nextEntry(state);
  return {
    back: p ? `אחורה: ${p.label}` : 'אחורה (אין עמוד קודם)',
    forward: n ? `קדימה: ${n.label}` : 'קדימה (אין עמוד הבא)',
    backDisabled: !p,
    forwardDisabled: !n,
    positionText: (() => { const q = position(state); return q.total ? `עמוד ${q.index} מתוך ${q.total}` : ''; })(),
    noBackMessage: 'אין עמוד קודם',
    noForwardMessage: 'אין עמוד הבא',
  };
}

// --- סריאליזציה (sessionStorage) -------------------------------------------------------
export function serializeNavHistory(state) {
  const s = state || createNavHistory();
  return JSON.stringify({ v: NAV_HISTORY_VERSION, cur: s.cur, list: s.list.map((e) => ({ key: e.key, path: e.path, label: e.label, icon: e.icon, ts: e.ts })) });
}

/**
 * קריאה סלחנית: כל דבר שבור → היסטוריה ריקה; רשומות פגומות/כפולות נזרקות; קלט ענק נחתך לפני העיבוד.
 * cur עוקב אחרי הרשומה (לפי key) שעליה הצביע במקור, גם אחרי קיצוץ/השמטה; אם היא נזרקה — האחרונה.
 */
export function deserializeNavHistory(raw, opts = {}) {
  if (typeof raw !== 'string' || !raw || raw.length > NAV_HISTORY_MAX_RAW_CHARS) return createNavHistory();
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return createNavHistory(); }
  if (!parsed || typeof parsed !== 'object' || parsed.v !== NAV_HISTORY_VERSION || !Array.isArray(parsed.list)) return createNavHistory();
  const cap = capOf(opts);
  const maxParse = Math.max(NAV_HISTORY_MAX_PARSE_ENTRIES, cap);
  const curIdx = typeof parsed.cur === 'number' && Number.isInteger(parsed.cur) ? parsed.cur : -1;
  let curKey = null;
  if (curIdx >= 0 && curIdx < parsed.list.length) {
    let curEntry = null;
    try { curEntry = makeEntry(parsed.list[curIdx], 0); } catch (e) { curEntry = null; }
    curKey = curEntry ? curEntry.key : null;
  }
  const source = parsed.list.length > maxParse ? parsed.list.slice(parsed.list.length - maxParse) : parsed.list;
  const seen = new Set();
  let list = [];
  for (const item of source) {
    let e = null;
    try { e = makeEntry(item, 0); } catch (err) { e = null; }
    if (!e || seen.has(e.key)) continue;
    seen.add(e.key);
    list.push(e);
  }
  if (list.length > cap) list = list.slice(list.length - cap);
  if (!list.length) return createNavHistory();
  const found = curKey === null ? -1 : list.findIndex((e) => e.key === curKey);
  return { list, cur: found === -1 ? list.length - 1 : found };
}

/**
 * ניקוי ההיסטוריה מהאחסון — להפעיל ב-hook ההתנתקות המשותף (לפני location.href='/'), כדי שעובדת שנכנסת
 * באותו טאב לא תראה תוויות (שמות לקוחות) של העובדת הקודמת. בלי DOM: מקבל אובייקט אחסון (ברירת מחדל
 * globalThis.sessionStorage כשקיים). לעולם לא זורק. מחזיר true אם נמחק.
 */
export function clearNavHistoryStorage(storage) {
  const st = storage !== undefined ? storage : (typeof globalThis !== 'undefined' ? globalThis.sessionStorage : undefined);
  if (!st || typeof st.removeItem !== 'function') return false;
  try { st.removeItem(NAV_HISTORY_STORAGE_KEY); return true; } catch (e) { return false; }
}
