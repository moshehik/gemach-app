// lib/listSearch.js - "תוכנית חיפוש" משותפת לחיפושי הרשימות והבוחרים (הזמנות, לקוחות, דגמים) ובונה תנאי Prisma מתוכה.
// מודול טהור (בלי prisma / React): מקבל מחרוזת חיפוש ומחזיר מה היא (classifyQuery של lib/searchNormalize.js) + התנאים המתאימים,
// כך שה-API-ים לא מפענחים טקסט חופשי בעצמם (parseInt על "050-123" היה מוצא הזמנה #50) ושכל הרשימות מתנהגות אותו דבר.
// מקור ההחלטות: scratch/search-improvement/A-map-main-search.md, B-search-usage-mining.md, C-all-search-bars.md + החלטות הבעלים 5.10.2026
// (7 ספרות = ברקוד; 5-6 ספרות = מס' הזמנה קודם ואחר כך ברקוד; טלפון בכל צורה; תאריך עברי/לועזי = התאמה מדויקת, לא תת-מחרוזת).
// ללא סכמה חדשה ובלי אינדקסים חדשים: כל התנאים פועלים על עמודות קיימות. ר' הערות העלות ליד כל בנאי.
//
// הערה לאיחוד עתידי: app/api/global-search/route.js עדיין משתמש בהיגיון משלו (LIKE גולמי); כשנאחד אותו - להחליף לתוכנית הזו.

import { HDate } from '@hebcal/core';
import {
  classifyQuery, cleanQuery, phoneKey, phoneEquivalentKeys, gregorianCandidateKeys,
  hebrewDateSqlParts,
} from './searchNormalize.js';
import { getIsraelDayRange } from './hebrewDate.js';
import { rescueFromLatin } from './keyboardLayout.js';
import { sizeInList, sizeTextFilter, looksLikeSizeOnly } from './sizeSearch.js';
import { fuzzyTokens } from './searchFuzzy.js';

const INT32_MAX = 2147483647;

// ===========================================================================================================================
// עזרי קלט: limit / page
// ===========================================================================================================================

/**
 * מצמצם פרמטר limit מה-URL: ברירת מחדל def, מינימום 1, מקסימום max. ערך לא מספרי / שלילי / 0 -> def.
 * (בלי הצמצום "?limit=100000000" שלף את כל הטבלה בבקשה אחת.) תקרות נבחרו גבוהות מספיק לשימושי הייצוא הקיימים (2000 הזמנות).
 */
export function clampLimit(raw, def = 50, max = 5000) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(n, max);
}

/** מספר עמוד תקין (מינימום 1, מקסימום סביר). ערך לא מספרי -> 1. */
export function clampPage(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 1000000);
}

// ===========================================================================================================================
// מידות - ההגדרות ב-lib/sizeSearch.js (מודול קטן בלי תלות ב-hebcal, כדי ש-API-ים כמו inventory/capacity יוכלו לייבא אותו בלבד)
// ===========================================================================================================================

export { sizeInList, sizeTextFilter, looksLikeSizeOnly };

// ===========================================================================================================================
// תאריכים
// ===========================================================================================================================

const pad2 = (n) => String(n).padStart(2, '0');
const localKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// חודשי hebcal שמתאימים לתאריך שהוקלד בשנה עברית נתונה (אדר לבדו = משפחת האדרים; בשנה פשוטה רק 12)
function hebcalMonthsFor(parsed, year) {
  const leap = HDate.isLeapYear(year);
  if (parsed.monthKey === 'Adar') return leap ? [12, 13] : [12];
  if (parsed.monthKey === 'Adar I') return leap ? [12] : [];
  if (parsed.monthKey === 'Adar II') return leap ? [13] : [];
  return [parsed.month];
}

/**
 * טווחי תאריך לועזי (מפתחות יום ישראלי YYYY-MM-DD, [from,to]) של תאריך עברי מוקלד - ברזולוציית יום; חודש בלבד = כל ימי החודש.
 * עם שנה: אותה שנה בלבד; בלי שנה: השנים העבריות [השנה הנוכחית - back, השנה הנוכחית + forward].
 * משלים את התאמת הטקסט (eventDateHebrew) כך שהזמנות בלי טקסט עברי שמור, או עם איות שמור לא צפוי, עדיין נמצאות לפי eventDate (עמודה עם אינדקס).
 */
