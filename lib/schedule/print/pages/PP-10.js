// lib/schedule/print/pages/PP-10.js — "דף משלוח הלוך (למשלוחן)" (דף 10). גם הבסיס של PP-18 (משלוח חזור): אותו מבנה, כיוון אחר.
//
// העיצוב: תצוגות-עיצוב/דפי-הדפסה-עיצוב.html, courierPage('10','out',…). ההחלטה PP-10 "כן - כמו שהוא" (מרווחים בלבד).
// מחליף בעיצוב את /print/delivery-courier?direction=out (המשטח הישן לא הוסר, ר' registry.replaces): אותם שדות -
// שם מלא, כתובת, טלפון 1, טלפון 2 - וקיבוץ לפי תאריך האירוע עם כותרת "משלוח הלוך אירועים <יום ותאריך עברי> (משלוח יוצא
// <יום>)" כמו buildCourierGroupTitle ב-lib/deliveryCourier.js (כאן עם שנה עברית, כמו בעיצוב). ברקוד שורה: DOT-<הזמנה>
// (`barcode.rows='order'`), "כל הדף" בכותרת. הרשאה: extraPageKeys = PRINT_DELIVERIES_PAGE_KEYS ב-registry.
//
// מזין: שלב 5 (dout) / שלב 9 (dback) של getScheduleDay - שורות lib/deliveries.js (street/city/טלפונים/dressCount/
// dispatchDate/notes) כמו שהלו״ז כבר טען אותן; אין שאילתה נוספת ואין extras.
// `courierGroups` = אותה צורה ש-renderCourierDeliveryEmailHtml (lib/emailTemplates.js) צורך
// ({ title, rows:[{ customerName, address, customerPhone, customerPhone2 }] }) - כך אפשר לחבר בהמשך את מייל השליח
// לאותה רשימה בלי לשלוף שוב (INVENTORY-print-export D5/B10).
import { hFull, wdOnly, greg, customerName, cnt } from '../format';
import { orderCode } from '../barcode';

export const SHEET_NAME = 'דף משלוח הלוך';

/** שורת משלוח אחידה מתוך שורת שלב 5/9 של הלו״ז */
export function courierRow(r, day, prefix) {
  const a = r.address || {};
  const street = String(a.street || '').trim();
  const city = String(a.city || '').trim();
  const phones = [r.customer && r.customer.phone1, r.customer && r.customer.phone2].map((p) => (p ? String(p).trim() : ''));
  return {
    orderId: r.orderId,
    code: orderCode(prefix, r.orderId),
    name: customerName(r.customer),
    street,
    city,
    address: a.full || (street && city ? `${street}, ${city}` : street || city || ''),
    missingAddress: !street || !city,
    phone1: phones[0],
    phone2: phones[1],
    dressCount: r.dressCount || 0,
    notes: r.notes || '',
    eventKey: r.eventKey || null,
    eventGreg: r.eventKey ? greg(r.eventKey) : '',
    dispatchKey: r.dispatchDate || day.date,
  };
}

/** הכותרת הקבועה לקבוצת משלוחן: כיוון + אירועים + תאריך (עברי) + יום היציאה/האיסוף בפועל */
export function courierGroupTitle({ out, eventKey, dispatchKey }) {
  return `משלוח ${out ? 'הלוך' : 'חזור'} אירועים ${eventKey ? hFull(eventKey) : ''} (משלוח ${out ? 'יוצא' : 'נאסף'} ${wdOnly(dispatchKey)})`;
}

/** בונה את נתוני הדף לכיוון נתון. out=true: הלוך (שלב dout, DOT); אחרת חזור (שלב dback, DBK) */
export function buildCourierData({ day, out }) {
  const stageKey = out ? 'dout' : 'dback';
  const prefix = out ? 'DOT' : 'DBK';
  const stage = (day.stages || []).find((s) => s.key === stageKey);
  const items = stage ? stage.items : [];
  const rows = items.map((r) => courierRow(r, day, prefix));
  // קבוצה לכל (תאריך אירוע, יום יציאה/איסוף): כמו groupDeliveryRowsForCourier (מפתח כיוון|אירוע|יום שיגור)
  const map = new Map();
  for (const r of rows) {
    const k = `${r.eventKey || ''}|${r.dispatchKey}`;
    if (!map.has(k)) map.set(k, { key: k, eventKey: r.eventKey, dispatchKey: r.dispatchKey, rows: [] });
    map.get(k).rows.push(r);
  }
  const groups = [...map.values()].sort((a, b) => String(a.eventKey || '').localeCompare(String(b.eventKey || '')) || a.dispatchKey.localeCompare(b.dispatchKey)).map((g) => ({
    ...g,
    title: courierGroupTitle({ out, eventKey: g.eventKey, dispatchKey: g.dispatchKey }),
    rows: g.rows.sort((a, b) => a.orderId - b.orderId),
  }));
  const dresses = rows.reduce((s, r) => s + r.dressCount, 0);
  const noun = out ? ['משלוח אחד', 'משלוחים'] : ['איסוף אחד', 'איסופים'];
  return {
    title: out ? 'נתוני משלוחים למשלוחן · הלוך' : 'נתוני משלוחים למשלוחן · חזור',
    sub: out ? 'שם, כתובת ושני טלפונים לכל משלוח' : 'שם, כתובת ושני טלפונים לכל איסוף',
    sum: `${cnt(rows.length, noun[0], noun[1])} · ${cnt(dresses, 'שמלה אחת', 'שמלות')}`,
    empty: rows.length === 0,
    groups,
    courierGroups: groups.map((g) => ({
      title: g.title,
      rows: g.rows.map((r) => ({ customerName: r.name, address: r.address, customerPhone: r.phone1, customerPhone2: r.phone2 })),
    })),
    totals: { stops: rows.length, dresses, missingAddress: rows.filter((r) => r.missingAddress).length },
  };
}

export function build({ day }) {
  return buildCourierData({ day, out: true });
}

export function courierToRows(data) {
  const out = [];
  for (const g of data.groups) {
    for (const r of g.rows) {
      out.push({
        'תאריך אירוע': r.eventGreg,
        'הזמנה': r.orderId,
        'שם מלא': r.name,
        'כתובת': r.address,
        'עיר': r.city,
        'טלפון 1': r.phone1,
        'טלפון 2': r.phone2,
        'שמלות': r.dressCount,
        'הערות להזמנה': r.notes,
      });
    }
  }
  return out;
}

export const toRows = courierToRows;
