// lib/stockCheck.js — הלוגיקה של דף "בדיקת מלאי" (server-only; מייבא Prisma).
//
// שאלה אחת: "בתאריך X, אילו דגמים פנויים בדגם/מידות שביקשו?" — לפי החלטות הבעלים
// (scratch/schedule-build/DECISIONS-בדיקת-מלאי.md, 1.10.2026):
//   B02/B03  סינון לפי דגם ו/או מידה; לפחות אחד מהם חובה.
//   B06      כמה מידות = "וגם": דגם נשאר רק אם לכל מידה שנבחרה יש פנוי > 0.
//   B07      בדיקה גמישה ±2 לכל מידה בנפרד, למידה מספרית בלבד (12 → 10/12/14; 36 → 34/36/38).
//            מידה שאינה מספר שלם ("כללי", "38-40") נבדקת בדיוק כפי שהוקלדה.
//   Q06      הכמות בבדיקה גמישה: לכל מידה = סכום הפנוי במידות המועמדות לה (המידה עצמה ושתיים
//            מעלה/מטה); בשורת הדגם = המינימום בין המידות שנבחרו.
//   B05      הנתיב api/inventory/capacity לא מתאים - לא בשימוש כאן.
//   B08      פיצול לפי סניף נדחה - השדה `branches` נשאר ריק, ו-`branchesEnabled` מוחזר לתצוגה.
//
// עיקרון: קריאה אחת ל-getBulkAvailableInventory (lib/inventory.js) לתאריך - זו נקודת האמת
// היחידה לכללי המלאי (ימי חציצה, סופי שבוע, מחסן/רזרבה, החזקת עגלה) - וכל הסינון נעשה
// בזיכרון על התוצאה. הקובץ הזה לא נוגע ב-lib/inventory.js ולא משנה שום הגדרת חישוב.

import prisma from '@/app/lib/prisma';
import { getBulkAvailableInventory } from '@/lib/inventory';
import { getCachedSetting } from '@/lib/settingsCache';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { compareSizeText, normalizeSizeKey } from '@/lib/sizeSort';

// אין תקרה על מספר הדגמים שנכנסים לחישוב: getBulkAvailableInventory מקבלת את כל רשימת
// הדגמים בקריאה אחת (שאילתת פריטים + דגמים + הזמנות אחת, `in: modelIds`), אז תקרה לא חוסכת
// שאילתות - היא רק הייתה חותכת מידה נפוצה (36/38) לתוצאה חלקית ולא יציבה (ר' הסקירה, ממצא 1).
// המגבלה היחידה היא על התצוגה (maxResults), אחרי מיון קבוע - אז ה-200 שמוצגים תמיד אותם 200.
// פריט ההרשאה של הדף, הבדיקה וההצעות (החלטת הבעלים GQ-06a, 2.10.2026): אותו שער כמו דפי ההזמנות.
// כאן ולא בנתיב, כדי ששני הנתיבים (route.js, options/route.js) והדף ייבאו ממקום אחד ולא נתיב מנתיב.
export const STOCK_CHECK_PAGE_KEY = 'page:orders';
// כרטיס הדגם (results[].link) שמור בהרשאה אחרת - הקישור נשלח רק למי שרשאית לפתוח אותו.
export const MODEL_CARD_PAGE_KEY = 'page:dresses_catalog';
export const MODEL_CARD_PATH = '/dashboard/dresses/';

export const STOCK_CHECK_LIMITS = Object.freeze({
  maxSizes: 10,        // מידות בבקשה אחת
  maxModelTokens: 10,  // ביטויי דגם בבקשה אחת
  maxResults: 200,     // שורות בתשובה (מעבר לזה - truncated)
  flexStep: 2,         // ±2 (B07)
});

// DressModel.barcodePrefix הוא Int (32 ביט) - מספר גדול יותר בביטוי הדגם היה מפיל את Prisma
// (500) במקום "הדגם לא נמצא". מעבר לטווח הביטוי נבדק רק כטקסט בשם.
const INT32_MAX = 2147483647;

