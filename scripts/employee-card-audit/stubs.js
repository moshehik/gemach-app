// next/* stubs for the mocked render (no Next runtime in the audit bundle)
import React from 'react';
export const useRouter = () => ({ push(h) { window.__nav = (window.__nav || []).concat([String(h)]); }, replace() {}, prefetch() {}, back() { window.__nav = (window.__nav || []).concat(['back']); } });
export const usePathname = () => '/employees/x';
export const useSearchParams = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : null);
export default function Link({ href, children, prefetch, ...r }) { return React.createElement('a', { href, ...r }, children); }
