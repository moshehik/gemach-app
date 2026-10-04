// לוגיקה טהורה של דף הבית החדש (HomeA5): כותרת, עיצוב תוצאות החיפוש הכללי, החיפוש החכם (תגיות,
// היסטוריה, העתקה), טבלאות/מיון, ייצוא. אין כאן DOM, React או רשת — כדי שאפשר יהיה לבדוק ב-node
// (scripts/test_home_logic.mjs). מקור הלוגיקה: public/a5/adapters/ai.js ו-public/a5/index.html
// (אב-טיפוס מחובר); הכללים של הדף הישן: app/components/home/LegacyHome.js.

import { hebFromInstant } from './homeDates.js';

export const DEFAULT_TITLE = 'ברוכים הבאים לגמ״ח';

const str = (v) => (v === null || v === undefined ? '' : String(v));

/* ---------- כותרת ---------- */

// כותרת הדף בשתי שורות: { hi, q }. hi = "שלום [שם]," (סלמון), q = השורה השנייה (כחול).
//  - הגדרה ריקה → "ברוכים הבאים לגמ״ח" בשורה אחת (החלטת הבעלים).
//  - הגדרה בצורת "שלום! מה תרצי לחפש?" → מפוצלת בסימן הקריאה; "שלום" הופך ל"שלום [שם פרטי]," כשיש עובדת מחוברת
//    (כמו homeTitleHtml בעיצוב).
//  - הגדרה אחרת (בלי "!") ועובדת מחוברת → "שלום [שם]," ומתחת טקסט ההגדרה (ר' V1-RELEASE-PLAN, החלטה על פריט 11).
//  - נוסח ברירת המחדל הישן של האתר ("ברוכים הבאים למערכת ניהול הגמ"ח", home_welcome_title שנשמר בהגדרות) נחשב "לא הותאם":
//    מוצג הנוסח המוסכם ("שלום [שם]," + "מה תרצי לחפש?"), בלי לשנות את ההגדרה עצמה ובלי לגעת בדף הבית הישן. השוואה אחרי
//    נרמול גרשיים/גרש/רווחים (", ״, ”, “, ''), רווח קשיח ורווחים כפולים.
export const LEGACY_DEFAULT_TITLE = 'ברוכים הבאים למערכת ניהול הגמ"ח';
export const DESIGNED_TITLE = 'שלום! מה תרצי לחפש?';
export function normalizeTitleForCompare(v) {
  return str(v)
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000\u200e\u200f]/g, ' ') // רווח קשיח / רווחים צרים / סימני כיוון
    .replace(/[\u05f4\u201c\u201d\u201e\u201f\u2033\u02ba\uff02\u2018\u2019\u05f3']/g, '"') // ״ " " „ ‟ ″ ʺ ＂ ' ' ׳ '
    .replace(/"{2,}/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
const LEGACY_DEFAULT_NORMALIZED = normalizeTitleForCompare(LEGACY_DEFAULT_TITLE);
export function isLegacyDefaultTitle(title) {
  return normalizeTitleForCompare(title) === LEGACY_DEFAULT_NORMALIZED;
}

export function buildGreeting(rawTitle, firstName) {
  const t = isLegacyDefaultTitle(rawTitle) ? DESIGNED_TITLE : str(rawTitle).trim();
  const name = str(firstName).trim();
  if (!t) return { hi: null, q: DEFAULT_TITLE };
  const m = /^([^!]*)!\s*(.*)$/.exec(t);
  if (m && m[2]) {
    let hi = m[1].trim();
    if (hi === 'שלום' && name) hi = 'שלום ' + name + ',';
    return { hi: hi || null, q: m[2] };
  }
  if (name) return { hi: 'שלום ' + name + ',', q: t };
  return { hi: null, q: t };
}

/* ---------- קישורים מתפריט "בית" (2.10.2026): פרמטרים בטוחים ---------- */

// פריטי התפריט "בית" פותחים את דף החיפוש הראשי עם פרמטר: /?scope=<קטגוריה> | /?adv=1 | /?recent=changes | /?recent=mine (ר' lib/menu/buildMenuTree.js).
// הפרמטרים נבדקים מול רשימה סגורה: ערך לא מוכר נזרק ולעולם לא מוצג/מוחדר לדף (הכותרת והתוויות נלקחות מהטבלה למטה, לא מהכתובת).
// via: 'search' = החיפוש הכללי (/api/global-search מחזיר לקוחות / הזמנות / פריטי השכרה) והסינון נעשה על התשובה;
//      'adv' = אין קטגוריה כזאת בחיפוש הכללי — מריצים את תחום החיפוש המתקדם המתאים (/api/a5/adv, adv-b) לפי שם / טלפון / קוד הזמנה.
export const HOME_SCOPES = Object.freeze({
  customers: Object.freeze({ label: 'לקוחות', only: 'בלקוחות', icon: 'user', via: 'search', pick: 'customers' }),
  orders: Object.freeze({ label: 'הזמנות', only: 'בהזמנות', icon: 'file', via: 'search', pick: 'orders' }),
  rentals: Object.freeze({ label: 'השכרות', only: 'בהשכרות', icon: 'bag', via: 'search', pick: 'rentals' }),
  returns: Object.freeze({ label: 'החזרות', only: 'בהחזרות', icon: 'undo', via: 'adv', focus: 'returns' }),
  alterations: Object.freeze({ label: 'תיקונים', only: 'בתיקונים', icon: 'scissors', via: 'adv', focus: 'alterations' }),
});
export const HOME_RECENT_VALUES = Object.freeze(['changes', 'mine']); // changes = רשימת '@' (האחרונים שלי); mine = "השינויים שלי" (תצוגת התוצאות של '&')
export const HOME_RUN_VALUES = Object.freeze(['debts', 'unsaved']); // /?run= : פעולות "#" שנפתחות בתצוגת תוצאות (חובות = ממתינים לתשלום; unsaved = טיוטות בעמדה) - רשימה סגורה
const MAX_PARAMS_CHARS = 2000;
const MAX_Q_CHARS = 200;

/**
 * פרמטרי הכתובת של דף הבית → { scope, adv, recent, q, any }. רשימה סגורה: scope = אחד ממפתחות HOME_SCOPES, adv = '1' בדיוק,
 * recent = 'changes' | 'mine' בדיוק (בהתנגשות: adv על recent על scope); q = טקסט חיפוש (נחתך ל-200 תווים, ריק = null). כל השאר מתעלמים ממנו. any = יש הוראה חוקית (scope/adv/recent).
 * @param {string|URLSearchParams} search מחרוזת query (עם או בלי '?')
 */
export function parseHomeParams(search) {
  const out = { scope: null, adv: false, recent: null, run: null, q: null, emp: null, any: false };
  let params;
  try {
    params = search instanceof URLSearchParams ? search : new URLSearchParams(str(search).slice(0, MAX_PARAMS_CHARS).replace(/^\?/, ''));
  } catch { return out; }
  const scope = params.get('scope');
  if (scope !== null && Object.prototype.hasOwnProperty.call(HOME_SCOPES, scope)) out.scope = scope;
  if (params.get('adv') === '1') out.adv = true;
  const recent = params.get('recent');
  if (recent !== null && HOME_RECENT_VALUES.includes(recent)) out.recent = recent;
  const run = params.get('run');
  if (run !== null && HOME_RUN_VALUES.includes(run)) out.run = run;
  const q = params.get('q');
  if (q !== null && q.trim()) out.q = q.slice(0, MAX_Q_CHARS);
  // emp = מזהה העובדת שהנהלה בחרה ב"השינויים שלי" (רק יחד עם recent=mine; השרת הוא שמחליט אם מותר - בלי הרשאה חוזרים לרשימה של עצמה)
  const emp = params.get('emp');
  if (emp !== null && out.recent === 'mine' && /^[A-Za-z0-9_-]{1,64}$/.test(emp)) out.emp = emp;
  // הוראה אחת בכל פעם: adv עדיף על recent, ו-recent על scope (כדי שהכתובת, הכותרת והדגשת התפריט יתאימו זה לזה)
  if (out.adv) { out.recent = null; out.run = null; out.scope = null; out.emp = null; } else if (out.recent) { out.run = null; out.scope = null; } else if (out.run) out.scope = null;
  if (out.recent !== 'mine') out.emp = null;
  out.any = !!(out.scope || out.adv || out.recent || out.run);
  return out;
}

/** כותרת הקטגוריה: { label, rest } = "<קטגוריה> - מה תרצי לחפש?"; null לקטגוריה לא מוכרת. התווית רק מהטבלה, לא מהקלט. */
/** מפתח יציב להוראה (לזיהוי "אותה הוראה שכבר הוחלה"). */
export const homeDirectiveKey = (dir) => (dir.adv ? 'adv' : dir.recent ? 'recent:' + dir.recent + (dir.emp ? ':' + dir.emp : '') : dir.run ? 'run:' + dir.run : dir.scope ? 'scope:' + dir.scope : '');

export const SCOPE_TITLE_REST = 'מה תרצי לחפש?';
export function homeScopeTitle(scope) {
  const def = typeof scope === 'string' && Object.prototype.hasOwnProperty.call(HOME_SCOPES, scope) ? HOME_SCOPES[scope] : null;
  return def ? { label: def.label, rest: SCOPE_TITLE_REST, text: def.label + ' - ' + SCOPE_TITLE_REST } : null;
}

/** תשובת החיפוש הכללי (אחרי normalizeSearch) מוגבלת לקטגוריה; קטגוריה בלי via:'search' או לא מוכרת — התשובה כמות שהיא. לא משנה את הקלט. */
export function applyScope(res, scope) {
  const def = typeof scope === 'string' && Object.prototype.hasOwnProperty.call(HOME_SCOPES, scope) ? HOME_SCOPES[scope] : null;
  if (!res || !def || def.via !== 'search') return res;
  return { customers: [], orders: [], rentals: [], [def.pick]: res[def.pick] || [] };
}

/**
 * טקסט חופשי → שדות החיפוש המתקדם לקטגוריות "החזרות" / "תיקונים" (אין להן חיפוש כללי): ספרות בלבד, 7 ויותר = טלפון (פרטי לקוח),
 * פחות מזה = קוד הזמנה; אחרת שם לקוח. מחזיר null לטקסט ריק. (חיפוש לפי ברקוד/דגם בקטגוריות האלה — דרך "חיפוש מתקדם".)
 */
export function scopedAdvFields(text) {
  const t = str(text).trim().slice(0, MAX_Q_CHARS);
  if (!t) return null;
  const digits = t.replace(/[\s-]/g, '');
  if (/^\d+$/.test(digits)) return digits.length >= 7 ? { cinfo: digits } : { oid: digits };
  return { name: t };
}

/* ---------- חיפוש כללי: נרמול התשובה ---------- */

// כמו A5.search ב-public/a5/adapters/ai.js. השרת כבר מגביל ל-50 לכל סוג; החיתוך ל"עוד N" נעשה בתצוגה.
// חשוב: רק שדות התצוגה נשמרים — לא מעבירים הלאה שדות נוספים שהשרת עשוי להחזיר (ר' ממצא global-search).
// מצב פריט בהזמנה לפי הדגלים: מושכר עכשיו / הוחזר / טרם נלקח (אותו ניסוח גם בחיפוש המהיר - lib/quickSearchResults.js)
export function rentalStateLabel(r) {
  if (r.isTaken && !r.isReturned) return 'מושכר עכשיו';
  if (r.isReturned) return 'הוחזר';
  return 'טרם נלקח';
}

export function normalizeSearch(d) {
  const data = d || {};
  const customers = (data.customers || []).map((c) => ({
    n: [c.firstName, c.lastName].filter(Boolean).join(' '),
    nr: [c.lastName, c.firstName].filter(Boolean).join(' '),
    p: str(c.phone1),
    c: str(c.city),
    id: c.id,
    url: '/customers/' + c.id,
  }));
  const orders = (data.orders || []).map((o) => ({
    n: [o.firstName, o.lastName].filter(Boolean).join(' '),
    nr: [o.lastName, o.firstName].filter(Boolean).join(' '),
    id: o.orderId,
    h: str(o.eventDateHebrew),
    t: Number(o.totalAmount) || 0,
    i: Number(o.itemCount) || 0,
    st: str(o.status),
    uuid: o.id,
    url: '/orders/' + o.orderId,
  }));
  // ברקוד אחד חוזר בהשכרות רבות לאורך השנים (4.10.2026): לכל פריט גם הלקוחה ותאריך האירוע של ההזמנה, כדי שאפשר
  // יהיה להבדיל בין השורות. תאריך עברי בלבד: הטקסט השמור בהזמנה, ואם אין (נתונים ישנים) — חישוב מ-eventDate לפי יום ישראלי.
  const rentals = (data.rentals || []).map((r) => ({
    n: str(r.catalogName || r.description),
    b: str(r.barcode || r.catalogBarcode),
    s: str(r.sizeText),
    orderId: r.orderId,
    url: '/orders/' + r.orderId,
    cn: [r.firstName, r.lastName].map((x) => str(x).trim()).filter(Boolean).join(' '),
    h: str(r.eventDateHebrew).trim() || hebFromInstant(r.eventDate),
    ...(typeof r.isTaken === 'boolean' ? { rs: rentalStateLabel(r) } : {}),
  }));
  return { customers, orders, rentals };
}

export const resultsCount = (res) => (res ? res.customers.length + res.orders.length + res.rentals.length : 0);

// סטטוס הזמנה לפי Order.status הגולמי: 4 ערכים; כל השאר (כולל ריק) = "פעיל". [מחלקה, אייקון]
export const ORDER_STATUS_STYLE = {
  'הוחזר': ['ok', 'check'],
  'מושכר': ['', 'bag'],
  'בוטל': ['warn', 'x'],
  'שולם': ['ok', 'wallet'],
};
export function orderStatus(st) {
  const s = ORDER_STATUS_STYLE[st];
  return { cls: s ? s[0] : '', icon: s ? s[1] : 'clock', label: st || 'פעיל' };
}

// מצב פריט (rentalStateLabel) → תגית כמו סטטוס ההזמנה: [מחלקה, אייקון]. מה שלא מוכר — בלי תגית.
export const RENTAL_STATE_STYLE = {
  'מושכר עכשיו': ['', 'bag'],
  'הוחזר': ['ok', 'check'],
  'טרם נלקח': ['', 'clock'],
};
export function rentalStatus(label) {
  const s = Object.prototype.hasOwnProperty.call(RENTAL_STATE_STYLE, label) ? RENTAL_STATE_STYLE[label] : null;
  return s ? { cls: s[0], icon: s[1], label } : null;
}

// רשימה מאוחדת אחת (לקוחות, הזמנות, פריטים) — כל שורה מציינת מה היא
export function unifiedRows(res) {
  if (!res) return [];
  return [
    ...res.customers.map((x) => ({ key: 'c' + x.id, kind: 'לקוח', icon: 'user', title: x.n, url: x.url, phone: x.p, city: x.c })),
    ...res.orders.map((x) => ({ key: 'o' + x.uuid + '-' + x.id, kind: 'הזמנה', icon: 'file', title: x.n, url: x.url, orderId: x.id, eventHeb: x.h, status: orderStatus(x.st) })),
    ...res.rentals.map((x, i) => ({
      key: 'r' + i + '-' + x.orderId + '-' + x.b, kind: 'פריט', icon: 'dress', title: x.n, url: x.url, barcode: x.b, size: x.s, state: x.rs || '',
      orderId: x.orderId, customer: x.cn || '', eventHeb: x.h || '', status: rentalStatus(x.rs),
    })),
  ];
}

// "הזמנה" ו"לקוח" (4.10.2026) — רק לשורות פריט: ההזמנה שבה הפריט הושכר ושם הלקוחה (בשורת הזמנה המספר כבר ב"מזהה" והשם ב"שם").
export const TABLE_COLUMNS = ['סוג', 'שם', 'טלפון', 'עיר', 'מזהה / ברקוד', 'הזמנה', 'לקוח', 'תאריך אירוע', 'סטטוס / מידה'];

// שורות הטבלה (מערך תאים לכל שורה, באותו סדר כמו TABLE_COLUMNS) + קישור לשורה
export function tableRecords(rows) {
  return rows.map((r) => {
    if (r.kind === 'לקוח') return { url: r.url, cells: ['לקוח', r.title, r.phone, r.city, '', '', '', '', ''] };
    if (r.kind === 'הזמנה') return { url: r.url, cells: ['הזמנה', r.title, '', '', '#' + r.orderId, '', '', r.eventHeb, r.status.label] };
    const st = [r.state, r.size ? 'מידה ' + r.size : ''].filter(Boolean).join(' · ');
    return { url: r.url, cells: ['פריט', r.title, '', '', r.barcode, r.orderId ? '#' + r.orderId : '', r.customer || '', r.eventHeb || '', st] };
  });
}

// מיון עמודה: מספרים לפי ערך, אחרת השוואה עברית. dir: 1 עולה, -1 יורד. לא משנה את הקלט.
export function sortRecords(records, col, dir) {
  const num = (v) => {
    const n = parseFloat(String(v).replace(/[^\d.]/g, ''));
    return Number.isNaN(n) ? null : n;
  };
  return records.slice().sort((a, b) => {
    const x = str(a.cells[col]).trim();
    const y = str(b.cells[col]).trim();
    const nx = num(x);
    const ny = num(y);
    return dir * (nx !== null && ny !== null ? nx - ny : x.localeCompare(y, 'he'));
  });
}

// ייצוא התוצאות הכלליות: אובייקט לכל שורה, מפתחות = כותרות הטבלה
export function exportRecordsForRows(rows) {
  return tableRecords(rows).map((r) => Object.fromEntries(TABLE_COLUMNS.map((c, i) => [c, r.cells[i] || ''])));
}

/* ---------- חיפוש חכם (AI) ---------- */

export const AI_CONTEXT = 'User is in the general system home dashboard.'; // זהה ל-LegacyHome

// מסיר [OPEN_SETTING:key], [OPEN_LINK:route|label] ו-[FILTER:term] מהתשובה ומחזיר אותם בנפרד
export function parseAiTags(content) {
  const text0 = str(content);
  const settingKeys = [];
  const links = [];
  let filter = null;
  let m;
  const rs = /\[OPEN_SETTING:([a-zA-Z0-9_]+)\]/g;
  while ((m = rs.exec(text0)) !== null) settingKeys.push(m[1]);
  const rl = /\[OPEN_LINK:([^\]|]+)\|([^\]]+)\]/g;
  while ((m = rl.exec(text0)) !== null) links.push({ route: m[1].trim(), label: m[2].trim() });
  const rf = /\[FILTER:([^\]]*)\]/g;
  while ((m = rf.exec(text0)) !== null) filter = m[1].trim();
  const t = text0.replace(rs, '').replace(rl, '').replace(rf, '').trim();
  return { t, settingKeys, links, filter };
}

