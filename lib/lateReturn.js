import { addDaysSkippingWeekends } from './clientInventory';

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
 * @returns {{isLate: boolean, daysLate?: number, dueDate?: Date}}
 */
export function getLateReturnInfo(order, thresholdDays = LATE_RETURN_THRESHOLD_DAYS) {
  if (!order) return { isLate: false };
  const dueDateRaw = order.toDate || order.returnDate
    || (order.eventDate ? addDaysSkippingWeekends(order.eventDate, 1) : null);
  if (!dueDateRaw) return { isLate: false };

  const dueDate = new Date(dueDateRaw);
  if (isNaN(dueDate.getTime())) return { isLate: false };
  dueDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysLate = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
  if (daysLate < thresholdDays) return { isLate: false, daysLate, dueDate };
  return { isLate: true, daysLate, dueDate };
}
