import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { PERMISSION_CATALOG, defaultValueForRoleId } from '@/lib/permissionsMetadata';

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
    const departments = await prisma.department.findMany({ orderBy: { roleId: 'asc' } });
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

    return NextResponse.json({ departments: departmentValues });
  } catch (error) {
    console.error('Error loading permissions matrix:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת מטריצת ההרשאות' }, { status: 500 });
  }
}
