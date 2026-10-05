// FROZEN COPY of origin/main 00104dc4 lib/lateReturn.js - "before" oracle for late-return-parity.test.mjs and return-dates.test.mjs. Imports rewritten only.
import { getIsraelDaysUntil, getIsraelDateKey } from '@/lib/hebrewDate';
import { nextWorkingDay, rollForwardToWorkingDay, localDateFromKey } from './businessDays.main.mjs';

// איחור בהחזרה: אם עברו X+ ימים ממועד ההחזרה הצפוי של ההזמנה (toDate/returnDate עבור
// הזמנות חו"ל/ריבוי-ימים; להזמנות רגילות שני השדות ריקים, ואז נופלים ל-eventDate + יום
// העבודה הראשון אחריו - אחרת האיחור "רגיל" (הרוב המכריע של ההזמנות) לעולם לא היה
// מזוהה). משותף בין components/orders/RentalReturnModal.js (בר סריקה בתוך כרטיס
// הזמנה) לבין app/rentals/page.js (בר החזרה מהיר) - שני המקומות צריכים בדיוק אותה
// נוסחה כדי שהתראת האיחור לא תתנהג אחרת בין שני מסלולי ההחזרה.
// ברירת המחדל (7) משמשת רק כשאין SystemSetting 'late_return_threshold_days' - כל
// קורא אמור להעביר את הערך בפועל מההגדרות (ר' דיווח 0d0a15e2-3016-...).
//
// "יום העבודה הראשון אחרי האירוע" (2026-10-01, החלטת הבעלים סעיף 3 - DECISIONS-לוז-יומי.md):
// הכלל האחיד של lib/businessDays.js - שישי, שבת, חג, ערב חג והימים שסומנו "ללא פעילות"
// בניהול היומן (non_working_days_extra). עד כה דולגו רק שישי/שבת (addDaysSkippingWeekends);
// בלי חג/ערב חג/יום מסומן בדרך התוצאה זהה (scripts/business-days-tests/late-return-parity.test.mjs).
// אותו כלל משמש את שלב "החזרה ידנית" בלו״ז ואת כרטיס ההזמנה.
//
// תאריך החזרה מפורש שנופל על יום סגור (2026-10-02, החלטת הבעלים - "ההחזרה של אירוע בחמישי תהיה
// בראשון", "כן" מפורש לכל המערכת): toDate/returnDate על שישי/שבת/חג/ערב חג/יום שהבעלים סגר נחשב
// ליום העבודה הראשון אחריו - rollForwardToWorkingDay ב-lib/businessDays.js, אותה פונקציה שמאחורי
// שלב 8 בלו״ז (lib/schedule/dates.js). לכן כרטיס ההזמנה, רשימת האיחורים, ההדפסה, המיילים, "אמור
// לחזור מחר" והלו״ז מראים אותו מועד, והאיחור נספר מהיום המגולגל (toDate שישי 16.10 -> ראשון 18.10;
// ב-25.10 = 7 ימי איחור, לא 9). תאריך מפורש שכבר נופל על יום עובד - ללא שינוי.
// scripts/business-days-tests/return-roll-forward.test.mjs מוכיח שוויון מלא מול הלו״ז.
export const LATE_RETURN_THRESHOLD_DAYS = 7;

/**
 * מועד ההחזרה הצפוי כמפתח יום ישראלי 'YYYY-MM-DD' (או null): toDate/returnDate אם קיימים (מגולגלים ליום
 * העבודה הבא כשהם נופלים על יום סגור), אחרת יום העבודה הראשון אחרי האירוע לפי הכלל האחיד. אותו חישוב
 * שמשמש את getLateReturnInfo למטה - משמש גם את מה שמודפס/נשלח ללקוחה (דף הזמנה מודפס, מיילים), "אמור לחזור
 * מחר" בדף ההכנה ושבבי "החזרה היום/מחר" בחיפוש המתקדם, כדי שכולם יראו אותו תאריך.
 * תאריך מפורש לא תקין (toDate='garbage') => null, בלי נפילה ל-eventDate (כמו קודם: ההזמנה "לא מאחרת").
 * @param {object} [nonWorkingDays] - NonWorkingConfig / value גולמי של non_working_days_extra (ריק = ברירות מחדל)
 */
