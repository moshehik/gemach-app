// lib/schedule/print/pages/PP-08.js — "מדבקות שמלה" (דף 08): מדבקה לכל שמלה להדבקה על הקולב או השקית, לא טבלה.
//
// העיצוב: דפי-הדפסה-עיצוב.html, p08(): רשת 3 על 6 (60x39.6 מ"מ), כותרת צרה. במדבקה: מספר ההזמנה בגדול + תג
// ("משלוח" מלא / "איסוף · <סניף>"), שם הלקוחה, דגם · מידה, "אירוע <תאריך עברי> · שמלה k מתוך N [· יש תיקון]" וברקוד פריט
// PRP-<הזמנה>-<k>. ההחלטות: PP-08 "כן, כמו שהוא"; הברקוד בכותרת = ALL-PRP-YYMMDD.
// מזין: שלב 4 (prep) - כל הפריטים של ההזמנה. extras: 'itemInfo' (מספר הפריט בהזמנה + האם יש בו תיקון), 'orderInfo'
// (סוג משלוח: ה-loaders של הלו״ז לא נושאים isDelivery בשורת ההכנה).
import { hShort, cnt } from '../format';
import { itemCode } from '../barcode';
import { modelLabel, seqOf, stageRows, rowIdentity } from '../repairItems';

export const SHEET_NAME = 'מדבקות שמלה';
export const STICKERS_PER_PAGE = 18;

function isDeliveryOut(info) {
  const d = info && info.delivery;
  return !!(d && d.isDelivery && d.direction !== 'חזור');
}

export function build({ day, page, extras }) {
  const info = (extras && extras.orderInfo) || {};
  const itemInfo = (extras && extras.itemInfo) || {};
  const labels = [];
  for (const r of stageRows(day, 'prep')) {
    const id = rowIdentity(r);
    const eventKey = r.eventKey || day.date;
    const delivery = isDeliveryOut(info[r.orderId]);
    const branch = r.pickupBranch || r.branch || '';
    const total = r.dressCount || (r.items || []).length;
    (r.items || []).forEach((it, pos) => {
      const k = seqOf(extras, r.orderId, it.orderItemId, pos);
      const meta = itemInfo[r.orderId] && itemInfo[r.orderId][it.orderItemId];
      labels.push({
        orderId: r.orderId, n: k, total, code: itemCode(page.barcode.prefix, r.orderId, k),
        name: id.name, eventKey, eventShort: hShort(eventKey),
        model: modelLabel(it), size: it.size === null || it.size === undefined ? '' : String(it.size),
        delivery, tag: delivery ? 'משלוח' : branch ? 'איסוף · ' + branch : 'איסוף',
        hasRepair: !!(meta && meta.alt),
      });
    });
  }
  labels.sort((a, b) => a.orderId - b.orderId || a.n - b.n);
  return {
    title: 'מדבקות שמלה',
    sub: 'מדבקה לכל שמלה, להדבקה על הקולב או השקית',
    sum: cnt(labels.length, 'מדבקה אחת', 'מדבקות'),
    empty: labels.length === 0,
    perPage: STICKERS_PER_PAGE,
    labels,
    totals: { labels: labels.length, orders: new Set(labels.map((l) => l.orderId)).size },
  };
}

export function toRows(data) {
  return data.labels.map((l) => ({
    'הזמנה': l.orderId,
    'לקוחה': l.name,
    'דגם': l.model,
    'מידה': l.size,
    'אירוע': l.eventKey ? l.eventKey.split('-').reverse().join('/') : '',
    'שמלה': l.n,
    'מתוך': l.total,
    'משלוח / איסוף': l.tag,
    'יש תיקון': l.hasRepair ? 'כן' : '',
    'ברקוד פריט': l.code,
  }));
}