export function hebrewDateKeyRanges(parsed, { nowYear = new HDate(new Date()).getFullYear(), back = 8, forward = 2 } = {}) {
  if (!parsed) return [];
  const years = parsed.year ? [parsed.year] : Array.from({ length: back + forward + 1 }, (_, i) => nowYear - back + i);
  const out = [];
  for (const y of years) {
    for (const m of hebcalMonthsFor(parsed, y)) {
      try {
        const dim = HDate.daysInMonth(m, y);
        if (parsed.monthOnly) {
          out.push([localKey(new HDate(1, m, y).greg()), localKey(new HDate(dim, m, y).greg())]);
        } else if (parsed.day <= dim) {
          const k = localKey(new HDate(parsed.day, m, y).greg());
          out.push([k, k]);
        }
      } catch { /* חודש/יום שלא קיימים באותה שנה - מדלגים */ }
    }
  }
  return out;
}

function eventDateRangeCond(fromKey, toKey) {
  return { eventDate: { gte: getIsraelDayRange(fromKey).start, lte: getIsraelDayRange(toKey).end } };
}

/**
 * חלופות ל-OR על Order לתאריך עברי מוקלד: התאמת טקסט שמור (אסימונים שלמים: שווה ל"יום חודש[ שנה]" או מתחיל בו + רווח - "ב חשוון" לא תואם
 * "כב חשוון"; חודש בלבד: מופיע כאסימון) + טווחי eventDate (ר' hebrewDateKeyRanges). עלות: IN/startsWith על eventDateHebrew (בלי אינדקס - סריקה
 * של Order עם סינון, כמו ה-LIKE שהיה ב-global-search) ו-OR של עד ~11 טווחים על eventDate (יש אינדקס).
 */
export function hebrewDateOrderAlternatives(parsed) {
  if (!parsed) return [];
  const parts = hebrewDateSqlParts(parsed);
  const alts = [];
  if (parts.equals.length) alts.push({ eventDateHebrew: { in: parts.equals } });
  for (const s of parts.startsWith) alts.push({ eventDateHebrew: { startsWith: s } });
  for (const s of parts.contains) alts.push({ eventDateHebrew: { contains: s } });
  for (const s of parts.endsWith) alts.push({ eventDateHebrew: { endsWith: s } });
  for (const [from, to] of hebrewDateKeyRanges(parsed)) alts.push(eventDateRangeCond(from, to));
  return alts;
}

/**
 * חלופות ל-OR על Order לתאריך לועזי מוקלד: התאמה מדויקת ליום (טווח eventDate ביום הישראלי, ר' getIsraelDayRange - שתי צורות האחסון של eventDate).
 * "5/10" לא מתאים ל-15/10 או 25/10. עם שנה: יום אחד; בלי שנה: אותו יום ב-11 השנים [השנה-8, השנה+2].
 */
export function gregorianDateOrderAlternatives(parsedG, { year = new Date().getFullYear() } = {}) {
  if (!parsedG) return [];
  return gregorianCandidateKeys(parsedG, { year, back: 8, forward: 2 }).map((k) => eventDateRangeCond(k, k));
}

// ===========================================================================================================================
// תוכנית חיפוש
// ===========================================================================================================================

