'use client';

// ScheduleSettingsDialog - "הגדרות תהליכים" של הלו"ז (גלגל השיניים מעל הלו"ז, וגם הקישור מהגדרות המערכת: /schedule?settings=1).
// פורט מהעיצוב המאושר (תצוגות-עיצוב/סיימתי-לעבוד/לוז-יומי.html, openSettings): לכל תהליך פעיל / כבוי, כמה ימים לפני או אחרי האירוע הוא מתבצע
// ואם רוצים גם באיזו משמרת; מקובץ ל"לפני האירוע / יום האירוע / אחרי האירוע". בנוסף (בקשת הבעלים 12.10.2026, ריבוי סניפים): כרטיס "התראת העברה בין
// סניפים" עם טווח ימים קדימה - הטווח היחיד של הפס בראש הדף, שבבי "להעביר" בהכנה והחישוב (branch_transfer_horizon_days), מוצג רק כשריבוי הסניפים דלוק.
// נטען מ-GET /api/schedule/settings ונשמר ב-PUT (הנהלה ראשית / מתכנת, החלטה B3). המפתחות: schedule_stage_<שלב>_enabled / _days / _shift; שורה חסרה = ברירת המחדל.
import { useEffect, useMemo, useRef, useState } from 'react';
import './schedule-settings.css';
import ScheduleIcon from './ScheduleIcon';
import { LzPortal } from './LzPortal';
import { STAGE_META } from './scheduleMeta';
import { GROUP_ORDER, SHIFT_LABELS, SHIFT_VALUES } from '@/lib/schedule/stageSettingsMeta';

const GROUP_ICON = { before: 'clock', event: 'gift', after: 'undo', other: 'list' };
const DIR_TEXT = { before: 'לפני האירוע', after: 'אחרי האירוע' };
const SHIFT_PILLS = SHIFT_VALUES.filter((v) => v !== 'none');
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function Stepper({ value, min, max, onChange, disabled, label, unit }) {
  return (
    <div className="lz-step">
      <button type="button" className="ibtn" aria-label={`${label} - פחות`} disabled={disabled || value <= min} onClick={() => onChange(clamp(value - 1, min, max))}><ScheduleIcon name="minus" className="sm" /></button>
      <span className="lz-sv"><b>{value}</b><small>{unit}</small></span>
      <button type="button" className="ibtn" aria-label={`${label} - יותר`} disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1, min, max))}><ScheduleIcon name="plus" className="sm" /></button>
    </div>
  );
}

function StageRow({ st, cfg, onPatch }) {
  const meta = STAGE_META[st.key] || {};
  const on = st.fixed ? true : cfg.enabled;
  const dis = st.fixed || !on;
  const shOn = cfg.shift !== 'none';
  const idx = Math.max(0, SHIFT_PILLS.indexOf(cfg.shift));
  return (
    <div className={'li st-row st-ctlrow lz-srow' + (on ? '' : ' lz-off')} data-sk={st.key}>
      <div className="ic-b"><ScheduleIcon name={meta.icon || 'list'} /></div>
      <div className="t">
        <b className="st-lb">{st.label}{st.fixed ? <span className="chip gray lz-fx">קבוע</span> : null}</b>
        <small>{st.what}</small>
      </div>
      <div className="st-ctl lz-sctl">
        {st.daysConfigurable ? (
          <div className="lz-sf">
            <span className="lz-sfl">ימי עסקים מהאירוע</span>
            <Stepper value={cfg.days} min={0} max={60} disabled={dis} label={st.label} unit={cfg.days === 0 ? 'יום האירוע' : DIR_TEXT[st.direction] || 'מהאירוע'} onChange={(d) => onPatch({ days: d })} />
          </div>
        ) : null}
        {!st.fixed ? (
          <div className="lz-sf lz-sfsh">
            <span className="lz-sfl">משמרת</span>
            <div className="lz-shf">
              <label className="sw"><input type="checkbox" aria-label={`${st.label} - הפעלת משמרות`} checked={shOn} disabled={!on} onChange={(e) => onPatch({ shift: e.target.checked ? 'all' : 'none' })} /><i /></label>
              {shOn ? (
                <div className="seg pill lz-shift" role="radiogroup" aria-label="משמרת" style={{ '--n': SHIFT_PILLS.length, '--i': idx }}>
                  <span className="pth" aria-hidden="true" />
                  {SHIFT_PILLS.map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={cfg.shift === v} className={cfg.shift === v ? 'on' : ''} disabled={!on} onClick={() => onPatch({ shift: v })}>{SHIFT_LABELS[v]}</button>
                  ))}
                </div>
              ) : <span className="lz-shoff">בלי משמרות</span>}
            </div>
          </div>
        ) : null}
        <div className="lz-sf lz-sfon">
          <span className="lz-sfl">פעיל</span>
          <label className="sw"><input type="checkbox" aria-label={`${st.label} פעיל`} checked={on} disabled={st.fixed} onChange={(e) => onPatch({ enabled: e.target.checked })} /><i /></label>
        </div>
      </div>
    </div>
  );
}

