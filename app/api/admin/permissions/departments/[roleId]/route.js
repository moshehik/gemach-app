import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { getCatalogItem } from '@/lib/permissionsMetadata';
import { setDepartmentPermission, clearDepartmentPermission } from '@/lib/permissions';

// PUT { key, value } — sets one department's value for one catalog key.
// DELETE ?key=... — clears the explicit row, reverting that key to its catalog default.
// [roleId] here is Department.roleId (the human-facing department number), same
// convention as the existing /api/departments/[roleId]/route.js. Both require הנהלה
// ראשית, same as the rest of /admin/permissions and /admin/departments.

export async function PUT(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { roleId: roleIdParam } = await params;
    const roleId = parseInt(roleIdParam, 10);
    if (isNaN(roleId)) {
      return NextResponse.json({ error: 'מספר מחלקה לא תקין' }, { status: 400 });
    }
    const { key, value } = await request.json();
    const item = getCatalogItem(key);
    if (!item) {
      return NextResponse.json({ error: 'מפתח הרשאה לא מוכר' }, { status: 400 });
    }
    if (item.type === 'number' && (value === '' || value === null || isNaN(parseInt(value, 10)))) {
      return NextResponse.json({ error: 'יש להזין ערך מספרי תקין' }, { status: 400 });
    }
    await setDepartmentPermission(roleId, key, item.type === 'boolean' ? !!value : parseInt(value, 10));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting department permission:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת ההרשאה' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { roleId: roleIdParam } = await params;
    const roleId = parseInt(roleIdParam, 10);
    if (isNaN(roleId)) {
      return NextResponse.json({ error: 'מספר מחלקה לא תקין' }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!getCatalogItem(key)) {
      return NextResponse.json({ error: 'מפתח הרשאה לא מוכר' }, { status: 400 });
    }
    await clearDepartmentPermission(roleId, key);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing department permission:', error);
    return NextResponse.json({ error: 'שגיאה באיפוס ההרשאה' }, { status: 500 });
  }
}
