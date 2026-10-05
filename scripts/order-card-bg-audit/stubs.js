// next/* stubs for the order-card harness bundle (esbuild, no Next runtime). router.push is recorded on window.__nav.
import React from 'react';
export const useRouter = () => ({ push(h) { (window.__nav = window.__nav || []).push(h); }, replace(h) { (window.__nav = window.__nav || []).push(h); }, prefetch() {}, back() {} });
export const usePathname = () => '/orders/53375';
export const useSearchParams = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : null);
export default function Link({ href, children, ...r }) { return React.createElement('a', { href, ...r }, children); }