/**
 * @typedef {object} ListSearchPlan
 * @property {string} raw         הקלט כפי שהתקבל
 * @property {string} text        הקלט אחרי cleanQuery (ריק = אין חיפוש)
 * @property {boolean} empty
 * @property {object|null} intent תוצאת classifyQuery
 * @property {number|null} orderNumber   מספר הזמנה אפשרי (ספרות בלבד עד 6, או "הזמנה N")
 * @property {number|null} modelPrefix   קידומת דגם אפשרית (ספרות בלבד, תאימות לאחור: חיפוש חופשי של מספר מצא גם דגם)
 * @property {string|null} barcode       ברקוד מלא (ספרות) להתאמה מדויקת
 * @property {boolean} barcodePrimary    true = הברקוד הוא הפרשנות הראשונה (7-8 ספרות / "ברקוד N"); false = רק כגיבוי (5-6 ספרות)
 * @property {{exact: string[], partial: string|null}|null} phone  מפתחות טלפון (exact = ספרות שקולות; partial = תת-מחרוזת ספרות, 4+)
 * @property {object|null} hebrewDate    תוצאת parseHebrewDate
 * @property {object|null} gregorianDate תוצאת parseGregorianDate
 * @property {string|null} nameText      טקסט לחיפוש שם לקוח / שם דגם (contains); null כשהקלט מספרי/טלפון/תאריך בלבד
 * @property {object|null} kw            מילות מפתח (מידה/דגם...) כש-classifyQuery זיהה כאלה, אחרת null
 */

/** בונה תוכנית חיפוש מקלט גולמי. פונקציה טהורה. */
export function planListSearch(raw) {
  const text = cleanQuery(raw);
  const plan = {
    raw: raw == null ? '' : String(raw), text, empty: !text, intent: null, orderNumber: null, modelPrefix: null, barcode: null, barcodePrimary: false,
    phone: null, hebrewDate: null, gregorianDate: null, nameText: null, kw: null,
  };
  if (!text) return plan;
  const intent = classifyQuery(text);
  plan.intent = intent;
  const { kinds } = intent;
  const digitsOnly = /^\d+$/.test(text);

  if (intent.keywords && (kinds[0] === 'sizeKeyword' || kinds[0] === 'modelKeyword' || kinds[0] === 'mixedKeyword')) {
    const kw = intent.keywords;
    plan.kw = {
      size: kw.size, sizeList: kw.size !== null ? sizeInList(kw.size) : [], model: kw.model, modelIsPrefix: kw.modelIsPrefix, rest: kw.rest,
      barcode: kw.barcode, orderNumber: kw.orderNumber ? Number(kw.orderNumber) : null,
      phone: kw.phone,
    };
    if (kw.phone) plan.phone = phonePlan(kw.phone);
    return plan;
  }

  if (kinds.includes('orderNumber') && intent.orderNumber) {
    const v = intent.orderNumber.value;
    if (Number.isSafeInteger(v) && v > 0 && v <= INT32_MAX) {
      plan.orderNumber = v;
      if (digitsOnly) { plan.modelPrefix = v; plan.nameText = text; }
    }
  }
  if (kinds.includes('barcode') && intent.barcode && intent.barcode.digits) {
    plan.barcode = intent.barcode.digits;
    plan.barcodePrimary = kinds[0] === 'barcode';
  }
  if (kinds.includes('phone') && intent.phone) plan.phone = phonePlan(intent.phone.key, intent.phone.partial);
  if (kinds.includes('number') && /^\d{9}$/.test(text) && text[0] !== '0') plan.phone = phonePlan('0' + text); // טלפון בלי 0 מוביל (B: 9 ספרות)
  if (kinds.includes('date') && intent.date) {
    if (intent.date.calendar === 'hebrew') plan.hebrewDate = intent.date;
    else plan.gregorianDate = intent.date;
  }
  if (kinds.includes('text') || kinds.includes('shortcut')) plan.nameText = text;
  return plan;
}

function phonePlan(key, partialHint) {
  const k = String(key || '');
  if (!k) return null;
  const partial = partialHint !== undefined ? partialHint : k.length < 9;
  if (!partial) return { exact: phoneEquivalentKeys(k), partial: null };
  return k.length >= 4 ? { exact: [], partial: k } : null;
}

/**
 * מפתחות טלפון משדה "טלפון" ייעודי (חיפוש מתקדם / בוחרי לקוח): כל צורת כתיבה -> { exact, partial } ל-lib/searchDb.js findCustomerIdsByPhone.
 * 9+ ספרות = שוויון מלא (כולל +972 / בלי 0 מוביל); 4-8 ספרות = תת-מחרוזת ספרות; פחות מ-4 = null (רחב מדי, נשאר contains הרגיל על מה שהוקלד).
 */
