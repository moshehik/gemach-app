'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AttendancePrintDocument } from '@/app/components/attendance/print/AttendancePrintSheets';
import { PRINT_FONT_CSS } from '@/lib/schedule/print/font';
import '@/app/components/attendance/print/attendancePrint.css';
import '@/app/components/schedule/print/print.css';

// /attendance/print?type=full|summary|byemp&ids=a,b&y=2026&m=8[&downloadPdf=true][&preview=1]
// דף ההדפסה של "סיכום נוכחות" (לפי הדפוס של /schedule/print/[page]): מושך GET /api/attendance-sheet?scope=print ומרנדר את
// הגיליונות (AttendancePrintSheets.js) בתוך המעטפת המשותפת של דפי ההדפסה (PrintShell.js + print.css, "עמוד X מתוך Y" מ-@page).
//   - בלי פרמטרים נוספים: window.print() אוטומטי אחרי הטעינה.
//   - downloadPdf=true: רינדור ל-POST /api/pdf (lib/printAccess.js: '/attendance/print' = כל מחובר); data-print-ready / data-print-error.
//   - preview=1: תצוגה מקדימה בתוך הדף (iframe) - בלי הדפסה אוטומטית ובלי סרגל.
// הרשאות: ה-API (lib/attendance/access.js) - הנהלה: כל עובד ושכר; עובד רגיל: רק הוא עצמו, בלי שכר. אין כאן שער נוסף.
const NUM = /^\d+$/;

export default function AttendancePrintPage() {
  const sp = useSearchParams();
  const type = sp.get('type') || 'full';
  const ids = sp.get('ids') || '';
  const y = NUM.test(sp.get('y') || '') ? sp.get('y') : '';
  const m = NUM.test(sp.get('m') || '') ? sp.get('m') : '';
  const downloadPdf = sp.get('downloadPdf') === 'true';
  const preview = sp.get('preview') === '1';
  const qs = useMemo(() => {
    const u = new URLSearchParams({ scope: 'print', type });
    if (ids) u.set('ids', ids);
    if (y) u.set('y', y);
    if (m) u.set('m', m);
    return u.toString();
  }, [type, ids, y, m]);

  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState({ kind: 'info', text: 'טוען את נתוני ההדפסה…' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.body.classList.add('hide-global-nav', 'pp-print-mode');
    return () => document.body.classList.remove('hide-global-nav', 'pp-print-mode');
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/attendance-sheet?' + qs, { signal: ctrl.signal, credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        let body = null;
        try { body = await res.json(); } catch { /* לא JSON */ }
        if (!res.ok) {
          setStatus({ kind: 'err', text: res.status === 401 ? 'יש להתחבר מחדש כדי להדפיס.' : (body && body.error) || 'שגיאה בטעינת נתוני ההדפסה' });
          setPayload(null);
        } else if (!body || !body.sheets || !body.sheets.length) {
          setStatus({ kind: 'err', text: body && body.type === 'byemp' ? 'לא נמצאו נתוני נוכחות.' : 'לא נמצאו נתוני נוכחות לחודש זה.' });
          setPayload(null);
        } else {
          setPayload(body);
          setStatus(null);
        }
        setReady(true);
      })
      .catch((e) => {
        if (e && e.name === 'AbortError') return;
        setStatus({ kind: 'err', text: 'לא ניתן לטעון את נתוני ההדפסה כרגע.' });
        setReady(true);
      });
    return () => ctrl.abort();
  }, [qs]);

  // תצוגה מקדימה בתוך הדף (iframe צר): הגיליון (210 מ"מ) מוקטן לרוחב החלון; בהדפסה zoom חוזר ל-1 (attendancePrint.css)
  useEffect(() => {
    if (!preview || !payload) return undefined;
    const fit = () => {
      const paper = document.querySelector('.pp-paper');
      if (paper) paper.style.zoom = String(Math.min(1, (window.innerWidth - 16) / 810));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [preview, payload]);

  useEffect(() => {
    if (!ready || !payload || downloadPdf || preview) return undefined;
    const t = setTimeout(() => { try { window.print(); } catch { /* ראש-חסר */ } }, 500);
    return () => clearTimeout(t);
  }, [ready, payload, downloadPdf, preview]);

  const title = payload ? (payload.sheets.length === 1 ? payload.sheets[0].title : payload.typeLabel) + (payload.period ? ' · ' + payload.period.label : '') : 'הדפסה';
  const printError = ready && status && status.kind === 'err' ? status.text : null;
  return (
    <div data-print-ready={ready ? 'true' : undefined} data-print-title={title} data-print-error={printError || undefined}>
      <style>{PRINT_FONT_CSS}</style>
      {!preview && !downloadPdf ? (
        <div className="pp-toolbar pp-root" dir="rtl">
          <button type="button" onClick={() => window.print()}>הדפסה</button>
          <button type="button" className="sec" onClick={() => window.close()}>סגירה</button>
          <span className="sp" />
          {payload ? <span>{title}</span> : null}
        </div>
      ) : null}
      <AttendancePrintDocument payload={payload} status={status} preview={preview} />
    </div>
  );
}
