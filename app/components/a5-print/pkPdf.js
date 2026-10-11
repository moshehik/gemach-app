'use client';

// pkPdf.js - הורדת הגיליונות כ-PDF מהשרת. הדפדפן כבר עימד את הגיליונות (מדידת פריסה אמיתית), לכן השרת מקבל את אותם גיליונות כ-HTML סטטי
// (POST /api/pdf, מצב html: בלי JavaScript, רשת חסומה חוץ מ-Google Fonts, 3MB מקסימום) ומדפיס אותם ב-Chromium - ה-PDF זהה לתצוגה, עמוד לעמוד.
// ההרשאה נקבעת ב-`surface` (lib/printAccessKeys.js PDF_HTML_SURFACE_KEYS -> lib/printAccess.js): בלי התחברות 401, בלי הרשאת הדף 403.
import { escH } from './pkCore';
import { PDF_DOC_CSS, SHEET_CSS } from './pkCss';

/** מסמך HTML עצמאי לשרת ה-PDF */
export function pdfDocumentHtml(sheets, title) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${escH(title)}</title><style>${PDF_DOC_CSS}${SHEET_CSS}</style></head><body>${sheets.join('')}</body></html>`;
}

/** מוריד את הגיליונות כקובץ PDF. זורק שגיאה (עם הודעת השרת) אם נכשל - הקורא נופל להדפסת הדפדפן. base = שם הקובץ בלי סיומת. */
export async function downloadSheetsPdf({ sheets, surface, base }) {
  const { downloadPdf } = await import('@/app/lib/pdfClient');
  await downloadPdf({ html: pdfDocumentHtml(sheets, base), surface, filename: base }, `${base}.pdf`);
}
