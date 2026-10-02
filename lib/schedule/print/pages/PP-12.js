// lib/schedule/print/pages/PP-12.js — "תעודות משלוח" (דף 12): תעודת משלוח לכל הזמנה, כל תעודה בעמוד A4 משלה.
//
// העיצוב: תצוגות-עיצוב/דפי-הדפסה-עיצוב.html, p12() (dn-wrap.one). ההחלטות: PP-12 "כן; כל הזמנה בעמוד נפרד"
// (perOrderPage:'always' ב-registry); ברקוד הכותרת בכל עמוד הוא של המשלוח עצמו (DOT-<מספר הזמנה>) והברקוד הכפול שהיה בתוך
// התעודה הוסר; PQ-06 התעודה מחליפה את "נתונים לשקית" (/print/delivery-bag, app/print/delivery-bag/page.js) וכוללת את כל מה
// שהיה בו: שם, כתובת, טלפונים, תאריך האירוע (עברי + לועזי), יום יציאת המשלוח, "שקית ___ מתוך ___" (אין במערכת מספר שקיות
// להזמנה - קווים למילוי בכתב יד), הערות להזמנה; ובנוסף מספר שמלות וחתימת מקבלת (נמסר ל / חתימה / תאריך ושעה).
// מזין: שלב 5 (dout) של getScheduleDay - אותן שורות כמו PP-10, בלי שאילתה נוספת. הרשאה: PRINT_DELIVERIES_PAGE_KEYS.
import { hFull, hDay, greg, cnt } from '../format';
import { courierRow } from './PP-10';

export const SHEET_NAME = 'תעודות משלוח';

export function build({ day }) {
  const stage = (day.stages || []).find((s) => s.key === 'dout');
  const items = stage ? stage.items : [];
  const orders = items.map((r) => {
    const o = courierRow(r, day, 'DOT');
    return {
      ...o,
      eventFull: o.eventKey ? hFull(o.eventKey) : (r.eventDateHebrew || ''),
      dispatchFull: hDay(o.dispatchKey),
      dispatchGreg: greg(o.dispatchKey),
    };
  }).sort((a, b) => a.orderId - b.orderId);
  const dresses = orders.reduce((s, o) => s + o.dressCount, 0);
  return {
    title: 'תעודת משלוח',
    sub: 'תעודה אחת בכל עמוד',
    sum: `${cnt(orders.length, 'תעודה אחת', 'תעודות')} · ${cnt(dresses, 'שמלה אחת', 'שמלות')}`,
    empty: orders.length === 0,
    orders,
    totals: { notes: orders.length, dresses },
  };
}

export function toRows(data) {
  return data.orders.map((o) => ({
    'הזמנה': o.orderId,
    'שם מלא': o.name,
    'כתובת': o.address,
    'עיר': o.city,
    'טלפון 1': o.phone1,
    'טלפון 2': o.phone2,
    'תאריך אירוע': o.eventGreg,
    'תאריך עברי': o.eventFull,
    'משלוח יוצא': o.dispatchGreg,
    'שמלות': o.dressCount,
    'הערות להזמנה': o.notes,
  }));
}
