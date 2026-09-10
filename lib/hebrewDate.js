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

export function getHebrewYearContext() {
  try {
    const hd = new HDate();
    const y = hd.getFullYear();
    const res = [];
    for(let m=1; m<=13; m++) {
      try {
        const start = new HDate(1, m, y);
        const gregorian = start.greg().toISOString().split('T')[0];
        const days = start.daysInMonth();
        res.push(`${start.getMonthName()} 1 = ${gregorian} (${days} days)`);
      } catch(e) {}
    }
    return `Hebrew Year ${y} mapping: ` + res.join(', ');
  } catch(e) {
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
    return (asIfUTC - utcInstant.getTime()) / 60000;
  };

  // נקודת ייחוס בצהריים כדי לזהות את היסט אזור הזמן (UTC+2/UTC+3) בלי להיתקע
  // בדיוק על רגע מעבר שעון הקיץ, שקורה סמוך לחצות.
  const offsetMinutes = offsetMinutesAt(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));

  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMinutes * 60000);
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offsetMinutes * 60000);
  return { start, end };
}

export function processHebrewDateMacro(sqlQuery) {
  if (!sqlQuery) return sqlQuery;
  
  // Matches HEBREW_DATE(10, 'SIVAN', 5786) or HEBREW_DATE(10, 'SIVAN')
  const regex = /HEBREW_DATE\s*\(\s*(\d+)\s*,\s*'([^']+)'\s*(?:,\s*(\d+))?\s*\)/gi;
  
  return sqlQuery.replace(regex, (match, dayStr, monthStr, yearStr) => {
    try {
      const day = parseInt(dayStr, 10);
      const currentHebrewYear = new HDate().getFullYear();
      const year = yearStr ? parseInt(yearStr, 10) : currentHebrewYear;
      
      const hd = new HDate(day, monthStr.toUpperCase(), year);
      const d = hd.greg();
      d.setHours(12, 0, 0, 0); // avoid timezone shifts
      const gregorianStr = d.toISOString().split('T')[0];
      
      // Return quoted gregorian date for SQL
      return `'${gregorianStr}'`;
    } catch (e) {
      console.error("Failed to parse HEBREW_DATE macro:", match, e);
      return match; // Fallback to original string if error
    }
  });
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
