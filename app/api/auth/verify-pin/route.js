import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function POST(request) {
  try {
    const { pin, requiredLevel, employeeId } = await request.json();

    if (!pin) {
      return NextResponse.json({ success: false, error: 'לא סופקה סיסמה' }, { status: 400 });
    }

    // Find active employee with this password/pin
    const whereClause = { 
      password: pin,
      isActive: true
    };
    if (employeeId) {
      whereClause.id = employeeId;
    }

    const employee = await prisma.employee.findFirst({
      where: whereClause
    });

    if (!employee) {
      return NextResponse.json({ success: false, error: 'סיסמה שגויה או משתמש לא פעיל' }, { status: 401 });
    }

    // Role check
    // Assuming roleId = 1 is Manager (מנהל), roleId = 2 is Programmer (מתכנת).
    // Modify this based on actual database schema logic if needed.
    const isManager = employee.roleId === 1 || employee.roleId === 2;

    if (requiredLevel === 'מנהל' && !isManager) {
      return NextResponse.json({ success: false, error: 'אין הרשאת מנהל/מתכנת למשתמש זה' }, { status: 403 });
    }

    // Stricter than the 'מנהל' tier above (which treats roleId 1 and 2 as equivalent) -
    // some actions (e.g. editing Order.orderDate, which shifts the refund-window calculation
    // in lib/pricingEngine.js) are restricted to roleId 2 specifically, excluding managers.
    if (requiredLevel === 'מתכנת' && employee.roleId !== 2) {
      return NextResponse.json({ success: false, error: 'פעולה זו מוגבלת למתכנת בלבד' }, { status: 403 });
    }

    return NextResponse.json({ success: true, employeeId: employee.id, employeeName: employee.firstName + ' ' + employee.lastName });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return NextResponse.json({ success: false, error: 'שגיאה באימות הסיסמה' }, { status: 500 });
  }
}
