// לוח עברי לבורר התאריך של דף הלו״ז (צד לקוח, תצוגה בלבד).
// מועתק בהתאמה מהעיצוב המאושר (תצוגות-עיצוב/לוז-יומי.html, שורות 1715-1737: heb / monthStart / monthLen).
// כל התאריכים כאן הם מפתחות "YYYY-MM-DD" של יום קלנדרי; החישוב נעשה בצהרי היום (12:00) כדי שהיסט
// אזור הזמן של הדפדפן לא יזיז את היום. את "היום" הישראלי מחזיר השרת (data.today) - לא מחושב כאן.

const pad = (n) => (n < 10 ? '0' : '') + n;

export const toKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const fromKey = (s) => {
  const p = String(s).split('-');
  return new Date(+p[0], +p[1] - 1, +p[2], 12);
};
export const addDays = (s, n) => {
  const d = fromKey(s);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
// 0 = ראשון ... 6 = שבת
export const dow = (s) => fromKey(s).getDay();
// "היום" לפי שעון ישראל בדפדפן (Intl, לא לפי אזור הזמן של המכשיר) - רק כגיבוי לפענוח ?date=today|tomorrow עד שהשרת
// עונה (data.today הוא המקור); en-CA מחזיר YYYY-MM-DD.
export const israelTodayKey = (now = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch { return toKey(now); }
};

// ?date= של הדף: תאריך ISO (YYYY-MM-DD) או מילת יחס מרשימה סגורה (הקישורים "היום"/"מחר" בתפריט,
// lib/menu/buildMenuTree.js). מילת היחס מפוענחת ברגע הטעינה לפי "היום" הישראלי - לא ברגע בניית התפריט.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const DATE_TOKENS = Object.freeze({ today: 0, tomorrow: 1 });
export const isDateToken = (d) => typeof d === 'string' && Object.prototype.hasOwnProperty.call(DATE_TOKENS, d);
// ערך ?date= תקין (ISO או מילת יחס) -> הוא עצמו; כל דבר אחר -> null (לא משקפים קלט חופשי)
export const parseDateParam = (d) => (typeof d === 'string' && (DATE_RE.test(d) || isDateToken(d)) ? d : null);
// מפתח יום לשליחה לשרת: ISO כמו שהוא; מילת יחס לפי todayKey (שעון השרת), ובלעדיו לפי שעון ישראל בדפדפן
export const resolveDateParam = (d, todayKey) => {
  if (!d) return null;
  if (!isDateToken(d)) return d;
  return addDays(todayKey || israelTodayKey(), DATE_TOKENS[d]);
};

export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const WEEKDAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// מספר -> אותיות עבריות (גימטריה), עם גרשיים: 15 -> ט״ו, 5787 (אחרי modulo 1000) -> תשפ״ז
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
      if (n >= GEMATRIA[i][0]) {
        s += GEMATRIA[i][1];
        n -= GEMATRIA[i][0];
        break;
      }
    }
  }
  s = s.replace('יה', 'טו').replace('יו', 'טז');
  return s.length > 1 ? s.slice(0, -1) + '״' + s.slice(-1) : s + '׳';
}

let fmtParts = null;
let fmtMonth = null;
function formatters() {
  if (!fmtParts) {
    fmtParts = new Intl.DateTimeFormat('en-u-ca-hebrew-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    fmtMonth = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' });
  }
  return { fmtParts, fmtMonth };
}

const cache = {};
// { d: יום בחודש (מספר), dl: יום באותיות, m: שם החודש, y: שנה באותיות (בלי האלפים) }
export function hebrewParts(key) {
  if (cache[key]) return cache[key];
  const { fmtParts: fp, fmtMonth: fm } = formatters();
  const date = fromKey(key);
  let day = 1;
  let year = 5787;
  fp.formatToParts(date).forEach((x) => {
    if (x.type === 'day') day = +x.value;
    if (x.type === 'year') year = +x.value;
  });
  cache[key] = { d: day, dl: gematria(day), m: fm.format(date), y: gematria(year % 1000) };
  return cache[key];
}

// "יום חמישי · כ׳ תשרי תשפ״ז"
export function hebrewLong(key) {
  const h = hebrewParts(key);
  return 'יום ' + WEEKDAYS[dow(key)] + ' · ' + h.dl + ' ' + h.m + ' ' + h.y;
}
export const hebrewMonthTitle = (key) => {
  const h = hebrewParts(key);
  return h.m + ' ' + h.y;
};
// תחילת החודש העברי שהיום שייך אליו, ואורכו (29/30)
export const monthStart = (key) => addDays(key, -(hebrewParts(key).d - 1));
export const monthLength = (start) => (hebrewParts(addDays(start, 29)).d === 1 ? 29 : 30);
export const nextMonthStart = (start) => addDays(start, monthLength(start));
export const prevMonthStart = (start) => monthStart(addDays(start, -1));
