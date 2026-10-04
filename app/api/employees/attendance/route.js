import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getAttendanceViewer } from '@/lib/attendance/server';
import { decideReadAccess } from '@/lib/attendance/access';
import { parsePeriod, monthQueryRange, dayKeyInMonth, israelDayKey } from '@/lib/attendance/summary';

// GET /api/employees/attendance?month=1-12&year=YYYY — נתיב תאימות לממשק הנוכחות הישן בלבד (4.10.2026, מעבר "ישן / חדש"):
// לשונית "נוכחות" הישנה ב-/employees (app/employees/LegacyEmployeesPage.js) ו"דוח נוכחות חודשי" הישן
// (app/employees/report/LegacyReportPage.js), ששוחזרו מ-git כפי שהם וקוראים לכתובת הזו.
//
// זה לא המטפל הישן (שהוסר ב-02a76630): השער הוא השער המוקשח של "סיכום נוכחות" — getAttendanceViewer() (resolveAttendanceManager:
// עובד מחובר לפי roleId, נכשל סגור בשגיאת DB / עובד לא פעיל) + decideReadAccess(scope:'month') — בדיוק כמו
// GET /api/attendance-sheet?scope=month. הטווח לפי שעון ישראל (monthQueryRange + israelDayKey) ולא לפי שעון השרת.
// התשובה מכילה רק את השדות שהממשק הישן קורא (לא כל שורת Employee כמו פעם), באותה צורה: { success, data, period }.
// קריאה בלבד: בלי כתיבה, בלי $transaction.
export const dynamic = 'force-dynamic';

const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function currentIsraelPeriod() {
  const key = israelDayKey(new Date()) || '';
  const [y, m] = key.split('-').map(Number);
  return Number.isInteger(y) && Number.isInteger(m) ? { y, m: m - 1 } : null;
}

export async function GET(request) {
  const viewer = await getAttendanceViewer();
  if (!viewer) return json({ success: false, error: 'Unauthorized' }, 401);
  const acc = decideReadAccess({ isManager: viewer.isManager, sessionEmployeeId: viewer.employeeId, scope: 'month' });
  if (!acc.ok) return json({ success: false, error: acc.error }, acc.status);

  const sp = new URL(request.url).searchParams;
  const month = sp.get('month');
  const year = sp.get('year');
  const period = month && year ? parsePeriod(year, Number(month) - 1) : currentIsraelPeriod();
  if (!period) return json({ success: false, error: 'חודש לא תקין' }, 400);

  try {
    const employees = await prisma.employee.findMany({
      select: {
        id: true, firstName: true, lastName: true, isActive: true,
        department: { select: { id: true, name: true } },
        shifts: {
          where: { isDeleted: false, date: monthQueryRange(period.y, period.m) },
          select: { id: true, date: true, entryTime: true, exitTime: true, totalMinutes: true, totalCalculated: true, hourlyWageSnapshot: true, travelExpensesSnapshot: true, notes: true },
          orderBy: [{ date: 'asc' }, { entryTime: 'asc' }],
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    const data = employees
      .map((e) => ({ ...e, shifts: e.shifts.filter((s) => dayKeyInMonth(israelDayKey(s.date) || israelDayKey(s.entryTime), period.y, period.m)) }))
      .filter((e) => e.isActive || e.shifts.length > 0);
    return json({
      success: true,
      data,
      period: { startDate: new Date(Date.UTC(period.y, period.m, 1)), endDate: new Date(Date.UTC(period.y, period.m + 1, 0, 23, 59, 59, 999)) },
    });
  } catch (error) {
    console.error('Error fetching legacy attendance report:', error);
    return json({ success: false, error: 'Failed to fetch attendance data' }, 500);
  }
}