// מידה "כללי" היא ברירת המחדל של lib/inventory.js לפריט בלי sizeText.
const GENERAL_SIZE = 'כללי';

// --- נרמול מפתח המידה (2.10.2026, אחרי בדיקה קריאה-בלבד של DressItem.sizeText בשני הגמ"חים) ---
// בגמ"ח הראשי כל 30 ערכי המידה הם מספרים בשתי ספרות עם אפס מוביל ("02".."54", "06", "08"); בנווה יעקב מעורב:
// "06" לצד "6", "08" לצד "8", רווחים מובילים (" 32", "  36"), ולצידם מידות שאינן מספר שלם ("06.1", "36א", "38-40").
// בלי נרמול, בדיקה גמישה של "08" הייתה מחפשת "6"/"10" ולא מוצאת "06"/"10", ו"6" לעולם לא היה תואם "06".
// לכן מפתח המידה לצורך ההשוואה בלבד הוא normalizeSizeKey (lib/sizeSort.js): רווחים נחתכים; מספר שלם (עד 3 ספרות)
// בלי אפסים מובילים ("06" ≡ "6" ≡ " 06"); ריק = "כללי"; כל טקסט אחר ("06.1", "36א", "38-40") נשאר כפי שהוא. פריטים
// שמפתחם זהה נספרים יחד (37 פריטים "8" ו-203 פריטים "08" בנווה יעקב — מידה 8 היא אותה מידה). לתצוגה נשמרת הצורה
// שבה המידה כתובה ב-DB. זה לא נוגע ב-lib/inventory.js ובשום מסך אחר (טופס ההזמנה עדיין בוחר sizeText מדויק).
export { normalizeSizeKey };

export class StockCheckError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StockCheckError';
    this.code = code;
    this.status = 400;
  }
}

const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
function isRealCalendarDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

// מידה "מספרית" לצורך B07: מספר שלם חיובי בלבד (לא "38-40", לא "12.5", לא "כללי").
export function isNumericSize(size) {
  return /^\d{1,3}$/.test(String(size ?? '').trim());
}

// המידות המועמדות למידה אחת, כמפתחות מנורמלים: בגמישה ומספרית - [n-2, n, n+2] (בלי ערכים לא חיוביים);
// אחרת - המידה עצמה בלבד. ("06" גמישה → "4","6","8" - אותם מפתחות שמקבלים הפריטים "04"/"06"/"08".)
export function candidateSizes(size, flexible) {
  const key = normalizeSizeKey(size);
  if (!flexible || !isNumericSize(key)) return [key];
  const n = parseInt(key, 10);
  // מידה 0 ("00") קיימת בשני הגמ"חים (7 פריטים בראשי, 25 בנווה יעקב) - לכן 0 היא מועמדת חוקית; רק שלילי נזרק.
  return [n - STOCK_CHECK_LIMITS.flexStep, n, n + STOCK_CHECK_LIMITS.flexStep]
    .filter((v) => v >= 0)
    .map(String);
}

// מנרמל את קלט המידות: מסיר כפילויות/ריקים, מצמיד לכל מידה את דגל הגמישות ואת המועמדות.
// `flexible` = true (כולן) | מערך מידות | ריק (אף אחת).
export function normalizeSizeRequests(sizes, flexible) {
  const list = Array.isArray(sizes) ? sizes : (sizes ? [sizes] : []);
  const flexAll = flexible === true;
  const flexSet = new Set((Array.isArray(flexible) ? flexible : []).map((v) => String(v).trim()));
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const size = String(raw ?? '').trim();
    if (!size) throw new StockCheckError('invalid_size', 'מידה ריקה אינה חוקית');
    if (size.length > 20) throw new StockCheckError('invalid_size', `המידה "${size.slice(0, 20)}…" ארוכה מדי`);
    const key = normalizeSizeKey(size);
    if (seen.has(key)) continue; // "06" ו-"6" הן אותה בקשה
    seen.add(key);
    const flex = (flexAll || flexSet.has(size) || flexSet.has(key) || [...flexSet].some((f) => normalizeSizeKey(f) === key)) && isNumericSize(key);
    out.push({ size, key, flexible: flex, candidates: candidateSizes(size, flex) });
  }
  if (out.length > STOCK_CHECK_LIMITS.maxSizes) {
    throw new StockCheckError('too_many_sizes', `אפשר לבדוק עד ${STOCK_CHECK_LIMITS.maxSizes} מידות בבת אחת`);
  }
  return out;
}

