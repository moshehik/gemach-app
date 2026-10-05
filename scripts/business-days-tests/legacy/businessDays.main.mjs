// FROZEN COPY of origin/main 00104dc4 lib/businessDays.js (post-#220 state: chol hamoed open, "open" override supported, rollForwardToWorkingDay/rolledSourceRange present) - the "before" oracle for the v2 tests.
// Only the import lines were rewritten; do not edit the logic. Verify with: git show 00104dc4:lib/businessDays.js
// lib/businessDays.js - הכלל האחיד "יום לא עובד" של הגמ"ח + ספירת ימי עסקים לשני הכיוונים.
//
// החלטות הבעלים 1.10.2026 (scratch/schedule-build/DECISIONS-לוז-יומי.md, "החלטות הבעלים
// 1.10.2026" סעיפים 1/3/4 + "ערב חג"): כלל אחד לכל המערכת - משלוחים (lib/deliveries.js),
// החזרה באיחור (lib/lateReturn.js), כרטיס ההזמנה, ולו״ז יומי (שלב 8 ושאר השלבים) - ובנוסף
// רשימת ימים שהבעלים מסמן בניהול היומן. החוזה המלא (מפתח, מבנה JSON, API):
// scratch/schedule-build/CONTRACT-non-working-days.md.
//
// יום לא עובד = שישי | שבת | יום טוב | ערב יום טוב | תאריך ברשימת הבעלים (status "closed"),
// אלא אם הבעלים סימן את היום "open" (override ליום בודד). "יום טוב + ערב יום טוב" הוא בדיוק
// מה ש-isChagDay הקיים (lib/hebrewDate.js) מסמן - HebrewCalendar.calendar({start: day, end: next})
// כולל את שני הקצוות, וזה מכוון: "הגמ"ח לא עובד בערב חג". הבדיקה scripts/business-days-tests
// מוכיחה שוויון מלא בין isHolidayKey לבין isChagDay על כל יום בשנים 2024-2031.
//
// המודול טהור: בלי prisma, בלי settingsCache - רץ גם בדפדפן (RentalReturnModal, /rentals).
// קריאת ההגדרה מהשרת: lib/businessDaysServer.js. כל התאריכים כאן הם מפתחות 'YYYY-MM-DD' של
// היום הקלנדרי בישראל, וחשבון הימים נעשה על המפתח (Date.UTC) - בלי תלות באזור הזמן של
// המכונה (Vercel = UTC; הדפדפן של העובדת = ישראל; הבדיקות רצות גם באזורי זמן שליליים).

import { HebrewCalendar, flags } from '@hebcal/core';
import { getIsraelDateKey, addDaysToDateKey, PRINT_PREP_BUSINESS_DAYS_BEFORE_EVENT } from '@/lib/hebrewDate';

export const NON_WORKING_DAYS_SETTING_KEY = 'non_working_days_extra';

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_MAX_LENGTH = 200;
// מגן מפני לולאה אינסופית אם (בטעות) רצף ארוך מאוד של ימים סומן סגור - אחרי כל כך הרבה
// ימים לא-עובדים רצופים היום הבא נחשב עובד. 400 > שנה שלמה, אז בפועל לא נפגשים בזה.
const MAX_CONSECUTIVE_NON_WORKING = 400;
// תקרה למספר ימי העסקים שסופרים (סקירה, should-fix 2): ההליכה היא יום-יום, וערך ענק בהגדרה
// (למשל delivery_days_before = 100000000 בטעות הקלדה) היה תוקע את השרת לדקות. יותר משנה
// של ימי עסקים אין לו משמעות עסקית, אז מעבר לזה הערך נחתך בשקט.
export const MAX_BUSINESS_DAY_OFFSET = 366;
// תקרה למספר הרשומות שנקראות מההגדרה (רק הנהלה ראשית כותבת אותה, אבל גם טעות שלה לא
// צריכה לעלות שניות בכל בקשה) ולטווח של listNonWorkingDays (לוח של כשנתיים).
export const MAX_SETTING_ENTRIES = 2000;
export const MAX_LIST_RANGE_DAYS = 800;

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

function weekdayOfKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = ראשון ... 5 = שישי, 6 = שבת
}

export function isWeekendKey(key) {
  const w = weekdayOfKey(key);
  return w === 5 || w === 6;
}

// ---------- חגים (לוח ארץ ישראל) ----------

