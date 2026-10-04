// חריגים מאושרים של שלבי W5 (R01-R08) ל-cmp.mjs - כל אחד עם סיבה. נטען מ-cmp.mjs (APPROVED / APPROVED_STAGE).
// R-stages מצלמים רק מה ש-W5 מחזיק: RAIL (#rail), TOAST, DLG, NB (באנר הטיוטה); TABS/TOP שייכים ל-W1 ומופיעים כאן רק מהשפעת מצב הכרטיס.
export const RAIL_APPROVED = [
  // נוסח אמיתי מול נוסח הדגמה (הבקר מחזיר "הערות ההזמנה עודכנו", העיצוב "הערות עודכנו"; הדגשת הישות נשמרת)
  [/^RAIL>div\.cl-t>span>b \[w\]$|^RAIL>div\.cart-list>div\.cl>div\.cl-t>span>b \[w\]$/, 'רוחב ההדגשה תלוי בנוסח (אמיתי מול הדגמה)'],
  // באנר הטיוטה (R11): בכרטיס הוא בתוך עמודת הכרטיס מעל הלשוניות (החלטה R11/W1); בעיצוב הוא באזור ההודעות של מעטפת האתר, ברוחב מלא
  [/^NB[^[]*\[(w|h)\]$/, 'R11: רוחב וגובה הבאנר - בתוך עמודת הכרטיס מעל הלשוניות (בעיצוב: אזור הודעות מעטפת האתר ברוחב מלא; במסך צר הטקסט נשבר אחרת)'],
];
export const RAIL_APPROVED_STAGE = [];
const stages = ['R01-rail-charge', 'R02-rail-credit', 'R03-rail-notes', 'R04-summary-d1', 'R05-discard-d7', 'R06-success-d6', 'R07-draft-banner', 'R08-rail-undo-redo'];
for (const st of stages) {
  // סמני הלשוניות (W1, A6): בעיצוב "יש חוב/זיכוי" לפי היתרה השמורה; בבקר לפי היתרה כולל שינויים שלא נשמרו - REQUESTS-W5 #4
  RAIL_APPROVED_STAGE.push([st, /^TABS/, 'סמני לשוניות (W1): יתרה שמורה מול יתרה כולל שינויים - REQUESTS-W5 #4']);
}
for (const st of ['R04-summary-d1']) {
  RAIL_APPROVED_STAGE.push([st, /^TOP>button\.back \[op\]$/, 'סקירה 4 (W1): החץ מנוטרל בזמן שמירה רצה - D1 נפתח באמצע השמירה']);
  RAIL_APPROVED_STAGE.push([st, /^RAIL>div\.cart-list>div\.cl>button\.cl-u \[op\]$/, 'סקירה 4 (W1): ביטול שורה מנוטרל בזמן שמירה רצה']);
  RAIL_APPROVED_STAGE.push([st, /^DLG>div\.dbtns>button\.block\.btn/, 'D1: אין "בטל שינויים" בחלון - הבקר מצפה ל-true|false (REQUESTS-W5 #2); הלחצן ברייל']);
}
// שלבים 10/11 של W1 משווים רק את החלון (R12/R48): בעיצוב הרייל נקי, בדף האמיתי הטיוטה שוחזרה (יש שינויים) - הרייל נבדק בשלבי R
for (const st of ['10-conflict', '11-stock']) RAIL_APPROVED_STAGE.push([st, /^RAIL/, 'W1: השוואת חלון בלבד; הרייל נבדק בשלבי R01-R08']);
