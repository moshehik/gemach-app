// lib/schedule/print/pages/PP-01.js — "דוח הזמנות כללי" (דף 01): סיכום בראש הדף + טבלה. לידיעה בלבד.
//
// דף הייחוס לדפי "סיכום + טבלה". העיצוב: תצוגות-עיצוב/דפי-הדפסה-עיצוב.html, p01(). ההחלטות: PP-01 "לא - זה רק דוח
// כללי" -> בלי אישור, בלי עמודת "נבדק", בלי חתימה; PQ-02 בלי ברקוד; PQ-03 בלי סניף (עמודת "סוג" = משלוח / איסוף);
// PQ-10 השם "דוח הזמנות כללי". מזין: שלב 1 (order) של getScheduleDay = ההזמנות שנרשמו באותו יום (A2), כולל
// הזמנות שעוד לא שולמו (A7). "שולם" ו"יתרה" מגיעים מה-extra 'orderInfo' (סכום התשלומים להזמנות הדף - שאילתה
// אחת קטנה שה-API טוען רק לדפים שמבקשים אותה; לפי החלטת הבעלים 1.10 הלו״ז עצמו לא טוען תשלומים).
import { hDay, greg, customerName, customerPhones, cnt } from '../format';

export const SHEET_NAME = 'דוח הזמנות כללי';

export function build({ day, extras }) {
  const stage = (day.stages || []).find((s) => s.key === 'order');
  const items = stage ? stage.items : [];
  const info = (extras && extras.orderInfo) || {};
  const rows = items.map((r) => {
    const i = info[r.orderId] || {};
    const total = r.totalAmount === null || r.totalAmount === undefined ? null : Number(r.totalAmount);
    // הזמנה בלי סכום ובלי תשלומים: עמודות הכסף ריקות (לא ₪0)
    const paid = i.totalPaid === undefined || (total === null && !i.totalPaid) ? null : Number(i.totalPaid);
    const balance = total === null || paid === null ? null : Math.max(0, Math.round((total - paid) * 100) / 100);
    const d = i.delivery || {};
    return {
      orderId: r.orderId,
      name: customerName(r.customer),
      notes: r.notes || '',
      phone: customerPhones(r.customer)[0] || '',
      eventKey: r.eventKey || null,
      eventHebrew: r.eventKey ? hDay(r.eventKey) : (r.eventDateHebrew || ''),
      eventGreg: r.eventKey ? greg(r.eventKey) : '',
      dressCount: r.dressCount || 0,
      type: d.isDelivery && d.direction !== 'חזור' ? 'משלוח' : 'איסוף',
      total,
      paid,
      balance,
      isPaid: !!r.isPaid,
    };
  });
  const sum = (f) => rows.reduce((s, r) => s + (f(r) || 0), 0);
  const totals = { orders: rows.length, dresses: sum((r) => r.dressCount), total: sum((r) => r.total), paid: sum((r) => r.paid) };
  totals.balance = Math.max(0, Math.round((totals.total - totals.paid) * 100) / 100);
  return {
    title: 'דוח הזמנות כללי',
    sub: 'הזמנות שנרשמו היום · דוח כללי לידיעה, בלי אישור ובלי סימון',
    sum: `${cnt(rows.length, 'הזמנה אחת', 'הזמנות')} · ${cnt(totals.dresses, 'שמלה אחת', 'שמלות')}`,
    empty: rows.length === 0,
    stats: [
      { label: 'הזמנות בדוח', value: rows.length },
      { label: 'שמלות', value: totals.dresses },
      { label: 'סה״כ חיוב', money: totals.total },
      { label: 'שולם', money: totals.paid },
      { label: 'יתרה', money: totals.balance },
    ],
    rows,
    totals,
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
    'סוג': r.type,
    'חיוב': r.total,
    'שולם': r.paid,
    'יתרה': r.balance,
    'הערה': r.notes,
  }));
}
