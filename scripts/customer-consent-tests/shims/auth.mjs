// Stand-in for lib/auth.js: globalThis.__AUTH === false makes checkAuth() fail (anonymous); __AUTH_ROLE_ONLY=true makes role checks fail
// (a logged-in employee who is not head management).
export async function checkAuth(requiredRole) {
  if (globalThis.__AUTH === false) return false;
  if (requiredRole && globalThis.__AUTH_ROLE_ONLY === true) return false;
  return true;
}
export async function getSessionEmployee() { return globalThis.__SESSION_EMPLOYEE || null; }
export const HEAD_MANAGEMENT_ROLES = [0, 2];
export function invalidateRequireLoginCache() {}
export function readVerifiedSession() { return null; }
