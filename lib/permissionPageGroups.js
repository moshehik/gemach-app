// Write-side helpers for PermissionPageGroup (see its doc comment in
// prisma/schema.prisma). Used by app/api/admin/permissions/page-groups/**.
//
// Model: every row stores ITS OWN access (`access` = { roleId: bool }, `employeeIds`).
// A catalog key may sit in several rows at once; its real DepartmentPermission /
// EmployeePermissionOverride values are then the UNION (OR) of every row that contains
// it — the lenient reading: if any row lets a department/employee in, they're in.
// A key that is in no row at all has no explicit values (falls back to the catalog
// default), which is also what happens when its last row is deleted.
import prisma from '@/app/lib/prisma';
import { getCatalogItem, ALWAYS_ALLOWED_ROLE_IDS } from './permissionsMetadata';
import { setDepartmentPermission, clearDepartmentPermission, setEmployeeOverride, clearEmployeeOverride } from './permissions';

export const ROW_OVERRIDE_NOTE_PREFIX = 'גישה פרטנית דרך שורת ההרשאה';

export function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

// A row may mix pages and features, so a key is valid if it's ANY known catalog item that the
// central window offers (notConfigurable items are locked to head management / have no login, so a
// row for them would only show access that nothing enforces).
export function validatePageKeys(keys) {
  if (!Array.isArray(keys)) return false;
  return keys.every((k) => {
    const item = getCatalogItem(k);
    return !!item && !item.notConfigurable;
  });
}

// A row that lists an employee grants them every boolean key in it. If that employee has a personal
// BLOCK (false override made on their card) on one of those keys, saving the row would silently wipe
// the block - so the row routes refuse and name the conflicts instead. Returns [] when there are none.
export async function findPersonalBlockConflicts(keys, employeeIds) {
  const boolKeys = keys.filter((k) => getCatalogItem(k)?.type === 'boolean');
  if (!boolKeys.length || !employeeIds.length) return [];
  const blocks = await prisma.employeePermissionOverride.findMany({
    where: { key: { in: boolKeys }, employeeId: { in: employeeIds }, value: 'false' },
    include: { employee: { select: { firstName: true, lastName: true } } },
  });
  return blocks
    .filter((o) => !(o.note || '').startsWith(ROW_OVERRIDE_NOTE_PREFIX))
    .map((o) => ({
      employeeId: o.employeeId,
      name: `${o.employee?.firstName || ''} ${o.employee?.lastName || ''}`.trim() || o.employeeId,
      key: o.key,
      label: getCatalogItem(o.key)?.label || o.key,
    }));
}

// Cleans client-supplied access/employee payloads before they're stored on a row.
export function sanitizeAccess(access) {
  const clean = {};
  for (const [roleId, value] of Object.entries(access || {})) {
    const id = parseInt(roleId, 10);
    // Always-allowed roles (הנהלה ראשית / מתכנת) have no toggle — never stored on a row.
    if (Number.isNaN(id) || ALWAYS_ALLOWED_ROLE_IDS.includes(id)) continue;
    clean[roleId] = !!value;
  }
  return clean;
}
export function sanitizeEmployeeIds(employeeIds) {
  return Array.isArray(employeeIds) ? [...new Set(employeeIds.filter((id) => typeof id === 'string' && id))] : [];
}

// Pure — no DB. The lenient union of the rows that contain one key.
export function resolveKeyFromRows(rowsForKey) {
  const access = {};
  const employeeIds = new Set();
  for (const row of rowsForKey) {
    for (const [roleId, value] of Object.entries(parseJson(row.access, {}))) {
      access[roleId] = !!access[roleId] || !!value;
    }
    for (const id of parseJson(row.employeeIds, [])) employeeIds.add(id);
  }
  return { access, employeeIds };
}

// Re-derives DepartmentPermission / EmployeePermissionOverride for `keys` from the
// rows that currently contain them. Call after ANY create/update/delete of a row,
// passing both the row's previous and new keys.
// Only boolean items are written from a row: a number-type item (feature:export_max_rows)
// has no meaningful yes/no, so rows never touch its stored value.
export async function syncKeys(keys) {
  const uniqueKeys = [...new Set(keys)];
  if (!uniqueKeys.length) return;
  const rows = await prisma.permissionPageGroup.findMany();
  const rowKeys = rows.map((row) => ({ row, keys: parseJson(row.keys, []) }));

  for (const key of uniqueKeys) {
    const item = getCatalogItem(key);
    if (!item || item.type !== 'boolean') continue;

    const rowsForKey = rowKeys.filter((r) => r.keys.includes(key)).map((r) => r.row);
    const { access, employeeIds } = resolveKeyFromRows(rowsForKey);

    // Departments
    const existingDept = await prisma.departmentPermission.findMany({ where: { key } });
    if (!rowsForKey.length) {
      for (const existing of existingDept) await clearDepartmentPermission(existing.roleId, key);
    } else {
      for (const [roleIdStr, value] of Object.entries(access)) {
        await setDepartmentPermission(parseInt(roleIdStr, 10), key, value);
      }
      // a department no remaining row mentions must not keep a stale explicit value from a removed/edited row
      for (const existing of existingDept) {
        if (!(String(existing.roleId) in access)) await clearDepartmentPermission(existing.roleId, key);
      }
    }

    // Specific employees (every boolean item, feature:ai / feature:error_reports included).
    const existingOverrides = await prisma.employeePermissionOverride.findMany({ where: { key } });
    const note = `${ROW_OVERRIDE_NOTE_PREFIX} "${rowsForKey.map((r) => r.name).join('", "')}"`;
    for (const existing of existingOverrides) {
      const createdByRow = (existing.note || '').startsWith(ROW_OVERRIDE_NOTE_PREFIX);
      if (createdByRow && !employeeIds.has(existing.employeeId)) await clearEmployeeOverride(existing.employeeId, key);
    }
    for (const employeeId of employeeIds) {
      const existing = existingOverrides.find((o) => o.employeeId === employeeId);
      const createdByRow = (existing?.note || '').startsWith(ROW_OVERRIDE_NOTE_PREFIX);
      // Someone already granted this on the employee's own card — leave that alone.
      if (existing && existing.value === 'true' && !createdByRow) continue;
      await setEmployeeOverride(employeeId, key, true, { note });
    }
  }
}