export function phoneKeysFromInput(raw) {
  const k = phoneKey(raw);
  if (!k) return null;
  if (k.length >= 9) {
    const full = /^\d{9}$/.test(k) && k[0] !== '0' ? '0' + k : k; // 501234567 -> 0501234567
    return { exact: phoneEquivalentKeys(full), partial: null };
  }
  return k.length >= 4 ? { exact: [], partial: k } : null;
}

/** האם התוכנית כוללת פרשנות טלפון שדורשת חיפוש מזהי לקוחות ב-DB (lib/searchDb.js). */
export function planNeedsPhoneIds(plan) {
  return !!(plan && plan.phone && (plan.phone.exact.length || plan.phone.partial));
}

/** מה לחפש בטבלת הדגמים כדי לאתר קידומות ברקוד של דגמים תואמים: { name, prefix } (שם לחיפוש contains / קידומת מספרית), או null. */
export function planModelLookup(plan) {
  if (!plan || plan.empty) return null;
  if (plan.kw) {
    if (plan.kw.model === null || plan.kw.model === undefined) return null;
    return plan.kw.modelIsPrefix ? { name: null, prefix: Number(plan.kw.model) } : { name: plan.kw.model, prefix: null };
  }
  if (!plan.nameText && plan.modelPrefix === null) return null;
  return { name: plan.nameText, prefix: plan.modelPrefix };
}

// ===========================================================================================================================
// תנאי Prisma - הזמנות
// ===========================================================================================================================

function customerNameAlternatives(text, multiCond) {
  return [
    { customer: { firstName: { contains: text } } },
    { customer: { lastName: { contains: text } } },
    ...(multiCond ? [multiCond] : []),
  ];
}

/**
 * תנאי WHERE על Order מתוך תוכנית חיפוש (תנאי יחיד, מוכן ל-conditions.push).
 * ctx: { modelPrefixes: number[], phoneIds: string[], fuzzyIds: string[], barcodeStage: boolean, multiNameCond: object|null, multiRestCond: object|null }
 *  - modelPrefixes: קידומות ברקוד של דגמים שתואמים לשם/מספר (המסלול ש-/api/orders כבר מבצע מול dressModel);
 *  - phoneIds: מזהי לקוחות לפי lib/searchDb.js findCustomerIdsByPhone (שני הטלפונים, כל צורת כתיבה);
 *  - fuzzyIds: מזהי לקוחות לפי lib/searchDb.js findFuzzyCustomerIds (שמות דומים) - רק במעבר הטשטוש;
 *  - barcodeStage: להוסיף התאמת ברקוד גם כשהוא רק הגיבוי (5-6 ספרות - הזמנה קודם, ברקוד אחר כך);
 *  - multiNameCond / multiRestCond: תנאי "כל מילה בשם הפרטי או במשפחה" (buildMultiWordRelationNameCondition) לטקסט / לשארית מילות המפתח.
 * אין התאמה אפשרית -> { orderId: -1 }.
 */
