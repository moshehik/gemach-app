// ordersLogic.js - הלוגיקה הטהורה של רשימת ההזמנות לניהול (/admin/orders-list), נבדקת ב-scripts/test_a5_orders_customers_lists.mjs.
// בלי React ובלי alias: מיפוי הבחירה בחלון "סינון" / מיון / חיפוש -> פרמטרי ה-API (/api/admin/orders-list), בניית אפשרויות הסינון עם הספירות מהשרת,
// שורת הרשימה ("זוגות" אייקון + ערך בשורה 2 - אפס לא מוצג), ומפרט גיליון ההדפסה / PDF ("דוח הזמנות").
import { STATE_WORD, ORDER_STATE_KEYS } from '../../../lib/adminOrdersList.js';

export const PAGE_SIZE = 50;
export const EXPORT_PAGE = 500;
export const EXPORT_MAX = 5000; // תקרת שורות לייצוא מהרשימה (מעל - הודעה לצמצם סינון; תקרת השרת לעמוד ייצוא 500)

/* ------------------------------ אפשרויות הסינון ------------------------------ */

export const STATE_ICON = Object.freeze({
  upcoming: 'clock', past: 'archive', partRented: 'bag', rented: 'bag', partReturned: 'undo', returned: 'check', deleted: 'trash', draft: 'pencil',
});
export const stateWord = (k) => STATE_WORD[k] || '';
export const stateIcon = (k) => STATE_ICON[k] || 'file';

export const STATE_OPTIONS = ORDER_STATE_KEYS.map((k) => ({ k, l: STATE_WORD[k], i: STATE_ICON[k] }));
export const PAY_OPTIONS = [
  { k: 'debt', l: 'חוב פתוח', i: 'cash' },
  { k: 'credit', l: 'זיכוי ממתין', i: 'wallet' },
  { k: 'settled', l: 'שולם במלואו', i: 'check' },
];
export const DELIVERY_OPTIONS = [
  { k: 'yes', l: 'עם משלוח', i: 'truck' },
  { k: 'no', l: 'בלי משלוח', i: 'ban' },
];
export const PERIOD_OPTIONS = [
  { k: 'today', l: 'אירוע היום', i: 'cal' },
  { k: 'next7', l: 'ב-7 הימים הקרובים', i: 'cal' },
  { k: 'past30', l: 'ב-30 הימים האחרונים', i: 'cal' },
  { k: 'pastYear', l: 'בשנה האחרונה', i: 'cal' },
];

/**
 * קבוצות הסינון (מצב שרת: לכל אפשרות count מהשרת). counts = תשובת /counts או null (עוד לא נטען: count '' = האפשרות גלויה בלי מספר).
 * customLabel = כיתוב "טווח מותאם" (עם הטווח שנבחר); branchNames = שמות הסניפים (רק כשהארגון משתמש בסניפים).
 */
export function buildOrderFilters(counts, { customLabel = 'טווח מותאם…', branchNames = [] } = {}) {
  const c = (group, k) => (counts && counts[group] && counts[group][k] !== undefined ? counts[group][k] : (counts ? 0 : ''));
  const withCount = (group, opts) => opts.map((o) => ({ ...o, count: c(group, o.k) }));
  const out = [
    { key: 'states', label: 'סטטוס הזמנה', icon: 'check', def: [], options: withCount('states', STATE_OPTIONS) },
    { key: 'pays', label: 'תשלום', icon: 'cash', def: [], options: withCount('pays', PAY_OPTIONS) },
    { key: 'delivery', label: 'משלוח', icon: 'truck', def: [], options: withCount('delivery', DELIVERY_OPTIONS) },
    {
      key: 'period', label: 'תאריך אירוע', icon: 'cal', def: [],
      options: [...withCount('period', PERIOD_OPTIONS), { k: 'custom', l: customLabel, i: 'sliders', count: counts && counts.period && counts.period.custom !== undefined ? counts.period.custom : '' }],
    },
  ];
  if (branchNames.length) out.push({ key: 'branches', label: 'סניף', icon: 'store', def: [], options: branchNames.map((b) => ({ k: b, l: b, i: 'store', count: c('branches', b) })) });
  return out;
}

