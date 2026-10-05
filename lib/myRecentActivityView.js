// lib/myRecentActivityView.js - "השינויים שלי": המודל של התצוגה (חלונית & בחיפוש, ותצוגת התוצאות /?recent=mine).
// מודול טהור: בלי React / DOM / רשת (נבדק ב-scripts/test_home_logic.mjs). הנתונים מגיעים מ-GET /api/me/recent-activity
// (lib/myRecentActivity.js); כאן רק סידור לשורות, סינון לפי מה שהוקלד, ונוסח הזמן בעברית (תאריכים עבריים בלבד).
//
// מראה: ר' scratch\mine-build\NOTES.md ו-תצוגות-עיצוב\השינויים-שלי.html (המאושר). שורה = { key, type:'order'|'all'|'retry', kind, icon, title, sub, tail, url }.

import { getHebrewDateString, getIsraelDateKey, toIsraelCalendarDate } from './hebrewDate.js';

export const MINE_POPOVER_LIMIT = 5; // שורות בכל חלק בחלונית (השאר בתצוגת התוצאות המלאה, כפתור "הכל" בצד שמאל של כותרת החלונית)
export const MINE_ALL_LABEL = 'הכל';
export const MINE_OWN_LABEL = 'שלי'; // הבורר של הנהלה: "שלי" = הרשימות של עצמה (ברירת המחדל), שאר השבבים = שם עובדת
export const MINE_URL = '/?recent=mine';
/** כתובת תצוגת התוצאות המלאה; עם who (הנהלה שבחרה עובדת אחרת) נשאר הבחירה: /?recent=mine&emp=<id>. */
export const mineUrl = (who) => (who ? MINE_URL + '&emp=' + encodeURIComponent(who) : MINE_URL);
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
const validRow = (r) => !!r && Number.isSafeInteger(r.orderNumber) && r.orderNumber > 0; // הקישור הוא /orders/<orderNumber> (כמו שאר האפליקציה), לא ה-uuid

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
    url: '/orders/' + r.orderNumber,
  };
}

/**
 * המודל של החלונית / התצוגה המלאה.
 * @param {{data?:{created?:Array,changed?:Array,degraded?:boolean}, state:'idle'|'loading'|'ok'|'error'}} mine
 * @param {{term?:string, limit?:number|null, now?:Date}} opts  limit=null: הכול (התצוגה המלאה)
 * @returns {{state:string, sections:Array<{key,head,count,rows}>, more:object|null, items:Array, none:string, sub:string, note:string, total:number}}
 */
export function buildMineModel(mine, { term = '', limit = MINE_POPOVER_LIMIT, now = new Date(), whoName = '', whoId = null } = {}) {
  const state = mine && mine.state ? mine.state : 'idle';
  const out = { state, sections: [], more: null, items: [], none: '', sub: '', note: whoName ? 'מוצגות רק ההזמנות והשינויים של ' + whoName + '.' : MINE_TEXT.note, total: 0 };
  const data = (mine && mine.data) || {};
  if (state === 'error' || data.degraded) {
    out.state = 'error';
    out.none = MINE_TEXT.error; out.sub = MINE_TEXT.errorSub;
    out.items = [{ key: 'retry', type: 'retry', icon: 'refresh', title: 'נסי שוב', sub: 'טעינה מחדש של הרשימה', tail: '' }];
    return out;
  }
  if (state === 'loading' || state === 'idle') { out.state = 'loading'; out.none = MINE_TEXT.loading; return out; }
  const created = arr(data.created).filter(validRow);
  const changed = arr(data.changed).filter(validRow);
  if (!created.length && !changed.length) {
    out.none = whoName ? 'אין הזמנות או שינויים להצגה עבור ' + whoName : MINE_TEXT.empty;
    out.sub = whoName ? 'ב-60 הימים האחרונים.' : MINE_TEXT.emptySub;
    return out;
  }
  const cr = created.filter((r) => matches(r, term)); const ch = changed.filter((r) => matches(r, term));
  out.total = cr.length + ch.length;
  if (!out.total) { out.none = 'אין התאמה ל“' + term + '”'; return out; }
  const cap = limit == null ? Infinity : limit;
  let shown = 0; let truncated = false;
  for (const [key, list] of [['created', cr], ['changed', ch]]) {
    if (!list.length) continue;
    const rows = list.slice(0, cap).map((r) => rowFor(key, r, now));
    shown += rows.length; if (list.length > cap) truncated = true;
    out.sections.push({ key, head: MINE_HEADS[key], count: list.length, rows });
  }
  out.items = out.sections.flatMap((s) => s.rows);
  // "הכל" (MY-01 + MY-07 ב): כפתור בצד שמאל של כותרת החלונית שפותח את אותן רשימות כתוצאות חיפוש (MINE_URL). מופיע רק כשיש יותר מ-5 באחד החלקים
  // (truncated); כשהכל כבר בחלונית אין כפתור ואין פריט לניווט במקלדת. הציור שלו הוא בכותרת (לא שורה ברשימה).
  const more = { key: 'all', type: 'all', icon: 'arrl', title: MINE_ALL_LABEL, sub: out.total > shown ? 'עוד ' + (out.total - shown) + ' ברשימה המלאה' : 'פתיחה כתוצאות חיפוש', tail: String(out.total), url: mineUrl(whoId) };
  if (limit != null && truncated) { out.more = more; out.items = [...out.items, more]; } // התצוגה המלאה (limit=null) היא כבר ה"הכל"
  return out;
}

