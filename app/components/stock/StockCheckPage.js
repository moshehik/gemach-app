'use client';

// דף "בדיקת מלאי" (/stock-check) — עיצוב מאושר: תצוגות-עיצוב/סיימתי-לעבוד/בדיקת-מלאי.html (30.9-1.10.2026),
// רכיבי פלטה בלבד (design-system/COMPONENTS.md) בתוך .gm-ds.gm-home, כמו החיפוש המתקדם בדף הבית (HomeAdvanced):
// כרטיס טופס (card.res-one.advp: בורר תאריך עברי, שדה דגם עם רשימת הצעות, שדה מידה עם רשימת הצעות + לחצן 36
// (inpx) עם פלוס, שבבי המידות שנבחרו (advfl), בדיקה גמישה ±2 לכל מידה עם טולטיפ ההסבר) וכרטיס תוצאות
// (שורות / טבלה, שבב כמות st-good/st-mid, סניפים רק כשיש סניפים בגמ"ח).
// החישוב בשרת: GET /api/stock-check (lib/stockCheck.js). ההצעות: GET /api/stock-check/options.
// הלוגיקה הטהורה (בניית הבקשה, אימות, טקסטים): lib/stockCheckUi.js.
// החלטות הבעלים: scratch/schedule-build/DECISIONS-בדיקת-מלאי.md + החלטות-general-questions (GQ-06a..d).

import '@/design-system/components.css';
import './stock-check.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Ic, HomeSprite, ViewSwitch, ResultsTable, Dash } from '../home/HomeParts';
import { DateField } from '../home/HomeAdvanced';
import { hebText, isoOf } from '../home/homeDates';
import { useA5Shell } from '../menu/A5ShellContext';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import {
  STOCK_CHECK_STORE_KEY, FLEX_TIP, isNumericSize, addSizes, toggleFlex, validateForm, buildStockCheckUrl, buildOptionsUrl,
  freeChipClass, freeLabel, flexNote, summaryParts, filterSizeOptions, lastSizeToken, sanitizeStoredState,
} from '@/lib/stockCheckUi';

const OPT_TTL = 60 * 1000;
const optCache = new Map(); // kind|typed -> { t, list }

