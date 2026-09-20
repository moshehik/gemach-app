// lib/ai/aiCommon.js - לוגיקה משותפת לכל סוכני ה-AI באתר (צ'אט ראשי, חיפוש חכם,
// סטטיסטיקה, דוחות, יומן שינויים, מחולל SQL).
//
// למה קיים: בדיקת אמינות (2026-09-20, docs/ai-agents-reliability-2026-09-20.md) הראתה
// שהסוכנים טועים באותן שגיאות בכל נתיב בנפרד - ספירות שגויות בגלל NOT IN על שדה ריק,
// תאריכים עבריים/לועזיים שהמודל "מחשב בראש", שעה ותאריך "היום" לפי UTC, חיפוש שם בסדר
// אחד בלבד, SQL גולמי שמוצג למשתמשת וקישורי הורדה מומצאים. במקום לסמוך על כך שהמודל
// יציית לפרומפט, התיקונים כאן הם בקוד: הם רצים על ה-SQL שהמודל יצר ועל הטקסט שהוא החזיר.

import fs from 'fs';
import path from 'path';
import { HDate } from '@hebcal/core';
import {
  HEBREW_DAYS,
  getHebrewMonthName,
  getHebrewYearString,
  getHebrewYearContext,
  getIsraelTodayDate,
  getIsraelDayRange,
} from '../hebrewDate';

// ---------------------------------------------------------------------------
// 1. "עכשיו" בזמן ישראל - מקור אמת יחיד שמוזרק לפרומפט
// ---------------------------------------------------------------------------

const WEEKDAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

function pad2(n) { return String(n).padStart(2, '0'); }

function hebrewLabel(hd) {
  const raw = HEBREW_DAYS[hd.getDate()];
  const day = raw.length === 1 ? `${raw}'` : `${raw.slice(0, -1)}"${raw.slice(-1)}`;
  const month = getHebrewMonthName(hd.getMonth(), hd.isLeapYear());
  return `${day} ב${month} ${getHebrewYearString(hd.getFullYear())}`;
}

export function getIsraelNow(now = new Date()) {
  const local = getIsraelTodayDate(now); // חצות מקומי של היום הישראלי
  const iso = `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())}`;
  const dmy = `${pad2(local.getDate())}/${pad2(local.getMonth() + 1)}/${local.getFullYear()}`;
  const hd = new HDate(local);
  const time = now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });
  return {
    iso,
    dmy,
    weekday: WEEKDAYS[local.getDay()],
    hebrew: hebrewLabel(hd),
    hdate: hd,
    time,
    localDate: local,
  };
}

// בלוק ההקשר התאריכי לכל פרומפט. כולל מיפוי חודשים עבריים לשנה הנוכחית ולבאה.
export function buildDateContext(now = new Date()) {
  const t = getIsraelNow(now);
  return `
CRITICAL DATE CONTEXT (computed by the server in Israel time - authoritative, you have no other clock):
Today is ${t.weekday}, ${t.hebrew} = ${t.dmy} (ISO ${t.iso}). The current time in Israel is ${t.time}.
- If the user asks for today's date or the current time, answer with EXACTLY these values. Never invent a time.
- NEVER convert between Hebrew and Gregorian dates yourself. When you mention a date, copy BOTH the Hebrew and the Gregorian form from the database results, from the mapping below, or from this block - never compute one from the other in your head.
- For "this month / next month / this Hebrew year / next year" use the mapping below (Hebrew year of today is ${t.hdate.getFullYear()}; the following year is also listed).
${getHebrewYearContext(now, 1)}`;
}

// ---------------------------------------------------------------------------
// 2. סכימה מלאה (נטענת פעם אחת) - לכל הסוכנים שכותבים SQL
// ---------------------------------------------------------------------------

let cachedSchema = null;
export function getFullSchemaContext() {
  if (cachedSchema) return cachedSchema;
  try {
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    const fullSchema = fs.readFileSync(schemaPath, 'utf8');
    const cleanSchema = fullSchema.replace(/\/\/.*/g, '').replace(/\n\s*\n/g, '\n').trim();
    cachedSchema = `Here is the FULL PostgreSQL database schema for the system:\n\n${cleanSchema}`;
    return cachedSchema;
  } catch (e) {
    console.error('Error reading schema', e);
    return 'Error reading schema.';
  }
}

// ---------------------------------------------------------------------------
// 3. כללים משותפים לפרומפטים של סוכני ה-SQL (צ'אט + סטטיסטיקה)
// ---------------------------------------------------------------------------

