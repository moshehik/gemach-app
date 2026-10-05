// איחוד תוצאות החיפוש המהיר (שורת התפריט העליונה) - משותף לעיצוב הישן (TopbarSearch.js)
// ולחדש (menu/MenuSearchPanel.js).
//
// /api/global-search מחזיר { orders, customers, rentals } אבל שני הפאנלים הציגו רק הזמנות
// ולקוחות, כך שהקלדה/סריקה של ברקוד לא מצאה כלום (פריט נמצא רק ב-rentals). כאן מוסיפים
// להזמנות גם את ההזמנות של פריטים שהברקוד שלהם תואם, כשהחיפוש נראה כמו ברקוד - לפי
// classifyQuery (7-8 ספרות או "ברקוד N" = ראשון; 5-6 ספרות = אחרי מס' ההזמנה; קצר מזה הוא מס' הזמנה/טלפון, ושם חיפוש חלקי על פני פריטים היה מציף את הרשימה). נדרש (דיווח df035847, נווה יעקב 2026-10-04):
// ברקוד שאינו במצב "מושכר" לא מחזיר שגיאה אלא פשוט מחפש כמו חיפוש הזמנה.

import { classifyQuery } from './searchNormalize.js';

// כלל הספרות המשותף (lib/searchNormalize.js classifyQuery, החלטת הבעלים 5.10.2026): 1-4 ספרות = מס' הזמנה; 5-6 = מס' הזמנה קודם וברקוד שני;
// 7-8 = ברקוד. כאן אותו סיווג בדיוק (קודם: /^\d{5,}$/ שהתייחס גם ל-5-6 ספרות כברקוד ראשון).
export function isBarcodeLikeQuery(term) {
  return classifyQuery(String(term || '').trim()).kinds.includes('barcode');
}

/** האם הברקוד הוא הפרשנות הראשונה (7-8 ספרות / "ברקוד N"); false = גיבוי אחרי מס' הזמנה (5-6 ספרות). */
export function isBarcodePrimaryQuery(term) {
  return classifyQuery(String(term || '').trim()).kind === 'barcode';
}

/**
 * @param {{orders?: any[], customers?: any[], rentals?: any[]}} data - תשובת /api/global-search
 * @param {string} term - מחרוזת החיפוש
 * @returns {any[]} הזמנות (כולל אלה שנמצאו לפי ברקוד) ואז לקוחות; לפריט שנמצא לפי ברקוד
 *   יש orderId, id (= orderId, כמו שהקישור /orders/<id> מצפה), barcode, fromBarcode:true
 */
export function combineQuickSearchResults(data, term) {
  const orders = data?.orders || [];
  const customers = data?.customers || [];
  const cleanTerm = String(term || '').trim();

  const byBarcode = [];
  const cls = classifyQuery(cleanTerm);
  const barcodeFirst = cls.kind === 'barcode';
  const digits = cls.barcode && cls.barcode.digits ? cls.barcode.digits : cleanTerm;
  if (cls.kinds.includes('barcode')) {
    const seenOrders = new Set(orders.map((o) => o.orderId));
    for (const r of data?.rentals || []) {
      if (!r?.orderId || seenOrders.has(r.orderId)) continue;
      if (!String(r.barcode || '').includes(digits)) continue;
      seenOrders.add(r.orderId);
      byBarcode.push({
        id: r.orderId,
        orderId: r.orderId,
        barcode: r.barcode,
        stateLabel: typeof r.isTaken === 'boolean' ? (r.isTaken && !r.isReturned ? 'מושכר עכשיו' : r.isReturned ? 'הוחזר' : 'טרם נלקח') : '',
        firstName: '',
        lastName: '',
        fromBarcode: true
      });
    }
  }

  // 7-8 ספרות: הפריטים שנמצאו לפי ברקוד קודם; 5-6 ספרות: ההזמנות (מספר הזמנה) קודם והברקוד אחריהן
  return barcodeFirst ? [...byBarcode, ...orders, ...customers] : [...orders, ...byBarcode, ...customers];
}
