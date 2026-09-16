'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

const PRESET_HOURS = [6, 12, 24, 48];

function formatBytes(n) {
  if (!n && n !== 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('he-IL', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch (e) {
    return iso;
  }
}

const STATUS_META = {
  ok: { label: 'הצליח', cls: 'badge-success', icon: 'i-check-circle' },
  failed: { label: 'נכשל', cls: 'badge-danger', icon: 'i-x-circle' },
  running: { label: 'רץ כעת...', cls: 'badge-info', icon: 'i-refresh' },
};

function RunRow({ run }) {
  const [openError, setOpenError] = useState(false);
  const meta = STATUS_META[run.status] || { label: run.status, cls: 'badge-neutral', icon: 'i-clock' };

  return (
    <div className="list-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span className={`badge ${meta.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <svg className="icon" style={{ width: '13px', height: '13px' }}><use href={`#${meta.icon}`} /></svg>
          {meta.label}
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{formatDateTime(run.startedAt)}</span>
        <span className="hint" style={{ color: 'var(--text-3)' }}>
          {run.trigger === 'manual' ? 'ידני' : 'אוטומטי'}
        </span>
        {run.status === 'ok' && (
          <>
            <span className="hint" style={{ color: 'var(--text-3)' }}>{formatBytes(run.sizeBytes)}</span>
            <span className="hint" style={{ color: 'var(--text-3)' }}>{run.durationSec ? `${run.durationSec.toFixed(0)} שנ'` : ''}</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        {run.status === 'ok' && run.driveUrl && (
          <a href={run.driveUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            <svg className="icon"><use href="#i-download" /></svg>
            הורדה מהדרייב
          </a>
        )}
        {run.status === 'failed' && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenError(!openError)}>
            פרטי השגיאה
          </button>
        )}
      </div>
      {run.status === 'failed' && openError && (
        <div className="callout callout-danger" style={{ margin: 0 }}>
          <svg className="icon"><use href="#i-x-circle" /></svg>
          <span style={{ wordBreak: 'break-word' }}>{run.errorMessage || 'שגיאה לא ידועה.'}</span>
        </div>
      )}
    </div>
  );
}

export default function BackupsPage() {
  const [settings, setSettings] = useState(null);
  const [runs, setRuns] = useState(null);
  const [customHours, setCustomHours] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');
  const pollRef = useRef(null);

  const load = useCallback(() => {
    fetch('/api/admin/backups')
      .then((res) => {
        if (!res.ok) throw new Error('שגיאה בטעינת נתוני הגיבויים');
        return res.json();
      })
      .then((data) => {
        setSettings(data.settings);
        setRuns(data.runs);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  // כל עוד הריצה האחרונה עדיין 'running', ממשיכים לרענן כל 10 שניות כדי לראות
  // מתי היא מסתיימת (הדאמפ בפועל רץ ב-GitHub Actions, לא כאן).
  useEffect(() => {
    const latestRunning = runs && runs[0]?.status === 'running';
    if (latestRunning && !pollRef.current) {
      pollRef.current = setInterval(load, 10000);
    } else if (!latestRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [runs, load]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const intervalHours = customHours ? Number(customHours) : settings.backup_interval_hours;
      const res = await fetch('/api/admin/backups/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, backup_interval_hours: intervalHours }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה');
      setSaveMsg('ההגדרות נשמרו בהצלחה.');
      setCustomHours('');
      load();
    } catch (err) {
      setSaveMsg(`שגיאה: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerMsg('');
    try {
      const res = await fetch('/api/admin/backups/trigger', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בהפעלת גיבוי');
      setTriggerMsg(data.message);
      setTimeout(load, 3000);
    } catch (err) {
      setTriggerMsg(`שגיאה: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  if (error) {
    return (
      <div className="callout callout-danger">
        <svg className="icon"><use href="#i-x-circle" /></svg>
        <span>{error}</span>
      </div>
    );
  }

  if (!settings) {
    return <div className="hint" style={{ padding: '2rem 0' }}>טוען...</div>;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1><svg className="icon"><use href="#i-database" /></svg> גיבוי לדרייב</h1>
          <p className="page-desc">גיבוי ענני אוטומטי של כל נתוני הגמ&quot;ח ל-Google Drive, בנוסף ל-PITR של Neon (7 ימים)</p>
        </div>
        <div className="page-actions">
          <Link href="/admin/site" className="btn btn-secondary">
            <svg className="icon"><use href="#i-arrow-end" /></svg>
            חזרה לניהול
          </Link>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '20px' }}>
        <div className="card-title-row" style={{ marginBottom: '4px' }}>
          <svg className="icon"><use href="#i-clock" /></svg>
          <h2 style={{ fontSize: '15px', margin: 0 }}>גיבוי אוטומטי</h2>
        </div>
        <p style={{ color: 'var(--text-3)', margin: '0 0 16px', fontSize: '12.5px', maxWidth: '640px' }}>
          כל כמה זמן להריץ גיבוי מלא אוטומטית ולהעלות לדרייב. הבדיקה עצמה (האם הגיע הזמן) רצה כל 15 דקות ב-GitHub Actions.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <span className="hint" style={{ color: 'var(--text-3)' }}>
            {settings.backup_enabled ? 'פעיל' : 'כבוי'}
          </span>
          <button
            type="button"
            className={settings.backup_enabled ? 'switch on' : 'switch'}
            onClick={() => setSettings({ ...settings, backup_enabled: !settings.backup_enabled })}
          />
        </div>

        <div className="field">
          <label>תדירות גיבוי</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="toggle-btn-group">
              {PRESET_HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={!customHours && settings.backup_interval_hours === h ? 'on' : ''}
                  onClick={() => { setSettings({ ...settings, backup_interval_hours: h }); setCustomHours(''); }}
                >
                  כל {h} שעות
                </button>
              ))}
            </div>
            <span className="hint">או מספר שעות מותאם אישית:</span>
            <input
              type="number"
              min="1"
              max="336"
              className="input"
              style={{ width: '110px' }}
              placeholder={String(settings.backup_interval_hours)}
              value={customHours}
              onChange={(e) => setCustomHours(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </div>
        </div>

        <div className="field">
          <label>מזהה תיקיית דרייב לגיבויים (רשות)</label>
          <input
            type="text"
            className="input"
            value={settings.backup_drive_folder_id}
            onChange={(e) => setSettings({ ...settings, backup_drive_folder_id: e.target.value })}
            placeholder="ריק = שורש הדרייב של חשבון ה-GAS"
          />
        </div>

        <div className="field">
          <label>כתובת מייל לצפייה/הורדה של הגיבויים</label>
          <input
            type="text"
            className="input"
            value={settings.backup_owner_email}
            onChange={(e) => setSettings({ ...settings, backup_owner_email: e.target.value })}
            placeholder="name@gmail.com"
          />
          <p className="hint" style={{ margin: '4px 0 0' }}>
            בשונה מקבצים ללקוחות, קבצי גיבוי משותפים רק לכתובת הזו - לא לכל מי שמחזיק בקישור.
          </p>
        </div>

        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <svg className="icon"><use href="#i-check-circle" /></svg>
          {saving ? 'שומר...' : 'שמור הגדרות'}
        </button>
        {saveMsg && (
          <div className={`callout ${saveMsg.startsWith('שגיאה') ? 'callout-danger' : 'callout-success'}`} style={{ marginTop: '14px' }}>
            <svg className="icon"><use href={saveMsg.startsWith('שגיאה') ? '#i-x-circle' : '#i-check-circle'} /></svg>
            <span>{saveMsg}</span>
          </div>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: '20px' }}>
        <div className="card-title-row" style={{ marginBottom: '4px' }}>
          <svg className="icon"><use href="#i-play" /></svg>
          <h2 style={{ fontSize: '15px', margin: 0 }}>גיבוי מיידי</h2>
        </div>
        <p style={{ color: 'var(--text-3)', margin: '0 0 16px', fontSize: '12.5px', maxWidth: '640px' }}>
          מריץ גיבוי מלא עכשיו, בלי לחכות לגיבוי האוטומטי הבא. עשוי לקחת כמה דקות עד שהריצה תופיע ברשימה למטה.
        </p>
        <button type="button" className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleTrigger} disabled={triggering}>
          <svg className="icon"><use href="#i-play" /></svg>
          {triggering ? 'שולח בקשה...' : 'גבה עכשיו'}
        </button>
        {triggerMsg && (
          <div className={`callout ${triggerMsg.startsWith('שגיאה') ? 'callout-danger' : 'callout-success'}`} style={{ marginTop: '18px' }}>
            <svg className="icon"><use href={triggerMsg.startsWith('שגיאה') ? '#i-x-circle' : '#i-check-circle'} /></svg>
            <span>{triggerMsg}</span>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="card-title-row" style={{ marginBottom: '4px' }}>
          <svg className="icon"><use href="#i-history" /></svg>
          <h2 style={{ fontSize: '15px', margin: 0 }}>היסטוריית גיבויים ולוג תקלות</h2>
        </div>
        <p style={{ color: 'var(--text-3)', margin: '0 0 16px', fontSize: '12.5px' }}>
          60 הריצות האחרונות, מהחדשה לישנה.
        </p>

        {runs && runs.length === 0 && (
          <div className="hint" style={{ padding: '1rem 0' }}>עדיין לא בוצע אף גיבוי.</div>
        )}
        {runs && runs.length > 0 && (
          <div>
            {runs.map((run) => <RunRow key={run.id} run={run} />)}
          </div>
        )}
      </div>
    </>
  );
}
