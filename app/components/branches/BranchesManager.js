'use client';

// BranchesManager - ניהול הסניפים (docs/branches-plan.md, שלב א): הוספה / עריכה / השבתה, סניף ראשי יחיד, ולכל סניף שלושה מתגי
// יכולת (מדידה / איסוף / החזרה), המתג הכללי "ריבוי סניפים פעיל" (ברירת מחדל כבוי) והגדרות ההתראות.
// משמש גם את /admin/branches וגם את הסעיף "סניפים" בהגדרות (variant פנימי: compact).
// נשמר דרך PUT /api/branches (ולידציה בשרת: שם ייחודי, ראשי יחיד, שם נעול כשהסניף בשימוש).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BANNER_SCOPES, CAPABILITY_LABEL, MAX_BRANCHES } from '@/lib/branches';

const SCOPE_LABEL = { transfer: 'פריטים שצריך להעביר לסניף אחר', return: 'פריטים שצריך להחזיר לסניף אחר', both: 'שניהם' };
const CAPS = ['measure', 'pickup', 'return'];

let tempSeq = 0;
const blankBranch = () => ({ id: `new${++tempSeq}`, name: '', isMain: false, measure: true, pickup: true, return: true, active: true, _new: true });

function Switch({ checked, onChange, label, disabled, id }) {
  return (
    <label className="checkbox-row" htmlFor={id} style={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
      <input id={id} type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--primary-solid)' }} />
      <span>{label}</span>
    </label>
  );
}

