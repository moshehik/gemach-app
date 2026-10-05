// lib/orderNotes.js — הערות הזמנה להדפסה: מאחד את שני שדות ההערות של Order.
//
// ב-Order יש שני שדות הערות: `notes` ("הערות", נכתב בכרטיס ההזמנה באפליקציה) ו-`orderNotes`
// ("הערות_להזמנה", הגיע מייבוא Access). בגמח הראשי כמעט כל ההזמנות הפעילות שהגיעו מהייבוא
// שומרות את ההערה רק ב-orderNotes (נבדק ב-5.10.2026: מתוך 518 הזמנות פעילות 427 עם orderNotes ורק 2 עם notes),
// וכל משטחי ההדפסה קראו רק את `notes` - ולכן "ההערות לא מופיעות בהדפסה".
//
// מוסיף תצוגה בלבד (לא כותב כלום ולא משנה את הנתונים). שני השדות מאוחדים לטקסט אחד.
// בנוסף: הביטוי "חתמו על התקנון" - חותמת סטטוס שאקסס הוסיף לשדה ההערות (271 הזמנות פעילות רק עם הביטוי הזה,
// והחתימה נשמרת בנפרד ב-hasSignedRegulations) - לא מודפס כהערה, כדי שתיבת ההערות הבולטת בדף לא תופיע
// בכל הזמנה ותטשטש את ההערות האמיתיות (למשל "תחתית חום"). אם יש עוד טקסט - הוא נשמר כמו שהוא.

const SIGNED_REGS_STAMP = /חתמו על התקנון/g;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// orderNotes (מאקסס) בלי חותמת "חתמו על התקנון"; רווחים עודפים מכווצים.
export function legacyOrderNotesText(raw) {
  const text = clean(raw);
  if (!text) return '';
  return text.replace(SIGNED_REGS_STAMP, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s,;:|\-–]+|[\s,;:|\-–]+$/g, '').trim();
}

// הטקסט שמודפס כ"הערות להזמנה": notes, ואחריו orderNotes (אם יש בו משהו שלא כבר מופיע ב-notes).
export function combinedOrderNotes(order) {
  if (!order) return '';
  const own = clean(order.notes);
  const legacy = legacyOrderNotesText(order.orderNotes);
  if (!legacy) return own;
  if (!own) return legacy;
  if (own.includes(legacy)) return own;
  return `${own} | ${legacy}`;
}
