// lib/publicKiosk/registrationInput.js - נרמול ובדיקת קלט של רישום עצמי בעמדה (POST /api/public-kiosk/register). פונקציות טהורות (בלי DB).
// הבדיקות מבוססות-ההגדרות (שדות חובה/תבנית) מגיעות מ-lib/customerCreateValidation.js (משותף עם טופס "לקוח חדש" של העובדת);
// כאן רק מה שייחודי לציבור: allow-list של שדות, מגבלות אורך, תווים מותרים, הסכמות מפורשות, honeypot.

export { idNumberVariants } from '@/lib/idNumberVariants';

export const MAX_BODY_BYTES = 8 * 1024;
export const HONEYPOT_FIELD = 'website'; // שדה מוסתר בטופס: אדם לא ימלא, בוט כן
export const CHANNELS = Object.freeze({ public: 'קישור כללי', kiosk: 'עמדת חנות' });

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}'"׳״.\- ]*$/u;
const PLACE_RE = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'"׳״.,/()\- ]*$/u;
const EMAIL_RE = /^[^\s@<>"'`,;:\\()[\]{}]+@[^\s@<>"'`,;:\\()[\]{}]+\.[^\s@<>"'`,;:\\()[\]{}]{2,}$/;

function str(v, max) {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  // בלי תווי בקרה / כיווניות בלתי נראים, רווחים כפולים מכווצים
  return String(v).replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** טלפון ישראלי -> "0501234567" (ספרות בלבד; +972/00972 ו-9 ספרות בלי 0 מוביל מתוקנים). ריק אם אין ספרות. */
export function normalizePhone(raw) {
  let d = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (d.startsWith('00972')) d = '0' + d.slice(5);
  else if (d.startsWith('972')) d = '0' + d.slice(3);
  else if (/^\d{9}$/.test(d) && d[0] !== '0') d = '0' + d;
  return d.slice(0, 15);
}

/** ת"ז -> 9 ספרות עם אפסים מובילים, או '' אם ריק. מעל 9 ספרות נשאר כפי שהוא (ייכשל בבדיקת התקינות). */
export function normalizeIdNumber(raw) {
  const d = String(raw == null ? '' : raw).replace(/\D/g, '').slice(0, 12);
  if (!d) return '';
  return d.length <= 9 ? d.padStart(9, '0') : d;
}

/**
 * מנרמל את גוף הבקשה לפי allow-list - כל מפתח אחר בגוף מתעלמים ממנו. מחזיר:
 *   { honeypot:boolean, value, fieldErrors:{field:message}, consent:{acceptedTerms,marketingConsent,acceptedPrivacy}, channel }
 * value (מוכן לבדיקות ה-API המשותפות ולכתיבה): firstName, lastName, phone1, zeout, email, city, street, houseNum(מספר|null).
 */
export function normalizeRegistrationInput(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const honeypot = str(b[HONEYPOT_FIELD], 200) !== '';
  const fieldErrors = {};
  const value = {
    firstName: str(b.firstName, 40),
    lastName: str(b.lastName, 40),
    phone1: normalizePhone(str(b.phone1 ?? b.phone, 30)),
    phone2: normalizePhone(str(b.phone2, 30)), // אופציונלי; נדרש לקבוצת "טלפון נוסף / אימייל" (mandatory_field_groups)
    zeout: normalizeIdNumber(str(b.idNumber ?? b.zeout, 20)),
    email: str(b.email, 100).toLowerCase(),
    city: str(b.city, 50),
    street: str(b.street, 60),
    houseNum: null,
  };

  if (!value.firstName) fieldErrors.firstName = 'שם פרטי חובה';
  else if (value.firstName.length < 2 || !NAME_RE.test(value.firstName)) fieldErrors.firstName = 'שם פרטי אינו תקין';
  if (!value.lastName) fieldErrors.lastName = 'שם משפחה חובה';
  else if (value.lastName.length < 2 || !NAME_RE.test(value.lastName)) fieldErrors.lastName = 'שם משפחה אינו תקין';
  if (!value.phone1) fieldErrors.phone1 = 'טלפון חובה';
  if (value.email && (!EMAIL_RE.test(value.email) || value.email.length > 100)) fieldErrors.email = 'כתובת הדוא"ל אינה תקינה';
  if (value.city && !PLACE_RE.test(value.city)) fieldErrors.city = 'שם העיר אינו תקין';
  if (value.street && !PLACE_RE.test(value.street)) fieldErrors.street = 'שם הרחוב אינו תקין';
  const hn = str(b.houseNum, 10);
  if (hn) {
    const m = /^(\d{1,4})[\p{L}\-/ ]{0,3}$/u.exec(hn);
    if (!m) fieldErrors.houseNum = 'מספר הבית אינו תקין';
    else value.houseNum = parseInt(m[1], 10);
  }

  // הסכמות: כולן בוליאניות מפורשות (true/false אמיתי) - מחרוזת "true" / 1 / ערך חסר = לא נענה
  const bool = (v) => (v === true || v === false ? v : undefined);
  const consent = { acceptedTerms: bool(b.acceptedTerms), marketingConsent: bool(b.marketingConsent), acceptedPrivacy: bool(b.acceptedPrivacy) };
  if (consent.acceptedPrivacy !== true) fieldErrors.acceptedPrivacy = 'יש לאשר את מדיניות הפרטיות כדי להמשיך';
  if (consent.marketingConsent === undefined) fieldErrors.marketingConsent = 'יש לבחור אם מאשרים קבלת דיוור (כן / לא)';
  if (consent.acceptedTerms === undefined) fieldErrors.acceptedTerms = 'יש לסמן האם חתמת על התקנון (כן / לא)';

  const channel = b.channel === 'kiosk' ? 'kiosk' : 'public';
  return { honeypot, value, fieldErrors, consent, channel };
}

/** שם לצורך השוואת "אותה לקוחה": אותיות בלבד, אותיות קטנות. */
export function nameKey(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
