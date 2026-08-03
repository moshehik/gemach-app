'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/*
  מכוון את נקודת ההיצמדות של כותרות הטבלה בכל המערכת:
  - טבלה שיושבת בתוך אזור גלילה פנימי (שלד העמוד, מודאל, קופסה עם גלילה) —
    הכותרת נצמדת לראש אותו אזור (0), כך שלעולם לא נראות שורות מעליה.
  - טבלה שנגללת עם העמוד כולו — הכותרת נצמדת בדיוק מתחת לכותרת המערכת (הנאב-בר).
  הערך נכתב כמשתנה CSS על הטבלה עצמה, וה-CSS ב-globals.css משתמש בו.
*/

const SCROLLABLE = /(auto|scroll|overlay)/;

function isScrollable(el) {
  const style = window.getComputedStyle(el);
  return SCROLLABLE.test(style.overflowY) || SCROLLABLE.test(style.overflowX);
}

/* גובה הנאב-בר האמיתי — כדי שכותרות טבלה בעמודים שנגללים עם הדפדפן
   ייעצרו בדיוק מתחת לכותרת המערכת ולא יתחבאו מאחוריה. */
function syncNavbarHeight() {
  const nav = document.querySelector('.navbar');
  const height = nav && nav.offsetParent !== null ? nav.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty('--navbar-height', `${Math.round(height)}px`);
}

function applyStickyOffsets() {
  window.__stickyTableHeaders = true;
  syncNavbarHeight();
  const tables = document.querySelectorAll('table');
  tables.forEach((table) => {
    if (!table.tHead) return;

    let el = table.parentElement;
    let hasScrollAncestor = false;
    while (el && el !== document.body && el !== document.documentElement) {
      if (isScrollable(el)) {
        hasScrollAncestor = true;
        break;
      }
      el = el.parentElement;
    }

    table.style.setProperty(
      '--th-sticky-top',
      hasScrollAncestor ? '0px' : 'var(--navbar-height, 72px)'
    );
  });
}

export default function StickyTableHeaders() {
  const pathname = usePathname();

  useEffect(() => {
    let frame = null;
    let timer = null;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(applyStickyOffsets);
      }, 150);
    };

    applyStickyOffsets();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      if (timer) clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
