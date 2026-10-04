'use client';

// /print/order-history?orderId=N[&category=a,b][&q=...][&downloadPdf=1] — הדפסה / PDF של "פעולות ושינויים" של הזמנה אחת
// (כרטיס ההזמנה החדש, A21; W6). אותו סינון וחיפוש שעל המסך (ocHistoryModel.historyPrintPath), אותן שורות כמו ייצוא ה-Excel
// (exportRows): פעולה · תאריך עברי · שעה · קודם · חדש · עובד מבצע · סכום - בלי תאריך לועזי.
// כללי דפי ההדפסה: CSS מוטבע, 0 משתני ערכת נושא (חלון הדפסה לא יורש את הערכה), data-print-ready לשרת ה-PDF (lib/pdf.js).
// downloadPdf=1 (או רינדור headless) = בלי חלון הדפסה. הרישום (HISTORY_EXPORTED) נעשה בכרטיס בלחיצה - הדף עצמו לא רושם.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getHebrewDateString, getIsraelDateKey } from '../../../lib/hebrewDate';
import { exportRows, HISTORY_CATEGORIES, HISTORY_EXTRAS } from '../../components/order-card/parts/ocHistoryModel';

const COLS = ['פעולה', 'תאריך', 'שעה', 'קודם', 'חדש', 'עובד מבצע', 'סכום'];
const CAT_NAME = Object.fromEntries([...HISTORY_CATEGORIES, ...HISTORY_EXTRAS].map((c) => [c[0], c[1]]));
const IL_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
// the Israel calendar day of an instant, as local noon - the headless PDF renderer runs in UTC
const hebrewToday = (d) => { const [y, m, dd] = getIsraelDateKey(d).split('-').map(Number); return getHebrewDateString(new Date(y, m - 1, dd, 12)); };
const fmtAmt = (n) => (typeof n === 'number' && n ? `${n < 0 ? '−' : ''}₪${Math.abs(n).toLocaleString('he-IL')}` : '');

export default function PrintOrderHistoryPage() {
  const sp = useSearchParams();
  const orderId = String(sp.get('orderId') || '').replace(/[^0-9]/g, '').slice(0, 10);
  const category = String(sp.get('category') || '').replace(/[^a-z,]/g, '');
  const q = String(sp.get('q') || '').slice(0, 200);
  const isPdf = ['1', 'true'].includes(sp.get('downloadPdf'));
  const [state, setState] = useState({ loading: true, error: '', rows: [], truncated: false, gmach: '' });
  const [printedAt] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!orderId) { setState((s) => ({ ...s, loading: false, error: 'חסר מספר הזמנה' })); return; }
      try {
        const p = new URLSearchParams({ all: '1' });
        if (category) p.set('category', category);
        if (q.trim()) p.set('q', q.trim());
        const [hr, sr] = await Promise.all([
          fetch(`/api/orders/${orderId}/history?${p.toString()}`, { cache: 'no-store' }),
          fetch('/api/settings', { cache: 'no-store' }).catch(() => null),
        ]);
        if (!hr.ok) throw new Error(hr.status === 403 ? 'אין הרשאה לצפות בהיסטוריה' : 'טעינת ההיסטוריה נכשלה');
        const h = await hr.json();
        const settings = sr && sr.ok ? await sr.json().catch(() => []) : [];
        const gmach = (Array.isArray(settings) && (settings.find((s) => s.key === 'gmach_name') || {}).value) || 'גמ״ח שמלות';
        if (alive) setState({ loading: false, error: '', rows: exportRows(h.entries || []), truncated: !!h.exportTruncated, gmach });
      } catch (e) {
        if (alive) setState((s) => ({ ...s, loading: false, error: e.message || 'טעינת ההיסטוריה נכשלה' }));
      }
    })();
    return () => { alive = false; };
  }, [orderId, category, q]);

  useEffect(() => {
    if (state.loading || state.error || isPdf) return undefined;
    const headless = typeof navigator !== 'undefined' && navigator.webdriver === true;
    if (headless) return undefined;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [state.loading, state.error, isPdf]);

  const filters = [
    category ? `סינון: ${category.split(',').map((k) => CAT_NAME[k] || k).join(', ')}` : null,
    q.trim() ? `חיפוש: ${q.trim()}` : null,
  ].filter(Boolean);

  return (
    <>
      <style>{`
        body { background:#fafafa !important; }
        nav.navbar, .global-sidebar-container, .topbar, .ai-floating-widget, [class*="sidebar"], [id*="sidebar"] { display:none !important; }
        .ohp { background:#fff; max-width:1000px; margin:30px auto; padding:32px 36px; border:1px solid #eee; direction:rtl; color:#222; font-family:'Rubik','Assistant',Arial,sans-serif; }
        .ohp h1 { margin:0 0 4px; font-size:22px; color:#1d2a44; }
        .ohp .sub { color:#555; font-size:13px; margin-bottom:16px; }
        .ohp table { width:100%; border-collapse:collapse; font-size:12.5px; }
        .ohp thead th { background:#1d2a44 !important; color:#f1dc8f !important; position:static !important; box-shadow:none !important; text-align:right; padding:7px 8px; font-weight:600; border:0 !important; }
        .ohp td { border-bottom:1px solid #e3e3e3; padding:6px 8px; vertical-align:top; text-align:right; }
        .ohp td.n { white-space:nowrap; direction:ltr; text-align:left; }
        .ohp tr:nth-child(even) td { background:#f7f7f9; }
        .ohp .msg { padding:30px; text-align:center; color:#555; }
        .ohp div:has(> table) { max-height:none !important; overflow:visible !important; }
        @media print {
          @page { size:A4 landscape; margin:10mm; }
          body { background:#fff !important; }
          .ohp { margin:0; padding:0; border:0; max-width:none; }
          .ohp tr { break-inside:avoid; }
          .ohp thead { display:table-header-group; }
        }
      `}</style>
      <div className="ohp" data-print-ready={state.loading ? undefined : 'true'}>
        <h1>{`היסטוריית הזמנה #${orderId}`}</h1>
        <div className="sub">
          {[state.gmach, `הופק ${hebrewToday(printedAt)} · ${IL_TIME.format(printedAt)}`, ...filters, state.loading ? null : `${state.rows.length} רישומים`].filter(Boolean).join(' · ')}
          {state.truncated ? ' · מוצגים 2000 הרישומים האחרונים' : ''}
        </div>
        {state.loading ? <div className="msg">טוען...</div> : state.error ? <div className="msg">{state.error}</div> : !state.rows.length ? <div className="msg">לא נמצאו רישומים</div> : (
          <div>
            <table>
              <thead><tr>{COLS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {state.rows.map((r, i) => (
                  <tr key={i}>
                    <td><b>{r['פעולה']}</b>{r['פרטים'] ? <div style={{ color: '#666', fontSize: 11.5 }}>{r['פרטים']}</div> : null}</td>
                    <td>{r['תאריך']}</td>
                    <td className="n">{r['שעה']}</td>
                    <td>{r['קודם']}</td>
                    <td>{r['חדש']}</td>
                    <td>{r['עובד מבצע']}</td>
                    <td className="n">{fmtAmt(r['סכום'])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
