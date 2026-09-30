import { HDate, HebrewCalendar, flags, Location } from '@hebcal/core';

// מערך המרה תקין לימים בעברית
export const HEBREW_DAYS = [
  "", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י",
  "יא", "יב", "יג", "יד", "טו", "טז", "יז", "יח", "יט", "כ",
  "כא", "כב", "כג", "כד", "כה", "כו", "כז", "כח", "כט", "ל"
];

// מערך המרה תקין לחודשים
export const HEBREW_MONTHS = {
  1: "ניסן",
  2: "אייר",
  3: "סיוון",
  4: "תמוז",
  5: "אב",
  6: "אלול",
  7: "תשרי",
  8: "חשוון",
  9: "כסלו",
  10: "טבת",
  11: "שבט",
  12: "אדר",
  13: "אדר ב'"
};

export const getHebrewMonthName = (monthNumber, isLeap) => {
  if (isLeap && monthNumber === 12) return "אדר א'";
  return HEBREW_MONTHS[monthNumber];
};

export const getHebrewYearString = (year) => {
  try {
    const hd = new HDate(1, 7, year);
    const parts = hd.renderGematriya().split(' ');
    let yStr = parts[parts.length - 1]; 
    return yStr.replace(/״/g, '"').replace(/׳/g, "'");
  } catch (e) {
    return year.toString();
  }
};

export function getHebrewDateString(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    
    const hdate = new HDate(d);
    const dayName = HEBREW_DAYS[hdate.getDate()];
    const isLeap = hdate.isLeapYear();
    const monthName = getHebrewMonthName(hdate.getMonth(), isLeap);
    const yearName = getHebrewYearString(hdate.getFullYear());
    
    return `${dayName} ${monthName} ${yearName}`;
  } catch (e) {
    console.error("Error formatting hebrew date:", e);
    const d = date instanceof Date ? date : new Date(date);
    return !isNaN(d.getTime()) ? d.toLocaleDateString('he-IL') : "";
  }
}

// אותיות עבריות לימות השבוע (0=ראשון ... 5=שישי) בפורמט "יום X'" כפי שמוצג בדוחות
// הדפסה (למשל "יום ה'"); שבת מוצגת כ"שבת" בלי הקידומת "יום".
const HEBREW_WEEKDAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

export function getHebrewWeekdayLabel(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = d.getDay(); // 0=ראשון ... 6=שבת
    if (day === 6) return 'שבת';
    return `יום ${HEBREW_WEEKDAY_LETTERS[day]}'`;
  } catch (e) {
    return '';
  }
}

// שמות ימי השבוע המלאים (0=ראשון...6=שבת) - להבדיל מ-getHebrewWeekdayLabel שמחזיר
// צורת אות ("יום ד'") המשמשת בדוחות הדפסה קיימים; כותרות הדפסת/שליחת משלוחים למשלוחן
// (docs/deliveries-feature-plan-2026-09-16.md, §C/§D) מנוסחות עם השם המלא ("יום רביעי").
const HEBREW_WEEKDAY_FULL_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function getHebrewWeekdayFullName(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = d.getDay();
    return day === 6 ? 'שבת' : `יום ${HEBREW_WEEKDAY_FULL_NAMES[day]}`;
  } catch (e) {
    return '';
  }
}

export function getHebrewMonthYear(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    
    const hdate = new HDate(d);
    const isLeap = hdate.isLeapYear();
    const monthName = getHebrewMonthName(hdate.getMonth(), isLeap);
    const yearName = getHebrewYearString(hdate.getFullYear());
    return `${monthName} ${yearName}`;
  } catch (e) {
    return "";
  }
}

export function isHebrewLeapYear(year) {
  return HDate.isLeapYear(year);
}

// תאריך "היום" לפי לוח השנה בישראל (Asia/Jerusalem), כאובייקט Date מקומי בחצות כך ש-
// getDate()/getMonth()/new HDate(...) שמורצים עליו נותנים את היום הישראלי בלי קשר לאזור
// הזמן של השרת (Vercel רץ ב-UTC, ובין 00:00 ל-03:00 שעון ישראל התאריך ב-UTC עדיין "אתמול").
export function getIsraelTodayDate(now = new Date()) {
  const key = getIsraelDateKey(now); // YYYY-MM-DD
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ---- "היום"/"מחר"/תאריך-מהיר לפי שעון ישראל, כמחרוזת YYYY-MM-DD ----
// לעולם לא להשתמש ב-new Date().toISOString().slice(0, 10) (תאריך UTC - בין 00:00 ל-03:00/02:00
// שעון ישראל הוא עדיין "אתמול"), ולא ב-setHours(0,0,0,0) על new Date() בצד שרת (אזור הזמן
// של Vercel הוא UTC, לא ישראל; וגם Chrome headless שמרנדר PDF בשרת). Formatter אחד במטמון
// כי יצירת Intl.DateTimeFormat בכל קריאה יקרה מספיק כדי להרגיש ברשימות של אלפי הזמנות.
const IL_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit'
});

