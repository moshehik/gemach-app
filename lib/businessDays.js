// lib/businessDays.js - הכלל האחיד "יום לא עובד" של הגמ"ח + ספירת ימי עסקים לשני הכיוונים.
//
// החלטות הבעלים 1.10.2026 (scratch/schedule-build/DECISIONS-לוז-יומי.md סעיפים 1/3/4 + "ערב חג",
// ותשובות NWD-Q02..Q08 מאותו יום): כלל אחד לכל המערכת - משלוחים (lib/deliveries.js), החזרה באיחור
// (lib/lateReturn.js), כרטיס ההזמנה, ולו״ז יומי - ובנוסף רשימת ימים שהבעלים מסמן בניהול היומן.
// החוזה המלא (מפתח, מבנה JSON, API): scratch/schedule-build/CONTRACT-non-working-days.md (גרסה 2).
//
// יום לא עובד = שישי | שבת | יום טוב | חול המועד | ערב יום טוב | יום/טווח ברשימת הבעלים |
//               תאריך עברי קבוע ברשימת הבעלים (למשל כ"ו שבט, בכל שנה).
// גרסה 2 (NWD-Q02/Q03/Q04/Q07, 1.10.2026):
//   * חול המועד (פסח וסוכות, לפי לוח ארץ ישראל - hebcal flags.CHOL_HAMOED, il:true) סגור. הושענא רבה
//     (כ"א תשרי) וערב שביעי של פסח (כ' ניסן) הם גם חול המועד וגם "היום שלפני יום טוב" - שניהם היו
//     סגורים כבר בגרסה 1 דרך כלל ערב החג (isErevChagKey), ונשארים כך.
//   * אין יותר "open" (סימון יום סגור-כברירת-מחדל כפתוח): הבעלים ענה "לא". רשומת status:"open" מגרסה 1
//     נקראת, מתעלמת ונספרת (ignoredOpen) - יום סגור לא ניתן לפתיחה בשום דרך.
//   * ranges: טווחי ימים סגורים (חופשה), recurringHebrew: תאריכים עבריים קבועים - ר' הפרסור למטה.
// "יום טוב + ערב יום טוב" הוא בדיוק מה ש-isChagDay הקיים (lib/hebrewDate.js) מסמן; חול המועד הוא
// התוספת היחידה (scripts/business-days-tests/holidays.test.mjs מוכיח זאת על כל יום בשנים 2024-2031).
//
// המודול טהור: בלי prisma, בלי settingsCache - רץ גם בדפדפן (RentalReturnModal, /rentals).
// קריאת ההגדרה מהשרת: lib/businessDaysServer.js. כל התאריכים כאן הם מפתחות 'YYYY-MM-DD' של
// היום הקלנדרי בישראל, וחשבון הימים נעשה על המפתח (Date.UTC) - בלי תלות באזור הזמן של
// המכונה (Vercel = UTC; הדפדפן של העובדת = ישראל; הבדיקות רצות גם באזורי זמן שליליים).
// המרה עברית<->לועזית נעשית על מספר היום המוחלט של hebcal (R.D.) ולא על אובייקט Date - גם זה בלי אזור זמן.

import { HebrewCalendar, HDate, flags } from '@hebcal/core';
import { getIsraelDateKey, addDaysToDateKey, PRINT_PREP_BUSINESS_DAYS_BEFORE_EVENT } from './hebrewDate';

export const NON_WORKING_DAYS_SETTING_KEY = 'non_working_days_extra';
// גרסת ה-JSON שנכתבת (serialize). גרסה 1 נקראת לאחור (ר' parseNonWorkingDaysSetting).
export const NON_WORKING_DAYS_SETTING_VERSION = 2;
// מפתח ההרשאה (lib/permissionsMetadata.js) של מי שרשאי לסמן/להסיר ימים - נאכף ב-POST /api/settings.
export const NON_WORKING_DAYS_PERMISSION_KEY = 'feature:non_working_days_manage';

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_MAX_LENGTH = 200;
// מגן מפני לולאה אינסופית אם (בטעות) רצף ארוך מאוד של ימים סומן סגור - אחרי כל כך הרבה
// ימים לא-עובדים רצופים היום הבא נחשב עובד. 400 > שנה שלמה, אז בפועל לא נפגשים בזה.
const MAX_CONSECUTIVE_NON_WORKING = 400;
// תקרה למספר ימי העסקים שסופרים (סקירה, should-fix 2): ההליכה היא יום-יום, וערך ענק בהגדרה
// (למשל delivery_days_before = 100000000 בטעות הקלדה) היה תוקע את השרת לדקות. יותר משנה
// של ימי עסקים אין לו משמעות עסקית, אז מעבר לזה הערך נחתך בשקט.
export const MAX_BUSINESS_DAY_OFFSET = 366;
// תקרות לרשומות שנקראות מההגדרה (רק מי שמורשה כותב אותה, אבל גם טעות שלו לא צריכה לעלות
// שניות בכל בקשה) ולטווח של listNonWorkingDays (לוח של כשנתיים).
export const MAX_SETTING_ENTRIES = 2000;   // רשומות יום בודד (days)
export const MAX_RANGE_ENTRIES = 100;      // טווחים (ranges)
export const MAX_RANGE_DAYS = 366;         // אורך טווח אחד (כולל הקצוות)
export const MAX_RECURRING_ENTRIES = 60;   // תאריכים עבריים קבועים (recurringHebrew)
export const MAX_LIST_RANGE_DAYS = 800;
// גודל מרבי של ערך ההגדרה (מחרוזת) שהשרת מוכן לשמור - ר' validateNonWorkingDaysSettingValue.
export const MAX_SETTING_VALUE_LENGTH = 300000;

// n -> מספר שלם בטווח [-MAX, MAX]; לא-מספר / Infinity -> 0.
function clampOffset(n) {
  const num = Math.trunc(Number(n));
  if (!Number.isFinite(num)) return 0;
  return Math.max(-MAX_BUSINESS_DAY_OFFSET, Math.min(MAX_BUSINESS_DAY_OFFSET, num));
}

// ---------- מפתחות ----------

