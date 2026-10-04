// next/* בחבילת הבדיקה: הנתיב מגיע מ-window.__PATH (נקבע ב-entry לפי ?scn=), כדי לבדוק את כלל "רק בנתיבי המסך".
import React, { Suspense } from 'react';
export const useRouter = () => ({ push() {}, replace() {}, prefetch() {}, back() {}, refresh() {} });
export const usePathname = () => (typeof window !== 'undefined' && window.__PATH) || '/';
export const useSearchParams = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : null);
export const redirect = () => {};
export default function Link({ href, children, prefetch, ...r }) { return React.createElement('a', { href, ...r }, children); }
export function dynamic(loader) {
  const Lazy = React.lazy(() => loader().then((m) => ({ default: m.default || m })));
  return function Dyn(props) { return React.createElement(Suspense, { fallback: null }, React.createElement(Lazy, props)); };
}
