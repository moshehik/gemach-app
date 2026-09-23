'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import NedarimNav from '@/app/admin/_nedarim/NedarimNav';

// רשימת הוראות קבע (הו"ק) בנדרים פלוס, בדיוק כפי שהיא מוצגת בממשק שלהם - הוראות
// מוקפאות/לא פעילות מוסתרות. מבוסס על Action=GetKevaNew ב-Manage3 API
// (app/lib/nedarimManage.js). לא קשור לדף הניסוי הישן (/admin/nedarim-hok-test),
// שרק יוצר הוק חדש - זה קורא לרשימה האמיתית של כל ההוראות הקיימות.

export default function NedarimHokListPage() {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/nedarim-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'שגיאה בטעינה');
      const data = result.data;
      if (!data) throw new Error('תשובה לא תקינה מנדרים פלוס: ' + (result.raw || ''));
      setRows(data.data || []);
      setTotals({ TotalMonth: data.TotalMonth, TotalYear: data.TotalYear, TotalMonth2: data.TotalMonth2, TotalYear2: data.TotalYear2 });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ direction: 'rtl' }}>
      <div className="page-head">
        <div>
          <h1>רשימת הוראות קבע (הו&quot;ק) בנדרים פלוס</h1>
          <div className="page-desc">רשימת ההוראות הפעילות, בדיוק כפי שהיא מוצגת בממשק הניהול של נדרים פלוס</div>
        </div>
      </div>

      <NedarimNav current="/admin/nedarim-hok-list" />

      {totals && (
        <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', gap: 24 }}>
          <div>סה&quot;כ חודשי (פעילים): <strong>{totals.TotalMonth} ₪</strong></div>
          <div>צפי הכנסות 12 חודשים: <strong>{totals.TotalYear} ₪</strong></div>
        </div>
      )}

      {error && <div className="callout callout-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {loading && <div className="hint">טוען...</div>}

      {!loading && !error && (
        <div className="card card-pad">
          <table className="data">
            <thead>
              <tr>
                <th>מזהה (KevaId)</th>
                <th>שם</th>
                <th>כתובת וטלפון</th>
                <th>סכום</th>
                <th>קטגוריה</th>
                <th>יתרת חיובים</th>
                <th>בוצעו</th>
                <th>חיוב הבא</th>
                <th>שגיאה</th>
                <th>4 ספרות אחרונות</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.DT_RowId}>
                  <td dir="ltr">{r.DT_RowId}</td>
                  <td>{r['2']}</td>
                  <td style={{ whiteSpace: 'pre-line' }}>{r['3']}</td>
                  <td>{r['4']}</td>
                  <td>{r['5']}</td>
                  <td>{r['7']}</td>
                  <td>{r['8']}</td>
                  <td dir="ltr">{r['9']}</td>
                  <td style={{ color: r['10'] ? 'var(--danger)' : undefined }}>{r['10']}</td>
                  <td dir="ltr">{r['11']}</td>
                  <td>
                    <Link href={`/admin/nedarim-hok-edit?kevaId=${r.DT_RowId}`} className="btn btn-sm">עריכה</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="hint">אין הוראות קבע פעילות.</div>}
        </div>
      )}
    </div>
  );
}
