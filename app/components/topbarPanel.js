'use client';
// v3 — התנהגות משותפת לכל הפאנלים הנפתחים בסרגל העליון (תפריטי הניווט, חיפוש, פעמון, משתמש).
// מקור אחד להתנהגות (R2): ריחוף עכבר פותח (אם hover), לחיצה מצמידה, לחיצה נוספת סוגרת,
// Esc / לחיצה בחוץ / יציאת פוקוס סוגרים, חצים עולה/יורד/Home/End בין הקישורים, ורק פאנל אחד פתוח בכל רגע.
// אין כאן שום לוגיקה עסקית - רק מצב פתוח/סגור של ה-chrome.
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useId } from 'react';

const OPEN_EVENT = 'v3-topbar-panel-open';
const LINK_SEL = '[data-tbl]:not([disabled])';

export function useTopbarPanel({ hover = false, onOpened } = {}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const pinnedRef = useRef(false);
  const timerRef = useRef(0);
  const itemRef = useRef(null);
  const triggerRef = useRef(null);
  const onOpenedRef = useRef(onOpened);
  useEffect(() => { onOpenedRef.current = onOpened; });

  const close = useCallback((returnFocus) => {
    clearTimeout(timerRef.current);
    pinnedRef.current = false;
    setOpen(false);
    if (returnFocus && triggerRef.current) triggerRef.current.focus();
  }, []);

  const openPanel = useCallback((pin) => {
    clearTimeout(timerRef.current);
    if (pin) pinnedRef.current = true;
    setOpen(true);
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
  }, [id]);

  // רק פאנל אחד פתוח
  useEffect(() => {
    const onOther = (e) => { if (e.detail !== id) { pinnedRef.current = false; setOpen(false); } };
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  }, [id]);

  // לחיצה בחוץ + Esc
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (itemRef.current && !itemRef.current.contains(e.target)) close(false); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(true); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // הצמדה לשולי החלון (פאנל רחב לא יוצא מהמסך) + מיקוד ראשוני אם התבקש
  useLayoutEffect(() => {
    const panel = itemRef.current && itemRef.current.querySelector(':scope > .v3-topbar__panel');
    if (!panel) return;
    // eslint-disable-next-line react-hooks/immutability -- מדידה/הזזה ישירה של ה-DOM של הפאנל (לא state)
    const setShift = (v) => { panel.style.translate = v; };
    setShift('');
    if (!open) return;
    const r = panel.getBoundingClientRect();
    let dx = 0;
    if (r.left < 8) dx = 8 - r.left;
    else if (r.right > window.innerWidth - 8) dx = window.innerWidth - 8 - r.right;
    if (dx) setShift(`${dx}px 0`);
    if (onOpenedRef.current) onOpenedRef.current(panel);
  }, [open]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const focusLink = (idx) => {
    const links = itemRef.current ? [...itemRef.current.querySelectorAll(LINK_SEL)] : [];
    if (!links.length) return;
    const i = idx < 0 ? links.length - 1 : idx;
    links[i]?.focus();
  };

  const itemProps = {
    ref: itemRef,
    className: `v3-topbar__item${open ? ' is-open' : ''}`,
    onPointerEnter: (e) => {
      if (!hover || e.pointerType !== 'mouse') return;
      clearTimeout(timerRef.current);
      if (!open) openPanel(false);
    },
    onPointerLeave: (e) => {
      if (!hover || e.pointerType !== 'mouse' || pinnedRef.current) return;
      timerRef.current = setTimeout(() => close(false), 140);
    },
    onBlur: (e) => {
      if (open && e.relatedTarget && itemRef.current && !itemRef.current.contains(e.relatedTarget)) close(false);
    },
    onKeyDown: (e) => {
      const onTrigger = e.target === triggerRef.current;
      const links = itemRef.current ? [...itemRef.current.querySelectorAll(LINK_SEL)] : [];
      const i = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        if (!links.length) return;
        e.preventDefault();
        if (onTrigger) { openPanel(true); setTimeout(() => focusLink(0), 30); }
        else links[(i + 1) % links.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        if (!links.length) return;
        e.preventDefault();
        if (onTrigger) { openPanel(true); setTimeout(() => focusLink(-1), 30); }
        else links[(i - 1 + links.length) % links.length]?.focus();
      } else if (!onTrigger && e.key === 'Home' && e.target.tagName !== 'INPUT') {
        e.preventDefault(); focusLink(0);
      } else if (!onTrigger && e.key === 'End' && e.target.tagName !== 'INPUT') {
        e.preventDefault(); focusLink(-1);
      }
    },
  };

  const triggerProps = {
    ref: triggerRef,
    'aria-haspopup': 'true',
    'aria-expanded': open,
    onClick: () => {
      if (!open) openPanel(true);
      else if (!pinnedRef.current) pinnedRef.current = true;
      else close(false);
    },
  };

  return { open, close, openPanel, itemProps, triggerProps, itemRef, triggerRef };
}
