// emailLogsLogic.js - הלוגיקה הטהורה של יומן שליחת המיילים החדש (/admin/site-settings/email-logs), נבדקת ב-scripts/test_a5_email_logs.mjs.
// בלי React ובלי alias: מיפוי הבחירה בחלון "סינון" / מיון / חיפוש -> פרמטרי ה-API (/api/admin/email-logs), אפשרויות הסינון עם הספירות מהשרת,
// "זוגות" אייקון + ערך בשורה 2 (ערך ריק / אפס לא מוצג), ומפרט גיליון ההדפסה / PDF ("יומן שליחת מיילים") וקובץ ה-Excel.
import { ALL_TYPES, STATUS_ICON, STATUS_KEYS, STATUS_WORD, typeIcon, typeLabel } from '../../../lib/adminEmailLogs.js';

export const PAGE_SIZE = 50;
export const EXPORT_MAX = 5000; // תקרת שורות לייצוא מהרשימה (מעל - הודעה לצמצם סינון; תקרת השרת לעמוד ייצוא 500)
export const SHEET_TITLE = 'יומן שליחת מיילים';

/* ------------------------------ אפשרויות הסינון ------------------------------ */

export const STATUS_OPTIONS = STATUS_KEYS.map((k) => ({ k, l: STATUS_WORD[k] === 'נרשם' ? 'נרשם לרשימת תפוצה' : STATUS_WORD[k], i: STATUS_ICON[k] }));
export const TYPE_OPTIONS = ALL_TYPES.map((t) => ({ k: t.id, l: t.label, i: t.icon }));
export const PERIOD_OPTIONS = [
  { k: 'today', l: 'נשלחו היום', i: 'cal' },
  { k: 'past7', l: 'ב-7 הימים האחרונים', i: 'cal' },
  { k: 'past30', l: 'ב-30 הימים האחרונים', i: 'cal' },
  { k: 'pastYear', l: 'בשנה האחרונה', i: 'cal' },
];

/**
 * קבוצות הסינון (מצב שרת: לכל אפשרות count מהשרת). counts = תשובת /counts או null (עוד לא נטען: count '' = האפשרות גלויה בלי מספר).
 * customLabel = כיתוב "טווח מותאם" (עם הטווח שנבחר). הקבוצה "שולח" נבנית מהספירות (עובדים שהיו שולחים); אין אפשרויות כשאין בכלל שולחים.
 */
export function buildEmailFilters(counts, { customLabel = 'טווח מותאם…' } = {}) {
  const c = (group, k) => (counts && counts[group] && counts[group][k] !== undefined ? counts[group][k] : (counts ? 0 : ''));
  const withCount = (group, opts) => opts.map((o) => ({ ...o, count: c(group, o.k) }));
  const out = [
    { key: 'types', label: 'סוג מייל', icon: 'mail', def: [], options: withCount('types', TYPE_OPTIONS) },
    { key: 'statuses', label: 'סטטוס שליחה', icon: 'check', def: [], options: withCount('statuses', STATUS_OPTIONS) },
    {
      key: 'period', label: 'תאריך שליחה', icon: 'cal', def: [],
      options: [...withCount('period', PERIOD_OPTIONS), { k: 'custom', l: customLabel, i: 'sliders', count: counts && counts.period && counts.period.custom !== undefined ? counts.period.custom : '' }],
    },
  ];
  const senders = counts && Array.isArray(counts.senders) ? counts.senders : [];
  if (senders.length) {
    out.push({
      key: 'senders', label: 'נשלח על ידי', icon: 'user', def: [],
      options: senders.map((s) => (s.k === 'none'
        ? { k: 'none', l: 'אוטומטי (בלי עובד)', i: 'gear', count: s.n }
        : { k: s.k, l: s.label || 'עובד', i: 'user', count: s.n })),
    });
  }
  return out;
}

