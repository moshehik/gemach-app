'use client';

// PrintPreview - חלון מסך מלא כהה עם גיליונות A4 אמיתיים (הפורט של PK.open ב-print-kit.js): שחור-לבן / צבע עדין, זום, "הדפסה" (הדפדפן מדפיס רק את הגיליונות),
// "הורדה כ-PDF" (שרת ה-PDF; כשנכשל - חלון ההדפסה של הדפדפן עם הסבר, כדי שתמיד אפשר להגיע ל-PDF), Escape / לחיצה על הרקע / מלכודת פוקוס.
// אין window.alert / confirm: הודעות מוצגות בשורה בתוך הסרגל. נטען ע"י openPrintPreview.js (שורש React נפרד על document.body).
import './a5-print.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PRINT_CSS } from './pkCss';
import { downloadSheetsPdf } from './pkPdf';

const withTone = (html, tone) => html.replace(/data-tone="[a-z]+"/, `data-tone="${tone}"`);

/** הדפסת הגיליונות מהדפדפן: מעתיק אותם (בלי הקטנה) ל-#pkPrint, מזריק את כללי ההדפסה ומסתיר את שאר הדף עד afterprint */
function browserPrint(sheets, docTitle) {
  const area = document.getElementById('pkPrint');
  if (!area) return;
  area.innerHTML = sheets.join('');
  const style = document.createElement('style');
  style.id = 'pk-print-css';
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);
  const root = document.documentElement;
  root.classList.add('pk-printing');
  const oldTitle = document.title;
  if (docTitle) document.title = docTitle; // הדפדפן מציע את כותרת המסמך כשם קובץ ה-PDF
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    window.removeEventListener('afterprint', cleanup);
    root.classList.remove('pk-printing');
    style.remove();
    area.innerHTML = '';
    document.title = oldTitle;
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => { try { window.print(); } catch { cleanup(); } }, 60);
}

export default function PrintPreview({ sheets, previewTitle, kind, pdfName, surface, onClose, onDone }) {
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const printBtn = useRef(null);
  const pdfBtn = useRef(null);
  const [tone, setTone] = useState('bw');
  const [zoom, setZoom] = useState(null); // null = התאמה לרוחב
  const [fit, setFit] = useState(1);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(null); // { text, err }
  const isDl = kind === 'download';
  const toned = sheets.map((h) => withTone(h, tone));
  const z = zoom == null ? fit : zoom;

  const computeFit = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const w = el.clientWidth - 32;
    setFit(w < 560 ? 1 : Math.min(1.1, w / 793.7));
  }, []);
  useLayoutEffect(() => {
    computeFit();
    window.addEventListener('resize', computeFit);
    return () => window.removeEventListener('resize', computeFit);
  }, [computeFit]);

  // גלילת הדף שמאחור נחסמת בזמן התצוגה; הפוקוס עובר ללחצן הראשי ומוחזר בסגירה (ע"י openPrintPreview)
  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const first = isDl ? pdfBtn.current : printBtn.current;
    if (first) first.focus();
    return () => { document.documentElement.style.overflow = prev; };
  }, [isDl]);

  // Escape סוגר, Tab נשאר בתוך הסרגל (capture - לפני מאזיני הדף)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !rootRef.current) return;
      const f = [...rootRef.current.querySelectorAll('button:not(:disabled)')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const doPrint = () => {
    browserPrint(toned, isDl ? pdfName : '');
    if (onDone) onDone('print');
  };

  const doPdf = async () => {
    setBusy(true);
    setHint(null);
    try {
      await downloadSheetsPdf({ sheets: toned, surface, base: pdfName });
      setHint({ text: `הקובץ ירד: ${pdfName}.pdf` });
      if (onDone) onDone('pdf');
    } catch (e) {
      const why = (e && e.message) || 'שגיאה לא ידועה';
      setHint({ err: true, text: `יצירת ה-PDF בשרת נכשלה (${why}). נפתח חלון ההדפסה של הדפדפן: בוחרים ״שמירה כ-PDF״ כיעד.` });
      browserPrint(toned, pdfName);
    } finally {
      setBusy(false);
    }
  };

  const onRootClick = (e) => {
    const t = e.target;
    if (!t.closest('.pk-vbar') && !t.closest('.pk-sheet')) onClose(); // לחיצה על הרקע הכהה
  };

  const n = sheets.length;
  const printSecondary = (
    <button type="button" className="pk-vb" id="pkvPrint2" ref={isDl ? printBtn : null} onClick={doPrint}>הדפסה</button>
  );
  const printPrimary = (
    <button type="button" className="pk-vb go" id="pkvPrint" ref={printBtn} onClick={doPrint}>הדפסה</button>
  );
  const pdfPrimary = (
    <button type="button" className="pk-vb go" id="pkvPdf" ref={pdfBtn} disabled={busy} aria-busy={busy} onClick={doPdf}>{busy ? 'מכין קובץ…' : 'הורדה כ-PDF'}</button>
  );
  const pdfSecondary = (
    <button type="button" className="pk-vb" id="pkvPdf2" disabled={busy} aria-busy={busy} onClick={doPdf}>{busy ? 'מכין קובץ…' : 'הורדה כ-PDF'}</button>
  );

  return (
    <div id="pkv" className="on" role="dialog" aria-modal="true" aria-label="תצוגה מקדימה להדפסה" ref={rootRef} onClick={onRootClick}>
      <div className="pk-vbar">
        <div className="pk-vt"><b id="pkvT">{isDl ? `${pdfName}.pdf` : previewTitle}</b><span id="pkvN">{n === 1 ? 'עמוד אחד' : `${n} עמודים`}</span></div>
        <span className={`pk-hint${hint && hint.err ? ' err' : ''}`} id="pkvHint" role="status" aria-live="polite" hidden={!hint}>{hint ? hint.text : ''}</span>
        <span className="pk-sp" />
        <div className="pk-seg" role="group" aria-label="צבע ההדפסה">
          <button type="button" data-pktone="bw" aria-pressed={tone === 'bw'} onClick={() => setTone('bw')}>שחור-לבן</button>
          <button type="button" data-pktone="color" aria-pressed={tone === 'color'} onClick={() => setTone('color')}>צבע עדין</button>
        </div>
        <button type="button" className="pk-vb" id="pkvZo" aria-label="הקטנה" onClick={() => setZoom(Math.max(0.4, z - 0.1))}>−</button>
        <span className="pk-vz" id="pkvZ" aria-live="polite">{Math.round(z * 100)}%</span>
        <button type="button" className="pk-vb" id="pkvZi" aria-label="הגדלה" onClick={() => setZoom(Math.min(2, z + 0.1))}>+</button>
        <button type="button" className="pk-vb" id="pkvZf" onClick={() => setZoom(null)}>התאם</button>
        {isDl ? <>{printSecondary}{pdfPrimary}</> : <>{pdfSecondary}{printPrimary}</>}
        <button type="button" className="pk-vb" id="pkvClose" onClick={onClose}>סגירה</button>
      </div>
      <div className="pk-vscroll" id="pkvScroll" ref={scrollRef}>
        <div id="pkvBox" style={{ '--z': z.toFixed(3) }}>
          {toned.map((h, i) => <div className="pk-sheetbox" key={i} dangerouslySetInnerHTML={{ __html: h }} />)}
        </div>
      </div>
    </div>
  );
}
