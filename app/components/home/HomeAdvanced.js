'use client';

// החיפוש המתקדם בדף הבית (בית 3/19/20/21 advp/advfb/advplus/advextra): שלב 1 "במה נתמקד?" (בחירת תחום),
// שלב 2 טופס הסינונים של התחום. תחומים: לקוחות, הזמנות, השכרות, החזרות, תיקונים, משלוחים (לפי הגדרות הגמ"ח), תפוסה
// (הרשאת הזמנות) ולמנהלות גם דגמים ועובדים. כספים / התראות לא נבנו (איטיים — V1-RELEASE-PLAN §3 UI-2).
// loading: החיפוש נשלח וטרם חזר (תפוסה יכולה לקחת כמה שניות) — כפתורי החיפוש נעולים ומציגים את הספינר של שורת החיפוש.
// הסינון עצמו נעשה בשרת (/api/a5/adv, /api/a5/adv-b); כאן רק הטופס. הלוגיקה בבורר התאריכים
// ובהצעות לשדות מועתקת מ-public/a5/index.html.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Ic } from './HomeParts';
import {
  ADV_FOCI, OST, ORD_CHECK, RST, RTN, RCHK, DFLAGS, AFLAGS, MFLAGS, EFLAGS, AST, DST, F,
  alertTip, advFlagsFor, visibleFoci,
} from './homeAdvConfig';
import { hebText, hebDayTitle, hebMonthStart, hebMonthShift, hebMonthGrid, isoOf, dateOf } from './homeDates';

const OPT_KEYS = ['first', 'last', 'name', 'phone', 'city', 'oid', 'item', 'model', 'emp', 'size', 'q'];
const OPT_TTL = 60 * 1000;
const optCache = new Map(); // key|focus|typed -> { t, list }

