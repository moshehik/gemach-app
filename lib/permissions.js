// Resolution + mutation for the department/employee permission system — the data
// layer behind /admin/permissions and the "הרשאות ספציפיות" section on an employee's
// card. See lib/permissionsMetadata.js for the catalog and CLAUDE.md's "Permissions
// system" section for the standing rule on when new access-control decisions must be
// added here instead of a new hardcoded roleId check.
//
// Precedence for an employee's effective value of a given key:
//   1. Explicit EmployeePermissionOverride row for that employee+key (or, for a
//      legacyEmployeeField item, the existing Employee column) — always wins.
//   2. Explicit DepartmentPermission row for the employee's roleId+key.
//   3. The catalog item's defaultForRoleId(roleId) — chosen to match today's real
//      behavior, so an untouched system changes nothing.
// A legacyEmployeeField override (Employee.showAi / Employee.canReportErrors) can
// only ADD access on top of the department default, never revoke it below the
// department default — matches how those two flags already behaved before this
// system existed (see the catalog item's own note for why).
//
// Everything here keys department-level rows by roleId (int), not Department.id
// (uuid) — matches Employee's own relation to Department (Employee.roleId →
// Department.roleId) so every call site can resolve a value from a roleId it
// already has (session token, an existing `select: { roleId: true }`, Employee.roleId
// itself) without an extra join to load the Department row.
import prisma from '@/app/lib/prisma';
import { getCatalogItem, defaultValueForRoleId } from './permissionsMetadata';

function coerceValue(item, rawValue) {
  if (rawValue === undefined || rawValue === null) return undefined;
  if (item.type === 'boolean') return rawValue === true || rawValue === 'true';
  if (item.type === 'number') {
    const n = typeof rawValue === 'number' ? rawValue : parseInt(rawValue, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return rawValue;
}

function serializeValue(item, value) {
  if (item.type === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

// --- Department level (keyed by roleId) -------------------------------------

export async function getDepartmentPermissionRows(roleId) {
  if (roleId === null || roleId === undefined) return [];
  return prisma.departmentPermission.findMany({ where: { roleId } });
}

export async function getDepartmentEffectiveValue(roleId, key) {
  const item = getCatalogItem(key);
  if (!item) return undefined;
  if (roleId === null || roleId === undefined) return defaultValueForRoleId(item, null);
  // roleId 2 (מתכנת) is unconditionally allowed everything in the rest of the app
  // (HEAD_MANAGEMENT_ROLES/DEVELOPER_ONLY_ROLES in lib/auth.js) - no DepartmentPermission
  // row can restrict a programmer, on purpose, so there's nothing to look up or show as
  // an editable column for this role. Numeric items still resolve normally (a threshold
  // has no meaningful "unlimited" boolean equivalent).
  if (roleId === 2 && item.type === 'boolean') return true;
  const row = await prisma.departmentPermission.findUnique({
    where: { roleId_key: { roleId, key } },
  });
  if (row) return coerceValue(item, row.value);
  return defaultValueForRoleId(item, roleId);
}

export async function setDepartmentPermission(roleId, key, value) {
  const item = getCatalogItem(key);
  if (!item) throw new Error(`Unknown permission key: ${key}`);
  const serialized = serializeValue(item, value);
  return prisma.departmentPermission.upsert({
    where: { roleId_key: { roleId, key } },
    create: { roleId, key, value: serialized },
    update: { value: serialized },
  });
}

export async function clearDepartmentPermission(roleId, key) {
  return prisma.departmentPermission
    .delete({ where: { roleId_key: { roleId, key } } })
    .catch(() => null); // no-op if it was already at its default
}

// --- Employee level (includes department fallback) --------------------------

// `employee` must include at least { id, roleId } plus whichever
// legacyEmployeeField columns the catalog references (showAi/canReportErrors) —
// the selects already used across the app for auth/session purposes already
// include roleId, so no new query shape is needed at most call sites.
export async function getEmployeeEffectiveValue(employee, key) {
  const item = getCatalogItem(key);
  if (!item || !employee) return undefined;

  const deptDefault = await getDepartmentEffectiveValue(employee.roleId, key);

  if (item.legacyEmployeeField) {
    const legacyOn = !!employee[item.legacyEmployeeField];
    return item.type === 'boolean' ? (legacyOn || !!deptDefault) : deptDefault;
  }

  if (!employee.id) return deptDefault;
  const override = await prisma.employeePermissionOverride
    .findUnique({ where: { employeeId_key: { employeeId: employee.id, key } } })
    .catch(() => null);
  if (override) return coerceValue(item, override.value);
  return deptDefault;
}

export async function hasPermission(employee, key) {
  return !!(await getEmployeeEffectiveValue(employee, key));
}

// Employee override write — never used for legacyEmployeeField items; those are
// edited through the existing Employee column itself (employee edit form /
// app/api/employees/[id]/route.js), not through this table.
export async function setEmployeeOverride(employeeId, key, value, { note } = {}) {
  const item = getCatalogItem(key);
  if (!item) throw new Error(`Unknown permission key: ${key}`);
  if (item.legacyEmployeeField) {
    throw new Error(`"${key}" is edited via Employee.${item.legacyEmployeeField}, not an override row.`);
  }
  const serialized = serializeValue(item, value);
  return prisma.employeePermissionOverride.upsert({
    where: { employeeId_key: { employeeId, key } },
    create: { employeeId, key, value: serialized, note: note || null },
    update: { value: serialized, note: note || null },
  });
}

export async function clearEmployeeOverride(employeeId, key) {
  return prisma.employeePermissionOverride
    .delete({ where: { employeeId_key: { employeeId, key } } })
    .catch(() => null);
}

export async function getEmployeeOverrideRows(employeeId) {
  if (!employeeId) return [];
  return prisma.employeePermissionOverride.findMany({ where: { employeeId } });
}

// --- Batch helper for lists (avoids N+1 when resolving one key across many
// already-loaded employees, e.g. the manager-approval employee picker) ------
export async function getEffectiveValueForEmployees(employees, key) {
  const item = getCatalogItem(key);
  if (!item) return new Map();

  const roleIds = [...new Set(employees.map((e) => e.roleId).filter((r) => r !== null && r !== undefined))];
  const employeeIds = employees.map((e) => e.id);

  const [deptRows, overrideRows] = await Promise.all([
    roleIds.length
      ? prisma.departmentPermission.findMany({ where: { roleId: { in: roleIds }, key } })
      : [],
    item.legacyEmployeeField
      ? []
      : prisma.employeePermissionOverride.findMany({ where: { employeeId: { in: employeeIds }, key } }),
  ]);
  const deptRowByRoleId = new Map(deptRows.map((r) => [r.roleId, r]));
  const overrideByEmployee = new Map(overrideRows.map((r) => [r.employeeId, r]));

  const result = new Map();
  for (const employee of employees) {
    const deptRow = employee.roleId !== null && employee.roleId !== undefined ? deptRowByRoleId.get(employee.roleId) : null;
    const deptDefault = deptRow ? coerceValue(item, deptRow.value) : defaultValueForRoleId(item, employee.roleId);

    let effective = deptDefault;
    if (item.legacyEmployeeField) {
      const legacyOn = !!employee[item.legacyEmployeeField];
      effective = item.type === 'boolean' ? (legacyOn || !!deptDefault) : deptDefault;
    } else {
      const override = overrideByEmployee.get(employee.id);
      if (override) effective = coerceValue(item, override.value);
    }
    result.set(employee.id, effective);
  }
  return result;
}