export const SORTS = [
  { k: 'sentAt', l: 'זמן שליחה', i: 'clock' },
  { k: 'to', l: 'נמען', i: 'mail' },
  { k: 'subject', l: 'נושא', i: 'note' },
  { k: 'type', l: 'סוג מייל', i: 'sliders' },
  { k: 'status', l: 'סטטוס', i: 'check' },
  { k: 'files', l: 'קבצים מצורפים', i: 'clip' },
  { k: 'order', l: 'מספר הזמנה', i: 'hash' },
];
export const DEFAULT_SORT = Object.freeze({ k: 'sentAt', dir: -1 }); // זמן שליחה, החדש ראשון

/* ------------------------------ מצב -> פרמטרי API ------------------------------ */

/** הבחירה בחלון הסינון (sel), המיון, החיפוש והעמוד -> אובייקט פרמטרים שטוח. רק מה שנבחר נשלח. custom = { from, to } (YYYY-MM-DD). */
export function buildEmailQuery({ sel = {}, sort = DEFAULT_SORT, q = '', page = 1, limit = PAGE_SIZE, custom = null } = {}) {
  const out = { page, limit, sort: sort.k, dir: sort.dir > 0 ? 'asc' : 'desc' };
  if (q && q.trim()) out.search = q.trim();
  const list = (k) => (sel[k] || []).filter(Boolean);
  for (const k of ['types', 'statuses', 'period', 'senders']) if (list(k).length) out[k] = list(k).join(',');
  if (list('period').includes('custom') && custom) {
    if (custom.from) out.from = custom.from;
    if (custom.to) out.to = custom.to;
  }
  return out;
}

/** מפתח יציב לבקשת הספירות: הכול חוץ מעמוד / מיון / גודל עמוד. */
export function countsKey(query) {
  const { page, limit, sort, dir, ...rest } = query;
  return JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]]));
}

/* ---------------------------------- שורה ---------------------------------- */

/** שורת רשימה: השדות מהשרת + id. line 1 = הנמען. */
export function emailRow(d) {
  return { ...d, id: d.id, title: d.to };
}

/** אייקון קופסת השורה: כשל = אזהרה, רישום לרשימת תפוצה = תיבה, אחרת מעטפה. */
export const rowIcon = (r) => (r.state === 'failed' ? 'alert' : r.state === 'subscribed' ? 'inbox' : 'mail');

/**
 * ה"זוגות" של שורה 2 לפי הסדר: זמן השליחה (תאריך עברי + שעה), סוג, סטטוס (אייקון + מילה), קבצים (רק כשיש), הזמנה (רק כשיש), לקוח (רק כשיש).
 * dateText(iso) -> תאריך עברי, timeText(iso) -> 'HH:MM' (מוזרקים מהרכיב כדי שהלוגיקה תישאר טהורה).
 */
export function emailPairs(r, dateText = (x) => x, timeText = () => '') {
  const out = [];
  const when = [dateText(r.sentAt), timeText(r.sentAt)].filter(Boolean).join(' · ');
  if (when) out.push({ key: 'time', icon: 'clock', tip: 'זמן שליחה', text: when });
  out.push({ key: 'type', icon: typeIcon(r.type), tip: 'סוג המייל', text: typeLabel(r.type) });
  out.push({ key: 'state', icon: STATUS_ICON[r.state] || 'check', tip: 'סטטוס שליחה', text: STATUS_WORD[r.state] || '', warn: r.state === 'failed', bold: r.state === 'failed' });
  if (r.fileCount > 0) out.push({ key: 'files', icon: 'clip', tip: r.fileCount === 1 ? 'קובץ מצורף' : 'קבצים מצורפים', text: String(r.fileCount), bold: true });
  if (r.orderNo) out.push({ key: 'order', icon: 'hash', tip: 'מספר הזמנה', text: String(r.orderNo), bdi: true });
  const cust = r.customerNo != null ? String(r.customerNo) : r.customerName;
  if (cust) out.push({ key: 'cust', icon: 'user', tip: r.customerName ? `לקוח: ${r.customerName}` : 'לקוח', text: cust, bdi: true });
  return out;
}

