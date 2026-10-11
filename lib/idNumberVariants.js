// lib/idNumberVariants.js - כל הצורות שבהן אותה תעודת זהות עשויה להישמר ב-Customer.zeout (נשמרת "כפי שהוקלדה": עם / בלי אפסים מובילים).
// משמש את חיפוש הלקוחות (lib/listSearch.js customerSearchCondition) ואת בדיקת הכפילות ברישום מהעמדה (lib/publicKiosk). פונקציה טהורה.
export function idNumberVariants(raw) {
  const d = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (!d || d.length > 9) return [];
  const stripped = d.replace(/^0+/, '') || '0';
  return Array.from(new Set([d, d.padStart(9, '0'), stripped]));
}
