import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { PERMISSION_CATALOG, getCatalogGroup, getCatalogItem, defaultValueForRoleId } from '@/lib/permissionsMetadata';

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

    const pageGroups = await buildPageGroups(departmentValues);

    return NextResponse.json({ departments: departmentValues, pageGroups });
  } catch (error) {
    console.error('Error loading permissions matrix:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת מטריצת ההרשאות' }, { status: 500 });
  }
}

// Merges the admin-defined PermissionPageGroup rows with an implicit single-page row
// for every 'pages' catalog key nobody has grouped yet, so the pages table always
// covers every page with no gaps. See prisma/schema.prisma's PermissionPageGroup doc
// comment and app/api/admin/permissions/page-groups/route.js for the write side.
export async function buildPageGroups(departmentValues) {
  const pageCatalog = getCatalogGroup('pages');
  const rows = await prisma.permissionPageGroup.findMany({ orderBy: { order: 'asc' } });

  const accessFor = (keys) => {
    const access = {};
    for (const dept of departmentValues) {
      access[dept.roleId] = keys.length ? !!dept.values[keys[0]]?.value : false;
    }
    return access;
  };

  const groupedKeys = new Set();
  const pageGroups = rows.map((row) => {
    const keys = JSON.parse(row.keys || '[]').filter((k) => getCatalogItem(k)?.group === 'pages');
    keys.forEach((k) => groupedKeys.add(k));
    return { id: row.id, name: row.name, keys, access: accessFor(keys), isAuto: false };
  });

  for (const item of pageCatalog) {
    if (groupedKeys.has(item.key)) continue;
    pageGroups.push({
      id: `auto:${item.key}`,
      name: item.label,
      description: item.description,
      keys: [item.key],
      access: accessFor([item.key]),
      isAuto: true,
    });
  }

  return pageGroups;
}
