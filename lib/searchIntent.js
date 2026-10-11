// lib/searchIntent.js - מנתח "כוונת חיפוש" לפאנל התפוסה / הפריט (טהור: בלי prisma / רשת / DOM, רץ בשרת ובדפדפן ונבדק ב-node:
// scripts/test_search_intent.mjs). מקבל את מה שהוקלד בשורת החיפוש (הראשית או המהירה בתפריט) ומחליט אם להציג פאנל, ואיזה:
//
//   item   ברקוד מלא של פריט (7 ספרות; 8 למודל עם קידומת של 4 ספרות; או "ברקוד N")  -> פאנל "פריט": סטטוס / כמה פעמים הושכר / הזמנות שחייבות אותו.
//   model  ברקוד/קוד של דגם -> פאנל "דגם" (מלאי / תפוסה / רזרבה), בהרחבה לפי הקלט:
//            551                    דגם בלבד (כל המידות)                 [3-4 ספרות]
//            55104                  ברקוד חלקי = קידומת + מידה (בלי המספר הסידורי)   [5-6 ספרות: הקידומת = הכול חוץ משתי הספרות האחרונות]
//            דגם 551 / דגם 551 מידה 4 / מידה 4 דגם 551 / 551 04 / 551 מידה 4
//            דגם <שם הדגם>          (השם בלבד, ללא מילת המפתח, לא מפעיל פאנל: שמות לקוחות ושמות דגמים מתנגשים)
//          + תאריך (עברי או לועזי) בסוף -> הפאנל מחושב לאותו יום ("55104 כ חשוון", "דגם 551 מידה 4 5/10").
//
// החלטות (נבדקות בקובץ הבדיקה):
//   - 1-2 ספרות, ספרות שמתחילות ב-0 (טלפון), 9 ספרות ומעלה: אין פאנל.
//   - 3-6 ספרות הן גם מספר הזמנה (החלטת הבעלים 5.10.2026, lib/searchNormalize.js classifyQuery): הפאנל נוסף ליד תוצאות ההזמנות ולא במקומן,
//     והשרת מחליט אם הקוד באמת שייך לדגם קיים (intent.ambiguous = true) - אם לא, אין פאנל בשקט.
//   - קלט שנשאר בו טקסט שאינו תאריך ("דגם 551 שרה") אינו כוונת פאנל.
//
// מסלול הייבוא: רק lib/searchNormalize.js ו-lib/homeSearchPlan.js (טהורים), כמו planGlobalSearch.

import {
  cleanQuery, israelDayKey, parseGregorianDate, parseHebrewDate, parseKeywords, sizeKey, SHORTCUT_CHARS,
} from './searchNormalize.js';
import { buildDate } from './homeSearchPlan.js';

const INT32_MAX = 2147483647;
const LATIN_SIZE_RE = /^(?:[2-4]?XS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-4]XL)$/i;
const NONE = Object.freeze({ kind: 'none', signature: '' });

/** מידה כפי שמקלידים אותה בנפרד מהדגם: 1-2 ספרות או אות לטינית. (3 ספרות ומעלה = קידומת דגם, לא מידה.) */
function isSizeToken(t) {
  return /^\d{1,2}$/.test(t) || LATIN_SIZE_RE.test(t);
}

/**
 * מה אומרות הספרות לבדן.
 * @returns {{kind:'item', barcode:string}|{kind:'model', prefix:number, size:string|null, partial:boolean, digits:string}|null}
 */
export function digitsMeaning(d) {
  if (!/^\d+$/.test(d) || d[0] === '0') return null;
  const n = d.length;
  if (n <= 2 || n > 8) return null;
  if (n >= 7) return { kind: 'item', barcode: d };
  const prefixText = n >= 5 ? d.slice(0, n - 2) : d; // 5-6 ספרות = קידומת + מידה (ברקוד חלקי); 3-4 = קידומת בלבד
  const prefix = Number(prefixText);
  if (!Number.isSafeInteger(prefix) || prefix > INT32_MAX) return null;
  return { kind: 'model', prefix, size: n >= 5 ? d.slice(n - 2) : null, partial: n >= 5, digits: d };
}

/** תאריך מהזנב של השורה ("כ חשוון" / "5/10" / "תאריך כ חשוון"). null = אין; { invalid } = נראה כמו תאריך אך לא קיים. */
function parseTailDate(text, todayKey) {
  let t = cleanQuery(text);
  if (!t) return null;
  t = t.replace(/^תאריך\s+/, '');
  const g = parseGregorianDate(t);
  const h = g ? null : parseHebrewDate(t);
  if (!g && !h) return undefined; // טקסט שאינו תאריך
  const built = buildDate(g ? 'gregorian' : 'hebrew', g || h, todayKey, { next: true });
  if (!built.key || built.invalid) return { invalid: true };
  return { key: built.key, calendar: built.calendar };
}