export function isValidDayKey(key) {
  if (typeof key !== 'string' || !KEY_RE.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Date של "חצות מקומית" (new Date(y, m-1, d), כמו שבונים נתיבי API ישנים מפרמטר ?date=) -> מפתח,
// לפי הרכיבים המקומיים. להמרה מפורשת בלבד; toDayKey מתייחס ל-Date כאל רגע (instant).
export function keyFromLocalDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// מפתח 'YYYY-MM-DD' (מוחזר כמו שהוא אחרי אימות) או רגע (Date / ISO / מספר) -> היום הישראלי שלו.
// null לקלט לא תקין.
export function toDayKey(dateOrKey) {
  if (dateOrKey === null || dateOrKey === undefined || dateOrKey === '') return null;
  if (typeof dateOrKey === 'string' && KEY_RE.test(dateOrKey)) return isValidDayKey(dateOrKey) ? dateOrKey : null;
  return getIsraelDateKey(dateOrKey);
}

const DAY_MS = 86400000;
function epochDaysOfKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
function keyOfEpochDays(days) {
  return new Date(days * DAY_MS).toISOString().slice(0, 10);
}

function weekdayOfKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = ראשון ... 5 = שישי, 6 = שבת
}

export function isWeekendKey(key) {
  const w = weekdayOfKey(key);
  return w === 5 || w === 6;
}

// ---------- חגים (לוח ארץ ישראל) ----------

// מטמון לשנה לועזית: Map<key, { kind: 'chag' | 'chol_hamoed', title }>. אותם דגלים כמו isChagDay הקיים
// (il:true, noMinorFast, noRoshChodesh, noModern) + חול המועד (flags.CHOL_HAMOED - פסח ב'-ו', סוכות
// ב'-ז' כולל הושענא רבה). לא פורים/צומות/ר"ח/חנוכה/חגים לאומיים/ל"ג בעומר (היו ונשארו ימי עבודה).
const holidayByYear = new Map();
const NIKUD_RE = /[֑-ׇ]/g;

function holidayMapForYear(year) {
  let map = holidayByYear.get(year);
  if (map) return map;
  map = new Map();
  try {
    const events = HebrewCalendar.calendar({
      year, isHebrewYear: false, il: true,
      noMinorFast: true, noRoshChodesh: true, noModern: true
    });
    for (const ev of events) {
      const f = ev.getFlags();
      const kind = (f & flags.CHAG) !== 0 ? 'chag' : (f & flags.CHOL_HAMOED) !== 0 ? 'chol_hamoed' : null;
      if (!kind) continue;
      const key = keyFromLocalDate(ev.getDate().greg());
      let title = '';
      try { title = String(ev.render('he') || '').replace(NIKUD_RE, '').trim(); } catch { title = ev.getDesc(); }
      // יום טוב גובר על חול המועד אם (תאורטית) שניהם יוצאים באותו יום
      if (key && (!map.has(key) || kind === 'chag')) map.set(key, { kind, title });
    }
  } catch (e) {
    console.error('businessDays: failed to build holiday calendar for', year, e);
  }
  holidayByYear.set(year, map);
  return map;
}

function holidayOf(key) {
  return holidayMapForYear(Number(key.slice(0, 4))).get(key) ?? null;
}

function chagTitle(key) {
  const h = holidayOf(key);
  return h && h.kind === 'chag' ? h.title : null;
}

function cholHamoedTitle(key) {
  const h = holidayOf(key);
  return h && h.kind === 'chol_hamoed' ? h.title : null;
}

// יום טוב (לא ערב חג, לא חול המועד).
export function isChagKey(key) {
  return chagTitle(key) !== null;
}

// חול המועד פסח/סוכות (לפי לוח ארץ ישראל; כולל הושענא רבה וכ' ניסן, שהם גם ערב חג).
export function isCholHamoedKey(key) {
  return cholHamoedTitle(key) !== null;
}

// ערב יום טוב = היום שלפני יום טוב (כולל "ערב" יום ב' של ר"ה = יום א' של ר"ה, שהוא חג ממילא;
// הושענא רבה = ערב שמיני עצרת; כ' ניסן = ערב שביעי של פסח).
export function isErevChagKey(key) {
  return chagTitle(addDaysToDateKey(key, 1)) !== null;
}

// חג, חול המועד או ערב חג. בלי חול המועד זה שקול ל-isChagDay(new Date(y, m-1, d)) ב-lib/hebrewDate.js
// (הוכח בבדיקה); חול המועד הוא ההרחבה של גרסה 2.
export function isHolidayKey(key) {
  return holidayOf(key) !== null || isErevChagKey(key);
}

// ---------- תאריכים עבריים (לתאריכים קבועים ולתצוגה) ----------

// R.D. (מספר היום המוחלט של hebcal) של 1.1.1970 - המרה בין מפתח לועזי ל-HDate בלי Date ובלי אזור זמן.
const RD_EPOCH = 719163;
function absOfKey(key) { return epochDaysOfKey(key) + RD_EPOCH; }
function keyOfAbs(abs) { return keyOfEpochDays(abs - RD_EPOCH); }

// הצורה הקנונית של חודש ב-recurringHebrew: שמות hebcal באנגלית. 'Adar' = "אדר" (בשנה מעוברת = אדר ב');
// 'Adar I' / 'Adar II' מפורשים. מספרי hebcal: 1 ניסן ... 11 שבט, 12 אדר א' (= אדר בשנה פשוטה), 13 אדר ב'.
const MONTHS = [
  { name: 'Nisan', number: 1, he: 'ניסן', max: 30 },
  { name: 'Iyyar', number: 2, he: 'אייר', max: 29 },
  { name: 'Sivan', number: 3, he: 'סיוון', max: 30 },
  { name: 'Tamuz', number: 4, he: 'תמוז', max: 29 },
  { name: 'Av', number: 5, he: 'אב', max: 30 },
  { name: 'Elul', number: 6, he: 'אלול', max: 29 },
  { name: 'Tishrei', number: 7, he: 'תשרי', max: 30 },
  { name: 'Cheshvan', number: 8, he: 'חשוון', max: 30 },  // 29 או 30 לפי השנה
  { name: 'Kislev', number: 9, he: 'כסלו', max: 30 },     // 29 או 30 לפי השנה
  { name: 'Tevet', number: 10, he: 'טבת', max: 29 },
  { name: 'Shvat', number: 11, he: 'שבט', max: 30 },
  { name: 'Adar', number: 12, he: 'אדר', max: 29 },       // אדר בשנה פשוטה / אדר ב' בשנה מעוברת - תמיד 29
  { name: 'Adar I', number: 12, he: "אדר א'", max: 30 },  // בשנה מעוברת 30; בשנה פשוטה = אדר (29)
  { name: 'Adar II', number: 13, he: "אדר ב'", max: 29 },
];
const MONTH_BY_NAME = new Map(MONTHS.map((m) => [m.name.toLowerCase(), m]));
// כינויים מקובלים (אנגלית/עברית, עם ובלי גרשיים) -> השם הקנוני
const MONTH_ALIASES = {
  "sh'vat": 'Shvat', 'shevat': 'Shvat', 'iyar': 'Iyyar', 'tammuz': 'Tamuz', 'cheshvan': 'Cheshvan', 'heshvan': 'Cheshvan', 'marcheshvan': 'Cheshvan', 'teves': 'Tevet', 'tevet': 'Tevet',
  'adar 1': 'Adar I', 'adar a': 'Adar I', 'adar_i': 'Adar I', 'adar1': 'Adar I', 'adar 2': 'Adar II', 'adar b': 'Adar II', 'adar_ii': 'Adar II', 'adar2': 'Adar II',
  'ניסן': 'Nisan', 'אייר': 'Iyyar', 'איר': 'Iyyar', 'סיוון': 'Sivan', 'סיון': 'Sivan', 'תמוז': 'Tamuz', 'אב': 'Av', 'מנחם אב': 'Av', 'אלול': 'Elul', 'תשרי': 'Tishrei',
  'חשוון': 'Cheshvan', 'חשון': 'Cheshvan', 'מרחשוון': 'Cheshvan', 'מרחשון': 'Cheshvan', 'כסלו': 'Kislev', 'כסליו': 'Kislev', 'טבת': 'Tevet', 'שבט': 'Shvat', 'אדר': 'Adar',
  'אדר א': 'Adar I', "אדר א'": 'Adar I', 'אדר א׳': 'Adar I', 'אדר ראשון': 'Adar I', 'אדר ב': 'Adar II', "אדר ב'": 'Adar II', 'אדר ב׳': 'Adar II', 'אדר שני': 'Adar II',
};

// לבורר חודש ב-UI: [{ value: 'Nisan', label: 'ניסן' }, ...] (סדר השנה מתשרי).
export const HEBREW_MONTH_OPTIONS = Object.freeze(
  [7, 8, 9, 10, 11, 'Adar', 'Adar I', 'Adar II', 1, 2, 3, 4, 5, 6].map((x) => {
    const m = typeof x === 'number' ? MONTHS.find((mm) => mm.number === x && !mm.name.startsWith('Adar')) : MONTHS.find((mm) => mm.name === x);
    return Object.freeze({ value: m.name, label: m.he, maxDay: m.max });
  })
);

// מחרוזת חודש (שם קנוני / כינוי / עברית) -> הרשומה הקנונית, או null.
function monthFromInput(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  const lower = s.toLowerCase();
  return MONTH_BY_NAME.get(lower) || MONTH_BY_NAME.get((MONTH_ALIASES[lower] || MONTH_ALIASES[s] || '').toLowerCase()) || null;
}

// הכלל לשנה נתונה (מתועד בחוזה סעיף 2.4):
//   'Adar'    -> שנה פשוטה: אדר (12); שנה מעוברת: אדר ב' (13)  [כמו פורים]
//   'Adar I'  -> שנה מעוברת: אדר א' (12); שנה פשוטה: אדר (12)
//   'Adar II' -> שנה מעוברת: אדר ב' (13); שנה פשוטה: אדר (12)
//   יום 30 בחודש שבאותה שנה יש בו 29 ימים (חשוון/כסלו חסרים, אדר א' בשנה פשוטה) -> היום האחרון (29).
function resolveHebrewMonth(monthName, hebrewYear) {
  const leap = HDate.isLeapYear(hebrewYear);
  if (monthName === 'Adar') return leap ? 13 : 12;
  if (monthName === 'Adar I') return 12;
  if (monthName === 'Adar II') return leap ? 13 : 12;
  return MONTH_BY_NAME.get(monthName.toLowerCase()).number;
}

// מפתח של תאריך עברי קבוע בשנה עברית נתונה (אחרי כלל אדר ו-30/29), או null.
function keyOfHebrewDate(monthName, day, hebrewYear) {
  try {
    const m = resolveHebrewMonth(monthName, hebrewYear);
    const d = Math.min(day, HDate.daysInMonth(m, hebrewYear));
    return keyOfAbs(new HDate(d, m, hebrewYear).abs());
  } catch (e) {
    console.error('businessDays: hebrew date resolve failed', monthName, day, hebrewYear, e);
    return null;
  }
}

/**
 * התאריך העברי של מפתח לועזי (יום ישראלי) - לתצוגה ב-UI ולבדיקות. בלי Date, בלי אזור זמן.
 * @returns {{year:number, month:string, monthNumber:number, day:number, leap:boolean, label:string}|null}
 *   month = השם הקנוני ('Adar' בשנה פשוטה; 'Adar I'/'Adar II' בשנה מעוברת), label = "כ״ו שבט".
 */
export function hebrewDateOfKey(dateOrKey) {
  const key = toDayKey(dateOrKey);
  if (!key) return null;
  try {
    const hd = new HDate(absOfKey(key));
    const year = hd.getFullYear();
    const leap = HDate.isLeapYear(year);
    const monthNumber = hd.getMonth();
    const month = monthNumber === 12 ? (leap ? 'Adar I' : 'Adar') : monthNumber === 13 ? 'Adar II' : MONTHS.find((m) => m.number === monthNumber).name;
    const day = hd.getDate();
    return { year, month, monthNumber, day, leap, label: formatHebrewDayMonth(month, day) };
  } catch (e) {
    console.error('businessDays: hebrewDateOfKey failed for', key, e);
    return null;
  }
}

const HEB_DAY_LETTERS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז', 'יז', 'יח', 'יט', 'כ', 'כא', 'כב', 'כג', 'כד', 'כה', 'כו', 'כז', 'כח', 'כט', 'ל'];
// "כ״ו שבט" / "ל׳ חשוון" - לתצוגת תאריך קבוע ברשימה ובלוח.
export function formatHebrewDayMonth(monthName, day) {
  const m = monthFromInput(monthName);
  const letters = HEB_DAY_LETTERS[day] || String(day);
  const gem = letters.length === 1 ? `${letters}׳` : `${letters.slice(0, -1)}״${letters.slice(-1)}`;
  return `${gem} ${m ? m.he : String(monthName)}`;
}

// ---------- ההגדרה non_working_days_extra ----------

function emptyConfig() {
  return { version: NON_WORKING_DAYS_SETTING_VERSION, closed: new Set(), days: new Set(), notes: new Map(), ranges: [], recurringHebrew: [], recurringSig: '[]', invalid: 0, ignoredOpen: 0 };
}

// Object.freeze לא מגן על התוכן של Set/Map - קוד UI שמתחיל מברירת המחדל ועושה .add() היה משנה
// את ברירת המחדל לכל התהליך (סקירה). לכן האוספים של הקונפיג הריק דוחים כל שינוי; מי שרוצה
// לערוך מתחיל מ-nonWorkingDaysDocument(config) (מסמך JSON ניתן לעריכה) או cloneNonWorkingConfig.
const frozenMsg = 'EMPTY_NON_WORKING_CONFIG is immutable - use nonWorkingDaysDocument(config) / cloneNonWorkingConfig(config) to get an editable copy';
class FrozenSet extends Set {
  add() { throw new TypeError(frozenMsg); }
  delete() { throw new TypeError(frozenMsg); }
  clear() { throw new TypeError(frozenMsg); }
}
class FrozenMap extends Map {
  set() { throw new TypeError(frozenMsg); }
  delete() { throw new TypeError(frozenMsg); }
  clear() { throw new TypeError(frozenMsg); }
}

export const EMPTY_NON_WORKING_CONFIG = Object.freeze({
  version: NON_WORKING_DAYS_SETTING_VERSION,
  closed: new FrozenSet(), days: new FrozenSet(), notes: new FrozenMap(),
  ranges: Object.freeze([]), recurringHebrew: Object.freeze([]), recurringSig: '[]', invalid: 0, ignoredOpen: 0
});

function isConfig(x) {
  return !!x && typeof x === 'object' && x.closed instanceof Set && x.notes instanceof Map;
}

// עותק עצמאי וניתן לעריכה של קונפיג (Set/Map חדשים). לעריכה מה-UI עדיף nonWorkingDaysDocument.
export function cloneNonWorkingConfig(config) {
  return parseNonWorkingDaysSetting(nonWorkingDaysDocument(config));
}

function normNote(x) {
  return typeof x === 'string' ? x.trim().slice(0, NOTE_MAX_LENGTH) : '';
}

function normStatus(item) {
  const raw = item.status === undefined || item.status === null ? '' : String(item.status).trim().toLowerCase();
  return raw === '' ? 'closed' : raw;
}

// value של SystemSetting (מחרוזת JSON) / אובייקט כבר-מפורסר / קונפיג מוכן -> NonWorkingConfig.
// לעולם לא זורק: שורה חסרה, ריק, JSON שבור או רשומות לא תקינות -> מתעלמים (invalid נספר).
// מקבל (גרסה 2, הצורה הקנונית): { version:2, days:[{date,note}], ranges:[{from,to,note}], recurringHebrew:[{month,day,note}] }
// לאחור (גרסה 1): { version:1, days:[{date,status,note}] } - status "closed"/חסר = סגור; "open" מתעלם ונספר
// ב-ignoredOpen (אין יותר פתיחת יום סגור). וגם: מערך חשוף של רשומות יום, או מערך מחרוזות (= סגורים).
// תוצאה: closed = כל הימים הסגורים (ימים בודדים + ימי הטווחים); days = הימים הבודדים בלבד; notes =
// הערה לכל יום סגור (הערת יום בודד גוברת על הערת טווח); ranges/recurringHebrew כפי שנשמרו (מנורמלים).
export function parseNonWorkingDaysSetting(raw) {
  const cfg = emptyConfig();
  if (raw === null || raw === undefined) return cfg;
  if (isConfig(raw)) return raw;
  let data = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return cfg;
    try { data = JSON.parse(trimmed); } catch { cfg.invalid = 1; return cfg; }
  }
  const isDoc = !!data && typeof data === 'object' && !Array.isArray(data);
  const days = Array.isArray(data) ? data : (isDoc && Array.isArray(data.days) ? data.days : (isDoc ? [] : null));
  if (!days) { cfg.invalid = 1; return cfg; }
  const ranges = isDoc && Array.isArray(data.ranges) ? data.ranges : [];
  const recurring = isDoc && Array.isArray(data.recurringHebrew) ? data.recurringHebrew : [];
  if (isDoc && !Array.isArray(data.days) && data.days !== undefined) cfg.invalid++;
  if (isDoc && !Array.isArray(data.ranges) && data.ranges !== undefined) cfg.invalid++;
  if (isDoc && !Array.isArray(data.recurringHebrew) && data.recurringHebrew !== undefined) cfg.invalid++;

  // --- ימים בודדים ---
  if (days.length > MAX_SETTING_ENTRIES) cfg.invalid += days.length - MAX_SETTING_ENTRIES;
  for (let i = 0; i < Math.min(days.length, MAX_SETTING_ENTRIES); i++) {
    const entry = days[i];
    const item = typeof entry === 'string' ? { date: entry } : entry;
    if (!item || typeof item !== 'object' || !isValidDayKey(item.date)) { cfg.invalid++; continue; }
    const status = normStatus(item);
    if (status === 'open') { cfg.ignoredOpen++; cfg.invalid++; continue; }
    if (status !== 'closed') { cfg.invalid++; continue; }
    const key = item.date;
    cfg.days.add(key);
    cfg.closed.add(key);
    const note = normNote(item.note);
    if (note) cfg.notes.set(key, note); // רשומה כפולה: האחרונה קובעת את ההערה
  }

  // --- טווחים ---
  if (ranges.length > MAX_RANGE_ENTRIES) cfg.invalid += ranges.length - MAX_RANGE_ENTRIES;
  for (let i = 0; i < Math.min(ranges.length, MAX_RANGE_ENTRIES); i++) {
    const r = ranges[i];
    if (!r || typeof r !== 'object' || !isValidDayKey(r.from) || !isValidDayKey(r.to) || r.from > r.to) { cfg.invalid++; continue; }
    const a = epochDaysOfKey(r.from), b = epochDaysOfKey(r.to);
    if (b - a + 1 > MAX_RANGE_DAYS) { cfg.invalid++; continue; }
    const note = normNote(r.note);
    cfg.ranges.push(note ? { from: r.from, to: r.to, note } : { from: r.from, to: r.to });
    for (let e = a; e <= b; e++) {
      const key = keyOfEpochDays(e);
      cfg.closed.add(key);
      if (note && !cfg.days.has(key)) cfg.notes.set(key, note); // טווח מאוחר גובר על טווח מוקדם; יום בודד גובר על טווח
    }
  }
  cfg.ranges.sort((x, y) => (x.from < y.from ? -1 : x.from > y.from ? 1 : x.to < y.to ? -1 : x.to > y.to ? 1 : 0));

  // --- תאריכים עבריים קבועים ---
  if (recurring.length > MAX_RECURRING_ENTRIES) cfg.invalid += recurring.length - MAX_RECURRING_ENTRIES;
  const seen = new Map();
  for (let i = 0; i < Math.min(recurring.length, MAX_RECURRING_ENTRIES); i++) {
    const r = recurring[i];
    const m = r && typeof r === 'object' ? monthFromInput(r.month) : null;
    const day = r && typeof r === 'object' ? Number(r.day) : NaN;
    if (!m || !Number.isInteger(day) || day < 1 || day > m.max) { cfg.invalid++; continue; }
    const note = normNote(r.note);
    seen.set(`${m.name}|${day}`, note ? { month: m.name, day, note } : { month: m.name, day }); // כפול: האחרון קובע
  }
  cfg.recurringHebrew = [...seen.values()].sort((x, y) => recurringOrder(x) - recurringOrder(y));
  cfg.recurringSig = recurringSignature(cfg.recurringHebrew);
  return cfg;
}

