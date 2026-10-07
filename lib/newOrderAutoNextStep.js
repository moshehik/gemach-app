// מעבר אוטומטי לשלב הבא באשף "הזמנה חדשה" הישן (דיווח 3bded746, נווה יעקב - החלטת הבעלים: להשאיר את השלבים, אבל לעבור לבד כשהשלב הושלם).
// לוגיקה טהורה (בלי React ובלי DOM) כדי שאפשר לבדוק אותה ב-node רגיל: scripts/test_wizard_auto_next_step.mjs.
// מאחורי SystemSetting new_order_auto_next_step (כבוי = כמו היום: רק כפתור "המשך").
//
// כללים (שמרניים בכוונה):
//  * רק שלב 1 (לקוח) -> 2 ושלב 2 (תאריכים) -> 3. שלב 3 (פריטים) לא מסתיים לעולם "מעצמו" - מוסיפים עוד פריט, ולכן הוא נשאר ידני.
//    שלבים 4 (סיכום) ו-5 (תשלום) ידניים תמיד, ושמירת ההזמנה עצמה לעולם לא אוטומטית.
//  * "השלב הושלם" = אותו תנאי בדיוק שמפעיל את כפתור "המשך" של השלב (לקוח נבחר / תאריך נבחר + שדות משלוח תקינים) ועוד כמה תנאים שמרניים:
//    ללקוח אין פרטי חובה חסרים, הוא לא חסום, אין שדות הוראת קבע פתוחים למילוי, ובשלב 2 אין סניף שעדיין לא נבחר כשעוקבים אחרי סניפים.
//  * מעבר מתבצע רק אחרי שינוי אמיתי של נתוני השלב (לא בכניסה לשלב ולא אחרי "חזור"), ורק אחרי השהיה קצרה בלי שום פעולה של המשתמש.
//  * לא עוברים כשפתוח חלון / הודעת שגיאה, או כשמקלידים בשדה (בשלב 2).

export const NEW_ORDER_AUTO_NEXT_STEP_SETTING = 'new_order_auto_next_step';
export const isAutoNextStepOn = (settings) => !!settings && settings[NEW_ORDER_AUTO_NEXT_STEP_SETTING] === 'true';

// כמה זמן מחכים אחרי השינוי האחרון לפני שעוברים (כל פעולה של המשתמש בזמן ההמתנה מבטלת את המעבר)
export const AUTO_NEXT_STEP_DELAY_MS = 600;

// השלבים שמהם עוברים אוטומטית (שלב -> השלב הבא)
export const AUTO_NEXT_FROM_STEPS = Object.freeze([1, 2]);
export const nextStepOf = (step) => (AUTO_NEXT_FROM_STEPS.includes(step) ? step + 1 : null);

// אותו חישוב כמו datesFilled ב-LegacyNewOrderPage.js (אירוע רגיל = תאריך אירוע; חו"ל / תפוסה ארוכה = מתאריך + עד תאריך)
export const datesAreFilled = (o) => !!(o && (o.isAbroad ? (o.fromDate && o.toDate) : o.eventDate));

// "חתימת" נתוני השלב: משתנה רק כשהמשתמש שינה את מה שהשלב הזה אוסף. null = שלב שלא עובר אוטומטית.
// בשלב 2 החתימה היא התאריכים עצמם בלבד (לא מצב האירוע הרגיל/חו"ל, ולא שדות משלוח/הערות) - כדי שהחלפת לשונית או מילוי משלוח לא יזיזו את המשתמש.
export function stepSignature(step, o) {
  if (step === 1) return String((o && o.customerId) || '');
  if (step === 2) return [(o && o.eventDate) || '', (o && o.fromDate) || '', (o && o.toDate) || ''].join('|');
  return null;
}

// האם השלב שלם. c = {
//   customerId, customerBlocked, customerMissingCount (חסרי חובה + קבוצות "אחד מספיק"), hokFieldsOpen,
//   isAbroad, eventDate, fromDate, toDate, deliveryError (תוצאת validateDeliveryFields - ריק/null = תקין), branchPending
// }
export function isStepComplete(step, c) {
  if (!c) return false;
  if (step === 1) return !!c.customerId && !c.customerBlocked && !(c.customerMissingCount > 0) && !c.hokFieldsOpen;
  if (step === 2) return datesAreFilled(c) && !c.deliveryError && !c.branchPending;
  return false; // 3, 4, 5 - לעולם לא אוטומטי
}

// האם כרגע צריך לתזמן מעבר: רק כשהמעבר פעיל, השלב אוטומטי, נשארנו באותו שלב וחתימת הנתונים השתנתה (שינוי אמיתי של המשתמש).
// prev = { step, sig } מהרינדור הקודם; cur = { step, sig }.
export function shouldScheduleAutoNext(enabled, prev, cur) {
  if (!enabled) return false;
  if (!prev || !cur) return false;
  if (!AUTO_NEXT_FROM_STEPS.includes(cur.step)) return false;
  if (prev.step !== cur.step) return false; // כניסה לשלב (קדימה או "חזור") - רק מגדירים נקודת התחלה, בלי קפיצה
  return prev.sig !== cur.sig;
}

// ברגע שההמתנה נגמרה: האם באמת עוברים. s = {
//   enabled, scheduledStep, currentStep, complete (isStepComplete עכשיו), overlayOpen (חלון/הודעת שגיאה/חלון אישור פתוחים),
//   busy (שמירה / חיוב / חיפוש בעיצומו), typing (בשלב 2: הסמן בשדה טקסט/רשימה), userActed (המשתמש עשה פעולה בזמן ההמתנה)
// }
export function canFireAutoNext(s) {
  if (!s || !s.enabled) return false;
  if (!AUTO_NEXT_FROM_STEPS.includes(s.currentStep) || s.scheduledStep !== s.currentStep) return false;
  if (!s.complete) return false;
  if (s.overlayOpen || s.busy || s.typing || s.userActed) return false;
  return true;
}
