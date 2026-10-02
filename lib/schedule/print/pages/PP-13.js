// lib/schedule/print/pages/PP-13.js — "דף איסוף מקומי" (דף 13): מי מגיעה לקחת את השמלות היום, עם יתרה לתשלום וברקוד לכל הזמנה.
//
// העיצוב: תצוגות-עיצוב/דפי-הדפסה-עיצוב.html, p13(). ההחלטות: PP-13 "כן; תוריד את סניף" -> עמודת "סניף איסוף" הוסרה
// (גם לא בייצוא ל-Excel); ברקוד PCK-<הזמנה> בכל שורה + ALL-PCK-YYMMDD בכותרת (registry). דף עם כסף: הרשאת דף ההזמנות.
// מזין: שלב 6 (pick) של getScheduleDay - הזמנות שאינן משלוח הלוך שהאיסוף שלהן ביום זה (הכלל האחיד של ימי עסקים).
// "יתרה לתשלום": שורות שלב 6 לא נושאות סכום, ולכן ה-extra 'orderBalance' (שאילתה אחת: סכום ההזמנה פחות תשלומים,
// כמו PP-01). שעות הקבלה: ההגדרה standard_pickup_hours (day.settings.pickupHours, ברירת מחדל 20:00-21:30).
import { hDay, hShort, greg, customerName, customerPhones, cnt } from '../format';
import { orderCode } from '../barcode';

export const SHEET_NAME = 'דף איסוף מקומי';

/** '20:00-21:30' -> '20:00 עד 21:30' (טקסט חופשי נשאר כמו שהוא) */
export function pickupHoursText(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}:\d{2})\s*[-–־]\s*(\d{1,2}:\d{2})$/);
  return m ? `${m[1]} עד ${m[2]}` : s;
}

export function build({ day, page, extras }) {
  const stage = (day.stages || []).find((s) => s.key === 'pick');
  const items = stage ? stage.items : [];
  const bal = (extras && extras.orderBalance) || {};
  const prefix = (page && page.barcode && page.barcode.prefix) || 'PCK';
  const rows = items.map((r) => {
    const b = bal[r.orderId];
    return {
      orderId: r.orderId,
      name: customerName(r.customer),
      phone: customerPhones(r.customer)[0] || '',
      eventKey: r.eventKey || null,
      eventHebrew: r.eventKey ? hShort(r.eventKey) : (r.eventDateHebrew || ''),
      eventGreg: r.eventKey ? greg(r.eventKey) : '',
      dressCount: r.dressCount || 0,
      // null = אין סכום להזמנה (יתרה לא ידועה) -> תא ריק; 0 = שולם
      balance: b && b.balance !== null && b.balance !== undefined ? b.balance : null,
      done: r.done === true,
      code: orderCode(prefix, r.orderId),
    };
  });
  const dresses = rows.reduce((s, r) => s + r.dressCount, 0);
  const when = day.isToday ? 'היום' : 'ביום זה';
  return {
    title: 'דף איסוף מקומי',
    sub: `מי מגיעה לקחת את השמלות ${when}`,
    sum: `${cnt(rows.length, 'הזמנה אחת', 'הזמנות')} · ${cnt(dresses, 'שמלה אחת', 'שמלות')}`,
    empty: rows.length === 0,
    pickupLabel: day.isToday ? 'קבלת השמלות היום:' : 'קבלת השמלות:',
    dayLabel: hDay(day.date),
    pickupHours: pickupHoursText(day.settings && day.settings.pickupHours),
    rows,
    totals: { orders: rows.length, dresses },
  };
}

export function toRows(data) {
  return data.rows.map((r) => ({
    'הזמנה': r.orderId,
    'לקוחה': r.name,
    'טלפון': r.phone,
    'תאריך אירוע': r.eventGreg,
    'תאריך עברי': r.eventHebrew,
    'שמלות': r.dressCount,
    'יתרה לתשלום': r.balance,
    'נאסף': r.done ? 'כן' : 'לא',
    'ברקוד': r.code,
  }));
}
