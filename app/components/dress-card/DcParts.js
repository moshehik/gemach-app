'use client';

// DcParts - רכיבי עזר קטנים של כרטיס הדגם: טולטיפ-עזרה (.tip), קופסת סימון דו-מצבית (.seg.pill עם הנפשת הידית), טקסט עם הדגשה,
// ושדה/קריאה-בלבד של העיצוב המאושר (fld / vf ב-scratch/emp-models-build/model-card.js).
import { useLayoutEffect, useRef } from 'react';
import OcIcon from '../order-card/OcIcon';

export const Ic = OcIcon;

/** כפתור עזרה עגול: הטולטיפ ב-data-tip (הטולטיפ של הכרטיס - useCardTooltips) */
export function Tip({ text }) {
  return <button type="button" className="tip" data-tip={text} aria-label="עזרה"><OcIcon name="info" size="sm" /></button>;
}

/** מקטעי טקסט עם הדגשה: [{t, b, bdi}] */
export function Segs({ parts }) {
  return parts.map((p, i) => {
    const inner = p.bdi ? <bdi>{p.t}</bdi> : p.t;
    return p.b ? <b key={i}>{inner}</b> : <span key={i}>{inner}</span>;
  });
}

/**
 * .seg.pill - בורר דו/תלת-מצבי של העיצוב (pillOpen/pillRun): ידית שמחליקה בין המצבים (WAAPI, 420ms) כשהערך משתנה.
 * options: [{key,label,icon}]  value: key  onChange(key)
 */
export function DcPill({ id, value, options, onChange, label, className = '', 'data-guide-id': gid }) {
  const ref = useRef(null);
  const n = options.length;
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  const prev = useRef(idx);
  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = idx;
    if (from === idx) return;
    const th = ref.current && ref.current.querySelector('.pth');
    const still = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!th || still || !th.animate) return;
    const pos = (k) => `calc(4px + (100% - 8px) / ${n} * ${k})`;
    th.animate([{ insetInlineStart: pos(from) }, { insetInlineStart: pos(idx) }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
  }, [idx, n]);
  return (
    <div className={`seg pill${className ? ` ${className}` : ''}`} id={id} ref={ref} {...(gid ? { 'data-guide-id': gid } : null)} role="radiogroup" aria-label={label} style={{ '--n': n, '--i': idx }} data-to={idx}>
      <span className="pth" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={value === o.key} className={value === o.key ? 'on' : ''} onClick={() => onChange(o.key)}>
          {o.icon ? <OcIcon name={o.icon} size="sm" /> : null}{o.label}
        </button>
      ))}
    </div>
  );
}

const NOFILL = { autoComplete: 'nope', 'data-lpignore': 'true', 'data-1p-ignore': true, 'data-form-type': 'other' };

/** שדה טקסט עם אייקון וכפתור ניקוי (fld בעיצוב) */
export function Fld({ id, label, icon, value, onChange, placeholder, lock, dir, mode, tip, hint, inputStyle, error, 'data-guide-id': gid }) {
  const v = value == null ? '' : value;
  return (
    <div className={`field${error ? ' bad' : ''}`} {...(gid ? { 'data-guide-id': gid } : null)}>
      <label className="lbl" htmlFor={id}>{label}{tip ? <Tip text={tip} /> : null}</label>
      <div className="inpw">
        <OcIcon name={icon} size="sm" />
        <input className="inp" id={id} name={`${id}-nofill`} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-err` : undefined} disabled={!!lock} value={v} placeholder={placeholder} dir={dir} inputMode={mode} style={inputStyle}
          onChange={lock ? undefined : (e) => onChange(e.target.value)} {...NOFILL} />
        {lock ? null : <button type="button" className="inpx" aria-label="ניקוי" hidden={!v} onClick={() => { onChange(''); const el = document.getElementById(id); if (el) el.focus(); }}><OcIcon name="x" size="sm" /></button>}
      </div>
      {error ? <div className="dc-err" id={`${id}-err`} role="alert" style={{ marginTop: 6 }}><OcIcon name="alert" size="sm" />{error}</div> : null}
      {hint ? <div className="dc-hint"><OcIcon name={lock ? 'lock' : 'info'} />{hint}</div> : null}
    </div>
  );
}

/** שדה קריאה בלבד (vf בעיצוב): אייקון, תווית (+טולטיפ), ערך או "חסר" */
export function Vf({ icon, label, value, bdi, opt, tipx, extra, 'data-guide-id': gid }) {
  const has = String(value == null ? '' : value).trim() !== '';
  return (
    <div className={`f${has || opt ? '' : ' miss'}`} {...(gid ? { 'data-guide-id': gid } : null)}>
      <OcIcon name={icon} />
      <div>
        <small>{label}{tipx ? <Tip text={tipx} /> : null}</small>
        {has ? <b>{bdi ? <bdi>{value}</bdi> : value}</b> : opt ? <span className="faint">—</span> : <span className="missv"><OcIcon name="alert" size="sm" />חסר</span>}
        {extra || null}
      </div>
    </div>
  );
}
