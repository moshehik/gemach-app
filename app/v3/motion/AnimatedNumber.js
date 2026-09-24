'use client';
// app/v3/motion/AnimatedNumber.js — "count" preset (CONSTITUTION §ה.1: tween סכומים).
// תמיד מציג את הערך הנכון גם אם ה-tween לא רץ (§ה.4: אין העלמת תוכן - הערך
// הראשוני מוצג מיד, ה-tween רק "מייפה" את המעבר בין ערכים).
import { useEffect, useRef, useState } from 'react';
import useReducedMotion from './useReducedMotion';

/** value: מספר. format: (n)=>string (ברירת מחדל: toLocaleString('he-IL')). duration: ms. */
export default function AnimatedNumber({ value, format, duration = 450, className, as: As = 'bdi' }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    if (reduced || from === value || typeof from !== 'number' || typeof value !== 'number') {
      setDisplay(value);
      fromRef.current = value;
      return undefined;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, reduced]);

  const shown = Math.round(display);
  const text = format ? format(shown) : shown.toLocaleString('he-IL');
  return <As className={className}>{text}</As>;
}
