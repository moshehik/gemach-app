'use client';

// שורת הגדרה אחת בעיצוב "סימולציה" (div.li.st-row.st-ctlrow) והפקדים שלה — רכיבי פלטה בלבד (design-system/COMPONENTS.md):
// מתג label.sw, בורר div.seg.pill, לחצני div.sizes (וגרסה רחבה st-wide-btn עם ck), כרטיסי אפשרות div.dbtns.st-opts > button.opt,
// שדה input.inp / textarea.inp, סטפר div.numw (+/-), בוחר שעה div.timew + חלון .tpop, טולטיפ button.tip[data-tip].
// הערך שנשמר והחישובים (מתגים הפוכים, שדות חובה, קבוצות, מחלקות, אמצעי תשלום, ולידציה) — lib/settingsSimLayout.js, כמו הישן.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SECRET_MASK, SECRET_SETTING_LINKS } from '@/app/lib/secretSettingKeys';
import { getHebrewDateString } from '@/lib/hebrewDate';
import {
  toggleShownOn, toggleNextRaw, selectOptions, selectShownValue,
  ENFORCEABLE_FIELDS, CUSTOMER_FIELDS, mandatoryIsSelected, mandatoryToggle, mandatoryUnknown,
  parseGroups, serializeGroups, fieldName, deptToggle, deptSelected,
  methodChoices, methodsToggle, methodsAdd, methodsSelected,
  cleanNumberInput, stepNumber, numberLimit, numberPlaceholder, validationError,
  normTime, commitTime,
} from '@/lib/settingsSimLayout';
import { Ic } from './SettingsDialogs';

// אייקונים לכרטיסי האפשרויות — כמו בעיצוב (users / user / shield / lock), ולניתוב המיילים send
const OPT_ICONS = {
  PAYMENT_APPROVAL_LEVEL: { 'כולם': 'users', 'עובד': 'user', 'מנהל': 'shield', 'מנהל סניף ומעלה': 'lock' },
  email_routing_strategy: { all_a: 'send', all_b: 'send', bugs_b_rest_a: 'alert' },
};
const PILL_ICONS = { order: 'file', new_order: 'plus', orders_list: 'list', customer: 'user', rentals: 'swap', dashboard: 'home' };

/* ---------------------------------------------------------------- פקדים */

function Toggle({ row, raw, onChange, disabled }) {
  const on = toggleShownOn(row.key, raw);
  return (
    <label className="sw">
      <input
        type="checkbox"
        aria-label={row.label}
        checked={on}
        disabled={disabled}
        onChange={() => onChange(toggleNextRaw(row.key, raw))}
        data-element-name={`מתג_settings_${row.key}`}
      />
      <i />
    </label>
  );
}