/**
 * בורר העובדת של הנהלה (MY-04 ב): שבב "שלי" ראשון + שבב לכל עובדת פעילה אחרת. people = { employees: [{id,name}], meId } מ-GET /api/me/recent-activity/employees.
 * who = מזהה העובדת הנבחרת או null (שלי). מחזיר { chips, whoName } - chips ריק כשאין אחרות (אין מה לבחור; הבורר לא מוצג).
 */
export function buildWhoChips({ people, who = null }) {
  const list = people && Array.isArray(people.employees) ? people.employees : [];
  const meId = people ? people.meId : null;
  const others = list.filter((e) => e && typeof e.id === 'string' && e.id && typeof e.name === 'string' && e.name.trim() && e.id !== meId);
  if (!others.length) return { chips: [], whoName: '' };
  const sel = others.find((e) => e.id === who) || null;
  const chips = [{ id: null, name: MINE_OWN_LABEL, on: !sel }, ...others.map((e) => ({ id: e.id, name: e.name.trim(), on: !!sel && sel.id === e.id }))];
  return { chips, whoName: sel ? sel.name.trim() : '' };
}

/* ---------- תצוגת התוצאות המלאה (/?recent=mine): אותו מבנה כמו תוצאות החיפוש הכללי (HomeResults) ---------- */

export const MINE_TABLE_COLUMNS = Object.freeze(['סוג', 'שם', 'הזמנה', 'מה השתנה', 'מתי']);
export const MINE_KIND_LABEL = Object.freeze({ created: 'חדשה', changed: 'שונתה' });

/** שורות טבלה (מערך תאים לפי MINE_TABLE_COLUMNS + קישור) לחלק אחד של המודל. */
export function mineTableRecords(rows) {
  return arr(rows).map((r) => ({ url: r.url, cells: [MINE_KIND_LABEL[r.kind] || '', r.title, '#' + r.orderNumber, r.detail, r.when || ''] }));
}

/** ייצוא (Excel): אובייקט לכל שורה, כל החלקים ברצף; מפתחות = כותרות הטבלה. */
export function mineExportRecords(sections) {
  return arr(sections).flatMap((s) => mineTableRecords(s.rows).map((r) => Object.fromEntries(MINE_TABLE_COLUMNS.map((c, i) => [c, r.cells[i] || '']))));
}

/** מקטעי דף ההדפסה / ה-PDF (searchPdf.js): חלק לכל רשימה, עמודות לפי מה שמוצג בשורה. */
export function mineSheetSections(sections) {
  return arr(sections).map((s) => ({
    key: s.key, label: s.head, one: 'הזמנה אחת', many: 'הזמנות',
    cols: [{ h: 'שם', w: 34 }, { h: 'מס׳ הזמנה', w: 14, ltr: true }, { h: 'מה השתנה', w: 34 }, { h: 'מתי', w: 18 }],
    rows: arr(s.rows).map((r) => [r.title, '#' + r.orderNumber, r.detail, r.when || '']),
  }));
}
