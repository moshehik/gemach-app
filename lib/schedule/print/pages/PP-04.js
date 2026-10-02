// lib/schedule/print/pages/PP-04.js — "מדבקות תיקון" (דף 04): מדבקה לכל שמלה לתופרות, לא טבלה.
//
// העיצוב: דפי-הדפסה-עיצוב.html, p04() + labelsRep(): רשת 3 על 6 מדבקות (60x39.6 מ"מ) בעמוד A4, כותרת צרה (slim).
// במדבקה: בס״ד + "אירוע <תאריך עברי>", שם הלקוחה, דגם · מידה, התיקונים (צוואר / אורך / שרוול + פירוט) וברקוד פריט
// REP-<הזמנה>-<n> עם הקוד כתוב מתחתיו. ההחלטות: PP-04 "כן, כמו שהוא"; הברקוד בכותרת = ALL-REP-YYMMDD.
// מזין: שלב 2 (repair). כמו "תוויות לתופרות" הקיים (/print/alterations?reportType=labels): רק פריטים שטרם בוצעו, ממוין לפי
// תאריך אירוע, דגם, מידה, שם הלקוחה (labelsRep בעיצוב; ההדפסה הקיימת ממיינת באותו סדר).
// כל 18 מדבקות = עמוד אחד (STICKERS_PER_PAGE); התבנית מחלקת לעמודים, כאן רק הרשימה.
import { hShort, cnt } from '../format';
import { itemCode } from '../barcode';
import { modelLabel, alterationOf, repairText, seqOf, stageRows, rowIdentity, sizeCompare, heCompare } from '../repairItems';

export const SHEET_NAME = 'מדבקות תיקון';
export const STICKERS_PER_PAGE = 18;

export function build({ day, page, extras }) {
  const labels = [];
  for (const r of stageRows(day, 'repair')) {
    const id = rowIdentity(r);
    (r.items || []).forEach((it, pos) => {
      if (it.done) return;
      const a = alterationOf(it);
      const n = seqOf(extras, r.orderId, it.orderItemId, pos);
      const eventKey = r.eventKey || day.date;
      labels.push({
        orderId: r.orderId, n, code: itemCode(page.barcode.prefix, r.orderId, n),
        name: id.name, eventKey, eventShort: hShort(eventKey),
        model: modelLabel(it), size: it.size === null || it.size === undefined ? '' : String(it.size),
        fix: repairText(a), det: a.det,
      });
    });
  }
  labels.sort((a, b) => String(a.eventKey).localeCompare(String(b.eventKey)) || heCompare(a.model, b.model) || sizeCompare(a.size, b.size) || heCompare(a.name, b.name) || a.orderId - b.orderId || a.n - b.n);
  return {
    title: 'מדבקות תיקון',
    sub: 'מדבקה לכל שמלה',
    sum: cnt(labels.length, 'מדבקה אחת', 'מדבקות'),
    empty: labels.length === 0,
    perPage: STICKERS_PER_PAGE,
    labels,
    totals: { labels: labels.length, orders: new Set(labels.map((l) => l.orderId)).size },
  };
}

export function toRows(data) {
  return data.labels.map((l) => ({
    'תאריך אירוע': l.eventKey ? l.eventKey.split('-').reverse().join('/') : '',
    'הזמנה': l.orderId,
    'לקוחה': l.name,
    'דגם': l.model,
    'מידה': l.size,
    'תיקונים': l.fix,
    'פירוט': l.det,
    'ברקוד פריט': l.code,
  }));
}
