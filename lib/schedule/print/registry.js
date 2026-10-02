// lib/schedule/print/registry.js — רשימת 15 דפי ההדפסה של הלו״ז היומי: מקור האמת היחיד למפתחות, תוויות,
// שלבים מזינים, גרסאות, ברקוד, כיוון דף והרשאות. נקרא בשרת (API) ובדפדפן (אשף, דף ההדפסה) - טהור, בלי DB.
//
// מקורות (מחייבים): תצוגות-עיצוב/דפי-הדפסה-עיצוב.html (PAGES, 15 דפים), scratch/schedule-build/DECISIONS-דפי-הדפסה.md
// (תשובות הבעלים PP-01..PP-19 + PQ-01..PQ-10), INVENTORY-print-export.md. המפתחות PP-xx יציבים; 05/06 (העברה בין
// סניפים) מעולם לא היו בסט, 14 (פתקי מסירה) ו-17 (צ׳ק ליסט בדיקת שמלה) הוסרו לפי הבעלים ולכן אינם כאן.
//
// שדות:
//   key          'PP-01' (מזהה יציב, גם בכתובת: /schedule/print/PP-01)
//   num          '01'
//   label        שם הדף בעברית (כמו בתצוגה)
//   chip         שם השלב שמופיע בפס הכותרת של הדף
//   stages       מפתחות השלבים (lib/schedule/stages.js) שמזינים את הדף - הנתונים נלקחים מ-getScheduleDay
//   info         true = "לידיעה בלבד" (אין סימון בוצע, אין ברקוד)
//   barcode      null | { prefix, page:boolean, rows:'order'|'item'|null }  - page = ברקוד "כל הדף" בכותרת (ALL-…),
//                rows = ברקוד בכל שורה/מדבקה (order = קידומת-הזמנה, item = קידומת-הזמנה-מספר פריט)
//   versions     [{ k:'a', label }] כשיש בחירה בזמן ההדפסה (PQ-04, PQ-05); undefined = גרסה אחת
//   perOrderPage 'always' | { version:'b' } | undefined  - כל הזמנה בעמוד A4 משלה (12 תמיד; 07 בגרסה ב)
//   orientation  'portrait' (כל 15 הדפים לאורך; תעודת המשלוח החליפה את "נתונים לשקית" שהיה לרוחב - PQ-06)
//   slim         כותרת צרה (דפי מדבקות 04, 08)
//   extraPageKeys הרשאות דף נוספות ל-page:schedule (any-of) - אותן הרשאות שההדפסות הקיימות דורשות
//                (lib/printAccess.js): מחירים/יתרות -> PRINT_ORDER_PAGE_KEYS; משלוחים -> PRINT_DELIVERIES_PAGE_KEYS;
//                תיקונים -> PRINT_ALTERATIONS_PAGE_KEYS. ריק = page:schedule מספיק (הדף מציג רק מה שהלו״ז כבר מציג).
//   extras       נתונים נוספים שה-API טוען רק לדף הזה (מעבר ל-getScheduleDay): 'orderInfo' = סוג משלוח + סכומי תשלום להזמנות
//                (שאילתה אחת קטנה; לדפים שמציגים חיוב/שולם/יתרה או משלוח/איסוף)
//   replaces     משטח הדפסה קיים שהדף מחליף (תיעוד; אין הסרה אוטומטית)
//   status       'ready' = בנוי (lib/schedule/print/pages/<key>.js + app/components/schedule/print/pages/<Key>.js);
//                'todo' = רשום ומוצג באשף כ"בבנייה", ה-API מחזיר 501
import { PRINT_ORDER_PAGE_KEYS, PRINT_DELIVERIES_PAGE_KEYS, PRINT_ALTERATIONS_PAGE_KEYS } from '@/lib/printAccess';

const AB = (a, b) => [{ k: 'a', label: a }, { k: 'b', label: b }];

