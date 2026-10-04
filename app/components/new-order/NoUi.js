'use client';

// רכיבי עזר קטנים של אשף "הזמנה חדשה" (A5) - כולם markup של הפלטה כמו בעיצוב המאושר (תצוגות-עיצוב/הזמנה-חדשה.html, B2):
// אייקון מה-sprite המוטמע (#gmi-*), כפתור עזרה .tip, שדה .field עם האייקון בשורת התווית (oneCard/lblIcons של העיצוב),
// כותרת משנה .sub-h, בורר גלולה .seg.pill עם האנימציה (pillRun), ושכבת הפורטל לשורש הדף (חלונות/טוסט יורשים את ההיקף .gm-ds.gm-no).
import { createContext, useContext, useEffect, useRef } from 'react';
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

// ---------- פורטל לשורש הדף ----------
export const NoPortalRoot = createContext(null);
export function NoPortal({ children }) {
  const root = useContext(NoPortalRoot);
  return root ? createPortal(children, root) : children;
}
