// ולידציה בסיסית לפרטי לקוח (טלפון/מייל/ת"ז/כפילות טלפונים) - משותפת ל-API וללקוח,
// בנפרד מהאכיפה של שדות חובה (require_customer_email/require_full_address/mandatory_fields
// ב-lib/settingsCache.js) שכבר קיימת. כאן זו בדיקת תבנית/תקינות, לא "האם מולא".

export function isValidIsraeliPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return true; // שדה ריק - האכיפה של "האם חובה" נעשית בנפרד
  return /^0\d{8,9}$/.test(digits);
}

export function isValidEmailFormat(raw) {
  const value = String(raw || '').trim();
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// בדיקת ספרת ביקורת לתעודת זהות ישראלית (אלגוריתם משרד הפנים הסטנדרטי).
export function isValidIsraeliId(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return true; // שדה אופציונלי
  if (digits.length > 9) return false;
  const id = digits.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = Number(id[i]) * ((i % 2) + 1);
    if (digit > 9) digit -= 9;
    sum += digit;
  }
  return sum % 10 === 0;
}

// מחזיר מערך הודעות שגיאה בעברית (ריק = תקין). לא בודק "שדה חובה" - רק תבנית/עקביות.
export function validateCustomerFieldFormats({ phone1, phone2, email, zeout } = {}) {
  const errors = [];
  if (!isValidIsraeliPhone(phone1)) errors.push('מספר הטלפון הראשי אינו תקין');
  if (!isValidIsraeliPhone(phone2)) errors.push('מספר הטלפון הנוסף אינו תקין');
  if (!isValidEmailFormat(email)) errors.push('כתובת הדוא"ל אינה תקינה');
  if (!isValidIsraeliId(zeout)) errors.push('מספר תעודת הזהות אינו תקין');

  const p1 = String(phone1 || '').replace(/\D/g, '');
  const p2 = String(phone2 || '').replace(/\D/g, '');
  if (p1 && p2 && p1 === p2) errors.push('טלפון נוסף זהה לטלפון הראשי - יש להזין מספר שונה');

  return errors;
}
