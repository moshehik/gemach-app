import { addDaysSkippingWeekends } from './clientInventory';
import { getIsraelDaysUntil, toIsraelCalendarDate } from './hebrewDate';

// איחור בהחזרה: אם עברו X+ ימים ממועד ההחזרה הצפוי של ההזמנה (toDate/returnDate עבור
// הזמנות חו"ל/ריבוי-ימים; להזמנות רגילות שני השדות ריקים, ואז נופלים ל-eventDate+יום
// אחד תוך דילוג שישי/שבת - אחרת האיחור "רגיל" (הרוב המכריע של ההזמנות) לעולם לא היה
// מזוהה). משותף בין components/orders/RentalReturnModal.js (בר סריקה בתוך כרטיס
// הזמנה) לבין app/rentals/page.js (בר החזרה מהיר) - שני המקומות צריכים בדיוק אותה
// נוסחה כדי שהתראת האיחור לא תתנהג אחרת בין שני מסלולי ההחזרה.
// ברירת המחדל (7) משמשת רק כשאין SystemSetting 'late_return_threshold_days' - כל
// קורא אמור להעביר את הערך בפועל מההגדרות (ר' דיווח 0d0a15e2-3016-...).
export const LATE_RETURN_THRESHOLD_DAYS = 7;

/**
 * @param {{eventDate?: string|Date|null, toDate?: string|Date|null, returnDate?: string|Date|null}} order
 * @param {number} [thresholdDays] - מספר ימי האיחור המזערי; ברירת מחדל LATE_RETURN_THRESHOLD_DAYS
 * @param {Date} [now] - "עכשיו" (לבדיקות); ברירת מחדל new Date()
 * @returns {{isLate: boolean, daysLate?: number, dueDate?: Date}}
 */
export function getLateReturnInfo(order, thresholdDays = LATE_RETURN_THRESHOLD_DAYS, now = new Date()) {
  if (!order) return { isLate: false };
  const dueDateRaw = order.toDate || order.returnDate
    || (order.eventDate ? addDaysSkippingWeekends(toIsraelCalendarDate(order.eventDate), 1) : null);
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
