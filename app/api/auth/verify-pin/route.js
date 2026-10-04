import { NextResponse } from 'next/server';
import prisma, { getActingEmployeeId } from '../../../lib/prisma';
import { verifySecret } from '@/lib/passwordAuth';
import { HEAD_MANAGEMENT_ROLES, checkAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getCatalogItem } from '@/lib/permissionsMetadata';
import { writeOrderEvents } from '@/app/lib/auditLog';
import { parseApprovalContext, buildApprovalMeta } from '@/lib/history/orderEvents';

// Optional `context: { orderId, reason }` (new order card, D12): a SUCCESSFUL approval is recorded as one
// MANAGER_APPROVAL row on that order - employeeId = the logged-in employee who asked, meta.approverId = the
// employee whose code matched. Never the pin. Without `context` nothing here changes (legacy card / wizard).
// Contract: lib/history/orderEvents.js. Logging never turns a valid approval into a failure.
async function recordApproval(ctx, requiredLevel, approver) {
  try {
    const order = await prisma.order.findUnique({ where: { orderId: ctx.orderId }, select: { orderId: true } });
    if (!order) return false;
    const actorId = await getActingEmployeeId();
    const written = await writeOrderEvents({
      orderIds: [ctx.orderId],
      action: 'MANAGER_APPROVAL',
      meta: buildApprovalMeta({ requiredLevel, reason: ctx.reason, approverId: approver.id }),
      actorId,
    });
    return written > 0;
  } catch (e) {
    console.error('verify-pin: MANAGER_APPROVAL log failed', e);
    return false;
  }
}

export async function POST(request) {
  // Was fully anonymous: with no employeeId it tried the typed password against EVERY active
  // employee and answered with the matching employee's id - a password-guessing oracle open to
  // the internet. Every caller is the in-app "manager code" popup, i.e. already logged in
  // (checkAuth() is still open-mode-tolerant when require_login is off).
  if (!(await checkAuth())) {
    return NextResponse.json({ success: false, error: 'יש להתחבר למערכת' }, { status: 401 });
  }
  try {
    const { pin, requiredLevel, employeeId, context } = await request.json();

    if (!pin) {
      return NextResponse.json({ success: false, error: 'לא סופקה סיסמה' }, { status: 400 });
    }

    const approvalCtx = parseApprovalContext(context);
    if (approvalCtx.present && !approvalCtx.ok) {
      return NextResponse.json({ success: false, error: approvalCtx.error }, { status: 400 });
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

    // הנהלה ראשית - אותה קבוצת תפקידים כמו HEAD_MANAGEMENT_ROLES ב-lib/auth.js
    if (requiredLevel === 'הנהלה ראשית' && !HEAD_MANAGEMENT_ROLES.includes(employee.roleId)) {
      return NextResponse.json({ success: false, error: 'פעולה זו מוגבלת להנהלה ראשית בלבד' }, { status: 403 });
    }

    // מנהל סניף ומעלה - משמש את PAYMENT_APPROVAL_LEVEL (יציאה מהזמנה באישור מנהל).
    // "ומעלה" כולל גם הנהלה ראשית (roleId 0), לא רק מנהל סניף/מתכנת (roleId 1/2) -
    // איחוד ROLE_LEVELS['מנהל'] ו-HEAD_MANAGEMENT_ROLES ב-lib/auth.js.
    const isBranchManagerOrAbove = [0, 1, 2].includes(employee.roleId);
    if (requiredLevel === 'מנהל סניף ומעלה' && !isBranchManagerOrAbove) {
      return NextResponse.json({ success: false, error: 'פעולה זו מוגבלת למנהל סניף ומעלה בלבד' }, { status: 403 });
    }

    // מאשר הזמנה ללא תשלום - מנהל/מתכנת כתמיד, בתוספת הרשאת feature:debt_approval
    // (/admin/permissions, ר' lib/permissionsMetadata.js) ישירות לעובד או למחלקה שלו.
    // hasPermission is authoritative (roleId 0/2 always allowed; roleId 1 by default, but a
    // permissions row CAN now revoke it - the old `!isManager` bypass made such a row a no-op here
    // while /api/employees already reported the manager as not allowed).
    if (requiredLevel === 'מאשר הזמנה ללא תשלום' && !(await hasPermission(employee, 'feature:debt_approval'))) {
      return NextResponse.json({ success: false, error: 'פעולה זו מוגבלת למי שהורשה לאשר הזמנה ללא תשלום מלא' }, { status: 403 });
    }

    // requiredLevel = מפתח של פריט "מאשר" בקטלוג ההרשאות (approver:true ב-lib/permissionsMetadata.js,
    // למשל feature:reserve_rental_approval / feature:item_change_approval): הכרעה אחת של hasPermission
    // (הנהלה ראשית/מתכנת תמיד -> חריגה אישית -> שורת מחלקה -> ברירת המחדל שנגזרת מהגדרת המערכת),
    // בדיוק כמו 'מאשר הזמנה ללא תשלום' למעלה - בלי רשימת תפקידים קשיחה.
    if (typeof requiredLevel === 'string' && requiredLevel.startsWith('feature:')) {
      const approverItem = getCatalogItem(requiredLevel);
      if (!approverItem || !approverItem.approver) {
        return NextResponse.json({ success: false, error: 'רמת אישור לא מוכרת' }, { status: 400 });
      }
      if (!(await hasPermission(employee, requiredLevel))) {
        return NextResponse.json({ success: false, error: `אין הרשאה לאשר פעולה זו (${approverItem.label})` }, { status: 403 });
      }
    }

    const employeeName = employee.firstName + ' ' + employee.lastName;
    if (approvalCtx.present) {
      const approvalLogged = await recordApproval(approvalCtx, requiredLevel, employee);
      return NextResponse.json({ success: true, employeeId: employee.id, employeeName, approvalLogged });
    }
    return NextResponse.json({ success: true, employeeId: employee.id, employeeName });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return NextResponse.json({ success: false, error: 'שגיאה באימות הסיסמה' }, { status: 500 });
  }
}