// מפתח YYYY-MM-DD של היום הקלנדרי בישראל עבור רגע נתון (Date/מספר/מחרוזת); null אם לא תקין.
export function getIsraelDateKey(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const parts = IL_DATE_FORMATTER.formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// "היום" בישראל כ-YYYY-MM-DD.
export function getIsraelTodayKey(now = new Date()) {
  return getIsraelDateKey(now);
}

// חיבור/חיסור ימים למפתח YYYY-MM-DD בחשבון לוח-שנה טהור (UTC) - בלי תלות באזור הזמן
// של המכונה ובלי חריגות של מעבר שעון קיץ.
export function addDaysToDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// כנ"ל לחודשים (גלישת סוף-חודש כמו setMonth: 31/8 + 6 חודשים = 3/3).
export function addMonthsToDateKey(dateKey, months) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

// גבולות "היום" בישראל כ-{ start, end } (Date ב-UTC), לשאילתות מול eventDate וכו' - ר'
// getIsraelDayRange להסבר על שתי צורות האחסון של eventDate.
export function getIsraelTodayRange(now = new Date()) {
  return getIsraelDayRange(getIsraelTodayKey(now));
}

// כמה ימי-לוח (ישראליים) מ"היום" עד dateInput: 0 = היום, חיובי = בעתיד, שלילי = בעבר.
// מחליף את הדפוס "today.setHours(0,0,0,0) מול eventDate.setHours(0,0,0,0)" שתלוי באזור
// הזמן של המכונה (ובשרת UTC נותן "אתמול" עד 03:00 שעון ישראל, וזז ביום ימי מעבר שעון
// קיץ בחלוקה ב-86400000). null אם dateInput ריק/לא תקין.
export function getIsraelDaysUntil(dateInput, now = new Date()) {
  if (!dateInput) return null;
  const targetKey = getIsraelDateKey(dateInput);
  const todayKey = getIsraelDateKey(now);
  if (!targetKey || !todayKey) return null;
  const toUtcMs = (key) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtcMs(targetKey) - toUtcMs(todayKey)) / 86400000);
}

function toLocalIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// מיפוי תחילת כל חודש עברי -> תאריך לועזי, לשנה הנוכחית (ולפי בקשה גם לשנים הבאות).
// היה קודם toISOString() על greg() - שמחזיר יום אחד אחורה כשהשרת רץ באזור זמן חיובי (ישראל).
export function getHebrewYearContext(baseDate = new Date(), yearsAhead = 0) {
  try {
    const baseYear = new HDate(getIsraelTodayDate(baseDate)).getFullYear();
    const lines = [];
    for (let y = baseYear; y <= baseYear + yearsAhead; y++) {
      const res = [];
      for (let m = 1; m <= 13; m++) {
        try {
          const start = new HDate(1, m, y);
          res.push(`${start.getMonthName()} 1 = ${toLocalIso(start.greg())} (${start.daysInMonth()} days)`);
        } catch (e) {}
      }
      lines.push(`Hebrew Year ${y} mapping: ` + res.join(', '));
    }
    return lines.join('\n');
  } catch (e) {
    return '';
  }
}

// מחזיר את גבולות היום הקלנדרי בישראל (Asia/Jerusalem) עבור תאריך "YYYY-MM-DD",
// כשני אובייקטי Date ב-UTC (start/end) שאפשר להשתמש בהם ישירות מול eventDate ב-Prisma.
// eventDate נשמר לפעמים כחצות UTC של התאריך (המוסכמה הרגילה בשמירת הזמנות, ר'
// app/api/orders/route.js) ולפעמים עם שעה אמיתית שהגיעה מהייבוא מ-Access - שתי
// הצורות חיות באותו שדה. חישוב הגבולות לפי אזור הזמן של ישראל (ולא לפי setHours,
// שתלוי באזור הזמן של השרת שמריץ את הקוד) הוא הדרך היחידה שמתאימה את שתי הצורות
// ל"יום" הישראלי הנכון, כמו שהוא כבר מוצג ב-toIsraelDateKey ב-
// app/print/alterations/page.js.
export function getIsraelDayRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const IL_TZ = 'Asia/Jerusalem';

  const offsetMinutesAt = (utcInstant) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: IL_TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(utcInstant).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const asIfUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    // בלי אלפיות השנייה של ה-instant (asIfUTC כבר מקוצץ לשניות) - אחרת ההיסט יוצא שבר דקה קטן
    // וגבול סוף-היום (…59.999) זז באלפית השנייה.
    return (asIfUTC - Math.floor(utcInstant.getTime() / 1000) * 1000) / 60000;
  };

  // נקודת ייחוס בצהריים כדי לזהות את היסט אזור הזמן (UTC+2/UTC+3) בלי להיתקע
  // בדיוק על רגע מעבר שעון הקיץ, שקורה סמוך לחצות.
  const noonOffsetMinutes = offsetMinutesAt(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));

  // בשני ימי מעבר השעון בשנה (02:00 שעון מקומי) ההיסט בחצות/בסוף היום שונה מההיסט של
  // הצהריים - היסט הצהריים לבדו הזיז את start/end בשעה שלמה (כניסת שעון הקיץ: start מוקדם
  // בשעה; יציאתו: start מאוחר בשעה, כך ש-00:00-00:59 לא נכללו ביום). לכן מחשבים את ההיסט
  // בפועל ברגע הקרוב לגבול עצמו (הניחוש מחוץ לחלון של 02:00, אז הוא יציב).
  const offsetNearLocal = (localAsUtcMs) => offsetMinutesAt(new Date(localAsUtcMs - noonOffsetMinutes * 60000));
  const startLocal = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const endLocal = Date.UTC(y, m - 1, d, 23, 59, 59, 999);

  const start = new Date(startLocal - offsetNearLocal(startLocal) * 60000);
  const end = new Date(endLocal - offsetNearLocal(endLocal) * 60000);
  return { start, end };
}