function Seg({ row, raw, onChange }) {
  const opts = selectOptions(row.key);
  const cur = selectShownValue(row.key, raw);
  const idx = Math.max(0, opts.findIndex((o) => o.value === cur));
  return (
    <div className="seg pill" role="radiogroup" aria-label={row.label} style={{ '--n': opts.length, '--i': idx }}>
      <span className="pth" aria-hidden="true" />
      {opts.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === cur} className={o.value === cur ? 'on' : undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Opts({ row, raw, onChange }) {
  const opts = selectOptions(row.key);
  const cur = selectShownValue(row.key, raw);
  const icons = OPT_ICONS[row.key] || {};
  return (
    <div className="dbtns st-opts" role="group" aria-label={row.label}>
      {opts.map((o) => (
        <button key={o.value} type="button" className={`opt${o.value === cur ? ' on' : ''}`} aria-pressed={o.value === cur} onClick={() => onChange(o.value)}>
          <Ic id={icons[o.value] || 'check'} />
          <div><b>{o.label}</b></div>
          <span className="ck" aria-hidden="true"><Ic id="check" plain /></span>
        </button>
      ))}
    </div>
  );
}

function Pills({ row, raw, onChange }) {
  const opts = selectOptions(row.key);
  const cur = selectShownValue(row.key, raw);
  return (
    <div className="sizes st-wide-btn" role="group" aria-label={row.label}>
      {opts.map((o) => (
        <button key={o.value} type="button" className={o.value === cur ? 'on' : ''} aria-pressed={o.value === cur} onClick={() => onChange(o.value)}>
          <span className="ck" aria-hidden="true"><Ic id="check" plain /></span>
          <Ic id={PILL_ICONS[o.value] || 'arrr'} />{o.label}
        </button>
      ))}
    </div>
  );
}

function MultiPills({ label, items, isOn, onToggle, icon = 'check' }) {
  return (
    <div className="sizes st-wide-btn" role="group" aria-label={label}>
      {items.map((it) => {
        const on = isOn(it);
        return (
          <button key={it.id} type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => onToggle(it)}>
            <span className="ck" aria-hidden="true"><Ic id="check" plain /></span>
            <Ic id={it.icon || icon} />{it.label}
          </button>
        );
      })}
    </div>
  );
}

function Mandatory({ row, raw, onChange }) {
  const unknown = mandatoryUnknown(raw);
  return (
    <div className="st-multi">
      <MultiPills
        label={row.label}
        items={ENFORCEABLE_FIELDS.map((f) => ({ id: f.key, label: f.name, field: f, icon: f.key === 'email' ? 'mail' : f.key === 'phone1' ? 'phone' : ['city', 'street', 'houseNum'].includes(f.key) ? 'pin' : 'user' }))}
        isOn={(it) => mandatoryIsSelected(raw, it.field)}
        onToggle={(it) => onChange(mandatoryToggle(raw, it.field))}
      />
      {unknown.length ? <small className="st-note-in">ערכים נוספים שנשמרים כמו שהם: <bdi>{unknown.join(', ')}</bdi></small> : null}
    </div>
  );
}

function Groups({ row, raw, onChange }) {
  const groups = parseGroups(raw);
  // קבוצה חדשה נשארת מקומית עד שנבחר בה השדה הראשון (קבוצה ריקה לא נשמרת — כמו commit של FieldGroupsEditor בישן)
  const [pending, setPending] = useState(0);
  const shown = [...groups, ...Array.from({ length: pending }, () => [])];
  const commit = (next) => onChange(serializeGroups(next));
  const addField = (gi, key) => {
    if (gi >= groups.length) { setPending((p) => Math.max(0, p - 1)); commit([...groups, [key]]); return; }
    commit(groups.map((x, i) => (i === gi ? [...x, key] : x)));
  };
  const removeGroup = (gi) => {
    if (gi >= groups.length) { setPending((p) => Math.max(0, p - 1)); return; }
    commit(groups.filter((_, i) => i !== gi));
  };
  return (
    <div className="st-groups">
      {shown.length === 0 ? (
        <small className="st-note-in">אין קבוצות מוגדרות - ברירת המחדל: טלפון נוסף / אימייל, אחד מספיק (כמו שהיה קודם).</small>
      ) : null}
      {shown.map((g, gi) => {
        const used = new Set(g);
        const options = CUSTOMER_FIELDS.filter((f) => !used.has(f.key));
        return (
          <div className="st-grp" key={gi}>
            <div className="st-grp-h">
              <span>קבוצה {gi + 1} - אחד מספיק מבין:</span>
              <button type="button" className="ibtn" aria-label={`הסרת קבוצה ${gi + 1}`} data-tip="הסרת הקבוצה" data-ico="trash" onClick={() => removeGroup(gi)}>
                <Ic id="trash" plain />
              </button>
            </div>
            {g.length ? (
              <div className="sizes st-wide-btn" role="group" aria-label={`קבוצה ${gi + 1}`}>
                {g.map((k) => (
                  <button key={k} type="button" className="on" aria-pressed="true" aria-label={`הסרת ${fieldName(k)} מהקבוצה`} data-tip="הסרה מהקבוצה" onClick={() => commit(groups.map((x, i) => (i === gi ? x.filter((y) => y !== k) : x)))}>
                    <span className="ck" aria-hidden="true"><Ic id="check" plain /></span>
                    {fieldName(k)}
                  </button>
                ))}
              </div>
            ) : null}
            {options.length ? (
              <select className="inp st-sel" value="" aria-label={`הוספת שדה לקבוצה ${gi + 1}`} onChange={(e) => { const v = e.target.value; if (v) addField(gi, v); }}>
                <option value="">+ הוספת שדה לקבוצה…</option>
                {options.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
              </select>
            ) : null}
          </div>
        );
      })}
      <div className="row wrap">
        <button type="button" className="btn ghost sm" onClick={() => setPending((p) => p + 1)} data-element-name="כפתור_settings_add_group">
          <Ic id="plus" />קבוצה חדשה
        </button>
      </div>
    </div>
  );
}

function Depts({ row, raw, onChange, departments }) {
  const selected = deptSelected(raw);
  if (!departments) return <small className="st-note-in">טוען מחלקות…</small>;
  const names = departments.map((d) => d.name);
  const extra = selected.filter((n) => !names.includes(n));
  if (!departments.length && !extra.length) {
    return (
      <small className="st-note-in">
        רשימת המחלקות לא נטענה או שאין מחלקות במערכת. ניתן לנהל מחלקות במסך <a className="lnk" href="/admin/departments">ניהול מחלקות</a>.
      </small>
    );
  }
  const items = [...names, ...extra].map((n) => ({ id: n, label: n, icon: 'shield' }));
  return (
    <MultiPills label={row.label} items={items} isOn={(it) => selected.includes(it.id)} onToggle={(it) => onChange(deptToggle(raw, it.id))} />
  );
}

function Methods({ row, raw, saved, onChange }) {
  const [adding, setAdding] = useState('');
  const choices = methodChoices(saved, raw);
  const on = methodsSelected(raw);
  const add = () => {
    const v = adding.trim();
    if (!v) return;
    onChange(methodsAdd(choices, raw, v));
    setAdding('');
  };
  return (
    <div className="st-multi">
      <MultiPills
        label={row.label}
        items={choices.map((c) => ({ id: c, label: c, icon: /אשראי/.test(c) ? 'card' : /מזומן/.test(c) ? 'cash' : /העברה|בנק/.test(c) ? 'bank' : /צ.?ק/.test(c) ? 'cheque' : 'wallet' }))}
        isOn={(it) => on.includes(it.id)}
        onToggle={(it) => onChange(methodsToggle(choices, raw, it.id))}
      />
      <div className="st-add">
        <input
          className="inp"
          type="text"
          value={adding}
          placeholder="אמצעי תשלום נוסף…"
          aria-label="הוספת אמצעי תשלום"
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          autoComplete="off"
        />
        <button type="button" className="ibtn" aria-label="הוספת אמצעי התשלום" data-tip="הוספה" data-ico="plus" onClick={add} disabled={!adding.trim()}>
          <Ic id="plus" plain />
        </button>
      </div>
    </div>
  );
}

function NumberCtl({ row, raw, onChange, error }) {
  const lim = numberLimit(row.key);
  return (
    <div className="st-numcol">
      <div className={`numw${error ? ' err' : ''}`}>
        <button type="button" className="numb up" aria-label="הוספה" tabIndex={-1} onClick={() => onChange(stepNumber(row.key, raw, 1))}><Ic id="plus" plain /></button>
        <input
          className="inp"
          type="number"
          inputMode={lim && lim.allowDecimal ? 'decimal' : 'numeric'}
          dir="ltr"
          value={raw || ''}
          min={lim ? lim.min : 0}
          max={lim ? lim.max : undefined}
          step={lim && lim.allowDecimal ? '0.1' : '1'}
          placeholder={numberPlaceholder(row.key)}
          aria-label={row.label}
          aria-invalid={!!error}
          onChange={(e) => onChange(cleanNumberInput(row.key, e.target.value))}
          data-element-name={`שדה_settings_${row.key}`}
        />
        <button type="button" className="numb dn" aria-label="הפחתה" tabIndex={-1} onClick={() => onChange(stepNumber(row.key, raw, -1))}><Ic id="minus" plain /></button>
      </div>
      {error ? <small className="st-err" role="alert">{error}</small> : null}
    </div>
  );
}

const p2 = (n) => (n < 10 ? '0' : '') + n;
function TimeCtl({ row, raw, onChange, portalRoot }) {
  const [text, setText] = useState(raw || '');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const inpRef = useRef(null);
  const popRef = useRef(null);
  useEffect(() => { setText(raw || ''); }, [raw]);
  const cur = (() => { const m = /^(\d{1,2}):(\d{2})$/.exec(normTime(text) || ''); return m ? [+m[1], +m[2]] : [9, 0]; })();
  const place = () => {
    const el = inpRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const pw = 300; const ph = 330;
    const l = Math.max(8, Math.min(window.innerWidth - pw - 8, r.right - pw));
    let t = r.bottom + 8;
    if (t + ph > window.innerHeight - 8 && r.top - ph - 8 > 8) t = r.top - ph - 8;
    setPos({ left: l, top: t });
  };
  useEffect(() => {
    if (!open) return undefined;
    place();
    const close = (e) => { if (popRef.current && popRef.current.contains(e.target)) return; if (inpRef.current && inpRef.current.contains(e.target)) return; setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { setOpen(false); if (inpRef.current) inpRef.current.focus(); } };
    const scroll = (e) => { if (popRef.current && popRef.current.contains(e.target)) return; setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', () => setOpen(false));
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [open]);
  const commit = () => {
    if ((text || '') === (raw || '')) return;
    if (!text.trim()) { onChange(''); return; }
    const n = commitTime(text);
    if (n) { setText(n); onChange(n); } else setText(raw || '');
  };
  const pick = (h, m) => { const v = `${p2(h)}:${p2(m)}`; setText(v); onChange(v); };
  return (
    <div className="timew">
      <Ic id="clock" plain />
      <input
        ref={inpRef}
        className="inp timei"
        type="text"
        inputMode="numeric"
        maxLength={5}
        dir="ltr"
        autoComplete="off"
        placeholder="00:00"
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`st-tp-${row.key}`}
        aria-label={row.label}
        value={text}
        onClick={() => setOpen(true)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          let v = e.target.value.replace(/[^0-9:]/g, '').slice(0, 5);
          if (e.nativeEvent && e.nativeEvent.inputType === 'insertText' && /^\d{2}$/.test(v) && +v <= 23) v += ':';
          setText(v);
          const n = normTime(v);
          if (n && v.length === 5) onChange(n);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); setOpen(false); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); }
        }}
        data-element-name={`שדה_settings_${row.key}`}
      />
      {open && pos && portalRoot ? createPortal(
        <div className="tpop" id={`st-tp-${row.key}`} role="dialog" aria-label={row.label} ref={popRef} style={{ left: pos.left, top: pos.top }}>
          <div className="tp-h"><span className="tp-hi"><Ic id="clock" plain /></span><b dir="ltr">{p2(cur[0])}:{p2(cur[1])}</b></div>
          <div className="tp-l">שעה</div>
          <div className="tp-g">
            {Array.from({ length: 24 }, (_, h) => (
              <button key={h} type="button" className={`tp-c${h === cur[0] ? ' on' : ''}`} aria-pressed={h === cur[0]} onClick={() => pick(h, cur[1])}>{p2(h)}</button>
            ))}
          </div>
          <div className="tp-l">דקות</div>
          <div className="tp-g tp-m">
            {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
              <button key={m} type="button" className={`tp-c${m === cur[1] ? ' on' : ''}`} aria-pressed={m === cur[1]} onClick={() => pick(cur[0], m)}>{p2(m)}</button>
            ))}
          </div>
          <button type="button" className="btn primary block tp-ok" onClick={() => { setOpen(false); if (inpRef.current) inpRef.current.focus(); }}><Ic id="check" />אישור</button>
        </div>,
        portalRoot,
      ) : null}
    </div>
  );
}

