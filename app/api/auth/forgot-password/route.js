import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { hashSecret, last4Of, generateTempPassword } from '@/lib/passwordAuth';
import { sendSystemEmail } from '@/lib/mailer';

// Self-service "forgot password", reachable from the login screen without being logged in.
// Generates a temporary password, hashes it in place of the real one, emails it to the
// employee's address already on file (Employee.email - never an address supplied by the
// caller), and forces a real password change on next successful login. Shares its core
// logic with the manager-triggered reset at app/api/employees/[id]/reset-password/route.js.
export async function POST(request) {
  try {
    const { employeeId } = await request.json();
    if (!employeeId) {
      return NextResponse.json({ success: false, message: 'יש לבחור עובד' }, { status: 400 });
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
    if (!employee.email) {
      return NextResponse.json({ success: false, message: 'לא קיימת כתובת מייל שמורה עבור עובד זה. יש לפנות למנהל.' }, { status: 400 });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashSecret(tempPassword);
    const pinHash = await hashSecret(last4Of(tempPassword));

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        password: hashedPassword,
        pinHash,
        mustResetPassword: true
      }
    });

    const emailResult = await sendSystemEmail({
      to: employee.email,
      subject: 'איפוס סיסמה - מערכת הגמ"ח',
      body: `שלום ${employee.firstName || ''},\n\nביקשת לאפס את סיסמתך למערכת הגמ"ח.\nסיסמה זמנית: ${tempPassword}\n\nיש להתחבר עם הסיסמה הזמנית ולהגדיר סיסמה חדשה בהתחברות הבאה.\nאם לא ביקשת איפוס סיסמה, אפשר להתעלם מהודעה זו ולפנות למנהל המערכת.`
    });

    if (!emailResult.success) {
      return NextResponse.json({ success: false, message: 'שליחת המייל נכשלה, נסה שוב או פנה למנהל' }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: `סיסמה זמנית נשלחה לכתובת המייל השמורה` });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת' }, { status: 500 });
  }
}