export const PRINT_PAGES = [
  { key: 'PP-01', num: '01', label: 'דוח הזמנות כללי', chip: 'הזמנה', stages: ['order'], info: true, barcode: null,
    orientation: 'portrait', extraPageKeys: PRINT_ORDER_PAGE_KEYS, extras: ['orderInfo'], status: 'ready',
    desc: 'הזמנות שנרשמו היום · חיוב, שולם ויתרה · לידיעה בלבד' },
  { key: 'PP-02', num: '02', label: 'סיכום יתרות לגבייה', chip: 'הזמנה', stages: ['order'], info: true, barcode: null,
    orientation: 'portrait', extraPageKeys: PRINT_ORDER_PAGE_KEYS, extras: ['orderInfo'], status: 'todo',
    desc: 'הזמנות עם יתרה לתשלום, מהאירוע הקרוב לרחוק · לידיעה בלבד' },
  { key: 'PP-03', num: '03', label: 'דף תיקונים לביצוע', chip: 'תיקונים', stages: ['repair'], info: false,
    barcode: { prefix: 'REP', page: true, rows: 'item' }, versions: AB('א: לפי תאריך והזמנה', 'ב: לפי דגם ומידה'),
    orientation: 'portrait', extraPageKeys: PRINT_ALTERATIONS_PAGE_KEYS, extras: ['itemInfo'], status: 'ready', replaces: '/print/alterations (alterations_pending)',
    desc: 'סוג התיקון לכל שמלה · גרסה א לפי תאריך והזמנה, גרסה ב לפי דגם ומידה' },
  { key: 'PP-04', num: '04', label: 'מדבקות תיקון', chip: 'תיקונים', stages: ['repair'], info: false,
    barcode: { prefix: 'REP', page: true, rows: 'item' }, orientation: 'portrait', slim: true,
    extraPageKeys: PRINT_ALTERATIONS_PAGE_KEYS, extras: ['itemInfo'], status: 'ready', replaces: '/print/alterations (labels)',
    desc: 'מדבקה לכל שמלה (3×6 בדף) עם ברקוד פריט' },
  { key: 'PP-07', num: '07', label: 'דף הכנה', chip: 'הכנה', stages: ['prep'], info: false,
    barcode: { prefix: 'PRP', page: true, rows: 'order' }, versions: AB('א: דף מרוכז', 'ב: כל הזמנה בעמוד נפרד'),
    perOrderPage: { version: 'b' }, orientation: 'portrait', extraPageKeys: [], status: 'todo',
    desc: 'שמלות להכנה היום · משלוחים קודם · בלי שדה יעד' },
  { key: 'PP-08', num: '08', label: 'מדבקות שמלה', chip: 'הכנה', stages: ['prep'], info: false,
    barcode: { prefix: 'PRP', page: true, rows: 'item' }, orientation: 'portrait', slim: true, extraPageKeys: [], extras: ['orderInfo', 'itemInfo'], status: 'ready',
    desc: 'מדבקה לכל שמלה להדבקה על הקולב או השקית' },
  { key: 'PP-09', num: '09', label: 'צ׳ק ליסט הכנה', chip: 'הכנה', stages: ['prep'], info: false,
    barcode: { prefix: 'PRP', page: true, rows: 'order' }, orientation: 'portrait', extraPageKeys: [], extras: ['itemInfo'], status: 'ready',
    desc: 'בדיקה, גיהוץ ואריזה לכל הזמנה' },
  { key: 'PP-10', num: '10', label: 'דף משלוח הלוך (למשלוחן)', chip: 'משלוח הלוך', stages: ['dout'], info: false,
    barcode: { prefix: 'DOT', page: true, rows: 'order' }, orientation: 'portrait', extraPageKeys: PRINT_DELIVERIES_PAGE_KEYS,
    status: 'todo', replaces: '/print/delivery-courier?direction=out', desc: 'שם, כתובת ושני טלפונים לכל משלוח' },
  { key: 'PP-11', num: '11', label: 'רשימת שליח לפי עיר', chip: 'משלוח הלוך', stages: ['dout'], info: false,
    barcode: { prefix: 'DOT', page: true, rows: 'order' }, orientation: 'portrait', extraPageKeys: PRINT_DELIVERIES_PAGE_KEYS,
    status: 'todo', desc: 'מסלול ליום המשלוח, מקובץ לפי עיר, עם תיבת ׳נמסר׳' },
  { key: 'PP-12', num: '12', label: 'תעודות משלוח', chip: 'משלוח הלוך', stages: ['dout'], info: false,
    barcode: { prefix: 'DOT', page: true, rows: null }, perOrderPage: 'always', orientation: 'portrait',
    extraPageKeys: PRINT_DELIVERIES_PAGE_KEYS, status: 'todo', replaces: '/print/delivery-bag',
    desc: 'תעודת משלוח עם חתימת מקבלת · כל הזמנה בעמוד נפרד' },
  { key: 'PP-13', num: '13', label: 'דף איסוף מקומי', chip: 'איסוף מקומי', stages: ['pick'], info: false,
    barcode: { prefix: 'PCK', page: true, rows: 'order' }, orientation: 'portrait', extraPageKeys: PRINT_ORDER_PAGE_KEYS,
    extras: ['orderInfo'], status: 'todo', desc: 'מי מגיעה לקחת את השמלות היום · יתרה לתשלום · בלי סניף' },
  { key: 'PP-15', num: '15', label: 'רשימת אירועים', chip: 'אירוע', stages: ['event'], info: true, barcode: null,
    orientation: 'portrait', extraPageKeys: [], extras: ['orderInfo'], status: 'ready', desc: 'האירועים של היום · לידיעה בלבד' },
  { key: 'PP-16', num: '16', label: 'דף קבלת החזרות', chip: 'החזרה ידנית', stages: ['manret'], info: false,
    barcode: { prefix: 'MRT', page: true, rows: 'order' }, orientation: 'portrait', extraPageKeys: [], status: 'todo',
    desc: 'מי מחזירה בסניף היום · פירוט לכל פריט עם תקין / לא תקין (להדפסה בלבד, PQ-01)' },
  { key: 'PP-18', num: '18', label: 'דף משלוח חזור (למשלוחן)', chip: 'משלוח חזור', stages: ['dback'], info: false,
    barcode: { prefix: 'DBK', page: true, rows: 'order' }, orientation: 'portrait', extraPageKeys: PRINT_DELIVERIES_PAGE_KEYS,
    status: 'todo', replaces: '/print/delivery-courier?direction=return', desc: 'שם, כתובת ושני טלפונים לכל איסוף' },
  { key: 'PP-19', num: '19', label: 'רשימת איסוף מלקוחות לפי עיר', chip: 'משלוח חזור', stages: ['dback'], info: false,
    barcode: { prefix: 'DBK', page: true, rows: 'order' }, orientation: 'portrait', extraPageKeys: PRINT_DELIVERIES_PAGE_KEYS,
    status: 'todo', desc: 'מסלול ליום האיסוף, מקובץ לפי עיר, עם תיבת ׳נאסף׳' },
];

