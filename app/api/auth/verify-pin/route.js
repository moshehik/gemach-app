import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { verifySecret } from '@/lib/passwordAuth';

export async function POST(request) {
  try {
    const { pin, requiredLevel, employeeId } = await request.json();

    if (!pin) {
      return NextResponse.json({ success: false, error: 'לא סופקה סיסמה' }, { status: 400 });
    }

    // Note: despite the field name, this is the employee's full real password re-entered
    // as an in-app confirmation step (see PopupProvider.js's customAuthPrompt) - unrelated
    // to the short trusted-device PIN feature (Employee.pinHash / lib/trustedDevice.js).
    // Passwords are hashed (bcrypt), so the match can no longer happen inside the Prisma
    // `where` clause the way a plaintext `password: pin` equality check could - fetch
    // candidate(s) first, then compare the hash in JS.
    const whereClause = { isActive: true };
    if (employeeId) {
      whereClause.id = employeeId;
    }

    // When no employee is pre-selected this scans all active employees, matching the
    // original plaintext behavior - fine at this org's scale (a handful of employees).
    const candidates = await prisma.employee.findMany({ where: whereClause });

    let employee = null;
    for (const candidate of candidates) {
      if (await verifySecret(pin, candidate.password)) {
        employee = candidate;
        break;
      }
    }

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
