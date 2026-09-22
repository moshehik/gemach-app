'use client';

import { verifyPin } from './mocAuth';
import { describeMismatch } from '../../../lib/rentalBarcodeMatch';

// שליחת "השכרה" ל-/api/rentals/toggle, כולל הטיפול ב-enforce_rental_barcode_match:
// כשהשרת דוחה ברקוד שלא תואם לדגם/מידה שהוזמנו (409 + barcodeMismatch) מציגים את
// הפער ומאפשרים עקיפה באישור מנהל (window.customAuthPrompt דרך verifyPin), ואז שולחים
// שוב עם ה-pin - השרת מאמת אותו בעצמו ולא סומך על דגל מהלקוח.
//
// מחזיר { ok: true } בהצלחה, אחרת { ok: false, message } - הקורא אחראי לשחזר את המצב
// האופטימי ב-UI ולהציג את message (או הודעת ברירת מחדל כשהוא null).
export async function postRentalRent(itemId, barcode) {
  const post = (extra = {}) => fetch('/api/rentals/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, action: 'rent', barcode, ...extra })
  });

  let res = await post();
  // עד 3 ניסיונות עקיפה (סיסמה שגויה מקבלת הזדמנות נוספת) - אחרי זה מוותרים.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (res.ok) return { ok: true };

    let data = null;
    try { data = await res.json(); } catch (e) { /* גוף לא תקין - הודעת ברירת מחדל */ }
    if (res.status !== 409 || !data?.barcodeMismatch) return { ok: false, message: null };

    const mismatchMsg = describeMismatch(data.expected, data.scanned);
    const authResult = await verifyPin(
      `${data.overrideRejected ? `${data.error}\n` : `${mismatchMsg}.\n`}להשכיר בכל זאת? נדרש אישור מנהל.`,
      'feature:barcode_mismatch_override'
    );
    if (!authResult) return { ok: false, message: `${mismatchMsg} - ההשכרה בוטלה.` };
    res = await post({ overridePin: authResult.pin, overrideEmployeeId: authResult.employeeId });
  }
  return { ok: false, message: 'אישור המנהל נכשל - ההשכרה בוטלה.' };
}
