import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { getAutoClockIn, setAutoClockIn } from '@/lib/autoClockPref';

// ההעדפה "רשום לי התחלת עבודה אוטומטית בכניסה" של העובד המחובר (דף הכניסה החדש, L14/Q01/Q05).
// נשמרת בהעדפות הקיימות של העובד (Employee.themeColor JSON, ר' lib/autoClockPref.js). מזוהה אך ורק
// לפי עוגיית ההתחברות - אין פרמטר id, עובד לא קורא/משנה העדפה של אחר. GET לפני כניסה = 401
// (ההעדפה אינה נחשפת לאורח; בדף הכניסה המתג משקף עותק מקומי בדפדפן בלבד).
async function sessionEmployee() {
  const cookieStore = await cookies();
  const token = getVerifiedAuthCookie(cookieStore);
  if (!token?.value) return null;
  const employee = await prisma.employee.findUnique({
    where: { id: token.value },
    select: { id: true, themeColor: true, isActive: true },
  });
  return employee && employee.isActive ? employee : null;
}

export async function GET() {
  try {
    const employee = await sessionEmployee();
    if (!employee) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ success: true, enabled: getAutoClockIn(employee), employeeId: employee.id });
  } catch (error) {
    console.error('Error reading auto-clock-in pref:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const employee = await sessionEmployee();
    if (!employee) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'enabled חייב להיות true או false' }, { status: 400 });
    }
    const enabled = await setAutoClockIn(employee, body.enabled);
    return NextResponse.json({ success: true, enabled, employeeId: employee.id });
  } catch (error) {
    console.error('Error saving auto-clock-in pref:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
