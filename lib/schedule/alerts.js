// lib/schedule/alerts.js — התראות שורה בלו״ז (החלטה S09): "באיחור - לא סומן כבוצע" ו"חסרה כתובת משלוח".
//
// כללים (ר' docs/schedule-page-logic-spec.md):
//   * שלבי מידע (1, 7) - אין התראות.
//   * החזרה ידנית (8) - "באיחור" רק לפי late_return_threshold_days (ברירת מחדל 7) ממועד ההחזרה הצפוי,
//     כמו /api/orders/overdue ובר ההחזרה המהיר (החלטה B15/JDG-03; הדגימה השתמשה בכלל אחר - לא אומץ).
//   * שלבים עם שדה "בוצע" (2 תיקונים, 6 איסוף) - "באיחור" כשהיום המבוקש כבר עבר ולא סומן.
//   * שלבים בלי שדה קיים (4, 5, 9) - אותו כלל ברגע שיש טבלת סימונים (row.canMark מ-lib/schedule/marks.js);
//     בלי הטבלה אי אפשר לדעת אם בוצע, ולכן אין התראת איחור (פער G1 ב-INVENTORY).
//   * משלוחים (5, 9) - "חסרה כתובת משלוח" כשאין רחוב או אין עיר (לא רק כשהכל ריק).

import { daysBetween } from './dates';

export const ALERT_CODES = {
  LATE_NOT_DONE: 'late_not_done',
  MISSING_DELIVERY_ADDRESS: 'missing_delivery_address',
};

export const ALERT_LABELS = {
  [ALERT_CODES.LATE_NOT_DONE]: 'באיחור - לא סומן כבוצע',
  [ALERT_CODES.MISSING_DELIVERY_ADDRESS]: 'חסרה כתובת משלוח',
};

function alert(code, extra) {
  return { code, label: ALERT_LABELS[code], ...(extra || {}) };
}

export function isDeliveryAddressMissing(address) {
  if (!address) return true;
  const street = String(address.street || '').trim();
  const city = String(address.city || '').trim();
  return !street || !city;
}

/**
 * @param {object} row  שורת לו״ז (ר' loaders.js): done, address, stageDate
 * @param {object} stage הגדרת השלב מ-stages.js
 * @param {{dayKey: string, todayKey: string, lateReturnThresholdDays: number}} ctx
 */
export function alertsForRow(row, stage, ctx) {
  const out = [];
  if (!row || !stage || stage.infoOnly) return out;

  if (row.done === false) {
    if (stage.key === 'manret') {
      const daysLate = daysBetween(ctx.dayKey, ctx.todayKey);
      if (daysLate >= ctx.lateReturnThresholdDays) out.push(alert(ALERT_CODES.LATE_NOT_DONE, { daysLate }));
    } else if ((stage.doneSource || row.canMark) && ctx.dayKey < ctx.todayKey) {
      out.push(alert(ALERT_CODES.LATE_NOT_DONE, { daysLate: daysBetween(ctx.dayKey, ctx.todayKey) }));
    }
  }

  if (stage.showAddress && (stage.key === 'dout' || stage.key === 'dback') && isDeliveryAddressMissing(row.address)) {
    out.push(alert(ALERT_CODES.MISSING_DELIVERY_ADDRESS));
  }

  return out;
}
