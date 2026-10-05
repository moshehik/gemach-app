// Stand-in for lib/auth.js. globalThis.__AUTH = false -> anonymous; globalThis.__ROLE_OK(role) can veto a role-gated checkAuth('role').
export async function checkAuth(role) {
  if (globalThis.__AUTH === false) return false;
  if (role && typeof globalThis.__ROLE_OK === 'function') return !!globalThis.__ROLE_OK(role);
  return true;
}
export async function getSessionEmployee() { return globalThis.__SESSION_EMPLOYEE || null; }
export const HEAD_MANAGEMENT_ROLES = [0, 2];
export function invalidateRequireLoginCache() {}
export function readVerifiedSession() { return globalThis.__SESSION_EMPLOYEE ? { employeeId: globalThis.__SESSION_EMPLOYEE.id, roleId: globalThis.__SESSION_EMPLOYEE.roleId } : null; }
