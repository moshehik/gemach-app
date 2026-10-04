'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PrintDocument } from '@/app/components/schedule/print/PrintShell';
import { parsePageList, parseVersions, versionsParam } from '@/lib/schedule/print/registry';
import { PRINT_FONT_CSS } from '@/lib/schedule/print/font';
import { hasOrderIdParam, orderModeVersions, parseOrderIdParam, schedulePrintEventBody } from '@/lib/schedule/print/orderMode';
import '@/app/components/schedule/print/print.css';

// /schedule/print/<PP-01 | PP-01,PP-15>?date=YYYY-MM-DD[&branch=..][&version=b | PP-03:b,PP-07:a][&downloadPdf=true][&preview=1]
// דף ההדפסה של הלו״ז: מושך GET /api/schedule/print (פעם אחת לכל הדפים) ומרנדר את התבניות
// (app/components/schedule/print/templates.js) בתוך המעטפת המשותפת (PrintShell.js, print.css).
//   - בלי פרמטרים נוספים: window.print() אוטומטי אחרי הטעינה (כמו שאר דפי /print).
//   - downloadPdf=true: רינדור ראש-חסר ל-POST /api/pdf - בלי window.print(); הסימון data-print-ready="true"
//     אומר ל-lib/pdf.js שהדף מוכן.
//   - preview=1: תצוגה מקדימה בתוך האשף (iframe) - בלי הדפסה אוטומטית ובלי סרגל הכפתורים.
//   - orderId=N (כרטיס ההזמנה, W7): PP-07 / PP-12 להזמנה אחת, בלי date (ר' lib/schedule/print/orderMode.js). הדף רושם בהיסטוריית ההזמנה
//     ORDER_PRINTED {doc:'prep'|'delivery', sheet, source:'print-page'} פעם אחת בטעינה שמדפיסה (לא ב-downloadPdf / preview / דפדפן ראש-חסר);
//     הדפסות יום מרוכזות (בלי orderId) לא נרשמות לכל הזמנה (AMB-20).
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
  const orderIdRaw = sp.get('orderId');
  const orderId = parseOrderIdParam(orderIdRaw);
  const badOrderId = hasOrderIdParam(orderIdRaw) && !orderId; // פרמטר שגוי = שגיאה, לא הדפסת יום שלם בשקט
  const { keys, bad, removed } = useMemo(() => parsePageList(rawPage), [rawPage]);
  // הזמנה בודדת: דף הכנה תמיד בגרסה ב׳ (כמו בשרת)
  const versions = useMemo(() => versionsParam({ ...parseVersions(sp.get('version') || '', keys), ...(orderId ? orderModeVersions(keys) : {}) }), [sp, keys, orderId]);
  const [loadId] = useState(() => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const printLoggedRef = useRef(false);

  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState({ kind: 'info', text: 'טוען את נתוני ההדפסה…' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.body.classList.add('hide-global-nav', 'pp-print-mode');
    return () => document.body.classList.remove('hide-global-nav', 'pp-print-mode');
  }, []);

  useEffect(() => {
    if (badOrderId) {
      setStatus({ kind: 'err', text: 'מספר הזמנה לא תקין' });
      setReady(true);
      return undefined;
    }
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
    if (orderId) qs.set('orderId', String(orderId));
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
  }, [keys, bad, removed, date, branch, versions, orderId, badOrderId]);

  useEffect(() => {
    if (!ready || !payload || downloadPdf || preview) return undefined;
    // כמו app/print/delivery-courier: רגע קצר כדי שהגופנים והברקודים יתייצבו, ואז חלון ההדפסה
    const t = setTimeout(() => { try { window.print(); } catch { /* ראש-חסר */ } }, 500);
    return () => clearTimeout(t);
  }, [ready, payload, downloadPdf, preview]);

  // רישום ORDER_PRINTED להזמנה בודדת (חוזה W0 §1.1/§1.5): רק כשהדף באמת מדפיס - לא ב-PDF, לא בתצוגה מקדימה, לא בדפדפן ראש-חסר
  // (מי שהפיק את הקובץ רושם ORDER_PDF_DOWNLOADED). פעם אחת בטעינה, לכל דף clientEventId משלו.
  useEffect(() => {
    if (!ready || !payload || !orderId || downloadPdf || preview || printLoggedRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.webdriver === true) return;
    if (payload.meta && payload.meta.orderId && payload.meta.orderId !== orderId) return;
    printLoggedRef.current = true;
    for (const p of payload.pages) {
      const body = schedulePrintEventBody({ orderId, pageKey: p.key, loadId });
      if (!body || p.notBuilt) continue;
      fetch('/api/orders/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify(body) }).catch(() => {});
    }
  }, [ready, payload, orderId, downloadPdf, preview, loadId]);

  const title = payload ? payload.pages.map((p) => p.def.label).join(' · ') : 'הדפסה';
  // רינדור ל-PDF (downloadPdf): כשאין מה להדפיס, או שדף שנבחר דולג (אין הרשאה), הדף מסמן data-print-error
  // ו-POST /api/pdf נכשל עם ההודעה הזאת (lib/pdf.js) במקום להחזיר PDF שכל תוכנו הודעת שגיאה / PDF חלקי.
  const skipped = (payload && payload.meta && payload.meta.skipped) || [];
  const printError = !ready ? null
    : status && status.kind === 'err' ? status.text
      : downloadPdf && skipped.length ? `אין הרשאה להדפיס: ${skipped.map((x) => x.label).join(', ')}` : null;
  return (
    <div data-print-ready={ready ? 'true' : undefined} data-print-title={title} data-print-error={printError || undefined}>
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
