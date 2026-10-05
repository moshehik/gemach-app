'use client';

import { useEffect } from 'react';

// טולטיפ הדף (.pl-tt, טולטיפ 1-6 בפלטה): ריחוף/מיקוד על [data-tip] כשאין מעטפת A5 (שם המעטפת מטפלת בזה על כל התוכן).
// אותו מימוש כמו usePageTooltip ב-StockCheckPage.js / ScheduleDay.js (העתק מקומי, כמו שם), בלי לחיצה על כפתור הסבר (אין כאלה בפרופיל).
export default function usePageTooltip(rootRef, ttRef, shellHandlesHover) {
  useEffect(() => {
    const root = rootRef.current;
    const tt = ttRef.current;
    if (!root || !tt) return undefined;
    let cur = null;
    const hide = () => { tt.classList.remove('on'); cur = null; };
    const show = (el) => {
      cur = el;
      tt.textContent = el.getAttribute('data-tip');
      tt.classList.add('on');
      const r = el.getBoundingClientRect();
      const w = tt.offsetWidth;
      const h = tt.offsetHeight;
      let x = r.left + r.width / 2 - w / 2;
      x = Math.max(10, Math.min(window.innerWidth - w - 10, x));
      // הטולטיפ לא נכנס מתחת לתפריט העליון (#snav הדביק, z-index 95): אם מעל האייקון אין מקום מתחת לקצה התחתון שלו - מתהפך מתחת לאייקון
      const nav = document.getElementById('snav');
      const minTop = Math.max(8, nav ? Math.round(nav.getBoundingClientRect().bottom) + 8 : 0);
      let y = r.top - h - 10;
      if (y < minTop) y = r.bottom + 10;
      tt.style.left = `${x}px`;
      tt.style.top = `${y}px`;
    };
    const over = (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t !== cur) show(t); else if (!t && cur) hide(); };
    const out = (e) => { if (e.target.closest && e.target.closest('[data-tip]')) hide(); };
    const fin = (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t.matches(':focus-visible')) show(t); };
    const key = (e) => { if (e.key === 'Escape' && cur) hide(); };
    if (!shellHandlesHover) {
      root.addEventListener('mouseover', over);
      root.addEventListener('mouseout', out);
      root.addEventListener('focusin', fin);
      root.addEventListener('focusout', out);
    }
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      root.removeEventListener('mouseover', over);
      root.removeEventListener('mouseout', out);
      root.removeEventListener('focusin', fin);
      root.removeEventListener('focusout', out);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', hide);
    };
  }, [rootRef, ttRef, shellHandlesHover]);
}
