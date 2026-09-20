'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { groupDeliveryRowsForCourier, isoRangeToDates } from '@/lib/deliveryCourier';

// הדפסת "נתונים למשלוחן" (§C, docs/deliveries-feature-plan-2026-09-16.md) - טבלת
// שם/כתובת/2 טלפונים לכל קבוצת כיוון+תאריך אירוע בטווח שנבחר. Query params:
// direction=out|return|both, from=YYYY-MM-DD, to=YYYY-MM-DD (ברירת מחדל: from בלבד).
// שולף מ-/api/deliveries?date= לכל יום בטווח (אותו endpoint שמזין את app/deliveries/page.js)
// ומקבץ בצד הלקוח - אין endpoint ייעודי לטווח, כדי לא לשכפל את לוגיקת החלונות.
export default function PrintDeliveryCourierPage() {
  const searchParams = useSearchParams();
  const direction = ['out', 'return', 'both'].includes(searchParams.get('direction')) ? searchParams.get('direction') : 'both';
  const fromDate = searchParams.get('from') || '';
  const toDate = searchParams.get('to') || fromDate;

  const [groups, setGroups] = useState([]);
  const [gmachName, setGmachName] = useState('גמ"ח שמלות');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const dates = isoRangeToDates(fromDate, toDate);
    if (dates.length === 0) {
      setError('טווח תאריכים לא תקין');
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      Promise.all(dates.map(d => {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return fetch(`/api/deliveries?date=${iso}`, { cache: 'no-store' })
          .then(r => r.json())
          .then(data => ({ dispatchDate: d, rows: data.data || [] }))
          .catch(() => ({ dispatchDate: d, rows: [] }));
      })),
      fetch('/api/settings', { cache: 'no-store' }).then(r => r.json()).catch(() => [])
    ]).then(([rowsByDispatchDate, settingsArr]) => {
      if (cancelled) return;
      setGroups(groupDeliveryRowsForCourier(rowsByDispatchDate, direction));
      const arr = Array.isArray(settingsArr) ? settingsArr : [];
      const name = arr.find(s => s.key === 'gmach_name')?.value;
      if (name) setGmachName(name);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) { setError('שגיאה בטעינת נתוני המשלוחים'); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [fromDate, toDate, direction]);

  useEffect(() => {
    if (!loading && !error && groups.length > 0) {
      const timer = setTimeout(() => window.print(), 400);
      return () => clearTimeout(timer);
    }
  }, [loading, error, groups]);

  return (
    <>
      <style>{`
        body { background-color: #fafafa !important; }
        nav.navbar, .global-sidebar-container, .topbar, .ai-floating-widget, [class*="sidebar"], [id*="sidebar"] {
          display: none !important;
        }
        .print-container {
          background: #fff;
          max-width: 900px;
          margin: 40px auto;
          padding: 35px 45px;
          border: 1px solid #efefef;
          box-shadow: 0 2px 10px rgba(0,0,0,0.03);
          font-family: 'David Libre', 'Times New Roman', Georgia, serif;
          color: #333;
          direction: rtl;
        }
        .courier-group { margin-bottom: 30px; }
        .courier-group h2 { font-size: 15px; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 2px solid #333; }
        .courier-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .courier-table th, .courier-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; }
        .courier-table th { background: #f0f0f0; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
          .print-container { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
          .courier-group { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <div className="print-container">
        <h1 style={{ fontSize: '18px', marginBottom: '20px' }}>{gmachName} — נתוני משלוחים למשלוחן</h1>
        {loading && <p>טוען נתונים...</p>}
        {!loading && error && <p style={{ color: '#c0392b' }}>{error}</p>}
        {!loading && !error && groups.length === 0 && <p>אין משלוחים בטווח/כיוון שנבחרו.</p>}
        {!loading && !error && groups.map((group, idx) => (
          <div className="courier-group" key={`${group.direction}-${group.eventDate}-${idx}`}>
            <h2>{group.title}</h2>
            <table className="courier-table">
              <thead>
                <tr><th>שם מלא</th><th>כתובת</th><th>טלפון 1</th><th>טלפון 2</th></tr>
              </thead>
              <tbody>
                {group.rows.map(r => (
                  <tr key={r.orderId}>
                    <td>{r.customerName}</td>
                    <td>{r.address || '-'}</td>
                    <td dir="ltr">{r.customerPhone || '-'}</td>
                    <td dir="ltr">{r.customerPhone2 || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}
