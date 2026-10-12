// lib/schedule/itemOrder.js - סדר הפריטים בשורות הלו״ז וההכנות: דגם לפי מספר עולה, ובתוך הדגם מידה עולה (lib/sizeSort.js, sortByModelThenSize).
// נקודה אחת לכל המשטחים: מסך הלו״ז (lib/schedule/loaders.js ממיין את row.items פעם אחת), דף הכנה PP-07, מדבקות PP-08, צ׳ק ליסט PP-09, ייצוא Excel.
// הפריטים נשלפים בלי ORDER BY (סדר הכנסה), וזה מה שיצר "10, 6, 8". פריט בלי מספר דגם ממוין לפי שם הדגם, ופריט בלי דגם ומידה נשאר בסוף. טהור, בלי DB.
import { sortByModelThenSize } from '../sizeSort';

/**
 * @param {any[]} items פריטי itemView של שורת לו״ז ({modelPrefix, model, size}) - או עוטפים שלהם, ואז `view` מחזיר את ה-itemView של העוטף
 * @param {(x:any)=>any} [view] ברירת מחדל: הפריט עצמו
 */
export function sortItemViews(items, view = (x) => x) {
  return sortByModelThenSize(
    items,
    (x) => { const it = view(x); return it && it.modelPrefix !== null && it.modelPrefix !== undefined && String(it.modelPrefix).trim() !== '' ? it.modelPrefix : it && it.model; },
    (x) => { const it = view(x); return it && it.size; },
  );
}