export function buildSharedSqlRules({ draftStatus, reservedStatus }) {
  return `
SHARED DATA-ACCURACY RULES (these override any conflicting rule above):
S1. NULL-SAFE STATUS FILTER: "Order"."status" is NULL for a large share of real orders - nearly all recent ones, and ~99% of all orders in some gemachs (the real status is derived elsewhere). NEVER write "status" NOT IN (...) or "status" <> '...' - they silently drop every NULL row and make counts wrong by orders of magnitude. To exclude placeholders write exactly: COALESCE("status", '') NOT IN ('${draftStatus}', '${reservedStatus}').
S2. HEBREW DATE TEXT: the column "eventDateHebrew" stores day letters WITHOUT quote marks and the year in inconsistent forms, e.g. 'יא תשרי תשפז' or 'יא תשרי תשפ"ז'. NEVER filter by "eventDateHebrew" LIKE '%י"א תשרי%' (with a gershayim) - it matches nothing. To filter by a Hebrew date use the date column: "eventDate" = HEBREW_DATE(11, 'TISHREI', 5787). To filter a WHOLE Hebrew month use "eventDate" >= HEBREW_MONTH_START('ELUL', 5786) AND "eventDate" <= HEBREW_MONTH_END('ELUL', 5786) (the system replaces these macros with exact dates; month names: NISAN, IYYAR, SIVAN, TAMUZ, AV, ELUL, TISHREI, CHESHVAN, KISLEV, TEVET, SHVAT, ADAR_I, ADAR_II). Never guess the first/last Gregorian day of a Hebrew month. Only display "eventDateHebrew" in results, do not filter by it.
S3. DATE COLUMNS: compare date columns ("eventDate", "returnDate", "orderDate", "fromDate", "toDate", "takenDate") only against plain 'YYYY-MM-DD' literals or the macros above - the system converts them to Israeli calendar days.
S4. CUSTOMER NAME SEARCH: "Customer" has "firstName" and "lastName". The user may type the name in EITHER order ("אמיתי נויאל" can be first name נויאל + last name אמיתי), with typos or with "ע"ש". Split the typed name into words and require every word to match "firstName" OR "lastName" (ILIKE '%word%'), e.g. (C."firstName" ILIKE '%אמיתי%' OR C."lastName" ILIKE '%אמיתי%') AND (C."firstName" ILIKE '%נויאל%' OR C."lastName" ILIKE '%נויאל%'). Never match a full name against one column.
S5. DELIVERY: an order that ordered delivery has "Order"."isDelivery" = true (with "deliveryCity"/"deliveryDirection"). Words like "משלוח" inside "notes" are not a delivery order. "orders that ordered delivery" means "isDelivery" = true.
S6. "TODAY" QUESTIONS: orders MADE/CREATED today -> "orderDate" = today's date. Events happening today -> "eventDate" = today. Items/orders that should come back ("צריכות לחזור") -> "OrderItem"."isTaken" = true AND "OrderItem"."isReturned" = false whose order's "eventDate" (Israeli day) is within the LAST 7 DAYS up to and including today (list them, newest event first). Older taken-but-never-marked-returned items are stale legacy flags, NOT things that "should return today": do not list them, only mention their count in one sentence ("ועוד N פריטים ישנים יותר שלא סומנו כמוחזרים - כנראה נתון לא מעודכן") when it is > 0.
S7. NO FILES, NO LINKS: you cannot create Excel/PDF/CSV files or download links. NEVER write a link or file name. When the user asks for a list, the system shows the rows in a table below your answer (with a download button) - so just introduce it briefly and mention how many rows there are.
S8. NEVER show SQL, table names or column names to the user, NEVER ask permission to run a query ("האם תרצה שאריץ...") - just run it. If the result is empty say exactly what was searched and that no matching records exist in the database; do not invent reasons.
S9. LISTS: when the user asks to "show/list" records, select readable columns (order number, customer name, dates, amount) plus a row per record - not only counts.
S10. PLAIN TEXT: no markdown (no asterisks, no bullets with *). Use plain sentences or lines starting with "- ".
S11. "THIS MONTH" / "החודש": unless the user names a Gregorian month, it means the CURRENT HEBREW MONTH (see the calendar mapping): use HEBREW_MONTH_START/HEBREW_MONTH_END for that month and quote its Hebrew name.
S12. MODEL NUMBER AND SIZE: to filter by dress model number N use "OrderItem"."barcodePrefix" = N directly - do NOT join "DressModel" by name (the model row may be missing or named differently). Sizes: two-digit sizes are used AS IS ('68' stays '68'); only a single digit gets a leading zero ('8' -> '08'). Use "OrderItem"."sizeText" for a rental's size. NEVER reach the model number through "DressItem" (JOIN "DressItem" ON "OrderItem"."dressItemId" = ...): more than half of the historical "OrderItem" rows have NULL "dressItemId", so that join silently drops them and under-counts rentals of a model by ~half. Count rentals per model with "OrderItem"."barcodePrefix" alone.
S13. The WHERE clause you write IS the user's filter: every row the database returns matches the request. If rows come back, never say nothing was found.
S14. HEBREW DATES IN THE USER'S MESSAGE: if a "HEBREW DATES WRITTEN IN THE USER'S MESSAGE" block is present below, use exactly those resolved dates.
S15. COUNTING: when you join "OrderItem" (one row per dress) and the user asks how many ORDERS/families, count COUNT(DISTINCT "Order"."orderId") / COUNT(DISTINCT "Order"."customerId") - never COUNT(*) of item rows. And when the question is ONLY about orders (how many orders in a month/day, by customer, etc.), count from "Order" alone WITHOUT joining "OrderItem": an inner join drops orders that have no item rows (e.g. 178 instead of 184 for a month). Join "OrderItem" only when the filter or the answer needs dress data. List queries should also return one row per order (GROUP BY orderId) unless the user asks about the dresses themselves.`;
}

