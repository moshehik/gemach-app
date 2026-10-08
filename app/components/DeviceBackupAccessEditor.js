'use client';

import { useEffect, useMemo, useState } from 'react';

// עורך "מי רשאי להפעיל מצב גיבוי במחשב שלו" - מתכנת בלבד (GET/PUT /api/admin/db-view/access, ר' lib/deviceBackupAccess.js).
// עובד ברשימה יכול להקליד בשורת החיפוש בדף הבית "עבור למסד הגיבוי" ולאשר בחלונית; מתכנת מורשה תמיד ולכן לא מופיע כאן.
export default function DeviceBackupAccessEditor() {
  const [data, setData] = useState(null); // { ids, employees }
  const [picked, setPicked] = useState(() => new Set());
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/db-view/access', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `שגיאה ${res.status}`);
        if (!live) return;
        setData(json);
        setPicked(new Set(json.ids));
      } catch (e) {
        if (live) setMsg({ ok: false, text: e.message });
      }
    })();
    return () => { live = false; };
  }, []);

  const shown = useMemo(() => {
    const q = filter.trim();
    return (data?.employees || []).filter((e) => !q || e.name.includes(q));
  }, [data, filter]);

  const toggle = (id) => {
    setMsg(null);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/db-view/access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...picked] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `שגיאה ${res.status}`);
      setPicked(new Set(json.ids));
      setMsg({ ok: true, text: `נשמר — ${json.ids.length} עובדים מורשים` });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '14px 0 4px' }}>
      <b style={{ fontSize: '13.5px' }}>עובדים שמורשים להפעיל מצב גיבוי במחשב שלהם</b>
      <p style={{ color: 'var(--text-3)', margin: '2px 0 10px', fontSize: '12.5px' }}>
        עובד שסימנת יכול להקליד בשורת החיפוש בדף הבית &quot;עבור למסד הגיבוי&quot; ולאשר בחלונית. רק אתה (מתכנת) רואה ועורך את הרשימה.
      </p>
      {!data && !msg ? (
        <small style={{ color: 'var(--text-3)' }}>טוען רשימת עובדים…</small>
      ) : data ? (
        <>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="סינון לפי שם"
            style={{ width: '100%', maxWidth: '280px', marginBottom: '8px' }}
            aria-label="סינון עובדים לפי שם"
          />
          <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px' }}>
            {shown.length === 0 ? (
              <small style={{ color: 'var(--text-3)' }}>לא נמצאו עובדים</small>
            ) : shown.map((e) => (
              <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} />
                <span>{e.name}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={save}>
              {busy ? 'שומר…' : 'שמירת הרשימה'}
            </button>
            <small style={{ color: 'var(--text-3)' }}>{picked.size} מסומנים</small>
          </div>
        </>
      ) : null}
      {msg ? (
        <small role="alert" style={{ display: 'block', marginTop: '8px', color: msg.ok ? 'var(--success, #1a7f37)' : 'var(--danger, #c0392b)' }}>{msg.text}</small>
      ) : null}
    </div>
  );
}