// חתימת רשימת התאריכים הקבועים למטמון - כולל ההערות, כדי ששני קונפיגים עם אותם תאריכים והערות שונות
// לא יחלקו רשומות (הערה של קונפיג אחד הייתה מוצגת לשני).
function recurringSignature(list) {
  return JSON.stringify(list.map((r) => [r.month, r.day, r.note || '']));
}

// מיון לפי סדר השנה (מתשרי), אדר/אדר א'/אדר ב' לפני ניסן.
function recurringOrder(r) {
  const m = MONTH_BY_NAME.get(r.month.toLowerCase());
  const pos = HEBREW_MONTH_OPTIONS.findIndex((o) => o.value === m.name);
  return pos * 100 + r.day;
}

// --- מטמון "תאריכים קבועים" לשנה לועזית: Map<sig, Map<year, Map<key, {month, day, note}>>> ---
const recurringCache = new Map();
const RECURRING_CACHE_MAX_SIGS = 32;

function recurringMapForYear(cfg, year) {
  const list = cfg.recurringHebrew;
  if (!list || list.length === 0) return null;
  const sig = cfg.recurringSig || recurringSignature(list);
  let byYear = recurringCache.get(sig);
  if (!byYear) {
    if (recurringCache.size >= RECURRING_CACHE_MAX_SIGS) recurringCache.clear();
    byYear = new Map();
    recurringCache.set(sig, byYear);
  }
  let map = byYear.get(year);
  if (map) return map;
  map = new Map();
  // שנה לועזית Y חופפת לשתי שנים עבריות: Y+3760 (עד ~ספטמבר) ו-Y+3761 (מ-~ספטמבר)
  for (const r of list) {
    for (const hy of [year + 3760, year + 3761]) {
      const key = keyOfHebrewDate(r.month, r.day, hy);
      if (key && Number(key.slice(0, 4)) === year) map.set(key, r);
    }
  }
  byYear.set(year, map);
  return map;
}

