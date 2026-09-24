'use client';
// ⓘ + ריבוע צף (R11). ריחוף/מיקוד = פתיחה; לחיצה (מגע) = החלפה; Esc/לחיצה בחוץ = סגירה.
// מיקום: מתחת לעוגן, מתהפך למעלה אם אין מקום, מוצמד לגבולות החלון (לא תלוי left/right של הדף).
import { cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { cx } from './cx';

const cssPx = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

export default function Tip({ children, content, label = 'מידע נוסף', className }) {
  // <Tip>הסבר</Tip> = כפתור ⓘ · <Tip content="הסבר"><span>עוגן</span></Tip> = עוגן מותאם
  const custom = content != null;
  const body = custom ? content : children;
  const id = `tip${useId().replace(/:/g, '')}`;
  const anchor = useRef(null), box = useRef(null), timer = useRef(null), ptype = useRef('mouse');
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const a = anchor.current, b = box.current;
    if (!a || !b) return;
    const r = a.getBoundingClientRect();
    const gap = cssPx('--v3-sp-2'), margin = cssPx('--v3-sp-2');
    const w = b.offsetWidth, h = b.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let top = r.bottom + gap;
    if (top + h > vh - margin && r.top - gap - h > margin) top = r.top - gap - h;
    top = Math.max(margin, Math.min(top, vh - h - margin));
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(margin, Math.min(left, vw - w - margin));
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place, body]);
  useEffect(() => {
    if (!open) { setShown(false); return undefined; }
    const raf = setTimeout(() => { place(); setShown(true); }, 16);
    const on = () => place();
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    const down = (e) => { if (!anchor.current?.contains(e.target)) setOpen(false); };
    window.addEventListener('resize', on); window.addEventListener('scroll', on, true);
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', down);
    return () => {
      clearTimeout(raf);
      window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true);
      document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', down);
    };
  }, [open, place]);

  const show = () => { clearTimeout(timer.current); setOpen(true); };
  const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 80); };
  const handlers = {
    onPointerEnter: (e) => { ptype.current = e.pointerType; if (e.pointerType === 'mouse') show(); },
    onPointerLeave: (e) => { if (e.pointerType === 'mouse') hide(); },
    onPointerDown: (e) => { ptype.current = e.pointerType; },
    onFocus: show, onBlur: hide,
    onClick: () => { if (ptype.current === 'mouse') show(); else setOpen((o) => !o); },
    'aria-describedby': id,
  };

  let trigger;
  if (custom && isValidElement(children)) {
    trigger = cloneElement(children, { ref: anchor, ...handlers, tabIndex: children.props.tabIndex ?? 0 });
  } else {
    trigger = (
      <button ref={anchor} type="button" className={cx('v3-tip-btn', className)} aria-label={label} {...handlers}>
        <Icon name="info" size="sm" />
      </button>
    );
  }
  return (
    <>
      {trigger}
      {mounted && createPortal(
        <div ref={box} id={id} role="tooltip" data-v3="" dir="rtl" className={cx('v3-tip', shown && 'is-on')} style={{ top: pos.top, left: pos.left }}>{body}</div>,
        document.body,
      )}
    </>
  );
}
