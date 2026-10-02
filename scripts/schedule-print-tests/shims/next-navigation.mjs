// next/navigation stub for the render harness (the templates themselves never call these; the route page does).
export function useParams() { return globalThis.__NAV_PARAMS || {}; }
export function useSearchParams() { return new URLSearchParams(globalThis.__NAV_SEARCH || ''); }
export function usePathname() { return globalThis.__NAV_PATH || '/'; }
export function useRouter() { return { push() {}, replace() {}, back() {} }; }
