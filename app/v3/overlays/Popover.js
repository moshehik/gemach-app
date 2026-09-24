'use client';
// app/v3/overlays/Popover.js — CONSTITUTION §ד.8. לא מודאלי (light-dismiss),
// מעוגן לעוגן, portal ל-#v3-layer-root, phone (<640) הופך ל-bottom sheet.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../ui/cx';
import './overlays.css';

function getLayerRoot() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('v3-layer-root') || document.body;
}

/**
 * Popover: anchorRef (ref לאלמנט העוגן) · open · onClose · children · placement='bottom-start'.
 * role: 'menu'|'listbox'|'dialog' (ברירת מחדל 'menu'). ניווט מקלדת בסיסי: Esc סוגר.
 */
export default function Popover({ anchorRef, open, onClose, children, role = 'menu', label, className }) {
  const popRef = useRef(null);
  const [style, setStyle] = useState({});
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)');
    const update = () => setIsPhone(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    if (!open || isPhone) return undefined;
    const anchor = anchorRef?.current;
    const pop = popRef.current;
    if (!anchor || !pop) return undefined;
    const rect = anchor.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let top = rect.bottom + 8;
    if (top + popRect.height > vh - 8) top = Math.max(8, rect.top - popRect.height - 8); // flip up
    // RTL: מיושר ל-inline-start של העוגן = בעברית זה הצד הימני של הרכיב (right בפיזי)
    let left = rect.right - popRect.width;
    if (left < 8) left = 8;
    if (left + popRect.width > vw - 8) left = vw - popRect.width - 8;
    setStyle({ position: 'fixed', top, left, zIndex: 'var(--v3-lz-popover)' });
    return undefined;
  }, [open, isPhone, anchorRef]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    const onDocClick = (e) => {
      if (popRef.current?.contains(e.target) || anchorRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDocClick); };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  const root = getLayerRoot();
  if (!root) return null;

  return createPortal(
    isPhone ? (
      <div className="v3ov-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
        <div ref={popRef} role={role} aria-label={label} className={cx('v3ov-popover', 'v3ov-popover--sheet', 'v3-m-sheet-up', className)}>
          <div className="v3ov-popover__handle" aria-hidden="true" />
          {children}
        </div>
      </div>
    ) : (
      <div ref={popRef} role={role} aria-label={label} style={style} className={cx('v3ov-popover', 'v3-m-pop', className)}>
        {children}
      </div>
    ),
    root,
  );
}