function recurringHit(key, cfg) {
  const map = recurringMapForYear(cfg, Number(key.slice(0, 4)));
  return map ? map.get(key) ?? null : null;
}

function rangeCovering(key, cfg) {
  const ranges = cfg.ranges || [];
  for (let i = ranges.length - 1; i >= 0; i--) if (ranges[i].from <= key && key <= ranges[i].to) return ranges[i];
  return null;
}

// המסמך הקנוני (אובייקט JSON ניתן לעריכה) - מה ש-serialize כותב ומה שה-UI עורך:
// { version:2, days:[{date, note?}], ranges:[{from, to, note?}], recurringHebrew:[{month, day, note?}] } - הכל ממוין.
export function nonWorkingDaysDocument(config) {
  const cfg = normalizeConfig(config);
  const days = [];
  for (const key of (cfg.days instanceof Set ? cfg.days : cfg.closed)) {
    const note = cfg.notes.get(key);
    days.push(note ? { date: key, note } : { date: key });
  }
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    version: NON_WORKING_DAYS_SETTING_VERSION,
    days,
    ranges: (cfg.ranges || []).map((r) => (r.note ? { from: r.from, to: r.to, note: r.note } : { from: r.from, to: r.to })),
    recurringHebrew: (cfg.recurringHebrew || []).map((r) => (r.note ? { month: r.month, day: r.day, note: r.note } : { month: r.month, day: r.day })),
  };
}

