'use client';

import { useState, useEffect } from 'react';

const STATE_BADGE = {
  active: { cls: 'badge badge-success', text: 'פעיל' },
  expired: { cls: 'badge badge-warning', text: 'פג תוקף' },
  revoked: { cls: 'badge badge-danger', text: 'בוטל' },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('he-IL') : '-');

export default function ApiKeysPage() {
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [keys, setKeys] = useState([]);
  const [roles, setRoles] = useState([]);
  const [expiryOptions, setExpiryOptions] = useState([]);
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/api-keys');
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setKeys(data.keys || []);
        setRoles(data.roles || []);
        setExpiryOptions(data.expiryOptionsDays || []);
      } else {
        setMessage({ type: 'error', text: data.message || 'הטעינה נכשלה' });
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'שגיאת תקשורת' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, roleId, expiresInDays: expiresInDays === 'never' ? null : Number(expiresInDays) }),
      });
      const data = await res.json();
      if (data.success) {
        setNewKey({ key: data.key, name: data.apiKey.name });
        setName('');
        load();
      } else {
        setMessage({ type: 'error', text: data.message || 'ההנפקה נכשלה' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'שגיאת תקשורת' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (k) => {
    if (!window.confirm(`לבטל את המפתח "${k.name}"? מי שמחזיק בו לא יוכל להיכנס יותר, וגישת הניהול של מי שכבר נכנס איתו נחסמת תוך עד 15 דקות.`)) return;
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: k.id }),
      });
      const data = await res.json();
      if (data.success) load();
      else window.alert(data.message || 'הביטול נכשל');
    } catch (e) {
      window.alert('שגיאת תקשורת');
    }
  };

  const copy = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch (e) {
      window.prompt('העתק ידנית:', text);
    }
  };

  if (loading && keys.length === 0 && !unauthorized) {
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
        <p>עמוד זה מוגבל למתכנת בלבד.</p>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const curlSnippet = newKey ? `curl -c cookies.txt -X POST ${origin}/api/auth/api-key-login -H "Authorization: Bearer ${newKey.key}"` : '';
  const linkSnippet = newKey ? `${origin}/api/auth/api-key-login?key=${newKey.key}&next=/` : '';

  return (
    <>
      <div className="page-head">
        <div>
          <h1><svg className="icon"><use href="#i-shield" /></svg> מפתחות API</h1>
          <p className="page-desc">
            מפתח מאפשר להיכנס לאתר בלי שם משתמש וסיסמה - לסוכני AI, סקריפטים ובדיקות אוטומטיות. המפתח
            נכנס בהרשאות של התפקיד שנבחר בהנפקה, וכל פעולה שלו מופיעה ביומן השינויים תחת שם המפתח (לא
            תחת עובד אמיתי). המפתח המלא מוצג פעם אחת בלבד בהנפקה - אם אבד, מבטלים ומנפיקים חדש.
            הנפקה וניהול: מתכנת בלבד.
          </p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', margin: '0 0 12px' }}>הנפק מפתח חדש</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 220px', marginBottom: 0 }}>
            <label htmlFor="api-key-name">שם למפתח</label>
            <input
              id="api-key-name"
              className="input"
              type="text"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder='למשל: "בדיקות Claude"'
            />
          </div>
          <div className="field" style={{ flex: '0 1 200px', marginBottom: 0 }}>
            <label htmlFor="api-key-role">הרשאה</label>
            <select id="api-key-role" className="input" value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
              {roles.map((r) => <option key={r.roleId} value={r.roleId}>{r.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '0 1 160px', marginBottom: 0 }}>
            <label htmlFor="api-key-expiry">תוקף</label>
            <select id="api-key-expiry" className="input" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)}>
              {expiryOptions.map((d) => <option key={d} value={d}>{d === 1 ? 'יום אחד' : d === 365 ? 'שנה' : `${d} ימים`}</option>)}
              <option value="never">ללא תפוגה</option>
            </select>
          </div>
          <button type="button" onClick={handleCreate} disabled={creating || !name.trim()} className="btn btn-primary">
            <svg className="icon"><use href="#i-shield" /></svg>
            {creating ? 'מנפיק...' : 'הנפק מפתח'}
          </button>
        </div>
        {message && (
          <div className={message.type === 'success' ? 'callout callout-success' : 'callout callout-danger'} style={{ marginTop: '14px' }}>
            <svg className="icon"><use href={message.type === 'success' ? '#i-check-circle' : '#i-alert-circle'} /></svg>
            {message.text}
          </div>
        )}
      </div>

      {newKey && (
        <div className="card card-pad" style={{ marginBottom: '20px', borderColor: 'var(--warning)' }}>
          <div className="callout callout-warning" style={{ marginBottom: '12px' }}>
            <svg className="icon"><use href="#i-alert-tri" /></svg>
            המפתח &quot;{newKey.name}&quot; הונפק. זו הפעם היחידה שהוא מוצג - העתק אותו עכשיו ושמור במקום בטוח.
          </div>
          {[
            { id: 'key', title: 'המפתח', text: newKey.key },
            { id: 'curl', title: 'כניסה מסקריפט (שומר עוגיות ל-cookies.txt)', text: curlSnippet },
            { id: 'link', title: 'קישור כניסה לדפדפן (המפתח נשאר ב-URL - עדיף מפתח קצר-מועד)', text: linkSnippet },
          ].map((row) => (
            <div key={row.id} style={{ marginBottom: '10px' }}>
              <div className="hint" style={{ color: 'var(--text-3)', marginBottom: '4px' }}>{row.title}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <code dir="ltr" style={{ flex: 1, padding: '8px 10px', background: 'var(--surface-sunken)', borderRadius: '6px', overflowX: 'auto', whiteSpace: 'nowrap', textAlign: 'left' }}>
                  {row.text}
                </code>
                <button type="button" className="btn btn-sm" onClick={() => copy(row.id, row.text)}>
                  {copied === row.id ? 'הועתק ✓' : 'העתק'}
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setNewKey(null)} style={{ marginTop: '6px' }}>
            שמרתי, סגור
          </button>
        </div>
      )}

      <h2 className="section-title">מפתחות קיימים</h2>

      {keys.length === 0 ? (
        <div className="empty-state">
          <svg className="icon"><use href="#i-database" /></svg>
          <p>עדיין לא הונפקו מפתחות.</p>
        </div>
      ) : (
        keys.map((k) => {
          const badge = STATE_BADGE[k.state] || STATE_BADGE.active;
          const roleLabel = roles.find((r) => r.roleId === k.roleId)?.label || `תפקיד ${k.roleId}`;
          return (
            <div key={k.id} className="list-card" style={k.state !== 'active' ? { opacity: 0.6, background: 'var(--surface-sunken)' } : undefined}>
              <svg className="icon" style={{ color: k.state === 'active' ? 'var(--primary)' : 'var(--text-3)' }}><use href="#i-shield" /></svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>
                  {k.name} <span className={badge.cls} style={{ marginInlineStart: '6px' }}>{badge.text}</span>
                </div>
                <div className="hint" style={{ color: 'var(--text-3)' }}>
                  <span dir="ltr">{k.keyPreview}</span> · {roleLabel}
                  {' · '}הונפק: {fmtDate(k.createdAt)}{k.createdByName ? ` על ידי ${k.createdByName}` : ''}
                  {' · '}תוקף עד: {k.expiresAt ? fmtDate(k.expiresAt) : 'ללא תפוגה'}
                  {' · '}שימוש אחרון: {k.lastUsedAt ? fmtDate(k.lastUsedAt) : 'טרם נעשה שימוש'}
                  {k.useCount ? ` (${k.useCount} כניסות)` : ''}
                </div>
              </div>
              {k.state !== 'revoked' && (
                <button type="button" onClick={() => handleRevoke(k)} className="btn btn-danger-ghost btn-sm">
                  <svg className="icon"><use href="#i-trash" /></svg>
                  בטל מפתח
                </button>
              )}
            </div>
          );
        })
      )}
    </>
  );
}
