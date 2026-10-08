'use client';

// רכיבי עזר קטנים של אשף "הזמנה חדשה" (A5) - כולם markup של הפלטה כמו בעיצוב המאושר (תצוגות-עיצוב/הזמנה-חדשה.html, B2):
// אייקון מה-sprite המוטמע (#gmi-*), כפתור עזרה .tip, שדה .field עם האייקון בשורת התווית (oneCard/lblIcons של העיצוב),
// כותרת משנה .sub-h, בורר גלולה .seg.pill עם האנימציה (pillRun), ושכבת הפורטל לשורש הדף (חלונות/טוסט יורשים את ההיקף .gm-ds.gm-no).
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';
import { moneyAmount } from './newOrderLogic';

export const NO_FILL = { 'data-lpignore': 'true', 'data-1p-ignore': true, 'data-form-type': 'other' };

// אייקון + מחלקות הנפשת הריחוף של הפלטה (ia-<שם> ia-h), כמו tagIcons בעיצוב
export function Ic({ n, c }) {
  return (
    <svg className={`ic${c ? ` ${c}` : ''} ia-${n} ia-h`} aria-hidden="true" focusable="false"><use href={`#${SPRITE_ID_PREFIX}${n}`} /></svg>
  );
}

// window.tip בעיצוב: כפתור "עזרה" קטן עם טולטיפ המערכת (data-tip, לא title)
export function Tip({ t }) {
  return <button type="button" className="tip" data-tip={t} aria-label="עזרה"><Ic n="info" c="sm" /></button>;
}

// שדה של קוביית השלב: <div.field><label.lbl.with-ic>{icon}{label}</label><div.inpw>{children}</div></div>
// (בעיצוב האייקון עובר מתוך .inpw לשורת התווית; בלי תווית הוא נשאר בתוך השדה עם .ico-in)
export function Field({ label, icon, htmlFor, children, after, className = 'field', inpwClass = '' }) {
  return (
    <div className={className}>
      {label ? (
        <label className={`lbl${icon ? ' with-ic' : ''}`} htmlFor={htmlFor}>{icon ? <Ic n={icon} c="sm" /> : null}{label}</label>
      ) : null}
      <div className={`inpw${!label && icon ? ' ico-in' : ''}${inpwClass ? ` ${inpwClass}` : ''}`}>
        {!label && icon ? <Ic n={icon} c="sm" /> : null}
        {children}
      </div>
      {after}
    </div>
  );
}

// כפתור ניקוי בתוך שדה (.inpx)
export function ClearX({ show, onClear, label = 'ניקוי', tip }) {
  return (
    <button type="button" className="inpx" aria-label={label} data-tip={tip} hidden={!show} onClick={onClear}><Ic n="x" c="sm" /></button>
  );
}

