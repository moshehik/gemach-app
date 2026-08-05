import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { hashSecret, verifySecret, last4Of, generateTempPassword } from '@/lib/passwordAuth';
import { sendSystemEmail } from '@/lib/mailer';

// Manager-only replacement for the old "הצג סיסמה" (show password) feature: instead of
// revealing an employee's existing password, a manager triggers a reset - a random
// temporary password is generated, hashed in place of the old one, and emailed to the
// employee's address on file. The employee is then required to set a real password on
// next login (Employee.mustResetPassword). This shares its core logic with the
// self-service forgot-password flow at app/api/auth/forgot-password/route.js.
//
// Authorization mirrors the app's existing customAuthPrompt/verify-pin pattern (see
// app/api/auth/verify-pin/route.js and app/employees/[id]/page.js) rather than requiring
// the browser's OWN logged-in session to be a manager: on these shared front-desk
// computers, a non-manager employee is often the one signed in, and a manager standing
// nearby authorizes a sensitive action by typing their own code into a modal without
// switching sessions. So the manager identity/PIN in the request body IS the real
// authorization check here, verified fresh server-side (bcrypt) - not merely trusting
// that the client already called verify-pin.
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

    const { authEmployeeId, authPin } = await request.json();
    if (!authEmployeeId || !authPin) {
      return NextResponse.json({ success: false, message: 'נדרש אימות מנהל' }, { status: 401 });
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
    if (!employee.email) {
      return NextResponse.json({ success: false, message: 'לא קיימת כתובת מייל שמורה עבור עובד זה. יש לעדכן כתובת מייל תחילה.' }, { status: 400 });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashSecret(tempPassword);
    const pinHash = await hashSecret(last4Of(tempPassword));

    await prisma.employee.update({
      where: { id },
      data: {
        password: hashedPassword,
        pinHash,
        mustResetPassword: true
      }
    });

    const emailResult = await sendSystemEmail({
      to: employee.email,
      subject: 'איפוס סיסמה - מערכת הגמ"ח',
      body: `שלום ${employee.firstName || ''},\n\nסיסמתך למערכת הגמ"ח אופסה על ידי מנהל.\nסיסמה זמנית: ${tempPassword}\n\nיש להתחבר עם הסיסמה הזמנית ולהגדיר סיסמה חדשה בהתחברות הבאה.\nאם לא ביקשת איפוס סיסמה, יש לפנות למנהל המערכת.`,
      employeeId: authEmployee.id
    });

    if (!emailResult.success) {
      return NextResponse.json({ success: false, message: 'הסיסמה אופסה אך שליחת המייל נכשלה: ' + (emailResult.message || '') }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: `סיסמה זמנית נשלחה לכתובת ${employee.email}` });
  } catch (error) {
    console.error('Error resetting employee password:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