export function orderSearchCondition(plan, ctx = {}) {
  const phoneIds = ctx.phoneIds || [];
  const fuzzyIds = ctx.fuzzyIds || [];
  const modelPrefixes = ctx.modelPrefixes || [];
  const barcodeOn = plan.barcode && (plan.barcodePrimary || ctx.barcodeStage);

  if (plan.kw) {
    const kw = plan.kw;
    const and = [];
    const itemAnd = [];
    if (kw.size !== null && kw.sizeList.length) itemAnd.push({ OR: [{ sizeText: { in: kw.sizeList } }, { dressItem: { sizeText: { in: kw.sizeList } } }] });
    if (kw.model !== null && kw.model !== undefined) {
      if (kw.modelIsPrefix) {
        const n = Number(kw.model);
        itemAnd.push({ OR: [{ barcodePrefix: n }, { dressItem: { dress: { barcodePrefix: n } } }] });
      } else {
        itemAnd.push({
          OR: [
            { dressItem: { dress: { name: { contains: kw.model } } } },
            ...(modelPrefixes.length ? [{ barcodePrefix: { in: modelPrefixes } }] : []),
          ],
        });
      }
    }
    if (itemAnd.length) and.push({ items: { some: { isDeleted: false, AND: itemAnd } } });
    if (kw.barcode) and.push({ items: { some: { isDeleted: false, barcode: { equals: kw.barcode } } } });
    if (kw.orderNumber) and.push({ orderId: kw.orderNumber });
    if (kw.phone) and.push(phoneIds.length ? { customerId: { in: phoneIds } } : { orderId: -1 });
    if (kw.rest) and.push({ OR: customerNameAlternatives(kw.rest, ctx.multiRestCond) });
    return and.length ? { AND: and } : { orderId: -1 };
  }

  const alts = [];
  if (plan.orderNumber !== null) alts.push({ orderId: plan.orderNumber });
  if (plan.nameText) {
    alts.push(...customerNameAlternatives(plan.nameText, ctx.multiNameCond));
    alts.push({ items: { some: { isDeleted: false, dressItem: { dress: { name: { contains: plan.nameText } } } } } });
  }
  if (modelPrefixes.length) alts.push({ items: { some: { isDeleted: false, barcodePrefix: { in: modelPrefixes } } } });
  if (phoneIds.length) alts.push({ customerId: { in: phoneIds } });
  if (barcodeOn) alts.push({ items: { some: { isDeleted: false, barcode: { equals: plan.barcode } } } });
  if (plan.hebrewDate) alts.push(...hebrewDateOrderAlternatives(plan.hebrewDate));
  if (plan.gregorianDate) alts.push(...gregorianDateOrderAlternatives(plan.gregorianDate));
  if (fuzzyIds.length) alts.push({ customerId: { in: fuzzyIds } });
  return alts.length ? { OR: alts } : { orderId: -1 };
}

// ===========================================================================================================================
// תנאי Prisma - לקוחות
// ===========================================================================================================================

/**
 * תנאי OR על Customer. תאימות לאחור: הטקסט (אחרי ניקוי) נבדק כמו קודם מול שם פרטי/משפחה/טלפון 1/מייל/עיר (+ התאמת שם מלא), ובנוסף:
 * טלפון 2 (הוא לא נבדק בכלל), ומזהי לקוחות לפי טלפון בכל צורת כתיבה (phoneIds) ולפי שם דומה (fuzzyIds).
 * ctx: { multiNameCond: object|null, phoneIds: string[], fuzzyIds: string[] }
 */
export function customerSearchCondition(plan, ctx = {}) {
  const t = plan.text;
  const alts = [
    { firstName: { contains: t } },
    { lastName: { contains: t } },
    { phone1: { contains: t } },
    { phone2: { contains: t } },
    { email: { contains: t } },
    { city: { contains: t } },
  ];
  if (ctx.multiNameCond) alts.push(ctx.multiNameCond);
  if (ctx.phoneIds && ctx.phoneIds.length) alts.push({ id: { in: ctx.phoneIds } });
  if (ctx.fuzzyIds && ctx.fuzzyIds.length) alts.push({ id: { in: ctx.fuzzyIds } });
  return { OR: alts };
}

// ===========================================================================================================================
// תנאי Prisma - דגמים (קטלוג)
// ===========================================================================================================================

/**
 * חלופות OR על DressModel לחיפוש החופשי בעמוד הדגמים: שם / קטגוריית מחיר / הערות (contains, כמו קודם) + קידומת ברקוד (מספר בלבד, או ברקוד של 7 ספרות,
 * או "דגם N") + מידה (כמו שהמשבצת מבטיחה: "שם, מקט, מידה"): ספרות 1-2, מידה לטינית או "מידה X" -> פריט במידה שקולה (2 = 02, לא 12/20).
 * שלוש ספרות ומעלה הן קידומת דגם בלבד. parseInt על טקסט חופשי ("12 דגם" -> 12) לא נעשה יותר.
 */
