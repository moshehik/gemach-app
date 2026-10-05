// Stand-in for lib/auth.js in route-level tests: every request is "logged in".
// globalThis.__AUTH = false makes checkAuth() fail (anonymous / not head management) - settings-route.test.mjs
// globalThis.__ROLE_OK = false: logged in, but not in the required role (e.g. a branch manager / regular employee)
export async function checkAuth(role) { (globalThis.__AUTH_ROLES = globalThis.__AUTH_ROLES || []).push(role); if (role && globalThis.__ROLE_OK === false) return false; return globalThis.__AUTH !== false; }
export async function getSessionEmployee() { return globalThis.__SESSION_EMPLOYEE || null; }
export const HEAD_MANAGEMENT_ROLES = [0, 2];
export function invalidateRequireLoginCache() {}
export function readVerifiedSession() { return null; } // imported by lib/permissions.js (settings route chain)
