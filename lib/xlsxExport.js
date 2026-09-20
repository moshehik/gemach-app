// ייצוא שורות לקובץ Excel (.xlsx) אמיתי, מסודר מימין לשמאל כמו עברית:
// הגיליון עצמו מוגדר RTL (העמודה הראשונה בצד ימין), רוחבי עמודות לפי התוכן, שורת כותרת עם
// מסנן, תאריכים כתאריכי Excel אמיתיים (לא טקסט) ומספרים כמספרים. אין כאן תלות ב-DOM חוץ מהורדה
// בפועל (downloadRowsAsXlsx) - buildRowsWorkbook טהורה ונבדקת ב-Node.
//
// שימו לב: הגרסה החינמית של SheetJS (xlsx@0.18) לא תומכת בעיצוב תאים (הדגשת כותרת/צבעים) -
// לכן שורת הכותרת פשוטה. כיוון הגיליון (RTL), המסנן והרוחבים כן נתמכים.

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const PLAIN_NUMBER = /^-?(0|[1-9]\d{0,14})(\.\d+)?$/; // בלי אפס מוביל: טלפון/ברקוד נשארים טקסט

function israelYmd(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (t) => Number(parts.find(p => p.type === t).value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

export function safeSheetName(name) {
  const cleaned = String(name || 'נתונים').replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return cleaned || 'נתונים';
}

export function safeFileBase(name) {
  return String(name || 'נתונים').replace(/[\\/:*?"<>|]/g, ' ').trim() || 'נתונים';
}

// ממיר ערך גולמי לתא: {v, t, z?}. תאריך ISO -> יום קלנדרי לפי שעון ישראל.
function toCell(raw) {
  if (raw === null || raw === undefined || raw === '') return { t: 's', v: '' };
  if (typeof raw === 'boolean') return { t: 's', v: raw ? 'כן' : 'לא' };
  if (typeof raw === 'number') return Number.isFinite(raw) ? { t: 'n', v: raw } : { t: 's', v: String(raw) };
  if (typeof raw === 'bigint') return { t: 'n', v: Number(raw) };
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return { t: 's', v: '' };
    const { y, m, d } = israelYmd(raw);
    return { t: 'd', v: new Date(Date.UTC(y, m - 1, d)), z: 'dd/mm/yyyy' };
  }
  const s = String(raw);
  if (ISO_DATETIME.test(s)) {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return toCell(dt);
  }
  if (PLAIN_NUMBER.test(s)) return { t: 'n', v: Number(s) };
  return { t: 's', v: s };
}

function cellText(c) {
  if (c.t === 'd') return 'dd/mm/yyyy';
  return String(c.v ?? '');
}

/**
 * @param {object} XLSX - מודול xlsx (מוזרק כדי שאפשר יהיה לטעון אותו בעצלתיים בדפדפן)
 * @param {Array<Object>} rows - שורות (אובייקטים). מפתחות שמתחילים ב-"_" מדולגים.
 * @param {{ sheetName?: string, columns?: string[] }} [opts]
 */
export function buildRowsWorkbook(XLSX, rows, opts = {}) {
  const cols = (opts.columns && opts.columns.length ? opts.columns : Object.keys(rows[0] || {})).filter(k => !String(k).startsWith('_'));
  const header = cols.map(c => ({ t: 's', v: String(c) }));
  const body = rows.map(r => cols.map(c => toCell(r[c])));

  const aoa = [header, ...body];
  const ws = {};
  const widths = cols.map(c => String(c).length);
  aoa.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
      const out = { t: cell.t, v: cell.v };
      if (cell.z) out.z = cell.z;
      ws[ref] = out;
      if (ri > 0) widths[ci] = Math.max(widths[ci], cellText(cell).length);
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(aoa.length - 1, 0), c: Math.max(cols.length - 1, 0) } });
  ws['!cols'] = widths.map(w => ({ wch: Math.min(Math.max(w + 3, 8), 50) }));
  if (cols.length) ws['!autofilter'] = { ref: ws['!ref'] };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(opts.sheetName));
  wb.Workbook = { Views: [{ RTL: true }] };
  return wb;
}

/** מוריד קובץ .xlsx בדפדפן. מחזיר true אם הורד, false אם אין שורות. */
export async function downloadRowsAsXlsx(rows, filename, opts = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const XLSX = await import('xlsx');
  const wb = buildRowsWorkbook(XLSX, rows, opts);
  XLSX.writeFile(wb, `${safeFileBase(filename)}.xlsx`, { cellDates: true });
  return true;
}
