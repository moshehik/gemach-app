'use client';

// רכיבי עזר קטנים של אשף "דגם חדש" (A5), על הרכיבים של האשף "הזמנה חדשה" (NoUi.js - אייקון, כפתור עזרה, כותרת משנה, בורר גלולה, פורטל) +
// מה שהעיצוב המאושר מוסיף: sprite של שני אייקונים (hash / store - לא בפלטה המוטמעת), בורר קטגוריית מחיר עם שורת משנה, וקלט מספרי/טקסט עם NO_FILL.
import { useEffect, useRef, useState } from 'react';
import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';
import { Ic, NO_FILL, NoPortal, NoPortalRoot, SegPill, SubH, Tip } from '../new-order/NoUi';

export { Ic, NO_FILL, NoPortal, NoPortalRoot, SegPill, SubH, Tip };

// שני אייקונים שהעיצוב המאושר מוסיף לפלטה (EXTRA_ICONS ב-scratch/emp-models-build/build.py) ואינם ב-sprite המוטמע של האתר (design-system/sprite.svg).
// תחת אותו קידומת (#gmi-) כדי ש-<Ic n="hash" /> יעבוד כמו כל אייקון אחר
export function MnSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id={`${SPRITE_ID_PREFIX}hash`} viewBox="0 0 24 24"><path d="M9.5 3 7.500 21M16.500 3l-2 18M4 9h17M3 15h17" /></symbol>
        <symbol id={`${SPRITE_ID_PREFIX}store`} viewBox="0 0 24 24"><path d="M3 21V9l9-5 9 5v12M7 21v-7h10v7M7 17.500h10" /></symbol>
      </defs>
    </svg>
  );
}

// העיגול העליון של חלון (decorate() ב-dlg-modern.js): אייקון הלחצן הראשי; הנפשה לפי הסוג
export function DlgBadge({ icon = 'info' }) {
  const k = icon === 'trash' ? 'lid' : icon === 'card' ? 'tilt' : icon === 'check' ? 'breathe' : 'float';
  return <div className="dbadge" aria-hidden="true" data-k={k}><Ic n={icon} /></div>;
}

// בורר קטגוריית מחיר (.cb של הפלטה כמו בכרטיס הדגם): אייקון בתיבה, אפשרות עם שם + שורת משנה (מחיר), וי על הנבחרת; חיצים / Enter / Escape במקלדת, סגירה בלחיצה בחוץ.
// options = [{ key, title, small }]
export function MnCatCombo({ id, value, options, open, onToggle, onPick, onClose, bad, disabled, emptyText, 'data-guide-id': gid }) {
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const [act, setAct] = useState(-1);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) onClose(); };
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); }; // כמו העיצוב: Escape סוגר את הרשימה גם כשהמיקוד לא בתוכה
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onEsc);
    const sel = listRef.current && listRef.current.querySelector('.cb-o.sel');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
    return () => { document.removeEventListener('mousedown', onDoc, true); document.removeEventListener('keydown', onEsc); };
  }, [open, onClose]);
  const cur = options.find((o) => o.key === value);
  const onKey = (e) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const curIdx = options.findIndex((o) => o.key === value);
      if (!open) { onToggle(); setAct(curIdx); return; }
      const base = act >= 0 ? act : curIdx;
      const n = (base + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      setAct(n);
      const el = listRef.current && listRef.current.children[n];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter' && open && act >= 0 && options[act]) { e.preventDefault(); onPick(options[act].key); setAct(-1); }
  };
  return (
    <div className={`field${bad ? ' bad' : ''}`} {...(gid ? { 'data-guide-id': gid } : null)}>
      <label className="lbl with-ic" htmlFor={id}><Ic n="card" c="sm" />קטגוריית מחיר<span className="req">*</span></label>
      <div className={`cb${open ? ' open' : ''}`} id="mnCat" ref={rootRef} onKeyDown={onKey}>
        <button type="button" className="cb-t" id={id} aria-haspopup="listbox" aria-expanded={open ? 'true' : 'false'} aria-controls={`${id}-list`} disabled={disabled} onClick={onToggle}>
          <span className="cb-pin"><Ic n="tag" c="sm" /></span><span className="cb-v">{cur ? cur.title : (disabled && emptyText ? emptyText : '— בחר קטגוריית מחיר —')}</span><Ic n="chev" c="sm" />
        </button>
        <div className="cb-p" hidden={!open}>
          <ul className="cb-l" id={`${id}-list`} role="listbox" aria-label="קטגוריית מחיר" ref={listRef}>
            {options.map((o, i) => {
              const sel = o.key === value;
              return (
                <li key={o.key} className={`cb-o${sel ? ' sel' : ''}${i === act ? ' act' : ''}`} role="option" aria-selected={sel} style={{ '--i': i }} onClick={() => { onPick(o.key); setAct(-1); }}>
                  <span className="cb-i"><Ic n="tag" c="sm" /></span>
                  <span className="cb-x"><b>{o.title}</b>{o.small ? <small>{o.small.replace(/ .*$/, '')} <bdi dir="ltr">{o.small.replace(/^\S+ /, '')}</bdi></small> : null}</span>
                  {sel ? <span className="cb-ck"><Ic n="check" c="sm" /></span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="mn-e" id="mnCatE">{bad ? <><Ic n="alert" c="sm" />חובה לבחור קטגוריית מחיר</> : null}</div>
    </div>
  );
}