export function normalizeModelTokens(models) {
  const list = Array.isArray(models) ? models : (models ? [models] : []);
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const token = String(raw ?? '').trim();
    if (!token) continue;
    if (token.length > 100) throw new StockCheckError('invalid_model', 'ביטוי הדגם ארוך מדי');
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  if (out.length > STOCK_CHECK_LIMITS.maxModelTokens) {
    throw new StockCheckError('too_many_models', `אפשר לבדוק עד ${STOCK_CHECK_LIMITS.maxModelTokens} דגמים בבת אחת`);
  }
  return out;
}

// פותר ביטוי דגם לרשימת דגמים - אותו כלל כמו "תפוסה" בחיפוש המתקדם (app/api/a5/adv-b/route.js):
// מספר = קידומת ברקוד מדויקת (או שם שמכיל אותו); טקסט = שם שמכיל; התאמה מדויקת מנצחת חלקית.
async function resolveModelTokens(tokens, warnings) {
  const byId = new Map();
  for (const token of tokens) {
    const parsed = /^\d+$/.test(token) ? parseInt(token, 10) : null;
    const num = parsed != null && parsed <= INT32_MAX ? parsed : null;
    const rows = await prisma.dressModel.findMany({
      where: {
        isDeleted: false,
        OR: [
          { name: { contains: token, mode: 'insensitive' } },
          ...(num != null ? [{ barcodePrefix: num }] : []),
        ],
      },
      select: { id: true, name: true, barcodePrefix: true },
    });
    const exact = rows.filter((m) => m.name === token || (num != null && m.barcodePrefix === num));
    const chosen = exact.length ? exact : rows;
    if (!chosen.length) {
      warnings.push(`הדגם "${token}" לא נמצא`);
      continue;
    }
    for (const m of chosen) byId.set(m.id, m);
  }
  return [...byId.values()];
}

// בלי דגם: רק דגמים שיש להם פריט פעיל באחת המידות המועמדות (על-קבוצה בטוחה - חישוב
// המלאי עצמו מסנן מחסן/רזרבה/תיקון לפי ההגדרות). חוסך שליפת הזמנות של כל הדגמים.
// בלי take: כל הדגמים התואמים נכנסים (ר' ההערה על STOCK_CHECK_LIMITS).
// ההתאמה היא לפי המפתח המנורמל: קודם שולפים את רשימת ערכי sizeText הקיימים (עד כמה עשרות ערכים) ובוחרים
// מהם את הכתיבים שמנורמלים למועמדות ("08", " 8" ו-"8" כולם למפתח "8"), ואז `in` על הכתיבים האלה.
// groupBy (GROUP BY בשרת ה-DB) ולא findMany+distinct: ב-Prisma 5 `distinct` נעשה בזיכרון אחרי שליפת כל השורות (13k פריטים בראשי).
const ACTIVE_ITEM = { isDeleted: false, notInUse: false, inRepair: false, dressModelId: { not: null } };
async function resolveModelsBySizes(sizeReqs) {
  const wanted = new Set(sizeReqs.flatMap((r) => r.candidates));
  const existing = await prisma.dressItem.groupBy({ by: ['sizeText'], where: ACTIVE_ITEM });
  const raws = existing.map((r) => r.sizeText).filter((v) => v != null && v !== '' && wanted.has(normalizeSizeKey(v)));
  const sizeOr = raws.length ? [{ sizeText: { in: raws } }] : [];
  if (wanted.has(GENERAL_SIZE)) sizeOr.push({ sizeText: null }, { sizeText: '' });
  if (!sizeOr.length) return [];
  const groups = await prisma.dressItem.groupBy({ by: ['dressModelId'], where: { ...ACTIVE_ITEM, OR: sizeOr } });
  const ids = [...new Set(groups.map((g) => g.dressModelId).filter(Boolean))];
  if (!ids.length) return [];
  return prisma.dressModel.findMany({
    where: { id: { in: ids }, isDeleted: false },
    select: { id: true, name: true, barcodePrefix: true },
  });
}

