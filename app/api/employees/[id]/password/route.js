import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAuth } from '@/lib/auth';
import { hashSecret, verifySecret, last4Of } from '@/lib/passwordAuth';

// Self-service "change my password": requires knowing the CURRENT password (verified
// server-side via bcrypt) and replaces it with a new one, re-deriving the trusted-device
// PIN hash from the new password's last 4 characters. This is deliberately different from
// the manager-triggered reset-password endpoint, which doesn't need the old password.
export async function POST(request, { params }) {
  if (!(await checkAuth())) {
    return NextResponse.json({ success: false, message: 'יש להתחבר למערכת' }, { status: 401 });
  }
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    if (!id) {
      return NextResponse.json({ success: false, message: 'מזהה עובד לא תקין' }, { status: 400 });
    }

    const { oldPassword, newPassword } = await request.json();
    if (!newPassword) {
      return NextResponse.json({ success: false, message: 'יש להזין סיסמה חדשה' }, { status: 400 });
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ success: false, message: 'הסיסמה החדשה קצרה מדי' }, { status: 400 });
    }

    // Only the employee themselves may change their own password this way - anyone else
    // (a manager helping a locked-out employee) uses the reset-password endpoint instead,
    // which emails a fresh temporary password rather than requiring the old one.
    const cookieStore = await cookies();
    const sessionEmployeeId = cookieStore.get('auth_token')?.value;
    if (sessionEmployeeId !== id) {
      return NextResponse.json({ success: false, message: 'ניתן לשנות רק את הסיסמה של המשתמש המחובר' }, { status: 403 });
    }

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return NextResponse.json({ success: false, message: 'עובד לא נמצא' }, { status: 404 });
    }

    // Right after a forgot-password/reset temp password is issued, mustResetPassword is
    // true and the employee is forced to set a real password before doing anything else.
    // They just proved knowledge of the temp credential to establish THIS session (either
    // the full temp password, or its last 4 characters on a trusted device), so re-asking for
    // the old password a second time here is skipped in that one case. Any other password
    // change (the normal self-service flow) still requires it.
    const skipOldPasswordCheck = employee.mustResetPassword && !oldPassword;
    if (!skipOldPasswordCheck) {
      if (!oldPassword) {
        return NextResponse.json({ success: false, message: 'יש להזין סיסמה ישנה' }, { status: 400 });
      }
      const oldOk = await verifySecret(oldPassword, employee.password);
      if (!oldOk) {
        return NextResponse.json({ success: false, message: 'הסיסמה הישנה אינה נכונה' }, { status: 401 });
      }
    }

    const hashedPassword = await hashSecret(newPassword);
    const pinHash = await hashSecret(last4Of(newPassword));

    await prisma.employee.update({
      where: { id },
      data: {
        password: hashedPassword,
        pinHash,
        mustResetPassword: false
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
