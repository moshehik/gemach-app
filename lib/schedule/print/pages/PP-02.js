// lib/schedule/print/pages/PP-02.js — "סיכום יתרות לגבייה" (דף 02): הזמנות עם יתרה לתשלום, מהאירוע הקרוב לרחוק. לידיעה בלבד.
//
// העיצוב: תצוגות-עיצוב/דפי-הדפסה-עיצוב.html, p02(). ההחלטות (DECISIONS-דפי-הדפסה.md): PP-02 "כן" + "לא ברור איפה ולמה יש
// שימוש בברקוד" -> הברקוד הוסר (PQ-07 אישר: אין ברקוד, אין סימון "בוצע" בשלב ההזמנה). בלי שורות "תאריך/חתימת אישור"
// (דף לידיעה בלבד). עמודת "נגבה" ו"הערת גבייה" הן תיבה וקו לכתיבה ביד, כמו בעיצוב. דף עם כסף: הרשאת דף ההזמנות (registry).
//
// מקור הנתונים: שלב 1 (order) של getScheduleDay - אותן הזמנות כמו דף 01 (הזמנות שנרשמו ביום; החלטה A2), עם
// totalAmount; "שולם" מה-extra 'orderInfo' (Σ תשלומים שלא נמחקו). יתרה = סכום ההזמנה פחות שולם, בדיוק כמו PP-01.
// הזמנה בלי סכום (null) לא נכנסת: אין יתרה ידועה. רק יתרה > 0 מופיעה בדף.
import { hDay, hShort, greg, money, customerName, customerPhones, cnt } from '../format';

export const SHEET_NAME = 'סיכום יתרות לגבייה';

// הפרש ימים קלנדריים בין שני מפתחות YYYY-MM-DD (UTC, בלי תלות באזור זמן)
export function daysBetween(fromKey, toKey) {
  const f = String(fromKey).split('-').map(Number);
  const t = String(toKey).split('-').map(Number);
  return Math.round((Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(f[0], f[1] - 1, f[2])) / 86400000);
}

const round2 = (n) => Math.round(n * 100) / 100;

export function build({ day, extras }) {
  const stage = (day.stages || []).find((s) => s.key === 'order');
  const items = stage ? stage.items : [];
  const info = (extras && extras.orderInfo) || {};
  const rows = [];
  for (const r of items) {
    if (r.totalAmount === null || r.totalAmount === undefined) continue;
    const total = Number(r.totalAmount);
    const i = info[r.orderId] || {};
    const paid = Number(i.totalPaid) || 0;
    const balance = Math.max(0, round2(total - paid));
    if (!(balance > 0)) continue;
    rows.push({
      orderId: r.orderId,
      name: customerName(r.customer),
      phone: customerPhones(r.customer)[0] || '',
      eventKey: r.eventKey || null,
      eventHebrew: r.eventKey ? hDay(r.eventKey) : (r.eventDateHebrew || ''),
      eventGreg: r.eventKey ? greg(r.eventKey) : '',
      daysToEvent: r.eventKey ? daysBetween(day.date, r.eventKey) : null,
      total,
      paid,
      balance,
    });
  }
  // הקרוב לרחוק: לפי תאריך האירוע (בלי תאריך - בסוף), ואז לפי מספר הזמנה
  rows.sort((a, b) => {
    if (a.eventKey !== b.eventKey) {
      if (!a.eventKey) return 1;
      if (!b.eventKey) return -1;
      return a.eventKey < b.eventKey ? -1 : 1;
    }
    return a.orderId - b.orderId;
  });
  const totals = { orders: rows.length, balance: round2(rows.reduce((s, r) => s + r.balance, 0)) };
  const nearest = rows.find((r) => r.eventKey) || null;
  const stats = [{ label: 'הזמנות עם יתרה', value: rows.length }];
  if (nearest) stats.push({ label: 'הקרובה ביותר:', value: hShort(nearest.eventKey) });
  stats.push({ label: 'מסודר לפי תאריך האירוע, הקרוב קודם', value: null });
  return {
    title: 'סיכום יתרות לגבייה',
    sub: 'הזמנות עם יתרה לתשלום · לידיעה בלבד',
    sum: `${money(totals.balance)} · סה״כ לגבייה`,
    empty: rows.length === 0,
    stats,
    rows,
    totals,
    totalLabel: `סה״כ יתרות לגבייה (${cnt(rows.length, 'הזמנה אחת', 'הזמנות')})`,
  };
}

export function toRows(data) {
  return data.rows.map((r) => ({
    'הזמנה': r.orderId,
    'לקוחה': r.name,
    'טלפון': r.phone,
    'תאריך אירוע': r.eventGreg,
    'תאריך עברי': r.eventHebrew,
    'ימים לאירוע': r.daysToEvent,
    'חיוב': r.total,
    'שולם': r.paid,
    'יתרה לגבייה': r.balance,
  }));
}
