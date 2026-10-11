'use client';

// זרימת הברקוד ברצף (12.10.2026) - צד לקוח. השרת: lib/barcodeFlow.js + GET /api/barcode-flow/resolve (סיווג בלבד, לא משנה כלום).
// ההחזרה וההשכרה עצמן נשארות בחלון "השכרה והחזרה" (RentalReturnModal / useRentalReturn) - אותן קריאות, אותם אישורי מנהל ובדיקות איחור.

/** @returns {Promise<{ ok: boolean, forbidden?: boolean, data?: object }>} ok=false (403 / שגיאת רשת) = להמשיך בהתנהגות הקודמת. */
export async function resolveBarcode(barcode, { rental = false } = {}) {
  try {
    const res = await fetch(`/api/barcode-flow/resolve?barcode=${encodeURIComponent(barcode)}${rental ? '&rental=1' : ''}`, { cache: 'no-store' });
    let data = null;
    try { data = await res.json(); } catch { /* גוף לא תקין */ }
    if (res.ok && data) return { ok: true, data };
    return { ok: false, forbidden: res.status === 403, data };
  } catch {
    return { ok: false };
  }
}

/**
 * הקשת ברקוד בן 7 ספרות בחיפוש המהיר (תפריט A5 / העיצוב הישן). מחליט מה לפתוח:
 *  - פריט מושכר כרגע            -> חלון "השכרה והחזרה" של ההזמנה, והברקוד מוחזר בתוכו (עם בדיקת האיחור וההחזרה המוקדמת);
 *  - פריט פנוי + ההגדרה quick_search_barcode_opens_rental דלוקה -> חלון ההשכרה של ההזמנה שמחכה לדגם/מידה (או בחירה אם כמה);
 *  - אחרת                       -> { handled: false, message } והקורא נשאר בחיפוש (התנהגות קודמת).
 * { legacy: true } = אין הרשאת "השכרות והחזרות" / שגיאת רשת: הקורא ממשיך בדיוק כמו לפני הזרימה הזו.
 *
 * @returns {Promise<{ handled: boolean, legacy?: boolean, message?: string, pick?: Array<object>, newOrder?: boolean }>}
 */
export async function runQuickBarcode(barcode, { openRentalModal }) {
  const info = await resolveBarcode(barcode, { rental: true });
  if (!info.ok || !openRentalModal) return { handled: false, legacy: true };
  const d = info.data;

  if (d.state === 'rented') {
    openRentalModal(d.orderId, { barcode });
    return { handled: true };
  }
  if (d.state === 'not_taken') {
    if (d.rentalEnabled) {
      openRentalModal(d.orderId, { barcode: '' }); // כבר נסרק להזמנה וממתין לאישור - פותחים את חלון ההשכרה שלה
      return { handled: true };
    }
    return { handled: false, message: d.error };
  }
  if (d.state === 'free') {
    if (!d.rentalEnabled) return { handled: false, message: d.lastReturnError || 'הפריט פנוי - לא מושכר כרגע' };
    const list = Array.isArray(d.rentalCandidates) ? d.rentalCandidates : [];
    if (list.length === 1) {
      openRentalModal(list[0].orderId, { barcode });
      return { handled: true };
    }
    if (list.length > 1) return { handled: true, pick: list, message: 'יש כמה הזמנות שמחכות לדגם ולמידה האלה - בחר/י הזמנה' };
    return { handled: false, newOrder: true, message: 'הפריט פנוי, אך אין הזמנה שמחכה לדגם ולמידה האלה' };
  }
  return { handled: false, message: d.error || 'ברקוד לא מוכר' };
}
