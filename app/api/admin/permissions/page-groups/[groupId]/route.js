import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { validatePageKeys, sanitizeAccess, sanitizeEmployeeIds, parseJson, syncKeys } from '@/lib/permissionPageGroups';

// PUT { name?, keys?, access?, employeeIds? } — updates a row's display name, its
// attached pages (full replacement array), and/or its own department / specific-employee
// access. All independent: renaming doesn't require resending any of them. Afterwards
// syncKeys re-derives the real per-key values for the row's old AND new keys (union of
// every row containing a key — see lib/permissionPageGroups.js).
export async function PUT(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { groupId } = await params;
    const existing = await prisma.permissionPageGroup.findUnique({ where: { id: groupId } });
    if (!existing) {
      return NextResponse.json({ error: 'השורה לא נמצאה' }, { status: 404 });
    }

    const { name, keys, access, employeeIds } = await request.json();
    const data = {};
    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: 'יש להזין שם לשורה' }, { status: 400 });
      data.name = name.trim();
    }
    const priorKeys = parseJson(existing.keys, []);
    let effectiveKeys = priorKeys;
    if (keys !== undefined) {
      if (!validatePageKeys(keys, existing.catalogGroup)) {
        return NextResponse.json({ error: 'רשימת עמודים לא תקינה' }, { status: 400 });
      }
      effectiveKeys = keys;
      data.keys = JSON.stringify(keys);
    }
    if (access !== undefined) data.access = JSON.stringify(sanitizeAccess(access));
    if (employeeIds !== undefined) data.employeeIds = JSON.stringify(sanitizeEmployeeIds(employeeIds));

    if (Object.keys(data).length) {
      await prisma.permissionPageGroup.update({ where: { id: groupId }, data });
    }
    await syncKeys([...priorKeys, ...effectiveKeys]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating permission page group:', error);
    return NextResponse.json({ error: 'שגיאה בעדכון השורה' }, { status: 500 });
  }
}

// DELETE — removes the row for real. Any page/feature that is not in another row
// falls back to its catalog default (its DepartmentPermission / row-created
// EmployeePermissionOverride values are cleared); one that is also in another row
// keeps that row's access.
export async function DELETE(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { groupId } = await params;
    const existing = await prisma.permissionPageGroup.findUnique({ where: { id: groupId } });
    if (!existing) {
      return NextResponse.json({ error: 'השורה לא נמצאה' }, { status: 404 });
    }
    await prisma.permissionPageGroup.delete({ where: { id: groupId } });
    await syncKeys(parseJson(existing.keys, []));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting permission page group:', error);
    return NextResponse.json({ error: 'שגיאה במחיקת השורה' }, { status: 500 });
  }
}
