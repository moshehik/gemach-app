// lib/stockCheckUi.js — הלוגיקה הטהורה של דף "בדיקת מלאי" (app/components/stock/StockCheckPage.js).
//
// מודול ESM טהור: בלי React, בלי DOM, בלי רשת, בלי `@/` — כדי שייבדק ב-node רגיל
// (scripts/stock-check-tests/unit/ui.mjs) ויהיה בטוח גם לשרת וגם ללקוח.
// הכללים כאן הם החלטות הבעלים (scratch/schedule-build/DECISIONS-בדיקת-מלאי.md + החלטות-general-questions, 1-2.10.2026):
//   GQ-06c  שבב הכמות: 3 ומעלה = "טוב" (st-good), פחות מזה = st-mid (כמו בעיצוב המאושר).
//   GQ-06d  אין חסימה של תאריך שעבר — הטופס לא בודק "עבר/עתיד" בכלל.
//   B06     כמה מידות = "וגם"; B07/Q06 בדיקה גמישה ±2 למידה מספרית בלבד (ההסבר בטולטיפ, לא בטקסט קבוע).
//   Q10     הוספת מידה בלחצן 36 (inpx) עם אייקון פלוס; גם Enter / פסיק / רווח בשדה.
// החישוב עצמו בשרת (lib/stockCheck.js) — כאן רק בניית הבקשה, אימות הטופס וטקסטים לתצוגה.

import { normalizeSizeKey } from './sizeSort.js';

export const STOCK_CHECK_API = '/api/stock-check';
export const STOCK_CHECK_OPTIONS_API = '/api/stock-check/options';
export const STOCK_CHECK_STORE_KEY = 'a5StockCheck'; // sessionStorage: הטופס והתוצאה האחרונים (חזרה מכרטיס דגם)

// סף הצבע בשבב הכמות (GQ-06c): 3 ומעלה "טוב".
export const FREE_GOOD_THRESHOLD = 3;

// ההסבר על הגדרת הכמות בבדיקה גמישה (Q06) — מוצג בטולטיפ של כפתור ה-(i) בכותרת "בדיקה גמישה".
export const FLEX_TIP = 'בבדיקה גמישה, הכמות לכל מידה היא סכום הפנוי במידה עצמה ובמידות המועמדות לה, שתי מידות מעלה ומטה. בשורת הדגם מוצג המינימום בין המידות שנבחרו.';

// מידה "מספרית" לצורך בדיקה גמישה — אותו כלל כמו isNumericSize ב-lib/stockCheck.js (מספר שלם חיובי עד 3 ספרות).
export const isNumericSize = (size) => /^\d{1,3}$/.test(String(size ?? '').trim());

