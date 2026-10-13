'use client';

// TermsFileManager - העלאת קובץ התקנון בהגדרות (הנהלה ראשית / מתכנת): הקובץ שבתוקף, היסטוריית גרסאות (הקבצים הישנים נשארים כראיה), העלאה והסרה.
// מדבר עם /api/admin/terms-file. הלקוחות רואות את הקובץ בעמוד הציבורי /terms (ובעמדה) דרך GET /api/public-terms.
// מותר: PDF (מומלץ), PNG, JPG עד 4MB; קובץ Word יש לשמור כ-PDF (הדפדפן לא יכול להציג Word).
// variant: 'sim' (מסך ההגדרות החדש - מחלקות הפלטה) | 'legacy' (מסך ההגדרות הישן).
import { useCallback, useEffect, useRef, useState } from 'react';
import { getHebrewDateString } from '@/lib/hebrewDate';

const TYPE_LABEL = { 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPG' };
const when = (iso) => (iso ? getHebrewDateString(new Date(iso)) : '');

export default function TermsFileManager({ variant = 'sim', onDone, onError }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const inputRef = useRef(null);
  const legacy = variant === 'legacy';
  const btn = legacy ? 'btn btn-secondary btn-sm' : 'btn ghost sm';
  const btnPrimary = legacy ? 'btn btn-primary btn-sm' : 'btn navy sm';

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/terms-file', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 401 ? 'אין הרשאה לנהל את קובץ התקנון' : 'טעינה נכשלה');
      setData(await res.json());
      setMsg('');
    } catch (e) {
      setMsg(e.message || 'טעינה נכשלה');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const fail = (m) => { setMsg(m); if (onError) onError(m); };

  const upload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (data && data.limits && file.size > data.limits.maxBytes) { fail(`הקובץ גדול מדי (עד ${Math.round(data.limits.maxBytes / 1024 / 1024)}MB)`); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/terms-file', { method: 'POST', body: fd });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'ההעלאה נכשלה');
      setData(out);
      setMsg('');
      if (onDone) onDone(out.unchanged ? 'הקובץ זהה לזה שבתוקף' : 'קובץ התקנון עודכן', out.unchanged ? 'לא בוצע שינוי.' : 'הלקוחות רואות את הגרסה החדשה בעמוד התקנון. הגרסה הקודמת נשמרה בהיסטוריה.');
    } catch (err) {
      fail(err.message || 'ההעלאה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const clearCurrent = async () => {
    if (typeof window !== 'undefined' && window.customConfirm) {
      if (!(await window.customConfirm('להסיר את קובץ התקנון שבתוקף? הלקוחות לא יראו תקנון עד שיועלה קובץ חדש. הקובץ נשמר בהיסטוריה.', 'הסרת התקנון'))) return;
    } else if (typeof window !== 'undefined' && !window.confirm('להסיר את קובץ התקנון שבתוקף?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/terms-file', { method: 'DELETE' });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'הפעולה נכשלה');
      setData(out);
      if (onDone) onDone('קובץ התקנון הוסר', 'הקובץ נשמר בהיסטוריה.');
    } catch (err) {
      fail(err.message || 'הפעולה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const cur = data && data.current;
  const history = (data && data.history) || [];
  return (
    <div className="tfm" data-guide-id="set.terms-file" data-terms-file-manager="1" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: legacy ? '14px 0' : '4px 0 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <b>קובץ התקנון שמוצג ללקוחות</b>
          <div className="faint sm" style={{ opacity: .8 }}>
            {cur ? <>{cur.name} · {TYPE_LABEL[cur.type] || ''} · הועלה {when(cur.uploadedAt)}</> : data ? 'לא הועלה קובץ תקנון - הלקוחות רואות "התקנון אינו זמין".' : 'טוען…'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={btnPrimary} data-guide-id="set.terms-upload" disabled={busy || !data} onClick={() => inputRef.current && inputRef.current.click()}>{busy ? 'מעלה…' : cur ? 'החלפת קובץ' : 'העלאת קובץ תקנון'}</button>
          {cur ? <a className={btn} href="/terms" target="_blank" rel="noopener noreferrer">תצוגה כפי שהלקוחה רואה</a> : null}
          {cur ? <button type="button" className={btn} disabled={busy} onClick={clearCurrent}>הסרה</button> : null}
          <a className={btn} href="/privacy" target="_blank" rel="noopener noreferrer">מדיניות הפרטיות</a>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={upload} hidden />
      </div>
      <div className="faint sm" style={{ opacity: .75 }}>מומלץ PDF. אפשר גם תמונה (PNG / JPG). עד 4MB. קובץ Word יש לשמור קודם כ-PDF. כל לקוחה שמאשרת תקנון נרשמת עם הגרסה שהייתה בתוקף באותו רגע.</div>
      {msg ? <div role="alert" style={{ color: 'var(--gm-red, #a83d6c)', fontWeight: 600 }}>{msg}</div> : null}
      {history.length > 0 ? (
        <details>
          <summary style={{ cursor: 'pointer' }}>היסטוריית גרסאות ({history.length})</summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map((h) => (
              <li key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{h.name}</span>
                <span className="faint sm">{TYPE_LABEL[h.type] || ''} · {when(h.uploadedAt)}</span>
                {h.active ? <b className="sm">בתוקף</b> : null}
                <a href={`/api/admin/terms-file?file=${encodeURIComponent(h.id)}`} target="_blank" rel="noopener noreferrer">צפייה</a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
