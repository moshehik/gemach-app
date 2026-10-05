'use client';

// רשימת ההצעות של האשף (.advlist / .advo - G2 "כן": בנוי כרכיב מסודר) - כמו sugOpen/sugPaint בעיצוב:
// נפתחת בפוקוס/הקלדה בתוך ה-.inpw, הדגשת ההתאמה ב-<mark>, חצים/Enter/Escape, בחירה בעכבר (mousedown).
// prefix = מצב "השלמה" (מייל): ההצעות מתחילות במה שהוקלד ואין "אין התאמות".
import { useMemo, useRef, useState } from 'react';
import { NO_FILL } from './NoUi';

function hl(o, q, prefix) {
  if (!q) return o;
  const i = prefix ? (o.toLowerCase().startsWith(q.toLowerCase()) ? 0 : -1) : o.indexOf(q);
  if (i < 0) return o;
  return <>{o.slice(0, i)}<mark>{o.slice(i, i + q.length)}</mark>{o.slice(i + q.length)}</>;
}

export default function NoSuggest({ id, value, onChange, onPick, options, prefix = false, inputProps = {}, onBlurValue }) {
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1);
  const blurT = useRef(null);
  const q = String(value || '').trim();
  const items = useMemo(() => {
    const all = (typeof options === 'function' ? options(value) : options) || [];
    const list = q && !prefix ? all.filter(o => o.includes(q)) : all;
    return list.slice(0, 12);
  }, [options, q, prefix, value]);
  const show = open && (items.length > 0 || !prefix);
  const pick = (v) => { setOpen(false); setAct(-1); onChange(v); if (onPick) onPick(v); };
  const onKeyDown = (e) => {
    if (!show) { if (inputProps.onKeyDown) inputProps.onKeyDown(e); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setAct(a => (a + 1) % Math.max(1, items.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(a => (a - 1 + items.length) % Math.max(1, items.length)); }
    else if (e.key === 'Enter' && act >= 0 && items[act]) { e.preventDefault(); pick(items[act]); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    else if (inputProps.onKeyDown) inputProps.onKeyDown(e);
  };
  const listId = `${id}-sug`;
  return (
    <>
      <input
        {...inputProps}
        className="inp"
        id={id}
        value={value}
        autoComplete="off"
        {...NO_FILL}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={show}
        aria-activedescendant={show && act >= 0 ? `${listId}-${act}` : undefined}
        onFocus={() => { clearTimeout(blurT.current); setOpen(true); }}
        onBlur={() => { blurT.current = setTimeout(() => { setOpen(false); if (onBlurValue) onBlurValue(value); }, 120); }}
        onChange={(e) => { setOpen(true); setAct(-1); onChange(e.target.value); }}
        onKeyDown={onKeyDown}
      />
      {show ? (
        <ul className="advlist" id={listId} role="listbox" aria-label="הצעות">
          {items.length ? items.map((o, i) => (
            <li key={o} role="option" id={`${listId}-${i}`} aria-selected={i === act} className={`advo${i === act ? ' act' : ''}`} dir={prefix ? 'ltr' : undefined}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}>
              <span className="advo-t">{hl(o, q, prefix)}</span>
            </li>
          )) : <li className="advo none" role="presentation">אין התאמות</li>}
        </ul>
      ) : null}
    </>
  );
}

// הצעות דומיין למייל (SUG.email בעיצוב)
const MAIL_DOMS = ['gmail.com', 'walla.co.il', 'walla.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', '012.net.il', 'netvision.net.il', 'bezeqint.net'];
export function emailSuggestions(v) {
  const s = String(v || '').trim();
  if (!s) return [];
  const at = s.indexOf('@');
  if (at < 0) return MAIL_DOMS.slice(0, 6).map(d => `${s}@${d}`);
  const user = s.slice(0, at);
  const part = s.slice(at + 1).toLowerCase();
  if (!user || part.includes('@')) return [];
  return MAIL_DOMS.filter(d => d.startsWith(part) && d !== part).map(d => `${user}@${d}`);
}