export default function ScheduleSettingsDialog({ open, onClose, onSaved }) {
  const [data, setData] = useState(null); // { stages, horizonDays, multiBranch, canEdit }
  const [tmp, setTmp] = useState({}); // key -> { enabled, days, shift }
  const [horizon, setHorizon] = useState(14);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    let off = false;
    setData(null); setErr('');
    fetch('/api/schedule/settings', { cache: 'no-store' })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (off) return;
        if (!ok) { setErr(j.error || 'שגיאה בטעינה'); return; }
        setData(j);
        setTmp(Object.fromEntries(j.stages.map((s) => [s.key, { enabled: s.enabled, days: s.days === null ? 0 : s.days, shift: s.shift }])));
        setHorizon(j.horizonDays);
      })
      .catch(() => { if (!off) setErr('שגיאת תקשורת'); });
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { off = true; window.removeEventListener('keydown', onKey, true); };
  }, [open]);

  const groups = useMemo(() => (data ? GROUP_ORDER.map(([g, label]) => [g, label, data.stages.filter((s) => s.group === g)]).filter((x) => x[2].length) : []), [data]);
  if (!open) return null;

  const patch = (key, p) => setTmp((cur) => ({ ...cur, [key]: { ...cur[key], ...p } }));
  const reset = () => {
    setTmp(Object.fromEntries(data.stages.map((s) => [s.key, { enabled: true, days: s.defaultDays === null ? 0 : s.defaultDays, shift: 'none' }])));
    setHorizon(14);
  };
  const save = async () => {
    setSaving(true); setErr('');
    try {
      const body = { stages: {}, ...(data.multiBranch ? { horizonDays: horizon } : {}) };
      for (const s of data.stages) {
        const c = tmp[s.key];
        if (!c || s.fixed) continue;
        body.stages[s.key] = { enabled: c.enabled, shift: c.shift, ...(s.daysConfigurable ? { days: c.days } : {}) };
      }
      const res = await fetch('/api/schedule/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(j.error || 'השמירה נכשלה'); return; }
      onSaved && onSaved(j);
      onClose();
    } catch {
      setErr('שגיאת תקשורת');
    } finally {
      setSaving(false);
    }
  };
  const canEdit = !!(data && data.canEdit);
  return (
    <LzPortal>
      <div className="scrim on" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="dlg lz-wiz lz-setd" id="dlg" role="dialog" aria-modal="true" aria-labelledby="lz-set-title">
          <div className="dbadge" aria-hidden="true"><ScheduleIcon name="gear" /></div>
          <h2 id="lz-set-title">הגדרות תהליכים <span className="chip gray lz-mgt">הנהלה ראשית בלבד</span></h2>
          <div className="sub">לכל תהליך: פעיל או כבוי, כמה ימי עסקים לפני או אחרי האירוע הוא מתבצע, ואם רוצים גם באיזו משמרת (ברירת מחדל: בלי משמרות). השינוי משפיע על הציר, על הרשימות ועל הלוח החודשי.</div>
          {!data && !err ? <div className="empty" role="status"><span className="spin" /><p>טוען…</p></div> : null}
          {err && !data ? <div className="empty" role="alert"><p>{err}</p></div> : null}
          {data ? (
            <>
              <div className="lz-sbody" id="stB">
                {groups.map(([g, label, list]) => (
                  <section className="lz-sg" key={g}>
                    <h3 className="adm-h lz-sgh"><span className="adm-hi"><ScheduleIcon name={GROUP_ICON[g]} /></span>{label}</h3>
                    <div className="card adm-rows lz-scard"><div className="list">
                      {list.map((st) => <StageRow key={st.key} st={st} cfg={tmp[st.key] || { enabled: true, days: 0, shift: 'none' }} onPatch={(p) => patch(st.key, p)} />)}
                    </div></div>
                  </section>
                ))}
                {data.multiBranch ? (
                  <section className="lz-sg">
                    <h3 className="adm-h lz-sgh"><span className="adm-hi"><ScheduleIcon name="swap" /></span>התראת העברה בין סניפים</h3>
                    <div className="card adm-rows lz-scard"><div className="list">
                      <div className="li st-row st-ctlrow lz-srow" data-sk="branch-horizon">
                        <div className="ic-b"><ScheduleIcon name="pin" /></div>
                        <div className="t"><b className="st-lb">טווח ההתראה</b><small>כמה ימים קדימה לבדוק הזמנות עתידיות כדי להתריע שצריך להעביר פריטים בין סניפים - לפס בראש הדף, לרשימת ההכנה ולחישוב.</small></div>
                        <div className="st-ctl lz-sctl"><div className="lz-sf"><span className="lz-sfl">ימים קדימה</span><Stepper value={horizon} min={1} max={60} label="טווח ההתראה" unit="ימים" onChange={setHorizon} /></div></div>
                      </div>
                    </div></div>
                  </section>
                ) : null}
              </div>
              <div className="lz-note"><ScheduleIcon name="info" className="sm" /><span>כללי ההתראות (הסימן !) יוגדרו בהמשך. כרגע: פריט שלא סומן כבוצע אחרי היום שלו, וכתובת חסרה במשלוח.</span></div>
              {err ? <div className="lz-serr" role="alert">{err}</div> : null}
              <div className="dbtns mact">
                <button type="button" className="btn primary lg" onClick={save} disabled={saving || !canEdit} data-act="schedule-settings-save"><ScheduleIcon name="check" />{saving ? 'שומר…' : 'שמירה'}</button>
                <button type="button" className="btn" onClick={reset} disabled={saving || !canEdit}><ScheduleIcon name="refresh" className="sm" />איפוס לברירת מחדל</button>
                <button type="button" className="btn ghost" onClick={onClose}>ביטול<ScheduleIcon name="x" className="sm" /></button>
              </div>
              {!canEdit ? <div className="lz-serr" role="status">רק הנהלה ראשית ומתכנת יכולים לשנות את ההגדרות האלה.</div> : null}
            </>
          ) : (
            <div className="dbtns"><button type="button" className="btn ghost" onClick={onClose}>סגירה<ScheduleIcon name="x" className="sm" /></button></div>
          )}
        </div>
      </div>
    </LzPortal>
  );
}
