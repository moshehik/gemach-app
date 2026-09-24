'use client';
// app/v3/overlays/Tip.js — CONSTITUTION §ד.9. Tip יחיד לכל האתר, לא מודאלי,
// לא אינטראקטיבי בפנים (אם צריך תוכן אינטראקטיבי -> Popover). ⓘ = IconBtn 44×44.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../ui/Icon';
import { cx } from '../ui/cx';
import './overlays.css';

function getLayerRoot() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('v3-layer-root') || document.body;
}

/**
 * <Tip content="הסבר">{trigger}</Tip> — עוטף כל אלמנט. עכבר: hover 150ms;
 * מקלדת: focus; מגע: לחיצה מחליפה. children יכול להיות ⓘ (ראו InfoTip למטה).
 */
export function Tip({ content, children, placement = 'top', className }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const tipRef = useRef(null);
  const timerRef = useRef(null);
  const uid = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current, tip = tipRef.current;
    if (!anchor || !tip) return;
    const rect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    let top = placement === 'top' ? rect.top - tipRect.height - 8 : rect.bottom + 8;
    if (top < 8) top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.min(Math.max(8, left), vw - tipRect.width - 8);
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  }, [open, placement]);

  const show = () => { clearTimeout(timerRef.current); timerRef.current = setTimeout(() => setOpen(true), 150); };
  const hide = () => { clearTimeout(timerRef.current); setOpen(false); };
  const toggleTouch = (e) => { e.stopPropagation(); setOpen((o) => !o); };

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!tipRef.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('touchstart', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const tid = `v3tip-${uid}`.replace(/:/g, '');
  const root = getLayerRoot();

  return (
    <span
      ref={anchorRef}
      className={cx('v3ov-tip-anchor', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchStart={toggleTouch}
      aria-describedby={open ? tid : undefined}
    >
      {children}
      {open && root && createPortal(
        <span ref={tipRef} role="tooltip" id={tid} className="v3ov-tip v3-m-fade-up">{content}</span>,
        root,
      )}
    </span>
  );
}

/** InfoTip: כפתור ⓘ 44×44 (אזור מגע), תוכן ה-Tip. label = aria-label חובה. */
export function InfoTip({ content, label = 'מידע נוסף', className }) {
  return (
    <Tip content={content} className={className}>
      <button type="button" className="v3ov-infobtn" aria-label={label} data-tip="">
        <Icon name="info" size="sm" anim={false} />
      </button>
    </Tip>
  );
}

export default Tip;
