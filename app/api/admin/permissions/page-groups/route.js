import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { releaseKeysFromOtherGroups, validatePageKeys, applyAccessToKeys, applyAccessToEmployees } from '@/lib/permissionPageGroups';

// POST { name, catalogGroup, keys?, access?, employeeIds? } — creates a new group row
// for one catalog group ('pages' | 'features'). `access` and `employeeIds` (both
// optional) are applied to those keys immediately, same as a PUT — see
// [groupId]/route.js.
export async function POST(request) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { name, catalogGroup, keys = [], access, employeeIds } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'יש להזין שם לשורה' }, { status: 400 });
    }
    if (catalogGroup !== 'pages' && catalogGroup !== 'features') {
      return NextResponse.json({ error: 'קבוצת קטלוג לא תקינה' }, { status: 400 });
    }
    if (!validatePageKeys(keys, catalogGroup)) {
      return NextResponse.json({ error: 'רשימת עמודים לא תקינה' }, { status: 400 });
    }

    const maxOrder = await prisma.permissionPageGroup.aggregate({ _max: { order: true }, where: { catalogGroup } });
    const created = await prisma.permissionPageGroup.create({
      data: { name: name.trim(), catalogGroup, keys: JSON.stringify(keys), order: (maxOrder._max.order ?? -1) + 1 },
    });

    if (keys.length) await releaseKeysFromOtherGroups(keys, created.id);
    if (access) await applyAccessToKeys(keys, access);
    if (employeeIds !== undefined) await applyAccessToEmployees(keys, employeeIds, [], name.trim());

    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    console.error('Error creating permission page group:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת השורה' }, { status: 500 });
  }
}
