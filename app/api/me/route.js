import { withCpuTiming } from '@/lib/cpuTiming';
import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { cookies } from 'next/headers';
import { getEmployeeEffectiveValue } from '@/lib/permissions';
import { getVerifiedAuthCookie } from '@/lib/authTokens';
import { findLatestOpenShift } from '@/lib/openShift';

async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = getVerifiedAuthCookie(cookieStore);

    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const employeeId = token.value;
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const parsedLegacyId = /^\d+$/.test(String(employeeId)) ? parseInt(employeeId, 10) : NaN; // digits only: a UUID that merely STARTS with digits must not match some other employee's legacyId
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: employeeId },
          ...(isNaN(parsedLegacyId) ? [] : [{ legacyId: parsedLegacyId }])
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        isActive: true,
        roleId: true,
        receiveEmailAlerts: true,
        email: true,
        department: { select: { name: true } }
      }
    });

    if (!employee || !employee.isActive) {
      return NextResponse.json({ success: false, error: 'Employee not found or inactive' }, { status: 401 });
    }

    // exportMaxRows - כמות שורות מרבית לייצוא בלי אישור מנהל (components/ExportButtons.js),
    // לפי המחלקה של העובד או חריגה פרטנית לו - ר' lib/permissionsMetadata.js feature:export_max_rows
    employee.exportMaxRows = await getEmployeeEffectiveValue(employee, 'feature:export_max_rows');

    // משמרת פתוחה (exitTime: null) בכל תאריך - לא רק היום: עובד שנכנס לפני חצות ועדיין לא יצא
    // נשאר עם משמרת מתוארכת ל"אתמול" (ר' הערה ב-/api/attendance), וסינון לפי תאריך היה
    // מכבה את "בעבודה כעת" בחצות.
    // כשיש כמה משמרות פתוחות (למשל ישנות מ-Access) מחזירים את העדכנית לפי שעת כניסה - לא id אקראי (ר' lib/openShift.js).
    const activeShift = await findLatestOpenShift(prisma, employee.id);

    return NextResponse.json({ 
      success: true, 
      employee, 
      activeShift 
    });

  } catch (error) {
    console.error('Error in /api/me:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const token = getVerifiedAuthCookie(cookieStore);

    if (!token?.value) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const employeeId = token.value;
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const updateData = {};

    if (typeof body.receiveEmailAlerts !== 'undefined') {
      updateData.receiveEmailAlerts = Boolean(body.receiveEmailAlerts);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No data to update' }, { status: 400 });
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
      select: {
        id: true,
        receiveEmailAlerts: true
      }
    });

    return NextResponse.json({ success: true, employee: updatedEmployee });

  } catch (error) {
    console.error('Error in /api/me PATCH:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// cpu-measure (docs/cpu-measurement-2026-10-06.md): Server-Timing/x-cpu-ms/x-boot-id on the response
const GET_timed = withCpuTiming(GET);
export { GET_timed as GET };
