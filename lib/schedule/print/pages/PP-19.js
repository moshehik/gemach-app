// lib/schedule/print/pages/PP-19.js — "רשימת איסוף מלקוחות לפי עיר" (דף 19): מסלול ליום האיסוף, מקובץ לפי עיר, עם תיבת "נאסף".
//
// העיצוב: תצוגות-עיצוב/דפי-הדפסה-עיצוב.html, routePage('19','return',...). ההחלטות: PP-19 "כן, כמו שהוא"; ברקוד DBK-<הזמנה>
// בכל שורה + ALL-DBK-YYMMDD בכותרת (registry); מספר שמלות בלבד, בלי פרטי דגם. הרשאת דף המשלוחים (registry).
// מזין: שלב 9 (dback) של getScheduleDay = משלוחים שהשליח אוסף ביום זה (lib/deliveries.js, "לפי יום השליח"; בלי טיוטות).
// כתובת: address.street (רחוב ומספר) + address.city (העיר היא כותרת הקבוצה). בלי רחוב -> דגל "חסרה כתובת".
// סדר: ערים לפי מספר עצירות (הגדולה קודם), ואז לפי א"ב; בתוך עיר לפי רחוב (מסלול; בלי כתובת - בסוף) ואז שם; "עצירה" מספור רץ לאורך כל הדף.
import { customerName, customerPhones, cnt } from '../format';
import { orderCode } from '../barcode';

export const SHEET_NAME = 'איסוף מלקוחות לפי עיר';
export const NO_CITY = 'ללא עיר';

const heCmp = (a, b) => String(a).localeCompare(String(b), 'he', { numeric: true });

export function build({ day, page }) {
  const stage = (day.stages || []).find((s) => s.key === 'dback');
  const items = stage ? stage.items : [];
  const prefix = (page && page.barcode && page.barcode.prefix) || 'DBK';
  const byCity = new Map();
  for (const r of items) {
    const a = r.address || {};
    const city = String(a.city || '').trim() || NO_CITY;
    const phones = customerPhones(r.customer);
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city).push({
      orderId: r.orderId,
      name: customerName(r.customer),
      street: String(a.street || '').trim(),
      city: city === NO_CITY ? '' : city,
      phone: phones[0] || '',
      phone2: phones[1] || '',
      dressCount: r.dressCount || 0,
      notes: r.notes || '',
      // כבר נאסף (סימון תקין/לא תקין קיים על ההזמנה) - מודפס כ"נאסף" במקום תיבה ריקה
      done: !!r.returnCondition,
      code: orderCode(prefix, r.orderId),
    });
  }
  const groups = [...byCity.entries()]
    .map(([city, rows]) => ({ city, rows: rows.sort((a, b) => (!a.street) - (!b.street) || heCmp(a.street, b.street) || heCmp(a.name, b.name) || a.orderId - b.orderId) }))
    .sort((a, b) => (a.city === NO_CITY) - (b.city === NO_CITY) || b.rows.length - a.rows.length || heCmp(a.city, b.city));
  let n = 0;
  for (const g of groups) {
    g.dresses = g.rows.reduce((s, r) => s + r.dressCount, 0);
    for (const r of g.rows) r.stop = ++n;
  }
  const stops = n;
  const dresses = groups.reduce((s, g) => s + g.dresses, 0);
  const realCities = groups.filter((g) => g.city !== NO_CITY).length;
  return {
    title: 'רשימת איסוף מלקוחות לפי עיר',
    sub: 'מסלול ליום האיסוף',
    sum: [realCities ? cnt(realCities, 'עיר אחת', 'ערים') : '', cnt(stops, 'עצירה אחת', 'עצירות'), cnt(dresses, 'שמלה אחת', 'שמלות')].filter(Boolean).join(' · '),
    empty: stops === 0,
    groups,
    totals: { cities: realCities, stops, dresses },
  };
}

export function toRows(data) {
  const out = [];
  for (const g of data.groups) {
    for (const r of g.rows) {
      out.push({
        'עצירה': r.stop,
        'עיר': r.city,
        'לקוחה': r.name,
        'הזמנה': r.orderId,
        'רחוב ומספר': r.street,
        'טלפון 1': r.phone,
        'טלפון 2': r.phone2,
        'שמלות': r.dressCount,
        'הערה': r.notes,
        'נאסף': r.done ? 'כן' : 'לא',
        'ברקוד': r.code,
      });
    }
  }
  return out;
}