// מקבץ את מפת הזמינות של דגם (מפתחות sizeText גולמיים) לפי המפתח המנורמל: { key: { free, display } }.
// display = הכתיב כפי שהוא ב-DB כשיש כתיב אחד למפתח ("06"), אחרת המפתח עצמו ("8" כשיש גם "8" וגם "08").
export function bucketAvailability(availability) {
  const out = new Map();
  for (const raw of Object.keys(availability || {})) {
    const key = normalizeSizeKey(raw);
    const free = Math.max(0, availability[raw]?.available || 0);
    const b = out.get(key);
    if (b) { b.free += free; b.raws.push(raw); } else out.set(key, { key, free, raws: [raw] });
  }
  for (const b of out.values()) b.display = b.raws.length === 1 ? String(b.raws[0]).trim() || GENERAL_SIZE : b.key;
  return out;
}

// לב החישוב - טהור, בלי DB. availability = תוצאת getBulkAvailableInventory לדגם אחד
// ({ [sizeText]: { available, total, booked } }). מחזיר null כשהדגם נופל מהסינון (B06).
export function evaluateModel(availability, sizeReqs) {
  const buckets = bucketAvailability(availability);
  const freeOf = (key) => buckets.get(key)?.free || 0;
  const displayOf = (key) => buckets.get(key)?.display ?? key;

  if (!sizeReqs.length) {
    // דגם בלבד: כל המידות שיש בהן פנוי; הכמות בשורה = סך הפנוי בדגם (GQ-06b).
    const sizes = [...buckets.values()]
      .filter((b) => b.free > 0)
      .sort((a, b) => compareSizeText(a.key, b.key))
      .map((b) => ({ size: b.display, free: b.free, flexible: false, candidates: [{ size: b.display, free: b.free }] }));
    if (!sizes.length) return null;
    return { sizes, free: sizes.reduce((a, s) => a + s.free, 0) };
  }

  const sizes = [];
  for (const req of sizeReqs) {
    const candidates = req.candidates
      .filter((c) => freeOf(c) > 0)
      .map((c) => ({ size: displayOf(c), free: freeOf(c) }));
    if (!candidates.length) return null; // B06: מידה אחת בלי פנוי מפילה את הדגם
    const free = candidates.reduce((a, c) => a + c.free, 0); // Q06: סכום המועמדות
    sizes.push({ size: req.size, free, flexible: req.flexible, candidates });
  }
  return { sizes, free: Math.min(...sizes.map((s) => s.free)) }; // Q06: מינימום בשורה
}

// סדר קבוע: פנוי יורד, אחר כך קידומת ברקוד עולה, אחר כך שם - כדי ששתי בדיקות זהות ייתנו
// אותה רשימה בדיוק (גם בהשוואת מטמון).
export function compareResults(a, b) {
  if (b.free !== a.free) return b.free - a.free;
  const ac = a.modelCode ?? Number.MAX_SAFE_INTEGER;
  const bc = b.modelCode ?? Number.MAX_SAFE_INTEGER;
  if (ac !== bc) return ac - bc;
  return String(a.modelName || '').localeCompare(String(b.modelName || ''), 'he');
}

/**
 * בדיקת מלאי לתאריך.
 * @param {object} p
 * @param {string}   p.date      'YYYY-MM-DD' - היום הקלנדרי בישראל (התאריך העברי מומר בצד הלקוח)
 * @param {string[]} [p.models]  ביטויי דגם (שם או קידומת ברקוד); ריק = כל הדגמים
 * @param {string[]} [p.sizes]   מידות (כטקסט, כפי שמופיע ב-DressItem.sizeText)
 * @param {true|string[]} [p.flexible] אילו מידות נבדקות ±2 (true = כולן)
 * @param {object}   [p.orgSettings] { branchesEnabled?: boolean } - אם חסר נקרא מ-branches_enabled
 * @returns {Promise<{date, dateHebrew, query, branchesEnabled, results, warnings, truncated}>}
 * @throws {StockCheckError} על קלט לא חוקי (status 400)
 */
