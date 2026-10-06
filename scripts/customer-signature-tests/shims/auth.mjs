// Stand-in for lib/auth.js: globalThis.__AUTH === false makes checkAuth() fail (anonymous).
export async function checkAuth() { return globalThis.__AUTH !== false; }
export async function getSessionEmployee() { return globalThis.__SESSION_EMPLOYEE || null; }
export const HEAD_MANAGEMENT_ROLES = [0, 2];
export function invalidateRequireLoginCache() {}
export function readVerifiedSession() { return null; }
