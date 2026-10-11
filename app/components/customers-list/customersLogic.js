// customersLogic.js - הלוגיקה הטהורה של רשימת הלקוחות לניהול (/admin/customers-list), נבדקת ב-scripts/test_a5_orders_customers_lists.mjs.
// בלי React ובלי alias: מיפוי הבחירה בחלון "סינון" / מיון / חיפוש -> פרמטרי ה-API (/api/admin/customers-list), בניית אפשרויות הסינון עם הספירות
// מהשרת, שורת הרשימה ("זוגות" אייקון + ערך - אפס לא מוצג) ומפרט גיליון ההדפסה / PDF ("רשימת לקוחות").
export const PAGE_SIZE = 50;
export const EXPORT_MAX = 5000;

export const DEBT_OPTIONS = [{ k: 'yes', l: 'עם חוב פתוח', i: 'cash' }];
export const MISSING_OPTIONS = [
  { k: 'any', l: 'חסרים שדות חובה', i: 'alert' },
  { k: 'email', l: 'אין מייל', i: 'mail' },
  { k: 'phone', l: 'אין טלפון', i: 'phone' },
  { k: 'id', l: 'אין תעודת זהות', i: 'key' },
];
export const REGS_OPTIONS = [
  { k: 'signed', l: 'חתמו על התקנון', i: 'check' },
  { k: 'unsigned', l: 'לא חתמו על התקנון', i: 'ban' },
];
export const BLOCKED_OPTIONS = [
  { k: 'yes', l: 'חסומים', i: 'ban' },
  { k: 'no', l: 'לא חסומים', i: 'check' },
];
export const ORDERS_OPTIONS = [
  { k: 'active', l: 'עם הזמנות פעילות', i: 'bag' },
  { k: 'has', l: 'עם הזמנות', i: 'file' },
  { k: 'none', l: 'בלי הזמנות', i: 'ban' },
];
export const FIRST_OPTIONS = [
  { k: 'd30', l: 'ב-30 הימים האחרונים', i: 'cal' },
  { k: 'd90', l: 'ב-90 הימים האחרונים', i: 'cal' },
  { k: 'y1', l: 'בשנה האחרונה', i: 'cal' },
];

/** קבוצות הסינון (מצב שרת: count מהשרת; עוד לא נטען = '' = גלוי בלי מספר). "לקוח חדש" = הזמנה ראשונה בתקופה (ל-Customer אין תאריך יצירה). */
export function buildCustomerFilters(counts, { customLabel = 'טווח מותאם…' } = {}) {
  const c = (group, k) => (counts && counts[group] && counts[group][k] !== undefined ? counts[group][k] : (counts ? 0 : ''));
  const wc = (group, opts) => opts.map((o) => ({ ...o, count: c(group, o.k) }));
  return [
    { key: 'debt', label: 'חוב', icon: 'cash', def: [], options: wc('debt', DEBT_OPTIONS) },
    { key: 'missing', label: 'פרטים חסרים', icon: 'alert', def: [], options: wc('missing', MISSING_OPTIONS) },
    { key: 'orders', label: 'הזמנות', icon: 'file', def: [], options: wc('orders', ORDERS_OPTIONS) },
    { key: 'regs', label: 'תקנון', icon: 'note', def: [], options: wc('regs', REGS_OPTIONS) },
    { key: 'blocked', label: 'חסימה', icon: 'ban', def: [], options: wc('blocked', BLOCKED_OPTIONS) },
    {
      key: 'first', label: 'לקוח חדש (הזמנה ראשונה)', icon: 'cal', def: [],
      options: [...wc('first', FIRST_OPTIONS), { k: 'custom', l: customLabel, i: 'sliders', count: counts && counts.first && counts.first.custom !== undefined ? counts.first.custom : '' }],
    },
  ];
}

export const SORTS = [
  { k: 'name', l: 'שם', i: 'user' },
  { k: 'number', l: 'מספר לקוח', i: 'hash' },
  { k: 'orders', l: 'כמות הזמנות', i: 'file' },
  { k: 'debt', l: 'חוב', i: 'cash' },
  { k: 'lastOrder', l: 'הזמנה אחרונה', i: 'cal' },
  { k: 'city', l: 'עיר', i: 'pin' },
  { k: 'phone', l: 'טלפון', i: 'phone' },
  { k: 'email', l: 'מייל', i: 'mail' },
];
export const DEFAULT_SORT = Object.freeze({ k: 'name', dir: 1 });