// מטמון לשנה לועזית: Map<key, שם החג בעברית>. אותם דגלים בדיוק כמו isChagDay הקיים
// (il:true, noMinorFast, noRoshChodesh, noModern, רק flags.CHAG = יום טוב; לא חול המועד,
// לא פורים/צומות/ר"ח/חגים לאומיים).
const chagByYear = new Map();
const NIKUD_RE = /[֑-ׇ]/g;

function chagMapForYear(year) {
  let map = chagByYear.get(year);
  if (map) return map;
  map = new Map();
  try {
    const events = HebrewCalendar.calendar({
      year, isHebrewYear: false, il: true,
      noMinorFast: true, noRoshChodesh: true, noModern: true
    });
    for (const ev of events) {
      if ((ev.getFlags() & flags.CHAG) === 0) continue;
      const key = keyFromLocalDate(ev.getDate().greg());
      let title = '';
      try { title = String(ev.render('he') || '').replace(NIKUD_RE, '').trim(); } catch { title = ev.getDesc(); }
      if (key && !map.has(key)) map.set(key, title);
    }
  } catch (e) {
    console.error('businessDays: failed to build chag calendar for', year, e);
  }
  chagByYear.set(year, map);
  return map;
}

function chagTitle(key) {
  return chagMapForYear(Number(key.slice(0, 4))).get(key) ?? null;
}

// יום טוב (לא ערב חג, לא חול המועד).
export function isChagKey(key) {
  return chagTitle(key) !== null;
}

// ערב יום טוב = היום שלפני יום טוב (כולל "ערב" יום ב' של ר"ה = יום א' של ר"ה, שהוא חג ממילא).
export function isErevChagKey(key) {
  return chagTitle(addDaysToDateKey(key, 1)) !== null;
}

// חג או ערב חג - שקול ל-isChagDay(new Date(y, m-1, d)) ב-lib/hebrewDate.js (הוכח בבדיקה).
export function isHolidayKey(key) {
  return isChagKey(key) || isErevChagKey(key);
}

// ---------- ההגדרה non_working_days_extra ----------

function emptyConfig() {
  return { closed: new Set(), open: new Set(), notes: new Map(), invalid: 0 };
}

// Object.freeze לא מגן על התוכן של Set/Map - קוד UI שמתחיל מברירת המחדל ועושה .add() היה משנה
// את ברירת המחדל לכל התהליך (סקירה). לכן האוספים של הקונפיג הריק דוחים כל שינוי; מי שרוצה
// לערוך מתחיל מ-cloneNonWorkingConfig(...).
const frozenMsg = 'EMPTY_NON_WORKING_CONFIG is immutable - use cloneNonWorkingConfig(config) to get an editable copy';
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
  closed: new FrozenSet(), open: new FrozenSet(), notes: new FrozenMap(), invalid: 0
});

// עותק ניתן לעריכה (ל-UI של ניהול היומן): Set/Map חדשים, בלי קשר למקור.
export function cloneNonWorkingConfig(config) {
  const cfg = normalizeConfig(config);
  return { closed: new Set(cfg.closed), open: new Set(cfg.open), notes: new Map(cfg.notes), invalid: cfg.invalid || 0 };
}

function isConfig(x) {
  return !!x && typeof x === 'object' && x.closed instanceof Set && x.open instanceof Set;
}

// value של SystemSetting (מחרוזת JSON) / אובייקט כבר-מפורסר / קונפיג מוכן -> NonWorkingConfig.
// לעולם לא זורק: שורה חסרה, ריק, JSON שבור או רשומות לא תקינות -> מתעלמים (invalid נספר).
// מקבל: {version, days:[...]} (הצורה הקנונית), מערך חשוף של רשומות, או מערך מחרוזות (= closed).
// תאריך כפול: closed גובר על open; בין שתי רשומות באותו סטטוס האחרונה קובעת את ההערה.
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
  const days = Array.isArray(data) ? data : (data && typeof data === 'object' && Array.isArray(data.days) ? data.days : null);
  if (!days) { cfg.invalid = 1; return cfg; }
  // מעבר לתקרה הרשומות לא נקראות ונספרות כלא-תקינות (ה-UI יכול להציג אזהרה לפי invalid)
  if (days.length > MAX_SETTING_ENTRIES) cfg.invalid += days.length - MAX_SETTING_ENTRIES;
  const limit = Math.min(days.length, MAX_SETTING_ENTRIES);
  for (let i = 0; i < limit; i++) {
    const entry = days[i];
    const item = typeof entry === 'string' ? { date: entry } : entry;
    if (!item || typeof item !== 'object' || !isValidDayKey(item.date)) { cfg.invalid++; continue; }
    // סטטוס: לא רגיש לאותיות/רווחים ('Open', ' closed '); חסר/ריק = closed; כל ערך אחר = רשומה לא תקינה
    const rawStatus = item.status === undefined || item.status === null ? '' : String(item.status).trim().toLowerCase();
    const status = rawStatus === '' ? 'closed' : rawStatus;
    if (status !== 'closed' && status !== 'open') { cfg.invalid++; continue; }
    const key = item.date;
    const note = typeof item.note === 'string' ? item.note.trim().slice(0, NOTE_MAX_LENGTH) : '';
    if (status === 'closed') {
      cfg.closed.add(key);
      cfg.open.delete(key);
    } else if (!cfg.closed.has(key)) {
      cfg.open.add(key);
    }
    if (note) cfg.notes.set(key, note);
  }
  return cfg;
}

