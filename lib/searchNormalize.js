// lib/searchNormalize.js - מודול משותף ל"הבנת" מה שהוקלד בשורות החיפוש: ניקוי טקסט, גימור עברית, מידות, ברקוד/מס' הזמנה/טלפון,
// מילות מפתח ("מידה 2 דגם 3"), תאריך עברי ("כז תשרי", "ב חשוון") ותאריך לועזי ("5/10").
// מודול טהור (ESM): בלי prisma / React / DOM / רשת ובלי תלות חיצונית (hebcal לא נדרש) - רץ באותו אופן בלקוח, בשרת ובבדיקות node.
// מייבא רק שני מודולים טהורים של הפרויקט: lib/sizeSort.js (normalizeSizeKey) ו-lib/quickPrefix.js (splitMatch).
// מקור ההחלטות: scratch/search-improvement/A-map-main-search.md + C-all-search-bars.md (סעיף "shared module proposal") + החלטות הבעלים 5.10.2026.
// הבדיקות: scripts/test_search_normalize.mjs (מריץ את עצמו ב-3 אזורי זמן).
//
// ---------------------------------------------------------------------------------------------------------------------------
// התנהגות קיימת שהמודול הזה מחליף בהדרגה (לא נגענו בה בשלב הזה) - שלוש הגדרות סותרות של "ברקוד", והגדרת טלפון נוספת:
//   1) lib/quickSearchResults.js:11   BARCODE_LIKE = /^\d{5,}$/   (5 ספרות ומעלה; משמש גם את מיון global-search L26)
//   2) app/components/menu/MenuSearchPanel.js:219   /^\d{7}$/     (בדיוק 7; Enter על 7 ספרות = החזרה מהירה)
//   3) lib/rentalBarcodeMatch.js:20-29 parseBarcode  /^\d{5,}$/   (5 ומעלה, פירוק קידומת/מידה/סידורי)
//   4) app/components/home/homeLogic.js:123 וגם app/refunds/page.js:31: 7 ספרות ומעלה = טלפון (ברקוד של 7 ספרות נשלח כטלפון!)
//   5) TopbarSearch.js:118-124 / app/api/returns/scan/route.js:10-12: ניקוי כל מה שאינו [0-9A-Za-z] (בלי זיהוי)
// ההחלטה החדשה (בעלים): 7 ספרות = ברקוד; 5-6 ספרות = מס' הזמנה קודם, ברקוד שני; עד 4 ספרות = מס' הזמנה; 9-10 ספרות שמתחילות ב-0 /
// 972 / +972 = טלפון. מקרה דו-משמעי מחזיר רשימה מדורגת kinds (למשל ['orderNumber','barcode']) כדי שהקורא ישאל את שניהם.
//
// פורמט הברקוד (אומת מול lib/rentalBarcodeMatch.js:8-13 ו-app/api/rentals/scan/route.js:186-189 - lib/inventory.js עצמו לא מפרק ברקוד,
// הוא עובד עם barcodePrefix מספרי שכבר פוצל): קידומת/דגם = כל הספרות חוץ מ-4 האחרונות, מידה = שתי הספרות שלפני האחרונות, סידורי = שתיים אחרונות.
//   6323401 -> דגם 632, מידה 34, סידורי 01.   ברקוד ישן של 5 ספרות ('41807') = דגם 4, מידה 18, סידורי 07.

import { normalizeSizeKey, GENERAL_SIZE_KEY } from './sizeSort.js';
import { splitMatch } from './quickPrefix.js';

// ===========================================================================================================================
// 1. ניקוי טקסט
// ===========================================================================================================================

// תווים בלתי נראים: soft hyphen, ALM, mongolian vowel sep, ZWSP/ZWNJ/ZWJ/LRM/RLM, סימוני כיווניות U+202A-202E ו-U+2066-206F, BOM
const INVISIBLE_RE = /[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]/g;
// רווחים "מוזרים" (רווח קשיח, רווחים צרים, ideographic...) וטאבים/שורות חדשות -> רווח רגיל
const ODD_SPACE_RE = /[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\t\r\n\v\f]/g;
const DQ_RE = /[\u05f4\u201c\u201d\u201e\u201f\u2033\u02ba\uff02]/g; // gershayim U+05F4, curly double quotes, double prime, fullwidth -> "
const SQ_RE = /[\u05f3\u2018\u2019\u201a\u201b\u2032\u02b9\u02bc\u0060\u00b4\uff07]/g; // geresh U+05F3, curly single quotes, prime, backtick, acute -> '
const DASH_RE = /[\u05be\u2010-\u2015\u2212\ufe58\ufe63\uff0d]/g; // מקף עברי U+05BE, מקפים/מינוסים שונים -> -
const NIQQUD_RE = /[\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7]/g; // ניקוד וטעמים (בלי המקף U+05BE ובלי הפסק/סוף-פסוק)
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const FINALS_RE = /[ךםןףץ]/g;

function toAsciiDigits(s) {
  return s
    .replace(/[\uff10-\uff19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 48)) // ספרות ברוחב מלא
    .replace(/[\u0660-\u0669]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x0660 + 48)) // ערביות-הודיות
    .replace(/[\u06f0-\u06f9]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x06f0 + 48)); // פרסיות
}

/**
 * ניקוי שורת חיפוש: NFC, הסרת תווים בלתי נראים (סימוני RTL/LTR, ZWSP...), רווחים מוזרים -> רגילים, כיווץ רווחים, חיתוך קצוות,
 * איחוד גרשיים (״ " " -> ") וגרש (׳ ' ' -> ') ומקפים (־ – — -> -), ספרות לא-לטיניות -> 0-9. לא משנה אותיות ולא מוריד ניקוד (זה foldHebrew).
 * @param {*} q
 * @param {{max?: number}} [opts] max = אורך מקסימלי (ברירת מחדל ללא הגבלה)
 * @returns {string}
 */
export function cleanQuery(q, opts) {
  if (q === null || q === undefined) return '';
  let s = String(q).normalize('NFC');
  s = toAsciiDigits(s).replace(INVISIBLE_RE, '').replace(ODD_SPACE_RE, ' ')
    .replace(DQ_RE, '"').replace(SQ_RE, "'").replace(DASH_RE, '-')
    .replace(/'{2}/g, '"').replace(/"{2,}/g, '"') // שני גרשים = גרשיים; גרשיים כפולים -> אחד
    .replace(/ {2,}/g, ' ').trim();
  const max = opts && opts.max;
  return max && s.length > max ? s.slice(0, max).trim() : s;
}

/**
 * מפתח התאמה בעברית (להשוואה בלבד, לא להצגה): ניקוי + הסרת ניקוד + גימור אותיות סופיות (ך->כ ם->מ ן->נ ף->פ ץ->צ) + אותיות לטיניות קטנות.
 * "אברהם" ו-"אברהמ" יוצאים זהים. מחרוזת בלי עברית נשארת כפי שהיא (פרט לניקוי ולאותיות קטנות).
 */
export function foldHebrew(s) {
  return cleanQuery(s).replace(NIQQUD_RE, '').replace(FINALS_RE, (c) => FINALS[c]).toLowerCase();
}