// הצורה הקנונית לשמירה ב-POST /api/settings.
export function serializeNonWorkingDaysSetting(config) {
  return JSON.stringify(nonWorkingDaysDocument(config));
}

/**
 * אימות ערך לפני שמירה (POST /api/settings): null = תקין, אחרת הודעת שגיאה בעברית.
 * ריק = "אין ימים נוספים" ותקין. רשומה לא תקינה אחת (או "open" מגרסה 1) פוסלת את השמירה - ה-UI
 * מייצר תמיד מסמך תקין (nonWorkingDaysDocument), אז כישלון כאן הוא באג או קריאה ידנית ל-API.
 */
export function validateNonWorkingDaysSettingValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return 'ערך לא תקין - נדרשת מחרוזת JSON.';
  if (value.length > MAX_SETTING_VALUE_LENGTH) return 'רשימת הימים ארוכה מדי.';
  if (!value.trim()) return null;
  let data;
  try { data = JSON.parse(value); } catch { return 'רשימת הימים אינה JSON תקין.'; }
  const cfg = parseNonWorkingDaysSetting(data);
  if (cfg.ignoredOpen > 0) return 'סימון יום סגור כ"פתוח" אינו נתמך יותר.';
  if (cfg.invalid > 0) return `רשימת הימים מכילה ${cfg.invalid} רשומות לא תקינות (תאריך לא קיים, טווח הפוך או ארוך משנה, חודש/יום עברי לא תקין, או חריגה מהתקרה).`;
  return null;
}

