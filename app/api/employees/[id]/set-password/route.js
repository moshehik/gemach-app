import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { hashSecret, verifySecret, last4Of } from '@/lib/passwordAuth';

// Manager sets a chosen password directly, no email required - for employees with no
// email on file, or no access to it during work hours (the reset-password / forgot-password
// flows both require emailing a temp password, which doesn't help in either case). The
// manager types the new password themselves and hands it to the employee on the spot; unlike
// reset-password, mustResetPassword is left false so it stays the employee's real password
// instead of forcing another change on next login.
//
// Authorization mirrors app/api/employees/[id]/reset-password/route.js: the manager
// identity/PIN in the request body is the real check, verified fresh server-side, since a
// non-manager employee is often the one actually signed in on a shared front-desk computer.
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

    const { authEmployeeId, authPin, newPassword } = await request.json();
    if (!authEmployeeId || !authPin) {
      return NextResponse.json({ success: false, message: 'נדרש אימות מנהל' }, { status: 401 });
    }
    if (!newPassword || String(newPassword).length < 4) {
      return NextResponse.json({ success: false, message: 'סיסמה חדשה חייבת להכיל לפחות 4 תווים' }, { status: 400 });
    }

    const authEmployee = await prisma.employee.findUnique({ where: { id: authEmployeeId } });
    const isManager = authEmployee && authEmployee.isActive && (authEmployee.roleId === 1 || authEmployee.roleId === 2);
    if (!isManager || !(await verifySecret(authPin, authEmployee.password))) {
      return NextResponse.json({ success: false, message: 'קוד מנהל שגוי או הרשאה לא מספקת' }, { status: 403 });
    }

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return NextResponse.json({ success: false, message: 'עובד לא נמצא' }, { status: 404 });
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

    return NextResponse.json({ success: true, message: 'הסיסמה נקבעה בהצלחה' });
  } catch (error) {
    console.error('Error setting employee password:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