export const PRINT_PAGE_BY_KEY = Object.fromEntries(PRINT_PAGES.map((p) => [p.key, p]));
export const PRINT_PAGE_KEYS = PRINT_PAGES.map((p) => p.key);
// מפתחות שהוסרו מהסט (לא נבנים; נשמרים כאן רק כדי שהאשף/ה-API יוכלו להסביר "הוסר" ולא "לא קיים")
export const REMOVED_PAGE_KEYS = { 'PP-14': 'פתקי מסירה - הוסר לפי הבעלים (1.10.2026)', 'PP-17': 'צ׳ק ליסט בדיקת שמלה - הוסר לפי הבעלים (1.10.2026)' };

export const PAGE_KEY_RE = /^PP-\d{2}$/;

export function getPrintPage(key) {
  return PRINT_PAGE_BY_KEY[key] || null;
}

export function pagesForStage(stageKey) {
  return PRINT_PAGES.filter((p) => p.stages.includes(stageKey));
}

/** גרסת ברירת המחדל של דף (או null כשאין גרסאות) */
export function defaultVersion(page) {
  return page && page.versions ? page.versions[0].k : null;
}

/** האם v היא גרסה חוקית לדף */
export function isValidVersion(page, v) {
  if (!page || !page.versions) return v === null || v === undefined || v === '';
  return page.versions.some((x) => x.k === v);
}

/** האם הדף מודפס "הזמנה בכל עמוד" בגרסה הנתונה */
export function isPerOrderPage(page, version) {
  if (!page || !page.perOrderPage) return false;
  if (page.perOrderPage === 'always') return true;
  return page.perOrderPage.version === version;
}

/**
 * מפרש את פרמטר ה-page של הכתובת: 'PP-01' | 'PP-01,PP-15' | 'PP-01+PP-15'. מחזיר { keys, bad, removed }:
 * keys = מפתחות קיימים לפי סדר הבקשה (בלי כפילויות), bad = מחרוזות שאינן מפתח, removed = מפתחות שהוסרו מהסט.
 */
export function parsePageList(raw) {
  const keys = [];
  const bad = [];
  const removed = [];
  const seen = new Set();
  for (const part of String(raw || '').split(/[,+ ]/)) {
    const k = part.trim().toUpperCase();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    if (PRINT_PAGE_BY_KEY[k]) keys.push(k);
    else if (REMOVED_PAGE_KEYS[k]) removed.push(k);
    else bad.push(part.trim());
  }
  return { keys, bad, removed };
}

/**
 * מפרש את פרמטר הגרסאות: 'b' (לדף יחיד) או 'PP-03:b,PP-07:a'. מחזיר { 'PP-03': 'b', ... } רק לערכים חוקיים.
 */
export function parseVersions(raw, keys) {
  const out = {};
  const s = String(raw || '').trim();
  if (!s) return out;
  if (!s.includes(':')) {
    if (keys.length === 1) {
      const p = PRINT_PAGE_BY_KEY[keys[0]];
      if (p && p.versions && isValidVersion(p, s.toLowerCase())) out[p.key] = s.toLowerCase();
    }
    return out;
  }
  for (const part of s.split(',')) {
    const [k, v] = part.split(':').map((x) => (x || '').trim());
    const p = PRINT_PAGE_BY_KEY[k.toUpperCase()];
    if (p && p.versions && isValidVersion(p, v.toLowerCase())) out[p.key] = v.toLowerCase();
  }
  return out;
}

/** 'PP-03:b,PP-07:a' מתוך מפת גרסאות (לבניית כתובת) */
export function versionsParam(map) {
  return Object.entries(map || {}).filter(([k, v]) => v && PRINT_PAGE_BY_KEY[k]).map(([k, v]) => `${k}:${v}`).join(',');
}

/** מה שבטוח לשלוח לדפדפן על דף (בלי פונקציות/מפתחות הרשאה) */
export function publicPageInfo(page) {
  if (!page) return null;
  const { key, num, label, chip, stages, info, barcode, versions, perOrderPage, orientation, slim, status, desc } = page;
  return { key, num, label, chip, stages, info, barcode, versions: versions || null, perOrderPage: perOrderPage || null, orientation, slim: !!slim, status, desc };
}