/** היעד של לחיצה על השורה: כרטיס ההזמנה כשיש מספר הזמנה, אחרת כרטיס הלקוח (UUID רק בכתובת, לא מוצג), אחרת null (השורה נפתחת). */
export function openTarget(r) {
  if (r.orderNo) return `/orders/${r.orderNo}`;
  if (r.customerId) return `/customers/${r.customerId}`;
  return null;
}

/* -------------------------- גיליון ייצוא / הדפסה / PDF -------------------------- */

/** סיבת כשל לגיליון ההדפסה: שגיאות של שרתים חיצוניים מגיעות לעיתים כדף HTML שלם (אלפי תווים) ושוברות את גובה השורה - מורידים תגיות וחותכים (Excel והפירוט בשורה נשארים עם הנוסח המלא). */
export function shortReason(err, max = 140) {
  const t = String(err || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * מפרט הגיליון ל-print/PDF ("יומן שליחת מיילים"): מקובץ לפי יום (עברי), בסדר כרונולוגי; עמודות: שעה, נמען, סוג, סטטוס; עמודת "סיבת הכשל" רק כשיש כשלים.
 * בלי נתון כפול: התאריך בכותרת הקבוצה ולכן העמודה "שעה" בלבד. סיכום פעם אחת (הספירה + כמה נכשלו, רק כשיש).
 * fns: { dayKey(iso)->'YYYY-MM-DD', dayLabel(dayKey)->'יום חמישי ט׳ תשרי תשפ״ז', time(iso)->'HH:MM' }.
 */
export function buildEmailLogSheet(rows, filterText, fns) {
  const list = (rows || []).slice().sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  const hasFail = list.some((r) => r.state === 'failed');
  const groups = [];
  for (const r of list) {
    const dk = fns.dayKey(r.sentAt);
    let g = groups[groups.length - 1];
    if (!g || g.key !== dk) { g = { key: dk, title: fns.dayLabel(dk), rows: [] }; groups.push(g); }
    g.rows.push({ time: fns.time(r.sentAt), to: r.to, type: typeLabel(r.type), state: r.state, status: STATUS_WORD[r.state] || '', reason: r.state === 'failed' ? shortReason(r.error) : '' });
  }
  const columns = [
    { key: 'time', label: 'שעה', align: 'center' },
    { key: 'to', label: 'נמען' },
    { key: 'type', label: 'סוג' },
    { key: 'status', label: 'סטטוס' },
    ...(hasFail ? [{ key: 'reason', label: 'סיבת הכשל' }] : []),
  ];
  return { title: SHEET_TITLE, subtitle: filterText || '', groupBy: 'day', columns, groups, hasFail, totals: { count: list.length, failed: list.filter((r) => r.state === 'failed').length } };
}

/** שורות שטוחות ל-Excel (הנתונים המלאים: נושא, עותק, קבצים, הזמנה, לקוח, שולח, שגיאה). fns: { date(iso)->תאריך עברי, time(iso)->HH:MM }. */
export function emailExcelRows(rows, fns) {
  const head = ['תאריך', 'שעה', 'נמען', 'עותק', 'נושא', 'סוג מייל', 'סטטוס', 'קבצים מצורפים', 'מספר הזמנה', 'לקוח', 'נשלח על ידי', 'שגיאה'];
  const out = (rows || []).map((r) => [
    fns.date(r.sentAt), fns.time(r.sentAt), r.to, r.cc || '', r.subject || '', typeLabel(r.type), STATUS_WORD[r.state] || '', r.files.join(', '),
    r.orderNo || '', [r.customerName, r.customerNo != null ? `#${r.customerNo}` : ''].filter(Boolean).join(' '), r.senderName || '', r.error || '',
  ]);
  return { head, rows: out };
}
