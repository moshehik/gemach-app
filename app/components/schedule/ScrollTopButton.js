'use client';

import { useEffect, useState } from 'react';

// כפתור "גלול ללמעלה" (בקשת הבעלים 7.10.2026): מופיע בצד הדף אחרי שגוללים מעט, חץ ^ עם טולטיפ. הטולטיפ = data-tip
// (אותו מנגנון כמו שאר הדף, ScheduleDay.js usePageTooltip / המעטפת). גלילה חלקה, אלא אם המשתמשת ביקשה פחות תנועה.
// החץ הוא אייקון מקומי (לא ב-sprite הגלובלי - אין שם חץ למעלה), באותו סגנון קו כמו שאר האייקונים.
const SHOW_AFTER_PX = 320;

export default function ScrollTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const go = () => {
    let smooth = true;
    try { smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ברירת מחדל: חלק */ }
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  };
  return (
    <button
      type="button"
      className={'ibtn lz-top' + (show ? ' on' : '')}
      aria-label="גלול ללמעלה"
      data-tip="גלול ללמעלה"
      tabIndex={show ? 0 : -1}
      aria-hidden={show ? undefined : 'true'}
      onClick={go}
    >
      <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 15 6-6 6 6" /></svg>
    </button>
  );
}