// האם מנת שמירה ל-POST /api/settings נוגעת אך ורק במפתח הזה (אז מספיקה ההרשאה feature:non_working_days_manage).
export function isNonWorkingDaysOnlySettingsBatch(data) {
  return Array.isArray(data) && data.length > 0 && data.every((item) => !!item && typeof item === 'object' && item.key === NON_WORKING_DAYS_SETTING_KEY);
}

// ---------- הכלל עצמו ----------

function normalizeOpts(opts) {
  return { skipWeekend: opts?.skipWeekend !== false, skipHolidays: opts?.skipHolidays !== false };
}

function normalizeConfig(config) {
  if (!config) return EMPTY_NON_WORKING_CONFIG;
  return isConfig(config) ? config : parseNonWorkingDaysSetting(config);
}

// הסיבות שבגללן יום לא עובד, בסדר קבוע.
function reasonsForKey(key, cfg, o) {
  const reasons = [];
  if (cfg.days instanceof Set ? cfg.days.has(key) : cfg.closed.has(key)) reasons.push('closed');
  if (rangeCovering(key, cfg)) reasons.push('range');
  if (recurringHit(key, cfg)) reasons.push('recurring');
  const w = weekdayOfKey(key);
  if (o.skipWeekend && w === 5) reasons.push('friday');
  if (o.skipWeekend && w === 6) reasons.push('shabbat');
  if (o.skipHolidays && isChagKey(key)) reasons.push('chag');
  if (o.skipHolidays && isCholHamoedKey(key)) reasons.push('chol_hamoed');
  if (o.skipHolidays && isErevChagKey(key)) reasons.push('erev_chag');
  return reasons;
}

function nonWorkingByKey(key, cfg, o) {
  if (cfg.closed.has(key)) return true;
  if (o.skipWeekend && isWeekendKey(key)) return true;
  if (o.skipHolidays && isHolidayKey(key)) return true;
  if (recurringHit(key, cfg)) return true;
  return false;
}

/**
 * @param {string|Date|number} dateOrKey - 'YYYY-MM-DD' (יום ישראלי) או רגע (Date/ISO) שמומר ליום הישראלי
 * @param {object} [config] - NonWorkingConfig (parseNonWorkingDaysSetting) או ה-value הגולמי; ריק = ברירות מחדל בלבד
 * @param {{skipWeekend?: boolean, skipHolidays?: boolean}} [opts]
 * @returns {boolean} true = יום לא עובד. קלט לא תקין -> false (לא חוסם).
 */
export function isNonWorkingDay(dateOrKey, config, opts) {
  const key = toDayKey(dateOrKey);
  if (!key) return false;
  return nonWorkingByKey(key, normalizeConfig(config), normalizeOpts(opts));
}

export function isWorkingDay(dateOrKey, config, opts) {
  return !isNonWorkingDay(dateOrKey, config, opts);
}

// למסך ניהול היומן: למה היום סגור + שם החג + הערת הבעלים (יום בודד > טווח > תאריך קבוע).
export function dayStatus(dateOrKey, config, opts) {
  const key = toDayKey(dateOrKey);
  if (!key) return null;
  const cfg = normalizeConfig(config);
  const o = normalizeOpts(opts);
  const titles = [];
  const h = holidayOf(key);
  if (h) titles.push(h.title);
  const erev = chagTitle(addDaysToDateKey(key, 1));
  if (erev) titles.push(`ערב ${erev}`);
  const rec = recurringHit(key, cfg);
  const note = cfg.notes.get(key) ?? (rec && rec.note) ?? null;
  return {
    key,
    working: !nonWorkingByKey(key, cfg, o),
    reasons: reasonsForKey(key, cfg, o),
    titles,
    note,
    recurring: rec ? { month: rec.month, day: rec.day, label: formatHebrewDayMonth(rec.month, rec.day) } : null
  };
}

// כל הימים הלא-עובדים בטווח (כולל הקצוות) - לצביעת לוח חודשי בקריאה אחת. טווח ארוך מ-
// MAX_LIST_RANGE_DAYS נחתך בסופו (לוח של שנתיים מספיק לכל תצוגה).
export function listNonWorkingDays(startKey, endKey, config, opts) {
  const start = toDayKey(startKey);
  let end = toDayKey(endKey);
  if (!start || !end || start > end) return [];
  const maxEnd = addDaysToDateKey(start, MAX_LIST_RANGE_DAYS - 1);
  if (end > maxEnd) end = maxEnd;
  const cfg = normalizeConfig(config);
  const o = normalizeOpts(opts);
  const out = [];
  for (let key = start; key <= end; key = addDaysToDateKey(key, 1)) {
    if (!nonWorkingByKey(key, cfg, o)) continue;
    const st = dayStatus(key, cfg, o);
    out.push({ key, reasons: st.reasons, titles: st.titles, note: st.note, recurring: st.recurring });
  }
  return out;
}

