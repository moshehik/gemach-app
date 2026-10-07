// lib/customerNotesForPrint.js - "הערות הלקוח" להדפסת הכנה (דיווח b61a7ca5, נווה יעקב; app/print/order/page.js, print_prep_customer_notes).
// Customer.notes מכיל גם שורות ידניות (מה שהצוות כתב) וגם שורות אוטומטיות שהמערכת מוסיפה
// ("[12.3.2026] אוטומטי: שמלה 44012 (הזמנה 53300) ...", app/api/returns/report-issue). בהדפסה מדפיסים רק את הידניות -
// אותו regex כמו AUTO_NOTE_RE ב-app/components/customer-card/customerCardLogic.js (נשמר כאן בנפרד כדי שדף ההדפסה לא ייבא את כרטיס הלקוח).
export const AUTO_CUSTOMER_NOTE_RE = /\[(\d{1,2}\.\d{1,2}\.\d{4})\] אוטומטי: שמלה (\d+) \(הזמנה (\d+)\) (.*)/;

/** הטקסט הידני של הערות הלקוח (שורות ריקות והשורות האוטומטיות מוסרות). מחרוזת ריקה אם אין. */
export function manualCustomerNotes(notes) {
  if (typeof notes !== 'string') return '';
  return notes
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !AUTO_CUSTOMER_NOTE_RE.test(l))
    .join('\n');
}