export function dressSearchAlternatives(plan) {
  const t = plan.text;
  if (!t) return [];
  if (plan.kw) {
    const kw = plan.kw;
    const and = [];
    if (kw.model !== null && kw.model !== undefined) {
      and.push(kw.modelIsPrefix ? { barcodePrefix: Number(kw.model) } : { name: { contains: kw.model } });
    }
    if (kw.size !== null && kw.sizeList.length) and.push({ items: { some: { sizeText: { in: kw.sizeList } } } });
    if (kw.rest) and.push({ OR: [{ name: { contains: kw.rest } }, { priceCategory: { contains: kw.rest } }, { notes: { contains: kw.rest } }] });
    return and.length ? [{ AND: and }] : [];
  }
  const alts = [
    { name: { contains: t } },
    { priceCategory: { contains: t } },
    { notes: { contains: t } },
  ];
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    if (Number.isSafeInteger(n) && n <= INT32_MAX) alts.push({ barcodePrefix: n });
    if (plan.barcode && plan.barcodePrimary) {
      const prefix = Number(plan.intent.barcode.prefix);
      if (Number.isSafeInteger(prefix) && prefix <= INT32_MAX) alts.push({ barcodePrefix: prefix });
    }
  }
  if (looksLikeSizeOnly(t)) alts.push({ items: { some: { sizeText: { in: sizeInList(t) } } } });
  return alts;
}

// ===========================================================================================================================
// נסיונות חוזרים כשהתוצאה ריקה + הודעות
// ===========================================================================================================================

export const NOTICE_SCOPE_BADGE = 'מוצגות הזמנות עתידיות בלבד';
export const NOTICE_SCOPE_WIDENED = 'לא נמצא בהזמנות עתידיות - מוצגות תוצאות מכל התאריכים';
export const NOTICE_FUZZY = 'לא נמצאה התאמה מדויקת - מוצגים שמות דומים';
export const noticeLayout = (original, converted) => `לא נמצא "${original}" - מוצגות תוצאות עבור "${converted}" (הוקלד במקלדת אנגלית?)`;
export const noticeBarcode = (digits) => `לא נמצאה הזמנה מספר ${digits} - מוצגות הזמנות עם הברקוד ${digits}`;

/**
 * רשימת הנסיונות החוזרים לפי סדר, אחרי שהחיפוש כפי שהוקלד החזיר 0 תוצאות. כל נסיון: { widen, text, fuzzy, barcode, notices }.
 *  1. הרחבת טווח התאריכים (רק כש-scopeRestricted: לשונית "בקרוב" פעילה) - 94% מחיפושי הרשימה רצים עם הסינון הזה ו-173 מ-1,163 חזרו ריקים (B, סעיף 5).
 *  2. ברקוד כגיבוי (5-6 ספרות: הזמנה קודם, ברקוד שני).
 *  3. הצלת מקלדת (טקסט לטיני בלבד -> עברית).
 *  4. שמות דומים (מרחק עריכה 1-2 + פונטי), רק לטקסט שנראה כשם.
 * כל נסיון אחרי הראשון כולל גם את הרחבת הטווח (אם הוא היה מוגבל) והודעה מצטברת.
 * @param {ListSearchPlan} plan
 * @param {{scopeRestricted?: boolean, fuzzy?: boolean, layout?: boolean}} [opts]
 */
export function buildRetryVariants(plan, { scopeRestricted = false, fuzzy = true, layout = true } = {}) {
  if (!plan || plan.empty) return [];
  const out = [];
  const scopeNotice = scopeRestricted ? [{ kind: 'scope', text: NOTICE_SCOPE_WIDENED }] : [];
  const mk = (extra, notices) => ({ widen: scopeRestricted, text: null, fuzzy: false, barcode: false, ...extra, notices: [...scopeNotice, ...notices] });
  if (scopeRestricted) out.push(mk({}, []));
  if (plan.barcode && !plan.barcodePrimary) out.push(mk({ barcode: true }, [{ kind: 'barcode', text: noticeBarcode(plan.barcode) }]));
  if (layout) {
    const rescue = rescueFromLatin(plan.text);
    if (rescue) out.push(mk({ text: rescue.converted }, [{ kind: 'layout', text: noticeLayout(rescue.original, rescue.converted) }]));
  }
  if (fuzzy && !plan.kw && fuzzyTokens(plan.text).length) out.push(mk({ fuzzy: true }, [{ kind: 'fuzzy', text: NOTICE_FUZZY }]));
  return out;
}