// הצעות מהשרת (עד 50). שגיאת רשת נזרקת כדי שהרשימה תציג "אין חיבור לשרת".
async function fetchOptions(kind, typed) {
  const ck = kind + '|' + typed;
  const hit = optCache.get(ck);
  if (hit && Date.now() - hit.t < OPT_TTL) return hit.list;
  const res = await fetch(buildOptionsUrl(kind, typed), { credentials: 'same-origin' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const d = await res.json();
  const list = Array.isArray(d && d.options) ? d.options.filter((o) => o && typeof o.v === 'string') : [];
  optCache.set(ck, { t: Date.now(), list });
  return list;
}

function Highlight({ text, q }) {
  const i = q ? text.indexOf(q) : -1;
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark>{q}</mark>{text.slice(i + q.length)}</>;
}

// שדה טקסט עם רשימת הצעות גוללת (advlist / advo — אותה רשימה כמו בחיפוש המתקדם בדף הבית; Q03).
// kind='model': ההצעות נטענות לפי מה שהוקלד (שם מכיל / קידומת); בחירה ממלאת את השדה.
// kind='size':  כל המידות נטענות פעם אחת, מסוננות בלקוח לפי הקטע האחרון שהוקלד ובלי מידות שכבר נבחרו; בחירה מוסיפה מידה.
function SuggestField({ id, kind, label, icon, placeholder, value, onChange, chosen, onPickSize, onEnter, onKeyDown, invalid, inputRef, trailing, inputMode }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null = טוען
  const [failed, setFailed] = useState(false);
  const [act, setAct] = useState(-1);
  const timer = useRef(null);
  const seq = useRef(0);
  const typed = kind === 'size' ? lastSizeToken(value) : value.trim();

  const load = (delay, text) => {
    clearTimeout(timer.current);
    const my = ++seq.current;
    const t = kind === 'size' ? '' : text.trim();
    const go = () => {
      fetchOptions(kind, t).then((list) => {
        if (my !== seq.current) return;
        setFailed(false); setItems(list); setAct(-1);
      }).catch(() => { if (my === seq.current) { setFailed(true); setItems([]); } });
    };
    if (delay) timer.current = setTimeout(go, delay); else go();
  };
  useEffect(() => () => { clearTimeout(timer.current); seq.current++; }, []);

  const openList = (delay) => { setOpen(true); load(delay, value); };
  const close = () => { setOpen(false); setAct(-1); };
  const shown = items === null ? null : (kind === 'size' ? filterSizeOptions(items, chosen, typed) : items);
  const pick = (o) => {
    if (kind === 'size') { onPickSize(o.v); setAct(-1); return; } // הרשימה נשארת פתוחה להוספת עוד מידה
    close();
    onChange(o.v);
    if (inputRef.current) inputRef.current.focus();
  };
  const move = (d) => { if (!shown || !shown.length) return; setAct((a) => (a + d + shown.length) % shown.length); };

  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className="inpw">
        <Ic id={icon} size="sm" />
        <input
          ref={inputRef}
          className="inp"
          id={id}
          name={id + '-nofill'}
          value={value}
          placeholder={placeholder}
          autoComplete="nope"
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
          inputMode={inputMode}
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? id + '-list' : undefined}
          aria-activedescendant={open && act >= 0 ? id + '-o' + act : undefined}
          aria-invalid={invalid || undefined}
          onChange={(e) => { onChange(e.target.value); setOpen(true); load(kind === 'size' ? 0 : 150, e.target.value); }}
          onFocus={() => { if (!open) openList(0); }}
          onClick={() => { if (!open) openList(0); }}
          onBlur={() => setTimeout(close, 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openList(0); else move(1); return; }
            if (e.key === 'ArrowUp' && open) { e.preventDefault(); move(-1); return; }
            if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close(); return; }
            if (e.key === 'Enter' && open && act >= 0 && shown && shown[act]) { e.preventDefault(); pick(shown[act]); return; }
            if (onKeyDown && onKeyDown(e)) return;
            if (e.key === 'Enter') { e.preventDefault(); onEnter(); }
          }}
        />
        {trailing}
        {open && (
          <ul className="advlist" id={id + '-list'} role="listbox" aria-label={kind === 'model' ? 'הצעות דגמים' : 'הצעות מידות'}>
            {shown === null && (
              <li className="advo-load" role="status" aria-live="polite">
                <span className="advmag" aria-hidden="true"><Ic id="search" size="lg" /></span>
                <span className="advload-t">{kind === 'model' ? 'מחפשים דגמים' : 'טוענים מידות'}<i className="advdots" aria-hidden="true"><b /><b /><b /></i></span>
              </li>
            )}
            {shown !== null && failed && <li className="advo none" role="alert">אין חיבור לשרת. ההצעות לא נטענו.</li>}
            {shown !== null && !failed && shown.length === 0 && <li className="advo none" role="presentation">אין התאמות</li>}
            {shown !== null && !failed && shown.map((o, i) => (
              <li key={o.v + '|' + (o.c ?? '')} role="option" aria-selected={i === act} id={id + '-o' + i} className={`advo${i === act ? ' act' : ''}`} onMouseDown={(e) => { e.preventDefault(); pick(o); }}>
                <span className="advo-t"><Highlight text={o.v} q={typed} /></span>
                {o.c != null && <span className="faint advo-code"><bdi>#{o.c}</bdi></span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// טולטיפ הדף (.pl-tt, טולטיפ 1-6 בפלטה): ריחוף/מיקוד על [data-tip] כשאין מעטפת A5 (שם המעטפת מטפלת בזה
// על כל התוכן), ובכל מצב — לחיצה על כפתור ההסבר (.tip) מציגה/מסתירה (מגע, Q06: ההסבר בטולטיפ ולא בטקסט קבוע).
function usePageTooltip(rootRef, ttRef, shellHandlesHover) {
  useEffect(() => {
    const root = rootRef.current;
    const tt = ttRef.current;
    if (!root || !tt) return undefined;
    let cur = null;
    let pinned = false;
    const hide = () => { tt.classList.remove('on'); cur = null; pinned = false; };
    const show = (el) => {
      cur = el;
      tt.textContent = el.getAttribute('data-tip');
      tt.classList.add('on');
      const r = el.getBoundingClientRect();
      const w = tt.offsetWidth;
      const h = tt.offsetHeight;
      let x = r.left + r.width / 2 - w / 2;
      x = Math.max(10, Math.min(window.innerWidth - w - 10, x));
      let y = r.top - h - 10;
      if (y < 8) y = r.bottom + 10;
      tt.style.left = `${x}px`;
      tt.style.top = `${y}px`;
    };
    const over = (e) => { if (pinned) return; const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t !== cur) show(t); else if (!t && cur) hide(); };
    const out = (e) => { if (pinned) return; if (e.target.closest && e.target.closest('[data-tip]')) hide(); };
    const fin = (e) => { if (pinned) return; const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t.matches(':focus-visible')) show(t); };
    const click = (e) => {
      const t = e.target.closest && e.target.closest('.tip[data-tip]');
      if (t) { if (pinned && cur === t) { hide(); } else { show(t); pinned = true; } return; }
      if (cur) hide();
    };
    const key = (e) => { if (e.key === 'Escape' && cur) hide(); };
    if (!shellHandlesHover) {
      root.addEventListener('mouseover', over);
      root.addEventListener('mouseout', out);
      root.addEventListener('focusin', fin);
      root.addEventListener('focusout', out);
    }
    root.addEventListener('click', click);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      root.removeEventListener('mouseover', over);
      root.removeEventListener('mouseout', out);
      root.removeEventListener('focusin', fin);
      root.removeEventListener('focusout', out);
      root.removeEventListener('click', click);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', hide);
    };
  }, [rootRef, ttRef, shellHandlesHover]);
}

function httpStatus(err) {
  const m = /HTTP (\d{3})/.exec(err && err.message ? err.message : '');
  return m ? parseInt(m[1], 10) : 0;
}
function errorText(status) {
  if (status === 401) return 'פג תוקף הכניסה. יש להתחבר מחדש.';
  if (status === 403) return 'אין לך הרשאה לבדיקת מלאי.';
  if (status === 400) return 'הבקשה לא תקינה. בדקו את התאריך והמידות ונסו שוב.';
  return 'אין חיבור לשרת כרגע.';
}

const SizesText = ({ sizes }) => sizes.map((z, i) => <span key={z.size}>{i ? ' · ' : ''}<bdi dir="ltr">{z.size} ({z.free})</bdi></span>);
const BranchesText = ({ branches }) => (branches && branches.length
  ? branches.map((b, i) => <span key={b.name || i}>{i ? ' · ' : ''}{b.name} <bdi>{b.free}</bdi></span>)
  : <Dash />);
const FreeChip = ({ n }) => <span className={`chip ${freeChipClass(n)}`}>{freeLabel(n)}</span>;

export default function StockCheckPage() {
  const shell = useA5Shell();
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const modelRef = useRef(null);
  const sizeRef = useRef(null);
  const resRef = useRef(null);
  const seq = useRef(0);

  const [date, setDate] = useState(() => isoOf(new Date()));
  const [model, setModel] = useState('');
  const [sizeIn, setSizeIn] = useState('');
  const [sizes, setSizes] = useState([]);
  const [view, setView] = useState('rows');
  const [phase, setPhase] = useState('idle'); // idle | loading | results | none | error
  const [res, setRes] = useState(null);
  const [invalid, setInvalid] = useState(null); // { title, text, focus }
  const [errStatus, setErrStatus] = useState(0);
  const [restored, setRestored] = useState(false);

  usePageTooltip(rootRef, ttRef, !!shell);

  /* ---------- שחזור הבדיקה האחרונה (חזרה מכרטיס דגם) ---------- */
  useEffect(() => {
    try {
      const saved = sanitizeStoredState(JSON.parse(sessionStorage.getItem(STOCK_CHECK_STORE_KEY) || 'null'));
      if (saved) {
        if (saved.date) setDate(saved.date);
        setModel(saved.model);
        setSizes(saved.sizes);
        setView(saved.view);
        if (saved.res) { setRes(saved.res); setPhase(saved.res.results.length ? 'results' : 'none'); }
      }
    } catch { /* פגום / חסום */ }
    setRestored(true);
  }, []);
  const persist = useCallback((state) => {
    try { sessionStorage.setItem(STOCK_CHECK_STORE_KEY, JSON.stringify(state)); } catch { /* מלא / חסום */ }
  }, []);

  const focusField = (which) => {
    const el = which === 'date' ? document.getElementById('stock-date') : which === 'size' ? sizeRef.current : modelRef.current;
    if (el) el.focus();
  };

  /* ---------- הבדיקה עצמה ---------- */
  const run = useCallback(async (over = {}) => {
    const d = over.date !== undefined ? over.date : date;
    const m = over.model !== undefined ? over.model : model;
    let s = over.sizes !== undefined ? over.sizes : sizes;
    if (sizeIn.trim()) { s = addSizes(s, sizeIn); setSizes(s); setSizeIn(''); }
    const err = validateForm({ date: d, model: m, sizes: s });
    if (err) { setInvalid(err); setPhase('idle'); setRes(null); focusField(err.focus); return; }
    setInvalid(null);
    setPhase('loading');
    const my = ++seq.current;
    if (resRef.current) resRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    try {
      // המטמון המשותף: אותה בדיקה פעמיים = אותה כתובת; מתבטל אוטומטית אחרי כל שינוי בהזמנות/השכרות/החזרות/שמלות (lib/apiCache.js).
      const data = await fetchSharedJson(buildStockCheckUrl({ date: d, model: m, sizes: s }), { ttl: TTL.LIST });
      if (my !== seq.current) return;
      const results = Array.isArray(data && data.results) ? data.results : [];
      const next = { ...data, results };
      setRes(next);
      setPhase(results.length ? 'results' : 'none');
      persist({ date: d, model: m, sizes: s, view, res: next });
    } catch (e) {
      if (my !== seq.current) return;
      setRes(null);
      setErrStatus(httpStatus(e));
      setPhase('error');
    }
  }, [date, model, sizes, sizeIn, view, persist]);

  const clearAll = () => {
    seq.current++;
    setModel(''); setSizeIn(''); setSizes([]); setInvalid(null); setPhase('idle'); setRes(null);
    try { sessionStorage.removeItem(STOCK_CHECK_STORE_KEY); } catch { /* ignore */ }
    focusField('model');
  };
  const addFromInput = () => {
    if (sizeIn.trim()) { setSizes((cur) => addSizes(cur, sizeIn)); setSizeIn(''); setInvalid(null); }
    focusField('size');
  };
  const pickSize = (v) => { setSizes((cur) => addSizes(cur, v)); setSizeIn(''); setInvalid(null); };
  const removeSize = (v) => { setSizes((cur) => cur.filter((z) => z.v !== v)); focusField('size'); };
  const onDate = (iso) => {
    setDate(iso);
    setInvalid(null);
    // אחרי שכבר נבדק: תאריך חדש מריץ את הבדיקה מחדש (כמו בעיצוב)
    if (iso && (phase === 'results' || phase === 'none')) run({ date: iso });
  };
  const onSizeKey = (e) => {
    if ((e.key === 'Enter' && e.currentTarget.value.trim()) || e.key === ',') { e.preventDefault(); addFromInput(); return true; }
    if (e.key === 'Backspace' && !e.currentTarget.value && sizes.length) { e.preventDefault(); setSizes((cur) => cur.slice(0, -1)); return true; }
    return false;
  };

  const dateText = hebText(date);
  const summary = useMemo(() => summaryParts({ dateText: res ? hebText(res.date) : dateText, model, sizes }).join(' · '), [res, dateText, model, sizes]);
  const hasFlex = sizes.some((z) => z.flex && isNumericSize(z.v));
  const branches = !!(res && res.branchesEnabled);
  const results = res ? res.results : [];
  const columns = useMemo(() => ['תאריך', 'דגם', 'מידות', 'פנוי', ...(branches ? ['סניפים'] : [])], [branches]);
  const records = useMemo(() => results.map((r) => ({
    url: r.link,
    r,
    cells: [hebText(r.date || (res && res.date)), r.modelName || '', r.sizes.map((z) => `${z.size} (${z.free})`).join(' · '), r.free, ...(branches ? [(r.branches || []).map((b) => `${b.name} ${b.free}`).join(' · ')] : [])],
  })), [results, res, branches]);

  const addBtn = (
    <button type="button" className="inpx" id="stock-add" aria-label="הוספת מידה" data-tip="הוספת המידה לרשימה" onClick={addFromInput}><Ic id="plus" size="sm" /></button>
  );

  return (
    <div className="gm-ds gm-home stock-page" ref={rootRef} dir="rtl">
      <HomeSprite />
      <div className="hero-in jshell advonly">
        <div className="card res-one advp" id="stock-form">
          <div className="card-h">
            <h2 id="stock-h">בדיקת מלאי</h2>
            <button type="button" className="ibtn" data-act="adv-apply" aria-label="בדיקה" onClick={() => run()}><Ic id="search" size="sm" /><span>בדיקה</span></button>
            <button type="button" className="ibtn" data-act="adv-clear" aria-label="נקה" onClick={clearAll}><Ic id="eraser" size="sm" /><span>נקה</span></button>
          </div>
          {invalid && (
            <div className="nb-w">
              <section className="nb nb-warning" role="alert" aria-live="assertive">
                <div className="nb-main">
                  <div className="nb-head">
                    <span className="nb-ic" aria-hidden="true"><Ic id="alert" /></span>
                    <div className="nb-msg"><b>{invalid.title}</b><span>{invalid.text}</span></div>
                  </div>
                </div>
              </section>
            </div>
          )}
          <section className="advs" aria-label="מה לבדוק">
            <div className="advs-h"><span className="advs-i"><Ic id="box" /></span><h3>מה לבדוק</h3></div>
            <div className="advgrid">
              {restored && <DateField dkey="date" idPrefix="stock-" label="תאריך" value={date} onChange={onDate} adv={{}} clearable={false} />}
              <SuggestField
                id="stock-model"
                kind="model"
                label="דגם"
                icon="dress"
                placeholder="שם דגם או מספר..."
                value={model}
                onChange={(v) => { setModel(v); setInvalid(null); }}
                onEnter={() => run()}
                invalid={!!invalid && invalid.focus === 'model'}
                inputRef={modelRef}
              />
            </div>
            <div className="advgrid">
              <SuggestField
                id="stock-size"
                kind="size"
                label="מידה"
                icon="sliders"
                placeholder="הקלידו מידה והוסיפו..."
                value={sizeIn}
                onChange={(v) => { setSizeIn(v); setInvalid(null); }}
                chosen={sizes}
                onPickSize={pickSize}
                onEnter={() => run()}
                onKeyDown={onSizeKey}
                invalid={!!invalid && invalid.focus === 'model'}
                inputRef={sizeRef}
                inputMode="numeric"
                trailing={addBtn}
              />
            </div>
            {sizes.length > 0 && (
              <div className="advflags" role="group" aria-label="מידות שנבחרו">
                {sizes.map((z) => (
                  <button key={z.v} type="button" className="advfl on" data-rm={z.v} aria-label={`הסרת מידה ${z.v}`} onClick={() => removeSize(z.v)}>
                    <span className="advfl-i" aria-hidden="true"><Ic id="x" size="sm" /></span>{z.v}
                  </button>
                ))}
              </div>
            )}
            <div className="pg-sub">חובה דגם או מידה, או שניהם. עם כמה מידות מוצגים רק דגמים שכולן פנויות בהם באותו תאריך.</div>
          </section>
          <section className="advs" aria-label="בדיקה גמישה">
            <div className="advs-h">
              <span className="advs-i"><Ic id="sliders" /></span>
              <h3>בדיקה גמישה</h3>
              <button type="button" className="tip" data-tip={FLEX_TIP} aria-label="הסבר: איך נספרת הכמות בבדיקה גמישה"><Ic id="info" size="sm" /></button>
            </div>
            {sizes.length > 0 ? (
              <>
                <div className="advflags" role="group" aria-label="בדיקה גמישה לכל מידה">
                  {sizes.map((z) => {
                    const numeric = isNumericSize(z.v);
                    return (
                      <button
                        key={z.v}
                        type="button"
                        className={`advfl${z.flex && numeric ? ' on' : ''}`}
                        data-flex={z.v}
                        aria-pressed={z.flex && numeric}
                        disabled={!numeric}
                        data-tip={numeric ? undefined : 'מידה שאינה מספר נבדקת בדיוק כפי שהוקלדה'}
                        onClick={() => setSizes((cur) => toggleFlex(cur, z.v))}
                      >
                        <span className="advfl-ck" aria-hidden="true"><Ic id="check" size="sm" /></span>
                        <span className="advfl-i" aria-hidden="true"><Ic id="sliders" size="sm" /></span>
                        <bdi dir="ltr">{z.v}{numeric ? ' ± 2' : ''}</bdi>
                      </button>
                    );
                  })}
                </div>
                <div className="pg-sub" id="stock-flex-note">{flexNote(sizes)}</div>
              </>
            ) : (
              <div className="pg-sub">{flexNote([])}</div>
            )}
          </section>
          <div className="advact">
            <button type="button" className="btn primary lg" id="stock-go" onClick={() => run()} disabled={phase === 'loading'}>
              {phase === 'loading' ? <span className="mspin" aria-hidden="true" /> : <Ic id="search" />}בדיקת מלאי
            </button>
            <button type="button" className="lrow" onClick={clearAll}><Ic id="eraser" size="sm" />נקה</button>
          </div>
        </div>
      </div>

      <div className="hero-in jshell" id="stock-res" ref={resRef}>
        <div className="card res-one" aria-live="polite">
          {phase === 'idle' && (
            <>
              <div className="card-h"><h2>תוצאות</h2></div>
              <div className="empty" role="status">
                <Ic id="search" size="lg" />
                <div className="big stock-empty-t">עוד לא נבדק מלאי</div>
                <div className="muted">בחרו תאריך ודגם או מידה, ולחצו על בדיקת מלאי.</div>
              </div>
            </>
          )}
          {phase === 'loading' && (
            <>
              <div className="card-h"><h2>תוצאות</h2></div>
              <div className="mto" role="status"><div className="mto-r"><span className="mspin" aria-hidden="true" /><b>בודקים מלאי ל{dateText}…</b></div></div>
            </>
          )}
          {phase === 'error' && (
            <>
              <div className="card-h"><h2>תוצאות</h2></div>
              <div className="empty" role="status">
                <Ic id="alert" size="lg" />
                <div className="big stock-empty-t">הבדיקה לא הצליחה</div>
                <div className="muted">{errorText(errStatus)}</div>
                {errStatus !== 403 && errStatus !== 401 && (
                  <div className="stock-retry"><button type="button" className="btn primary" onClick={() => run()}><Ic id="refresh" />לנסות שוב</button></div>
                )}
              </div>
            </>
          )}
          {phase === 'none' && (
            <>
              <div className="card-h"><h2>תוצאות <span className="faint">(0)</span></h2></div>
              <div className="pg-sub stock-sum">{summary}</div>
              {res && res.warnings && res.warnings.length > 0 && <div className="pg-sub stock-warn">{res.warnings.join(' · ')}</div>}
              <div className="empty" role="status">
                <Ic id="search" size="lg" />
                <div>אין תוצאות לחיפוש הזה</div>
                <div className="muted stock-empty-s">{hasFlex || !sizes.length ? 'אין דגם פנוי בתאריך הזה. אפשר להסיר מידה או לבחור תאריך אחר.' : 'אין דגם שכל המידות פנויות בו בתאריך הזה. אפשר לנסות בדיקה גמישה, להסיר מידה או לבחור תאריך אחר.'}</div>
              </div>
            </>
          )}
          {phase === 'results' && res && (
            <>
              <div className="card-h">
                <h2>תוצאות <span className="faint">({results.length})</span></h2>
                <ViewSwitch table={view === 'table'} onChange={(t) => { const v = t ? 'table' : 'rows'; setView(v); persist({ date, model, sizes, view: v, res }); }} />
              </div>
              <div className="pg-sub stock-sum">{summary}{res.truncated ? ' · מוצגות 200 הראשונות' : ''}</div>
              {res.warnings && res.warnings.length > 0 && <div className="pg-sub stock-warn">{res.warnings.join(' · ')}</div>}
              {view === 'table' ? (
                <ResultsTable
                  columns={columns}
                  records={records}
                  linkCol={1}
                  renderCell={(c, j, rec) => {
                    if (j === 1) return <>{rec.r.modelName || <span className="faint">ללא שם</span>} <span className="faint"><bdi>#{rec.r.modelCode ?? '—'}</bdi></span></>;
                    if (j === 2) return <SizesText sizes={rec.r.sizes} />;
                    if (j === 3) return <FreeChip n={rec.r.free} />;
                    if (j === 4) return <BranchesText branches={rec.r.branches} />;
                    return c;
                  }}
                />
              ) : (
                <div className="list" aria-label="דגמים פנויים">
                  {results.map((r) => {
                    const inner = (
                      <>
                        <div className="ic-b"><Ic id="dress" /><span className="rlbl">דגם</span></div>
                        <div className="t">
                          <b>{r.modelName || <span className="faint">ללא שם</span>}</b>
                          <span className="ln"><FreeChip n={r.free} /> · דגם <bdi>#{r.modelCode ?? '—'}</bdi></span>
                          <span className="ln">מידות ופנוי בכל אחת: <SizesText sizes={r.sizes} /></span>
                          {branches && <span className="ln">סניפים: <BranchesText branches={r.branches} /></span>}
                        </div>
                        <Ic id="chev" size="sm" className="go" />
                      </>
                    );
                    return r.link
                      ? <Link key={r.modelId} className="li rlink lrow" href={r.link}>{inner}</Link>
                      : <div key={r.modelId} className="li rlink lrow">{inner}</div>;
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}