// גימור אורך-שומר (1:1 בתווים) - לשימוש matchHighlight כדי שאפשר יהיה לחתוך את המחרוזת המקורית לפי אינדקסים
function foldKeepLength(s) {
  return String(s == null ? '' : s).replace(DQ_RE, '"').replace(SQ_RE, "'").replace(DASH_RE, '-').replace(FINALS_RE, (c) => FINALS[c]).toLowerCase();
}

/** מחרוזת בטוחה ל-LIKE: מבריחה \ % _ (השתמשו עם ESCAPE '\\' או ב-Prisma contains/startsWith שמבריח לבד). */
export function escapeLike(s) {
  return String(s == null ? '' : s).replace(/[\\%_]/g, (c) => '\\' + c);
}

function escapeRegexChar(s) {
  return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
}

// ===========================================================================================================================
// 2. מידות
// ===========================================================================================================================

export { GENERAL_SIZE_KEY };

/**
 * מפתח השוואה למידה: עוטף את normalizeSizeKey (lib/sizeSort.js - "02" = "2" = "002" = " 2 "; ריק = "כללי") ומוסיף: ניקוי תווים בלתי נראים,
 * הסרת כל הרווחים הפנימיים ("38 - 40" = "38-40", "36 א" = "36א"), ואותיות לטיניות גדולות (xl = XL = Xl; S/M/L/XL/XXL).
 * מידות בעברית ("קטן", "כללי") נשארות כפי שהן. לא מכיר שקילות בין "XXL" ל-"2XL" (אין לכך סימוכין בנתונים).
 */
export function sizeKey(x) {
  const t = cleanQuery(x).replace(/\s+/g, '').replace(/[a-z]+/g, (m) => m.toUpperCase());
  return normalizeSizeKey(t);
}

/** האם מפתח המידה הוא מספר שלם (עד 3 ספרות, כמו isNumericSize ב-lib/stockCheckUi.js). */
export function isNumericSizeKey(key) {
  return /^\d{1,3}$/.test(String(key ?? ''));
}

/**
 * התאמה מדויקת בין מידה שמורה למה שהוקלד: שני המפתחות שווים. "2" לא תואם ל-12/20/32 לעולם; "02" = "2" = "002". שאילתה ריקה לא תואמת.
 * (בדיקת התאמה בצד JS: מסננים בלקוח / בטסטים. ל-DB - sizeSpellings / sizeSqlMatcher.)
 */
export function sizeMatches(stored, query) {
  if (!cleanQuery(query)) return false;
  return sizeKey(stored) === sizeKey(query);
}

/**
 * רשימת האיותים השקולים של מידה, לשימוש עם IN (Prisma: { sizeText: { in: sizeSpellings(q) } } ; SQL: "sizeText" IN (...)) - התאמה מדויקת
 * שמנצלת אינדקס, בלי LIKE '%2%' (ש"2" היה מוצא בו 12, 20-29, 32...). מספר שלם n: ['2','02','002'] (הכתיב הלא-מרופד והמרופדים
 * לשתיים ולשלוש ספרות - בגמ"ח הראשי המידות שמורות מרופדות, בנווה יעקב ערבוב). אות לטינית: ['XL','xl']. אחר: [המפתח].
 * שימו לב: ערך שמור עם רווחים ("42 " / " 06" - 42 מקרים בנווה יעקב) לא נתפס ב-IN - לשם כך sizeSqlMatcher (regex שסובל רווחים).
 */
export function sizeSpellings(query) {
  const key = sizeKey(query);
  if (!cleanQuery(query)) return [];
  if (isNumericSizeKey(key)) {
    const n = String(parseInt(key, 10));
    return [...new Set([n, n.padStart(2, '0'), n.padStart(3, '0')])];
  }
  if (/^[A-Z]+$/.test(key)) return [key, key.toLowerCase()];
  return [key];
}

/**
 * תיאור התאמת מידה ל-SQL: { spellings, regex, flags }.
 *  - spellings: כמו sizeSpellings (ל-IN).
 *  - regex: ביטוי POSIX של Postgres לשימוש עם האופרטור ~ (או ~* כש-flags === 'i'), כנגד העמודה ישירות, בלי TRIM:
 *      מספר n>0:  ^\s*0*n\s*$    (תופס '2', '02', '002', ' 2 ' ולא '12'/'20'); n=0: ^\s*0+\s*$
 *      אחר:      ^\s*ת\s*ו\s*ו\s*י\s*$ (רווחים אופציונליים בין תווים: '38-40' מוצא גם '38 - 40'); אותיות לטיניות -> flags 'i'.
 *    אותו ביטוי מתקמפל ב-JS (new RegExp(regex, flags)) - כך הבדיקות מוכיחות אותו.
 *  - דוגמה ב-Prisma raw: Prisma.sql`"sizeText" ~ ${m.regex}` (או ~* כש-m.flags==='i'); כשיש אינדקס - עדיף OR בין IN לרג'קס רק כשצריך.
 * @returns {{spellings: string[], regex: string|null, flags: string}}
 */
export function sizeSqlMatcher(query) {
  const key = sizeKey(query);
  if (!cleanQuery(query)) return { spellings: [], regex: null, flags: '' };
  const spellings = sizeSpellings(query);
  if (isNumericSizeKey(key)) {
    const n = parseInt(key, 10);
    return { spellings, regex: n === 0 ? '^\\s*0+\\s*$' : `^\\s*0*${n}\\s*$`, flags: '' };
  }
  const body = Array.from(key).map(escapeRegexChar).join('\\s*');
  return { spellings, regex: `^\\s*${body}\\s*$`, flags: /[A-Za-z]/.test(key) ? 'i' : '' };
}

// ===========================================================================================================================
// 3. טלפון
// ===========================================================================================================================

/**
 * מפתח טלפון: ספרות בלבד; קידומת +972 / 972 / 00972 הופכת ל-0 מוביל (גם "+972 (0) 50..." עם 0 מיותר). פסים, רווחים וסוגריים נמחקים.
 * 972 בלי '+' נחשבת קידומת רק כשהמספר באורך 11 ספרות ומעלה (כדי לא לפרש "972" שהוקלד כקידומת חלקית). מחזיר '' כשאין ספרות.
 */
export function phoneKey(q) {
  const raw = cleanQuery(q);
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const plus = /^\+/.test(raw);
  let rest = null;
  if (digits.startsWith('00972')) rest = digits.slice(5);
  else if (digits.startsWith('972') && (plus || digits.length >= 11)) rest = digits.slice(3);
  if (rest === null) return digits;
  if (!rest) return '';
  return rest.startsWith('0') ? rest : '0' + rest;
}

/**
 * הצורות השקולות (ספרות בלבד) של מספר טלפון לשאילתת IN מול ערך שמור שנוקה ב-SQL ב-regexp_replace(phone1,'\D','','g'):
 * ['0501234567', '972501234567']. ('+' לא נשמר כי הוא נמחק בניקוי). null/ריק -> [].
 */
export function phoneEquivalentKeys(q) {
  const k = phoneKey(q);
  if (!k) return [];
  return k.startsWith('0') ? [k, '972' + k.slice(1)] : [k];
}