// הכיוון ההפוך מ-getIsraelDayRange: מקבל instant גולמי (Date/string מ-Prisma, למשל
// eventDate שנשמר כ-...T21:00:00.000Z עבור "יום ישראלי" הבא) ומחזיר Date "עוגן" בחצות
// UTC שמייצג את אותו יום קלנדרי ישראלי - כדי ש-setDate()/getDay()/getTime() שמורצים
// עליו בהמשך (למשל ב-addDaysSkippingWeekends, או השוואת חלונות תפוסה) ייתנו את אותה
// תוצאה בלי קשר לאזור הזמן של השרת שמריץ את הקוד (Vercel רץ כברירת מחדל ב-UTC, לא
// בישראל - ר' תיעוד 2026-09-15, docs/fix-protocol-error-reports.md #12). משתמש באותה
// שיטת toLocaleDateString שכבר קיימת ב-toIsraelDateKey (app/print/alterations/page.js).
export function toIsraelCalendarDate(dateInput) {
  if (!dateInput) return null;
  const key = getIsraelDateKey(dateInput); // YYYY-MM-DD
  if (!key) return null;
  const [y, m, day] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function processHebrewDateMacro(sqlQuery) {
  if (!sqlQuery) return sqlQuery;

  const currentHebrewYear = () => new HDate(getIsraelTodayDate()).getFullYear();
  const monthKey = (m) => m.toUpperCase().replace(/_/g, ' ');

  // Matches HEBREW_DATE(10, 'SIVAN', 5786) or HEBREW_DATE(10, 'SIVAN')
  const regex = /HEBREW_DATE\s*\(\s*(\d+)\s*,\s*'([^']+)'\s*(?:,\s*(\d+))?\s*\)/gi;

  let out = sqlQuery.replace(regex, (match, dayStr, monthStr, yearStr) => {
    try {
      const day = parseInt(dayStr, 10);
      const year = yearStr ? parseInt(yearStr, 10) : currentHebrewYear();

      const hd = new HDate(day, monthKey(monthStr), year);
      // greg() מחזיר חצות מקומי - מפרקים לרכיבים מקומיים (לא toISOString) כדי שהתוצאה
      // לא תזוז יום באזור זמן חיובי
      return `'${toLocalIso(hd.greg())}'`;
    } catch (e) {
      console.error("Failed to parse HEBREW_DATE macro:", match, e);
      return match; // Fallback to original string if error
    }
  });

  // HEBREW_MONTH_START('ELUL', 5786) / HEBREW_MONTH_END('ELUL', 5786) - היום הראשון/האחרון
  // של חודש עברי שלם (החודשים באורך 29/30 ולכן אי אפשר לנחש יום אחרון בלי המרה).
  out = out.replace(/HEBREW_MONTH_(START|END)\s*\(\s*'([^']+)'\s*(?:,\s*(\d+))?\s*\)/gi, (match, which, monthStr, yearStr) => {
    try {
      const year = yearStr ? parseInt(yearStr, 10) : currentHebrewYear();
      const first = new HDate(1, monthKey(monthStr), year);
      const hd = which.toUpperCase() === 'START' ? first : new HDate(first.daysInMonth(), monthKey(monthStr), year);
      return `'${toLocalIso(hd.greg())}'`;
    } catch (e) {
      console.error("Failed to parse HEBREW_MONTH macro:", match, e);
      return match;
    }
  });

  return out;
}

