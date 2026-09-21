'use client';

import { useEffect, useState } from 'react';

// מסך בדיקת מיילים: מקלידים כתובת אחת ושולחים אליה מייל לדוגמה מכל סוג בקטלוג
// (lib/emailCatalog.js). לעולם לא נשלח ללקוחות/עובדים אמיתיים - רק לכתובת שהוקלדה.
// כל דוגמה נשלחת בבקשה נפרדת, כדי ש"שלח הכל" יעבוד גם עם שרת עם מגבלת זמן קצרה.

const STATUS_LABEL = { idle: 'טרם נשלח', sending: 'שולח...', ok: 'נשלח', error: 'נכשל' };
const STATUS_CLASS = { idle: 'badge', sending: 'badge badge-warning', ok: 'badge badge-success', error: 'badge badge-danger' };

export default function EmailTestPage() {
  const [types, setTypes] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState({});
  const [status, setStatus] = useState({}); // id -> { state, message }
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // { id, name, subject, html } | { loading: true }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/email-test', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'שגיאה בטעינה');
        setTypes(data.types || []);
        setSelected(Object.fromEntries((data.types || []).map(t => [t.id, true])));
      } catch (e) {
        setLoadError(e.message);
      }
    })();
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());

  const sendOne = async (id) => {
    setStatus(s => ({ ...s, [id]: { state: 'sending' } }));
    try {
      const res = await fetch('/api/admin/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), id }),
      });
      const data = await res.json();
      const ok = res.ok && data.success;
      setStatus(s => ({ ...s, [id]: { state: ok ? 'ok' : 'error', message: ok ? '' : (data.message || data.error || 'שגיאה') } }));
    } catch (e) {
      setStatus(s => ({ ...s, [id]: { state: 'error', message: e.message } }));
    }
  };

  const sendMany = async (ids) => {
    if (!emailValid || ids.length === 0) return;
    if (ids.length > 1 && ids[0] !== 'ALL' && !window.confirm(`לשלוח ${ids.length} מיילי דוגמה אל ${to.trim()}?`)) return;
    setBusy(true);
    for (const id of ids) {
      await sendOne(id);
    }
    setBusy(false);
  };

  const openPreview = async (id, name) => {
    setPreview({ id, name, loading: true });
    try {
      const res = await fetch(`/api/admin/email-test?preview=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה');
      setPreview({ id, name, subject: data.subject, html: data.html });
    } catch (e) {
      setPreview({ id, name, error: e.message });
    }
  };

  const selectedIds = types.filter(t => selected[t.id]).map(t => t.id);
  const allSelected = types.length > 0 && selectedIds.length === types.length;
  const grouped = types.reduce((acc, t) => { (acc[t.category] = acc[t.category] || []).push(t); return acc; }, {});

  return (
    <div style={{ direction: 'rtl' }}>
      <div className="page-head">
        <div>
          <h1>בדיקת מיילים</h1>
          <div className="page-desc">שליחת מייל לדוגמה מכל סוג מיילי המערכת - לכתובת שתקליד בלבד, עם נתוני דמה</div>
        </div>
      </div>

      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
        <div className="field">
          <label htmlFor="email-test-to">כתובת מייל לקבלת הדוגמאות</label>
          <input
            id="email-test-to"
            type="email"
            dir="ltr"
            className="input"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="name@example.com"
          />
        </div>
        <div className="hint">
          כל הדוגמאות מסומנות ב-&quot;[דוגמה]&quot; בנושא, נשלחות רק לכתובת הזו, ונרשמות ביומן המיילים. שים לב: לחשבון Gmail יש מכסת שליחה יומית, ושליחת כל 16 הסוגים בנפרד צורכת 16 הודעות ממנה, ו&quot;שלח את כולם במייל אחד&quot; צורכת הודעה אחת. שתי הדוגמאות עם צרופות מצרפות מסמך אמיתי של הזמנה אחרונה כלשהי במערכת.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" disabled={busy || !emailValid || selectedIds.length === 0} onClick={() => sendMany(selectedIds)}>
            {busy ? 'שולח...' : `שלח את המסומנים (${selectedIds.length})`}
          </button>
          <button type="button" className="btn btn-primary" disabled={types.length === 0} onClick={() => openPreview('ALL', 'כל 16 המיילים')}>
            צפייה בכל 16 המיילים
          </button>
          <button type="button" className="btn" disabled={busy || !emailValid || types.length === 0} onClick={() => sendMany(['ALL'])}>
            {status.ALL?.state === 'sending' ? 'שולח...' : 'שלח את כולם במייל אחד (עם צרופות)'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || types.length === 0}
            onClick={() => setSelected(Object.fromEntries(types.map(t => [t.id, !allSelected])))}
          >
            {allSelected ? 'בטל סימון הכל' : 'סמן הכל'}
          </button>
        </div>
        {status.ALL && status.ALL.state !== 'sending' && (
          <div className={`callout ${status.ALL.state === 'ok' ? 'callout-success' : 'callout-danger'}`}>
            {status.ALL.state === 'ok' ? 'נשלח מייל אחד עם כל הדוגמאות והצרופות.' : `השליחה נכשלה: ${status.ALL.message}`}
          </div>
        )}
      </div>

      {loadError && <div className="callout callout-danger" style={{ marginTop: 16 }}>{loadError}</div>}

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="card card-pad" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>{category}</h3>
          <table className="data">
            <thead>
              <tr><th style={{ width: 36 }}></th><th>מייל</th><th>מפעיל / נמען אמיתי</th><th>נושא (לדוגמה)</th><th>סטטוס</th><th></th></tr>
            </thead>
            <tbody>
              {items.map(t => {
                const st = status[t.id] || { state: 'idle' };
                return (
                  <tr key={t.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`סמן ${t.name}`}
                        checked={!!selected[t.id]}
                        onChange={e => setSelected(s => ({ ...s, [t.id]: e.target.checked }))}
                      />
                    </td>
                    <td>
                      <strong>{t.name}</strong>
                      {t.attachments && t.attachments !== 'ללא' && <div className="hint">צרופות: {t.attachments}</div>}
                    </td>
                    <td>
                      <div>{t.trigger}</div>
                      <div className="hint">נמען אמיתי: {t.recipients}</div>
                    </td>
                    <td>{t.subject}</td>
                    <td>
                      <span className={STATUS_CLASS[st.state]}>{STATUS_LABEL[st.state]}</span>
                      {st.message && <div className="hint" style={{ color: 'var(--danger)' }}>{st.message}</div>}
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm" onClick={() => openPreview(t.id, t.name)}>
                        צפייה
                      </button>{' '}
                      <button type="button" className="btn btn-sm" disabled={busy || !emailValid} onClick={() => sendMany([t.id])}>
                        שלח דוגמה
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {preview && (
        <div
          role="dialog"
          aria-label={`תצוגת מייל: ${preview.name}`}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: 16 }}
          onClick={() => setPreview(null)}
        >
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 900, width: '100%', margin: '0 auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border, #ddd)' }}>
              <div>
                <strong>{preview.name}</strong>
                {preview.subject && <div className="hint">נושא: {preview.subject}</div>}
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setPreview(null)}>סגור</button>
            </div>
            {preview.loading && <div className="card-pad">טוען...</div>}
            {preview.error && <div className="callout callout-danger">{preview.error}</div>}
            {preview.html && <iframe title={preview.name} srcDoc={preview.html} style={{ flex: 1, border: 0, width: '100%', background: '#f3eee8' }} />}
          </div>
        </div>
      )}
    </div>
  );
}
