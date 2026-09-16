'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// הדפסת "נתונים לשקית" (§E, docs/deliveries-feature-plan-2026-09-16.md) - דף A4 לרוחב
// לכל הזמנה עם משלוח הלוך בתאריך שנבחר, מיועד להידוק על שקית האריזה: שם פרטי, שם
// משפחה, כתובת ו-2 מספרי טלפון בפונט גדול. Query param יחיד: date=YYYY-MM-DD - רק
// משלוחי הלוך, בלי בחירת כיוון (המערכת מסננת אוטומטית).
export default function PrintDeliveryBagPage() {
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || '';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('תאריך לא תקין');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/deliveries?date=${date}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setRows((data.data || []).filter(r => r.directions.includes('out')));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError('שגיאה בטעינת נתוני המשלוחים'); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [date]);

  useEffect(() => {
    if (!loading && !error && rows.length > 0) {
      const timer = setTimeout(() => window.print(), 400);
      return () => clearTimeout(timer);
    }
  }, [loading, error, rows]);

  return (
    <>
      <style>{`
        body { background-color: #fafafa !important; }
        nav.navbar, .global-sidebar-container, .topbar, .ai-floating-widget, [class*="sidebar"], [id*="sidebar"] {
          display: none !important;
        }
        .bag-label-page {
          background: #fff;
          width: 277mm;
          min-height: 190mm;
          margin: 20px auto;
          padding: 20mm;
          border: 1px solid #efefef;
          box-shadow: 0 2px 10px rgba(0,0,0,0.03);
          font-family: 'David Libre', 'Times New Roman', Georgia, serif;
          color: #222;
          direction: rtl;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
        }
        .bag-label-name { font-size: 46px; font-weight: 700; margin-bottom: 18px; }
        .bag-label-address { font-size: 30px; margin-bottom: 24px; }
        .bag-label-phones { font-size: 26px; display: flex; gap: 40px; }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          html, body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
          .bag-label-page {
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            min-height: 0 !important;
            height: calc(100vh - 20mm);
            margin: 0 !important;
            break-after: page;
            page-break-after: always;
          }
          .bag-label-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      {loading && <p style={{ padding: 20 }}>טוען נתונים...</p>}
      {!loading && error && <p style={{ padding: 20, color: '#c0392b' }}>{error}</p>}
      {!loading && !error && rows.length === 0 && <p style={{ padding: 20 }}>אין משלוחי הלוך בתאריך זה.</p>}
      {!loading && !error && rows.map(r => (
        <div className="bag-label-page" key={r.orderId}>
          <div className="bag-label-name">{r.customerFirstName} {r.customerLastName}</div>
          <div className="bag-label-address">{r.address || '-'}</div>
          <div className="bag-label-phones">
            {r.customerPhone && <span dir="ltr">{r.customerPhone}</span>}
            {r.customerPhone2 && <span dir="ltr">{r.customerPhone2}</span>}
          </div>
        </div>
      ))}
    </>
  );
}
