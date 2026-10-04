'use client';

// OcExports — שני לחצני הכלים בשורת הכותרת (slot Exports): ייצוא ההזמנה ל-Excel (A1, xlbtn.xlg) והורדת סיכום ההזמנה כקובץ PDF (A2, xlbtn.xld).
// העיצוב: .tools > .xlbtn.xlg + .xlbtn.xld (אייקונים מוטבעים - XlGlyph). Excel נבנה מהנתונים שכבר בכרטיס (מצב השרת האחרון: מה שנשמר) בדפדפן,
// בעברית בלבד בכל תאריך; PDF = אותו HTML של "הדפסת סיכום" → /api/pdf (כמו מייל ההזמנה בישן). שני הכפתורים רושמים להיסטוריה
// (ORDER_XLSX_EXPORTED / ORDER_PDF_DOWNLOADED) דרך oc.logEvent. כשיש שינויים שלא נשמרו - הודעה שהקובץ כולל רק את מה שנשמר.
import { useRef, useState } from 'react';
import { XlGlyph } from '../OcIcon';
import { downloadOrderPdf, exportOrderXlsx } from './ocDocsActions';

const UNSAVED_NOTE = 'שינויים שלא נשמרו אינם כלולים בקובץ';

// ייצוא ה-Excel טוען ספרייה כבדה (xlsx) שחוסמת את החוט הראשי; ממתינים לציור הטוסט לפני כן כדי שיופיע מיד (rAF לא רץ בלשונית מוסתרת - לכן גם טיימר)
const afterPaint = () => new Promise((resolve) => {
  const t = setTimeout(resolve, 120);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); resolve(); }));
});

export default function OcExports({ oc, ui }) {
  const [busy, setBusy] = useState(null); // 'xlsx' | 'pdf' | null
  const busyRef = useRef(null);
  const orderId = oc.order && oc.order.orderId;

  // כמו בעיצוב: הטוסט ("הקובץ יורד") מופיע מיד בלחיצה, וההורדה עצמה רצה ברקע; כישלון = טוסט שגיאה
  const run = async (kind) => {
    if (busyRef.current || !orderId) return;
    busyRef.current = kind; setBusy(kind);
    ui.toast('info', kind === 'xlsx' ? 'קובץ Excel של ההזמנה יורד' : 'סיכום ההזמנה יורד כקובץ', oc.dirty ? UNSAVED_NOTE : `הזמנה ${orderId}`);
    try {
      await afterPaint();
      if (kind === 'xlsx') {
        const r = await exportOrderXlsx({ oc, orderId });
        if (!r.ok) ui.toast('error', 'אין מה לייצא בהזמנה זו', '');
      } else {
        await downloadOrderPdf({ oc, orderId });
      }
    } catch (e) {
      ui.toast('error', kind === 'xlsx' ? 'ייצוא ה-Excel נכשל' : 'הורדת הקובץ נכשלה', (e && e.message) || '');
    } finally {
      busyRef.current = null; setBusy(null);
    }
  };

  return (
    <>
      <button type="button" className="xlbtn xlg" data-act="export-xlsx" aria-label="ייצוא ל-Excel" data-tip="ייצוא ההזמנה לקובץ Excel" aria-busy={busy === 'xlsx' || undefined} disabled={busy === 'xlsx'} onClick={() => run('xlsx')}>
        <XlGlyph kind="excel" />
      </button>
      <button type="button" className="xlbtn xld" data-act="export-pdf" aria-label="הורדה" data-tip="הורדת סיכום ההזמנה כקובץ" aria-busy={busy === 'pdf' || undefined} disabled={busy === 'pdf'} onClick={() => run('pdf')}>
        <XlGlyph kind="download" />
      </button>
    </>
  );
}