function finish(base, dateInfo, todayKey) {
  const out = {
    kind: base.kind,
    barcode: base.barcode || null,
    prefix: base.prefix == null ? null : base.prefix,
    modelName: base.modelName || null,
    sizes: base.sizes || [],
    partial: !!base.partial,
    digits: base.digits || null,
    ambiguous: !!base.ambiguous,
    date: dateInfo ? { key: dateInfo.key, calendar: dateInfo.calendar } : null,
  };
  out.dateKey = out.date ? out.date.key : todayKey;
  out.signature = [out.kind, out.barcode || '', out.prefix == null ? '' : out.prefix, out.modelName || '', out.sizes.map(sizeKey).sort().join(','), out.date ? out.date.key : ''].join('|');
  return out;
}

/**
 * @param {string} input   מה שהוקלד
 * @param {{now?: Date}} [opts]
 * @returns {{kind:'none'|'item'|'model', signature:string, barcode?:string|null, prefix?:number|null, modelName?:string|null, sizes?:string[], partial?:boolean,
 *            digits?:string|null, ambiguous?:boolean, date?:{key:string,calendar:string}|null, dateKey?:string}}
 */
export function parseSearchIntent(input, { now = new Date() } = {}) {
  const q = cleanQuery(input);
  if (!q || q.length < 3 || SHORTCUT_CHARS.includes(q[0])) return NONE;
  const todayKey = israelDayKey(now);
  const kw = parseKeywords(q);

  // --- עם מילות מפתח (דגם / מידה / ברקוד) ---
  if (kw.any) {
    if (kw.orderNumber !== null || kw.phone !== null) return NONE;
    let rest = kw.rest;
    let base = null;
    const sizes = kw.sizes.slice();
    if (kw.barcode !== null) {
      if (kw.model !== null || sizes.length) return NONE;
      const m = digitsMeaning(kw.barcode);
      if (!m) return NONE;
      base = m.kind === 'item' ? { kind: 'item', barcode: m.barcode } : { kind: 'model', prefix: m.prefix, sizes: m.size ? [m.size] : [], partial: true, digits: m.digits };
    } else if (kw.model !== null) {
      if (kw.modelIsPrefix) {
        const m = digitsMeaning(kw.model);
        if (!m || m.kind === 'item') return NONE; // "דגם 6323401" - ברקוד שלם הוא לא מספר דגם
        const withSize = m.size ? [m.size] : [];
        if (m.size && sizes.length) return NONE; // "דגם 55104 מידה 4": סותר
        base = { kind: 'model', prefix: m.prefix, sizes: sizes.length ? sizes : withSize, partial: m.partial, digits: m.digits };
      } else {
        base = { kind: 'model', modelName: kw.model, sizes };
      }
    } else if (sizes.length && rest) {
      // "551 מידה 4": קידומת בלי מילת "דגם" - הטוקן הראשון שנשאר
      const toks = rest.split(' ');
      const m = /^\d{3,4}$/.test(toks[0]) ? digitsMeaning(toks[0]) : null;
      if (!m || m.kind !== 'model') return NONE;
      base = { kind: 'model', prefix: m.prefix, sizes, digits: m.digits };
      rest = toks.slice(1).join(' ');
    } else {
      return NONE;
    }
    let date = null;
    if (rest) {
      const d = parseTailDate(rest, todayKey);
      if (!d || d.invalid) return NONE; // טקסט שנשאר שאינו תאריך
      date = d;
    }
    if (base.kind === 'model' && base.prefix != null) base.ambiguous = true; // השרת מאמת שהקידומת שייכת לדגם
    return finish(base, date, todayKey);
  }

  // --- בלי מילות מפתח ---
  const toks = q.split(' ');
  const first = toks[0];
  const m = digitsMeaning(first);
  if (!m) return NONE;
  const rest = toks.slice(1);
  if (m.kind === 'item') {
    // ברקוד מלא + (אופציונלי) תאריך: הפריט לא תלוי בתאריך, אבל "הזמנות שחייבות אותו" כן - התאריך משפיע רק על הזמינות היום
    if (rest.length) return NONE;
    return finish({ kind: 'item', barcode: m.barcode }, null, todayKey);
  }
  let sizes = m.size ? [m.size] : [];
  let dateText = rest.join(' ');
  // "551 04" / "551 4 כ חשוון": הטוקן הבא הוא מידה (רק אחרי קידומת של 3-4 ספרות; 5-6 ספרות כבר כוללות מידה)
  if (rest.length && !m.partial && isSizeToken(rest[0])) {
    sizes = [rest[0]];
    dateText = rest.slice(1).join(' ');
  }
  let date = null;
  if (dateText) {
    const d = parseTailDate(dateText, todayKey);
    if (!d || d.invalid) return NONE;
    date = d;
  }
  return finish({ kind: 'model', prefix: m.prefix, sizes, partial: m.partial, digits: m.digits, ambiguous: true }, date, todayKey);
}

/** האם יש טעם לשלוח לשרת (הלקוח משתמש בזה כדי לא לקרוא לנתיב על שמות לקוחות וכד'). */
export const wantsPanel = (intent) => !!intent && intent.kind !== 'none';
