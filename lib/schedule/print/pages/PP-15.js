// lib/schedule/print/pages/PP-15.js — "רשימת אירועים" (דף 15): טבלה פשוטה, לידיעה בלבד, בלי ברקוד ובלי סניף.
//
// דף הייחוס לדפי "טבלה פשוטה". העיצוב: תצוגות-עיצוב/דפי-הדפסה-עיצוב.html, p15(). ההחלטות: PP-15 "כן", PQ-02
// (בלי ברקוד), PQ-03 (בלי סניף: בעמודת "קבלה" כתוב "איסוף" בלבד). מזין: שלב 7 (event) של getScheduleDay.
//
// חוזה מודול דף (אותו חוזה לכל 15 הדפים):
//   build({ day, page, version, extras, now }) -> data   (טהור; day = תשובת getScheduleDay; page = רשומת ה-registry)
//     data.title / data.sub / data.sum  טקסטי פס הכותרת (שם הדף, שורת משנה, סיכום מימין)
//     data.empty                        true כשאין שורות (התבנית מציגה "אין פריטים בדף זה")
//     data.<...>                        מה שהתבנית ב-app/components/schedule/print/pages/<Key>.js צריכה
//   toRows(data) -> [{ עמודה: ערך }]    שורות שטוחות לייצוא Excel (עמודות בעברית; מספרים כמספרים, טלפון כטקסט)
//   SHEET_NAME                          שם הגיליון ב-Excel (עד 31 תווים)
import { hFull, greg, customerName, customerPhones, cnt } from '../format';
import { isDeliveryOut, isDeliveryReturn } from '../../deliveryDirection';

export const SHEET_NAME = 'רשימת אירועים';

// row.delivery = extras.orderInfo[..].delivery = { isDelivery, direction }. כיוון null בהזמנת משלוח = 'הלוך-חזור'
// (אותו כלל כמו הלו״ז - lib/schedule/deliveryDirection.js; לפני כן null הודפס כ"איסוף" / "החזרה ידנית").
const asOrder = (d) => ({ isDelivery: !!(d && d.isDelivery), deliveryDirection: (d && d.direction) || null });
function receiveText(row) {
  // משלוח הלוך = ההזמנה היא משלוח בכיוון הלוך / הלוך-חזור; אחרת הלקוחה אוספת (בלי שם הסניף - PQ-03)
  return isDeliveryOut(asOrder(row.delivery)) ? 'משלוח הלוך' : 'איסוף';
}
function returnText(row) {
  return isDeliveryReturn(asOrder(row.delivery)) ? 'משלוח חזור' : 'החזרה ידנית';
}

export function build({ day, extras }) {
  const stage = (day.stages || []).find((s) => s.key === 'event');
  const items = stage ? stage.items : [];
  const fin = (extras && extras.orderInfo) || {};
  // קיבוץ לפי תאריך האירוע (ברוב הימים קבוצה אחת = היום; הזמנת חו"ל/אמצע שבוע יכולה להביא תאריך התחלה אחר)
  const byKey = new Map();
  for (const r of items) {
    const k = r.eventKey || day.date;
    if (!byKey.has(k)) byKey.set(k, []);
    const info = fin[r.orderId] || {};
    byKey.get(k).push({
      orderId: r.orderId,
      name: customerName(r.customer),
      phone: customerPhones(r.customer)[0] || '',
      city: info.city || (r.customer && r.customer.city) || '',
      dressCount: r.dressCount || 0,
      receive: receiveText({ delivery: info.delivery }),
      ret: returnText({ delivery: info.delivery }),
      notes: r.notes || '',
    });
  }
  const groups = [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, rows]) => ({
    key,
    label: hFull(key) + (key === day.date ? ' (היום)' : ''),
    greg: greg(key),
    rows,
    dresses: rows.reduce((s, r) => s + r.dressCount, 0),
  }));
  const total = items.length;
  const dresses = groups.reduce((s, g) => s + g.dresses, 0);
  return {
    title: 'רשימת אירועים',
    sub: 'לידיעה בלבד, ללא סימון ביצוע',
    sum: `${cnt(total, 'אירוע אחד', 'אירועים')} · ${cnt(dresses, 'שמלה אחת', 'שמלות')}`,
    empty: total === 0,
    stats: [
      { label: groups.length > 1 ? 'אירועים בכל הימים' : 'אירועים היום', value: total },
      { label: 'שמלות בחוץ', value: dresses },
      { label: 'לידיעה בלבד', value: null },
    ],
    groups,
    totals: { events: total, dresses },
  };
}

export function toRows(data) {
  const out = [];
  for (const g of data.groups) {
    for (const r of g.rows) {
      out.push({
        'תאריך אירוע': g.greg,
        'הזמנה': r.orderId,
        'לקוחה': r.name,
        'טלפון': r.phone,
        'עיר': r.city,
        'שמלות': r.dressCount,
        'קבלה': r.receive,
        'חזרה': r.ret,
        'הערות להזמנה': r.notes,
      });
    }
  }
  return out;
}