// כותרת בלוק בתוך קוביית השלב (.card-h שהופך ל-.sub-h)
export function SubH({ icon, tone = 'teal', title, children }) {
  return (
    <div className="sub-h">
      <div className={`ico ${tone}`}><Ic n={icon} c="lg" /></div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

// בלוק אחד בקוביית השלב (בעיצוב: הילדים של הקטע מקבלים blk; card נשאר card)
export function Blk({ as: Tag = 'div', className = 'card', children, ...rest }) {
  return <Tag className={`${className} blk`} {...rest}>{children}</Tag>;
}

// קוביית השלב: .card.one > .one-body (ONE_CARD + ONE_CARD_NO_HEAD של B2)
export function OneCard({ children }) {
  return (
    <div className="card one"><div className="one-body">{children}</div></div>
  );
}

// בורר גלולה (.seg.pill + .pth) עם הזזת המחוון כמו pillRun בעיצוב
export function SegPill({ id, options, value, onChange, label }) {
  const ref = useRef(null);
  const idx = Math.max(0, options.findIndex(o => o.v === value));
  const prev = useRef(idx);
  useEffect(() => {
    const el = ref.current;
    const from = prev.current;
    prev.current = idx;
    if (!el || from === idx) return;
    const th = el.querySelector('.pth');
    const still = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (th && th.animate && !still) {
      const n = options.length;
      const pos = (k) => `calc(4px + (100% - 8px) / ${n} * ${k})`;
      th.animate([{ insetInlineStart: pos(from) }, { insetInlineStart: pos(idx) }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  }, [idx, options.length]);
  return (
    <div className="seg pill" id={id} role="radiogroup" aria-label={label} ref={ref} style={{ '--n': options.length, '--i': idx }} data-to={idx}>
      <span className="pth" aria-hidden="true" />
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={o.v === value} className={o.v === value ? 'on' : ''} data-tip={o.tip} onClick={() => onChange(o.v)}>
          {o.icon ? <Ic n={o.icon} c="sm" /> : null}{o.label}
        </button>
      ))}
    </div>
  );
}

// מתג הפעלה של הפלטה (label.sw)
export function Switch({ checked, onChange, label, id }) {
  return (
    <label className="sw"><input type="checkbox" id={id} checked={!!checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} /><i /></label>
  );
}

// הודעה שורתית (div.empty) עם אייקון - "חסר ללקוח", שגיאות שדה וכו'
export function Note({ icon = 'alert', children, className = 'empty', style }) {
  return (
    <div className={className} style={{ textAlign: 'start', display: 'flex', gap: 8, alignItems: 'flex-start', ...style }}>
      <Ic n={icon} c="sm" /><div>{children}</div>
    </div>
  );
}

// אגורות מוצגות כשיש (moneyAmount): מחיר/תשלום לא שלם לא מעוגל בשקט לשקל שלם
export const money = (n) => <bdi dir="ltr">₪{moneyAmount(n)}</bdi>;

// R29b (הבעלים): הודעת שמירה (חוסר מלאי 409 / שגיאה כללית / אזהרה אחרי שמירה) - הבאנר הכחול-כהה של האתר (.nb, "באנרים והתראות" בפלטה:
// design-system/COMPONENTS.md; אותו שלד כמו StockCheckPage ודף הבית) מתחת לשורת הכותרת, עם "פירוט" נפתח (.nb-more -> .nb-bw/.nb-bi/.nb-r).
// בלי חלון ובלי alert. rows: [{t, i?}]; kind: 'warning' (פס זהב, כמו הבאנר באתר) / 'info'.
export function NoBanner({ id, kind = 'warning', title, text, rows = [], onClose }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const bodyId = useId();
  useEffect(() => { // ההודעה מופיעה בראש המסך, והלחצן שגרם לה בתחתיתו - מביאים אותה לתצוגה
    const el = ref.current;
    if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* */ } }
  }, [id]);
  return (
    <div className="nb-area no-banner" data-sec="banner">
      <div className="nb-w">
        <section className={`nb nb-${kind}${open ? ' open' : ''}`} role="alert" aria-live="assertive" ref={ref}>
          <div className="nb-main">
            <div className="nb-head">
              <span className="nb-ic" aria-hidden="true"><Ic n="alert" /></span>
              <div className="nb-msg"><b>{title}</b>{text ? <span>{text}</span> : null}</div>
              {onClose ? <button type="button" className="nb-x" aria-label="סגור" data-tip="סגור" onClick={onClose}><Ic n="x" /></button> : null}
            </div>
            {rows.length ? (
              <div className="nb-acts">
                <button type="button" className="nb-more" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}><span>{open ? 'פחות פירוט' : 'פירוט'}</span><Ic n="chev" /></button>
              </div>
            ) : null}
          </div>
          {rows.length ? (
            <div className="nb-bw"><div className="nb-body" id={bodyId}><div className="nb-bi">
              {rows.map((r, k) => <div className="nb-r" key={`${k}${r.t}`}><i><Ic n={r.i || 'dress'} /></i><span dir="auto">{r.t}</span></div>)}
            </div></div></div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

// ---------- פורטל לשורש הדף ----------
export const NoPortalRoot = createContext(null);
export function NoPortal({ children }) {
  const root = useContext(NoPortalRoot);
  return root ? createPortal(children, root) : children;
}

// בורר הרשימה של הפלטה (.cb - תיבת הבחירה של האתר) במקום <select> של הדפדפן: רשימה צפה, וי על הנבחר,
// חיצים / Enter / Escape במקלדת, סגירה בלחיצה בחוץ. options = [[value, label], ...]; האפשרות עם הערך הריק מוצגת כ-placeholder וחוזרת לערך ריק.
export function NoCombo({ id, label, value, options, onChange, placeholder = '', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const list = options.map(([v, l]) => [v, v === '' ? placeholder : l]);
  const cur = String(value) === '' ? null : list.find(([v]) => String(v) === String(value));
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc, true);
    const sel = listRef.current && listRef.current.querySelector('.cb-o.sel');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
    return () => document.removeEventListener('mousedown', onDoc, true);
  }, [open]);
  const pick = (v) => {
    setOpen(false); setAct(-1);
    if (String(v) !== String(value)) onChange(v);
    const t = rootRef.current && rootRef.current.querySelector('.cb-t');
    if (t) t.focus();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const curIdx = list.findIndex(([v]) => String(v) === String(value));
      if (!open) { setOpen(true); setAct(curIdx); return; }
      const base = act >= 0 ? act : curIdx;
      const n = (base + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      setAct(n);
      const el = listRef.current && listRef.current.children[n];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter' && open && act >= 0 && list[act]) { e.preventDefault(); pick(list[act][0]); }
  };
  return (
    <div className={`cb${open ? ' open' : ''}`} ref={rootRef} onKeyDown={onKey}>
      <button type="button" className="cb-t" id={id} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-label={label} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        <span className={`cb-v${cur ? '' : ' cb-ph'}`}>{cur ? cur[1] : placeholder}</span><Ic n="chev" c="sm" />
      </button>
      <div className="cb-p" hidden={!open || disabled}>
        <ul className="cb-l" role="listbox" aria-label={label} ref={listRef}>
          {list.map(([v, l], i) => {
            const sel = String(v) === String(value);
            return (
              <li key={String(v)} className={`cb-o${sel ? ' sel' : ''}${i === act ? ' act' : ''}`} role="option" aria-selected={sel} style={{ '--i': i }} onClick={() => pick(v)}>
                <span className="cb-x"><b>{l}</b></span>{sel ? <span className="cb-ck"><Ic n="check" c="sm" /></span> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