// הצורה הקנונית לשמירה ב-POST /api/settings (ממוין לפי תאריך; closed לפני open באותו תאריך לא קורה כי closed גובר).
export function serializeNonWorkingDaysSetting(config) {
  const cfg = isConfig(config) ? config : parseNonWorkingDaysSetting(config);
  const days = [];
  for (const key of cfg.closed) days.push({ date: key, status: 'closed', ...(cfg.notes.get(key) ? { note: cfg.notes.get(key) } : {}) });
  for (const key of cfg.open) if (!cfg.closed.has(key)) days.push({ date: key, status: 'open', ...(cfg.notes.get(key) ? { note: cfg.notes.get(key) } : {}) });
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return JSON.stringify({ version: 1, days });
}

// ---------- הכלל עצמו ----------

function normalizeOpts(opts) {
  return { skipWeekend: opts?.skipWeekend !== false, skipHolidays: opts?.skipHolidays !== false };
}

function normalizeConfig(config) {
  if (!config) return EMPTY_NON_WORKING_CONFIG;
  return isConfig(config) ? config : parseNonWorkingDaysSetting(config);
}

// הסיבות שבגללן יום (לא) עובד, בסדר קבוע. 'open' ראשון אם קיים.
function reasonsForKey(key, cfg, o) {
  const reasons = [];
  if (cfg.open.has(key)) reasons.push('open');
  if (cfg.closed.has(key)) reasons.push('closed');
  const w = weekdayOfKey(key);
  if (o.skipWeekend && w === 5) reasons.push('friday');
  if (o.skipWeekend && w === 6) reasons.push('shabbat');
  if (o.skipHolidays && isChagKey(key)) reasons.push('chag');
  if (o.skipHolidays && isErevChagKey(key)) reasons.push('erev_chag');
  return reasons;
}

function nonWorkingByKey(key, cfg, o) {
  if (cfg.open.has(key) && !cfg.closed.has(key)) return false;
  if (cfg.closed.has(key)) return true;
  if (o.skipWeekend && isWeekendKey(key)) return true;
  if (o.skipHolidays && isHolidayKey(key)) return true;
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

// למסך ניהול היומן: למה היום סגור/פתוח + שם החג.
export function dayStatus(dateOrKey, config, opts) {
  const key = toDayKey(dateOrKey);
  if (!key) return null;
  const cfg = normalizeConfig(config);
  const o = normalizeOpts(opts);
  const titles = [];
  const chag = chagTitle(key);
  if (chag) titles.push(chag);
  const erev = chagTitle(addDaysToDateKey(key, 1));
  if (erev) titles.push(`ערב ${erev}`);
  return {
    key,
    working: !nonWorkingByKey(key, cfg, o),
    reasons: reasonsForKey(key, cfg, o),
    titles,
    note: cfg.notes.get(key) ?? null
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
    out.push({ key, reasons: st.reasons, titles: st.titles, note: st.note });
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
 * שבוע סגור ביומן (או כלל עתידי שסוגר גם חול המועד) לא יכול להפיל הזמנות בשקט משאילתת חיפוש.
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
 * הכלל האחיד (שישי/שבת/חג/ערב חג/רשימת הבעלים). מחליף את subtractSkippingWeekendsAndChag
 * (lib/hebrewDate.js) בהדפסה ובמיילים: בלי רשימת בעלים התוצאה זהה לה בדיוק; ההבדל היחיד -
 * ימים שהבעלים סימן סגורים (או "פתוח") נספרים גם כאן. מחזיר Date בחצות מקומית (ר' localDateFromKey),
 * כמו הפונקציה הישנה; null לתאריך לא תקין.
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
