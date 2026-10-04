import React from 'react';
// next/* בלי Next: router שמתעד ניווט (window.__nav), Link = <a>
// window.__DEMO_GO: רק בדמו העצמאי (build-demo.mjs) - ניווט אמיתי ללו"ז היומי של הדמו
export const useRouter = () => ({ push(u) { window.__nav.push(String(u)); if (window.__DEMO_GO) window.__DEMO_GO(String(u)); }, replace(u) { window.__nav.push(String(u)); }, prefetch() {}, back() {} });
export const usePathname = () => '/board';
export const useSearchParams = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : null);
export default function Link({ href, children, prefetch, ...r }) { return React.createElement('a', { href, ...r }, children); }