/**
 * n ימי עסקים קדימה (n>0) או אחורה (n<0). n=0 מחזיר את היום עצמו גם אם אינו יום עבודה
 * (תאריך אירוע של לקוחה יכול ליפול בשבת - זה תאריך שלה, לא יום עבודה שלנו).
 * n נחתך ל-±MAX_BUSINESS_DAY_OFFSET (366) - ר' הערה ליד הקבוע.
 * @returns {string|null} מפתח 'YYYY-MM-DD'; null לקלט לא תקין
 */
export function addBusinessDays(dateOrKey, n, config, opts) {
  const key = toDayKey(dateOrKey);
  if (!key) return null;
  const count = clampOffset(n);
  if (count === 0) return key;
  const cfg = normalizeConfig(config);
  const o = normalizeOpts(opts);
  const step = count > 0 ? 1 : -1;
  let remaining = Math.abs(count);
  let cur = key;
  let skipped = 0;
  while (remaining > 0) {
    cur = addDaysToDateKey(cur, step);
    if (skipped < MAX_CONSECUTIVE_NON_WORKING && nonWorkingByKey(cur, cfg, o)) { skipped++; continue; }
    skipped = 0;
    remaining--;
  }
  return cur;
}

// יום העבודה הראשון אחרי היום הנתון (מועד החזרה צפוי להזמנה רגילה).
export function nextWorkingDay(dateOrKey, config, opts) {
  return addBusinessDays(dateOrKey, 1, config, opts);
}

/**
 * גלגול קדימה ליום עובד (החלטת הבעלים 2.10.2026, "ההחזרה של אירוע בחמישי תהיה בראשון"): מועד החזרה לעולם
 * לא נוחת על יום סגור. יום עובד מוחזר כמו שהוא; שישי/שבת/חג/ערב חג/יום שהבעלים סגר -> יום העבודה הראשון
 * אחריו. הפונקציה האחת שמאחורי תאריך החזרה מפורש (toDate/returnDate) בכל המערכת: כרטיס ההזמנה, רשימת
 * האיחורים, ההדפסה, המיילים, "אמור לחזור מחר", שבבי "החזרה היום/מחר" (lib/lateReturn.js) ושלב 8 בלו״ז
 * (lib/schedule/dates.js). null לקלט לא תקין.
 * @param {string|Date|number} dateOrKey - 'YYYY-MM-DD' (יום ישראלי) או רגע שמומר ליום הישראלי
 */
export function rollForwardToWorkingDay(dateOrKey, config, opts) {
  const key = toDayKey(dateOrKey);
  if (!key) return null;
  const cfg = normalizeConfig(config);
  const o = normalizeOpts(opts);
  return nonWorkingByKey(key, cfg, o) ? addBusinessDays(key, 1, cfg, o) : key;
}

/**
 * ההופכי של rollForwardToWorkingDay כטווח רציף: כל הימים שמתגלגלים ל-dayKey = היום עצמו + רצף הימים הסגורים
 * שלפניו (ראשון 18.10.2026 אוסף את שישי 16.10 ושבת 17.10). משמש לחלון SQL של toDate/returnDate ("מי חוזר
 * ביום X"). null כש-dayKey עצמו סגור - שום החזרה לא נוחתת עליו - או לקלט לא תקין.
 * @returns {{startKey: string, endKey: string}|null}
 */
export function rolledSourceRange(dayKey, config, opts) {
  const day = toDayKey(dayKey);
  if (!day) return null;
  const cfg = normalizeConfig(config);
  const o = normalizeOpts(opts);
  if (nonWorkingByKey(day, cfg, o)) return null;
  let start = day;
  for (let i = 0; i < MAX_CONSECUTIVE_NON_WORKING; i++) {
    const prev = addDaysToDateKey(start, -1);
    if (!nonWorkingByKey(prev, cfg, o)) break;
    start = prev;
  }
  return { startKey: start, endKey: day };
}

