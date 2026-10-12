// lib/schedule/itemOrder.js - סדר הפריטים בשורות הלו״ז וההכנות: דגם לפי מספר עולה, ובתוך הדגם מידה עולה (lib/sizeSort.js, sortByModelThenSize).
// נקודה אחת לכל המשטחים: מסך הלו״ז (lib/schedule/loaders.js ממיין את row.items פעם אחת), דף הכנה PP-07, מדבקות PP-08, צ׳ק ליסט PP-09, ייצוא Excel.
// הפריטים נשלפים בלי ORDER BY (סדר הכנסה), וזה מה שיצר "10, 6, 8". פריט בלי מספר דגם ממוין לפי שם הדגם, ופריט בלי דגם ומידה נשאר בסוף. טהור, בלי DB.
import { sortByModelThenSize } from '../sizeSort';

function cmpId(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  const na = Number(a); const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a) < String(b) ? -1 : 1;
}

/**
 * @param {any[]} items פריטי itemView של שורת לו״ז ({modelPrefix, model, size}) - או עוטפים שלהם, ואז `view` מחזיר את ה-itemView של העוטף
 * @param {(x:any)=>any} [view] ברירת מחדל: הפריט עצמו
 * @param {{tieById?:boolean}} [opts] tieById: שוויון מלא (אותו דגם ואותה מידה) נשבר לפי id הפריט - הסדר דטרמיניסטי ולא תלוי בסדר השליפה מה-DB (מדבקות PP-08: מספר השמלה k).
 *   בלי זה השוויון משאיר את סדר הקלט (מסך הלו״ז).
 */
export function sortItemViews(items, view = (x) => x, opts = {}) {
  const base = opts.tieById ? [...(items || [])].sort((a, b) => cmpId(view(a) && view(a).orderItemId, view(b) && view(b).orderItemId)) : items;
  return sortByModelThenSize(
    base,
    (x) => { const it = view(x); return it && it.modelPrefix !== null && it.modelPrefix !== undefined && String(it.modelPrefix).trim() !== '' ? it.modelPrefix : it && it.model; },
    (x) => { const it = view(x); return it && it.size; },
  );
}