export const SORTS = [
  { k: 'eventDate', l: 'תאריך אירוע', i: 'cal' },
  { k: 'orderId', l: 'מספר הזמנה', i: 'hash' },
  { k: 'customerName', l: 'לקוח', i: 'user' },
  { k: 'orderDate', l: 'תאריך יצירה', i: 'clock' },
  { k: 'total', l: 'סכום', i: 'cash' },
  { k: 'paid', l: 'שולם', i: 'card' },
  { k: 'balance', l: 'יתרה', i: 'wallet' },
  { k: 'itemsCount', l: 'כמות פריטים', i: 'dress' },
  { k: 'status', l: 'סטטוס', i: 'check' },
];
export const DEFAULT_SORT = Object.freeze({ k: 'eventDate', dir: -1 }); // תאריך אירוע, החדש ראשון

/* ------------------------------ מצב -> פרמטרי API ------------------------------ */

/**
 * הבחירה בחלון הסינון (sel), המיון, החיפוש והעמוד -> אובייקט פרמטרים שטוח ל-/api/admin/orders-list.
 * רק מה שנבחר נשלח. custom = { from, to } (YYYY-MM-DD) של "טווח מותאם". aiIds = מספרי הזמנות מ"חיפוש חכם" (או null).
 */
export function buildOrdersQuery({ sel = {}, sort = DEFAULT_SORT, q = '', page = 1, limit = PAGE_SIZE, custom = null, aiIds = null, variant = 0 } = {}) {
  const out = { page, limit, sort: sort.k, dir: sort.dir > 0 ? 'asc' : 'desc' };
  if (q && q.trim()) out.search = q.trim();
  const list = (k) => (sel[k] || []).filter(Boolean);
  for (const k of ['states', 'pays', 'delivery', 'period', 'branches']) if (list(k).length) out[k] = list(k).join(',');
  if (list('period').includes('custom') && custom) {
    if (custom.from) out.from = custom.from;
    if (custom.to) out.to = custom.to;
  }
  if (aiIds && aiIds.length) out.ids = aiIds.slice(0, 500).join(',');
  if (variant) out.variant = variant;
  return out;
}

/** מפתח יציב לבקשת הספירות: הכול חוץ מעמוד / מיון / גודל עמוד (הספירות לא תלויות בהם). */
export function countsKey(query) {
  const { page, limit, sort, dir, ...rest } = query;
  return JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]]));
}

export const toSearchParams = (obj) => {
  const sp = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') sp.set(k, String(v)); });
  return sp;
};

/* ---------------------------------- שורה ---------------------------------- */

