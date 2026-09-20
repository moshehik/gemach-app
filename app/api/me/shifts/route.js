import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { getVerifiedAuthCookie } from '@/lib/authTokens';

// עובד רגיל רואה כאן רק את המשמרות שלו-עצמו (תאריך/כניסה/יציאה/סה"כ דקות) - בלי
// שכר/תפקיד/עובדים אחרים, בדיוק כמו ההפרדה הקיימת ב-/api/me מול /api/employees/[id].
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = getVerifiedAuthCookie(cookieStore);
    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const employeeId = token.value;
    const parsedLegacyId = parseInt(employeeId, 10);
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: employeeId },
          ...(isNaN(parsedLegacyId) ? [] : [{ legacyId: parsedLegacyId }])
        ]
      },
      select: { id: true }
    });

    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 401 });
    }

    const shifts = await prisma.shift.findMany({
      where: { employeeId: employee.id, isDeleted: false },
      select: { id: true, date: true, hebrewDate: true, entryTime: true, exitTime: true, totalMinutes: true },
      orderBy: [{ date: 'asc' }, { entryTime: 'asc' }]
    });

    return NextResponse.json({ success: true, shifts });
  } catch (error) {
    console.error('Error in /api/me/shifts:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
