import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { PERMISSION_CATALOG, getCatalogItem, defaultValueForRoleId, ALWAYS_ALLOWED_ROLE_IDS } from '@/lib/permissionsMetadata';
import { parseJson, ROW_OVERRIDE_NOTE_PREFIX } from '@/lib/permissionPageGroups';
import { getCachedSetting } from '@/lib/settingsCache';

// Full permissions matrix: every department's effective value for every catalog key
// (lib/permissionsMetadata.js). Powers /admin/permissions — see CLAUDE.md's
// "Permissions system" section for what this page is and why it exists. The catalog
// itself (labels/descriptions/etc.) is a static shared module the client imports
// directly — this response is only the per-department values, keyed by roleId.
export async function GET() {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    // roleId 2 (מתכנת) תמיד מאושר לכל דבר בקוד הקיים (HEAD_MANAGEMENT_ROLES/DEVELOPER_ONLY_ROLES
    // ב-lib/auth.js) - עמודה עבורו במטריצה הזו הייתה רק מטעה, אין ערך שאפשר לשנות בפועל.
    const departments = (await prisma.department.findMany({ orderBy: { roleId: 'asc' } }))
      .filter((d) => !ALWAYS_ALLOWED_ROLE_IDS.includes(d.roleId));
    const rows = await prisma.departmentPermission.findMany();
    // org-level toggles some page defaults follow (refunds / dress catalog / monthly board)
    const orgSettings = {};
    for (const item of PERMISSION_CATALOG) {
      for (const k of item.settingKeys || []) {
        if (!(k in orgSettings)) orgSettings[k] = (await getCachedSetting(k).catch(() => null))?.value;
      }
    }
    const rowByRoleAndKey = new Map(rows.map((r) => [`${r.roleId}:${r.key}`, r.value]));

    const departmentValues = departments.map((department) => {
      const values = {};
      for (const item of PERMISSION_CATALOG) {
        const raw = rowByRoleAndKey.get(`${department.roleId}:${item.key}`);
        values[item.key] = {
          value: raw !== undefined
            ? (item.type === 'boolean' ? raw === 'true' : parseInt(raw, 10))
            : defaultValueForRoleId(item, department.roleId, orgSettings),
          isExplicit: raw !== undefined,
        };
      }
      return { roleId: department.roleId, name: department.name, values };
    });

    const groups = await buildPermissionGroups(departmentValues);
    const personalOverrides = await buildPersonalOverrides(departmentValues);

    return NextResponse.json({ departments: departmentValues, groups, orgSettings, personalOverrides });
  } catch (error) {
    console.error('Error loading permissions matrix:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת מטריצת ההרשאות' }, { status: 500 });
  }
}

// Loads the admin-defined PermissionPageGroup rows for one catalog group ('pages' or
// 'features'). Unlike the first version of this table, a catalog key with no row is
// simply not returned — see prisma/schema.prisma's PermissionPageGroup doc comment —
// so /admin/permissions only ever shows rows an admin actually created. See
// app/api/admin/permissions/page-groups/route.js for the write side.
export async function buildPermissionGroups(departmentValues) {
  const rows = await prisma.permissionPageGroup.findMany({ orderBy: { order: 'asc' } });

  // Each row carries its OWN access (`access` / `employeeIds` columns) — not derived
  // from the shared per-key DepartmentPermission values, which are the union of every
  // row containing a key (see lib/permissionPageGroups.js syncKeys). That's what lets
  // one page sit in two rows with different access.
  return rows.map((row) => {
    const keys = parseJson(row.keys, []).filter((k) => !!getCatalogItem(k));
    const storedAccess = parseJson(row.access, {});
    const access = {};
    for (const dept of departmentValues) access[dept.roleId] = !!storedAccess[dept.roleId];
    return { id: row.id, name: row.name, keys, access, employeeAccess: parseJson(row.employeeIds, []) };
  });
}

// Personal exceptions set from an employee's own card ("הרשאות ספציפיות"), listed back here so the
// two surfaces show the same picture. Two sources:
//   - EmployeePermissionOverride rows NOT created by a permission row (those are already visible in
//     the table above, as the employee tags of the row that granted them);
//   - the legacy card checkboxes Employee.showAi / Employee.canReportErrors (feature:ai /
//     feature:error_reports), which have no override row - listed only when they actually add
//     something, i.e. the employee's department does not already allow it.
// Always-allowed roles are skipped: nothing can be added or taken from them.
export async function buildPersonalOverrides(departmentValues) {
  const [overrides, flagged] = await Promise.all([
    prisma.employeePermissionOverride.findMany(),
    prisma.employee.findMany({
      where: { OR: [{ showAi: true }, { canReportErrors: true }] },
      select: { id: true, roleId: true, showAi: true, canReportErrors: true },
    }),
  ]);
  const own = overrides.filter((o) => !(o.note || '').startsWith(ROW_OVERRIDE_NOTE_PREFIX) && getCatalogItem(o.key));

  const list = own.map((o) => {
    const item = getCatalogItem(o.key);
    return { employeeId: o.employeeId, key: o.key, value: item.type === 'boolean' ? o.value === 'true' : parseInt(o.value, 10), note: o.note || null, legacy: false };
  });
  for (const emp of flagged) {
    const dept = departmentValues.find((d) => d.roleId === emp.roleId);
    for (const item of PERMISSION_CATALOG) {
      if (item.legacyEmployeeField && emp[item.legacyEmployeeField] && !dept?.values[item.key]?.value) {
        list.push({ employeeId: emp.id, key: item.key, value: true, note: null, legacy: true });
      }
    }
  }

  const ids = [...new Set(list.map((entry) => entry.employeeId))];
  const employees = ids.length
    ? await prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, roleId: true, isActive: true } })
    : [];
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  return list
    .map((entry) => ({ ...entry, employee: employeeById.get(entry.employeeId) || null }))
    // roleId 0/2 are always allowed, and a deleted employee's leftover row means nothing
    .filter((entry) => entry.employee && !ALWAYS_ALLOWED_ROLE_IDS.includes(entry.employee.roleId));
}
