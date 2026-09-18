import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { releaseKeysFromOtherGroups, validatePageKeys, applyAccessToKeys, applyAccessToEmployees } from '@/lib/permissionPageGroups';
import { getCatalogItem } from '@/lib/permissionsMetadata';

// PUT { name?, keys?, access?, employeeIds? } — updates a row's display name, its
// attached pages (full replacement array), and/or pushes an access level (department
// and/or specific-employee) to every one of its pages at once. `keys`/`access`/
// `employeeIds` are independent: renaming doesn't require resending any of them.
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
    const priorKeys = JSON.parse(existing.keys || '[]');
    let effectiveKeys = priorKeys;
    if (keys !== undefined) {
      if (!validatePageKeys(keys, existing.catalogGroup)) {
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
    if (employeeIds !== undefined) {
      const previousEmployeeIds = priorKeys.length
        ? (await prisma.employeePermissionOverride.findMany({ where: { key: priorKeys[0], value: 'true' }, select: { employeeId: true } })).map((o) => o.employeeId)
        : [];
      await applyAccessToEmployees(effectiveKeys, employeeIds, previousEmployeeIds, data.name || existing.name);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating permission page group:', error);
    return NextResponse.json({ error: 'שגיאה בעדכון השורה' }, { status: 500 });
  }
}

// DELETE — disbands the row. Its keys keep whatever DepartmentPermission values
// they already have; since there's no more implicit/auto row, each one is recreated
// here as its own real single-key row (named after the catalog item) so nothing
// simply vanishes from the table.
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
    const keys = JSON.parse(existing.keys || '[]');

    await prisma.$transaction(async (tx) => {
      await tx.permissionPageGroup.delete({ where: { id: groupId } });
      if (!keys.length) return;
      const maxOrder = await tx.permissionPageGroup.aggregate({ _max: { order: true }, where: { catalogGroup: existing.catalogGroup } });
      let nextOrder = (maxOrder._max.order ?? -1) + 1;
      for (const key of keys) {
        const item = getCatalogItem(key);
        if (!item) continue;
        await tx.permissionPageGroup.create({
          data: { name: item.label, catalogGroup: existing.catalogGroup, keys: JSON.stringify([key]), order: nextOrder++ },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting permission page group:', error);
    return NextResponse.json({ error: 'שגיאה בפירוק השורה' }, { status: 500 });
  }
}
