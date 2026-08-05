'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, MonitorSmartphone, Trash2, Loader2, AlertTriangle } from 'lucide-react';

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
        setMessage({ type: 'success', text: 'מחשב זה סומן כמערכת מהימנה. מעכשיו ניתן להתחבר ממנו עם 4 הספרות האחרונות של הסיסמה.' });
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
      <div className="container" style={{ paddingTop: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="container" style={{ paddingTop: '3rem', textAlign: 'center' }}>
        <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '1rem' }} />
        <p style={{ color: 'var(--text-muted)' }}>עמוד זה מוגבל למנהלים בלבד.</p>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2.5rem', paddingBottom: '3rem', maxWidth: '760px' }} dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <ShieldCheck size={28} color="var(--primary-color)" />
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: 0 }}>מחשבי מערכת מהימנים</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.6 }}>
        מחשב שמסומן כאן כ"מהימן" מאפשר לכל עובד המתחבר ממנו להזין רק את 4 הספרות האחרונות
        של הסיסמה שלו במקום את הסיסמה המלאה - מיועד למחשבים משותפים וקבועים בגמ"ח (לא למחשב
        אישי או ניידים). האמון נקבע לפי המחשב/דפדפן הספציפי (עוגייה), לא לפי הסיסמה - כניסה
        עם 4 ספרות בלבד לעולם לא תעבוד ממחשב שלא סומן כאן.
      </p>

      <div style={{
        background: 'var(--card-bg, #fff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '14px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        {isThisDeviceTrusted ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#16a34a', fontWeight: 600 }}>
            <ShieldCheck size={20} />
            המחשב שאתה משתמש בו כרגע כבר מוגדר כמערכת מהימנה
          </div>
        ) : (
          <>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>סמן את המחשב הזה כמהימן</h3>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder='שם למחשב (לדוגמה: "עמדה קדמית") - אופציונלי'
                style={{ flex: '1 1 240px', padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid var(--element-border, #cbd5e1)' }}
              />
              <button
                type="button"
                onClick={handleMark}
                disabled={marking}
                className="btn btn-primary"
                style={{ padding: '0.65rem 1.2rem', whiteSpace: 'nowrap' }}
              >
                {marking ? 'מסמן...' : 'סמן כמחשב מהימן'}
              </button>
            </div>
          </>
        )}
        {message && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: message.type === 'success' ? '#166534' : '#991b1b'
          }}>
            {message.text}
          </div>
        )}
      </div>

      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>רשימת מחשבים מהימנים</h3>
      {devices.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>אין עדיין מחשבים המוגדרים כמהימנים.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {devices.map(d => (
            <div key={d.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.9rem 1.1rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #e2e8f0)',
              background: d.revokedAt ? '#f8fafc' : 'var(--card-bg, #fff)',
              opacity: d.revokedAt ? 0.6 : 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <MonitorSmartphone size={20} color={d.revokedAt ? '#94a3b8' : 'var(--primary-color)'} />
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {d.label || 'מחשב ללא שם'} {d.isThisDevice && <span style={{ color: '#16a34a', fontWeight: 500, fontSize: '0.8rem' }}> (המחשב הנוכחי)</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    סומן: {d.createdAt ? new Date(d.createdAt).toLocaleDateString('he-IL') : '-'}
                    {d.createdByName ? ` על ידי ${d.createdByName}` : ''}
                    {d.lastUsedAt ? ` · שימוש אחרון: ${new Date(d.lastUsedAt).toLocaleDateString('he-IL')}` : ''}
                    {d.revokedAt ? ' · בוטל' : ''}
                  </div>
                </div>
              </div>
              {!d.revokedAt && (
                <button
                  type="button"
                  onClick={() => handleRevoke(d.id)}
                  className="btn btn-outline"
                  style={{ color: '#ef4444', borderColor: '#fecaca', padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Trash2 size={15} />
                  בטל אמון
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
