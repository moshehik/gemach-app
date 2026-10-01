import { getIsraelDaysUntil, getIsraelDateKey } from './hebrewDate';
import { nextWorkingDay, localDateFromKey, israelLocalDate } from './businessDays';

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
export const LATE_RETURN_THRESHOLD_DAYS = 7;

/**
 * מועד ההחזרה הצפוי כמפתח יום ישראלי 'YYYY-MM-DD' (או null): toDate/returnDate אם קיימים, אחרת
 * יום העבודה הראשון אחרי האירוע לפי הכלל האחיד. אותו חישוב שמשמש את getLateReturnInfo למעלה -
 * משמש גם את מה שמודפס/נשלח ללקוחה (דף הזמנה מודפס, מיילים), "אמור לחזור מחר" בדף ההכנה ושבבי
 * "החזרה היום/מחר" בחיפוש המתקדם, כדי שכולם יראו אותו תאריך.
 * @param {object} [nonWorkingDays] - NonWorkingConfig / value גולמי של non_working_days_extra (ריק = ברירות מחדל)
 */
export function getExpectedReturnKey(order, nonWorkingDays) {
  if (!order) return null;
  const explicit = order.toDate || order.returnDate;
  if (explicit) return getIsraelDateKey(explicit);
  if (!order.eventDate) return null;
  const eventKey = getIsraelDateKey(order.eventDate);
  return eventKey ? nextWorkingDay(eventKey, nonWorkingDays ?? null) : null;
}

/**
 * אותו דבר כ-Date לתצוגה (getHebrewDateString / getHebrewWeekdayLabel), בחצות מקומית של היום הישראלי:
 * toDate/returnDate מוצגים ללא הזזה (גם אם נופלים על יום לא עובד - זה ההסכם עם הלקוחה), אבל נקראים לפי
 * היום הישראלי של הרגע השמור - לא לפי אזור הזמן של השרת (תאריך ששמור כ-21:00Z הוצג בשרת UTC כיום הקודם).
 * בהזמנה רגילה - יום העבודה הראשון אחרי האירוע. null כשאין תאריך.
 */
export function getExpectedReturnDate(order, nonWorkingDays) {
  if (!order) return null;
  const explicit = order.toDate || order.returnDate;
  if (explicit) return israelLocalDate(explicit);
  const key = getExpectedReturnKey(order, nonWorkingDays);
  return key ? localDateFromKey(key) : null;
}

/**
 * @param {{eventDate?: string|Date|null, toDate?: string|Date|null, returnDate?: string|Date|null}} order
 * @param {number} [thresholdDays] - מספר ימי האיחור המזערי; ברירת מחדל LATE_RETURN_THRESHOLD_DAYS
 * @param {Date|{now?: Date, nonWorkingDays?: object}} [nowOrOptions] - "עכשיו" (לבדיקות; ברירת מחדל new Date()),
 *   או אובייקט אפשרויות: now + nonWorkingDays (NonWorkingConfig / value גולמי של non_working_days_extra)
 * @param {object} [nonWorkingDays] - אותו קונפיג כפרמטר נפרד (לקוראים שמעבירים now כ-Date)
 * @returns {{isLate: boolean, daysLate?: number, dueDate?: Date}}
 */
export function getLateReturnInfo(order, thresholdDays = LATE_RETURN_THRESHOLD_DAYS, nowOrOptions, nonWorkingDays) {
  if (!order) return { isLate: false };
  const isOpts = nowOrOptions && !(nowOrOptions instanceof Date) && typeof nowOrOptions === 'object';
  const now = (isOpts ? nowOrOptions.now : nowOrOptions) || new Date();
  const nonWorking = (isOpts ? nowOrOptions.nonWorkingDays : undefined) ?? nonWorkingDays ?? null;

  // eventDate ריק/לא תקין => getIsraelDateKey מחזיר null; בלי הבדיקה new Date(null) = 1970
  // וההזמנה הייתה מסומנת "מאחרת" ב-~20,000 ימים (ב-main הערך הלא תקין נתן "לא מאחרת").
  let dueDateRaw = order.toDate || order.returnDate;
  if (!dueDateRaw && order.eventDate) {
    const eventKey = getIsraelDateKey(order.eventDate);
    if (eventKey) {
      // מפתח היום הישראלי -> עוגן חצות UTC של אותו יום (אותה צורת אחסון כמו eventDate רגיל),
      // כך ש-getIsraelDaysUntil למטה קורא אותו כאותו יום ישראלי בכל אזור זמן.
      dueDateRaw = `${nextWorkingDay(eventKey, nonWorking)}T00:00:00.000Z`;
    }
  }
  if (!dueDateRaw) return { isLate: false };

  const dueDate = new Date(dueDateRaw);
  if (isNaN(dueDate.getTime())) return { isLate: false };
  dueDate.setHours(0, 0, 0, 0);

  // מספר ימי-לוח ישראליים שעברו מיום ההחזרה הצפוי - לא today.setHours(0,0,0,0) של אזור הזמן
  // של המכונה: בשרת (UTC ב-Vercel, cron/daily + /api/orders/overdue) זה נתן "אתמול" בין
  // 00:00 ל-03:00 שעון ישראל, וחלוקה ב-86400000 זזה ביום מעבר שעון קיץ.
  const daysLate = 0 - getIsraelDaysUntil(dueDateRaw, now);
  if (daysLate < thresholdDays) return { isLate: false, daysLate, dueDate };
  return { isLate: true, daysLate, dueDate };
}
