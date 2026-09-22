'use client';

import { verifyPin } from './modern/mocAuth';

// שליחת החזרה ל-/api/returns/scan, כולל הטיפול ב-require_approval_for_early_return
// (lib/earlyReturnGuard.js): כשהשרת דוחה החזרה של פריט בהזמנה שתאריך האירוע שלה עדיין
// לא הגיע (409 + earlyReturn) מציגים אישור מנהל ושולחים שוב עם ה-pin - אותו דפוס בדיוק
// כמו postRentalRent/postRentalReturn ב-components/orders/modern/rentalToggle.js.
// מחזיר { res, data } של הניסיון האחרון - הקורא ממשיך לטפל בתגובה כרגיל (res.ok / data.error).
export async function postReturnScan({ barcode, orderId }) {
  const post = (extra = {}) => fetch('/api/returns/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode, ...(orderId ? { orderId } : {}), ...extra })
  });

  let res = await post();
  for (let attempt = 0; attempt < 3; attempt++) {
    let data = null;
    try { data = await res.json(); } catch (e) { /* גוף לא תקין */ }
    if (res.ok || res.status !== 409 || !data?.earlyReturn) return { res, data };

    const authResult = await verifyPin(`${data.error}\nלהחזיר בכל זאת? נדרש אישור מנהל.`, 'feature:early_return_approval');
    if (!authResult) return { res, data: { ...data, cancelled: true } };
    res = await post({ overridePin: authResult.pin, overrideEmployeeId: authResult.employeeId });
  }
  return { res, data: { error: 'אישור המנהל נכשל - ההחזרה בוטלה.' } };
}