export function getExpectedReturnKey(order, nonWorkingDays) {
  if (!order) return null;
  const explicit = order.toDate || order.returnDate;
  if (explicit) {
    const explicitKey = getIsraelDateKey(explicit);
    return explicitKey ? rollForwardToWorkingDay(explicitKey, nonWorkingDays ?? null) : null;
  }
  if (!order.eventDate) return null;
  const eventKey = getIsraelDateKey(order.eventDate);
  return eventKey ? nextWorkingDay(eventKey, nonWorkingDays ?? null) : null;
}

/**
 * אותו דבר כ-Date לתצוגה (getHebrewDateString / getHebrewWeekdayLabel), בחצות מקומית של היום הישראלי:
 * toDate/returnDate נקראים לפי היום הישראלי של הרגע השמור - לא לפי אזור הזמן של השרת (תאריך ששמור כ-21:00Z
 * הוצג בשרת UTC כיום הקודם) - ומגולגלים ליום העבודה הבא כשהם נופלים על יום סגור. בהזמנה רגילה - יום העבודה
 * הראשון אחרי האירוע. null כשאין תאריך.
 */
export function getExpectedReturnDate(order, nonWorkingDays) {
  const key = getExpectedReturnKey(order, nonWorkingDays);
  return key ? localDateFromKey(key) : null;
}

/**
 * @param {{eventDate?: string|Date|null, toDate?: string|Date|null, returnDate?: string|Date|null}} order
 * @param {number} [thresholdDays] - מספר ימי האיחור המזערי; ברירת מחדל LATE_RETURN_THRESHOLD_DAYS
 * @param {Date|{now?: Date, nonWorkingDays?: object}} [nowOrOptions] - "עכשיו" (לבדיקות; ברירת מחדל new Date()),
 *   או אובייקט אפשרויות: now + nonWorkingDays (NonWorkingConfig / value גולמי של non_working_days_extra)
 * @param {object} [nonWorkingDays] - אותו קונפיג כפרמטר נפרד (לקוראים שמעבירים now כ-Date)
 * @returns {{isLate: boolean, daysLate?: number, dueDate?: Date, dueKey?: string}}
 *   dueDate = מועד ההחזרה הצפוי (המגולגל) בחצות מקומית של היום הישראלי; dueKey = אותו יום כמפתח 'YYYY-MM-DD'.
 */
export function getLateReturnInfo(order, thresholdDays = LATE_RETURN_THRESHOLD_DAYS, nowOrOptions, nonWorkingDays) {
  if (!order) return { isLate: false };
  const isOpts = nowOrOptions && !(nowOrOptions instanceof Date) && typeof nowOrOptions === 'object';
  const now = (isOpts ? nowOrOptions.now : nowOrOptions) || new Date();
  const nonWorking = (isOpts ? nowOrOptions.nonWorkingDays : undefined) ?? nonWorkingDays ?? null;

  // מועד ההחזרה הצפוי - אותה פונקציה בדיוק כמו ההדפסה/המייל/הלו״ז (ר' למעלה). eventDate ריק/לא תקין
  // (או toDate לא תקין) => null => "לא מאחרת" - בלי הבדיקה new Date(null) = 1970 וההזמנה הייתה מסומנת
  // "מאחרת" ב-~20,000 ימים.
  const dueKey = getExpectedReturnKey(order, nonWorking);
  if (!dueKey) return { isLate: false };

  // מפתח היום הישראלי -> עוגן חצות UTC של אותו יום (אותה צורת אחסון כמו eventDate רגיל), כך ש-getIsraelDaysUntil
  // קורא אותו כאותו יום ישראלי בכל אזור זמן. מספר ימי-לוח ישראליים שעברו מיום ההחזרה הצפוי - לא
  // today.setHours(0,0,0,0) של אזור הזמן של המכונה: בשרת (UTC ב-Vercel, cron/daily + /api/orders/overdue) זה נתן
  // "אתמול" בין 00:00 ל-03:00 שעון ישראל, וחלוקה ב-86400000 זזה ביום מעבר שעון קיץ.
  const daysLate = 0 - getIsraelDaysUntil(`${dueKey}T00:00:00.000Z`, now);
  const dueDate = localDateFromKey(dueKey);
  if (daysLate < thresholdDays) return { isLate: false, daysLate, dueDate, dueKey };
  return { isLate: true, daysLate, dueDate, dueKey };
}
