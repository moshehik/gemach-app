// lib/eventDay.js — הגדרת "יום האירוע לפי התאריך העברי השמור" (שרת). ההסבר המלא: getEventDayRange ב-lib/hebrewDate.js.
//
// event_date_evening_rollover (boolean). חסר/כבוי = ההתנהגות הקודמת (היום הקלנדרי בישראל, getIsraelDayRange).
// דלוק (הגמח הראשי, שם ההזמנות שהגיעו מהייבוא שמורות כ"ערב היום הקודם") = סינון והדפסה לפי התאריך העברי שנכתב בהזמנה.
import { getCachedSetting } from '@/lib/settingsCache';

export const EVENT_EVENING_ROLLOVER_KEY = 'event_date_evening_rollover';

export async function isEventEveningRollover() {
  try {
    const row = await getCachedSetting(EVENT_EVENING_ROLLOVER_KEY);
    return row?.value === 'true';
  } catch {
    return false; // fail-open להתנהגות הקודמת
  }
}
