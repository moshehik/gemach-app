// lib/schedule/print/pages/PP-11.js — "רשימת שליח לפי עיר" (דף 11): מסלול ליום המשלוח, מקובץ לפי עיר, עם תיבת "נמסר".
//
// העיצוב: תצוגות-עיצוב/דפי-הדפסה-עיצוב.html, routePage('11','out',…). ההחלטה PP-11 "כן - כמו שהוא" (מרווחים בלבד).
// מזין: שלב 5 (dout) של getScheduleDay - אותן שורות כמו PP-10 (בלי שאילתה נוספת). הקיבוץ הקיים בהדפסת המשלוחן הוא לפי
// כיוון + תאריך אירוע; כאן לפי עיר (שדה city כבר בשורה, INVENTORY #11). סדר הערים: הכי הרבה עצירות קודם (כדי שהשליח
// יתחיל מהריכוז הגדול; כמו הדוגמה בעיצוב), ובשוויון לפי שם העיר; "ללא עיר" תמיד בסוף. העצירות ממוספרות ברציפות לאורך
// כל הדף (עמודת "עצירה"), בתוך עיר לפי מספר הזמנה (כמו הדוגמה בעיצוב). ברקוד שורה DOT-<הזמנה> (`rows:'order'`), "כל הדף" בכותרת.
// "המשך בעמוד הבא" של התצוגה (עזר ידני לגיליון בגובה קבוע) לא נדרש: הטבלה זורמת וכותרת העמודות חוזרת בכל עמוד.
import { cnt } from '../format';
import { courierRow } from './PP-10';

export const SHEET_NAME = 'רשימת שליח לפי עיר';

const NO_CITY = 'ללא עיר';

/** מחלק שורות משלוח לערים וממספר עצירות. out=true: הלוך (DOT); false: חזור (DBK) - PP-19 משתמש באותו בנאי */
export function buildRouteData({ day, out }) {
  const stageKey = out ? 'dout' : 'dback';
  const stage = (day.stages || []).find((s) => s.key === stageKey);
  const items = stage ? stage.items : [];
  const rows = items.map((r) => courierRow(r, day, out ? 'DOT' : 'DBK'));
  const byCity = new Map();
  for (const r of rows) {
    const city = r.city || NO_CITY;
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city).push(r);
  }
  const cities = [...byCity.entries()].sort((a, b) => {
    if ((a[0] === NO_CITY) !== (b[0] === NO_CITY)) return a[0] === NO_CITY ? 1 : -1;
    return b[1].length - a[1].length || a[0].localeCompare(b[0], 'he');
  });
  let stop = 0;
  const groups = cities.map(([city, list]) => {
    list.sort((a, b) => a.orderId - b.orderId);
    const stops = list.map((r) => ({ ...r, stop: ++stop }));
    return { key: city, city, rows: stops, dresses: stops.reduce((s, r) => s + r.dressCount, 0) };
  });
  const flat = groups.flatMap((g) => g.rows);
  const dresses = flat.reduce((s, r) => s + r.dressCount, 0);
  return {
    title: out ? 'רשימת שליח לפי עיר' : 'רשימת איסוף מלקוחות לפי עיר',
    sub: out ? 'מסלול ליום המשלוח' : 'מסלול ליום האיסוף',
    sum: `${cnt(groups.length, 'עיר אחת', 'ערים')} · ${cnt(flat.length, 'עצירה אחת', 'עצירות')} · ${cnt(dresses, 'שמלה אחת', 'שמלות')}`,
    empty: flat.length === 0,
    groups,
    totals: { cities: groups.length, stops: flat.length, dresses },
  };
}

export function build({ day }) {
  return buildRouteData({ day, out: true });
}

export function routeToRows(data) {
  return data.groups.flatMap((g) => g.rows).map((r) => ({
    'עצירה': r.stop,
    'עיר': r.city || '',
    'הזמנה': r.orderId,
    'שם': r.name,
    'רחוב ומספר': r.street,
    'טלפון 1': r.phone1,
    'טלפון 2': r.phone2,
    'שמלות': r.dressCount,
    'הערות להזמנה': r.notes,
  }));
}

export const toRows = routeToRows;
