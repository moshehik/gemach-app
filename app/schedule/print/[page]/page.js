'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PrintDocument } from '@/app/components/schedule/print/PrintShell';
import { parsePageList, parseVersions, versionsParam } from '@/lib/schedule/print/registry';
import { PRINT_FONT_CSS } from '@/lib/schedule/print/font';
import '@/app/components/schedule/print/print.css';

// /schedule/print/<PP-01 | PP-01,PP-15>?date=YYYY-MM-DD[&branch=..][&version=b | PP-03:b,PP-07:a][&downloadPdf=true][&preview=1]
// דף ההדפסה של הלו״ז: מושך GET /api/schedule/print (פעם אחת לכל הדפים) ומרנדר את התבניות
// (app/components/schedule/print/templates.js) בתוך המעטפת המשותפת (PrintShell.js, print.css).
//   - בלי פרמטרים נוספים: window.print() אוטומטי אחרי הטעינה (כמו שאר דפי /print).
//   - downloadPdf=true: רינדור ראש-חסר ל-POST /api/pdf - בלי window.print(); הסימון data-print-ready="true"
//     אומר ל-lib/pdf.js שהדף מוכן.
//   - preview=1: תצוגה מקדימה בתוך האשף (iframe) - בלי הדפסה אוטומטית ובלי סרגל הכפתורים.
// הרשאות: app/schedule/layout.js (page:schedule) + ה-API בודק לכל דף את extraPageKeys שלו (403 -> הודעה).
// המעטפת הגלובלית (תפריט/סרגל) מוסתרת דרך body.hide-global-nav (אותו מנגנון כמו עמדת הלקוח).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function SchedulePrintPage() {
  const params = useParams();
  const sp = useSearchParams();
  const rawPage = decodeURIComponent(String((params && params.page) || ''));
  const date = DATE_RE.test(sp.get('date') || '') ? sp.get('date') : '';
  const branch = sp.get('branch') || '';
  const downloadPdf = sp.get('downloadPdf') === 'true';
  const preview = sp.get('preview') === '1';
  const { keys, bad, removed } = useMemo(() => parsePageList(rawPage), [rawPage]);
  const versions = useMemo(() => versionsParam(parseVersions(sp.get('version') || '', keys)), [sp, keys]);

  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState({ kind: 'info', text: 'טוען את נתוני ההדפסה…' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.body.classList.add('hide-global-nav', 'pp-print-mode');
    return () => document.body.classList.remove('hide-global-nav', 'pp-print-mode');
  }, []);

  useEffect(() => {
    if (!keys.length) {
      setStatus({ kind: 'err', text: bad.length ? `דף לא מוכר: ${bad.join(', ')}` : removed.length ? `הדף הוסר מהסט: ${removed.join(', ')}` : 'לא נבחר דף להדפסה' });
      setReady(true);
      return undefined;
    }
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ page: keys.join(',') });
    if (date) qs.set('date', date);
    if (branch) qs.set('branch', branch);
    if (versions) qs.set('version', versions);
    setStatus({ kind: 'info', text: 'טוען את נתוני ההדפסה…' });
    fetch('/api/schedule/print?' + qs.toString(), { signal: ctrl.signal, credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        let body = null;
        try { body = await res.json(); } catch { /* לא JSON */ }
        if (!res.ok) {
          const msg = res.status === 401 ? 'יש להתחבר מחדש כדי להדפיס.' : res.status === 403 ? ((body && body.error) || 'אין הרשאה להדפיס את הדף.') : (body && body.error) || 'שגיאה בטעינת נתוני ההדפסה';
          setStatus({ kind: 'err', text: msg });
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
  }, [keys, bad, removed, date, branch, versions]);

  useEffect(() => {
    if (!ready || !payload || downloadPdf || preview) return undefined;
    // כמו app/print/delivery-courier: רגע קצר כדי שהגופנים והברקודים יתייצבו, ואז חלון ההדפסה
    const t = setTimeout(() => { try { window.print(); } catch { /* ראש-חסר */ } }, 500);
    return () => clearTimeout(t);
  }, [ready, payload, downloadPdf, preview]);

  const title = payload ? payload.pages.map((p) => p.def.label).join(' · ') : 'הדפסה';
  return (
    <div data-print-ready={ready ? 'true' : undefined} data-print-title={title}>
      {/* הגופן העברי - גיליון נפרד שה-@import בראשו (ר' lib/schedule/print/font.js; אותו דפוס כמו app/print/order) */}
      <style>{PRINT_FONT_CSS}</style>
      {!preview && !downloadPdf ? (
        <div className="pp-toolbar pp-root" dir="rtl">
          <button type="button" onClick={() => window.print()}>הדפסה</button>
          <button type="button" className="sec" onClick={() => window.close()}>סגירה</button>
          <span className="sp" />
          {payload ? <span>{title} · {payload.meta.dateHebrew}</span> : null}
        </div>
      ) : null}
      <PrintDocument payload={payload} status={status} preview={preview} />
    </div>
  );
}