// הצעות מהשרת (עד 50 ערכים אמיתיים). שגיאת רשת נזרקת כדי שהממשק יציג "אין חיבור לשרת".
async function fetchOptions(key, focus, typed) {
  const ck = [key, key === 'q' ? focus || '' : '', typed].join('|');
  const hit = optCache.get(ck);
  if (hit && Date.now() - hit.t < OPT_TTL) return hit.list.slice();
  const qs = 'key=' + encodeURIComponent(key) + '&focus=' + encodeURIComponent(focus || '') + '&typed=' + encodeURIComponent(typed);
  const res = await fetch('/api/a5/options?' + qs, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const d = await res.json();
  const list = Array.isArray(d && d.options) ? d.options : [];
  optCache.set(ck, { t: Date.now(), list });
  return list.slice();
}

function Highlight({ text, q }) {
  const i = q ? text.indexOf(q) : -1;
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark>{q}</mark>{text.slice(i + q.length)}</>;
}

function ClearX({ show, onClick }) {
  return (
    <button type="button" className="inpx" aria-label="ניקוי השדה" data-tip="ניקוי" hidden={!show} onClick={onClick}><Ic id="x" size="sm" /></button>
  );
}

// שדה טקסט עם הצעות מהאתר
function OptionField({ spec, tip, value, onChange, focus, onEnter, idPrefix }) {
  const [key, label, icon, ph] = spec;
  const id = idPrefix + key;
  const suggest = OPT_KEYS.includes(key);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null = טוען
  const [failed, setFailed] = useState(false);
  const [act, setAct] = useState(-1);
  const timer = useRef(null);
  const seq = useRef(0);
  const inputRef = useRef(null);
  const typed = value.trim();

  const load = (delay, text) => {
    clearTimeout(timer.current);
    const my = ++seq.current;
    const t = text.trim();
    const go = () => {
      fetchOptions(key, focus, t).then((list) => {
        if (my !== seq.current) return;
        setFailed(false); setItems(list); setAct(-1);
        if (!list.length && !t) setOpen(false);
      }).catch(() => { if (my === seq.current) { setFailed(true); setItems([]); } });
    };
    if (delay) timer.current = setTimeout(go, delay); else go();
  };
  useEffect(() => () => { clearTimeout(timer.current); seq.current++; }, []);

  const openList = (delay) => {
    if (!suggest) return;
    setOpen(true);
    load(delay, value);
  };
  const pick = (v) => {
    setOpen(false);
    onChange(v);
    if (inputRef.current) inputRef.current.focus();
  };
  const move = (d) => {
    if (!items || !items.length) return;
    setAct((a) => (a + d + items.length) % items.length);
  };

  return (
    <div className="field">
      <label className="lbl" htmlFor={id} data-tip={tip || undefined}>{label}</label>
      <div className="inpw" data-tip={tip || undefined}>
        <Ic id={icon} size="sm" />
        <input
          ref={inputRef}
          className="inp"
          id={id}
          name={id + '-nofill'}
          value={value}
          placeholder={ph}
          autoComplete="nope"
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
          role={suggest ? 'combobox' : undefined}
          aria-autocomplete={suggest ? 'list' : undefined}
          aria-expanded={suggest ? open : undefined}
          aria-controls={suggest && open ? id + '-list' : undefined}
          onChange={(e) => { onChange(e.target.value); if (suggest) { setOpen(true); load(150, e.target.value); } }}
          onFocus={() => { if (!open) openList(0); }}
          onClick={() => { if (!open) openList(0); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openList(0); else move(1); }
            else if (e.key === 'ArrowUp' && open) { e.preventDefault(); move(-1); }
            else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
            else if (e.key === 'Enter') {
              e.preventDefault();
              if (open && act >= 0 && items && items[act] !== undefined) pick(items[act]);
              else onEnter();
            }
          }}
        />
        <ClearX show={!!value} onClick={() => { onChange(''); if (inputRef.current) inputRef.current.focus(); }} />
        {suggest && open && (
          <ul className="advlist" id={id + '-list'} role="listbox" aria-label="הצעות מהאתר">
            {items === null && (
              <li className="advo-load" role="status" aria-live="polite">
                <span className="advmag" aria-hidden="true"><Ic id="search" size="lg" /></span>
                <span className="advload-t">מחפשים את השמות<i className="advdots" aria-hidden="true"><b /><b /><b /></i></span>
              </li>
            )}
            {items !== null && failed && <li className="advo none" role="alert">אין חיבור לשרת. ההצעות לא נטענו.</li>}
            {items !== null && !failed && items.length === 0 && <li className="advo none" role="presentation">אין התאמות</li>}
            {items !== null && !failed && items.map((o, i) => (
              <li key={o + i} role="option" aria-selected={i === act} id={id + '-o' + i} className={`advo${i === act ? ' act' : ''}`} onMouseDown={(e) => { e.preventDefault(); pick(o); }}>
                <span className="advo-t"><Highlight text={o} q={typed} /></span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// בחירת תאריך עברי: הערך נשמר כ-ISO לועזי, מוצג ונבחר בעברית.
// מיוצא גם לדף "בדיקת מלאי" (app/components/stock/StockCheckPage.js) — אותו בורר בדיוק; שם בלי לחצן ניקוי
// (clearable=false, כמו בעיצוב המאושר של הדף: Backspace מנקה).
export function DateField({ dkey, label, value, onChange, rangeKeys, adv, clearable = true, idPrefix = 'adv-' }) {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState(null);
  const boxRef = useRef(null);
  const id = idPrefix + dkey;
  const lo = rangeKeys ? adv[rangeKeys[0]] : '';
  const hi = rangeKeys ? adv[rangeKeys[1]] : '';
  const todayIso = isoOf(new Date());

  const openPicker = () => {
    if (open) { setOpen(false); return; }
    const start = value || (rangeKeys ? adv[dkey === rangeKeys[0] ? rangeKeys[1] : rangeKeys[0]] : '') || todayIso;
    setFirst(hebMonthStart(dateOf(start)));
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open]);

  const grid = open && first ? hebMonthGrid(first) : null;
  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className="inpw" ref={boxRef}>
        <Ic id="cal" size="sm" />
        <input
          className="inp advdate"
          id={id}
          name={id + '-nofill'}
          readOnly
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={id + '-dp'}
          value={hebText(value)}
          placeholder="בחר תאריך עברי"
          autoComplete="nope"
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openPicker(); }
            else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); onChange(''); }
            else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
          }}
        />
        {clearable && <ClearX show={!!value} onClick={() => onChange('')} />}
        {grid && (
          <div className="advdp" id={id + '-dp'} role="dialog" aria-label="בחירת תאריך עברי">
            <div className="dph">
              <button type="button" className="dpn" aria-label="החודש הקודם" onClick={() => setFirst((f) => hebMonthShift(f, -1))}><Ic id="chev" size="sm" /></button>
              <b className="dpt" aria-live="polite">{grid.title}</b>
              <button type="button" className="dpn dpn-n" aria-label="החודש הבא" onClick={() => setFirst((f) => hebMonthShift(f, 1))}><Ic id="chev" size="sm" /></button>
            </div>
            <div className="dpw" aria-hidden="true">{['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'].map((x) => <span key={x}>{x}</span>)}</div>
            <div className="dpg">
              {Array.from({ length: grid.blanks }, (_, i) => <span key={'e' + i} className="dpe" />)}
              {grid.days.map((d) => {
                const inR = lo && hi && d.iso >= lo && d.iso <= hi;
                return (
                  <button
                    key={d.iso}
                    type="button"
                    className={`dpc${d.iso === value ? ' on' : ''}${inR ? ' rng' : ''}${d.iso === todayIso ? ' today' : ''}${d.shabbat || d.holiday ? ' sh' : ''}`}
                    aria-label={hebDayTitle(d.iso)}
                    aria-pressed={d.iso === value}
                    onClick={() => { onChange(d.iso); setOpen(false); }}
                  ><span>{d.label}</span></button>
                );
              })}
            </div>
            <div className="dpf"><button type="button" className="dpq" onClick={() => { onChange(isoOf(new Date())); setOpen(false); }}><Ic id="cal" size="sm" />היום</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Sec({ icon, title, children }) {
  return (
    <section className="advs" aria-label={title}>
      <div className="advs-h"><span className="advs-i"><Ic id={icon} /></span><h3>{title}</h3></div>
      {children}
    </section>
  );
}

// סימונים: list = [[value, label, icon, tip?]]; selected = מערך הערכים הנבחרים
function Toggles({ list, selected, onToggle, more, label, tipFor }) {
  return (
    <>
      {more && <div className="advmore">עוד</div>}
      <div className="advflags" role="group" aria-label={label}>
        {list.map(([v, l, i, tip]) => {
          const on = selected.includes(v);
          const t = tipFor ? tipFor(v, tip) : tip;
          return (
            <button key={v} type="button" className={`advfl${on ? ' on' : ''}`} aria-pressed={on} data-adv-flag={v} data-tip={t || undefined} onClick={() => onToggle(v)}>
              <span className="advfl-ck" aria-hidden="true"><Ic id="check" size="sm" /></span>
              <span className="advfl-i" aria-hidden="true"><Ic id={i} size="sm" /></span>
              {l}
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function HomeAdvanced({ adv, setAdv, settings, isManager, isHead, navPaths, aiAllowed, onPick, onBack, onClose, onApply, onClear, entering, loading = false }) {
  const [more, setMore] = useState(false);
  const packing = settings && settings.packing_enabled === 'true';
  const branches = settings && settings.branches_enabled === 'true';
  const foci = useMemo(() => visibleFoci({ settings, isManager, isHead, navPaths }), [settings, isManager, isHead, navPaths]);
  const f = adv.focus ? ADV_FOCI[adv.focus] : null;
  const set = (key, v) => setAdv((a) => ({ ...a, [key]: v }));
  // טווחי תאריכים: אם "מתאריך" אחרי "עד תאריך" — מחליפים ביניהם
  const setDate = (key, iso) => setAdv((a) => {
    const n = { ...a, [key]: iso };
    [['from', 'to'], ['sfrom', 'sto']].forEach(([x, y]) => { if (n[x] && n[y] && n[x] > n[y]) { const t = n[x]; n[x] = n[y]; n[y] = t; } });
    return n;
  });
  const toggle = (arr, v) => setAdv((a) => ({ ...a, [arr]: a[arr].includes(v) ? a[arr].filter((x) => x !== v) : [...a[arr], v] }));
  const apply = () => { if (!loading) onApply(false); };
  const fld = (spec, tip) => (
    <OptionField key={spec[0] + (tip || '')} spec={spec} tip={tip} value={adv[spec[0]]} onChange={(v) => set(spec[0], v)} focus={adv.focus} onEnter={apply} idPrefix="adv-" />
  );
  const dt = (key, label, rangeKeys) => (
    <DateField key={key} dkey={key} label={label} value={adv[key]} onChange={(iso) => setDate(key, iso)} rangeKeys={rangeKeys} adv={adv} />
  );
  const ofl = (list, label, moreLabel) => (
    <Toggles list={list} selected={adv.flags} onToggle={(v) => toggle('flags', v)} more={moreLabel} label={label} />
  );
  const ost = (list, label) => (
    <Toggles list={list} selected={adv.ost} onToggle={(v) => toggle('ost', v)} label={label} tipFor={(v, tip) => (v === 'alert' ? alertTip(packing) : tip)} />
  );

  const block = (b, bi) => {
    switch (b.t) {
      case 'fields':
        return (
          <Sec key={bi} icon={b.icon} title={b.title}>
            <div className={`advgrid${b.keys.length === 3 ? ' g3' : ''}`}>{b.keys.map((k) => fld(k))}</div>
          </Sec>
        );
      case 'flags':
        return <Sec key={bi} icon={b.icon} title={b.title}>{ofl(b.list, b.title)}</Sec>;
      case 'ostat':
        return <Sec key={bi} icon="file" title="סטטוס הזמנה">{ost(OST, 'סטטוס הזמנה')}</Sec>;
      case 'ocheck':
        return <Sec key={bi} icon="alert" title="דרוש בדיקה">{ofl(ORD_CHECK, 'דרוש בדיקה')}</Sec>;
      case 'ordinfo':
        return (
          <Sec key={bi} icon="file" title="פרטי הזמנה">
            <div className="advgrid">
              {fld(['oid', 'קוד הזמנה', 'file', 'קוד הזמנה...'])}
              {fld(['name', 'שם לקוח', 'user', 'שם פרטי ומשפחה...'], 'כולל שם פרטי ומשפחה')}
              {fld(F.phone)}
              {fld(['cinfo', 'פרטי לקוח', 'mail', 'מייל, כתובת...'], 'מייל, כתובת')}
              {fld(['emp', 'עובד מבצע', 'users', 'בחר עובד...'], 'רשימת עובדים פעילים. אפשר להגדיר בכרטיס עובד שלא יופיע ברשימות')}
            </div>
          </Sec>
        );
      case 'oevent':
        return (
          <Sec key={bi} icon="cal" title="פרטי אירוע">
            <div className="advgrid" data-tip="אפשר לבחור טווח תאריכי אירוע">
              {dt('from', 'תאריך אירוע', ['from', 'to'])}
              {dt('to', 'עד תאריך', ['from', 'to'])}
            </div>
            {ofl(advFlagsFor(packing).oevent, 'פרטי אירוע', true)}
          </Sec>
        );
      case 'oitems':
        return (
          <Sec key={bi} icon="dress" title="פריטים">
            <div className="advgrid g3">
              {fld(['model', 'דגם', 'dress', 'בחר דגם...'])}
              {fld(['size', 'מידה', 'sliders', 'מידה...'])}
              {fld(['item', 'ברקוד', 'scan', 'ברקוד...'], 'אפשרות העברה')}
            </div>
            {ofl(advFlagsFor(packing).oitems, 'פריטים', true)}
          </Sec>
        );
      case 'rstat':
        return <Sec key={bi} icon={b.kind === 'ret' ? 'undo' : 'bag'} title="סטטוס">{ost(b.kind === 'ret' ? RTN : RST, 'סטטוס')}</Sec>;
      case 'rdet': {
        const ret = b.kind === 'ret';
        return (
          <Sec key={bi} icon={ret ? 'undo' : 'bag'} title={ret ? 'פרטי החזרה' : 'פרטי השכרה'}>
            <div className="advgrid g3">
              {fld(['item', 'ברקוד', 'scan', 'ברקוד...'])}
              {dt('rdate', ret ? 'תאריך החזרה' : 'תאריך השכרה')}
              {fld(['emp', 'עובד מבצע', 'users', 'בחר עובד...'])}
            </div>
          </Sec>
        );
      }
      case 'rchk':
        return <Sec key={bi} icon="alert" title="דרוש בדיקה">{ofl(b.noDebt ? RCHK.filter((x) => x[0] !== 'rc_debt') : RCHK, 'דרוש בדיקה')}</Sec>;
      case 'rcust':
        return (
          <Sec key={bi} icon="file" title="פרטי לקוח והזמנה">
            <div className="advgrid">
              {fld(['oid', 'קוד הזמנה', 'file', 'קוד הזמנה...'])}
              {dt('from', 'תאריך אירוע')}
              {fld(['name', 'שם לקוח', 'user', 'שם פרטי ומשפחה...'])}
              {fld(['cinfo', 'פרטי לקוח', 'mail', 'מייל, כתובת, טלפון...'])}
            </div>
          </Sec>
        );
      case 'dpart':
        return (
          <Sec key={bi} icon="truck" title="פרטי משלוח">
            <div className="advgrid">{fld(['city', 'עיר משלוח', 'pin', 'עיר...'])}</div>
            {ofl(DFLAGS, 'פרטי משלוח', true)}
          </Sec>
        );
      case 'apart':
        return <Sec key={bi} icon="scissors" title="פרטי תיקון">{ofl(AFLAGS, 'פרטי תיקון')}</Sec>;
      case 'sstat': {
        const L = b.list === 'alt' ? AST : DST;
        const oth = b.list === 'alt' ? 'as_other' : 'ds_other';
        return (
          <Sec key={bi} icon="clock" title="סטטוס">
            {ost(L, 'סטטוס')}
            {adv.ost.includes(oth) && (
              <div className="advgrid">{dt('sfrom', 'מתאריך', ['sfrom', 'sto'])}{dt('sto', 'עד תאריך', ['sfrom', 'sto'])}</div>
            )}
          </Sec>
        );
      }
      case 'mgen':
        return (
          <Sec key={bi} icon="dress" title="פרטים כלליים">
            <div className="advgrid">
              {fld(['model', 'דגם', 'dress', 'בחר דגם...'])}
              {fld(['size', 'מידה', 'sliders', 'מידה...'])}
              {fld(['item', 'ברקוד', 'scan', 'ברקוד...'])}
              {branches && fld(['branch', 'סניף', 'pin', 'סניף...'])}
            </div>
            {ofl(MFLAGS, 'פרטים כלליים', true)}
          </Sec>
        );
      case 'cap':
        return (
          <Sec key={bi} icon="box" title="פרטי תפוסה">
            <div className="advgrid">
              {fld(['model', 'דגם', 'dress', 'בחר דגם...'])}
              {fld(['size', 'מידה', 'sliders', 'מידה...'])}
              {dt('from', 'תאריך אירוע', ['from', 'to'])}
              {dt('to', 'עד תאריך', ['from', 'to'])}
            </div>
          </Sec>
        );
      case 'estat':
        return <Sec key={bi} icon="users" title="סטטוס עובד">{ofl(EFLAGS, 'סטטוס עובד')}</Sec>;
      default:
        return null;
    }
  };

  const enter = entering ? ' adv-in' : '';
  const close = <button type="button" className="ibtn" aria-label="סגירת החיפוש המתקדם" data-tip="סגירה" onClick={onClose}><Ic id="x" size="sm" /></button>;

  if (!f) {
    return (
      <div className={`card res-one advp${enter}`}>
        <div className="card-h">
          {close}
          <button type="button" className="ibtn" aria-label="חזרה לחיפוש הראשי" data-tip="חזרה" onClick={onClose}><Ic id="back" size="sm" /></button>
          <h2 id="adv-h">סינון מתקדם</h2>
        </div>
        <section className="advq" aria-labelledby="adv-q">
          <h3 id="adv-q">במה נתמקד?</h3>
          <div className="advfocus">
            {foci.main.map((k) => (
              <button key={k} type="button" className="advfb" onClick={() => onPick(k)}><Ic id={ADV_FOCI[k].icon} size="sm" />{ADV_FOCI[k].label}</button>
            ))}
            {foci.extra.length > 0 && (
              <button type="button" className={`advplus${more ? ' open' : ''}`} aria-expanded={more} aria-controls="advExtra" aria-label={`תחומים נוספים: ${foci.extra.map((k) => ADV_FOCI[k].label).join(', ')}`} data-tip="עוד תחומים" onClick={() => setMore((v) => !v)}>
                <Ic id="plus" className="ic-p" /><Ic id="minus" className="ic-m" />
              </button>
            )}
          </div>
          {foci.extra.length > 0 && (
            <div className={`advextra${more ? ' open' : ''}`} id="advExtra" inert={!more}>
              {foci.extra.map((k, i) => (
                <button key={k} type="button" className="advfb" style={{ '--i': i }} onClick={() => onPick(k)}><Ic id={ADV_FOCI[k].icon} size="sm" />{ADV_FOCI[k].label}</button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  const smart = f.ai && aiAllowed
    ? <button type="button" className="btn smart" disabled={loading} onClick={() => onApply(true)}><Ic id="sparkle" />חיפוש חכם</button>
    : null;
  return (
    <div className={`card res-one advp${enter}`} aria-busy={loading || undefined}>
      <div className="card-h">
        {close}
        <button type="button" className="ibtn" aria-label="חזרה לבחירת תחום" data-tip="חזרה" onClick={onBack}><Ic id="back" size="sm" /></button>
        <h2 id="adv-h">{'חיפוש ' + f.label}</h2>
        <button type="button" className="ibtn" data-act="adv-apply" aria-label="חיפוש" data-tip="חיפוש" disabled={loading} onClick={apply}><Ic id="search" size="sm" /><span>חיפוש</span></button>
        <button type="button" className="ibtn" data-act="adv-clear" aria-label="נקה" data-tip="נקה" onClick={onClear}><Ic id="eraser" size="sm" /><span>נקה</span></button>
      </div>
      {f.blocks.map(block)}
      <div className="advact">
        <button type="button" className="btn primary lg" aria-label={loading ? 'מחפשים' : undefined} disabled={loading} onClick={apply}>{loading ? <span className="mspin" aria-hidden="true" /> : <Ic id="search" />}חיפוש</button>
        {smart}
        <button type="button" className="lrow" onClick={onClear}><Ic id="eraser" size="sm" />נקה</button>
      </div>
    </div>
  );
}
