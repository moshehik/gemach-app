import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { PERMISSION_CATALOG, getCatalogItem, defaultValueForRoleId } from '@/lib/permissionsMetadata';

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
      .filter((d) => d.roleId !== 2);
    const rows = await prisma.departmentPermission.findMany();
    const rowByRoleAndKey = new Map(rows.map((r) => [`${r.roleId}:${r.key}`, r.value]));

    const departmentValues = departments.map((department) => {
      const values = {};
      for (const item of PERMISSION_CATALOG) {
        const raw = rowByRoleAndKey.get(`${department.roleId}:${item.key}`);
        values[item.key] = {
          value: raw !== undefined
            ? (item.type === 'boolean' ? raw === 'true' : parseInt(raw, 10))
            : defaultValueForRoleId(item, department.roleId),
          isExplicit: raw !== undefined,
        };
      }
      return { roleId: department.roleId, name: department.name, values };
    });

    const pageGroups = await buildPermissionGroups(departmentValues, 'pages');
    const featureGroups = await buildPermissionGroups(departmentValues, 'features');

    return NextResponse.json({ departments: departmentValues, pageGroups, featureGroups });
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
export async function buildPermissionGroups(departmentValues, catalogGroup) {
  const rows = await prisma.permissionPageGroup.findMany({ where: { catalogGroup }, orderBy: { order: 'asc' } });

  const accessFor = (keys) => {
    const access = {};
    for (const dept of departmentValues) {
      access[dept.roleId] = keys.length ? !!dept.values[keys[0]]?.value : false;
    }
    return access;
  };

  // Same "read keys[0], apply to the whole row" convention as accessFor above — a
  // row's employee-level access is represented by whoever has an explicit override
  // on its first key (applyAccessToEmployees in lib/permissionPageGroups.js keeps
  // every key in the row in sync with that on save).
  const employeeAccessFor = async (keys) => {
    if (!keys.length) return [];
    const overrides = await prisma.employeePermissionOverride.findMany({
      where: { key: keys[0], value: 'true' },
      select: { employeeId: true },
    });
    return overrides.map((o) => o.employeeId);
  };

  return Promise.all(rows.map(async (row) => {
    const keys = JSON.parse(row.keys || '[]').filter((k) => getCatalogItem(k)?.group === catalogGroup);
    return { id: row.id, name: row.name, keys, access: accessFor(keys), employeeAccess: await employeeAccessFor(keys) };
  }));
}