// קישור פנימי בלבד (OPEN_LINK / _actionUrl / קישורי תוצאות) — לא כתובת חיצונית, פרוטוקול, "//" או "/\".
// הדפדפן והנתב מתייחסים ל-"\" כמו "/", ולכן נדחים גם "\", תווי בקרה ורווחים, ו-%5C / %2F בתחילת הנתיב.
// בסוף נבדק גם שפענוח ה-URL נשאר באותו מקור (שומר מפני צורות שלא חזינו מראש).
const INTERNAL_ORIGIN = 'http://internal.invalid';
export function safeInternalRoute(route) {
  const r = str(route).trim();
  if (!r.startsWith('/') || r.startsWith('//')) return '';
  if (/[\\\s\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/.test(r)) return '';
  if (/^\/(%5c|%2f)/i.test(r)) return '';
  try {
    const u = new URL(r, INTERNAL_ORIGIN);
    return u.origin === INTERNAL_ORIGIN ? r : '';
  } catch {
    return '';
  }
}

// הזרקת נוסחאות: תא שמתחיל ב- = + - @ טאב או CR נפתח באקסל כנוסחה. מקדימים גרש.
// מספרים וטלפון רגילים (+972-50-1234567, -5) נשארים כמו שהם.
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^(\+?\d[\d\s-]*|-?\d+([.,]\d+)?)$/;
export function safeCell(v) {
  const s = cellText(v);
  return FORMULA_START.test(s) && !PLAIN_NUMBER.test(s) ? "'" + s : s;
}

// עמודות רגישות (ת"ז, בנק, הוראת קבע, הערות פנימיות): לא מוצגות ולא מיוצאות מתוצאות AI גם אם ה-AI בחר אותן
const SENSITIVE_KEY = /zeout|bank|hok|internalnotes|officenotes|בנק|ת"ז|ת״ז|תעודת זהות|הערות פנימיות|הערות משרד/i;
export const isSensitiveKey = (k) => SENSITIVE_KEY.test(String(k));

// תשובת /api/ai → הודעת בוט. כשל שרת = 'שגיאה בחיפוש חכם.', כשל רשת = 'שגיאת תקשורת.' (כמו הדף הישן)
export function botMessageFromResponse(response) {
  const r = response || {};
  const tags = parseAiTags(r.response);
  const rows = Array.isArray(r.data) && r.data.length > 0 ? r.data : null;
  const link = tags.links[0];
  return {
    t: tags.t,
    raw: str(r.response),
    rows,
    setting: tags.settingKeys[0] || '',
    link: link ? link.label : '',
    linkRoute: link ? safeInternalRoute(link.route) : '',
  };
}
export function botErrorMessage(status) {
  return { err: true, t: status ? 'שגיאה בחיפוש חכם.' : 'שגיאת תקשורת.' };
}

// היסטוריית השיחה לשרת: ללא הודעות שגיאה; בתשובות משתמשים בטקסט המקורי (עם התגיות) כמו הדף הישן
export function chatToHistory(chat) {
  return (chat || [])
    .filter((m) => !m.err)
    .map((m) => ({ role: m.me ? 'user' : 'model', content: m.me ? m.t : (m.raw !== undefined ? m.raw : m.t) }));
}

// עמודות להצגה (בלי _action*)
export function rowColumns(rows) {
  return rows && rows.length ? Object.keys(rows[0]).filter((k) => !k.startsWith('_action') && !isSensitiveKey(k)) : [];
}
export function cellText(v) {
  return v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
}

// העתקת הודעה: הטקסט, ואם יש תוצאות — גם הן (כותרות ושורות מופרדות בטאב, יודבקו נקי באקסל)
export function chatCopyText(m) {
  let t = (m && m.t) || '';
  if (m && m.rows && m.rows.length) {
    const c = rowColumns(m.rows);
    t += '\n\n' + [c.join('\t'), ...m.rows.map((r) => c.map((k) => safeCell(r[k]).replace(/[\t\r\n]+/g, ' ')).join('\t'))].join('\n');
  }
  return t;
}

// שורת תוצאה של AI בתצוגת רשימה: כותרת (עמודת שם/לקוח אם יש, אחרת הראשונה), פרטים וקישור
export function aiRowView(r) {
  const c = rowColumns([r]);
  const titleKey = c.find((k) => /שם|לקוח/.test(k)) || c[0];
  return {
    title: cellText(r[titleKey]),
    parts: c.filter((k) => k !== titleKey && cellText(r[k]) !== '').map((k) => ({ k, v: cellText(r[k]) })),
    url: str(r._actionUrl),
    label: str(r._actionLabel),
  };
}

// סוג השורה לפי כתובת הפעולה שהשרת מחזיר: [תווית, אייקון]
export function aiRowKind(r) {
  const u = str(r._actionUrl);
  if (/^\/orders\//.test(u)) return ['הזמנה', 'file'];
  if (/^\/customers\//.test(u)) return ['לקוח', 'user'];
  if (/dresses/.test(u)) return ['דגם', 'dress'];
  if (/^\/employees\//.test(u)) return ['עובד', 'users'];
  return ['רשומה', 'file'];
}

// כתובת הפעולה של שורת AI — פנימית בלבד
export const aiRowHref = (r) => safeInternalRoute(r && r._actionUrl);

// טקסט תשובה → מקטעים להצגה: טלפון/מייל = כפתור העתקה, "הזמנה N" / "לקוח X" = קישור (בלי HTML גולמי)
const COPY_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+|(?<![\d-])0(?:5\d|7\d|[2-489])[-\s]?\d{3}[-\s]?\d{4}(?!\d))/g;
const LINK_RE = /(הזמנה\s*\d+|לקוח\s*[\w-]+)/g;
export function richSegments(text) {
  const out = [];
  str(text).split(COPY_RE).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1) { out.push({ type: 'copy', value: part.trim() }); return; }
    part.split(LINK_RE).forEach((p) => {
      if (!p) return;
      let m = p.match(/^הזמנה\s*(\d+)$/);
      if (m) { out.push({ type: 'link', value: p, href: '/orders/' + m[1] }); return; }
      m = p.match(/^לקוח\s*([\w-]+)$/);
      if (m) { out.push({ type: 'link', value: p, href: '/customers/' + m[1] }); return; }
      out.push({ type: 'text', value: p });
    });
  });
  return out;
}

