import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { verifySecret } from '@/lib/passwordAuth';
import { getTrustedDeviceFromCookieStore, markDeviceUsed } from '@/lib/trustedDevice';
import { issueSessionCookie } from '@/lib/auth';

export async function POST(request) {
  try {
    const { employeeId, password, pin } = await request.json();

    if (!employeeId || (!password && !pin)) {
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

    if (!employee.isActive) {
      return NextResponse.json({ success: false, message: 'חשבון העובד אינו פעיל' }, { status: 403 });
    }

    const cookieStore = await cookies();

    if (pin) {
      // Fast path: only ever valid on a computer a manager has explicitly marked trusted.
      // The trust check happens first and is independent of anything the client claims -
      // a request that merely *says* "this is a trusted device" without holding the actual
      // cookie is rejected before the PIN is even looked at.
      const trustedDevice = await getTrustedDeviceFromCookieStore(cookieStore);
      if (!trustedDevice) {
        return NextResponse.json({ success: false, message: 'מחשב זה אינו מוגדר כמערכת מהימנה - יש להזין את הסיסמה המלאה', requireFullPassword: true }, { status: 401 });
      }
      if (!employee.pinHash) {
        return NextResponse.json({ success: false, message: 'לעובד זה טרם הוגדר קוד כניסה מקוצר. יש להזין את הסיסמה המלאה', requireFullPassword: true }, { status: 401 });
      }
      const pinOk = await verifySecret(pin, employee.pinHash);
      if (!pinOk) {
        return NextResponse.json({ success: false, message: 'קוד שגוי' }, { status: 401 });
      }
      markDeviceUsed(trustedDevice.id);
    } else {
      if (!employee.password) {
        return NextResponse.json({ success: false, message: 'לעובד זה טרם הוגדרה סיסמה במערכת. אנא פנה למנהל.' }, { status: 401 });
      }
      const passwordOk = await verifySecret(password, employee.password);
      if (!passwordOk) {
        return NextResponse.json({ success: false, message: 'סיסמא שגויה' }, { status: 401 });
      }
    }

    // Set cookie
    cookieStore.set({
      name: 'auth_token',
      value: employee.id, // Ensure we store the UUID string
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    // Signed session cookie (auth_session) — DB-free role verification fast
    // path for checkAuth/checkPageAccess/RootLayout. Best-effort: if
    // AUTH_SECRET isn't configured (or signing fails) the login still
    // succeeds and everything falls back to the legacy auth_token-only path.
    try {
      issueSessionCookie(cookieStore, employee);
    } catch (e) {
      console.warn('issueSessionCookie failed (continuing with legacy auth only):', e?.message || e);
    }

    return NextResponse.json({ success: true, mustResetPassword: !!employee.mustResetPassword });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
