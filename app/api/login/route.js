import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { employeeId, password } = await request.json();

    if (!employeeId || !password) {
      return NextResponse.json({ success: false, message: 'נא להזין קוד עובד וסיסמה' }, { status: 400 });
    }

    const parsedLegacyId = parseInt(employeeId, 10);
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          ...(isNaN(parsedLegacyId) ? [] : [{ legacyId: parsedLegacyId }]),
          { id: employeeId }
        ]
      }
    });

    if (!employee) {
      return NextResponse.json({ success: false, message: 'עובד לא נמצא' }, { status: 404 });
    }

    if (!employee.password) {
      return NextResponse.json({ success: false, message: 'לעובד זה טרם הוגדרה סיסמה במערכת. אנא פנה למנהל.' }, { status: 401 });
    }

    if (employee.password !== password) {
      return NextResponse.json({ success: false, message: 'סיסמא שגויה' }, { status: 401 });
    }

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'auth_token',
      value: employee.id, // Ensure we store the UUID string
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
