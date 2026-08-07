'use client';

import { useState, useEffect } from 'react';

export default function TrustedDevicesPage() {
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [devices, setDevices] = useState([]);
  const [isThisDeviceTrusted, setIsThisDeviceTrusted] = useState(false);
  const [label, setLabel] = useState('');
  const [marking, setMarking] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/trusted-device');
      if (res.status === 401) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices || []);
        setIsThisDeviceTrusted(!!data.isThisDeviceTrusted);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleMark = async () => {
    setMarking(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/trusted-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'מחשב זה סומן כמערכת מהימנה. מעכשיו ניתן להתחבר ממנו עם 4 התווים האחרונים של הסיסמה.' });
        setLabel('');
        load();
      } else {
        setMessage({ type: 'error', text: data.message || 'הפעולה נכשלה' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'שגיאת תקשורת' });
    } finally {
      setMarking(false);
    }
  };

  const handleRevoke = async (deviceId) => {
    if (!window.confirm('לבטל את האמון במחשב זה? עובדים שמתחברים ממנו ייאלצו להשתמש בסיסמה המלאה.')) return;
    try {
      const res = await fetch('/api/auth/trusted-device', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deviceId })
      });
      const data = await res.json();
      if (data.success) {
        load();
      } else {
        window.alert(data.message || 'הביטול נכשל');
      }
    } catch (e) {
      window.alert('שגיאת תקשורת');
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <span className="spinner lg" />
        טוען נתונים...
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="empty-state">
        <svg className="icon"><use href="#i-alert-tri" /></svg>
        <p>עמוד זה מוגבל למנהלים בלבד.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1><svg className="icon"><use href="#i-shield" /></svg> מחשבי מערכת מהימנים</h1>
          <p className="page-desc">
            מחשב שמסומן כאן כ&quot;מהימן&quot; מאפשר לכל עובד המתחבר ממנו להזין רק את 4 התווים האחרונים
            של הסיסמה שלו במקום את הסיסמה המלאה - מיועד למחשבים משותפים וקבועים בגמ&quot;ח (לא למחשב
            אישי או ניידים). האמון נקבע לפי המחשב/דפדפן הספציפי (עוגייה), לא לפי הסיסמה - כניסה
            עם 4 תווים בלבד לעולם לא תעבוד ממחשב שלא סומן כאן.
          </p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '20px' }}>
        {isThisDeviceTrusted ? (
          <div className="callout callout-success">
            <svg className="icon"><use href="#i-shield" /></svg>
            המחשב שאתה משתמש בו כרגע כבר מוגדר כמערכת מהימנה
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '15px', margin: '0 0 12px' }}>סמן את המחשב הזה כמהימן</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '1 1 240px', marginBottom: 0 }}>
                <label htmlFor="admin-trusted-devices-label">שם למחשב (לדוגמה: &quot;עמדה קדמית&quot;) - אופציונלי</label>
                <input
                  id="admin-trusted-devices-label"
                  className="input"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder='שם למחשב (לדוגמה: "עמדה קדמית") - אופציונלי'
                />
              </div>
              <button
                type="button"
                onClick={handleMark}
                disabled={marking}
                className="btn btn-primary"
              >
                <svg className="icon"><use href="#i-shield" /></svg>
                {marking ? 'מסמן...' : 'סמן כמחשב מהימן'}
              </button>
            </div>
          </>
        )}
        {message && (
          <div className={message.type === 'success' ? 'callout callout-success' : 'callout callout-danger'} style={{ marginTop: '14px' }}>
            <svg className="icon"><use href={message.type === 'success' ? '#i-check-circle' : '#i-alert-circle'} /></svg>
            {message.text}
          </div>
        )}
      </div>

      <h2 className="section-title">רשימת מחשבים מהימנים</h2>

      {devices.length === 0 ? (
        <div className="empty-state">
          <svg className="icon"><use href="#i-database" /></svg>
          <p>אין עדיין מחשבים המוגדרים כמהימנים.</p>
        </div>
      ) : (
        devices.map(d => (
          <div
            key={d.id}
            className="list-card"
            style={d.revokedAt ? { opacity: .6, background: 'var(--surface-sunken)' } : undefined}
          >
            <svg className="icon" style={{ color: d.revokedAt ? 'var(--text-3)' : 'var(--primary)' }}><use href="#i-database" /></svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>
                {d.label || 'מחשב ללא שם'}
                {d.isThisDevice && <span className="badge badge-success" style={{ marginInlineStart: '6px' }}>המחשב הנוכחי</span>}
              </div>
              <div className="hint" style={{ color: 'var(--text-3)' }}>
                סומן: {d.createdAt ? new Date(d.createdAt).toLocaleDateString('he-IL') : '-'}
                {d.createdByName ? ` על ידי ${d.createdByName}` : ''}
                {d.lastUsedAt ? ` · שימוש אחרון: ${new Date(d.lastUsedAt).toLocaleDateString('he-IL')}` : ''}
                {d.revokedAt ? ' · בוטל' : ''}
              </div>
            </div>
            {!d.revokedAt && (
              <button
                type="button"
                onClick={() => handleRevoke(d.id)}
                className="btn btn-danger-ghost btn-sm"
              >
                <svg className="icon"><use href="#i-trash" /></svg>
                בטל אמון
              </button>
            )}
          </div>
        ))
      )}
    </>
  );
}
