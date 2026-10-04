// lib/myRecentActivityView.js - "השינויים שלי": המודל של התצוגה (חלונית & בחיפוש, ותצוגת התוצאות /?recent=mine).
// מודול טהור: בלי React / DOM / רשת (נבדק ב-scripts/test_home_logic.mjs). הנתונים מגיעים מ-GET /api/me/recent-activity
// (lib/myRecentActivity.js); כאן רק סידור לשורות, סינון לפי מה שהוקלד, ונוסח הזמן בעברית (תאריכים עבריים בלבד).
//
// מראה: ר' scratch\mine-build\NOTES.md ו-תצוגות-עיצוב\השינויים-שלי.html (המאושר). שורה = { key, type:'order'|'all'|'retry', kind, icon, title, sub, tail, url }.

import { getHebrewDateString, getIsraelDateKey, toIsraelCalendarDate } from './hebrewDate.js';

export const MINE_POPOVER_LIMIT = 5; // שורות בכל חלק בחלונית (השאר ב"הצג הכל")
export const MINE_URL = '/?recent=mine';
export const MINE_HEADS = Object.freeze({ created: 'הזמנות חדשות שיצרתי', changed: 'שינויים שעשיתי' });
export const MINE_TEXT = Object.freeze({
  empty: 'עוד לא יצרת או שינית הזמנות',
  emptySub: 'הזמנה חדשה או עריכה של הזמנה קיימת יופיעו כאן.',
  loading: 'טוען את הרשימה…',
  error: 'לא הצלחנו לטעון את הרשימה כרגע',
  errorSub: 'זו לא בעיה אצלך. אפשר לנסות שוב.',
  note: 'מוצגות רק ההזמנות והשינויים שאת עשית.',
});

const DAY_MS = 86400000;
const keyToDays = (k) => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY_MS); };
const HM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** נוסח הזמן: "לפני 12 דק׳" / "לפני שעה" / "היום, 09:40" / "אתמול" / "לפני יומיים" / תאריך עברי ("יט תשרי"). בלי תאריך לועזי. '' אם לא תקין. */
export function whenLabelHe(iso, now = new Date()) {
  if (iso == null || iso === '') return '';
  const t = new Date(iso);
  const n = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(t.getTime()) || Number.isNaN(n.getTime())) return '';
  const min = Math.max(0, (n.getTime() - t.getTime()) / 60000);
  if (min < 60) return `לפני ${Math.max(1, Math.round(min))} דק׳`;
  if (min < 120) return 'לפני שעה';
  const days = keyToDays(getIsraelDateKey(n)) - keyToDays(getIsraelDateKey(t));
  if (days <= 0) return `היום, ${HM.format(t)}`;
  if (days === 1) return 'אתמול';
  if (days === 2) return 'לפני יומיים';
  const a = toIsraelCalendarDate(t);
  const full = a ? getHebrewDateString(new Date(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(), 12)) : '';
  return full.split(' ').slice(0, 2).join(' '); // "יט תשרי" (בלי השנה)
}

const arr = (v) => (Array.isArray(v) ? v : []);
const text = (v) => (typeof v === 'string' ? v : '');
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function matches(r, term) {
  if (!term) return true;
  const t = term.toLowerCase();
  return [r.customerName, String(r.orderNumber), r.lastChangeLabelHe].some((x) => typeof x === 'string' && x.toLowerCase().includes(t));
}

function rowFor(kind, r, now) {
  const created = kind === 'created';
  const when = whenLabelHe(created ? r.createdAt : r.lastChangeAt, now);
  return {
    key: kind + ':' + r.orderNumber,
    type: 'order',
    kind,
    icon: created ? 'plus' : 'pencil',
    title: text(r.customerName) || 'הזמנה ' + r.orderNumber,
    orderNumber: r.orderNumber,
    detail: created ? 'הזמנה חדשה' : text(r.lastChangeLabelHe),
    when,
    url: '/orders/' + encodeURIComponent(r.orderId),
  };
}

/**
 * המודל של החלונית / התצוגה המלאה.
 * @param {{data?:{created?:Array,changed?:Array,degraded?:boolean}, state:'idle'|'loading'|'ok'|'error'}} mine
 * @param {{term?:string, limit?:number|null, now?:Date}} opts  limit=null: הכול (התצוגה המלאה)
 * @returns {{state:string, sections:Array<{key,head,count,rows}>, more:object|null, items:Array, none:string, sub:string, note:string, total:number}}
 */
export function buildMineModel(mine, { term = '', limit = MINE_POPOVER_LIMIT, now = new Date() } = {}) {
  const state = mine && mine.state ? mine.state : 'idle';
  const out = { state, sections: [], more: null, items: [], none: '', sub: '', note: MINE_TEXT.note, total: 0 };
  const data = (mine && mine.data) || {};
  if (state === 'error' || data.degraded) {
    out.state = 'error';
    out.none = MINE_TEXT.error; out.sub = MINE_TEXT.errorSub;
    out.items = [{ key: 'retry', type: 'retry', icon: 'refresh', title: 'נסי שוב', sub: 'טעינה מחדש של הרשימה', tail: '' }];
    return out;
  }
  if (state === 'loading' || state === 'idle') { out.state = 'loading'; out.none = MINE_TEXT.loading; return out; }
  const created = arr(data.created).filter((r) => r && SAFE_ID.test(String(r.orderId)) && Number.isFinite(r.orderNumber));
  const changed = arr(data.changed).filter((r) => r && SAFE_ID.test(String(r.orderId)) && Number.isFinite(r.orderNumber));
  if (!created.length && !changed.length) { out.none = MINE_TEXT.empty; out.sub = MINE_TEXT.emptySub; return out; }
  const cr = created.filter((r) => matches(r, term)); const ch = changed.filter((r) => matches(r, term));
  out.total = cr.length + ch.length;
  if (!out.total) { out.none = 'אין התאמה ל“' + term + '”'; return out; }
  const cap = limit == null ? Infinity : limit;
  let shown = 0;
  for (const [key, list] of [['created', cr], ['changed', ch]]) {
    if (!list.length) continue;
    const rows = list.slice(0, cap).map((r) => rowFor(key, r, now));
    shown += rows.length;
    out.sections.push({ key, head: MINE_HEADS[key], count: list.length, rows });
  }
  out.items = out.sections.flatMap((s) => s.rows);
  if (out.total > shown) {
    const more = { key: 'all', type: 'all', icon: 'arrl', title: 'הצג הכל', sub: 'עוד ' + (out.total - shown) + ' ברשימה המלאה', tail: String(out.total), url: MINE_URL };
    out.more = more; out.items = [...out.items, more];
  }
  return out;
}
