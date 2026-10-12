// Stand-in for lib/auth.js: globalThis.__AUTH === false makes checkAuth() fail (anonymous).
export async function checkAuth() { return globalThis.__AUTH !== false; }
// globalThis.__SESSION_EMPLOYEE = { id, roleId, isActive:true } = a valid employee cookie (the store kiosk channel of /api/public-kiosk/register needs one since 12.10.2026)
export async function getSessionEmployee() { return globalThis.__SESSION_EMPLOYEE || null; }
export const HEAD_MANAGEMENT_ROLES = [0, 2];
export function invalidateRequireLoginCache() {}
export function readVerifiedSession() { return null; }
