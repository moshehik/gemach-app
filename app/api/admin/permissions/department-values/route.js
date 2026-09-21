import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { getCatalogItem, ALWAYS_ALLOWED_ROLE_IDS } from '@/lib/permissionsMetadata';
import { setDepartmentPermission, clearDepartmentPermission } from '@/lib/permissions';

// Department-level value of a NUMBER item (feature:export_max_rows). Yes/no items are set through
// permission rows (page-groups routes) - a number has no yes/no, so a row can't carry it, and this
// is its one department-level editor on /admin/permissions. An employee's own value is set on the
// employee card (employees/[employeeId] route); both write the ordinary permission tables.
// PUT { roleId, key, value } sets it; PUT { roleId, key, value: null } resets to the catalog default.
export async function PUT(request) {
  if (!(await checkAuth('הנהלה ראשית', { forceDb: true }))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { roleId, key, value } = await request.json();
    const item = getCatalogItem(key);
    if (!item || item.type !== 'number') {
      return NextResponse.json({ error: 'רק פריט מספרי אפשר לקבוע כאן' }, { status: 400 });
    }
    const id = parseInt(roleId, 10);
    if (Number.isNaN(id) || ALWAYS_ALLOWED_ROLE_IDS.includes(id)) {
      return NextResponse.json({ error: 'מחלקה לא תקינה' }, { status: 400 });
    }
    if (value === null) {
      await clearDepartmentPermission(id, key);
      return NextResponse.json({ success: true });
    }
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < 0) {
      return NextResponse.json({ error: 'יש להזין מספר תקין' }, { status: 400 });
    }
    await setDepartmentPermission(id, key, n);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting department numeric permission:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת הערך' }, { status: 500 });
  }
}
