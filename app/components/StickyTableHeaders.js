'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/*
  מכוון את נקודת ההיצמדות של כותרות הטבלה בכל המערכת:
  - טבלה שיושבת בתוך אזור גלילה פנימי (שלד העמוד, מודאל, קופסה עם גלילה) —
    הכותרת נצמדת לראש אותו אזור (0), כך שלעולם לא נראות שורות מעליה.
  - טבלה שנגללת עם העמוד כולו — הכותרת נצמדת בדיוק מתחת לכותרת המערכת (הנאב-בר),
    לפי הגובה האמיתי שנמדד ולא לפי ערך קבוע.
  הערך נכתב כמשתנה CSS על הטבלה עצמה, ו-globals.css משתמש בו.
*/

/* גם overflow: hidden יוצר "אזור גלילה" לצורך position: sticky —
   בלעדיו הכותרת נדחפת פנימה בגובה הנאב-בר ונראית באמצע הטבלה.
   overflow: clip לעומת זאת אינו יוצר אזור כזה. */
const SCROLLABLE = /(auto|scroll|overlay|hidden)/;
const NAVBAR_TOP = 'var(--navbar-height, 72px)';
const INNER_TOP = '0px';

function isScrollable(el) {
  const style = window.getComputedStyle(el);
  return SCROLLABLE.test(style.overflowY) || SCROLLABLE.test(style.overflowX);
}

/* גובה הנאב-בר האמיתי — כדי שכותרות טבלה בעמודים שנגללים עם הדפדפן
   ייעצרו בדיוק מתחת לכותרת המערכת ולא יתחבאו מאחוריה. */
function syncNavbarHeight() {
  const nav = document.querySelector('.navbar');
  const height = nav && nav.offsetParent !== null ? nav.getBoundingClientRect().height : 0;
  const next = `${Math.round(height)}px`;
  const root = document.documentElement;
  if (root.style.getPropertyValue('--navbar-height') !== next) {
    root.style.setProperty('--navbar-height', next);
  }
}

function applyStickyOffsets() {
  syncNavbarHeight();

  document.querySelectorAll('table').forEach((table) => {
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

    const next = hasScrollAncestor ? INNER_TOP : NAVBAR_TOP;
    // כותבים רק כשיש שינוי — אחרת ה-MutationObserver היה מפעיל את עצמו בלולאה,
    // ורנדור מחדש של React (שדורס את מאפיין ה-style) מטופל בכל מקרה.
    if (table.style.getPropertyValue('--th-sticky-top') !== next) {
      table.style.setProperty('--th-sticky-top', next);
    }
  });
}

export default function StickyTableHeaders() {
  const pathname = usePathname();

  useEffect(() => {
    let timer = null;

    // בלי requestAnimationFrame: בטאב שאינו מצויר (רקע) הוא לא נקרא כלל
    // והכותרות היו נשארות בלי כיוונון.
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(applyStickyOffsets, 120);
    };

    applyStickyOffsets();
    // הנאב-בר משנה גובה אחרי טעינת הפונטים
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule).catch(() => {});
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    const nav = document.querySelector('.navbar');
    let resizeObserver = null;
    if (nav && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(nav);
    }
    window.addEventListener('resize', schedule);

    return () => {
      observer.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', schedule);
      if (timer) clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
