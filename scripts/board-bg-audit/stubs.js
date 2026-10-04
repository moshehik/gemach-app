import React from 'react';
// next/* בלי Next: router שמתעד ניווט (window.__nav), Link = <a>
export const useRouter = () => ({ push(u) { window.__nav.push(String(u)); }, replace(u) { window.__nav.push(String(u)); }, prefetch() {}, back() {} });
export const usePathname = () => '/board';
export const useSearchParams = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : null);
export default function Link({ href, children, prefetch, ...r }) { return React.createElement('a', { href, ...r }, children); }
