// איחוד תוצאות החיפוש המהיר (שורת התפריט העליונה) - משותף לעיצוב הישן (TopbarSearch.js)
// ולחדש (menu/MenuSearchPanel.js).
//
// /api/global-search מחזיר { orders, customers, rentals } אבל שני הפאנלים הציגו רק הזמנות
// ולקוחות, כך שהקלדה/סריקה של ברקוד לא מצאה כלום (פריט נמצא רק ב-rentals). כאן מוסיפים
// להזמנות גם את ההזמנות של פריטים שהברקוד שלהם תואם, כשהחיפוש נראה כמו ברקוד - ספרות בלבד,
// 5 ומעלה (ברקוד = 7 ספרות; מספרים קצרים יותר הם טלפון/מס' הזמנה/קידומת דגם, ושם
// חיפוש חלקי על פני פריטים היה מציף את הרשימה). נדרש (דיווח df035847, נווה יעקב 2026-10-04):
// ברקוד שאינו במצב "מושכר" לא מחזיר שגיאה אלא פשוט מחפש כמו חיפוש הזמנה.

const BARCODE_LIKE = /^\d{5,}$/;

export function isBarcodeLikeQuery(term) {
  return BARCODE_LIKE.test(String(term || '').trim());
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
  if (isBarcodeLikeQuery(cleanTerm)) {
    const seenOrders = new Set(orders.map((o) => o.orderId));
    for (const r of data?.rentals || []) {
      if (!r?.orderId || seenOrders.has(r.orderId)) continue;
      if (!String(r.barcode || '').includes(cleanTerm)) continue;
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

  return [...byBarcode, ...orders, ...customers];
}
