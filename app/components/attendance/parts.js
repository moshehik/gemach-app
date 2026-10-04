'use client';

// רכיבים קטנים של "סיכום נוכחות" - ה-markup של העיצוב המאושר (תצוגות-עיצוב/סיכום-נוכחות.html): אייקון מה-sprite המוטמע,
// לחצני XL / הורדה / הדפסה (xlbtn, כמו בלו״ז), תיבת בחירה של המערכת (.cb), כותרת עמודה עם חצי מיון (.tsort), לוח עברי (.hc).
import { useEffect, useRef, useState } from 'react';
import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';
import { hebrewParts, monthStart, monthLength, nextMonthStart, prevMonthStart, addDays, dow, WEEKDAYS_SHORT } from '../schedule/hebrewCalendar';

// אייקון מה-sprite המוטמע + מחלקות אנימציית הריחוף של הפלטה (ia-<שם> ia-h), כמו prep() בעיצוב ו-Ic של הפרופיל
export function Ic({ id, size, className }) {
  return (
    <svg className={`ic ia-${id} ia-h${size ? ` ${size}` : ''}${className ? ` ${className}` : ''}`} aria-hidden="true" focusable="false"><use href={`#${SPRITE_ID_PREFIX}${id}`} /></svg>
  );
}

// tipify() + prep() של העיצוב: לכל לחצן data-ico = האייקון הראשון שבו (כללי הריחוף [data-ico] של הפלטה), לחצן אייקון בלי טקסט
// ובלי data-tip מקבל את ה-aria-label כטולטיפ, ואייקון ישיר של לחצן שכבר מונפש ע"י [data-ico] מקבל ia-ov (בלי אנימציה כפולה).
const COVERED = new Set('check card print plus x trash undo bk back chev truck pencil scissors lock swap ext mail bag cart'.split(' '));
export function decorateButtons(root) {
  if (!root) return;
  root.querySelectorAll('button,[role=button]').forEach((b) => {
    const u = b.querySelector('use');
    const href = u ? u.getAttribute('href') || '' : '';
    const ico = href.startsWith('#' + SPRITE_ID_PREFIX) ? href.slice(1 + SPRITE_ID_PREFIX.length) : '';
    if (ico && b.dataset.ico !== ico) b.dataset.ico = ico;
    if (!b.dataset.tip && !b.textContent.replace(/\s+/g, '').trim()) { const l = b.getAttribute('aria-label'); if (l) b.dataset.tip = l; }
    if (ico && COVERED.has(ico)) b.querySelectorAll(':scope > svg.ic').forEach((s) => s.classList.add('ia-ov'));
  });
}

function XlIcon() {
  return (
    <svg className="xlic" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="3" fill="#107C41" /><path d="M5 4.5l6 7M11 4.5l-6 7" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none" /></svg>
  );
}
function DlIcon() {
  return (
    <svg className="dlic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#a83d6c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><g className="dl-arrow"><path d="M8 2v7.5M5 6.8l3 3 3-3" /></g><path d="M2.5 11.5v1.2a1.3 1.3 0 0 0 1.3 1.3h8.4a1.3 1.3 0 0 0 1.3-1.3v-1.2" /></svg>
  );
}
function PrintIcon() {
  return (
    <svg className="prtic" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#1e63c4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path className="prt-top" d="M4.5 5.5V2h7v3.5" /><rect x="1.5" y="5.5" width="13" height="6" rx="1.6" /><g className="prt-sheet"><rect x="4.5" y="9" width="7" height="5.5" rx=".6" fill="#fff" /><path d="M6.3 11.2h3.4M6.3 12.9h2.2" strokeWidth="1" /></g></svg>
  );
}

/**
 * שלושת הלחצנים (toolBtns בעיצוב): XL (הנהלה בלבד - JDG-04), הורדה (PDF), הדפסה. tips = [xl, dl, print].
 * onPick(mode) עם 'xl' | 'dl' | 'print'.
 */
export function ToolButtons({ canXl, disabled, tips, onPick }) {
  const b = (mode, cls, label, tip, icon) => (
    <button type="button" className={'xlbtn ' + cls} data-wiz={mode} aria-label={label} data-tip={tip} disabled={disabled} onClick={(e) => { e.stopPropagation(); onPick(mode); }}>{icon}</button>
  );
  return (
    <>
      {canXl ? b('xl', 'xlg', 'ייצוא ל-Excel', tips[0], <XlIcon />) : null}
      {b('dl', 'xld', 'הורדה', tips[1], <DlIcon />)}
      {b('print', 'xlp', 'הדפסה', tips[2], <PrintIcon />)}
    </>
  );
}

