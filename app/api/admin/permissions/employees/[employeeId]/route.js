import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { PERMISSION_CATALOG, getCatalogItem } from '@/lib/permissionsMetadata';
import { setEmployeeOverride, clearEmployeeOverride, getDepartmentEffectiveValue } from '@/lib/permissions';

// One employee's full permissions picture: per catalog key, the department default,
// any explicit override, and the resulting effective value. Used both by the employee
// override picker on /admin/permissions and by the "הרשאות ספציפיות" section on the
// employee's own card (app/employees/[id]/page.js) — same gate as that page
// (הנהלה ראשית, see app/employees/layout.js).
export async function GET(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { employeeId } = await params;
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ error: 'עובד לא נמצא' }, { status: 404 });
    }
    const overrides = await prisma.employeePermissionOverride.findMany({ where: { employeeId } });
    const overrideByKey = new Map(overrides.map((o) => [o.key, o]));

    const items = await Promise.all(PERMISSION_CATALOG.map(async (item) => {
      const departmentDefault = await getDepartmentEffectiveValue(employee.roleId, item.key);
      if (item.legacyEmployeeField) {
        const legacyOn = !!employee[item.legacyEmployeeField];
        return {
          key: item.key,
          departmentDefault,
          override: null,
          effective: item.type === 'boolean' ? (legacyOn || !!departmentDefault) : departmentDefault,
          legacyEmployeeField: item.legacyEmployeeField,
        };
      }
      const row = overrideByKey.get(item.key);
      const overrideValue = row ? (item.type === 'boolean' ? row.value === 'true' : parseInt(row.value, 10)) : null;
      return {
        key: item.key,
        departmentDefault,
        override: row ? { value: overrideValue, note: row.note, updatedAt: row.updatedAt } : null,
        effective: row ? overrideValue : departmentDefault,
        legacyEmployeeField: null,
      };
    }));

    return NextResponse.json({ employeeId, roleId: employee.roleId, items });
  } catch (error) {
    console.error('Error loading employee permissions:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת הרשאות העובד' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { employeeId } = await params;
    const { key, value, note } = await request.json();
    const item = getCatalogItem(key);
    if (!item) {
      return NextResponse.json({ error: 'מפתח הרשאה לא מוכר' }, { status: 400 });
    }
    if (item.legacyEmployeeField) {
      return NextResponse.json({
        error: `הרשאה זו נקבעת דרך השדה הקיים בכרטיס העובד (${item.legacyEmployeeField}), לא כאן`,
      }, { status: 400 });
    }
    if (item.type === 'number' && (value === '' || value === null || isNaN(parseInt(value, 10)))) {
      return NextResponse.json({ error: 'יש להזין ערך מספרי תקין' }, { status: 400 });
    }
    await setEmployeeOverride(employeeId, key, item.type === 'boolean' ? !!value : parseInt(value, 10), { note });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting employee permission override:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת ההרשאה הפרטנית' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { employeeId } = await params;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!getCatalogItem(key)) {
      return NextResponse.json({ error: 'מפתח הרשאה לא מוכר' }, { status: 400 });
    }
    await clearEmployeeOverride(employeeId, key);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing employee permission override:', error);
    return NextResponse.json({ error: 'שגיאה בהסרת ההרשאה הפרטנית' }, { status: 500 });
  }
}
