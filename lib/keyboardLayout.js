// lib/keyboardLayout.js - "הצלת מקלדת": טקסט שהוקלד בטעות עם מקלדת אנגלית במקום עברית ("ankv" במקום "שמלה").
// מודול טהור (בלי prisma / React / DOM): רץ בשרת, בלקוח ובבדיקות node.
// שימוש (ר' app/api/orders, app/api/customers): רק כשהחיפוש כפי שהוקלד החזיר 0 תוצאות והוא נראה כמו אותיות לטיניות בלבד -
// מנסים שוב עם ההמרה ומציגים הודעה. אף פעם לא מחליפים טקסט לטיני שמצא תוצאות (שמות באנגלית, מידות S/M/L, מיילים).
// המיפוי: מקלדת עברית ישראלית סטנדרטית (SI-1452), אותיות לטיניות קטנות. אותיות גדולות (Caps Lock) מקבלות את אותו מיפוי.
//   q w e r t y u i o p   ->  /  '  ק  ר  א  ט  ו  ן  ם  פ
//   a s d f g h j k l ;   ->  ש  ד  ג  כ  ע  י  ח  ל  ך  ף
//   z x c v b n m , .     ->  ז  ס  ב  ה  נ  מ  צ  ת  ץ
// הערה: האות הסופית נשמרת כפי שהמקלדת מפיקה אותה (l = ך, o = ם...), כך שהמחרוזת זהה למה שהמשתמשת הייתה מקלידה בעברית.
// (הדוגמה "akuh" מההגדרה אינה "שמלה": a=ש k=ל u=ו h=י נותן "שלוי". "שמלה" = ankv.)

const HEBREW_BY_LATIN = Object.freeze({
  q: '/', w: "'", e: 'ק', r: 'ר', t: 'א', y: 'ט', u: 'ו', i: 'ן', o: 'ם', p: 'פ',
  a: 'ש', s: 'ד', d: 'ג', f: 'כ', g: 'ע', h: 'י', j: 'ח', k: 'ל', l: 'ך', ';': 'ף',
  z: 'ז', x: 'ס', c: 'ב', v: 'ה', b: 'נ', n: 'מ', m: 'צ', ',': 'ת', '.': 'ץ',
});

// האות הלטינית שמפיקה כל תו עברי (הכיוון ההפוך, לבדיקות ולהצגה)
const LATIN_BY_HEBREW = Object.freeze(Object.fromEntries(Object.entries(HEBREW_BY_LATIN).map(([k, v]) => [v, k])));

const HEBREW_LETTER_RE = /[א-ת]/g;

/** האם המחרוזת היא "לטינית בלבד": אותיות a-z (גם גדולות), רווחים ואחד מ-; , . ' - בלי ספרות, בלי @ ובלי עברית; ולפחות שתי אותיות. */
export function isLatinOnly(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return false;
  if (!/^[A-Za-z][A-Za-z\s;,.']*$/.test(s)) return false;
  return (s.match(/[A-Za-z]/g) || []).length >= 2;
}

/** ממיר כל תו לפי מקלדת עברית (תווים שאינם במיפוי נשארים). לא בודק אם התוצאה "נראית עברית" - לזה rescueFromLatin. */
export function toHebrewLayout(raw) {
  return Array.from(String(raw == null ? '' : raw)).map((ch) => {
    const lower = ch.toLowerCase();
    return Object.prototype.hasOwnProperty.call(HEBREW_BY_LATIN, lower) ? HEBREW_BY_LATIN[lower] : ch;
  }).join('');
}

/** הכיוון ההפוך: עברית שהוקלדה על מקלדת אנגלית "נקרית" כלטינית (לבדיקות סימטריה). */
export function toLatinLayout(raw) {
  return Array.from(String(raw == null ? '' : raw)).map((ch) => (Object.prototype.hasOwnProperty.call(LATIN_BY_HEBREW, ch) ? LATIN_BY_HEBREW[ch] : ch)).join('');
}

/**
 * הצלת מקלדת: אם הטקסט לטיני בלבד ויוצא ממנו טקסט שנראה כמו עברית - מחזיר { original, converted }, אחרת null.
 * "נראה כמו עברית": לפחות 2 אותיות עבריות, והתוצאה לא מכילה את התו '/' (q) - האות q לא קיימת בעברית ולכן מילה עם q היא כנראה אנגלית אמיתית.
 * גרש (w) מותר (גימטרייה/ראשי תיבות), אבל לא כתו ראשון/יחיד ("w" לבד). נקודה/פסיק/נקודה-פסיק הם ת/ץ/ף ולכן נספרים כאותיות.
 */
export function rescueFromLatin(raw) {
  if (!isLatinOnly(raw)) return null;
  const original = String(raw).trim();
  const converted = toHebrewLayout(original).replace(/\s+/g, ' ').trim();
  if (converted.includes('/')) return null;
  if ((converted.match(HEBREW_LETTER_RE) || []).length < 2) return null;
  if (/^'|\s'/.test(converted)) return null; // גרש בתחילת מילה - לא עברית אמיתית
  return converted === original ? null : { original, converted };
}
