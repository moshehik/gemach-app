// lib/schedule/print/pages/PP-09.js — "צ׳ק ליסט הכנה" (דף 09): טבלה שבה מסמנים בדיקה, גיהוץ, אריזה ותיקון לכל שמלה.
//
// העיצוב: דפי-הדפסה-עיצוב.html, p09(). ההחלטות: PP-09 "כן, כמו שהוא (מרווחים בלבד)"; ברקוד שורה PRP-<הזמנה> (סימון
// ההזמנה כמוכנה) וברקוד כותרת ALL-PRP-YYMMDD. עמודות: הזמנה, לקוחה, שמלות, בדיקה, גיהוץ, אריזה (תיבה לכל שמלה),
// תיקון בוצע (תיבה לכל שמלה כשיש להזמנה תיקון, אחרת קו), סימון. בסוף: "הוכן על ידי / נבדק על ידי".
// מזין: שלב 4 (prep), ממוין לפי מספר הזמנה. extras: 'itemInfo' (האם בהזמנה יש תיקון - שורת ההכנה אינה נושאת תיקונים).
import { cnt, dressesText } from '../format';
import { orderCode } from '../barcode';
import { orderHasAlteration, stageRows, rowIdentity } from '../repairItems';

export const SHEET_NAME = 'צ׳ק ליסט הכנה';

export function build({ day, page, extras }) {
  const rows = stageRows(day, 'prep').map((r) => {
    const id = rowIdentity(r);
    const dresses = r.dressCount || (r.items || []).length;
    return {
      orderId: r.orderId,
      code: orderCode(page.barcode.prefix, r.orderId),
      name: id.name,
      dresses,
      hasRepair: orderHasAlteration(extras, r.orderId),
      notes: r.notes || '',
    };
  }).sort((a, b) => a.orderId - b.orderId);
  const dresses = rows.reduce((s, r) => s + r.dresses, 0);
  return {
    title: 'צ׳ק ליסט הכנה',
    sub: 'בדיקה, גיהוץ ואריזה לכל הזמנה',
    sum: `${cnt(rows.length, 'הזמנה אחת', 'הזמנות')} · ${dressesText(dresses)}`,
    empty: rows.length === 0,
    rows,
    totals: { orders: rows.length, dresses },
  };
}

export function toRows(data) {
  return data.rows.map((r) => ({
    'הזמנה': r.orderId,
    'לקוחה': r.name,
    'שמלות': r.dresses,
    'יש תיקון': r.hasRepair ? 'כן' : '',
    'הערות להזמנה': r.notes,
    'ברקוד הזמנה': r.code,
  }));
}
