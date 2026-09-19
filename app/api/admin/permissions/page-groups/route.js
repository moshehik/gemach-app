import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { validatePageKeys, sanitizeAccess, sanitizeEmployeeIds, syncKeys } from '@/lib/permissionPageGroups';

// POST { name, catalogGroup, keys?, access?, employeeIds? } — creates a new group row
// for one catalog group ('pages' | 'features'). The row stores its own `access` /
// `employeeIds`; the real per-key values are then re-derived (union of every row that
// contains the key) by syncKeys — see lib/permissionPageGroups.js. A key may sit in
// several rows at once.
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
      data: {
        name: name.trim(),
        catalogGroup,
        keys: JSON.stringify(keys),
        access: JSON.stringify(sanitizeAccess(access)),
        employeeIds: JSON.stringify(sanitizeEmployeeIds(employeeIds)),
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    await syncKeys(keys);

    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    console.error('Error creating permission page group:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת השורה' }, { status: 500 });
  }
}
