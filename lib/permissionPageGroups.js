// Write-side helpers for PermissionPageGroup (see its doc comment in
// prisma/schema.prisma). Used by app/api/admin/permissions/page-groups/**.
import prisma from '@/app/lib/prisma';
import { getCatalogItem } from './permissionsMetadata';
import { setDepartmentPermission } from './permissions';

// A catalog page key may belong to at most one row at a time. Called before
// creating/updating a row with a given key list — strips those keys out of every
// *other* row so a page can't silently appear in two rows after a drag-in.
export async function releaseKeysFromOtherGroups(keys, excludeGroupId) {
  if (!keys.length) return;
  const others = await prisma.permissionPageGroup.findMany({
    where: excludeGroupId ? { id: { not: excludeGroupId } } : undefined,
  });
  for (const other of others) {
    const otherKeys = JSON.parse(other.keys || '[]');
    const filtered = otherKeys.filter((k) => !keys.includes(k));
    if (filtered.length !== otherKeys.length) {
      await prisma.permissionPageGroup.update({ where: { id: other.id }, data: { keys: JSON.stringify(filtered) } });
    }
  }
}

export function validatePageKeys(keys) {
  if (!Array.isArray(keys)) return false;
  return keys.every((k) => getCatalogItem(k)?.group === 'pages');
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