function SecretCtl({ row, raw, onChange }) {
  const link = SECRET_SETTING_LINKS[row.key];
  return (
    <div className="st-numcol st-secret">
      <input
        className="inp"
        type="password"
        dir="ltr"
        value={raw || ''}
        autoComplete="off"
        aria-label={row.label}
        onFocus={() => { if (raw === SECRET_MASK) onChange(''); }}
        onChange={(e) => onChange(e.target.value)}
        placeholder={raw === SECRET_MASK ? 'מוגדר — לחץ כדי להחליף' : 'הדבק ערך חדש...'}
        data-lpignore="true"
        data-1p-ignore
        data-form-type="other"
      />
      {link ? (
        <small className="st-note-in">{link.prefix} <a className="lnk" href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></small>
      ) : null}
    </div>
  );
}

/** חותמת זמן לקריאה בלבד (agent_fix_loop_last_activity) — תאריך עברי + שעה בישראל (הישן הציג תאריך לועזי). */
export function hebrewDateTime(iso) {
  if (!iso) return 'מעולם לא רץ';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  let heb = '';
  try { heb = getHebrewDateString(d); } catch { heb = ''; }
  const time = d.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${heb}${heb ? ' · ' : ''}${time}`;
}

/* ---------------------------------------------------------------- השורה */

/**
 * @param {{ row, raw, saved, dirty, onChange, onRevert?, departments, highlighted, portalRoot }} props
 *   raw = הערך הנוכחי (שינוי ממתין או המקורי), saved = הערך המקורי מה-DB
 */
export default function SettingRow({ row, raw, saved, dirty, onChange, departments, highlighted, portalRoot, hidden }) {
  const error = dirty ? validationError(row.key, raw) : null;
  const ctl = row.ctl;
  let control;
  if (ctl === 'toggle') control = <Toggle row={row} raw={raw} onChange={onChange} />;
  else if (ctl === 'select-seg') control = <Seg row={row} raw={raw} onChange={onChange} />;
  else if (ctl === 'select-opts') control = <Opts row={row} raw={raw} onChange={onChange} />;
  else if (ctl === 'select-pills') control = <Pills row={row} raw={raw} onChange={onChange} />;
  else if (ctl === 'mandatory') control = <Mandatory row={row} raw={raw} onChange={onChange} />;
  else if (ctl === 'groups') control = <Groups row={row} raw={raw} onChange={onChange} />;
  else if (ctl === 'dept') control = <Depts row={row} raw={raw} onChange={onChange} departments={departments} />;
  else if (ctl === 'methods') control = <Methods row={row} raw={raw} saved={saved} onChange={onChange} />;
  else if (ctl === 'number') control = <NumberCtl row={row} raw={raw} onChange={onChange} error={error} />;
  else if (ctl === 'time') control = <TimeCtl row={row} raw={raw} onChange={onChange} portalRoot={portalRoot} />;
  else if (ctl === 'secret') control = <SecretCtl row={row} raw={raw} onChange={onChange} />;
  else if (ctl === 'timestamp') control = <input className="inp" type="text" value={hebrewDateTime(raw)} disabled readOnly aria-label={row.label} />;
  else if (ctl === 'textarea') {
    control = (
      <textarea
        className="inp"
        rows={row.rows}
        style={{ '--rows': row.rows }}
        value={raw || ''}
        placeholder="הקלד ערך..."
        aria-label={row.label}
        onChange={(e) => onChange(e.target.value)}
        data-element-name={`שדה_settings_${row.key}`}
      />
    );
  } else {
    control = (
      <input
        className="inp"
        type={row.inputType}
        value={raw || ''}
        placeholder="הקלד ערך..."
        aria-label={row.label}
        autoComplete="off"
        dir={row.ltr ? 'ltr' : undefined}
        style={row.ltr ? { textAlign: 'start' } : undefined}
        onChange={(e) => onChange(e.target.value)}
        data-element-name={`שדה_settings_${row.key}`}
      />
    );
  }
  const errorUnderControl = ctl === 'number' ? null : error;
  return (
    <div
      className={`li st-row st-ctlrow${row.wide ? ' st-wide' : ''}${dirty ? ' st-dirty' : ''}${highlighted ? ' st-flash' : ''}`}
      id={`setting-row-${row.key}`}
      data-set={row.key}
      hidden={hidden || undefined}
    >
      <div className="ic-b"><Ic id={row.icon} /></div>
      <div className="t">
        <b className="st-lb">
          {row.label}
          {row.note ? (
            <button type="button" className="tip" aria-label={`עזרה: ${row.label}`} data-ico="info" data-tip={row.note}><Ic id="info" plain /></button>
          ) : null}
          {dirty ? <span className="chip gold st-chg">שונה</span> : null}
        </b>
        {row.sub ? <small>{row.sub}</small> : null}
      </div>
      <div className="st-ctl">
        {control}
        {errorUnderControl ? <small className="st-err" role="alert">{errorUnderControl}</small> : null}
      </div>
    </div>
  );
}
