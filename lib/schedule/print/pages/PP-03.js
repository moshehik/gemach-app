// lib/schedule/print/pages/PP-03.js — "דף תיקונים לביצוע" (דף 03): שתי גרסאות (PQ-04 - בחירה בזמן ההדפסה).
//
// העיצוב: תצוגות-עיצוב/דפי-הדפסה-עיצוב.html, p03() (גרסה א) ו-p03b() (גרסה ב). ההחלטות: PP-03 "כן, אופציה גם מקובץ
// לפי דגם ומידה"; PQ-04 שתי הגרסאות; PQ-09 ברקוד לכל פריט (REP-<הזמנה>-<n>) בגרסה ב; הברקוד בכותרת = ALL-REP-YYMMDD.
//   גרסה א: לפי תאריך אירוע, ובתוכו בלוק לכל הזמנה (לקוחה, טלפון, מס׳ הזמנה, ברקוד REP-<הזמנה>, הערות, טבלת פריטים)
//           + שורת סיכום תיקונים (צוואר / אורך / שרוול) לכל תאריך. סדר: תאריך אירוע, לקוחה, הזמנה, דגם, מידה (כמו
//           ההדפסה הקיימת /print/alterations, reportType=alterations_pending).
//   גרסה ב: שורה לכל פריט, מקובץ לפי דגם (שורת קבוצה) ובתוכו לפי מידה, ואז תאריך אירוע; ברקוד פריט בכל שורה.
// מזין: שלב 2 (repair) של getScheduleDay. כמו "טרם בוצעו" בהדפסה הקיימת: פריט שכבר סומן "בוצע" לא מודפס.
// הרשאה: PRINT_ALTERATIONS_PAGE_KEYS (registry.extraPageKeys). extras: 'itemInfo' (מספר פריט בהזמנה).
import { hFull, greg, hShort, cnt, itemsText } from '../format';
import { itemCode, orderCode } from '../barcode';
import { modelLabel, alterationOf, seqOf, stageRows, rowIdentity, sizeCompare, heCompare } from '../repairItems';

export const SHEET_NAME = 'דף תיקונים לביצוע';

function collect(day, extras, page) {
  const out = [];
  for (const r of stageRows(day, 'repair')) {
    const id = rowIdentity(r);
    (r.items || []).forEach((it, pos) => {
      if (it.done) return;
      const a = alterationOf(it);
      const n = seqOf(extras, r.orderId, it.orderItemId, pos);
      out.push({
        orderId: r.orderId, orderCode: orderCode(page.barcode.prefix, r.orderId),
        name: id.name, phone: id.phone, notes: r.notes || '',
        eventKey: r.eventKey || day.date, n, code: itemCode(page.barcode.prefix, r.orderId, n),
        model: modelLabel(it), size: it.size === null || it.size === undefined ? '' : String(it.size),
        neck: a.neck, len: a.len, sleeve: a.sleeve, det: a.det,
      });
    });
  }
  return out;
}

const tally = (items) => ({
  neck: items.filter((x) => x.neck).length,
  len: items.filter((x) => x.len).length,
  sleeve: items.filter((x) => x.sleeve).length,
});
const tallyText = (t) => `כמות תיקוני צוואר: ${t.neck} | כמות תיקוני אורך: ${t.len} | כמות תיקוני שרוול: ${t.sleeve}`;

export function build({ day, page, version, extras }) {
  const items = collect(day, extras, page);
  const orders = new Set(items.map((x) => x.orderId)).size;
  const byModel = version === 'b';
  const base = {
    version: byModel ? 'b' : 'a',
    empty: items.length === 0,
    sum: `${cnt(orders, 'הזמנה אחת', 'הזמנות')} · ${itemsText(items.length)}`,
    totals: { orders, items: items.length, ...tally(items) },
    tallyText: tallyText(tally(items)),
  };

  if (byModel) {
    // דגם -> מידה -> תאריך אירוע -> הזמנה (דטרמיניסטי)
    const sorted = [...items].sort((a, b) => heCompare(a.model, b.model) || sizeCompare(a.size, b.size) || String(a.eventKey).localeCompare(String(b.eventKey)) || a.orderId - b.orderId || a.n - b.n);
    const groups = [];
    for (const it of sorted) {
      let g = groups[groups.length - 1];
      if (!g || g.model !== it.model) { g = { key: it.model, model: it.model, label: it.model, rows: [] }; groups.push(g); }
      g.rows.push({ ...it, eventShort: hShort(it.eventKey) });
    }
    for (const g of groups) g.note = itemsText(g.rows.length);
    return { ...base, title: 'רשימת תיקונים לביצוע · לפי דגם ומידה', sub: 'מקובץ לפי דגם, ובתוכו לפי מידה', groups };
  }

  // גרסה א: תאריך אירוע -> לקוחה -> הזמנה -> דגם -> מידה
  const sorted = [...items].sort((a, b) => String(a.eventKey).localeCompare(String(b.eventKey)) || heCompare(a.name, b.name) || a.orderId - b.orderId || heCompare(a.model, b.model) || sizeCompare(a.size, b.size) || a.n - b.n);
  const days = [];
  for (const it of sorted) {
    let d = days[days.length - 1];
    if (!d || d.key !== it.eventKey) { d = { key: it.eventKey, label: hFull(it.eventKey), greg: greg(it.eventKey), orders: [], items: [] }; days.push(d); }
    d.items.push(it);
    let o = d.orders[d.orders.length - 1];
    if (!o || o.orderId !== it.orderId) { o = { orderId: it.orderId, code: it.orderCode, name: it.name, phone: it.phone, notes: it.notes, rows: [] }; d.orders.push(o); }
    o.rows.push(it);
  }
  for (const d of days) d.tallyText = tallyText(tally(d.items));
  return { ...base, title: 'רשימת תיקונים לביצוע', sub: 'מקובץ לפי תאריך אירוע, ולפי הזמנה', days };
}

function flat(data) {
  const rows = data.version === 'b' ? data.groups.flatMap((g) => g.rows) : data.days.flatMap((d) => d.items);
  return rows;
}

export function toRows(data) {
  return flat(data).map((r) => ({
    'תאריך אירוע': greg(r.eventKey),
    'הזמנה': r.orderId,
    'לקוחה': r.name,
    'טלפון': r.phone,
    'דגם': r.model,
    'מידה': r.size,
    'תיקון צוואר': r.neck ? 'הצרה ' + r.neck : '',
    'תיקון אורך': r.len,
    'תיקון שרוול': r.sleeve ? 'הארכה ' + r.sleeve : '',
    'תיאור תיקון': r.det,
    'הערות להזמנה': r.notes,
    'ברקוד פריט': r.code,
  }));
}
