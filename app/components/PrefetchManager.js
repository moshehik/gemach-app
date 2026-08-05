'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { prefetchRoute, prefetchNeighbors, isPrefetchableRoute } from '../lib/prefetchRoutes';

// מפעיל חימום מטמון נתונים בין דפים (Next כבר עושה prefetch לקוד של <Link>,
// אבל לא לנתונים). שני טריגרים:
// 1. ריחוף/פוקוס/מגע על כל קישור פנימי לנתיב שרשום ב-prefetchRoutes — מאזין
//    אחד מואצל על document, בלי לגעת ברכיבי הניווט עצמם.
// 2. אחרי שהדף הנוכחי נטען ונרגע (2.5 שניות), חימום הדפים ה"שכנים" שלו.
// לא מרונדר דבר; לא פעיל במסך הלקוח (קיוסק) כדי לא לייצר עומס מיותר שם.

const IDLE_PREFETCH_DELAY_MS = 2500;

function routeFromLink(target) {
  const anchor = target instanceof Element ? target.closest('a[href]') : null;
  if (!anchor) return null;
  const href = anchor.getAttribute('href');
  if (!href || !href.startsWith('/')) return null;
  const path = href.split('?')[0].split('#')[0];
  return isPrefetchableRoute(path) ? path : null;
}

export default function PrefetchManager() {
  const pathname = usePathname();
  const isKiosk = pathname?.startsWith('/customer-interface');

  useEffect(() => {
    if (isKiosk) return;

    const onIntent = (e) => {
      const route = routeFromLink(e.target);
      if (route && route !== pathname) prefetchRoute(route);
    };

    document.addEventListener('mouseover', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent, { passive: true });
    document.addEventListener('touchstart', onIntent, { passive: true });
    return () => {
      document.removeEventListener('mouseover', onIntent);
      document.removeEventListener('focusin', onIntent);
      document.removeEventListener('touchstart', onIntent);
    };
  }, [pathname, isKiosk]);

  useEffect(() => {
    if (isKiosk || !pathname) return;
    const timer = setTimeout(() => prefetchNeighbors(pathname), IDLE_PREFETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname, isKiosk]);

  return null;
}