// ---------------------------------------------------------------------------
// 4. נרמול SQL שנוצר ע"י המודל (רץ אחרי processHebrewDateMacro)
// ---------------------------------------------------------------------------

const DATE_COLS = 'eventDate|returnDate|orderDate|fromDate|toDate|paymentDate|takenDate';
// קידומת טבלה/כינוי אופציונלית - גם בגרשיים ("O"."eventDate", "Order"."eventDate"), אחרת ההמרה נשברת
const COL = `((?:(?:[A-Za-z_]\\w*|"[^"]+")\\.)?"(?:${DATE_COLS})")`;
const OP = '(>=|<=|<>|!=|=|>|<)';
const D = `'(\\d{4}-\\d{2}-\\d{2})'(?:::date)?`;
const IL = (col) => `(${col} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jerusalem')::date`;

// תאריכי אירוע נשמרים ב-Postgres כחצות ישראל (21:00/22:00 UTC של היום הקודם) ולעיתים כחצות UTC,
// ולכן השוואה ישירה מול 'YYYY-MM-DD' מפספסת הזמנות. ההמרה ליום הקלנדרי הישראלי תופסת את כולן.
// הפונקציה אידמפוטנטית (אחרי ההמרה אין יותר עמודה שצמודה ישירות לאופרטור).
export function normalizeAiSql(sql) {
  if (!sql || typeof sql !== 'string') return sql;
  let out = sql;

  // (א) סטטוס: NOT IN / <> / != על עמודה שרובה NULL מוציא את כל שורות ה-NULL
  out = out.replace(/((?:(?:[A-Za-z_]\w*|"[^"]+")\.)?"status")\s+NOT\s+IN\s*\(/gi, (m, col) => `COALESCE(${col}, '') NOT IN (`);
  out = out.replace(/((?:(?:[A-Za-z_]\w*|"[^"]+")\.)?"status")\s*(<>|!=)\s*'/g, (m, col, op) => `COALESCE(${col}, '') ${op} '`);

  // (ב) תאריכים: DATE(col) / CAST(col AS DATE) מול literal
  out = out.replace(new RegExp(`(?:DATE\\(\\s*${COL}\\s*\\)|CAST\\(\\s*${COL}\\s+AS\\s+DATE\\s*\\))\\s*${OP}\\s*${D}`, 'gi'),
    (m, c1, c2, op, d) => `${IL(c1 || c2)} ${op} '${d}'`);
  // col [::date] OP 'D'
  out = out.replace(new RegExp(`${COL}(?:::date)?\\s*${OP}\\s*${D}`, 'g'),
    (m, col, op, d) => `${IL(col)} ${op} '${d}'`);
  // col [::date] BETWEEN 'A' AND 'B'
  out = out.replace(new RegExp(`${COL}(?:::date)?\\s+BETWEEN\\s+${D}\\s+AND\\s+${D}`, 'gi'),
    (m, col, a, b) => `${IL(col)} BETWEEN '${a}' AND '${b}'`);

  return out;
}

// ---------------------------------------------------------------------------
// 5. ניקוי וכיול של טקסט התשובה שהמודל מחזיר
// ---------------------------------------------------------------------------

const LETTER_VALUES = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90, ק: 100, ר: 200, ש: 300, ת: 400 };
function gematria(str) {
  let sum = 0;
  for (const ch of str) sum += LETTER_VALUES[ch] || 0;
  return sum;
}

// יום בחודש עברי מתוך מילה כמו כו / י"א / ג' - כולל אות שימוש צמודה (בג' = ב + ג', לי"א = ל + י"א).
// מספר עברי תקין: אותיות בסדר לא עולה, סכום 1..30. אם המילה כולה לא תקינה מנסים בלי האות הראשונה.
function parseDayToken(tok) {
  const letters = String(tok).replace(/["'׳״]/g, '');
  const valid = (str) => {
    if (!str) return 0;
    let prev = 999;
    let sum = 0;
    for (const ch of str) {
      const v = LETTER_VALUES[ch];
      if (!v || v > prev) return 0;
      prev = v;
      sum += v;
    }
    return sum >= 1 && sum <= 30 ? sum : 0;
  };
  // אות שימוש (ב/ל/מ...) צמודה מופיעה רק לפני מספר עם גרש/גרשיים; מילה רגילה כמו "כל" לא הופכת ליום
  return valid(letters) || (/["'׳״]/.test(tok) ? valid(letters.slice(1)) : 0) || 0;
}

const MONTH_NAMES = {
  'תשרי': 'Tishrei', 'חשוון': 'Cheshvan', 'חשון': 'Cheshvan', 'מרחשוון': 'Cheshvan', 'כסלו': 'Kislev', 'טבת': 'Tevet', 'שבט': 'Shvat',
  'ניסן': 'Nisan', 'אייר': 'Iyyar', 'איר': 'Iyyar', 'סיוון': 'Sivan', 'סיון': 'Sivan', 'תמוז': 'Tamuz', 'אב': 'Av', 'אלול': 'Elul',
};
const MONTH_ALT = Object.keys(MONTH_NAMES).sort((a, b) => b.length - a.length).join('|');
// יום עברי + חודש (עם ב' צמודה) + שנה + תאריך לועזי בסוגריים: 'י"א בתשרי תשפ"ז (22/09/2026)'
const DATE_PAIR_RE = new RegExp(`(?<![א-ת])([א-ת]{1,3}["'׳״]?[א-ת]?["'׳״]?)\\s+ב?(${MONTH_ALT})\\s+(תש[א-ת]["'׳״]?[א-ת]?)\\s*\\((\\d{1,2})/(\\d{1,2})/(\\d{4})\\)`, 'g');

function parseHebrewYear(token) {
  const letters = token.replace(/["'׳״]/g, '');
  const v = gematria(letters);
  return v > 0 ? 5000 + v : null;
}

// מתקן בטקסט התשובה זוגות "תאריך עברי (תאריך לועזי)" שאינם עקביים. בבדיקה התגלו זוגות
// כמו 'י"ז באלול (19/09/2026)' (בפועל ח' בתשרי) שהמודל ממציא. כלל ההכרעה: אם התאריך הלועזי
// הוא "היום" - הוא נכון והעברי מתוקן; אחרת התאריך העברי הוא זה שהמשתמש/המסד סיפקו והלועזי מתוקן.
export function fixDatePairsInText(text, now = new Date()) {
  if (!text || typeof text !== 'string') return text;
  const today = getIsraelNow(now);
  return text.replace(DATE_PAIR_RE, (match, dayTok, monthHe, yearTok, dd, mm, yyyy) => {
    try {
      const day = parseDayToken(dayTok);
      const year = parseHebrewYear(yearTok);
      if (!day || day > 30 || !year) return match;
      const hd = new HDate(day, MONTH_NAMES[monthHe], year);
      const g = hd.greg();
      const gIso = `${g.getFullYear()}-${pad2(g.getMonth() + 1)}-${pad2(g.getDate())}`;
      const claimedIso = `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
      if (gIso === claimedIso) return match; // עקבי
      if (claimedIso === today.iso) {
        return `${hebrewLabel(today.hdate)} (${today.dmy})`;
      }
      return `${dayTok} ב${monthHe} ${yearTok} (${pad2(g.getDate())}/${pad2(g.getMonth() + 1)}/${g.getFullYear()})`;
    } catch (e) {
      return match;
    }
  });
}

// מוריד מהתשובה דברים שלא אמורים להגיע למשתמש: קישורי sandbox/קבצים מומצאים, שורות SQL
// גולמיות, וסימוני markdown (ממשק הצ'אט מציג טקסט פשוט ולכן ** מופיע כמו שהוא).
export function sanitizeAiText(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  out = out.replace(/\[([^\]]*)\]\((?:sandbox|file|attachment):[^)]*\)/gi, '');
  out = out.replace(/(?:sandbox|file):\/[^\s)]*/gi, '');
  out = out.split('\n').filter(line => !/^\s*SQL:\s/i.test(line) && !/^\s*ACTION:\s/i.test(line)).join('\n');
  out = out.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1');
  out = out.replace(/^(\s*)\*\s+/gm, '$1- ');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

// שרשרת הסיום המשותפת לכל תשובת טקסט של סוכן
export function finalizeAiText(text, now = new Date()) {
  return fixDatePairsInText(sanitizeAiText(text), now);
}

// ---------------------------------------------------------------------------
// 6. טווחי זמן ישראליים מוכנים ליומן השינויים ("אתמול", "השבוע האחרון"...)
// ---------------------------------------------------------------------------

export function buildAuditRanges(now = new Date()) {
  const t = getIsraelNow(now);
  const dayIso = (offset) => {
    const d = new Date(t.localDate.getTime());
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const range = (fromOffset, toOffset) => ({
    start: getIsraelDayRange(dayIso(fromOffset)).start.toISOString(),
    end: getIsraelDayRange(dayIso(toOffset)).end.toISOString(),
  });
  const monthFirst = `${t.localDate.getFullYear()}-${pad2(t.localDate.getMonth() + 1)}-01`;
  const prev = new Date(t.localDate.getFullYear(), t.localDate.getMonth() - 1, 1);
  const prevFirst = `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}-01`;
  const prevLast = new Date(t.localDate.getFullYear(), t.localDate.getMonth(), 0);
  const prevLastIso = `${prevLast.getFullYear()}-${pad2(prevLast.getMonth() + 1)}-${pad2(prevLast.getDate())}`;
  return {
    today: range(0, 0),
    yesterday: range(-1, -1),
    last7Days: range(-6, 0),
    last30Days: range(-29, 0),
    thisMonth: { start: getIsraelDayRange(monthFirst).start.toISOString(), end: getIsraelDayRange(t.iso).end.toISOString() },
    lastMonth: { start: getIsraelDayRange(prevFirst).start.toISOString(), end: getIsraelDayRange(prevLastIso).end.toISOString() },
  };
}

// ---------------------------------------------------------------------------
// 7. אימות תגיות [OPEN_SETTING:key] / [OPEN_LINK:route|title] מול הקטלוג
// ---------------------------------------------------------------------------

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// מחזיר את המפתח האמיתי מהקטלוג, או null אם אין התאמה חד-משמעית
export function resolveSettingKey(raw, catalog) {
  const keys = catalog.map(c => c.key);
  if (keys.includes(raw)) return raw;
  const n = norm(raw);
  if (!n) return null;
  const hits = keys.filter(k => norm(k) === n || norm(k).includes(n) || (n.length > 6 && n.includes(norm(k))));
  return hits.length === 1 ? hits[0] : null;
}

// מסיר/מתקן תגיות הגדרה שגויות ומתקן את שם הלשונית בטקסט ("הגדרות מערכת ← X") לפי הקטגוריה האמיתית
export function validateSettingTags(text, catalog) {
  if (!text) return text;
  const seen = [];
  // (קטעי התגיות [OPEN_SETTING:...] עצמם לא נוגעים בהם כאן)
  text = text.split(/(\[OPEN_SETTING:[^\]]+\])/).map((part) => {
    if (part.startsWith('[OPEN_SETTING:')) return part;
    return part.replace(/\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g, (tok) => {
      const key = resolveSettingKey(tok, catalog);
      if (!key) return tok;
      if (!seen.includes(key)) seen.push(key);
      const entry = catalog.find(c => c.key === key);
      return (entry && entry.name) || tok;
    });
  }).join('');
  const tagged = [];
  let out = text.replace(/\[OPEN_SETTING:([^\]]+)\]/g, (m, raw) => {
    const key = resolveSettingKey(raw.trim(), catalog);
    if (!key || tagged.includes(key)) return '';
    tagged.push(key);
    if (!seen.includes(key)) seen.push(key);
    return `[OPEN_SETTING:${key}]`;
  });
  if (seen.length > 0) {
    const category = (catalog.find(c => c.key === seen[0]) || {}).category;
    if (category) {
      // גם "הגדרות המערכת ← X" (עם ה' הידיעה) וגם כמה אזכורי מיקום באותה תשובה
      out = out.replace(/(הגדרות\s+(?:ה)?מערכת\s*[←→>\-]+\s*)([^\n.,;:()\[\]]+?)(?=[\s.,;:()\[\]]|$)/g, (m, pre) => `${pre}${category}`);
    }
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function validateLinkTags(text, howToCatalog) {
  if (!text) return text;
  return text.replace(/\[OPEN_LINK:([^|\]]+)\|([^\]]+)\]/g, (m, route, title) => {
    const byRoute = howToCatalog.find(h => h.route === route.trim());
    if (byRoute) return `[OPEN_LINK:${byRoute.route}|${byRoute.title}]`;
    const byTitle = howToCatalog.find(h => h.title === title.trim());
    if (byTitle) return `[OPEN_LINK:${byTitle.route}|${byTitle.title}]`;
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// 8. איתור מזהה עובד + הרשאות (משותף לצ'אט ולסטטיסטיקה)
// ---------------------------------------------------------------------------

export async function loadEmployeeAccess(prisma, cookieStore) {
  const token = cookieStore.get('auth_token');
  let isManager = false;
  let employeeContext = '';
  if (token && token.value) {
    const employee = await prisma.employee.findUnique({ where: { id: token.value } });
    if (employee) {
      if (employee.roleId !== 1 && employee.roleId !== 2) {
        employeeContext = `\nCRITICAL SECURITY RULE: The current user is a standard employee (Role: ${employee.roleId}). Do NOT provide any sensitive financial data (such as total revenues, employee wages, or overall business statistics). Only answer questions related to daily operations like customers, orders, or dress inventory.`;
      } else {
        isManager = true;
        employeeContext = `\nUser Role: Manager/Admin. Full access to all data is permitted.`;
      }
    }
  }
  return { isManager, employeeContext, employeeId: token?.value || null };
}

// ---------------------------------------------------------------------------
// 9. מענה מתוך קטלוג ההגדרות / קטלוג "איך עושים" (משותף לעוזר הסטטיסטיקה)
// ---------------------------------------------------------------------------

export function buildGuideFollowupPrompt({ kind, prompt, catalog, dateContext = '' }) {
  if (kind === 'settings') {
    return `The user asked: "${prompt}".
You determined this question is about a system setting and requested the full settings catalog.
Here is the complete, up-to-date catalog of every configurable system setting in the admin panel ("הגדרות מערכת") - key, Hebrew name, category/tab, location, description, field type, and current value:
${JSON.stringify(catalog)}

Answer the user in Hebrew:
1. Say clearly where the relevant setting is found, copying the EXACT "location" field of that setting from the catalog (e.g. "הגדרות מערכת ← יומן") - never guess or paraphrase the tab name.
2. Briefly explain in plain Hebrew what the setting does and its current value.
3. Do NOT invent a setting key that does not appear in the catalog above. If nothing in the catalog genuinely answers the question, say so honestly instead of guessing.
4. Keep the answer short and conversational. DO NOT use markdown formatting like asterisks (**) for bolding or bullet points.
CRITICAL: If you identified one or more specific setting keys that answer the question (at most 3), end your response with each one on its own new line in this EXACT format: [OPEN_SETTING:the_exact_key]. Use the exact "key" field from the catalog above, never the Hebrew name, and never a key that is not in the catalog. Omit this tag entirely if no specific setting genuinely matches the question.${dateContext}`;
  }
  return `The user asked: "${prompt}".
You determined this is an operational "how do I..." question and requested the how-to catalog.
Here is the complete catalog of common operational actions in the system - key, title, short instructions, and the page route to open:
${JSON.stringify(catalog)}

Answer the user in Hebrew:
1. Explain briefly and clearly, in plain conversational Hebrew, the steps to perform the action, based on the "steps" field.
2. Do NOT invent an action/route that does not appear in the catalog above. If nothing in the catalog genuinely answers the question, say so honestly instead of guessing.
3. Keep the answer short. DO NOT use markdown formatting like asterisks (**) for bolding or bullet points.
CRITICAL: If you identified one or more specific catalog entries that answer the question (at most 2), end your response with each one on its own new line in this EXACT format: [OPEN_LINK:the_exact_route|the_exact_title]. Use the exact "route" and "title" fields from the catalog above, never invented ones. Omit this tag entirely if nothing in the catalog genuinely matches.${dateContext}`;
}

// חילוץ שאילתות SQL מתשובת המודל. בשימוש האמיתי (10.9) המודל כתב הקדמה לפני ה-SQL
// ("אני מתנצל... האם תרצה שאריץ: SQL: SELECT ...") ואז הקוד הישן, שדרש שהתשובה תתחיל ב-"SQL:",
// לא הריץ כלום והציג למשתמשת שאילתה גולמית. כאן מחפשים "SQL:" בכל מקום בתשובה.
export function extractSqlQueries(text) {
  const out = [];
  if (!text) return out;
  const re = /SQL:\s*([\s\S]*?)(?=\n\s*\n|\nSQL:|$)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    let q = m[1].trim();
    q = q.replace(/^```(?:sql)?/i, '').replace(/```$/, '').trim();
    if (q) out.push(q);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 10. תאריכים עבריים שהמשתמשת כתבה בהודעה - מפוענחים בקוד ומוזרקים לפרומפט
// ---------------------------------------------------------------------------

const USER_DATE_RE = new RegExp(`(?<![א-ת])([א-ת]{1,3}["'׳״]?[א-ת]?["'׳״]?)\\s+ב?(${MONTH_ALT})(?:\\s+(תש[א-ת]["'׳״]?[א-ת]?))?(?![א-ת])`, 'g');

// בשימוש האמיתי ה-AI פענח "כו תשרי" כ-06/10 (בפועל 07/10) ו"ג' תשרי" לא נמצא. כאן התאריך מחושב
// בקוד ע"י hebcal. כשלא נכתבה שנה נבחרת השנה שהתאריך שלה הקרוב ביותר להיום (לא בהכרח השנה הנוכחית).
export function buildUserDateHints(text, now = new Date()) {
  if (!text || typeof text !== 'string') return '';
  const today = getIsraelNow(now);
  const curYear = today.hdate.getFullYear();
  const lines = [];
  const seen = new Set();
  let m;
  USER_DATE_RE.lastIndex = 0;
  while ((m = USER_DATE_RE.exec(text)) !== null) {
    const [full, dayTok, monthHe, yearTok] = m;
    const day = parseDayToken(dayTok);
    if (!day || day > 30) continue;
    const monthEn = MONTH_NAMES[monthHe];
    let best = null;
    const years = yearTok ? [parseHebrewYear(yearTok)] : [curYear - 1, curYear, curYear + 1];
    for (const y of years) {
      if (!y) continue;
      try {
        const hd = new HDate(day, monthEn, y);
        const dist = Math.abs(hd.greg().getTime() - today.localDate.getTime());
        if (!best || dist < best.dist) best = { hd, dist, y };
      } catch (e) { /* יום 30 בחודש חסר */ }
    }
    if (!best) continue;
    const g = best.hd.greg();
    const dmy = `${pad2(g.getDate())}/${pad2(g.getMonth() + 1)}/${g.getFullYear()}`;
    const key = `${day}-${monthEn}-${best.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- "${full.trim()}" = ${hebrewLabel(best.hd)} = ${dmy} (${g.getFullYear()}-${pad2(g.getMonth() + 1)}-${pad2(g.getDate())}) -> in SQL write HEBREW_DATE(${day}, '${monthEn.toUpperCase()}', ${best.y})`);
  }
  // חודשים שלמים ("בחודש אלול תשפ"ו", "באלול", "תשרי - חשון - כסלו"): התאריכים הראשון והאחרון מחושבים בקוד.
  // בשימוש האמיתי ה-AI בחר טווח שגוי (24/08-21/09 במקום 14/08-11/09 עבור אלול תשפ"ו).
  const masked = text.replace(USER_DATE_RE, (mm) => ' '.repeat(mm.length));
  const MONTH_ONLY_RE = new RegExp(String.raw`(?<![א-ת])((?:[בלמה]|חודש\s+)?)(${MONTH_ALT})(?:\s+(תש[א-ת]["'׳״]?[א-ת]?))?(?![א-ת])`, 'g');
  while ((m = MONTH_ONLY_RE.exec(masked)) !== null) {
    const [, prefix, monthHe, yearTok] = m;
    // "אב"/"איר" הן גם מילים רגילות (האב) - מחייבים אות שימוש ב/ל/מ או המילה "חודש"
    if ((monthHe === 'אב' || monthHe === 'איר') && !(/^[בלמ]$/.test(prefix) || prefix.startsWith('חודש'))) continue;
    const monthEn = MONTH_NAMES[monthHe];
    const years = yearTok ? [parseHebrewYear(yearTok)] : [curYear - 1, curYear, curYear + 1];
    let best = null;
    for (const y of years) {
      if (!y) continue;
      try {
        const first = new HDate(1, monthEn, y);
        const last = new HDate(first.daysInMonth(), monthEn, y);
        const a = first.greg().getTime();
        const b = last.greg().getTime();
        const t0 = today.localDate.getTime();
        const dist = t0 < a ? a - t0 : (t0 > b ? t0 - b : 0);
        if (!best || dist < best.dist) best = { first, last, dist, y };
      } catch (e) { /* חודש שלא קיים בשנה הזו */ }
    }
    if (!best) continue;
    const key = `month-${monthEn}-${best.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const iso = (hd) => { const g = hd.greg(); return `${g.getFullYear()}-${pad2(g.getMonth() + 1)}-${pad2(g.getDate())}`; };
    const up = monthEn.toUpperCase();
    lines.push(`- month "${monthHe}" ${best.y} = ${iso(best.first)} .. ${iso(best.last)} -> in SQL write "eventDate" >= HEBREW_MONTH_START('${up}', ${best.y}) AND "eventDate" <= HEBREW_MONTH_END('${up}', ${best.y})`);
  }
  if (lines.length === 0) return '';
  return `\nHEBREW DATES WRITTEN IN THE USER'S MESSAGE (resolved by the server with a real Hebrew calendar - authoritative; if the user did not state a year the occurrence nearest to today was chosen). Use exactly these dates, never compute your own:\n${lines.join('\n')}`;
}

// ---------------------------------------------------------------------------
// 11. התאמה בין התשובה לנתונים שחזרו מהמסד
// ---------------------------------------------------------------------------

// ספירת שורות לכל שאילתה - נכנסת לפרומפט כעובדה. בבדיקה המודל כתב "לא נמצאו הזמנות" בזמן
// שהשאילתה החזירה 25 שורות.
export function rowCountFacts(results) {
  return results.map((r, i) => `query ${i + 1}: ${Array.isArray(r) ? r.length : 1} row(s)`).join('; ');
}

export function resultsHaveData(results) {
  return (results || []).some((r) => {
    if (!Array.isArray(r)) return !!r;
    if (r.length > 1) return true;
    if (r.length === 0) return false;
    const vals = Object.entries(r[0]).filter(([k]) => !k.startsWith('_')).map(([, v]) => v);
    return vals.some((v) => {
      if (v === null || v === undefined || v === '') return false;
      if (typeof v === 'number') return v > 0;
      if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) return Number(v) > 0;
      return true;
    });
  });
}

export function answerSaysNone(text) {
  return /(?:^|[\s.,])(?:לא נמצא(?:ו|ה)?|אין (?:כרגע )?(?:הזמנות|נתונים|רשומות|משפחות|תוצאות|שמלות))(?=[\s.,]|$)/.test(text || '');
}

// כשיש טבלה מתחת לתשובה, המודל נוטה לחזור בטקסט על כל שורה. חותכים את הרשימה הארוכה.
export function trimEnumeration(text) {
  if (!text) return text;
  const SUFFIX = 'הרשימה המלאה מוצגת בטבלה מתחת.';
  const finish = (head) => {
    const h = head.trim().replace(/[:\s]+$/, '').replace(/\.+$/, '');
    if (!h) return SUFFIX;
    return /בטבלה/.test(h) ? `${h}.` : `${h}. ${SUFFIX}`;
  };
  const pipeLines = text.split('\n').filter(l => (l.match(/\|/g) || []).length >= 2).length;
  const pipeCount = (text.match(/\s\|\s/g) || []).length;
  // 1. טבלת טקסט עם | (בעדיפות ראשונה: תאים ריקים בטבלה נכתבים לעיתים כ-"-" ומבלבלים את זיהוי הרשימה)
  if (pipeLines >= 3) {
    const lines = text.split('\n');
    const first = lines.findIndex(l => (l.match(/\|/g) || []).length >= 2);
    return finish(lines.slice(0, first).join('\n'));
  }
  if (pipeCount >= 4) {
    const idx = text.search(/\s\|\s/);
    const cut = text.lastIndexOf('. ', idx);
    return finish(cut > 0 ? text.slice(0, cut + 1) : text.slice(0, idx));
  }
  // 2. חזרה על תוויות שורה ("מספר הזמנה: ...") - המודל מעתיק את הטבלה לטקסט
  if ((text.match(/מספר הזמנה/g) || []).length >= 4) {
    const firstLabel = text.indexOf('מספר הזמנה');
    if (firstLabel > 20) return finish(text.slice(0, firstLabel));
  }
  // 3. רשימה בשורה אחת עם " - "
  if ((text.match(/\s-\s(?=\S)/g) || []).length >= 4) {
    return finish(text.slice(0, text.search(/\s-\s(?=\S)/)));
  }
  return text;
}

// ---------------------------------------------------------------------------
// 12. תאריכים בתוצאות השאילתה - מומרים בקוד ל"תאריך עברי (dd/mm/yyyy)" בזמן ישראל
// ---------------------------------------------------------------------------

// המסד מחזיר חותמות זמן כ-ISO ב-UTC ("2026-09-21T21:00:00.000Z" = 22/09 בישראל). בבדיקה המודל קיבל את
// המחרוזות האלה, המיר אותן בראש לעברי/לועזי וטעה ("י"ב בתשרי (2026-09-12)" - בפועל א' בתשרי).
// כאן ההמרה נעשית בקוד, והמודל רק מעתיק.
export function humanizeResultDates(value) {
  if (Array.isArray(value)) return value.map(humanizeResultDates);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = humanizeResultDates(v);
    return out;
  }
  if (typeof value === 'string') {
    let key = null;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      key = value;
    }
    if (key) {
      const [y, mo, d] = key.split('-').map(Number);
      return `${hebrewLabel(new HDate(new Date(y, mo - 1, d)))} (${pad2(d)}/${pad2(mo)}/${y})`;
    }
  }
  return value;
}

// ---------------------------------------------------------------------------
// 13. אימות תגיות בכל תשובה (גם כשהמודל ענה ישירות בלי לעבור דרך קטלוג ההדרכה)
// ---------------------------------------------------------------------------

// המודל לפעמים עונה ישירות (בלי לבקש את הקטלוג) ובכל זאת מוסיף תגית [OPEN_SETTING:...]. בלי אימות, מפתח
// שהמודל המציא היה מגיע לפאנל העריכה. (הערה: BUFFER_DAYS הוא מפתח אמיתי - מראה של inventory_buffer_days
// שנשמרת בסנכרון ב-app/api/settings/route.js - ולכן עובר את האימות כמו שצריך.)
export async function finalizeTagsAndText(text, { isManager, loadSettingsCatalog, loadHowToCatalog, now = new Date() }) {
  let out = text || '';
  if (/\[OPEN_SETTING:/.test(out)) {
    out = isManager
      ? validateSettingTags(out, await loadSettingsCatalog())
      : out.replace(/\[OPEN_SETTING:[^\]]*\]/g, '').trim(); // עובד רגיל לא מקבל פאנל עריכת הגדרות
  }
  if (/\[OPEN_LINK:/.test(out)) out = validateLinkTags(out, await loadHowToCatalog());
  return finalizeAiText(out, now);
}
