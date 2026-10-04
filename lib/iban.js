// lib/iban.js — IBAN ישראלי להחזר כספי (A15, חלון D4b של כרטיס ההזמנה החדש). טהור: בלי React, בלי fetch, בלי DB.
// אין שדה IBAN ב-DB (בלי DDL - PLAN §F.3): IBAN ישראלי תקין מפורק לשדות הקיימים של Refund/Customer - bankName (שם הבנק,
// כמו שהעובדים מקלידים היום: "לאומי"), bankBranch, bankAccount. ה-IBAN עצמו לא נשמר ולא נשלח לשרת (C.6 H17).
//
// מבנה IBAN ישראלי (23 תווים): IL + 2 ספרות ביקורת + 3 ספרות קוד בנק + 3 ספרות סניף + 13 ספרות חשבון (מרופד באפסים).
// ביקורת לפי ISO 13616 (mod-97): מעבירים את 4 התווים הראשונים לסוף, אות → מספר (A=10 … Z=35), והשארית ב-97 חייבת להיות 1.

export const IL_IBAN_LENGTH = 23;

// קודי הבנקים (בנק ישראל) שמוכרים לנו בוודאות. קוד שלא ברשימה נשמר כ"בנק <קוד>" - לא מנחשים שם.
export const IL_BANK_NAMES = Object.freeze({
  4: 'יהב',
  9: 'הדואר',
  10: 'לאומי',
  11: 'דיסקונט',
  12: 'הפועלים',
  13: 'איגוד',
  14: 'אוצר החייל',
  17: 'מרכנתיל דיסקונט',
  20: 'מזרחי טפחות',
  26: 'יובנק',
  31: 'הבינלאומי',
  46: 'מסד',
  52: 'פועלי אגודת ישראל',
  54: 'ירושלים',
});

/** מסיר רווחים/מקפים/נקודות ומעלה לאותיות גדולות. */
export function normalizeIban(raw) {
  return String(raw == null ? '' : raw).replace(/[\s\-.]/g, '').toUpperCase();
}

/** האם הקלט "נראה כמו" IBAN (מתחיל בשתי אותיות + שתי ספרות) - כדי להחליט אם לפרק או להתייחס אליו כמספר חשבון. */
export function looksLikeIban(raw) {
  return /^[A-Z]{2}\d{2}/.test(normalizeIban(raw));
}

/** שארית mod-97 של מחרוזת ספרות ארוכה, בחלקים (בלי BigInt). */
function mod97(digits) {
  let rem = 0;
  for (let i = 0; i < digits.length; i += 7) rem = Number(String(rem) + digits.slice(i, i + 7)) % 97;
  return rem;
}

/** ביקורת ISO 13616 לכל IBAN (לא רק ישראלי). */
export function ibanChecksumOk(raw) {
  const s = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s) || s.length < 15 || s.length > 34) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  return mod97(digits) === 1;
}

const stripZeros = (s) => String(s).replace(/^0+(?=\d)/, '');

export function bankNameForCode(code) {
  const n = Number(code);
  return IL_BANK_NAMES[n] || `בנק ${n}`;
}

/**
 * מפרק IBAN ישראלי לשדות הקיימים.
 * @returns {{ok:true, bankCode:string, bankName:string, bankBranch:string, bankAccount:string} | {ok:false, error:string}}
 */
export function parseIsraeliIban(raw) {
  const s = normalizeIban(raw);
  if (!s) return { ok: false, error: 'לא הוזן IBAN' };
  if (!s.startsWith('IL')) return { ok: false, error: 'IBAN ישראלי מתחיל ב-IL' };
  if (s.length !== IL_IBAN_LENGTH || !/^IL\d{21}$/.test(s)) return { ok: false, error: `IBAN ישראלי הוא IL ועוד 21 ספרות (${IL_IBAN_LENGTH} תווים)` };
  if (!ibanChecksumOk(s)) return { ok: false, error: 'ספרות הביקורת של ה-IBAN שגויות - נא לבדוק את המספר' };
  const bankCode = s.slice(4, 7);
  const branch = s.slice(7, 10);
  const account = s.slice(10);
  return {
    ok: true,
    bankCode: stripZeros(bankCode),
    bankName: bankNameForCode(bankCode),
    bankBranch: stripZeros(branch),
    bankAccount: stripZeros(account),
  };
}

/** בונה IBAN ישראלי מבנק/סניף/חשבון (לבדיקות ולתצוגה - לא נשמר). */
export function buildIsraeliIban(bankCode, branch, account) {
  const body = String(bankCode).padStart(3, '0') + String(branch).padStart(3, '0') + String(account).padStart(13, '0');
  if (!/^\d{19}$/.test(body)) return null;
  const digits = (body + 'IL00').replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  const check = String(98 - mod97(digits)).padStart(2, '0');
  return `IL${check}${body}`;
}

/** תצוגה בקבוצות של 4 (IL12 0108 0000 0009 9999 999). */
export function formatIban(raw) {
  return normalizeIban(raw).replace(/(.{4})/g, '$1 ').trim();
}