export default function BranchesManager({ compact = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [derived, setDerived] = useState(false);
  const [branches, setBranches] = useState([]);
  const [usage, setUsage] = useState({});
  const [notice, setNotice] = useState({ bannerEnabled: false, bannerScope: 'both', horizonDays: 14, returnAlert: true, reserveAlert: false });
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/branches?usage=1', { cache: 'no-store' });
      if (res.status === 401) { setError('אין הרשאה לצפות בהגדרות הסניפים'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'שגיאה בטעינה'); return; }
      setEnabled(!!data.enabled);
      setDerived(!!data.derived);
      setBranches((data.branches || []).map((b) => ({ ...b })));
      setUsage(data.usage || {});
      const n = data.notice || {};
      setNotice({
        bannerEnabled: !!n.bannerEnabled, bannerScope: n.bannerScope || 'both',
        horizonDays: n.horizonDays ?? 14, returnAlert: n.returnAlert !== false, reserveAlert: !!n.reserveAlert,
      });
      setDirty(false);
    } catch {
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const touch = (fn) => { fn(); setDirty(true); setMsg(null); };
  const setBranch = (id, patch) => touch(() => setBranches((cur) => cur.map((b) => (b.id === id ? { ...b, ...patch } : b))));
  const setMain = (id) => touch(() => setBranches((cur) => cur.map((b) => ({ ...b, isMain: b.id === id }))));
  const addBranch = () => touch(() => setBranches((cur) => (cur.length >= MAX_BRANCHES ? cur : [...cur, { ...blankBranch(), isMain: !cur.some((b) => b.active && b.isMain) && cur.every((b) => !b.active) }])));

  const clientErrors = useMemo(() => {
    const errs = [];
    const names = new Set();
    branches.forEach((b, i) => {
      const n = b.name.trim();
      if (!n) errs.push(`לסניף ${i + 1} אין שם`);
      else if (names.has(n.toLowerCase())) errs.push(`השם "${n}" מופיע פעמיים`);
      names.add(n.toLowerCase());
    });
    const act = branches.filter((b) => b.active);
    if (act.length && act.filter((b) => b.isMain).length !== 1) errs.push('יש לסמן סניף ראשי אחד (מבין הפעילים)');
    return errs;
  }, [branches]);

  const save = async (extra = {}) => {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        branches: branches.map((b) => ({ id: b._new ? undefined : b.id, name: b.name, isMain: b.isMain && b.active, measure: b.measure, pickup: b.pickup, return: b.return, active: b.active })),
        settings: { ...notice },
        ...extra,
      };
      const res = await fetch('/api/branches', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ type: 'error', text: data.error || 'השמירה נכשלה' }); return false; }
      setMsg({ type: 'success', text: 'נשמר' });
      await load();
      return true;
    } catch {
      setMsg({ type: 'error', text: 'שגיאת תקשורת' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (next) => {
    const text = next
      ? 'להפעיל ריבוי סניפים? מרגע ההפעלה יופיעו שיוך סניף לפריטים, הקלדה מהירה להעברות, חישוב צרכים לפי סניף והתראות.'
      : 'לכבות ריבוי סניפים? כל התצוגות וההתראות החדשות יוסתרו והמערכת תחזור להתנהג כמו קודם (הנתונים נשמרים).';
    if (!window.confirm(text)) return;
    // שומרים קודם את הרשימה הנוכחית (בלי זה ההפעלה לא תדע על סניפים שעוד לא נשמרו)
    if (clientErrors.length) { setMsg({ type: 'error', text: clientErrors.join(' · ') }); return; }
    await save({ enabled: next });
  };

  if (loading) return <div className="page-loading"><span className="spinner lg" />טוען סניפים...</div>;
  if (error) return <div className="callout callout-danger" role="alert">{error}</div>;

  const hasActive = branches.some((b) => b.active);

  return (
    <div dir="rtl" className="branches-manager" data-testid="branches-manager">
      {!compact && (
        <div className="page-head">
          <div>
            <h1>סניפים</h1>
            <p className="page-desc">
              כמה סניפים יש, איזה מהם הראשי, ומה אפשר לעשות בכל אחד: מדידה, איסוף והחזרה. כשריבוי הסניפים כבוי המערכת עובדת כמו תמיד.
            </p>
          </div>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800 }}>ריבוי סניפים פעיל</div>
            <div className="hint" style={{ color: 'var(--text-3)', fontSize: 12.5 }}>
              {enabled ? 'דלוק: מוצג סניף על כל פריט, יש הקלדה מהירה להעברות, חישוב צרכים והתראות.' : 'כבוי (ברירת מחדל): אין שום שינוי בממשק או בחישובים.'}
            </div>
          </div>
          <button type="button" className={`btn ${enabled ? 'btn-secondary' : 'btn-primary'}`} disabled={saving || (!enabled && !hasActive)} onClick={() => toggleEnabled(!enabled)} data-act="toggle-multi-branch">
            {enabled ? 'כיבוי ריבוי סניפים' : 'הפעלת ריבוי סניפים'}
          </button>
        </div>
        {derived && branches.some((b) => !b._new) && (
          <div className="callout callout-info" style={{ marginTop: 12 }}>
            הרשימה כאן נגזרת מרשימת הסניפים הישנה (&quot;{branches.map((b) => b.name).join(', ')}&quot;). לחיצה על &quot;שמירה&quot; תקבע אותה כהגדרה מלאה.
          </div>
        )}
      </div>

      <h2 className="section-title">הסניפים</h2>
      {branches.length === 0 && <div className="empty-state"><p>עוד לא הוגדרו סניפים. הוסיפו את הראשון.</p></div>}
      {branches.map((b) => {
        const u = usage[b.id] || { orders: 0, units: 0 };
        const used = !b._new && (u.orders > 0 || u.units > 0);
        return (
          <div key={b.id} className="list-card" style={{ flexWrap: 'wrap', opacity: b.active ? 1 : 0.6, alignItems: 'flex-start' }} data-branch-row={b.name || 'new'}>
            <div style={{ flex: '1 1 220px', minWidth: 200 }}>
              <div className="field" style={{ marginBottom: 6 }}>
                <label htmlFor={`br-name-${b.id}`}>שם הסניף</label>
                <input
                  id={`br-name-${b.id}`} className="input" value={b.name} maxLength={40} disabled={used}
                  onChange={(e) => setBranch(b.id, { name: e.target.value })} placeholder="לדוגמה: נווה יעקב"
                />
                {used && <span className="hint">השם נעול: יש עליו {u.orders} הזמנות ו-{u.units} פריטים. כדי להחליף שם - משביתים ומוסיפים סניף חדש.</span>}
              </div>
              <label className="checkbox-row" style={{ cursor: b.active ? 'pointer' : 'default' }}>
                <input type="radio" name="branch-main" checked={!!b.isMain && b.active} disabled={!b.active} onChange={() => setMain(b.id)} style={{ accentColor: 'var(--primary-solid)' }} />
                <span>סניף ראשי</span>
                {b.isMain && b.active && <span className="badge badge-primary">ראשי</span>}
              </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 0 auto' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>מה יש בסניף</div>
              {CAPS.map((c) => (
                <Switch key={c} id={`br-${c}-${b.id}`} checked={b[c]} label={CAPABILITY_LABEL[c]} onChange={(v) => setBranch(b.id, { [c]: v })} />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 0 auto', alignItems: 'flex-start' }}>
              <Switch id={`br-active-${b.id}`} checked={b.active} label="פעיל" onChange={(v) => setBranch(b.id, { active: v, ...(v ? {} : { isMain: false }) })} />
              {b._new && (
                <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => touch(() => setBranches((cur) => cur.filter((x) => x.id !== b.id)))}>הסרה</button>
              )}
              {!b.active && !b._new && <span className="badge badge-neutral">מושבת - נשאר בהזמנות קיימות</span>}
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={addBranch} disabled={branches.length >= MAX_BRANCHES} data-act="add-branch">הוספת סניף</button>
        {!hasActive && branches.length > 0 && <span className="hint">אין סניף פעיל</span>}
      </div>

      {enabled && (
        <>
          <h2 className="section-title">התראות על העברת פריטים בין סניפים</h2>
          <div className="card card-pad">
            <Switch id="br-banner" checked={notice.bannerEnabled} label="להציג בראש הדף (מתחת לשורת התפריט) התראה שיש פריטים להעביר או להחזיר לסניף אחר" onChange={(v) => touch(() => setNotice((n) => ({ ...n, bannerEnabled: v })))} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginTop: 14, opacity: notice.bannerEnabled ? 1 : 0.55 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="br-banner-scope">מה להציג בהתראה</label>
                <select id="br-banner-scope" className="select" value={notice.bannerScope} disabled={!notice.bannerEnabled} onChange={(e) => touch(() => setNotice((n) => ({ ...n, bannerScope: e.target.value })))}>
                  {BANNER_SCOPES.map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="br-horizon">טווח התראת ההעברה (ימים קדימה)</label>
                <input id="br-horizon" className="input" type="number" min="1" max="60" value={notice.horizonDays} onChange={(e) => touch(() => setNotice((n) => ({ ...n, horizonDays: e.target.value })))} />
                <span className="hint">הגדרה אחת לפס ההתראה, לרשימת ההכנה בלו&quot;ז ולחישוב. אפשר לערוך אותה גם בהגדרות הלו&quot;ז. ברירת מחדל 14.</span>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <Switch id="br-return-alert" checked={notice.returnAlert} label="בסריקת החזרה: להקפיץ התראה (נסגרת ב-Enter) כשהפריט צריך לחזור לסניף אחר" onChange={(v) => touch(() => setNotice((n) => ({ ...n, returnAlert: v })))} />
            </div>
          </div>
        </>
      )}

      <h2 className="section-title">פריטי רזרבה</h2>
      <div className="card card-pad">
        <Switch id="br-reserve-alert" checked={notice.reserveAlert} label="בסריקת החזרה של פריט רזרבה שיצא באישור: להקפיץ התראה על החזרה לרזרבה (נסגרת ב-Enter ונרשמת ברשימת ההתראות). לא תלוי בריבוי סניפים." onChange={(v) => touch(() => setNotice((n) => ({ ...n, reserveAlert: v })))} />
        <div className="hint" style={{ color: 'var(--text-3)', marginTop: 6, fontSize: 12.5 }}>מסמן את הפריט כיצא מהרזרבה ברגע אישור ההשכרה (רק כשהשכרת רזרבה דורשת אישור מנהל), ומנקה את הסימון בהחזרה.</div>
      </div>

      {clientErrors.length > 0 && dirty && <div className="callout callout-warning" style={{ marginTop: 14 }}>{clientErrors.join(' · ')}</div>}
      {msg && <div className={msg.type === 'success' ? 'callout callout-success' : 'callout callout-danger'} style={{ marginTop: 14 }} role="status">{msg.text}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button type="button" className="btn btn-primary" onClick={() => save()} disabled={saving || !dirty || clientErrors.length > 0} data-act="save-branches">{saving ? 'שומר...' : 'שמירה'}</button>
        <button type="button" className="btn btn-ghost" onClick={load} disabled={saving || !dirty}>ביטול שינויים</button>
      </div>
    </div>
  );
}
