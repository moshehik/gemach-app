// lib/permissions.js stand-in: hasPermission(employee, key) -> globalThis.__PERMS?.[key] ?? (roleId in [0,1,2]).
export async function hasPermission(employee, key) {
  if (globalThis.__PERMS && key in globalThis.__PERMS) return !!globalThis.__PERMS[key];
  return [0, 1, 2].includes(employee && employee.roleId);
}
export function invalidatePermissionCache() {}
export async function canOpenPage(key) { return globalThis.__PAGE_OK ? !!globalThis.__PAGE_OK(key) : true; }
export async function canOpenAnyPage(keys) { return (keys || []).some((k) => (globalThis.__PAGE_OK ? !!globalThis.__PAGE_OK(k) : true)); }
