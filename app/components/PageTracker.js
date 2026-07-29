'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Intercept window.fetch to log API queries, payload sizes, and execution times
  useEffect(() => {
    if (typeof window === 'undefined' || window.__apiInterceptorInstalled) return;
    window.__apiInterceptorInstalled = true;

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      const startTime = performance.now();

      const response = await originalFetch.apply(this, args);

      // Only track internal /api/ routes, ignore log-visit and queries-by-path to prevent loops
      if (
        url.includes('/api/') &&
        !url.includes('/api/log-visit') &&
        !url.includes('/api/queries-by-path')
      ) {
        const recordAndDispatch = (respSize, execTime) => {
          try {
            const parsedUrl = new URL(url, window.location.origin);
            const endpoint = parsedUrl.pathname;
            let requestQuery = parsedUrl.search;

            if (!requestQuery && args[1]?.body) {
              requestQuery = typeof args[1].body === 'string' ? args[1].body : JSON.stringify(args[1].body);
            }

            window.__GLOBAL_LAST_API_CALL__ = url;
            window.__LAST_API_CALLS__ = window.__LAST_API_CALLS__ || {};
            window.__LAST_API_CALLS__[window.location.pathname] = url;

            window.__LAST_API_METADATA__ = window.__LAST_API_METADATA__ || {};
            window.__LAST_API_METADATA__[url] = {
              responseSize: respSize,
              executionTime: execTime,
              timestamp: new Date().toISOString()
            };

            // Dispatch live event for floating query debugger
            window.dispatchEvent(
              new CustomEvent('agy_api_call', {
                detail: { url, endpoint, requestQuery, responseSize: respSize, executionTime: execTime }
              })
            );

            // Asynchronously record API call log
            originalFetch('/api/log-visit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              keepalive: true,
              body: JSON.stringify({
                pageUrl: url,
                requestQuery: requestQuery || null,
                responseSize: respSize,
                executionTime: execTime
              })
            }).catch(() => {});
          } catch (e) {}
        };

        const contentLength = response.headers.get('content-length');
        if (contentLength && !isNaN(parseInt(contentLength, 10))) {
          const respSize = parseInt(contentLength, 10);
          const execTime = Math.round(performance.now() - startTime);
          recordAndDispatch(respSize, execTime);
        } else {
          const originalJson = response.json;
          const originalText = response.text;

          if (originalJson) {
            response.json = async function () {
              const data = await originalJson.apply(this, arguments);
              try {
                const str = JSON.stringify(data);
                const respSize = new Blob([str]).size;
                const execTime = Math.round(performance.now() - startTime);
                recordAndDispatch(respSize, execTime);
              } catch (e) {}
              return data;
            };
          }

          if (originalText) {
            response.text = async function () {
              const text = await originalText.apply(this, arguments);
              try {
                const respSize = new Blob([text]).size;
                const execTime = Math.round(performance.now() - startTime);
                recordAndDispatch(respSize, execTime);
              } catch (e) {}
              return text;
            };
          }
        }
      }

      return response;
    };
  }, []);

  // Track page visits
  useEffect(() => {
    if (!pathname) return;
    
    // Ignore api routes or internal next js paths
    if (pathname.startsWith('/api') || pathname.startsWith('/_next')) return;

    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

    const logVisit = async (errorMsg = null) => {
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
