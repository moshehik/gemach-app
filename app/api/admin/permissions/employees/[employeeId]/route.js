import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { PERMISSION_CATALOG, getCatalogItem, ALWAYS_ALLOWED_ROLE_IDS } from '@/lib/permissionsMetadata';
import { setEmployeeOverride, clearEmployeeOverride, getDepartmentEffectiveValue } from '@/lib/permissions';
import { parseJson, ROW_OVERRIDE_NOTE_PREFIX } from '@/lib/permissionPageGroups';

// The employee card's "הרשאות ספציפיות" panel and /admin/permissions read and write the SAME
// data, and this route is the card's side of it. Ownership rules that keep the two in step:
//   - a page/feature the employee is listed on in a PermissionPageGroup row (the central window)
//     is owned by that row: the card shows it read-only, and PUT/DELETE here refuse to touch it
//     (otherwise the card and the row would disagree about the same person);
//   - anything else is a personal exception owned by the card - it is listed back on
//     /admin/permissions under "חריגות אישיות";
//   - items the central window does not offer (item.notConfigurable) and the always-allowed
//     roles (head management / programmer) have no controls on either surface.
// Same gate as the card's page (הנהלה ראשית, see app/employees/layout.js).

// Rows (from the central window) that contain `key`, annotated for this employee.
function rowsForKey(rows, key, employee) {
  return rows
    .filter((row) => parseJson(row.keys, []).includes(key))
    .map((row) => ({
      id: row.id,
      name: row.name,
      itemCount: parseJson(row.keys, []).length,
      employeeListed: parseJson(row.employeeIds, []).includes(employee.id),
      departmentAllowed: employee.roleId !== null && employee.roleId !== undefined && !!parseJson(row.access, {})[employee.roleId],
    }));
}

const isAlwaysAllowed = (employee, item) =>
  item.type === 'boolean' && ALWAYS_ALLOWED_ROLE_IDS.includes(employee.roleId);

export async function GET(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית', { forceDb: true }))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { employeeId } = await params;
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ error: 'עובד לא נמצא' }, { status: 404 });
    }
    const [overrides, groupRows] = await Promise.all([
      prisma.employeePermissionOverride.findMany({ where: { employeeId } }),
      prisma.permissionPageGroup.findMany({ orderBy: { order: 'asc' } }),
    ]);
    const overrideByKey = new Map(overrides.map((o) => [o.key, o]));

    const items = await Promise.all(PERMISSION_CATALOG.map(async (item) => {
      const departmentDefault = await getDepartmentEffectiveValue(employee.roleId, item.key);
      const rows = rowsForKey(groupRows, item.key, employee);
      const base = {
        key: item.key,
        departmentDefault,
        rows,
        locked: !!item.notConfigurable,
        alwaysAllowed: isAlwaysAllowed(employee, item),
      };
      const row = overrideByKey.get(item.key);
      const overrideValue = row ? (item.type === 'boolean' ? row.value === 'true' : parseInt(row.value, 10)) : null;
      return {
        ...base,
        override: row ? { value: overrideValue, note: row.note, updatedAt: row.updatedAt, fromRow: (row.note || '').startsWith(ROW_OVERRIDE_NOTE_PREFIX) } : null,
        effective: base.alwaysAllowed ? true : (row ? overrideValue : departmentDefault),
      };
    }));

    return NextResponse.json({ employeeId, roleId: employee.roleId, items });
  } catch (error) {
    console.error('Error loading employee permissions:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת הרשאות העובד' }, { status: 500 });
  }
}

// Returns an error response if a card-side write on `key` would fight the central window, else null.
async function refuseIfOwnedElsewhere(employee, item, { forWrite }) {
  if (forWrite && item.notConfigurable) {
    return NextResponse.json({ error: 'פריט זה נעול ואינו ניתן להגדרה לעובד ספציפי' }, { status: 400 });
  }
  if (forWrite && isAlwaysAllowed(employee, item)) {
    return NextResponse.json({ error: 'הנהלה ראשית ומתכנת תמיד מורשים, אין מה להגדיר להם' }, { status: 400 });
  }
  const groupRows = await prisma.permissionPageGroup.findMany();
  const listedIn = rowsForKey(groupRows, item.key, employee).filter((r) => r.employeeListed);
  if (listedIn.length) {
    return NextResponse.json({
      error: `העובד מופיע בשורת ההרשאה "${listedIn.map((r) => r.name).join('", "')}" במסך ההרשאות. את ההרשאה הזו משנים שם, כדי שהכרטיס והמסך המרכזי לא יסתרו זה את זה`,
    }, { status: 409 });
  }
  return null;
}

export async function PUT(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית', { forceDb: true }))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { employeeId } = await params;
    const { key, value } = await request.json();
    const item = getCatalogItem(key);
    if (!item) {
      return NextResponse.json({ error: 'מפתח הרשאה לא מוכר' }, { status: 400 });
    }
    // same strictness as the department editor: a real boolean / a whole non-negative number
    if (item.type === 'boolean' && typeof value !== 'boolean') {
      return NextResponse.json({ error: 'הערך חייב להיות מותר או חסום' }, { status: 400 });
    }
    if (item.type === 'number' && !(Number.isInteger(value) || (typeof value === 'string' && /^\d+$/.test(value.trim())))) {
      return NextResponse.json({ error: 'יש להזין מספר שלם תקין' }, { status: 400 });
    }
    if (item.type === 'number' && parseInt(value, 10) < 0) {
      return NextResponse.json({ error: 'יש להזין מספר שלם תקין' }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, roleId: true } });
    if (!employee) {
      return NextResponse.json({ error: 'עובד לא נמצא' }, { status: 404 });
    }
    const refusal = await refuseIfOwnedElsewhere(employee, item, { forWrite: true });
    if (refusal) return refusal;
    // no free-text note from the client: a note starting with the row prefix would make a personal
    // override look row-owned (hidden from /admin/permissions and deleted by the next row sync)
    await setEmployeeOverride(employeeId, key, item.type === 'boolean' ? value : parseInt(value, 10));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting employee permission override:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת ההרשאה הפרטנית' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית', { forceDb: true }))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { employeeId } = await params;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const item = getCatalogItem(key);
    if (!item) {
      return NextResponse.json({ error: 'מפתח הרשאה לא מוכר' }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, roleId: true } });
    if (!employee) {
      return NextResponse.json({ error: 'עובד לא נמצא' }, { status: 404 });
    }
    // Resetting is always allowed for locked / always-allowed items (it only cleans a stale
    // override), but never for a grant the central window owns.
    const refusal = await refuseIfOwnedElsewhere(employee, item, { forWrite: false });
    if (refusal) return refusal;
    await clearEmployeeOverride(employeeId, key);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing employee permission override:', error);
    return NextResponse.json({ error: 'שגיאה בהסרת ההרשאה הפרטנית' }, { status: 500 });
  }
}