/**
 * התאמת טלפון: ערך שמור מול מה שהוקלד, לפי מפתחות ספרות. מספר שלם (9 ספרות ומעלה) = שוויון מלא; שאילתה חלקית (minPartial עד 8 ספרות,
 * ברירת מחדל 3) = תת-מחרוזת של הספרות. "050-123-4567" = "0501234567" = "+972501234567".
 */
export function phoneMatches(stored, q, { minPartial = 3 } = {}) {
  const ks = phoneKey(stored);
  const kq = phoneKey(q);
  if (!ks || !kq) return false;
  if (kq.length >= 9) return ks === kq || (kq.length === 9 && !kq.startsWith('0') && ks === '0' + kq); // 501234567 (בלי 0 מוביל) = 0501234567
  if (kq.length < minPartial) return false;
  return ks.includes(kq);
}

// ===========================================================================================================================
// 4. ברקוד
// ===========================================================================================================================

/**
 * פירוק ברקוד (ספרות בלבד, 5 ומעלה): { digits, prefix, size, serial, sizeKey, legacy }. null אם לא ניתן לפענח.
 * אותו כלל כמו parseBarcode ב-lib/rentalBarcodeMatch.js:20-29 (נבדק מול הפונקציה ההיא בבדיקות). legacy = בן 5 ספרות.
 */
export function parseBarcodeDigits(raw) {
  const b = cleanQuery(raw);
  if (!/^\d{5,}$/.test(b)) return null;
  const size = b.slice(b.length - 4, b.length - 2);
  return { digits: b, prefix: b.slice(0, b.length - 4), size, serial: b.slice(b.length - 2), sizeKey: sizeKey(size), legacy: b.length === 5 };
}

// ===========================================================================================================================
// 5. תאריך לועזי
// ===========================================================================================================================

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // פברואר 29 - מתאים גם לשנה מעוברת; אימות שנה פרטנית בנפרד
const isLeapGregorian = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad2 = (n) => String(n).padStart(2, '0');

function validDmy(day, month, year) {
  if (!(month >= 1 && month <= 12) || !(day >= 1)) return false;
  if (day > DAYS_IN_MONTH[month - 1]) return false;
  if (year && month === 2 && day === 29 && !isLeapGregorian(year)) return false;
  return true;
}

/**
 * מפרק תאריך לועזי מוקלד. נתמך (סדר ישראלי יום/חודש): 5/10, 5.10, 5-10, 05/10/2026, 5.10.26, 5-10-2026, וגם 2026-10-05 (שנה ראשונה).
 * מפרידים מעורבים (5/10.2026) לא מתקבלים. שנה בת שתי ספרות = 20yy. מחזיר { day, month, year|null, sep, twoDigitYear, ambiguous, key } או null.
 * ambiguous = בלי שנה והמפריד נקודה/מקף ("6.1", "38-40" - עלול להיות מידה "06.1" / טווח מידות ולא תאריך). key = 'YYYY-MM-DD' כשיש שנה.
 */
export function parseGregorianDate(input) {
  const q = cleanQuery(input);
  let m = /^(\d{4})([/.-])(\d{1,2})\2(\d{1,2})$/.exec(q);
  let day; let month; let year; let sep; let two = false;
  if (m) {
    year = Number(m[1]); month = Number(m[3]); day = Number(m[4]); sep = m[2];
  } else {
    m = /^(\d{1,2})([/.-])(\d{1,2})(?:\2(\d{4}|\d{2}))?$/.exec(q);
    if (!m) return null;
    day = Number(m[1]); month = Number(m[3]); sep = m[2];
    if (m[4] !== undefined) { two = m[4].length === 2; year = two ? 2000 + Number(m[4]) : Number(m[4]); } else year = null;
  }
  if (year !== null && (year < 1900 || year > 2200)) return null;
  if (!validDmy(day, month, year)) return null;
  return {
    day, month, year, sep, twoDigitYear: two,
    ambiguous: year === null && sep !== '/',
    key: year ? `${year}-${pad2(month)}-${pad2(day)}` : null,
  };
}

const IL_DAY_FMT = (() => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { return null; }
})();

/** מפתח היום הישראלי ('YYYY-MM-DD') של רגע (Date / מילישניות / ISO). לא תלוי באזור הזמן של המכונה: מתאים לשמירה של חצות ישראל = 21:00/22:00 UTC. */
export function israelDayKey(instant) {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return null;
  if (typeof instant === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(instant)) return instant; // כבר מפתח יום
  return IL_DAY_FMT ? IL_DAY_FMT.format(d) : d.toISOString().slice(0, 10);
}

/**
 * התאמה מדויקת (לא תת-מחרוזת!) בין תאריך שמור לתאריך לועזי מוקלד: אותו יום ואותו חודש (ואותה שנה אם הוקלדה). מקבל Date או מפתח 'YYYY-MM-DD';
 * Date מומר ליום הישראלי (israelDayKey). "5/10" מתאים ל-5 באוקטובר בכל שנה, ולא ל-15/10 או 25/10.
 */
export function gregorianMatches(stored, parsed) {
  if (!parsed) return false;
  const key = israelDayKey(stored);
  if (!key) return false;
  const [y, mo, d] = key.split('-').map(Number);
  if (mo !== parsed.month || d !== parsed.day) return false;
  return parsed.year ? y === parsed.year : true;
}

/**
 * מפתחות היום (YYYY-MM-DD) שכדאי לחפש לתאריך לועזי מוקלד: עם שנה - אחד; בלי שנה - אותו יום בכל שנה בטווח (ברירת מחדל: שנה אחורה עד שנתיים קדימה
 * סביב opts.year / השנה הנוכחית של המכונה). לשימוש עם getIsraelDayRange (lib/hebrewDate.js) ו-OR על טווחים - במקום TO_CHAR(...) LIKE '%5/10%'.
 * בלי שנה אפשר גם להשוות ב-SQL: EXTRACT(DAY/MONTH FROM ("eventDate" AT TIME ZONE 'Asia/Jerusalem')) = ...
 */
export function gregorianCandidateKeys(parsed, { year = new Date().getFullYear(), back = 1, forward = 2 } = {}) {
  if (!parsed) return [];
  if (parsed.year) return [parsed.key];
  const out = [];
  for (let y = year - back; y <= year + forward; y++) if (validDmy(parsed.day, parsed.month, y)) out.push(`${y}-${pad2(parsed.month)}-${pad2(parsed.day)}`);
  return out;
}

// ===========================================================================================================================
// 6. תאריך עברי
// ===========================================================================================================================

