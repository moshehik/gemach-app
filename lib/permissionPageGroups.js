// Write-side helpers for PermissionPageGroup (see its doc comment in
// prisma/schema.prisma). Used by app/api/admin/permissions/page-groups/**.
import prisma from '@/app/lib/prisma';
import { getCatalogItem } from './permissionsMetadata';
import { setDepartmentPermission, setEmployeeOverride, clearEmployeeOverride } from './permissions';

// A catalog page key may belong to at most one row at a time. Called before
// creating/updating a row with a given key list — strips those keys out of every
// *other* row (deleting a row left with no keys) so a page can't silently appear in
// two rows when it's moved in from another row via PageGroupModal's picker.
export async function releaseKeysFromOtherGroups(keys, excludeGroupId) {
  if (!keys.length) return;
  const others = await prisma.permissionPageGroup.findMany({
    where: excludeGroupId ? { id: { not: excludeGroupId } } : undefined,
  });
  for (const other of others) {
    const otherKeys = JSON.parse(other.keys || '[]');
    const filtered = otherKeys.filter((k) => !keys.includes(k));
    if (filtered.length === otherKeys.length) continue;
    if (filtered.length === 0) {
      // Every key moved out — an empty row would just linger as a dead line in the
      // table (its keys' DepartmentPermission values live on independently).
      await prisma.permissionPageGroup.delete({ where: { id: other.id } });
    } else {
      await prisma.permissionPageGroup.update({ where: { id: other.id }, data: { keys: JSON.stringify(filtered) } });
    }
  }
}

export function validatePageKeys(keys, catalogGroup) {
  if (!Array.isArray(keys)) return false;
  return keys.every((k) => getCatalogItem(k)?.group === catalogGroup);
}

// Writes the same department value to every key in `keys`, for every roleId in
// `access` — the "set the permission level at once" part of a row save.
export async function applyAccessToKeys(keys, access) {
  if (!keys.length || !access) return;
  for (const key of keys) {
    for (const [roleIdStr, value] of Object.entries(access)) {
      const roleId = parseInt(roleIdStr, 10);
      if (Number.isNaN(roleId)) continue;
      await setDepartmentPermission(roleId, key, !!value);
    }
  }
}

// Grants (or revokes) a row-level EmployeePermissionOverride across every key in
// `keys` that actually supports one — a legacyEmployeeField item (feature:ai /
// feature:error_reports) has no override row at all (see lib/permissions.js), and a
// `number`-type item (feature:export_max_rows) doesn't have a boolean "grant access"
// to set, so both are silently left out, same as how roleId 2 is already left out of
// the department matrix above. `previousEmployeeIds` (the row's employeeAccess before
// this save, from app/api/admin/permissions/route.js's buildPermissionGroups) is
// diffed against the new `employeeIds` so anyone dropped from the picker has their
// override cleared, not just anyone left unchecked from a blank slate.
export async function applyAccessToEmployees(keys, employeeIds, previousEmployeeIds, rowName) {
  const eligibleKeys = keys
    .map((k) => getCatalogItem(k))
    .filter((item) => item && item.type === 'boolean' && !item.legacyEmployeeField)
    .map((item) => item.key);
  if (!eligibleKeys.length) return;

  const toGrant = new Set(employeeIds || []);
  const toRevoke = (previousEmployeeIds || []).filter((id) => !toGrant.has(id));

  for (const key of eligibleKeys) {
    for (const employeeId of toGrant) {
      await setEmployeeOverride(employeeId, key, true, { note: `גישה פרטנית דרך שורת ההרשאה "${rowName}"` });
    }
    for (const employeeId of toRevoke) {
      await clearEmployeeOverride(employeeId, key);
    }
  }
}
