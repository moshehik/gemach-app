'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page visits
  useEffect(() => {
    if (!pathname) return;
    
    // Ignore api routes or internal next js paths
    if (pathname.startsWith('/api') || pathname.startsWith('/_next')) return;

    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

    const logVisit = async (errorMsg = null) => {
      // התור המשותף מ-app/layout.js (אצווה אחת כל ~20 שנ') - במקום POST נפרד לכל ניווט.
      if (typeof window !== 'undefined' && typeof window.__queueVisitLog === 'function') {
        window.__queueVisitLog({ pageUrl: url, loadingError: errorMsg });
        return;
      }
      try {
        await fetch('/api/log-visit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          keepalive: true,
          body: JSON.stringify({
            pageUrl: url,
            loadingError: errorMsg
          }),
        });
      } catch (e) {
        // Silently fail if logging fails
      }
    };

    // Log the normal visit
    logVisit();

    // Catch uncaught errors on the page
    const handleError = (event) => {
      logVisit(event.message || 'Unknown error');
    };

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
    };

  }, [pathname, searchParams]);

  return null; // This component does not render anything
}