// פיצול הקלדה בשדה המידה: פסיקים/רווחים מפרידים, כפולים נזרקים, רווחים נחתכים.
export function parseSizeInput(text) {
  const out = [];
  for (const raw of String(text ?? '').split(/[,\s]+/)) {
    const v = raw.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

// מוסיף מידות לרשימה הנבחרת (בלי כפולים - "06" ו-"6" הן אותה מידה, normalizeSizeKey; מידה חדשה נכנסת לא-גמישה;
// עד 10 מידות, כמו STOCK_CHECK_LIMITS.maxSizes בשרת; עד 20 תווים). מחזיר רשימה חדשה.
export const MAX_SIZES = 10;
export function addSizes(sizes, text) {
  const next = [...sizes];
  for (const v of parseSizeInput(text)) {
    if (v.length > 20 || next.length >= MAX_SIZES) continue;
    const key = normalizeSizeKey(v);
    if (!next.some((z) => normalizeSizeKey(z.v) === key)) next.push({ v, flex: false });
  }
  return next;
}

// מחליף גמישות למידה אחת (מידה שאינה מספר נשארת לא-גמישה — B07).
export function toggleFlex(sizes, v) {
  return sizes.map((z) => (z.v === v ? { ...z, flex: isNumericSize(v) ? !z.flex : false } : z));
}

// אימות לפני בדיקה. מחזיר null כשתקין, אחרת { title, text, focus } להודעת החובה (באנר nb-warning).
export function validateForm({ date, model, sizes }) {
  if (!date) return { title: 'חסר תאריך', text: 'בחרו תאריך לבדיקה.', focus: 'date' };
  if (!String(model || '').trim() && !(sizes && sizes.length)) {
    return { title: 'צריך דגם או מידה', text: 'מלאו לפחות אחד מהם. אפשר גם את שניהם.', focus: 'model' };
  }
  return null;
}

// כתובת הבקשה לשרת. סדר הפרמטרים קבוע (date, model, sizes, flex) — הוא חלק ממפתח המטמון המשותף
// (lib/apiCache.js), ולכן אותה בדיקה פעמיים = אותו מפתח. פרמטר ריק לא נשלח.
export function buildStockCheckUrl({ date, model, sizes }) {
  const p = new URLSearchParams();
  p.set('date', String(date || '').trim());
  const m = String(model || '').trim();
  if (m) p.set('model', m);
  const list = Array.isArray(sizes) ? sizes : [];
  if (list.length) p.set('sizes', list.map((z) => z.v).join(','));
  const flex = list.filter((z) => z.flex && isNumericSize(z.v)).map((z) => z.v);
  if (flex.length) p.set('flex', flex.join(','));
  return STOCK_CHECK_API + '?' + p.toString();
}

export function buildOptionsUrl(key, typed) {
  const p = new URLSearchParams();
  p.set('key', key);
  p.set('typed', String(typed || '').trim().slice(0, 60));
  return STOCK_CHECK_OPTIONS_API + '?' + p.toString();
}

// שבב הכמות: המחלקה (GQ-06c) והכיתוב ("1 פנויה" / "N פנויות").
export const freeChipClass = (n) => (Number(n) >= FREE_GOOD_THRESHOLD ? 'st-good' : 'st-mid');
export const freeLabel = (n) => `${n} ${Number(n) === 1 ? 'פנויה' : 'פנויות'}`;

// הערת הגמישות מתחת לשבבים: "מידה 12 נבדקת גם במידות 10 ו־14 · ..." / "כל מידה נבדקת בדיוק כפי שהוקלדה."
export function flexCandidatesText(v) {
  if (!isNumericSize(v)) return v;
  const n = parseInt(v, 10);
  return 'במידות ' + (n - 2) + ' ו־' + (n + 2);
}
export function flexNote(sizes) {
  const list = Array.isArray(sizes) ? sizes : [];
  if (!list.length) return 'אחרי שמוסיפים מידה אפשר להפעיל לה בדיקה גמישה של שתי מידות מעלה ומטה.';
  const on = list.filter((z) => z.flex && isNumericSize(z.v));
  if (!on.length) return 'כל מידה נבדקת בדיוק כפי שהוקלדה.';
  return on.map((z) => 'מידה ' + z.v + ' נבדקת גם ' + flexCandidatesText(z.v)).join(' · ');
}

// חלקי שורת הסיכום מעל התוצאות: ["תאריך ...", "דגם ...", "מידות 12 ±2, 36"] (הטקסט של התאריך מגיע מהקורא).
export function summaryParts({ dateText, model, sizes }) {
  const parts = [];
  if (dateText) parts.push('תאריך ' + dateText);
  const m = String(model || '').trim();
  if (m) parts.push('דגם ' + m);
  const list = Array.isArray(sizes) ? sizes : [];
  if (list.length) parts.push('מידות ' + list.map((z) => z.v + (z.flex && isNumericSize(z.v) ? ' ±2' : '')).join(', '));
  return parts;
}

// הצעות המידות: מה שהשרת החזיר, בלי מידות שכבר נבחרו (לפי המפתח המנורמל), מסונן לפי מה שהוקלד (הקטע האחרון
// בשדה): "8" מוצא גם "08", "0" לא מסתיר כלום.
export function filterSizeOptions(options, chosen, typed) {
  const have = new Set((chosen || []).map((z) => normalizeSizeKey(z.v)));
  const q = String(typed || '').trim();
  const qk = q ? normalizeSizeKey(q) : '';
  return (options || []).filter((o) => !have.has(normalizeSizeKey(o.v)) && (!q || String(o.v).includes(q) || normalizeSizeKey(o.v).startsWith(qk)));
}
export const lastSizeToken = (text) => (String(text || '').split(/[,\s]+/).pop() || '').trim();

// מצב שנשמר ב-sessionStorage: רק שדות מוכרים, בצורה בטוחה (כל דבר אחר נזרק).
export function sanitizeStoredState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : '';
  const model = typeof raw.model === 'string' ? raw.model.slice(0, 100) : '';
  const sizes = Array.isArray(raw.sizes)
    ? raw.sizes.filter((z) => z && typeof z.v === 'string' && z.v.trim()).slice(0, 10).map((z) => ({ v: z.v.trim().slice(0, 20), flex: !!z.flex && isNumericSize(z.v) }))
    : [];
  const view = raw.view === 'table' ? 'table' : 'rows';
  const res = raw.res && typeof raw.res === 'object' && Array.isArray(raw.res.results) ? raw.res : null;
  if (!date && !model && !sizes.length && !res) return null;
  return { date, model, sizes, view, res };
}
