'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page visits
  useEffect(() => {
    if (!pathname) return;
    
    // Ignore api routes or internal next js paths if needed
    if (pathname.startsWith('/api') || pathname.startsWith('/_next')) return;

    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

    const logVisit = async (errorMsg = null) => {
      try {
        await fetch('/api/log-visit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pageUrl: url,
            loadingError: errorMsg
          }),
        });
      } catch (e) {
        // Silently fail if logging fails
        console.error('Tracker error:', e);
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
