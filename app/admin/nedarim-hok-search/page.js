'use client';

import { useState } from 'react';
import Link from 'next/link';
import NedarimNav from '@/app/admin/_nedarim/NedarimNav';

// חיפוש בהוראות קבע (הו"ק) בנדרים פלוס. אין פעולת "חיפוש" ייעודית ב-API - שני
// מסלולים: מספר הוק מדויק (KevaId) -> Action=GetKevaId (פרטי הוראה מלאים),
// טקסט חופשי (שם/טלפון/ת.ז) -> Action=GetKevaNew (הרשימה המלאה) ומסננים בצד לקוח.

const isDigitsOnly = (s) => /^\d+$/.test(s.trim());

export default function NedarimHokSearchPage() {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState(null); // תוצאת GetKevaId (חיפוש לפי מזהה)
  const [matches, setMatches] = useState(null); // תוצאות GetKevaNew מסוננות (חיפוש טקסט)

  const search = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setError('');
    setDetails(null);
    setMatches(null);
    try {
      if (isDigitsOnly(q)) {
        const res = await fetch('/api/admin/nedarim-manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'details', kevaId: q }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error || 'שגיאה בחיפוש');
        if (!result.data || !result.data.KevaId) {
          // לא נמצא לפי מזהה מדויק - ננסה גם חיפוש טקסט (למקרה שהוקלד ת.ז ולא KevaId)
          await searchByText(q);
        } else {
          setDetails(result.data);
        }
      } else {
        await searchByText(q);
      }
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const searchByText = async (q) => {
    const res = await fetch('/api/admin/nedarim-manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list' }),
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || 'שגיאה בחיפוש');
    const rows = result.data?.data || [];
    const needle = q.toLowerCase();
    const found = rows.filter((r) =>
      String(r['2'] || '').toLowerCase().includes(needle) ||
      String(r['3'] || '').toLowerCase().includes(needle) ||
      String(r.Zeout || '').includes(q) ||
      String(r.Phone || '').includes(q)
    );
    setMatches(found);
  };

  return (
    <div style={{ direction: 'rtl' }}>
      <div className="page-head">
        <div>
          <h1>חיפוש בהוראות קבע (הו&quot;ק)</h1>
          <div className="page-desc">חיפוש לפי מספר הוק (KevaId), שם, טלפון או ת.ז</div>
        </div>
      </div>

      <NedarimNav current="/admin/nedarim-hok-search" />

      <form onSubmit={search} className="card card-pad" style={{ display: 'flex', gap: 8, maxWidth: 640, marginBottom: 16 }}>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="מספר הוק, שם, טלפון או ת.ז"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !query.trim()}>
          {busy ? 'מחפש...' : 'חפש'}
        </button>
      </form>

      {error && <div className="callout callout-danger" style={{ maxWidth: 640 }}>{error}</div>}

      {details && (
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <h3 style={{ marginTop: 0 }}>הוק #{details.KevaId}</h3>
          <table className="data">
            <tbody>
              <tr><td>שם</td><td>{details.KevaName}</td></tr>
              <tr><td>ת.ז</td><td dir="ltr">{details.KevaZeout}</td></tr>
              <tr><td>כתובת</td><td>{details.KevaAdresse} {details.KevaCity}</td></tr>
              <tr><td>טלפון</td><td dir="ltr">{details.KevaPhone}</td></tr>
              <tr><td>מייל</td><td dir="ltr">{details.KevaMail}</td></tr>
              <tr><td>סכום חודשי</td><td>{details.KevaAmount} ₪</td></tr>
              <tr><td>יתרת חיובים</td><td>{details.KevaTashlumim}</td></tr>
              <tr><td>חיוב הבא</td><td dir="ltr">{details.KevaNextDate}</td></tr>
              <tr><td>4 ספרות אחרונות</td><td dir="ltr">{details.KevaLastNum}</td></tr>
              <tr><td>סטטוס</td><td>{{ '1': 'פעילה', '2': 'מוקפאת', '3': 'נמחקה' }[String(details.KevaStatus)] || details.KevaStatus}</td></tr>
            </tbody>
          </table>
          <Link href={`/admin/nedarim-hok-edit?kevaId=${details.KevaId}`} className="btn btn-primary" style={{ marginTop: 12, display: 'inline-block' }}>
            עריכה / גביית תשלום בודד
          </Link>
        </div>
      )}

      {matches && (
        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>{matches.length} תוצאות</h3>
          <table className="data">
            <thead>
              <tr><th>מזהה</th><th>שם</th><th>כתובת וטלפון</th><th>סכום</th><th></th></tr>
            </thead>
            <tbody>
              {matches.map((r) => (
                <tr key={r.DT_RowId}>
                  <td dir="ltr">{r.DT_RowId}</td>
                  <td>{r['2']}</td>
                  <td style={{ whiteSpace: 'pre-line' }}>{r['3']}</td>
                  <td>{r['4']}</td>
                  <td><Link href={`/admin/nedarim-hok-edit?kevaId=${r.DT_RowId}`} className="btn btn-sm">עריכה</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {matches.length === 0 && <div className="hint">לא נמצאו תוצאות תואמות.</div>}
        </div>
      )}
    </div>
  );
}
