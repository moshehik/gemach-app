import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { releaseKeysFromOtherGroups, validatePageKeys, applyAccessToKeys } from '@/lib/permissionPageGroups';

// POST { name, keys?, access? } — creates a new page-group row. `keys` (default [])
// lets the caller seed it straight from an existing single-page ("auto") row being
// promoted into a named, editable group; `access` (optional) is applied to those
// keys immediately, same as a PUT — see [groupId]/route.js.
export async function POST(request) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  }
  try {
    const { name, keys = [], access } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'יש להזין שם לשורה' }, { status: 400 });
    }
    if (!validatePageKeys(keys)) {
      return NextResponse.json({ error: 'רשימת עמודים לא תקינה' }, { status: 400 });
    }

    const maxOrder = await prisma.permissionPageGroup.aggregate({ _max: { order: true } });
    const created = await prisma.permissionPageGroup.create({
      data: { name: name.trim(), keys: JSON.stringify(keys), order: (maxOrder._max.order ?? -1) + 1 },
    });

    if (keys.length) await releaseKeysFromOtherGroups(keys, created.id);
    if (access) await applyAccessToKeys(keys, access);

    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    console.error('Error creating permission page group:', error);
    return NextResponse.json({ error: 'שגיאה ביצירת השורה' }, { status: 500 });
  }
}
