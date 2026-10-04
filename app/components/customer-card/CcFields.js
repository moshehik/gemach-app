'use client';

// שדות הטופס של הכרטיס (העיצוב: fld() - field > lbl + inpw[אייקון + input.inp + inpx]) - משותפים לכרטיס ולטופס לקוח חדש.
// כוכבית חובה לפי customer_required_fields (והכללים הקיימים של יצירה). שדה המייל: לחצן העתקה נקי שצף בתוך השורה ליד ה-X בריחוף
// (הבעלים cp - במקום לחצן "העתק" נפרד), ו"השלם ל-@gmail.com" בעיצוב ובגודל של לחצן "מחוקים" בכרטיס ההזמנה (הבעלים gm).

import { useRef, useState } from 'react';
import CcIcon from './CcIcon';
import CcSuggest from './CcSuggest';
import { NO_FILL } from './CcUi';

export function Tip({ text }) {
  return <button type="button" className="tip" data-tip={text} aria-label="עזרה"><CcIcon name="info" size="sm" anim={false} /></button>;
}

export function Req({ on }) {
  return on ? <span className="cc-req" aria-hidden="true">*</span> : null;
}

/** שדה טקסט אחד. key = שם השדה ב-Customer; value/onChange שולטים בו. */
export function CcInput({ id, field, label, icon, value, onChange, placeholder, mode, dir, type = 'text', required, tip, suggest, extra, after, invalid }) {
  const inputRef = useRef(null);
  const v = value === null || value === undefined ? '' : String(value);
  return (
    <div className={`field${invalid ? ' cc-bad' : ''}`}>
      <label className="lbl" htmlFor={id}>{label}<Req on={required} />{tip ? <Tip text={tip} /> : null}</label>
      <div className="inpw">
        <CcIcon name={icon} size="sm" />
        <input
          ref={inputRef}
          className="inp"
          id={id}
          name={`${id}-nofill`}
          data-f={field}
          type={type}
          value={v}
          placeholder={placeholder}
          inputMode={mode}
          dir={dir}
          aria-required={required ? 'true' : undefined}
          aria-invalid={invalid ? 'true' : undefined}
          onChange={(e) => onChange(e.target.value)}
          {...NO_FILL}
          autoComplete="nope"
        />
        {extra}
        <button type="button" className="inpx" data-inpx={id} aria-label="ניקוי" data-tip="ניקוי" hidden={!v} onClick={() => { onChange(''); if (inputRef.current) inputRef.current.focus(); }}><CcIcon name="x" size="sm" /></button>
        {suggest ? <CcSuggest inputRef={inputRef} value={v} options={suggest} onPick={(o) => onChange(o)} listId={`${id}-sug`} /> : null}
      </div>
      {after}
    </div>
  );
}

/** שדה המייל: העתקה צפה בריחוף + "השלם ל-@gmail.com". */
export function CcEmailInput({ id, value, onChange, required, invalid, onCopied }) {
  const [copied, setCopied] = useState(false);
  const v = value || '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1400); if (onCopied) onCopied(); } catch { /* clipboard blocked */ }
  };
  return (
    <CcInput
      id={id}
      field="email"
      label="מייל"
      icon="mail"
      value={v}
      onChange={onChange}
      placeholder="name@example.com"
      mode="email"
      dir="ltr"
      required={required}
      invalid={invalid}
      extra={v ? (
        <button type="button" className={`cc-copy${copied ? ' done' : ''}`} aria-label="העתקת כתובת המייל" data-tip={copied ? 'הועתק' : 'העתקת כתובת המייל'} onClick={copy}>
          <CcIcon name={copied ? 'check' : 'copy'} size="sm" anim={false} />
        </button>
      ) : null}
      after={(!v || !v.includes('@')) ? (
        <div className="cc-gmail-row">
          <button type="button" className="btn tgl cc-gmail" data-act="gmail" onClick={() => onChange(`${v}@gmail.com`)}>
            <span className="dtico"><CcIcon name="mail" size="sm" anim={false} /></span>השלם ל- @gmail.com
          </button>
        </div>
      ) : null}
    />
  );
}

/** שורת קריאה (העיצוב: vf() - .f > אייקון + small תווית + b ערך / "חסר" / "—"). */
export function ViewRow({ icon, label, value, bdi, required, extra }) {
  const has = String(value === null || value === undefined ? '' : value).trim() !== '';
  const body = has
    ? <b>{bdi ? <bdi>{String(value)}</bdi> : String(value)}</b>
    : required ? <span className="missv"><CcIcon name="alert" size="sm" anim={false} />חסר</span> : <span className="faint">—</span>;
  return (
    <div className={`f${has || !required ? '' : ' miss'}`}>
      <CcIcon name={icon} />
      <div><small>{label}</small>{body}{extra}</div>
    </div>
  );
}
