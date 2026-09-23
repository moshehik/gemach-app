'use client';

import { useEffect, useState } from 'react';
import NedarimNav from '@/app/admin/_nedarim/NedarimNav';

// תשלומים אחרונים - הסטוריית עסקאות האשראי הכללית של המוסד בנדרים פלוס (לא רק
// הו"ק), Action=GetHistoryJson ב-Manage3 API. נדרים פלוס מגבילים את הפעולה הזו
// ל-20 פניות בשעה ומחזירים לכל היותר 2000 שורות ממוינות מהישן לחדש - לכן טוענים
// עד MAX_FETCH שורות בטעינה אחת (ללא רענון אוטומטי) ומציגים רק את ה-N האחרונות.

const MAX_FETCH = 500;
const SHOW_COUNT = 50;

const CURRENCY_LABEL = { '1': '₪', '2': '$' };

export default function NedarimPaymentsRecentPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/nedarim-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'history', maxId: MAX_FETCH }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'שגיאה בטעינה');
      const all = Array.isArray(result.data) ? result.data : [];
      const recent = all.slice(-SHOW_COUNT).reverse();
      setRows(recent);
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
          <h1>תשלומים אחרונים</h1>
          <div className="page-desc">הסטוריית עסקאות האשראי הכללית של המוסד ({SHOW_COUNT} האחרונות מתוך עד {MAX_FETCH} שנטענו)</div>
        </div>
      </div>

      <NedarimNav current="/admin/nedarim-payments-recent" />

      <div style={{ marginBottom: 16 }}>
        <button type="button" className="btn" disabled={loading} onClick={load}>
          {loading ? 'טוען...' : 'רענן'}
        </button>
        <span className="hint" style={{ marginInlineStart: 8 }}>
          נדרים פלוס מגבילים פעולה זו ל-20 פניות בשעה - אין רענון אוטומטי.
        </span>
      </div>

      {error && <div className="callout callout-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {!loading && !error && (
        <div className="card card-pad">
          <table className="data">
            <thead>
              <tr>
                <th>תאריך ושעה</th>
                <th>שם</th>
                <th>טלפון</th>
                <th>סכום</th>
                <th>סוג עסקה</th>
                <th>הוק</th>
                <th>4 ספרות אחרונות</th>
                <th>מס&apos; אישור</th>
                <th>הערות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.TransactionId}>
                  <td dir="ltr">{r.TransactionTime}</td>
                  <td>{r.ClientName}</td>
                  <td dir="ltr">{r.Phone}</td>
                  <td>{r.Amount} {CURRENCY_LABEL[r.Currency] || r.Currency}</td>
                  <td>{r.TransactionType}</td>
                  <td dir="ltr">{r.KevaId}</td>
                  <td dir="ltr">{r.LastNum}</td>
                  <td dir="ltr">{r.Confirmation}</td>
                  <td>{r.Comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="hint">אין עסקאות להצגה.</div>}
        </div>
      )}
    </div>
  );
}
