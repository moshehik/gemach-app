'use client';

// dcPrint - נקודות החיבור של לחצני הייצוא / ההדפסה / ההורדה בשורת הכותרת של כרטיס הדגם (xlbtn xlg / xld / xlp + תפריט ההדפסה).
// ייצוא פריטי הדגם ל-Excel אמיתי (lib/xlsxExport.js, אותן עמודות כמו ה-CSV של הדף הישן). הדפסה והורדת PDF של כל ארבעת המסמכים (כרטיס דגם,
// רשימת פריטים ומיקומים, רשימת השכרות, מדבקות ברקוד) = התצוגה המקדימה המעוצבת של app/components/a5-print, תמיד מהמצב השמור של הכרטיס
// (שינויים שלא נשמרו אינם מודפסים). היומן (לשונית היסטוריה) לא חלק מהמסמכים - הוא נשאר על ייצוא הרשימה הרגיל.
import { downloadRowsAsXlsx } from '@/lib/xlsxExport';
import { israelTodayKey } from '../schedule/hebrewCalendar';
import { runPrint } from '../a5-print/runPrint';
import { bcFor, rentalFromServer, stOf, ST_LABEL } from '@/lib/dressCardLogic';

/** say של ערכת הרשימות (a5.say) מעל הטוסט של הכרטיס */
export const sayOf = (ui) => (big, kind = 'info', small = '') => ui.toast(kind === 'error' ? 'error' : 'info', big, small);

export const PRINT_MENU = [
  { act: 'print-card', kind: 'print', which: 'card', icon: 'print', label: 'הדפסת כרטיס דגם' },
  { act: 'print-items', kind: 'print', which: 'items', icon: 'list', label: 'רשימת פריטים ומיקומים' },
  { act: 'print-rentals', kind: 'print', which: 'rentals', icon: 'bag', label: 'רשימת השכרות' },
  { act: 'print-labels', kind: 'print', which: 'labels', icon: 'scan', label: 'מדבקות ברקוד לפריטים' },
  { act: 'pdf-card', kind: 'download', which: 'card', icon: 'file', label: 'הורדה כ-PDF: כרטיס דגם' },
  { act: 'pdf-items', kind: 'download', which: 'items', icon: 'file', label: 'הורדה כ-PDF: רשימת פריטים ומיקומים' },
  { act: 'pdf-rentals', kind: 'download', which: 'rentals', icon: 'file', label: 'הורדה כ-PDF: רשימת השכרות' },
  { act: 'pdf-labels', kind: 'download', which: 'labels', icon: 'file', label: 'הורדה כ-PDF: מדבקות ברקוד' },
];

const handlers = new Map(); // `${which}:${kind}` -> async ({dc, ui, list}) => void
export const registerDressDoc = (which, kind, fn) => handlers.set(`${which}:${kind}`, fn);

// הנתונים שהמסמכים מדפיסים: המצב השמור של הדגם (לא העריכה הנוכחית); הקוד לברקודים = הקוד השמור
const savedData = (dc) => ({ model: dc.saved.model, items: dc.saved.items, prefix: dc.saved.model.code });

// השכרות הדגם: מהמצב הטעון, ובחוסר (הלשונית עוד לא נטענה) - קריאה ישירה לאותו API; null אם נכשל
async function rentalsOf(dc) {
  if (dc.rentals.status === 'ready') return dc.rentals.list;
  try {
    const res = await fetch(`/api/dresses/${dc.dressId}/rentals`);
    if (!res.ok) return null;
    const d = await res.json();
    const today = israelTodayKey();
    return (d.rentals || []).map((x, i) => rentalFromServer(x, i, today));
  } catch { return null; }
}

// list / state / filters: כשהמסמך נפתח מסמל ההדפסה של הרשימה עצמה (לשונית פריטים / השכרות) - השורות והסינון שעל המסך; מהתפריט - הכול
const printDoc = (docId, withRentals) => (kind) => async ({ dc, ui, list, state, filters }) => {
  const data = { ...savedData(dc), list, state, filters };
  if (withRentals) {
    const rentals = await rentalsOf(dc);
    if (!rentals) { ui.toast('error', 'טעינת ההשכרות נכשלה', 'אי אפשר להכין את המסמך עכשיו'); return; }
    data.rentals = rentals;
  }
  await runPrint({ doc: docId, kind, data, say: sayOf(ui) });
};
['print', 'download'].forEach((kind) => {
  registerDressDoc('card', kind, printDoc('model-card', true)(kind));
  registerDressDoc('items', kind, printDoc('model-items', false)(kind));
  registerDressDoc('rentals', kind, printDoc('model-rentals', true)(kind));
  registerDressDoc('labels', kind, printDoc('model-labels', false)(kind));
});

/** מבצע מסמך (print | download) של הדגם; מסמך שאין לו handler - הודעה, בלי שגיאה */
export async function runDressDoc({ dc, ui, kind, which, list, state, filters }) {
  if (dc.dirty) ui.toast('info', 'המסמך מציג את המצב השמור של הכרטיס', 'יש שינויים שעוד לא נשמרו');
  const fn = handlers.get(`${which}:${kind}`);
  if (!fn) {
    ui.toast('info', 'המסמך הזה עדיין לא זמין בכרטיס החדש', 'אפשר להדפיס את כרטיס הדגם מהתפריט');
    return;
  }
  await fn({ dc, ui, list, state, filters });
}

/** שורות ייצוא הפריטים (אותן עמודות כמו ה-CSV של הדף הישן: מידה, מס' סידורי, ברקוד, מיקום, מס' קרטון, בתיקון, לא בשימוש, סיבת אי-שימוש, מחוק) */
export function itemRows(items, prefix) {
  return items.map((i) => ({
    'מידה': i.size, "מס' סידורי": i.serial, 'ברקוד': bcFor(i, prefix), 'מיקום': i.loc, "מס' קרטון": i.carton,
    'בתיקון': i.repair ? 'כן' : 'לא', 'לא בשימוש': i.unused ? 'כן' : 'לא', 'סיבת אי-שימוש': i.why, 'מחוק': i.del ? 'כן' : 'לא', 'סטטוס': ST_LABEL[stOf(i)],
  }));
}

/** ייצוא פריטי הדגם ל-Excel: ברירת מחדל - כל הפריטים השמורים (מה שנשמר); list = הרשימה המסוננת של לשונית הפריטים */
export async function exportItemsXlsx({ dc, ui, list }) {
  const src = list || dc.saved.items;
  const rows = itemRows(src, dc.prefix);
  if (!rows.length) { ui.toast('info', 'אין פריטים לייצוא', ''); return; }
  ui.toast('info', `קובץ Excel של ${rows.length} שורות יורד`, dc.dirty ? 'שינויים שלא נשמרו אינם כלולים בקובץ' : '');
  try { await downloadRowsAsXlsx(rows, `פריטי-דגם-${dc.prefix || dc.dressId}`, { sheetName: 'פריטים' }); } catch (e) { ui.toast('error', 'ייצוא ה-Excel נכשל', (e && e.message) || ''); }
}