export const money = (n) => {
  const v = Number(n) || 0;
  return `₪${v.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
};

/** שם הלקוח להצגה (שורה 1). */
export const orderTitle = (r) => r.customerName || 'לקוח לא ידוע';

/** שורת הזמנה לרשימה: השדות מהשרת + מה שנגזר. */
export function orderRow(d) {
  return { ...d, id: d.orderId, title: orderTitle(d), balance: Math.round(((d.total || 0) - (d.paid || 0)) * 100) / 100 };
}

/**
 * ה"זוגות" של שורה 2 לפי הסדר: מספר הזמנה, תאריך אירוע, פריטים, סטטוס, משלוח, סניף, חוב, זיכוי.
 * ערך אפס / ריק = לא מופיע (פריטים 0, חוב 0, זיכוי 0, בלי משלוח, בלי סניף, בלי תאריך). הסטטוס והמספר תמיד מופיעים.
 * dateText = פונקציה (iso)->טקסט עברי (מוזרקת מהרכיב כדי שהלוגיקה תישאר טהורה).
 */
export function orderPairs(r, dateText = (x) => x) {
  const out = [{ key: 'num', icon: 'hash', tip: 'מספר הזמנה', text: String(r.orderId), bdi: true }];
  if (r.eventDate) out.push({ key: 'event', icon: 'gift', tip: 'תאריך אירוע', text: dateText(r.eventDate) });
  if (r.itemsCount > 0) out.push({ key: 'items', icon: 'dress', tip: 'פריטים', text: String(r.itemsCount), bold: true });
  out.push({ key: 'state', icon: stateIcon(r.state), tip: 'סטטוס הזמנה', text: stateWord(r.state) });
  if (r.isDelivery) out.push({ key: 'delivery', icon: 'truck', tip: 'הזמנה עם משלוח', text: '' });
  if (r.branch) out.push({ key: 'branch', icon: 'store', tip: 'סניף', text: r.branch });
  if (r.debt > 0) out.push({ key: 'debt', icon: 'cash', tip: 'חוב פתוח', text: money(r.debt), bold: true, warn: true });
  if (r.credit > 0) out.push({ key: 'credit', icon: 'wallet', tip: 'זיכוי ממתין ללקוחה', text: money(r.credit), bold: true });
  return out;
}

/** תיאור הפריטים לפירוט: "דגם 240 (36) · דגם 666 (01)". */
export function itemsText(items, total) {
  const list = (items || []).map((i) => (i.size ? `${i.name} (${i.size})` : i.name));
  if (total > list.length) list.push(`ועוד ${total - list.length}`);
  return list.join(' · ');
}

/* -------------------------- גיליון ייצוא / הדפסה / PDF -------------------------- */

export const SHEET_TITLE = 'דוח הזמנות';

/**
 * מפרט הגיליון ל-print/PDF ול-Excel של הרשימה הנוכחית (ההזמנות אחרי חיפוש + סינון + מיון):
 * מקובץ לפי חודש האירוע (עברי), עמודות: מס' הזמנה, לקוח, תאריך אירוע, פריטים, סכום, יתרה (עמודת "חוב" רק אם יש חוב בכלל),
 * סיכומים פעם אחת בסוף. בלי ערכים כפולים: החודש בכותרת הקבוצה ולכן לא נשאר בעמודת התאריך (רק היום).
 * fns: { dayKey(iso)->'YYYY-MM-DD', monthLabel(dayKey)->'תשרי תשפ״ז', dayLabel(dayKey)->'ט׳ תשרי' }.
 */
export function buildOrdersSheet(rows, filterText, fns) {
  const list = (rows || []).slice().sort((a, b) => {
    const x = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
    const y = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
    return x - y || a.orderId - b.orderId;
  });
  const hasDebt = list.some((r) => r.debt > 0);
  const hasCredit = list.some((r) => r.credit > 0);
  const groups = [];
  for (const r of list) {
    const dk = r.eventDate ? fns.dayKey(r.eventDate) : '';
    const title = dk ? fns.monthLabel(dk) : 'ללא תאריך אירוע';
    let g = groups[groups.length - 1];
    if (!g || g.title !== title) { g = { title, rows: [], total: 0, paid: 0, debt: 0 }; groups.push(g); }
    g.rows.push({
      orderId: r.orderId, customer: orderTitle(r), day: dk ? fns.dayLabel(dk) : '', items: r.itemsCount > 0 ? r.itemsCount : '',
      total: r.total, balance: r.debt > 0 ? r.debt : '',
    });
    g.total += r.total; g.paid += r.paid; g.debt += r.debt;
  }
  const columns = [
    { key: 'orderId', label: 'מס׳ הזמנה', align: 'center' },
    { key: 'customer', label: 'לקוח' },
    { key: 'day', label: 'תאריך אירוע' },
    { key: 'items', label: 'פריטים', align: 'center' },
    { key: 'total', label: 'סכום', align: 'end', money: true },
    ...(hasDebt ? [{ key: 'balance', label: 'חוב', align: 'end', money: true }] : []),
  ];
  const totals = {
    count: list.length,
    total: list.reduce((s, r) => s + r.total, 0),
    paid: list.reduce((s, r) => s + r.paid, 0),
    debt: list.reduce((s, r) => s + r.debt, 0),
    credit: list.reduce((s, r) => s + r.credit, 0),
  };
  return { title: SHEET_TITLE, subtitle: filterText || '', groupBy: 'eventMonth', columns, groups, totals, hasDebt, hasCredit };
}

/** שורות שטוחות ל-Excel / ייצוא ברירת המחדל (אותן עמודות; החודש הופך לעמודה כי אין כותרות קבוצה). */
export function sheetFlatRows(sheet) {
  const withBal = sheet.hasDebt;
  const head = ['מס׳ הזמנה', 'לקוח', 'חודש אירוע', 'תאריך אירוע', 'פריטים', 'סכום', ...(withBal ? ['חוב'] : [])];
  const rows = [];
  for (const g of sheet.groups) {
    for (const r of g.rows) rows.push([r.orderId, r.customer, g.title, r.day, r.items, r.total, ...(withBal ? [r.balance] : [])]);
  }
  return { head, rows };
}
