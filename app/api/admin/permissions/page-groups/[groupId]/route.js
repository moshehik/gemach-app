import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { releaseKeysFromOtherGroups, validatePageKeys, applyAccessToKeys } from '@/lib/permissionPageGroups';

// PUT { name?, keys?, access? } — updates a row's display name, its attached pages
// (full replacement array), and/or pushes an access level to every one of its pages
// at once. `keys`/`access` are independent: renaming doesn't require resending keys.
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

    const { name, keys, access } = await request.json();
    const data = {};
    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: 'יש להזין שם לשורה' }, { status: 400 });
      data.name = name.trim();
    }
    let effectiveKeys = JSON.parse(existing.keys || '[]');
    if (keys !== undefined) {
      if (!validatePageKeys(keys)) {
        return NextResponse.json({ error: 'רשימת עמודים לא תקינה' }, { status: 400 });
      }
      effectiveKeys = keys;
      data.keys = JSON.stringify(keys);
    }

    if (Object.keys(data).length) {
      await prisma.permissionPageGroup.update({ where: { id: groupId }, data });
    }
    if (keys !== undefined && keys.length) await releaseKeysFromOtherGroups(keys, groupId);
    if (access) await applyAccessToKeys(effectiveKeys, access);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating permission page group:', error);
    return NextResponse.json({ error: 'שגיאה בעדכון השורה' }, { status: 500 });
  }
}

// DELETE — disbands the row. Its pages keep whatever DepartmentPermission values
// they already have and simply reappear as their own single-page rows.
export async function DELETE(request, { params }) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { groupId } = await params;
    await prisma.permissionPageGroup.delete({ where: { id: groupId } }).catch(() => null);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting permission page group:', error);
    return NextResponse.json({ error: 'שגיאה בפירוק השורה' }, { status: 500 });
  }
}
