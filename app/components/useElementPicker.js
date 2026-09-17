'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

// מתאר אלמנט DOM בקצרה לצורך תיוג טקסטואלי (ר' ErrorReportButton.js ההיסטורי) -
// tag + id + עד 2 classes + טקסט מקוצר.
export function describeElement(el) {
  if (!el) return null;
  const tag = el.tagName ? el.tagName.toLowerCase() : 'אלמנט';
  const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const idPart = el.id ? `#${el.id}` : '';
  const classNames = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const classPart = classNames.length ? `.${classNames.join('.')}` : '';
  const selector = `${tag}${idPart}${classPart}`;
  const label = text ? `${selector} — "${text}"` : selector;
  return { selector, text, label };
}

// מנגנון "מצב איתור" משותף - הועבר מ-ErrorReportButton.js (היה שם מוטבע, כעת נצרך
// גם ע"י AIFloatingWidget לצילום אלמנט): קליק בעמוד נחסם ונאסף במקום להפעיל את
// הפעולה האמיתית שלו, עם מלבן-הדגשה שעוקב אחרי העכבר.
// onPick(el) נקרא עם האלמנט שנבחר; startPicking() מפעיל את המצב.
export default function useElementPicker(onPick) {
  const [isPicking, setIsPicking] = useState(false);
  const [hoverRect, setHoverRect] = useState(null);
  const hoveredElRef = useRef(null);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!isPicking) return;

    const handleMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el !== hoveredElRef.current) {
        hoveredElRef.current = el;
        setHoverRect(el.getBoundingClientRect());
      }
    };
    const stopPicking = () => {
      setIsPicking(false);
      setHoverRect(null);
      hoveredElRef.current = null;
    };
    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const el = hoveredElRef.current || e.target;
      stopPicking();
      onPickRef.current?.(el);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopPicking();
      }
    };

    document.addEventListener('mousemove', handleMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKey, true);
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

    return () => {
      document.removeEventListener('mousemove', handleMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKey, true);
      document.body.style.cursor = prevCursor;
      hoveredElRef.current = null;
    };
  }, [isPicking]);

  const startPicking = useCallback(() => setIsPicking(true), []);
  const cancelPicking = useCallback(() => { setIsPicking(false); setHoverRect(null); }, []);

  return { isPicking, hoverRect, startPicking, cancelPicking };
}

// שכבת התצוגה (מלבן ההדגשה + הודעת ה"לחץ על האלמנט...") - זהה בדיוק למה שהיה
// מוטבע ב-ErrorReportButton.js, הועבר לכאן כדי שלא יוכפל בין שני הצרכנים.
export function ElementPickerOverlay({ isPicking, hoverRect }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!isPicking || !mounted) return null;

  return createPortal(
    <>
      {hoverRect && (
        <div
          style={{
            position: 'fixed',
            top: hoverRect.top,
            left: hoverRect.left,
            width: hoverRect.width,
            height: hoverRect.height,
            border: '2px solid var(--primary-solid)',
            background: 'var(--primary-tint)',
            opacity: 0.55,
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 999998
          }}
        />
      )}
      <div
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          background: 'var(--text)',
          color: 'var(--surface)',
          padding: '10px 18px',
          borderRadius: 999,
          fontSize: 13.5,
          fontWeight: 600,
          boxShadow: 'var(--shadow-lg)',
          pointerEvents: 'none'
        }}
      >
        לחץ על האלמנט הרצוי בעמוד לסימונו · Esc לביטול
      </div>
    </>,
    document.body
  );
}
