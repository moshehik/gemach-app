// lib/schedule/print/xlsx.js — קובץ Excel אחד לכמה דפי לו״ז: גיליון לכל דף, מסודר מימין לשמאל (RTL), בנוי על
// buildRowsWorkbook של lib/xlsxExport.js (תאריכים אמיתיים, מספרים כמספרים, טלפון כטקסט, מסנן בכותרת, רוחבי עמודות).
// buildScheduleWorkbook טהורה (XLSX מוזרק - נבדקת ב-Node); downloadScheduleXlsx טוענת את xlsx בעצלתיים בדפדפן,
// רק בלחיצה (החבילה לא נכנסת ל-bundle של דף הלו״ז).
import { buildRowsWorkbook, safeSheetName, safeFileBase } from '@/lib/xlsxExport';

/**
 * @param {object} XLSX
 * @param {Array<{ sheetName:string, rows:object[], label?:string }>} sheets  (מ-format=rows של /api/schedule/print)
 * @param {string[]} [notices]  "הרשימה עלולה להיות חלקית" (format=rows -> notices, lib/schedule/print/notices.js):
 *                               כשיש - גיליון ראשון "הערות" עם שורה לכל הודעה, כדי שקובץ חלקי לא ייראה שלם
 * @returns {object} workbook (גיליון לכל דף שיש בו שורות; דף ריק מקבל גיליון עם שורת "אין שורות")
 */
export const NOTICES_SHEET = 'הערות';
export function buildScheduleWorkbook(XLSX, sheets, notices = []) {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  if (Array.isArray(notices) && notices.length) {
    const one = buildRowsWorkbook(XLSX, notices.map((n) => ({ 'שימו לב': String(n) })), { sheetName: NOTICES_SHEET });
    used.add(NOTICES_SHEET);
    XLSX.utils.book_append_sheet(wb, one.Sheets[one.SheetNames[0]], NOTICES_SHEET);
  }
  for (const sh of sheets) {
    const rows = sh.rows && sh.rows.length ? sh.rows : [{ 'הערה': 'אין שורות בדף זה' }];
    const one = buildRowsWorkbook(XLSX, rows, { sheetName: sh.sheetName || sh.label });
    let name = safeSheetName(sh.sheetName || sh.label);
    let i = 2;
    while (used.has(name)) name = safeSheetName((sh.sheetName || sh.label).slice(0, 27) + ' ' + i++);
    used.add(name);
    XLSX.utils.book_append_sheet(wb, one.Sheets[one.SheetNames[0]], name);
  }
  wb.Workbook = { Views: [{ RTL: true }] };
  return wb;
}

/** מוריד בדפדפן. מחזיר false כשאין גיליונות. */
export async function downloadScheduleXlsx(sheets, filename, notices = []) {
  if (!Array.isArray(sheets) || !sheets.length) return false;
  const XLSX = await import('xlsx');
  const wb = buildScheduleWorkbook(XLSX, sheets, notices);
  XLSX.writeFile(wb, `${safeFileBase(filename)}.xlsx`, { cellDates: true });
  return true;
}
