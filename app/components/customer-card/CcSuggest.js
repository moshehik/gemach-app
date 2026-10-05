'use client';

// הצעות עיר / רחוב מהכתובות הקיימות (GET /api/customers/locations) ברשימה הנגללת המודרנית של המערכת החדשה (.advlist של
// הפלטה - אותה רשימה כמו בטופס ההזמנה החדשה, data-sug בעיצוב) במקום datalist של הדפדפן (הבעלים dlist). מקלדת: חצים, Enter,
// Escape. הבחירה כותבת לשדה בדיוק כמו הקלדה (onPick → setField).

import { useEffect, useRef, useState } from 'react';

const esc = (s) => String(s);

export default function CcSuggest({ inputRef, value, options = [], onPick, listId }) {
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1);
  const ulRef = useRef(null);
  const q = String(value || '').trim();
  const items = (q ? options.filter((o) => o.includes(q) && o !== q) : options).slice(0, 12);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const onFocus = () => setOpen(true);
    const onInput = () => { setOpen(true); setAct(-1); };
    const onBlur = () => setTimeout(() => { if (document.activeElement !== el) setOpen(false); }, 120);
    el.addEventListener('focus', onFocus);
    el.addEventListener('input', onInput);
    el.addEventListener('blur', onBlur);
    return () => { el.removeEventListener('focus', onFocus); el.removeEventListener('input', onInput); el.removeEventListener('blur', onBlur); };
  }, [inputRef]);

  const show = open && items.length > 0;
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.setAttribute('role', 'combobox');
    el.setAttribute('aria-autocomplete', 'list');
    el.setAttribute('aria-controls', listId);
    el.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (show && act >= 0) el.setAttribute('aria-activedescendant', `${listId}-${act}`); else el.removeAttribute('aria-activedescendant');
  });

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const onKey = (e) => {
      if (!show) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setAct((a) => (a + 1) % items.length); } else if (e.key === 'ArrowUp') { e.preventDefault(); setAct((a) => (a - 1 + items.length) % items.length); } else if (e.key === 'Enter' && act >= 0) { e.preventDefault(); onPick(items[act]); setOpen(false); } else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    };
    el.addEventListener('keydown', onKey, true);
    return () => el.removeEventListener('keydown', onKey, true);
  }, [inputRef, show, items, act, onPick]);

  useEffect(() => {
    if (act < 0 || !ulRef.current) return;
    const o = ulRef.current.querySelectorAll('.advo')[act];
    if (o && o.scrollIntoView) o.scrollIntoView({ block: 'nearest' });
  }, [act]);

  if (!show) return null;
  const hl = (o) => {
    const i = q ? o.indexOf(q) : -1;
    if (i < 0) return esc(o);
    return <>{o.slice(0, i)}<mark>{q}</mark>{o.slice(i + q.length)}</>;
  };
  return (
    <ul className="advlist" id={listId} role="listbox" aria-label="הצעות" ref={ulRef}>
      {items.map((o, i) => (
        <li key={o} role="option" id={`${listId}-${i}`} aria-selected={i === act} className={`advo${i === act ? ' act' : ''}`} data-v={o}
          onMouseDown={(e) => { e.preventDefault(); onPick(o); setOpen(false); }}>
          <span className="advo-t">{hl(o)}</span>
        </li>
      ))}
    </ul>
  );
}
