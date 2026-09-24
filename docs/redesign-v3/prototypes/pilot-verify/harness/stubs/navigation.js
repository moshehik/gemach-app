const router = { push: (u) => { window.__navLog = [...(window.__navLog || []), u]; }, back: () => { window.__navLog = [...(window.__navLog || []), 'BACK']; }, replace() {}, refresh() {} };
export function useRouter() { return router; } // יציב, כמו ה-router של Next
export function usePathname() { return '/v3-pilot/customers/c1'; }
export function useSearchParams() { return new URLSearchParams(); }