// חודשי השנה העברית. name = השם הקנוני באנגלית (כמו lib/businessDays.js MONTHS: 'Adar' = אדר בשנה פשוטה / אדר ב' במעוברת),
// number = מספר החודש של hebcal (אדר א' ואדר = 12, אדר ב' = 13), max = ימים מקסימליים, spellings = כל האיותים שאפשר למצוא בטקסט שמור
// (הראשון = האיות שהאתר עצמו כותב, lib/hebrewDate.js:11-25), aliases = כל מה שמזהים בשאילתה (בלי גרשיים - ראו monthNorm).
export const HEBREW_MONTH_TABLE = Object.freeze([
  { name: 'Nisan', number: 1, he: 'ניסן', max: 30, spellings: ['ניסן'], aliases: ['ניסן'] },
  { name: 'Iyyar', number: 2, he: 'אייר', max: 29, spellings: ['אייר', 'איר'], aliases: ['אייר', 'איר'] },
  { name: 'Sivan', number: 3, he: 'סיוון', max: 30, spellings: ['סיוון', 'סיון'], aliases: ['סיוון', 'סיון'] },
  { name: 'Tamuz', number: 4, he: 'תמוז', max: 29, spellings: ['תמוז'], aliases: ['תמוז'] },
  { name: 'Av', number: 5, he: 'אב', max: 30, spellings: ['אב', 'מנחם אב'], aliases: ['אב', 'מנחם אב'] },
  { name: 'Elul', number: 6, he: 'אלול', max: 29, spellings: ['אלול'], aliases: ['אלול'] },
  { name: 'Tishrei', number: 7, he: 'תשרי', max: 30, spellings: ['תשרי'], aliases: ['תשרי'] },
  { name: 'Cheshvan', number: 8, he: 'חשוון', max: 30, spellings: ['חשוון', 'חשון', 'מרחשוון', 'מרחשון'], aliases: ['חשוון', 'חשון', 'מרחשוון', 'מרחשון', 'מר חשוון', 'מר חשון'] },
  { name: 'Kislev', number: 9, he: 'כסלו', max: 30, spellings: ['כסלו', 'כסליו'], aliases: ['כסלו', 'כסליו'] },
  { name: 'Tevet', number: 10, he: 'טבת', max: 29, spellings: ['טבת'], aliases: ['טבת'] },
  { name: 'Shvat', number: 11, he: 'שבט', max: 30, spellings: ['שבט'], aliases: ['שבט'] },
  { name: 'Adar', number: 12, he: 'אדר', max: 29, spellings: ['אדר'], aliases: ['אדר'] },
  { name: 'Adar I', number: 12, he: "אדר א'", max: 30, spellings: ["אדר א'", 'אדר א', 'אדר ראשון'], aliases: ['אדר א', 'אדר ראשון'] },
  { name: 'Adar II', number: 13, he: "אדר ב'", max: 29, spellings: ["אדר ב'", 'אדר ב', 'אדר שני'], aliases: ['אדר ב', 'אדר שני'] },
]);

const MONTH_BY_ALIAS = new Map();
for (const m of HEBREW_MONTH_TABLE) for (const a of m.aliases) MONTH_BY_ALIAS.set(a, m);
const MONTH_BY_NAME = new Map(HEBREW_MONTH_TABLE.map((m) => [m.name, m]));
// חודשים שהם גם מילים רגילות בעברית ("אב" = father, "איר") או שמות פרטיים נפוצים ("ניסן") - בלי יום/שנה/קידומת לא מתייחסים אליהם כתאריך
const WORD_MONTHS = new Set(['Av', 'Iyyar']);
const NAME_MONTHS = new Set(['Nisan']);

