// ולידציה בסיסית לפרטי לקוח (טלפון/מייל/ת"ז/כפילות טלפונים) - משותפת ל-API וללקוח,
// בנפרד מהאכיפה של שדות חובה (require_customer_email/require_full_address/mandatory_fields
// ב-lib/settingsCache.js) שכבר קיימת. כאן זו בדיקת תבנית/תקינות, לא "האם מולא".

export function isValidIsraeliPhone(raw) {
  if (!String(raw || '').trim()) return true; // שדה ריק - האכיפה של "האם חובה" נעשית בנפרד
  const digits = String(raw || '').replace(/\D/g, '');
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

// שם עברי לכל שדה לקוח - לבניית הודעות שגיאה קריאות לקבוצות "אחד מספיק" למטה.
// אותה רשימה כמו CUSTOMER_FIELDS ב-app/admin/settings/SettingsClient.js (שם - JSX/רכיב
// בחירה, כאן - טקסט בלבד לשרת/ולידציה) - לא מאוחדות כי זה קובץ client component ('use client')
// וזה קובץ משותף לשרת.
const FIELD_LABELS = {
  firstName: 'שם פרטי', lastName: 'שם משפחה', phone1: 'טלפון ראשי', phone2: 'טלפון נוסף',
  city: 'עיר', street: 'רחוב', houseNum: 'מספר בית', email: 'אימייל',
  notes: 'הערות לקוח', officeNotes: 'נתוני משרד',
  bankName: 'שם בנק', bankBranch: 'סניף בנק', bankAccount: 'חשבון בנק',
};

// פרסור ההגדרה mandatory_field_groups (JSON: מערך של מערכי מפתחות שדה, למשל
// [["phone2","email"]] = "צריך למלא לפחות אחד מבין טלפון נוסף / אימייל"). קבוצה לא-תקינה
// (לא מערך, או ריקה) מוסרת בלי לזרוק שגיאה - עדיף להתעלם מקבוצה שגויה מלחסום את כל הטופס.
// כשההגדרה חסרה/ריקה (טרם הוזרעה, או נמחקה בטעות) - ברירת המחדל שומרת על ההתנהגות
// הקיימת מלפני שההגדרה הזו נוצרה: טלפון נוסף/אימייל, אחד מספיק.
const DEFAULT_FIELD_GROUPS = [['phone2', 'email']];

export function parseFieldGroups(rawValue) {
  // רק "ההגדרה עצמה לא קיימת/לא תקינה" נופל לברירת המחדל - "[]" הוא ערך תקין ומכוון
  // (המנהלת מחקה את כל הקבוצות בכוונה, למשל כדי לבטל את הדרישה כליל) ולא צריך לחזור
  // לברירת המחדל שוב, אחרת אין דרך לכבות את הדרישה מתוך המסך.
  if (rawValue === null || rawValue === undefined || rawValue === '') return DEFAULT_FIELD_GROUPS;
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return DEFAULT_FIELD_GROUPS;
    return parsed.filter(g => Array.isArray(g) && g.length > 0);
  } catch (e) {
    return DEFAULT_FIELD_GROUPS;
  }
}

function isFieldFilled(customer, key) {
  return String(customer?.[key] ?? '').trim().length > 0;
}

// מחזיר את הקבוצות שאף שדה בהן לא מולא (כל קבוצה כזו = הודעת שגיאה אחת, "חובה למלא
// לפחות אחד מבין: X / Y").
export function getUnsatisfiedFieldGroups(customer, groups) {
  return groups.filter(group => !group.some(key => isFieldFilled(customer, key)));
}

export function unsatisfiedFieldGroupErrors(customer, groups) {
  return getUnsatisfiedFieldGroups(customer, groups).map(group =>
    `חובה למלא לפחות אחד מבין: ${group.map(k => FIELD_LABELS[k] || k).join(' / ')}`
  );
}

// כמו למעלה, אבל תווית קצרה (בלי "חובה למלא לפחות אחד מבין") - להצטרפות לרשימת שדות חסרים
// קיימת (למשל "חסר ללקוח: מייל, אחד מבין: טלפון נוסף / אימייל").
export function unsatisfiedFieldGroupShortLabels(customer, groups) {
  return getUnsatisfiedFieldGroups(customer, groups).map(group =>
    `אחד מבין: ${group.map(k => FIELD_LABELS[k] || k).join(' / ')}`
  );
}

// האם שדה `key` חובה כרגע כי שאר השדות בקבוצה שלו (מלבדו) ריקים - לתצוגת כוכבית דינמית.
// לא בודק אם `key` עצמו מולא, כי הכוכבית מציינת "אתה חייב למלא את אחד מהם", לא "זה נכון כרגע".
export function isFieldRequiredByGroup(key, customer, groups) {
  return groups.some(group =>
    group.includes(key) && !group.some(other => other !== key && isFieldFilled(customer, other))
  );
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