/** תיבת הבחירה של המערכת (.cb, cbxHTML בעיצוב): רשימה צפה, וי על הנבחר, חיצים / Enter / Escape במקלדת */
export function Combo({ id, label, value, options, onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const cur = options.find((o) => String(o[0]) === String(value));
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc, true);
    const sel = listRef.current && listRef.current.querySelector('.cb-o.sel');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
    return () => document.removeEventListener('mousedown', onDoc, true);
  }, [open]);
  const pick = (v) => { setOpen(false); setAct(-1); if (String(v) !== String(value)) onChange(v); const t = rootRef.current && rootRef.current.querySelector('.cb-t'); if (t) t.focus(); };
  const onKey = (e) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); setAct(options.findIndex((o) => String(o[0]) === String(value))); return; }
      const base = act >= 0 ? act : options.findIndex((o) => String(o[0]) === String(value));
      const n = (base + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      setAct(n);
      const el = listRef.current && listRef.current.children[n];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter' && open && act >= 0) { e.preventDefault(); pick(options[act][0]); }
  };
  return (
    <div className={'cb ' + className + (open ? ' open' : '')} data-cb={id} ref={rootRef} onKeyDown={onKey}>
      <button type="button" className="cb-t" id={'cbt-' + id} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <span className="cb-v">{cur ? cur[1] : ''}</span><Ic id="chev" size="sm" />
      </button>
      <div className="cb-p" hidden={!open}>
        <ul className="cb-l" role="listbox" aria-label={label} ref={listRef}>
          {options.map(([v, l], i) => {
            const sel = String(v) === String(value);
            return (
              <li key={String(v)} className={'cb-o' + (sel ? ' sel' : '') + (i === act ? ' act' : '')} role="option" aria-selected={sel} data-cbv={v} style={{ '--i': i }} onClick={() => pick(v)}>
                <span className="cb-x"><b>{l}</b></span>{sel ? <span className="cb-ck"><Ic id="check" size="sm" /></span> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** כותרת עמודה עם חצי מיון עולה / יורד (th() בעיצוב) */
export function SortTh({ k, label, sort, onSort, center = true }) {
  const on = sort.key === k;
  return (
    <th className={(on ? 'sorted ' + (sort.dir > 0 ? 'asc' : 'desc') : '') + (center ? ' c' : '')}>
      <span className="thw">{label}<span className="tsort">
        <button type="button" className="tsb tu" aria-label={'מיון ' + label + ' עולה'} onClick={() => onSort({ key: k, dir: 1 })}><Ic id="chev" size="sm" /></button>
        <button type="button" className="tsb td" aria-label={'מיון ' + label + ' יורד'} onClick={() => onSort({ key: k, dir: -1 })}><Ic id="chev" size="sm" /></button>
      </span></span>
    </th>
  );
}

// "ט״ו אלול תשפ״ו" (תאריך עברי מלא לתווית הכפתור / לשבח הקריאה של יום בלוח)
export function hebFull(key) {
  const h = hebrewParts(key);
  return `${h.dl} ${h.m} ${h.y}`;
}

/** הלוח העברי של "הוסף משמרת" (hcHTML בעיצוב): חודש עברי, ימי השבוע, יום נבחר / היום / שבת */
export function HebCalendar({ value, today, onPick }) {
  const [start, setStart] = useState(() => monthStart(value));
  const len = monthLength(start);
  const off = dow(start);
  const h = hebrewParts(start);
  const days = Array.from({ length: len }, (_, i) => addDays(start, i));
  return (
    <div className="hc">
      <div className="hc-h">
        <button type="button" className="hc-n" aria-label="החודש הקודם" onClick={() => setStart(prevMonthStart(start))}><Ic id="chev" size="sm" /></button>
        <b className="hc-t" aria-live="polite">{h.m} {h.y}</b>
        <button type="button" className="hc-n hc-nn" aria-label="החודש הבא" onClick={() => setStart(nextMonthStart(start))}><Ic id="chev" size="sm" /></button>
      </div>
      <div className="hc-w" aria-hidden="true">{WEEKDAYS_SHORT.map((x) => <span key={x}>{x}</span>)}</div>
      <div className="hc-g" role="grid">
        {Array.from({ length: off }, (_, i) => <span key={'e' + i} className="hc-e" />)}
        {days.map((k) => (
          <button key={k} type="button" className={'hc-d' + (dow(k) === 6 ? ' sh' : '') + (k === value ? ' on' : '') + (k === today ? ' today' : '')} aria-label={hebFull(k)} aria-pressed={k === value} onClick={() => onPick(k)}>
            {hebrewParts(k).dl}
          </button>
        ))}
      </div>
    </div>
  );
}
