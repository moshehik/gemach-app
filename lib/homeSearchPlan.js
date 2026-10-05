// lib/homeSearchPlan.js - "תכנית חיפוש" טהורה לחיפוש הראשי של דף הבית (/api/global-search) - בלי prisma / רשת / DOM, כדי שאפשר לבדוק ב-node
// (scripts/test_home_search_plan.mjs) ולהריץ באותו אופן בשרת ובלקוח.
//
// מקבל את מה שהוקלד ומחזיר מה לשאול: מה הטקסט לחיפוש שם/טלפון/ברקוד (text), האם יש מספר הזמנה מדויק, ברקוד (למלאי), מפתחות טלפון,
// תאריך (עברי/לועזי, עם יום מועמד קרוב להיום ללו"ז), מילות מפתח (מידה/דגם) ואילו שאילתות בכלל צריך להריץ.
// כללי הספרות (החלטת הבעלים 5.10.2026, lib/searchNormalize.js classifyQuery): עד 4 ספרות = מס' הזמנה; 5-6 = הזמנה קודם, ברקוד שני; 7 = ברקוד.
//
// מסלול הייבוא: רק lib/searchNormalize.js (טהור) ו-@hebcal/core (כמו lib/hebrewDate.js). בלי '@/' כדי שירוץ גם ב-node רגיל.

import { HDate } from '@hebcal/core';
import {
  classifyQuery, cleanQuery, escapeLike, gregorianCandidateKeys, hebrewDateSqlParts, israelDayKey, parseGregorianDate, parseHebrewDate,
  parseKeywords, phoneEquivalentKeys, phoneKey,
} from './searchNormalize.js';

const INT32_MAX = 2147483647;
const MAX_QUERY_CHARS = 120; // תקרת אורך לשאילתה (שורת חיפוש רגילה); מעבר לזה נחתך - לא נשלח ל-LIKE / fuzzy

const pad2 = (n) => String(n).padStart(2, '0');
const keyOf = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const dayNumber = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

/** המפתח הקרוב ביותר ליום הנתון (תיקו = העתידי). רשימה ריקה -> null. */
export function nearestKey(keys, todayKey) {
  if (!keys || !keys.length) return null;
  const t = dayNumber(todayKey);
  let best = null; let bestD = Infinity;
  for (const k of keys) {
    const d = dayNumber(k) - t;
    const ad = Math.abs(d);
    if (ad < bestD || (ad === bestD && d > 0)) { best = k; bestD = ad; }
  }
  return best;
}

/**
 * מפתחות יום גרגוריאניים (YYYY-MM-DD) שמתאימים לתאריך עברי מפורק (תוצאת parseHebrewDate) בשנים עבריות סביב היום:
 * שנה אחורה עד שנתיים קדימה (כמו gregorianCandidateKeys). חודש בלבד -> []. "אדר" בשנה מעוברת = אדר א' ואדר ב' גם יחד; "אדר א'/ב'" בשנה פשוטה - לא קיים.
 */
export function hebrewCandidateKeys(hd, todayKey) {
  if (!hd || hd.monthOnly || !hd.day) return [];
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const hy = new HDate(new Date(ty, tm - 1, td)).getFullYear();
  const out = [];
  for (let y = hy - 1; y <= hy + 2; y++) {
    const leap = HDate.isLeapYear(y);
    let months;
    if (hd.monthKey === 'Adar') months = leap ? [12, 13] : [12];
    else if (hd.monthKey === 'Adar I') months = leap ? [12] : [];
    else if (hd.monthKey === 'Adar II') months = leap ? [13] : [];
    else months = [hd.month];
    for (const m of months) {
      if (hd.day > HDate.daysInMonth(m, y)) continue;
      const g = new HDate(hd.day, m, y).greg();
      out.push(keyOf(g.getFullYear(), g.getMonth() + 1, g.getDate()));
    }
  }
  return [...new Set(out)];
}

