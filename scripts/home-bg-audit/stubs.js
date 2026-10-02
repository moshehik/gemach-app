import React from 'react';
export const useRouter = () => ({ push() {}, replace() {}, prefetch() {} });
export const usePathname = () => '/';
export const useSearchParams = () => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search); // SearchKeySync (דף הבית) קורא אותו
export default function Link({ href, children, ...r }) { return React.createElement('a', { href, ...r }, children); }
export function SettingQuickPanelStub() { return null; }