// מפתח 'YYYY-MM-DD' -> Date בחצות *מקומית* של אותו יום. זה הצורה ש-getHebrewDateString /
// getHebrewWeekdayLabel / new HDate(...) קוראים (רכיבים מקומיים: getDay, getFullYear...), ולכן
// הם מציגים את אותו יום בכל אזור זמן. להדפסה/מייל בלבד - לא להעביר Date כזה בחזרה לפונקציות
// הספירה למעלה (הן מצפות למפתח או לרגע; ר' CONTRACT סעיף 3). null לקלט לא תקין.
export function localDateFromKey(key) {
  if (!isValidDayKey(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// רגע (eventDate / toDate / returnDate מה-DB, בכל צורת אחסון) -> Date בחצות מקומית של היום *הישראלי* שלו,
// לתצוגה בפורמטרים של lib/hebrewDate.js (שקוראים רכיבים מקומיים). בלי זה, בשרת (UTC) תאריך ששמור
// כ-21:00Z (חצות ישראל, ייבוא מ-Access) הוצג כיום הקודם. בדפדפן ישראלי התוצאה זהה לתצוגה הישירה.
// null לקלט חסר/לא תקין.
export function israelLocalDate(dateInput) {
  if (dateInput === null || dateInput === undefined || dateInput === '') return null;
  const key = getIsraelDateKey(dateInput);
  return key ? localDateFromKey(key) : null;
}

/**
 * חלון תאריכי האירוע (טווח רציף של מפתחות) שמכיל כל אירוע E ש-addBusinessDays(E, n) נופל על יום כלשהו בטווח
 * [fromKey, toKey]. מחושב מההופכי (inverseBusinessDays) לפי הכלל והרשימה הנוכחיים - לא מספר קבוע - כך שסימון
 * שבוע סגור ביומן (או חול המועד, שסגור מגרסה 2 - פער של עד 16 ימי לוח בין אירוע למועד ההכנה) לא יכול
 * להפיל הזמנות בשקט משאילתת חיפוש.
 * משמש: "הכנות להיום" (n=-3), ושבבי "החזרה היום/מחר" בחיפוש המתקדם (n=+1).
 * ספירה אף פעם לא נוחתת על יום לא עובד, לכן מספיק ההופכי של היום העובד הראשון והאחרון בטווח.
 * null כשאין יום עובד בטווח (אז אין אירוע תואם) או כשהמפתחות לא תקינים; n=0 -> הטווח עצמו.
 * @returns {{startKey: string, endKey: string}|null}
 */
export function eventRangeForOffset(fromKey, toKey, n, config, opts) {
  const from = toDayKey(fromKey), to = toDayKey(toKey);
  if (!from || !to || from > to) return null;
  if (clampOffset(n) === 0) return { startKey: from, endKey: to };
  const cfg = normalizeConfig(config);
  const o = normalizeOpts(opts);
  const LIMIT = 800; // יותר מכל רצף סגור סביר; מעבר לזה אין יום עובד "ראשון"
  let first = null, last = null;
  for (let k = from, i = 0; k <= to && i < LIMIT; k = addDaysToDateKey(k, 1), i++) { if (!nonWorkingByKey(k, cfg, o)) { first = k; break; } }
  for (let k = to, i = 0; k >= from && i < LIMIT; k = addDaysToDateKey(k, -1), i++) { if (!nonWorkingByKey(k, cfg, o)) { last = k; break; } }
  if (!first || !last) return null;
  const a = inverseBusinessDays(first, n, cfg, o), b = inverseBusinessDays(last, n, cfg, o);
  if (!a || !b) return null;
  return { startKey: a.startKey < b.startKey ? a.startKey : b.startKey, endKey: a.endKey > b.endKey ? a.endKey : b.endKey };
}

/**
 * סוף חלון האירועים ל"הכנות להיום" (מפתח 'YYYY-MM-DD'): האירוע המאוחר ביותר שתאריך ההכנה שלו
 * (PRINT_PREP_BUSINESS_DAYS_BEFORE_EVENT ימי עסקים לפני האירוע) נופל בטווח [fromStr, toStr], לפי הכלל
 * והרשימה הנוכחיים. null כשאחד המפתחות אינו 'YYYY-MM-DD' תקין (אז הקורא נשאר עם החלון הקבוע) או כשאין
 * יום עובד בטווח. טהור - נבדק ישירות וגם דרך ה-route (print-prep.behaviour בבדיקות).
 */
export function printPrepWindowEndKey(fromStr, toStr, config) {
  if (!isValidDayKey(fromStr) || !isValidDayKey(toStr)) return null;
  const range = eventRangeForOffset(fromStr, toStr, -PRINT_PREP_BUSINESS_DAYS_BEFORE_EVENT, config);
  return range ? range.endKey : null;
}

/**
 * מועד ש-`days` ימי עסקים לפני `date` (למשל מועד איסוף השמלות = 2 ימי עסקים לפני האירוע), לפי
 * הכלל האחיד (שישי/שבת/חג/חול המועד/ערב חג/רשימת הבעלים). מחליף את subtractSkippingWeekendsAndChag
 * (lib/hebrewDate.js) בהדפסה ובמיילים: ההבדלים ממנה - חול המועד (סגור מגרסה 2) וימים שהבעלים סימן
 * סגורים (ימים בודדים, טווחים, תאריכים עבריים קבועים) נספרים גם כאן, כך שמועד האיסוף יוצא מוקדם
 * יותר (לעולם לא מאוחר יותר). מחזיר Date בחצות מקומית (ר' localDateFromKey), כמו הפונקציה הישנה;
 * null לתאריך לא תקין.
 * @param {Date|string|number} date - רגע (eventDate מה-DB) או מפתח 'YYYY-MM-DD'
 */
export function subtractBusinessDays(date, days, config, opts) {
  const key = toDayKey(date);
  if (!key) return null;
  const back = addBusinessDays(key, -Math.abs(Number(days) || 0), config, opts);
  return back ? localDateFromKey(back) : null;
}

/**
 * מועד ההכנה להדפסה (3 ימי עסקים לפני האירוע) לפי הכלל האחיד - כמו getPrintPrepDate ב-lib/hebrewDate.js,
 * אבל מכבד גם את רשימת הבעלים. ה-3 זהה ל-PRINT_PREP_BUSINESS_DAYS_BEFORE_EVENT שם.
 */
export function getPrintPrepDateWithConfig(eventDate, config) {
  return subtractBusinessDays(eventDate, PRINT_PREP_BUSINESS_DAYS_BEFORE_EVENT, config);
}

/**
 * ההופכי של addBusinessDays: כל הימים E שמקיימים addBusinessDays(E, n) === target. תמיד טווח רציף.
 * n<0: ה-E-ים אחרי target (למשל "יום היציאה = n ימי עסקים לפני האירוע" -> אילו אירועים יוצאים ב-target);
 * n>0: ה-E-ים לפני target (למשל "יום האיסוף = n ימי עסקים אחרי האירוע").
 * null כש-target אינו יום עובד ו-n≠0 (אף ספירה לא נוחתת על יום לא עובד). n=0 -> {target, target}.
 * n נחתך ל-±MAX_BUSINESS_DAY_OFFSET כמו ב-addBusinessDays.
 * @returns {{startKey: string, endKey: string}|null}
 */
export function inverseBusinessDays(targetKey, n, config, opts) {
  const target = toDayKey(targetKey);
  if (!target) return null;
  const count = clampOffset(n);
  if (count === 0) return { startKey: target, endKey: target };
  const cfg = normalizeConfig(config);
  const o = normalizeOpts(opts);
  if (nonWorkingByKey(target, cfg, o)) return null;
  const abs = Math.abs(count);
  if (count < 0) {
    // E אחרי target: בין יום העסקים ה-(abs-1) (לא כולל) ליום העסקים ה-abs (כולל) אחרי target.
    const wPrev = addBusinessDays(target, abs - 1, cfg, o);
    const wN = addBusinessDays(target, abs, cfg, o);
    return { startKey: addDaysToDateKey(wPrev, 1), endKey: wN };
  }
  // E לפני target: מיום העסקים ה-abs לפני target (כולל) עד יום העסקים ה-(abs-1) לפני target (לא כולל).
  const bN = addBusinessDays(target, -abs, cfg, o);
  const bPrev = addBusinessDays(target, -(abs - 1), cfg, o);
  return { startKey: bN, endKey: addDaysToDateKey(bPrev, -1) };
}
