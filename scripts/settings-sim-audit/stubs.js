// תחליפי next/navigation ו-next/link לבדיקות הדפדפן של מסכי ההגדרות. בניגוד ל-scripts/home-bg-audit/stubs.js הנתב כאן יציב
// (אותו אובייקט בכל רינדור, כמו ב-Next) ורושם כל push/replace ב-window.__pushed — כדי לבדוק את שמירת "שינויים שלא נשמרו".
import React from 'react';
const router = {
  push(href) { (window.__pushed = window.__pushed || []).push(String(href)); },
  replace(href) { (window.__pushed = window.__pushed || []).push(String(href)); },
  prefetch() {},
};
if (typeof window !== 'undefined') window.__stubRouter = router;
export const useRouter = () => router;
export const usePathname = () => '/';
export const useSearchParams = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : null);
export default function Link({ href, children, ...r }) { return React.createElement('a', { href, ...r }, children); }
