'use client';

import { useState } from 'react';

export default function BulkEmailPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [enabled, setEnabled] = useState(null);

  useState(() => {}, []);
  // בדיקת toggle
  useState(() => {});

  const checkToggle = async () => {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      const arr = await res.json();
      const v = Array.isArray(arr) ? arr.find(s => s.key === 'bulk_email_by_event_date')?.value : null;
      setEnabled(v === 'true');
    } catch { setEnabled(true); }
  };
  if (enabled === null && typeof window !== 'undefined') { checkToggle(); }

  const handleSend = async () => {
    if (!fromDate || !subject || !body) { alert('חובה תאריך + נושא + תוכן'); return; }
    if (!await window.customConfirm?.(`לשלוח מייל לכל הלקוחות עם אירוע ב-${fromDate}${toDate ? ` עד ${toDate}` : ''}?`) && !window.confirm('לשלוח?')) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/bulk-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDate, toDate, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'שגיאה'); return; }
      setResult(data);
      // טען מעקב
      const logsRes = await fetch(`/api/bulk-email?batchId=${encodeURIComponent(data.batchId)}`);
      const logsData = await logsRes.json();
      setLogs(logsData.logs || []);
    } catch (e) { alert('שגיאה: ' + e.message); }
    finally { setSending(false); }
  };

  if (enabled === false) {
    return (
      <div className="card card-pad">
        <h1>שליחת מייל לפי תאריך אירוע</h1>
        <p className="hint">התכונה כבויה. הפעל בהגדרות מערכת → אוטומציה → &quot;שליחת מייל לפי תאריך אירוע&quot;.</p>
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl' }}>
      <div className="page-head">
        <div>
          <h1>שליחת מייל לפי תאריך אירוע (22)</h1>
          <div className="page-desc">מייל לכל לקוח עם אירוע בתאריך/טווח + מעקב שליחה</div>
        </div>
      </div>
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
        <div className="form-grid">
          <div className="field">
            <label>מתאריך אירוע</label>
            <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="field">
            <label>עד תאריך (אופציונלי)</label>
            <input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>נושא</label>
          <input type="text" className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="נושא המייל..." />
        </div>
        <div className="field">
          <label>תוכן</label>
          <textarea className="textarea" style={{ minHeight: 140 }} value={body} onChange={e => setBody(e.target.value)} placeholder="תוכן ההודעה..." />
        </div>
        <button type="button" className="btn btn-primary" disabled={sending} onClick={handleSend}>
          {sending ? 'שולח...' : 'שלח לכל האירועים בטווח'}
        </button>
        {result && (
          <div className="callout callout-success">
            נשלח ל-{result.sent} מתוך {result.recipients} נמענים (batch: {result.batchId})
            {result.errors?.length > 0 && <div>שגיאות: {result.errors.join('; ')}</div>}
          </div>
        )}
      </div>
      {logs.length > 0 && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h3>מעקב שליחה ואישורים ({logs.length})</h3>
          <p className="hint" style={{ marginTop: -4, marginBottom: 8 }}>
            כל מייל נשלח עם קישור &quot;אישור קבלת ההודעה&quot; אישי. העמודה &quot;אישור&quot; מציגה מי לחץ עליו ומתי.
          </p>
          <table className="data">
            <thead><tr><th>נמען</th><th>נושא</th><th>סטטוס שליחה</th><th>נשלח</th><th>אישור</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td dir="ltr">{l.to}</td>
                  <td>{l.subject}</td>
                  <td><span className={`badge ${l.status === 'success' ? 'badge-success' : 'badge-danger'}`}>{l.status}</span></td>
                  <td>{l.sentAt ? new Date(l.sentAt).toLocaleString('he-IL') : ''}</td>
                  <td>
                    {l.acknowledgedAt ? (
                      <span className="badge badge-success" title={new Date(l.acknowledgedAt).toLocaleString('he-IL')}>
                        אישר · {new Date(l.acknowledgedAt).toLocaleString('he-IL')}
                      </span>
                    ) : (
                      <span className="badge badge-warning">טרם אישר</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
