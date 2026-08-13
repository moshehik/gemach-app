'use client';

import { useState, useEffect } from 'react';

// Admin-only switch for app/api/admin/db-mode — points the LIVE deployed site
// (all visitors, not just this admin) at the TEST/backup database instead of
// PROD. See app/lib/prisma.js for how the flag is stored/read. Flipping it on
// makes the site-wide BackupModeBanner start blinking for everyone.
export default function WebBackupModeToggle() {
  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const fetchMode = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/db-mode');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `שגיאה ${res.status}`);
      setMode(json.mode);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMode(); }, []);

  const changeMode = async (newMode) => {
    if (newMode === mode || busy) return;
    const warning = newMode === 'test'
      ? 'האתר החי יעבור להציג ולשמור נתונים על מסד הגיבוי (Test) לכל מי שנכנס אליו, עד שיוחזר ידנית. להמשיך?'
      : 'האתר החי יחזור להציג ולשמור על מסד הנתונים האמיתי (Prod) לכל מי שנכנס אליו. להמשיך?';
    if (!window.confirm(warning)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/db-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `שגיאה ${res.status}`);
      setMode(json.mode);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '18px 0', borderBottom: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: '15px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg className="icon" style={{ width: '16px', height: '16px', color: 'var(--text-3)' }}><use href="#i-database" /></svg>
        מסד נתונים פעיל באתר החי
      </h3>
      <p className="hint" style={{ color: 'var(--text-3)', margin: '0 0 14px', fontSize: '12.5px' }}>
        קובע לאיזה מסד נתונים מחובר האתר עבור <strong>כל</strong> מי שנכנס אליו כרגע — לא רק אליך. במצב גיבוי מוצג פס אדום מהבהב בראש המסך לכל המשתמשים.
      </p>

      {loading ? (
        <div className="loading-inline">
          <span className="spinner" />
          טוען מצב נוכחי...
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => changeMode('prod')}
            className={`btn btn-sm ${mode === 'prod' ? 'btn-primary' : 'btn-secondary'}`}
          >
            מסד אמיתי (Prod)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => changeMode('test')}
            className={`btn btn-sm ${mode === 'test' ? 'btn-danger' : 'btn-secondary'}`}
          >
            מסד גיבוי (Test)
          </button>
          {mode === 'test' && (
            <span className="badge badge-danger" style={{ fontSize: '11.5px' }}>האתר החי כרגע במצב גיבוי</span>
          )}
        </div>
      )}

      {error && (
        <div className="callout callout-danger" style={{ marginTop: '12px', alignItems: 'center' }}>
          <svg className="icon"><use href="#i-alert-circle" /></svg>
          <span style={{ flex: 1 }}>{error}</span>
        </div>
      )}
    </div>
  );
}
