// מעבר אוטומטי לשדה הבא (דיווח c89234ec, נווה יעקב - רבקה לוי): כששדה באורך קבוע מלא (מספר כרטיס אשראי, תוקף, נייד), או אחרי בחירת עיר/רחוב
// מהרשימה - הסמן עובר לשדה הבא. הכל מאחורי המתג auto_advance_fixed_fields (ברירת מחדל כבוי); הקורא בודק את המתג.
// הקובץ טהור (בלי React, בלי @/) כדי שיהיה אפשר להריץ אותו ב-node רגיל; רק focusField נוגע ב-DOM.

export const digitsOf = (v) => String(v == null ? '' : v).replace(/\D/g, '');

// מספר כרטיס אשראי: 16 ספרות בלבד (אמריקן אקספרס/דיינרס קצרים יותר - שם עוברים ידנית ב-Tab, כדי לא לקפוץ באמצע ההקלדה)
export const CARD_NUMBER_DIGITS = 16;
export const isCardNumberComplete = (v) => digitsOf(v).length === CARD_NUMBER_DIGITS;

// תוקף MM/YY מלא ותקין (חודש 01-12)
export const isExpiryComplete = (v) => /^(0[1-9]|1[0-2])\/\d{2}$/.test(String(v == null ? '' : v).trim());

// נייד ישראלי: 10 ספרות שמתחילות ב-05 (קווי = 9 ספרות, אורך משתנה עם קידומת - לא נחשב "אורך קבוע")
export const isMobilePhoneComplete = (v) => {
  const d = digitsOf(v);
  return d.length === 10 && d.startsWith('05');
};

/** השדה "הושלם" בעריכה הזו (לפני - לא היה שלם, עכשיו כן): עריכה בתוך ערך שכבר היה שלם לא קופצת שוב. */
export const justCompleted = (isComplete, prevValue, nextValue) => !!isComplete(nextValue) && !isComplete(prevValue);

/**
 * האם הערך הוזן בבחירה מרשימת ההצעות של <input list="..."> (datalist) ולא בהקלדה.
 * Chrome/Edge: אירוע input עם inputType = 'insertReplacementText'. Firefox (ישן): אירוע input רגיל, לא InputEvent.
 * הקלדה / מחיקה / הדבקה = InputEvent עם insertText / deleteContent... / insertFromPaste, ולכן לא נחשבים בחירה.
 * בנוסף הערך חייב להיות אחת האפשרויות בדיוק.
 */
export function isDatalistPick(nativeEvent, value, options) {
  if (!value || !Array.isArray(options) || !options.includes(value)) return false;
  if (!nativeEvent) return false;
  if (nativeEvent.inputType === 'insertReplacementText') return true;
  return typeof InputEvent !== 'undefined' && !(nativeEvent instanceof InputEvent);
}

/** מעביר פוקוס (ובוחר את התוכן) לשדה לפי id, אחרי הרינדור הנוכחי. לא עושה כלום אם אין שדה או שהוא מושבת. */
export function focusField(id) {
  if (typeof document === 'undefined') return;
  setTimeout(() => {
    const el = document.getElementById(id);
    if (!el || el.disabled) return;
    el.focus();
    try { if (typeof el.select === 'function' && el.type !== 'checkbox') el.select(); } catch { /* שדה בלי בחירה (למשל type=email) */ }
  }, 0);
}