// בודק אם תאריך לועזי נופל על חג (יום טוב) לפי לוח השנה של ישראל - לא כולל חול המועד
// או צומות/תעניות קלות (פורים, תעניות וכו'), רק ימים שבהם גמ"ח בדרך כלל סגור לגמרי.
export function isChagDay(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const events = HebrewCalendar.calendar({
    start: day, end: next, isHebrewYear: false,
    noMinorFast: true, noRoshChodesh: true, noModern: true, il: true
  });
  return events.some(e => (e.getFlags() & flags.CHAG) !== 0);
}

// מחשב תאריך ש-`days` "ימי עסקים" לפני `date`, תוך דילוג על שישי, שבת וימי חג
// (לא חול המועד) - משמש לחישוב מועד לקיחת השמלות מראש בהדפסת הזמנה (ראו
// app/print/order/page.js), לא לחישוב איחור בהחזרה (lib/lateReturn.js), שממשיך
// להשתמש בנוסחת "N ימים קלנדריים" הקיימת שלו.
export function subtractSkippingWeekendsAndChag(date, days) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  let subtracted = 0;
  while (subtracted < days) {
    result.setDate(result.getDate() - 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek === 5 || dayOfWeek === 6) continue;
    if (isChagDay(result)) continue;
    subtracted++;
  }
  return result;
}

// מספר ימי-העסקים (מדלג שישי/שבת/חג) שבהם יש להתחיל להכין את השמלות לפני האירוע -
// יום עסקים אחד לפני מועד קבלת השמלות עצמו (שהוא כבר 2 ימי עסקים לפני האירוע, ר'
// subtractSkippingWeekendsAndChag למעלה), כדי לתת לצוות זמן הכנה/גיהוץ/אריזה לפני
// שהלקוח מגיע לאסוף. סה"כ 3 ימי עסקים לפני האירוע. אומת מול 5 הדוגמאות בדיווחים
// c5032b47/ed6c69bc (למשל אירוע ביום ראשון -> הכנה ביום שלישי של השבוע הקודם).
export const PRINT_PREP_BUSINESS_DAYS_BEFORE_EVENT = 3;

// מחשב את תאריך ההכנה להדפסה עבור אירוע נתון - ר' הקבוע למעלה. עוטף
// subtractSkippingWeekendsAndChag במקום לשכפל את חישוב ימי-העסקים בפעם שלישית
// בקוד (הפעם הראשונה: מועד קבלת השמלות ב-app/print/order/page.js; השנייה: הפונקציה
// עצמה). נעשה בו שימוש ב-app/api/orders/print-prep/route.js.
export function getPrintPrepDate(eventDate) {
  return subtractSkippingWeekendsAndChag(eventDate, PRINT_PREP_BUSINESS_DAYS_BEFORE_EVENT);
}

// בודק אם "עכשיו" נמצא בחלון שבת/חג (מהדלקת נרות ועד צאת השבת/החג הבא) - לפי
// זמני קבלת שבת/הבדלה האמיתיים (לא רק "יום שישי/שבת בלוח"), כדי לא לתת אור ירוק
// לשליחה ב-16:50 בחורף כשבפועל השבת כבר נכנסה. משתמש במיקום ירושלים כקירוב סביר
// לכל הארץ (הפרש של דקות בודדות מול ב"ש/נווה יעקב, לא משמעותי לצורך הזה).
// שימי לב: הטווח שמוחזר מכסה גם חגים (לא רק שבת) - candlelighting:true מחזיר
// "Candle lighting"/"Havdalah" גם לערבי/מוצאי יו"ט, וזה בכוונה: גם אין לשלוח מיילים
// אוטומטיים ביו"ט. נוצר עבור עדכון PR-ים ממתינים (app/api/cron/agent-digest) -
// ר' CLAUDE.md סעיף "Agent PR-approval digest email".
let _blackoutLocation = null;
function getBlackoutLocation() {
  if (!_blackoutLocation) _blackoutLocation = Location.lookup('Jerusalem');
  return _blackoutLocation;
}

export function isReligiousBlackoutNow(date = new Date()) {
  const location = getBlackoutLocation();
  const rangeStart = new Date(date.getTime() - 4 * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(date.getTime() + 4 * 24 * 60 * 60 * 1000);
  const events = HebrewCalendar.calendar({ location, candlelighting: true, start: rangeStart, end: rangeEnd })
    .filter(ev => ev.eventTime instanceof Date && (ev.getDesc() === 'Candle lighting' || ev.getDesc() === 'Havdalah'))
    .sort((a, b) => a.eventTime - b.eventTime);

  let inBlackout = false;
  for (const ev of events) {
    if (ev.eventTime > date) break;
    inBlackout = ev.getDesc() === 'Candle lighting';
  }
  return inBlackout;
}