export function buildCustomersQuery({ sel = {}, sort = DEFAULT_SORT, q = '', page = 1, limit = PAGE_SIZE, custom = null, aiIds = null, variant = 0 } = {}) {
  const out = { page, limit, sort: sort.k, dir: sort.dir > 0 ? 'asc' : 'desc' };
  if (q && q.trim()) out.search = q.trim();
  const list = (k) => (sel[k] || []).filter(Boolean);
  for (const k of ['debt', 'missing', 'regs', 'blocked', 'orders', 'first']) if (list(k).length) out[k] = list(k).join(',');
  if (list('first').includes('custom') && custom) {
    if (custom.from) out.from = custom.from;
    if (custom.to) out.to = custom.to;
  }
  if (aiIds && aiIds.length) out.ids = aiIds.slice(0, 500).join(',');
  if (variant) out.variant = variant;
  return out;
}

export function countsKey(query) {
  const { page, limit, sort, dir, ...rest } = query;
  return JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]]));
}

export const money = (n) => `₪${(Number(n) || 0).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;

export const customerTitle = (r) => `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'לקוח ללא שם';

export function customerRow(d) {
  return { ...d, title: customerTitle(d) };
}

/**
 * ה"זוגות" של שורה 2 לפי הסדר: מספר לקוח, טלפון, מייל, עיר, הזמנות, חוב, הזמנה אחרונה, חסום.
 * ערך ריק / אפס לא מופיע (הזמנות 0, חוב 0, בלי מייל וכו'). dateText מוזרק מהרכיב (תאריך עברי).
 */
export function customerPairs(r, dateText = (x) => x) {
  const out = [];
  if (r.number) out.push({ key: 'num', icon: 'hash', tip: 'מספר לקוח', text: String(r.number), bdi: true });
  if (r.phone) out.push({ key: 'phone', icon: 'phone', tip: 'טלפון', text: r.phone, bdi: true });
  if (r.email) out.push({ key: 'mail', icon: 'mail', tip: 'מייל', text: r.email, bdi: true, mail: true });
  if (r.city) out.push({ key: 'city', icon: 'pin', tip: 'עיר', text: r.city });
  if (r.orders > 0) out.push({ key: 'orders', icon: 'file', tip: 'הזמנות', text: String(r.orders), bold: true });
  if (r.debt > 0) out.push({ key: 'debt', icon: 'cash', tip: 'חוב פתוח', text: money(r.debt), bold: true, warn: true });
  if (r.lastOrder) out.push({ key: 'last', icon: 'cal', tip: 'הזמנה אחרונה', text: dateText(r.lastOrder) });
  if (r.blocked) out.push({ key: 'blocked', icon: 'ban', tip: r.blockedReason ? `חסום: ${r.blockedReason}` : 'חסום מהזמנות חדשות', text: 'חסום' });
  return out;
}

/* -------------------------- גיליון ייצוא / הדפסה / PDF -------------------------- */

export const SHEET_TITLE = 'רשימת לקוחות';

/**
 * מפרט הגיליון: עמודות מס׳ לקוח, שם, טלפון, מייל, עיר; "הזמנות" ו"חוב" רק כשיש בהן ערך בשורה כלשהי ברשימה (לא עמודות ריקות),
 * בלי כפילויות (הכתובת המלאה לא בגיליון), סיכום פעם אחת בסוף (מספר לקוחות; סך חוב כשיש חוב).
 */
export function buildCustomersSheet(rows, filterText) {
  const list = rows || [];
  const hasOrders = list.some((r) => r.orders > 0);
  const hasDebt = list.some((r) => r.debt > 0);
  const columns = [
    { key: 'number', label: 'מס׳ לקוח', align: 'center' },
    { key: 'name', label: 'שם' },
    { key: 'phone', label: 'טלפון' },
    { key: 'email', label: 'מייל' },
    { key: 'city', label: 'עיר' },
    ...(hasOrders ? [{ key: 'orders', label: 'הזמנות', align: 'center' }] : []),
    ...(hasDebt ? [{ key: 'debt', label: 'חוב', align: 'end', money: true }] : []),
  ];
  const sheetRows = list.map((r) => ({
    number: r.number || '', name: customerTitle(r), phone: r.phone || '', email: r.email || '', city: r.city || '',
    ...(hasOrders ? { orders: r.orders > 0 ? r.orders : '' } : {}), ...(hasDebt ? { debt: r.debt > 0 ? r.debt : '' } : {}),
  }));
  return {
    title: SHEET_TITLE, subtitle: filterText || '', groupBy: null, columns, rows: sheetRows,
    totals: { count: list.length, debt: list.reduce((s, r) => s + (r.debt > 0 ? r.debt : 0), 0) }, hasOrders, hasDebt,
  };
}

export function sheetFlatRows(sheet) {
  return { head: sheet.columns.map((c) => c.label), rows: sheet.rows.map((r) => sheet.columns.map((c) => r[c.key])) };
}