export async function checkStock({ date, models, sizes, flexible, orgSettings } = {}) {
  if (!isIsoDate(date) || !isRealCalendarDate(date)) {
    throw new StockCheckError('invalid_date', 'נדרש תאריך חוקי בצורה YYYY-MM-DD');
  }
  const tokens = normalizeModelTokens(models);
  const sizeReqs = normalizeSizeRequests(sizes, flexible);
  if (!tokens.length && !sizeReqs.length) {
    throw new StockCheckError('missing_filter', 'חובה דגם או מידה, או שניהם');
  }

  let branchesEnabled = orgSettings?.branchesEnabled;
  if (branchesEnabled === undefined) {
    const row = await getCachedSetting('branches_enabled').catch(() => null);
    branchesEnabled = !!row && row.value === 'true';
  }

  const warnings = [];
  const [y, m, d] = date.split('-').map(Number);
  const base = {
    date,
    dateHebrew: getHebrewDateString(new Date(y, m - 1, d)),
    query: {
      models: tokens,
      sizes: sizeReqs.map((r) => ({ size: r.size, flexible: r.flexible, candidates: r.candidates })),
    },
    branchesEnabled: !!branchesEnabled,
    warnings,
    truncated: false,
  };

  // 1. אילו דגמים נכנסים לחישוב
  const modelRows = tokens.length ? await resolveModelTokens(tokens, warnings) : await resolveModelsBySizes(sizeReqs);
  // רשימה ריקה חייבת לעצור כאן: getBulkAvailableInventory עם [] מתייחסת לזה כ"בלי סינון דגם"
  // ושולפת את כל ההזמנות בחלון, לחינם.
  if (!modelRows.length) {
    if (!tokens.length) warnings.push('אין דגם עם פריט פעיל במידות שביקשתם');
    return { ...base, results: [] };
  }

  // 2. קריאה אחת למנוע המלאי (כל הדגמים יחד) - כל כללי החישוב (חציצה, סופ"ש, מחסן/רזרבה,
  //    החזקת עגלה) בתוכה. המנוע מתרגם את ה-instant ליום הקלנדרי בישראל (toIsraelCalendarDate),
  //    אז מוסרים לו 12:00 UTC של התאריך (14:00/15:00 בישראל) - תמיד אותו יום קלנדרי, גם בשני
  //    ימי מעבר השעון (27.3.2026, 25.10.2026). חצות-בישראל דרך getIsraelDayRange נפל ביום
  //    כניסת שעון הקיץ על 23:00 של היום הקודם (ר' הסקירה, ממצא 3; תיקון העזר עצמו ב-PR #194).
  const targetInstant = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const bulk = await getBulkAvailableInventory(targetInstant, modelRows.map((mr) => mr.id));

  // 3. סינון בזיכרון
  const results = [];
  for (const mr of modelRows) {
    const evaluated = evaluateModel(bulk[mr.id], sizeReqs);
    if (!evaluated) continue;
    results.push({
      modelId: mr.id,
      modelCode: mr.barcodePrefix ?? null,
      modelName: mr.name || '',
      sizes: evaluated.sizes,
      free: evaluated.free,
      branches: [], // B08: פיצול לפי סניף נדחה - מקום שמור בחוזה
    });
  }
  results.sort(compareResults);

  if (!results.length && sizeReqs.length) {
    const known = new Set();
    for (const mr of modelRows) for (const size of Object.keys(bulk[mr.id] || {})) known.add(normalizeSizeKey(size));
    for (const req of sizeReqs) {
      if (!req.candidates.some((c) => known.has(c))) warnings.push(`המידה "${req.size}" לא קיימת בדגמים שנבדקו`);
    }
  }

  let out = results;
  if (out.length > STOCK_CHECK_LIMITS.maxResults) {
    out = out.slice(0, STOCK_CHECK_LIMITS.maxResults);
    base.truncated = true;
  }
  return { ...base, results: out };
}