/* ---------- ייצוא: Excel / הורדה / הדפסה ---------- */

export const withoutActionKeys = (rows) => (rows || []).map((r) => {
  const o = {};
  Object.keys(r).forEach((k) => { if (!k.startsWith('_action') && !isSensitiveKey(k)) o[k] = r[k]; });
  return o;
});

const csvQuote = (v) => '"' + safeCell(v).replace(/"/g, '""') + '"';

// CSV של טבלה אחת (BOM מוסיף הקורא כדי שייפתח בעברית באקסל)
export function rowsToCsv(rows) {
  const data = withoutActionKeys(rows);
  const c = rowColumns(data);
  return [c.map(csvQuote).join(','), ...data.map((r) => c.map((k) => csvQuote(r[k])).join(','))].join('\r\n');
}

// CSV של שרשור חיפוש חכם מלא: כל שאלה, תשובה וכל טבלה שהופיעה בדרך
export function threadToCsv(chat) {
  const lines = [];
  (chat || []).forEach((m) => {
    if (m.err) return;
    lines.push([csvQuote(m.me ? 'שאלה' : 'תשובה'), csvQuote(m.t || '')].join(','));
    if (m.rows && m.rows.length) {
      const data = withoutActionKeys(m.rows);
      const c = rowColumns(data);
      lines.push(c.map(csvQuote).join(','));
      data.forEach((r) => lines.push(c.map((k) => csvQuote(r[k])).join(',')));
    }
    lines.push('');
  });
  return lines.join('\r\n');
}

export const escapeHtml = (s) => cellText(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// מסמך הדפסה: RTL פשוט, בלי משתני ערכת נושא של האתר (כלל חלונות הדפסה — ר' print-surfaces-conventions)
const PRINT_STYLE = 'body{font-family:Arial,"Segoe UI",sans-serif;margin:16px;color:#000}h1{font-size:18px;margin:0 0 12px}h2{font-size:15px;margin:20px 0 4px}p{margin:0 0 8px;white-space:pre-wrap}'
  + 'table{border-collapse:collapse;width:100%;margin-bottom:8px}th,td{border:1px solid #444;padding:4px 8px;text-align:right;font-size:12px}'
  + 'th{background:#eee}thead{display:table-header-group}tr{page-break-inside:avoid}';
function printTable(rows) {
  const data = withoutActionKeys(rows);
  const c = rowColumns(data);
  return '<table><thead><tr>' + c.map((k) => '<th>' + escapeHtml(k) + '</th>').join('') + '</tr></thead><tbody>'
    + data.map((r) => '<tr>' + c.map((k) => '<td>' + escapeHtml(r[k]) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
}
export function printDocument(title, bodyHtml) {
  return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + escapeHtml(title)
    + '</title><style>' + PRINT_STYLE + '</style></head><body><h1>' + escapeHtml(title) + '</h1>' + bodyHtml + '</body></html>';
}
export const printRowsHtml = (title, rows) => printDocument(title, printTable(rows));
export function printThreadHtml(title, chat) {
  let body = '';
  (chat || []).forEach((m) => {
    if (m.err) return;
    body += '<h2>' + escapeHtml(m.me ? 'שאלה' : 'תשובה') + '</h2><p>' + escapeHtml(m.t || '') + '</p>';
    if (m.rows && m.rows.length) body += printTable(m.rows);
  });
  return printDocument(title, body);
}

/* ---------- "אחרונים" (agy_history) ---------- */

const RECENT_KIND = {
  customer: { label: 'לקוח', icon: 'user', href: (id) => '/customers/' + id },
  order: { label: 'הזמנה', icon: 'file', href: (id) => '/orders/' + id },
  dress: { label: 'דגם', icon: 'dress', href: (id) => '/dashboard/dresses/' + id },
  rental: { label: 'השכרה', icon: 'bag', href: (id) => '/rentals?orderId=' + id },
};
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

// פריטי agy_history (lib/historyManager.js) → שורות "אחרונים". פריט לא מוכר/פגום נזרק.
export function recentRows(history) {
  if (!Array.isArray(history)) return [];
  const out = [];
  history.forEach((x) => {
    if (!x || typeof x !== 'object') return;
    const kind = typeof x.type === 'string' && Object.prototype.hasOwnProperty.call(RECENT_KIND, x.type) ? RECENT_KIND[x.type] : null; // 'constructor' / '__proto__' לא נחשבים סוג
    const id = x.id === undefined || x.id === null ? '' : String(x.id);
    if (!kind || !SAFE_ID.test(id)) return;
    out.push({
      key: x.type + ':' + id,
      kind: kind.label,
      icon: kind.icon,
      title: typeof x.name === 'string' && x.name.trim() ? x.name.trim() : kind.label + ' ' + id,
      sub: typeof x.subtext === 'string' ? x.subtext : '',
      url: kind.href(encodeURIComponent(id)),
      ts: typeof x.timestamp === 'number' ? x.timestamp : 0,
    });
  });
  return out;
}

/* ---------- תחתית האתר ---------- */

// קבוצות הקישורים בתחתית לפי מה שמותר למשתמשת (navGroups מ-/api/a5/boot) — אותם כללים כמו public/a5/adapters/shell.js footer().
// החלטת הבעלים 1.10.2026: כל הפריטים של העיצוב מופיעים (כולל קבוצת "עזרה"); מה שלא קיים / לא מותר מוצג כבוי עם "בקרוב".
export function footerGroups({ navGroups, isHead, authenticated }) {
  const hrefs = new Set((navGroups || []).flatMap((g) => (g.items || []).map((i) => i.href)));
  // כל פריט מהעיצוב מופיע תמיד (#siteFoot ב-דף-הבית.html): פריט שהדף שלו קיים ומותר למשתמשת — קישור רגיל;
  // אחרת (דף שלא נבנה / אין הרשאה) — soon:true, כלומר שורה כבויה עם "בקרוב" (בלי href, לא קישור, לא ניתן למיקוד).
  const L = (label, key, href, ok) => (ok ? { label, key, href } : { label, key, soon: true });
  const nav = [
    L('הזמנות', 'orders', '/orders', hrefs.has('/orders')),
    L('לקוחות', 'customers', '/customers', hrefs.has('/customers')),
    L('שמלות', 'dresses', '/dashboard/dresses', hrefs.has('/dashboard/dresses')),
    L('סיכום כספי', 'dashboard', '/dashboard', !!isHead),
  ];
  // "מדריך למשתמש": אין עדיין דף כזה באתר. "דיווח על תקלה": פעולה (לא קישור) - הרכיב מפעיל את כפתור הדיווח של הסרגל כשהוא קיים, אחרת "בקרוב".
  const help = [
    { label: 'מדריך למשתמש', key: 'guide', soon: true },
    { label: 'דיווח על תקלה', key: 'report', action: 'report' },
  ];
  const me = [
    L('הפרופיל שלי', 'profile', '/profile', !!authenticated),
    L('הגדרות תצוגה', 'display', '/display-settings', !!authenticated),
  ];
  return [{ h: 'ניווט מהיר', links: nav }, { h: 'עזרה', links: help }, { h: 'החשבון שלי', links: me, privacy: true }];
}
