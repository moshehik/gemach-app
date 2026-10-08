import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { invalidateSettingsCache } from '@/lib/settingsCache';
import { DEVICE_BACKUP_EMPLOYEES_KEY, getAllowedEmployeeIds } from '@/lib/deviceBackupAccess';

// רשימת העובדים שמורשים להפעיל "מצב גיבוי במחשב הזה" (ר' lib/deviceBackupAccess.js). מתכנת בלבד, גם לקריאה וגם לכתיבה.
export const dynamic = 'force-dynamic';

const nameOf = (e) => (e.fullName || `${e.firstName || ''} ${e.lastName || ''}`).trim() || e.id;

export async function GET() {
  if (!(await checkAuth('מתכנת'))) return NextResponse.json({ error: 'Unauthorized. Developer access required.' }, { status: 401 });
  const [ids, employees] = await Promise.all([
    getAllowedEmployeeIds(),
    prisma.employee.findMany({
      where: { isActive: true, roleId: { not: 2 } }, // מתכנת מורשה תמיד - אין טעם ברשימה
      select: { id: true, firstName: true, lastName: true, fullName: true, roleId: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
  ]);
  return NextResponse.json(
    { ids, employees: employees.map((e) => ({ id: e.id, name: nameOf(e), roleId: e.roleId })) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function PUT(request) {
  if (!(await checkAuth('מתכנת'))) return NextResponse.json({ error: 'Unauthorized. Developer access required.' }, { status: 401 });
  let body = {};
  try { body = await request.json(); } catch { /* ריק = לא תקין, למטה */ }
  if (!body || !Array.isArray(body.ids) || body.ids.some((x) => typeof x !== 'string')) {
    return NextResponse.json({ error: 'ids must be an array of employee ids' }, { status: 400 });
  }
  const wanted = [...new Set(body.ids)];
  const valid = wanted.length
    ? await prisma.employee.findMany({ where: { id: { in: wanted }, isActive: true }, select: { id: true } })
    : [];
  const ids = valid.map((e) => e.id);
  const value = JSON.stringify(ids);
  await prisma.systemSetting.upsert({
    where: { key: DEVICE_BACKUP_EMPLOYEES_KEY },
    update: { value },
    create: { key: DEVICE_BACKUP_EMPLOYEES_KEY, value, name: 'עובדים שמורשים להפעיל מצב גיבוי במחשב שלהם', category: 'מסד נתונים', type: 'text' },
  });
  invalidateSettingsCache(DEVICE_BACKUP_EMPLOYEES_KEY);
  return NextResponse.json({ success: true, ids });
}