// שם חודש מוקלד -> רשומת חודש: בלי גרשיים ומקפים ("אדר ב'" = "אדר ב", "מנחם-אב" = "מנחם אב")
function monthNorm(s) {
  return s.replace(/["'׳״]/g, '').replace(/[-\s]+/g, ' ').trim();
}

/** רשומת חודש מתוך שם (עברית, כל האיותים; או השם הקנוני באנגלית 'Cheshvan'); null אם לא מוכר. */
export function hebrewMonthFromName(raw) {
  const s = cleanQuery(raw);
  if (!s) return null;
  return MONTH_BY_ALIAS.get(monthNorm(s)) || MONTH_BY_NAME.get(s) || null;
}

const LETTER_VALUES = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90, ק: 100, ר: 200, ש: 300, ת: 400 };

// מספר 1-999 באותיות עבריות, כתיב רגיל (טו/טז במקום יה/יו): 27 -> 'כז', 15 -> 'טו', 787 -> 'תשפז'
function hebrewLetters(n) {
  let s = '';
  for (const [v, l] of [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק']]) while (n >= v) { s += l; n -= v; }
  if (n === 15) return s + 'טו';
  if (n === 16) return s + 'טז';
  for (const [v, l] of [[90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י']]) if (n >= v) { s += l; n -= v; break; }
  return s + ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'][n];
}

// צורה עם גרש/גרשיים: 'ב' -> "ב'", 'כז' -> 'כ"ז'
function withQuotes(letters) {
  return letters.length === 1 ? `${letters}'` : `${letters.slice(0, -1)}"${letters.slice(-1)}`;
}

/** יום בחודש עברי מתוך אסימון: ספרות 1-30 או אותיות (כז, כ"ז, ט"ו, טו, ב, ב'); null אם אינו יום תקין. אותיות חייבות להיות מספר עברי תקין (לא "אב"/"כל"/"דן"). */
export function parseHebrewDayToken(tok) {
  const t = cleanQuery(tok).replace(/["'׳״]/g, '');
  if (!t) return null;
  if (/^\d{1,2}$/.test(t)) {
    const n = Number(t);
    return n >= 1 && n <= 30 ? n : null;
  }
  let sum = 0;
  for (const ch of t) {
    const v = LETTER_VALUES[ch];
    if (!v || v > 30) return null;
    sum += v;
  }
  if (sum < 1 || sum > 30) return null;
  const canon = hebrewLetters(sum);
  return t === canon || (sum === 15 && t === 'יה') || (sum === 16 && t === 'יו') ? sum : null;
}

/** שנה עברית מתוך אסימון: תשפ"ז / תשפז / ה'תשפ"ז / 5787 -> 5787; null אם אינו שנה (טווח 5740-5899; "תשרי" כאותיות = 5910 לא שנה). */
export function parseHebrewYearToken(tok) {
  const t = cleanQuery(tok).replace(/["'׳״]/g, '');
  if (/^5\d{3}$/.test(t)) {
    const n = Number(t);
    return n >= 5740 && n <= 5899 ? n : null;
  }
  const m = /^ה?(ת[א-ת]{1,3})$/.exec(t);
  if (!m) return null;
  let sum = 0;
  for (const ch of m[1]) {
    const v = LETTER_VALUES[ch];
    if (!v) return null;
    sum += v;
  }
  const y = 5000 + sum;
  return y >= 5740 && y <= 5899 && hebrewLetters(sum) === m[1] ? y : null;
}

// איותי שנה שמורים: עם גרשיים לפני האות האחרונה (כך האתר כותב) ובלי
function yearForms(year) {
  const l = hebrewLetters(year - 5000);
  return [`${l.slice(0, -1)}"${l.slice(-1)}`, l];
}

// ניתוח "[ב] חודש [שנה]" שכולו מהאסימונים הנתונים; מחזיר { month, prefixed, year } או null. prefixed = ב צמודה / "ב-" / "חודש" לפני.
function parseMonthTail(toks, { allowLoneB }) {
  let i = 0;
  let prefixed = false;
  if (toks[i] === 'חודש') { prefixed = true; i++; }
  else if (allowLoneB && toks[i] === 'ב' && toks.length > i + 1) { prefixed = true; i++; }
  const find = (n) => {
    const raw = toks.slice(i, i + n).join(' ');
    if (!raw) return null;
    const direct = MONTH_BY_ALIAS.get(monthNorm(raw));
    if (direct) return { month: direct, pre: false };
    const m = /^ב-?(.+)$/.exec(raw); // בחשוון / ב-חשוון / בתשרי (ב צמודה, רק לפני האסימון הראשון של החודש)
    const stripped = m && MONTH_BY_ALIAS.get(monthNorm(m[1]));
    return stripped ? { month: stripped, pre: true } : null;
  };
  let hit = null; let used = 0;
  for (const n of [2, 1]) { hit = find(n); if (hit) { used = n; break; } }
  if (!hit) return null;
  i += used;
  let year = null;
  if (i < toks.length) {
    if (i !== toks.length - 1) return null;
    year = parseHebrewYearToken(toks[i]);
    if (!year) return null;
  }
  return { month: hit.month, prefixed: prefixed || hit.pre, year };
}

/**
 * מפרק תאריך עברי מוקלד: "כז תשרי", "כ״ז תשרי תשפ״ז", "ט״ו בשבט", "27 תשרי", "ב חשוון" (יום 2!), "ב-חשוון"/"בחשוון"/"חודש חשוון" (חודש בלבד), "אדר ב".
 * כל איותי החודש (חשוון/חשון/מרחשוון/מרחשון, כסלו/כסליו, סיוון/סיון, אייר/איר, אב/מנחם אב, אדר/אדר א/אדר ב/אדר ראשון/שני).
 * השאילתה כולה חייבת להיות תאריך (אסימונים עודפים -> null). "אב" ו"איר" לבדם (בלי יום/שנה/קידומת) לא תאריך כי הן מילים רגילות.
 *
 * מחזיר null או:
 *  { day: number|null, month: number (מספר hebcal), monthKey: 'Cheshvan'|'Adar I'|..., monthHe, year: number|null (5787),
 *    monthOnly: boolean (בלי יום),
 *    ambiguousB: boolean ("ב חשוון": יכול להיות יום 2, או "בחשוון" = חודש בלבד - הקורא יכול לחפש גם monthOnly; ברירת מחדל = יום 2 לפי הבעלים),
 *    bareMonthName: boolean (חודש לבדו בלי קידומת ובלי שנה - ייתכן שם פרטי כמו "ניסן"; classifyQuery מדרג אותו אחרי text),
 *    monthSpellings: string[], daySpellings: string[], yearSpellings: string[],
 *    spellingsToMatch: string[] - הצורות המלאות של הטקסט השמור, "יום חודש[ שנה]", להתאמה כאסימונים שלמים: שווה לאחת מהן או מתחיל בה + רווח
 *       (hebrewDateSqlParts); כך "ב חשוון" לא תואם "כב חשוון". לחודש בלבד: איותי החודש. }
 * אדר לבדו (בלי א/ב) כולל בכוונה גם אדר א' ואדר ב' (האתר כותב "אדר ב'" לפורים בשנה מעוברת) - ראו הערת ambiguity בדוח.
 */
export function parseHebrewDate(input) {
  const q = cleanQuery(input);
  if (!q) return null;
  const toks = q.split(' ');
  let res = null;
  // 1) אסימון ראשון הוא יום
  const day = parseHebrewDayToken(toks[0]);
  if (day !== null) {
    const tail = parseMonthTail(toks.slice(1), { allowLoneB: true });
    if (tail) res = { day, ...tail, dayTok: toks[0] };
  }
  // 2) חודש בלבד (אפשר עם שנה)
  if (!res) {
    const tail = parseMonthTail(toks, { allowLoneB: false });
    if (tail) res = { day: null, ...tail, dayTok: null };
  }
  if (!res) return null;
  const { month, year } = res;
  if (res.day !== null && res.day > month.max) return null; // 30 אייר / 30 טבת לא קיימים
  const monthOnly = res.day === null;
  if (monthOnly && !res.prefixed && !year && (WORD_MONTHS.has(month.name))) return null;
  const letters = res.day !== null ? hebrewLetters(res.day) : null;
  const daySpellings = letters ? [...new Set([letters, withQuotes(letters)])] : [];
  const yearSpellings = year ? yearForms(year) : [];
  // 'אדר' בלי א/ב: כל משפחת האדרים
  const monthSpellings = month.name === 'Adar'
    ? [...new Set([...MONTH_BY_NAME.get('Adar').spellings, ...MONTH_BY_NAME.get('Adar I').spellings, ...MONTH_BY_NAME.get('Adar II').spellings])]
    : month.spellings.slice();
  let spellingsToMatch;
  if (monthOnly) spellingsToMatch = monthSpellings.slice();
  else {
    spellingsToMatch = [];
    for (const d of daySpellings) for (const m of monthSpellings) {
      if (year) for (const y of yearSpellings) spellingsToMatch.push(`${d} ${m} ${y}`);
      else spellingsToMatch.push(`${d} ${m}`);
    }
  }
  const ambiguousB = res.day === 2 && /^ב['׳]?$/.test(res.dayTok);
  return {
    day: res.day, month: month.number, monthKey: month.name, monthHe: month.he, year,
    monthOnly, ambiguousB,
    bareMonthName: monthOnly && !res.prefixed && !year,
    monthSpellings, daySpellings, yearSpellings, spellingsToMatch,
  };
}

/**
 * "יום חודש" שנראה כמו תאריך עברי אבל היום לא קיים בחודש ("ל אדר" - באדר 29 ימים, "ל אייר"): parseHebrewDate מחזיר לו null, וכך הוא היה נבלע כטקסט שם.
 * משמש להצגת "התאריך לא קיים בחודש הזה" במקום להתעלם. אדר א' (30) תקין ולכן אינו נכלל.
 */
export function isImpossibleHebrewDate(input) {
  const q = cleanQuery(input);
  if (!q || parseHebrewDate(q)) return false;
  const toks = q.split(' ');
  const day = parseHebrewDayToken(toks[0]);
  if (day === null) return false;
  const tail = parseMonthTail(toks.slice(1), { allowLoneB: true });
  return !!(tail && day > tail.month.max);
}

// צורה קנונית להשוואה של טקסט תאריך עברי שמור: בלי גרשיים/גרש, רווחים וקווים -> רווח אחד
function dateCanon(s) {
  return cleanQuery(s).replace(/["'׳״]/g, '').replace(/[-\s]+/g, ' ').trim();
}

/**
 * האם טקסט תאריך עברי שמור (Order.eventDateHebrew, כמו 'כז תשרי תשפ"ז' או 'יא תשרי תשפז') תואם לתוצאת parseHebrewDate - התאמה לפי אסימונים שלמים,
 * סובלנית לגרשיים/גרש. 'ב חשוון' (יום 2) לא תואם 'כב חשוון' / 'יב חשוון'. חודש בלבד: מופיע כאסימון חודש בכל יום.
 */
export function hebrewDateMatchesStored(stored, parsed) {
  if (!parsed) return false;
  const cs = dateCanon(stored);
  if (!cs) return false;
  const months = parsed.monthSpellings.map(dateCanon);
  if (parsed.monthOnly) {
    const padded = ` ${cs} `;
    return months.some((m) => padded.includes(` ${m} `));
  }
  const days = [hebrewLetters(parsed.day), String(parsed.day)];
  const years = parsed.year ? yearForms(parsed.year).map(dateCanon) : [null];
  for (const d of days) for (const m of months) for (const y of years) {
    const full = y ? `${d} ${m} ${y}` : `${d} ${m}`;
    if (cs === full || cs.startsWith(`${full} `)) return true;
  }
  return false;
}

/**
 * חלקי תנאי ל-SQL/Prisma מתוך parseHebrewDate, בלי LIKE '%..%' (שהיה מתאים 'כב' ל-'ב'):
 *  { equals: string[], startsWith: string[], contains: string[], endsWith: string[] }.
 *  תאריך עם יום: WHERE eventDateHebrew IN equals OR (startsWith לכל אחד מ-startsWith) - הצורות 'יום חודש' ו'יום חודש ' (עם רווח, לפני השנה).
 *  חודש בלבד: contains ' חודש ' או endsWith ' חודש'.
 * (איות שמור שאינו ברשימה, למשל גרש אחר או שנה בכתיב אחר לגמרי, לא ייתפס - לכן hebrewDateMatchesStored מתירה גרשיים; ל-DB מומלץ לאמת מול דגימה.)
 */
export function hebrewDateSqlParts(parsed) {
  if (!parsed) return { equals: [], startsWith: [], contains: [], endsWith: [] };
  if (parsed.monthOnly) {
    return { equals: [], startsWith: [], contains: parsed.monthSpellings.map((m) => ` ${m} `), endsWith: parsed.monthSpellings.map((m) => ` ${m}`) };
  }
  const eq = parsed.spellingsToMatch;
  return { equals: eq.slice(), startsWith: eq.map((s) => `${s} `), contains: [], endsWith: [] };
}

// ===========================================================================================================================
// 7. מילות מפתח
// ===========================================================================================================================

/**
 * מקור אחד לאמת לרשימת "מה אפשר להקליד" (מדריך הקידומת '%' בעתיד) ולמנתח parseKeywords.
 *  id: מזהה; label: התווית בעברית; example: דוגמת הקלדה; hint: הסבר קצר; insert: מה להכניס לשורה בלחיצה על השורה במדריך ('' = אין מילה להכניס, רק לדוגמה);
 *  keyword: true = יש מילת מפתח (labels) שהמנתח מזהה; free: true = אפשר גם בלי מילה (מזהים לפי צורה: classifyQuery); labels = המילים שהמנתח מזהה.
 */
export const KEYWORD_GUIDE = Object.freeze([
  Object.freeze({ id: 'size', label: 'מידה', example: 'מידה 2', hint: 'מידה מדויקת: "2" ו-"02" זהות, ו-"2" לא מוצאת 12 או 20', insert: 'מידה ', keyword: true, free: false, labels: Object.freeze(['מידה', 'מדה']) }),
  Object.freeze({ id: 'model', label: 'דגם', example: 'דגם 3', hint: 'מספר דגם (קידומת ברקוד) או חלק משם הדגם; אפשר לשלב: "מידה 2 דגם 3"', insert: 'דגם ', keyword: true, free: false, labels: Object.freeze(['דגם']) }),
  Object.freeze({ id: 'multiModel', label: 'כמה דגמים', example: 'דגם 511,455', hint: 'מפרידים: פסיק, / , + או "ו" צמודה למספר ("דגם 511 ו455"); עד 10 דגמים', insert: '', keyword: false, free: false, labels: Object.freeze([]) }),
  Object.freeze({ id: 'multiSize', label: 'כמה מידות', example: 'מידה 4,6', hint: 'אותם מפרידים ("מידה 4 ו6"); עד 10 מידות, והזמינות לכל מידה', insert: '', keyword: false, free: false, labels: Object.freeze([]) }),
  Object.freeze({ id: 'hebrewDate', label: 'תאריך עברי', example: 'כז תשרי', hint: 'יום וחודש בעברית, בכל איות ("ב חשוון", "ט״ו בשבט"); אפשר להוסיף שנה או את המילה "תאריך"', insert: '', keyword: false, free: true, labels: Object.freeze([]) }),
  Object.freeze({ id: 'combo', label: 'מלאי ליום מסוים', example: 'מידה 4 דגם 511 כ חשוון', hint: 'מידה + דגם + תאריך עברי = הזמינות ביום הקרוב שבו חל התאריך', insert: '', keyword: false, free: false, labels: Object.freeze([]) }),
  Object.freeze({ id: 'barcode', label: 'ברקוד', example: '6323401', hint: 'ברקוד = 7 ספרות (דגם 632, מידה 34, סידורי 01)', insert: 'ברקוד ', keyword: true, free: true, labels: Object.freeze(['ברקוד']) }),
  Object.freeze({ id: 'orderNumber', label: 'מספר הזמנה', example: '25734', hint: 'מספר הזמנה; בלי מילה: עד 4 ספרות = הזמנה, 5-6 ספרות = הזמנה קודם ואחר כך ברקוד', insert: 'הזמנה ', keyword: true, free: true, labels: Object.freeze(['הזמנה']) }),
  Object.freeze({ id: 'phone', label: 'טלפון', example: '050-1234567', hint: 'טלפון בכל צורה: 0501234567, 050-123-4567, +972501234567', insert: 'טלפון ', keyword: true, free: true, labels: Object.freeze(['טלפון', 'נייד']) }),
]);

const KEYWORD_DEFS = KEYWORD_GUIDE.filter((k) => k.keyword);
const KEYWORD_BY_LABEL = new Map();
for (const k of KEYWORD_DEFS) for (const l of k.labels) KEYWORD_BY_LABEL.set(l, k.id);

// "מספר הזמנה" / "מס' הזמנה" / "מס הזמנה" -> "הזמנה" (מילת המפתח היא האסימון האחרון)
const ORDER_PHRASE_RE = /(^|\s)(?:מספר|מס'?)\s+הזמנה(?=\s|$)/g;

const LATIN_SIZE_RE = /^(?:[2-4]?XS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-4]XL)$/i;
// ערך מידה תקף: מספר (1-3 ספרות, אפשר ".5"), טווח (38-40), מספר+אות עברית (36א), מידות אותיות לטיניות, "כללי"
function isSizeValueToken(t) {
  return /^\d{1,3}(?:\.\d{1,2})?[א-ת]?$/.test(t) || /^\d{1,3}-\d{1,3}$/.test(t) || LATIN_SIZE_RE.test(t) || t === GENERAL_SIZE_KEY;
}

export const KEYWORD_MAX_VALUES = 10; // תקרה לערכים ברשימה ("מידה 4,6,8..." / "דגם 511,455,...")

/**
 * רשימת ערכים אחרי מילת מפתח (מידה / דגם) - רק בתוך הקשר מילת המפתח, לעולם לא בטקסט חופשי / שם:
 *  מפרידים ',' '/' '+' (צמודים לערך או כאסימון בודד), ו-"ו" רק כשהיא צמודה ישירות לספרות ("ו455"). "ו" בודדת או לפני אותיות אינה "וגם"
 *  (שמות כמו ורד / ויקטוריה נשארים בשלום). האסימון הראשון חייב להיות ערך תקף; רשימה מפסיקה באסימון הראשון שאינו חלק ממנה.
 * @returns {{values: string[], end: number}|null} end = אינדקס האסימון האחרון שנצרך
 */
function takeValueList(toks, start, isVal) {
  const values = [];
  let end = start - 1;
  let sepPending = false; // האסימון הקודם הסתיים במפריד / היה מפריד בודד - האסימון הבא יכול להיות ערך גם בלי סימון
  for (let j = start; j < toks.length; j++) {
    let t = toks[j];
    if (values.length) {
      if (/^[,+/]+$/.test(t)) { sepPending = true; continue; }
      const m = /^[,+/]+(.+)$/.exec(t);
      if (m) t = m[1];
      else if (/^ו\d/.test(t)) t = t.slice(1);
      else if (!sepPending) break;
    }
    const parts = t.split(/[,+/]/).filter(Boolean);
    if (!parts.length || !parts.every(isVal)) break;
    values.push(...parts);
    end = j;
    sepPending = /[,+/]$/.test(t);
  }
  return values.length ? { values: values.slice(0, KEYWORD_MAX_VALUES), dropped: values.length > KEYWORD_MAX_VALUES, end } : null;
}

function isKeywordToken(t) {
  return KEYWORD_BY_LABEL.has(t.replace(/:$/, ''));
}

/**
 * מזהה מילות מפתח בכל סדר: "מידה 2", "דגם 3", "מידה 2 דגם 3", "דגם 3 מידה 2 שרה", "ברקוד 6323401", "הזמנה 25734" / "מספר הזמנה 25734", "טלפון 0501234567".
 * מותר ":" אחרי המילה ("מידה: 2") והדבקה ספרתית ("מידה2"). רק מה שבטוח: אין קיצורים כמו "מ' 2" (מתנגש בראשי תיבות של שמות); ערך לא תקין לא נבלע -
 * המילה והערך חוזרים ל-rest. מילת מפתח ללא ערך בסוף השורה = pending (הקלדה באמצע).
 * רשימות: "מידה 4,6" / "מידה 4 ו6" -> sizes ['4','6']; "דגם 511,455" / "דגם 511 ו455" -> models ['511','455'] (עד KEYWORD_MAX_VALUES); size / model = הראשון (תאימות לאחור).
 * @returns {{size: string|null, sizes: string[], sizeKey: string|null, sizeKeys: string[], sizeSpellings: string[], model: string|null, models: string[], modelIsPrefix: boolean, barcode: string|null,
 *            orderNumber: string|null, phone: string|null, rest: string, any: boolean, count: number, pending: string|null}}
 */
export function parseKeywords(input) {
  let q = cleanQuery(input).replace(ORDER_PHRASE_RE, '$1הזמנה');
  q = q.replace(/(^|\s)(מידה|מדה)(?=\d)/g, '$1$2 ').replace(/(^|\s)(דגם|ברקוד|הזמנה|טלפון|נייד)(?=\d)/g, '$1$2 '); // "מידה2" -> "מידה 2"
  const toks = q ? q.split(' ') : [];
  const out = { size: null, sizes: [], model: null, models: [], modelIsPrefix: false, barcode: null, orderNumber: null, phone: null };
  const rest = [];
  const dropped = { sizes: false, models: false }; // ערכים מעבר ל-KEYWORD_MAX_VALUES שנזרקו (הצגת "נלקחו 10 הערכים הראשונים")
  let pending = null;
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i].replace(/:$/, '');
    const id = KEYWORD_BY_LABEL.get(tk);
    if (!id) { rest.push(toks[i]); continue; }
    const taken = (id === 'size' && out.size !== null) || (id === 'model' && out.model !== null) || (id === 'barcode' && out.barcode !== null)
      || (id === 'orderNumber' && out.orderNumber !== null) || (id === 'phone' && out.phone !== null);
    const next = toks[i + 1];
    if (taken || next === undefined) {
      if (!taken && next === undefined) pending = id;
      rest.push(toks[i]);
      continue;
    }
    if (id === 'size') {
      const list = takeValueList(toks, i + 1, isSizeValueToken);
      if (list) { out.size = list.values[0]; out.sizes = list.values; if (list.dropped) dropped.sizes = true; i = list.end; } else rest.push(toks[i]);
    } else if (id === 'model') {
      const list = /^\d/.test(next) ? takeValueList(toks, i + 1, (v) => /^\d{1,6}$/.test(v)) : null;
      if (list) { out.model = list.values[0]; out.models = list.values; out.modelIsPrefix = true; if (list.dropped) dropped.models = true; i = list.end; } else if (!isKeywordToken(next) && /[א-תA-Za-z]/.test(next)) {
        const name = [next];
        let j = i + 2;
        while (j < toks.length && !isKeywordToken(toks[j])) { name.push(toks[j]); j++; }
        out.model = name.join(' ');
        out.models = [out.model];
        i = j - 1;
      } else rest.push(toks[i]);
    } else if (id === 'barcode') {
      if (/^\d{5,12}$/.test(next)) { out.barcode = next; i += 1; } else rest.push(toks[i]);
    } else if (id === 'orderNumber') {
      if (/^\d{1,8}$/.test(next)) { out.orderNumber = next; i += 1; } else rest.push(toks[i]);
    } else if (id === 'phone') {
      const parts = [];
      let j = i + 1;
      while (j < toks.length && /^[+\d()-]+$/.test(toks[j]) && /\d/.test(toks[j])) { parts.push(toks[j]); j++; }
      const joined = parts.join(' ');
      if (parts.length && phoneKey(joined).length >= 3 && phoneKey(joined).length <= 13) { out.phone = joined; i = j - 1; } else rest.push(toks[i]);
    }
  }
  const count = ['size', 'model', 'barcode', 'orderNumber', 'phone'].filter((k) => out[k] !== null).length;
  // "תאריך כ חשוון": המילה "תאריך" לפני תאריך (עברי / לועזי) היא סימון בלבד ולא חלק מטקסט החיפוש
  if (rest[0] === 'תאריך' && rest.length > 1) {
    const tail = rest.slice(1).join(' ');
    if (parseGregorianDate(tail) || parseHebrewDate(tail)) rest.shift();
  }
  return {
    ...out,
    sizeKey: out.size !== null ? sizeKey(out.size) : null,
    sizeSpellings: out.size !== null ? sizeSpellings(out.size) : [],
    sizeKeys: [...new Set(out.sizes.map(sizeKey))],
    valuesDropped: dropped.sizes || dropped.models,
    rest: rest.join(' '),
    any: count > 0,
    count,
    pending,
  };
}

// ===========================================================================================================================
// 8. סיווג שאילתה
// ===========================================================================================================================

/** התווים שמפעילים קידומת בתחילת שורת החיפוש. '%' = רשימת מילות המפתח (ב-QUICK_PREFIXES של lib/quickPrefix.js, מקור 'keywords'). */
export const SHORTCUT_CHARS = Object.freeze(['@', '#', '$', '&', '%']);

function digitsKinds(d) {
  const len = d.length;
  const zero = d[0] === '0';
  if (d.startsWith('00972') && (len === 13 || len === 14)) return { kinds: ['phone'], phone: { key: phoneKey(d), partial: false } }; // 00972501234567
  if (d.startsWith('972') && (len === 11 || len === 12)) return { kinds: ['phone'], phone: { key: phoneKey(d), partial: false } };
  if (zero && len >= 9 && len <= 10) return { kinds: ['phone'], phone: { key: d, partial: false } };
  if (zero && len >= 3 && len < 9) return { kinds: ['phone'], phone: { key: d, partial: true } };
  if (len <= 4) return { kinds: ['orderNumber'], orderNumber: { value: Number(d), leadingZero: false } };
  if (len <= 6) return { kinds: ['orderNumber', 'barcode'], orderNumber: { value: Number(d), leadingZero: false }, barcode: { ...parseBarcodeDigits(d), complete: false } };
  if (len <= 8) return { kinds: ['barcode'], barcode: { ...parseBarcodeDigits(d), complete: len === 7 } };
  return { kinds: ['number'] };
}

/**
 * מסווג מה שהוקלד. מחזיר תמיד { query (מנוקה), kind (הפרשנות הראשונה), kinds (כל הפרשנויות לפי דירוג), ambiguous, ... } ועוד שדות פירוט לפי הסוג:
 *  kind: 'empty' | 'shortcut' {shortcut:{prefix,term}} | 'barcode' {barcode:{digits,prefix,size,serial,sizeKey,legacy,complete}} |
 *        'orderNumber' {orderNumber:{value}} | 'phone' {phone:{key,partial}} | 'date' {date:{calendar:'hebrew'|'gregorian', ...פירוט}} |
 *        'sizeKeyword' | 'modelKeyword' | 'mixedKeyword' {keywords: תוצאת parseKeywords} | 'number' (ספרות שלא נראות כמו כלום) | 'text'.
 * כללי הספרות (החלטת הבעלים 5.10.2026): עד 4 ספרות = מס' הזמנה; 5-6 = ['orderNumber','barcode'] (הזמנה קודם); 7-8 = ברקוד (7 = ברקוד מלא);
 *   9-10 ספרות שמתחילות ב-0, או 972/+972 (11-12 ספרות) = טלפון; מתחיל ב-0 באורך 3-8 = טלפון חלקי (למספרי הזמנה/ברקוד אין 0 מוביל); יתר = 'number'.
 * מילת מפתח מפורשת ("ברקוד 6323401", "הזמנה 25734", "טלפון 050...") בלי עמימות. תאריך עברי: חודש לבדו ("ניסן") = ['text','date'] (עלול להיות שם פרטי);
 * d.m / d-m בלי שנה = ['date','text'] ambiguous (עלול להיות מידה "06.1" / טווח "38-40"). הבדיקה הטבלאית: scripts/test_search_normalize.mjs.
 */
export function classifyQuery(input) {
  const q = cleanQuery(input);
  const base = { query: q };
  if (!q) return { ...base, kind: 'empty', kinds: ['empty'], ambiguous: false };
  const mk = (kinds, extra) => ({ ...base, kind: kinds[0], kinds, ambiguous: kinds.length > 1, ...extra });

  if (SHORTCUT_CHARS.includes(q[0])) return mk(['shortcut'], { shortcut: { prefix: q[0], term: q.slice(1).trim() } });

  const kw = parseKeywords(q);
  if (kw.any) {
    const onlyExplicit = kw.count === 1 && !kw.rest;
    if (onlyExplicit && kw.barcode !== null) return mk(['barcode'], { keywords: kw, explicit: true, barcode: { ...parseBarcodeDigits(kw.barcode), complete: kw.barcode.length === 7 } });
    if (onlyExplicit && kw.orderNumber !== null) return mk(['orderNumber'], { keywords: kw, explicit: true, orderNumber: { value: Number(kw.orderNumber), leadingZero: false } });
    if (onlyExplicit && kw.phone !== null) return mk(['phone'], { keywords: kw, explicit: true, phone: { key: phoneKey(kw.phone), partial: phoneKey(kw.phone).length < 9 } });
    if (onlyExplicit && kw.size !== null) return mk(['sizeKeyword'], { keywords: kw });
    if (onlyExplicit && kw.model !== null) return mk(['modelKeyword'], { keywords: kw });
    return mk(['mixedKeyword'], { keywords: kw });
  }

  // "תאריך כ חשוון" / "תאריך 5/10" בלי מילת מפתח אחרת: המילה "תאריך" היא סימון בלבד
  const dq = /^תאריך\s+(.+)$/.exec(q);
  const qd = dq && (parseGregorianDate(dq[1]) || parseHebrewDate(dq[1])) ? dq[1] : q;
  const g = parseGregorianDate(qd);
  if (g) return mk(g.ambiguous ? ['date', 'text'] : ['date'], { date: { calendar: 'gregorian', ...g } });

  if (/^\d+$/.test(q)) {
    const d = digitsKinds(q);
    const { kinds, ...rest } = d;
    if (rest.orderNumber) rest.orderNumber.leadingZero = q.length > 1 && q[0] === '0';
    return mk(kinds, rest);
  }

  if (/^\+?[\d\s().-]+$/.test(q) && /\d/.test(q)) {
    const key = phoneKey(q);
    const hadPlus = q[0] === '+';
    if (key.startsWith('0') && key.length >= 3 && key.length <= 10) return mk(['phone'], { phone: { key, partial: key.length < 9 } });
    if (hadPlus) return mk(['phone'], { phone: { key, partial: false } });
    return mk(['number'], {});
  }

  const hd = parseHebrewDate(qd);
  if (hd) {
    const dateInfo = { calendar: 'hebrew', ...hd };
    return mk(hd.bareMonthName && NAME_MONTHS.has(hd.monthKey) ? ['text', 'date'] : hd.bareMonthName ? ['date', 'text'] : ['date'], { date: dateInfo });
  }
  return mk(['text'], {});
}

// ===========================================================================================================================
// 9. הדגשת התאמה
// ===========================================================================================================================

/**
 * [לפני, התאמה, אחרי] להדגשת מה שהוקלד - עוטף את splitMatch (lib/quickPrefix.js) אבל מתעלם מהבדלי אותיות סופיות/גרשיים/רישיות (אברהמ מדגיש אברהם).
 * החיתוך נעשה על המחרוזת המקורית (הגימור שומר אורך), כך שהטקסט המוצג לא משתנה.
 */
export function matchHighlight(text, query) {
  const s = String(text == null ? '' : text);
  const t = cleanQuery(query);
  const [before, hit] = splitMatch(foldKeepLength(s), foldKeepLength(t));
  if (!hit) return [s, '', ''];
  return [s.slice(0, before.length), s.slice(before.length, before.length + hit.length), s.slice(before.length + hit.length)];
}
