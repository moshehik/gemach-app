'use client';

// exportList.js - ייצוא רשימה (לחצני xlbtn xlg / xld / xlp) על העזרים הקיימים באתר: Excel = lib/xlsxExport (xlsx אמיתי, RTL),
// הורדה = שרת ה-PDF (app/lib/pdfClient), הדפסה = חלון הדפסה עצמאי (אותה מוסכמה כמו היסטוריית כרטיס הלקוח: HTML בלי משתני CSS).
// זו ברירת המחדל "הזמנית" של השלב הראשון: דפי ההדפסה / ה-PDF המעוצבים (print-kit.js בעיצוב המאושר) ייכנסו בשלב הבא דרך
// exportSpec.onExport של כל דף - הוא החלק היחיד שמוחלף (ר' docs/a5-staff-models/kit-notes.md, "ייצוא").

import { downloadRowsAsXlsx, safeFileBase } from '@/lib/xlsxExport';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** HTML עצמאי להדפסה / PDF: כותרת + שורת סינון + טבלה (head = כותרות, rows = מערך שורות של מחרוזות). */
export function listExportHtml({ title, subtitle = '', head, rows }) {
  const th = head.map((h) => `<th>${esc(h)}</th>`).join('');
  const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;background:#fff}h1{font-size:20px;margin:0 0 6px}.sub{font-size:12px;color:#555;margin:0 0 12px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:6px 8px;text-align:right;vertical-align:top}
th{background:#eee}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body><h1>${esc(title)}</h1>${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></body></html>`;
}

/**
 * מריץ ייצוא. kind: 'excel' | 'download' | 'print'. say = a5.say של הדף (טוסט). head = כותרות עמודות, rows = מערך שורות (ערכים פשוטים).
 * מחזיר true כשבוצע. אין שורות -> טוסט "אין מה לייצא".
 */
export async function runListExport({ kind, say, title, subtitle = '', head, rows, base }) {
  if (!rows.length) { say('אין שורות לייצוא', 'warn', 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים'); return false; }
  const file = safeFileBase(base || title);
  try {
    if (kind === 'excel') {
      const objs = rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
      await downloadRowsAsXlsx(objs, file, { sheetName: title, columns: head });
      say(`קובץ Excel של ${rows.length} שורות ירד`, 'ok');
    } else if (kind === 'download') {
      say('מכין קובץ…', 'info');
      const { downloadPdf } = await import('@/app/lib/pdfClient');
      await downloadPdf({ html: listExportHtml({ title, subtitle, head, rows }), filename: file }, `${file}.pdf`);
      say('הרשימה ירדה כקובץ PDF', 'ok');
    } else {
      const w = window.open('', '_blank', 'width=1000,height=800');
      if (!w) { say('הדפדפן חסם את חלון ההדפסה', 'error'); return false; }
      w.document.open();
      w.document.write(listExportHtml({ title, subtitle, head, rows }));
      w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch { /* החלון נסגר */ } }, 300);
    }
    return true;
  } catch (e) {
    say((e && e.message) || 'הייצוא נכשל', 'error');
    return false;
  }
}
