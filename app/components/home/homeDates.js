// תאריכים עבריים לחיפוש המתקדם בדף הבית החדש (HomeA5) — פונקציות טהורות, בלי DOM.
// הערך נשמר פנימית כתאריך לועזי ISO (YYYY-MM-DD) והתצוגה/הבחירה תמיד עבריות (החלטת הבעלים:
// תאריכי אירוע בעברית בלבד). מועתק בלוגיקה מ-public/a5/index.html (בורר התאריכים, dp*).

const HEB_DAY = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', year: 'numeric' });
const HEB_MON = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long' });

const GDAY = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז', 'יז', 'יח', 'יט', 'כ', 'כא', 'כב', 'כג', 'כד', 'כה', 'כו', 'כז', 'כח', 'כט', 'ל'];
const YEAR_LETTERS = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']];

const pad2 = (n) => String(n).padStart(2, '0');

export function gershayim(str) {
  return str.length > 1 ? str.slice(0, -1) + '״' + str.slice(-1) : str + '׳';
}

// שנה עברית באותיות (תשפ״ז), בלי האלפים
export function hebrewYearLetters(n) {
  let rest = n % 1000;
  let out = '';
  for (const [v, c] of YEAR_LETTERS) {
    while (rest >= v) {
      if (rest === 15) { out += 'טו'; rest = 0; break; }
      if (rest === 16) { out += 'טז'; rest = 0; break; }
      out += c;
      rest -= v;
    }
  }
  return gershayim(out);
}

export const isoOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
export const dateOf = (iso) => new Date(iso + 'T12:00:00');

// { day, year } של התאריך העברי (מספרים)
export function hebParts(d) {
  const o = {};
  HEB_DAY.formatToParts(d).forEach((x) => {
    if (x.type === 'day' || x.type === 'year') o[x.type] = parseInt(x.value, 10);
  });
  return o;
}

export const hebMonthName = (d) => HEB_MON.format(d);

// "ט״ו תשרי תשפ״ז" מתאריך ISO; ריק כשאין תאריך
export function hebText(iso) {
  if (!iso) return '';
  const d = dateOf(iso);
  if (Number.isNaN(d.getTime())) return '';
  const n = hebParts(d);
  return gershayim(GDAY[n.day]) + ' ' + HEB_MON.format(d) + ' ' + hebrewYearLetters(n.year);
}

// eventDate גולמי מה-DB (Date / מחרוזת ISO) → "ט״ו תשרי תשפ״ז" לפי היום הקלנדרי בישראל, לא לפי אזור הזמן של
// המחשב: eventDate נשמר לפעמים כחצות UTC ולפעמים כ-...T21:00:00Z של היום הישראלי הבא (ר' getIsraelDayRange
// ב-lib/hebrewDate.js). ריק כשאין תאריך / תאריך לא תקין. עברי בלבד — אין כאן נפילה לתאריך לועזי.
const IL_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' });
export function hebFromInstant(v) {
  if (v === null || v === undefined || v === '') return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = {};
  IL_DAY.formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  return hebText(p.year + '-' + p.month + '-' + p.day);
}

// יום ראשון בחודש העברי שמכיל את d
export function hebMonthStart(d) {
  const x = new Date(d);
  while (hebParts(x).day !== 1) x.setDate(x.getDate() - 1);
  return x;
}

// ראש החודש העברי הבא (dir>0) או הקודם (dir<0)
export function hebMonthShift(first, dir) {
  const x = new Date(first);
  if (dir > 0) {
    x.setDate(x.getDate() + 27);
    while (hebParts(x).day !== 1) x.setDate(x.getDate() + 1);
    return x;
  }
  x.setDate(x.getDate() - 1);
  return hebMonthStart(x);
}

// יום חג (בארץ): ר"ה, יו"כ, סוכות, שמיני עצרת, פסח (ראשון ושביעי), שבועות
export function isHolidayDay(d) {
  const n = hebParts(d).day;
  const m = HEB_MON.format(d);
  return (m === 'תשרי' && [1, 2, 10, 15, 22].includes(n))
    || (m === 'ניסן' && [15, 21].includes(n))
    || (/^סי/.test(m) && n === 6);
}

// רשת חודש עברי: { title, blanks (מספר תאים ריקים לפני ה-1), days:[{iso, label, shabbat, holiday}] }
export function hebMonthGrid(first) {
  const days = [];
  const d = new Date(first);
  do {
    const day = hebParts(d).day;
    days.push({ iso: isoOf(d), label: gershayim(GDAY[day]), shabbat: d.getDay() === 6, holiday: isHolidayDay(d) });
    d.setDate(d.getDate() + 1);
  } while (hebParts(d).day !== 1);
  return {
    title: HEB_MON.format(first) + ' ' + hebrewYearLetters(hebParts(first).year),
    blanks: first.getDay(),
    days,
  };
}

// כותרת נגישה ליום: "יום שלישי ט״ו תשרי תשפ״ז"
export function hebDayTitle(iso) {
  const d = dateOf(iso);
  const wd = d.toLocaleDateString('he-IL', { weekday: 'long' });
  return wd + ' ' + hebText(iso);
}