// צורה קנונית של טקסט תאריך עברי להשוואה: בלי גרשיים/גרש, מקפים ורווחים כפולים -> רווח אחד (כמו dateCanon ב-lib/searchNormalize.js)
const canon = (s) => String(s).replace(/["'׳״]/g, '').replace(/[-\s]+/g, ' ').trim();
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * ביטוי רגולרי (POSIX של Postgres / JS - אותו תחביר) שמתאים ל-Order.eventDateHebrew אחרי הסרת גרשיים/גרש (ב-SQL: regexp_replace(col, '["״׳'']', '', 'g')).
 * התאמה לפי אסימונים שלמים: "כז תשרי" תואם "כז תשרי" / "כז תשרי תשפז" ולא "יכז"; "ב חשוון" לא תואם "כב חשוון". חודש בלבד: כאסימון בכל מקום.
 * אותה סמנטיקה כמו hebrewDateMatchesStored (lib/searchNormalize.js) - הבדיקות משוות ביניהן.
 */
export function hebrewDateSqlRegex(hd) {
  if (!hd) return null;
  const months = [...new Set(hd.monthSpellings.map(canon))].map(reEscape).join('|');
  if (hd.monthOnly) return `(^| )(?:${months})( |$)`;
  const days = [...new Set([...hd.daySpellings.map(canon), String(hd.day)])].map(reEscape).join('|');
  if (hd.year) {
    const years = [...new Set(hd.yearSpellings.map(canon))].map(reEscape).join('|');
    return `^(?:${days}) (?:${months}) (?:${years})( |$)`;
  }
  return `^(?:${days}) (?:${months})( |$)`;
}

function buildDate(calendar, parsed, todayKey) {
  if (calendar === 'gregorian') {
    const keys = gregorianCandidateKeys(parsed, { year: Number(todayKey.slice(0, 4)) });
    return { calendar, parsed, keys, key: nearestKey(keys, todayKey), sql: null };
  }
  const keys = hebrewCandidateKeys(parsed, todayKey);
  return { calendar, parsed, keys, key: nearestKey(keys, todayKey), sql: hebrewDateSqlParts(parsed), regex: hebrewDateSqlRegex(parsed) };
}

function barcodeInfo(digits) {
  if (!/^\d{5,12}$/.test(digits)) return null;
  const size = digits.slice(digits.length - 4, digits.length - 2);
  return { digits, prefix: digits.slice(0, digits.length - 4), size, serial: digits.slice(digits.length - 2), complete: digits.length === 7 };
}

/**
 * @param {string} input   מה שהוקלד (גולמי)
 * @param {{now?: Date}} [opts]
 * @returns {{
 *   query: string, kind: string, kinds: string[], tooShort: boolean,
 *   text: string, likePattern: string,
 *   orderNumber: number|null, barcode: object|null, phone: object|null, date: object|null, keywords: object|null,
 *   run: {customers: boolean, orders: boolean, rentals: boolean},
 *   wantsInventory: boolean
 * }}
 */
export function planGlobalSearch(input, { now = new Date() } = {}) {
  const query = cleanQuery(input, { max: MAX_QUERY_CHARS });
  const cls = classifyQuery(query);
  const todayKey = israelDayKey(now);
  const plan = {
    query, kind: cls.kind, kinds: cls.kinds, tooShort: false,
    text: query, likePattern: '', orderNumber: null, barcode: null, phone: null, date: null, keywords: null,
    run: { customers: true, orders: true, rentals: true }, wantsInventory: false,
  };
  if (cls.kind === 'empty') { plan.text = ''; plan.run = { customers: false, orders: false, rentals: false }; return plan; }

  // מילת מפתח מפורשת / משולבת: הערכים יוצאים מהטקסט החופשי, והשאר (rest) הוא טקסט חיפוש רגיל
  const kw = cls.keywords || null;
  if (kw && kw.any) {
    plan.text = kw.rest || '';
    if (kw.size !== null || kw.model !== null) {
      plan.keywords = {
        size: kw.size, sizeKey: kw.sizeKey, sizeSpellings: kw.sizeSpellings,
        model: kw.model, modelIsPrefix: kw.modelIsPrefix,
      };
      plan.wantsInventory = true;
    }
    if (kw.barcode !== null) { plan.barcode = barcodeInfo(kw.barcode); plan.text = kw.barcode + (plan.text ? ' ' + plan.text : ''); }
    if (kw.orderNumber !== null) {
      const n = Number(kw.orderNumber);
      if (Number.isSafeInteger(n) && n <= INT32_MAX) plan.orderNumber = n;
      plan.text = kw.orderNumber + (plan.text ? ' ' + plan.text : '');
    }
    if (kw.phone !== null) {
      const key = phoneKey(kw.phone);
      plan.phone = { key, partial: key.length < 9, equivalents: phoneEquivalentKeys(kw.phone) };
      plan.text = (kw.phone) + (plan.text ? ' ' + plan.text : '');
    }
    // "דגם 3 מידה 2 כז תשרי": מה שנשאר, אם הוא תאריך - הוא תאריך הזמינות (ולא טקסט)
    if (kw.rest) {
      const g = parseGregorianDate(kw.rest);
      const h = g ? null : parseHebrewDate(kw.rest);
      if (g || h) {
        plan.date = buildDate(g ? 'gregorian' : 'hebrew', g || h, todayKey);
        plan.text = plan.text.replace(kw.rest, '').trim();
      }
    }
  } else if (cls.kinds.includes('date') && cls.date) {
    const { calendar, ...rest } = cls.date;
    plan.date = buildDate(calendar, calendar === 'gregorian' ? rest : parseHebrewDate(query), todayKey);
    // תאריך שאינו עמום: אין טעם בחיפוש שם/פריט על "5/10"; עמום ('6.1' / חודש לבדו) נשאר גם כטקסט
    if (!cls.kinds.includes('text')) plan.text = '';
  } else {
    // ספרות / טלפון / טקסט
    if (cls.kinds.includes('orderNumber') && cls.orderNumber) {
      const n = cls.orderNumber.value;
      if (Number.isSafeInteger(n) && n <= INT32_MAX) plan.orderNumber = n;
    }
    if (cls.kinds.includes('barcode') && cls.barcode) plan.barcode = barcodeInfo(cls.barcode.digits);
    // 9 ספרות בלי 0 מוביל = טלפון שנכתב בלי ה-0 (כמו ברשימות: lib/listSearch.js planListSearch)
    if (cls.kinds.includes('number') && /^\d{9}$/.test(query) && query[0] !== '0') {
      plan.phone = { key: '0' + query, partial: false, equivalents: phoneEquivalentKeys('0' + query) };
    }
    if (cls.kinds.includes('phone') && cls.phone) {
      plan.phone = { key: cls.phone.key, partial: !!cls.phone.partial, equivalents: phoneEquivalentKeys(cls.phone.key) };
    }
  }

  if (plan.barcode) plan.wantsInventory = true;
  if (plan.kind === 'text' && query.length < 2) plan.tooShort = true;
  plan.likePattern = plan.text ? '%' + escapeLike(plan.text) + '%' : '';

  const hasText = !!plan.text;
  plan.run = {
    customers: hasText && !plan.tooShort,
    orders: (hasText && !plan.tooShort) || !!plan.date,
    rentals: hasText && !plan.tooShort,
  };
  return plan;
}

/** גבול שורות לכל קבוצה: 50 כרגיל; שאילתת טקסט קצרה (2 תווים) מחזירה פחות - המטען החציוני שלה היה 43KB (ניתוח B). */
export function rowLimit(plan) {
  if (plan.kind === 'text' && plan.query.length <= 2) return 20;
  return 50;
}

/** מחרוזת ה-IN של יום: [start,end) לכל מפתח יום מועמד - מחושב בשרת מול getIsraelDayRange. כאן רק הרשימה. */
export function dateKeysForOrders(plan) {
  return plan.date ? plan.date.keys.slice() : [];
}
