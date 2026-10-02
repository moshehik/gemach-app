// lib/schedule/print/format.js — עזרי טקסט לדפי ההדפסה של הלו״ז (טהור; רץ גם בשרת וגם בדפדפן).
//
// תאריכים: עברי מ-lib/schedule/dates.js (hebrewLabel: "יום רביעי · כ״ג תשרי תשפ״ז"); כאן רק הצורות הנוספות
// שהעיצוב משתמש בהן (hDay "יום רביעי כ״ג תשרי", hShort "כ״ג תשרי", hFull, greg dd/mm/yyyy) והשעה בשעון ישראל.
// החישוב העברי עצמו הוא אותו Intl.DateTimeFormat('en-u-ca-hebrew') כמו בלוח של בורר התאריך
// (app/components/schedule/hebrewCalendar.js) - מועתק לכאן כדי שהשרת יוכל להריץ אותו בלי קומפוננטת לקוח.

const pad = (n) => (n < 10 ? '0' : '') + n;
export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const GEMATRIA = [
  [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'],
  [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'],
  [3, 'ג'], [2, 'ב'], [1, 'א'],
];
export function gematria(num) {
  let n = num;
  let s = '';
  while (n > 0) {
    for (let i = 0; i < GEMATRIA.length; i++) {
      if (n >= GEMATRIA[i][0]) { s += GEMATRIA[i][1]; n -= GEMATRIA[i][0]; break; }
    }
  }
  s = s.replace('יה', 'טו').replace('יו', 'טז');
  return s.length > 1 ? s.slice(0, -1) + '״' + s.slice(-1) : s + '׳';
}

function keyParts(key) {
  const p = String(key).split('-');
  return { y: +p[0], m: +p[1], d: +p[2] };
}
// צהרי היום בשעון המקומי - אותו יום קלנדרי בכל אזור זמן (כמו fromKey בבורר)
function keyToNoon(key) {
  const { y, m, d } = keyParts(key);
  return new Date(y, m - 1, d, 12);
}

let fmtParts = null;
let fmtMonth = null;
const cache = {};
export function hebrewParts(key) {
  if (cache[key]) return cache[key];
  if (!fmtParts) {
    fmtParts = new Intl.DateTimeFormat('en-u-ca-hebrew-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    fmtMonth = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' });
  }
  const date = keyToNoon(key);
  let day = 1;
  let year = 5787;
  fmtParts.formatToParts(date).forEach((x) => {
    if (x.type === 'day') day = +x.value;
    if (x.type === 'year') year = +x.value;
  });
  cache[key] = { d: day, dl: gematria(day), m: fmtMonth.format(date), y: gematria(year % 1000), wd: WEEKDAYS[keyToNoon(key).getDay()] };
  return cache[key];
}

/** "יום רביעי · כ״ג תשרי תשפ״ז" (כותרת הדף) */
export const hLong = (key) => { const h = hebrewParts(key); return 'יום ' + h.wd + ' · ' + h.dl + ' ' + h.m + ' ' + h.y; };
/** "יום רביעי כ״ג תשרי" */
export const hDay = (key) => { const h = hebrewParts(key); return 'יום ' + h.wd + ' ' + h.dl + ' ' + h.m; };
/** "יום רביעי כ״ג תשרי תשפ״ז" */
export const hFull = (key) => { const h = hebrewParts(key); return 'יום ' + h.wd + ' ' + h.dl + ' ' + h.m + ' ' + h.y; };
/** "כ״ג תשרי" */
export const hShort = (key) => { const h = hebrewParts(key); return h.dl + ' ' + h.m; };
/** "יום רביעי" */
export const wdOnly = (key) => 'יום ' + hebrewParts(key).wd;
/** 14/10/2026 */
export const greg = (key) => { const { y, m, d } = keyParts(key); return pad(d) + '/' + pad(m) + '/' + y; };
/** 14/10 */
export const gregShort = (key) => { const { m, d } = keyParts(key); return pad(d) + '/' + pad(m); };

/** "08:12" לפי שעון ישראל (לשורת "הופק מהמערכת") */
export function israelTime(now = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}
/** מפתח היום הישראלי של רגע נתון */
export function israelKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** ₪1,200 (מספר; null/undefined -> '') */
export function money(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  return '₪' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** cnt(1,'הזמנה אחת','הזמנות') -> 'הזמנה אחת'; cnt(3,'הזמנה אחת','הזמנות') -> '3 הזמנות' */
export const cnt = (n, one, many) => (n === 1 ? one : n + ' ' + many);
export const dressesText = (n) => cnt(n, 'שמלה אחת', 'שמלות');
export const ordersText = (n) => cnt(n, 'הזמנה אחת', 'הזמנות');
export const itemsText = (n) => cnt(n, 'פריט אחד', 'פריטים');

/** שם מלא מהלקוחה בשורת לו״ז */
export function customerName(c) {
  if (!c) return '';
  return c.name || [c.firstName, c.lastName].filter(Boolean).join(' ');
}
export function customerPhones(c) {
  if (!c) return [];
  return [c.phone1, c.phone2].map((p) => (p ? String(p).trim() : '')).filter(Boolean);
}
