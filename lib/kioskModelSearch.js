// חיפוש דגם בשדה הקטן של עמדת הלקוח (app/customer-interface/page.js, kiosk_model_search) - פונקציה טהורה
// (בלי React ובלי DB), נבדקת ב-scripts/test_kiosk_model_search.mjs. דיווחים 7983b79d, b2cf3796, e6f564d6.
//
// בכוונה לא מחפש במידות (בניגוד לשדה "חיפוש" שבפאנל הסינון): הלקוחה מקלידה מספר דגם, ו"5" לא אמור להביא
// כל דגם שיש לו מידה עם 5 בה.
//   * ספרות בלבד ("56" / "#567" / "דגם 567"): קידומת הברקוד מתחילה בהן, או שהשם (בלי המילה "דגם") מתחיל בהן.
//   * אחרת: השם מכיל את הטקסט.
// שים לב: \b ב-JS לא עובד על אותיות עבריות, לכן אין כאן \b.

export function normalizeModelQuery(query) {
  return String(query == null ? '' : query)
    .trim()
    .toLowerCase()
    .replace(/^#\s*/, '')
    .replace(/^דגם\s*#?\s*/, '')
    .trim();
}

/** true אם הדגם תואם את הטקסט שהוקלד (טקסט ריק = הכול תואם). */
export function modelMatchesQuery(model, query) {
  const q = normalizeModelQuery(query);
  if (!q) return true;
  const name = String((model && model.name) || '').trim().toLowerCase();
  const prefix = model && model.barcodePrefix != null ? String(model.barcodePrefix) : '';
  if (/^\d+$/.test(q)) {
    const nameNoWord = name.replace(/^דגם\s*#?\s*/, '');
    return prefix.startsWith(q) || nameNoWord.startsWith(q);
  }
  return name.includes(q);
}
