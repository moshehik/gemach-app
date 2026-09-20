import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { hashSecret, last4Of } from '../../../lib/passwordAuth';
import { checkAuth, checkPageAccess, HEAD_MANAGEMENT_ROLES, getSessionEmployee, canManageRoles } from '../../../lib/auth';
import { getEffectiveValueForEmployees } from '../../../lib/permissions';

// GET is intentionally left public (no checkAuth gate): the login screen itself
// (app/components/LoginScreen.js) fetches this list to populate the employee
// picker BEFORE anyone is logged in. Gating it behind checkAuth() creates a
// deadlock once require_login is turned on - nobody can load the picker to log
// in, in the first place. Never include password/pinHash in the response (see
// below) - that's the actual sensitive data, not the employee list itself.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    // The anonymous caller (login screen / punch clock / kiosk) only ever needs names + ids
    // to fill a picker. Everything else on an employee row - phone, email, wage, role, notes,
    // home address - is HR data and goes out only to a logged-in session (found 2026-09-20:
    // it used to be served to the whole internet, which also handed out every employee id).
    // (checkAuth() = a verified login session, or anybody at all while require_login is OFF - open mode.)
    const requesterIsAuthenticated = !!(await checkAuth());
    const all = requesterIsAuthenticated && searchParams.get('all') === 'true';

    const employees = await prisma.employee.findMany({
      where: all ? {} : { isActive: true },
      include: { department: true },
      orderBy: [
        { lastName: { sort: 'asc', nulls: 'last' } },
        { firstName: { sort: 'asc', nulls: 'last' } }
      ]
    });

    if (!requesterIsAuthenticated) {
      return NextResponse.json(employees.map((e) => ({
        id: e.id, firstName: e.firstName, lastName: e.lastName, fullName: e.fullName, isActive: e.isActive,
      })));
    }

    // needsPasswordReset only goes out to logged-in requests (the admin list at
    // /employees) - it's a boolean, not the hash itself, but there's no reason
    // for the anonymous login-screen picker to see it.
    const isLoggedIn = all;

    // canApproveWithoutPayment powers the "מאשר הזמנה ללא תשלום" employee
    // picker in app/components/PopupProvider.js (which fetches this route without
    // `all=true`) - checked against any logged-in caller, not just the `all=true`
    // admin list, so that picker keeps working. See lib/permissions.js /
    // lib/permissionsMetadata.js's feature:debt_approval.
    const debtApprovalByEmployee = await getEffectiveValueForEmployees(employees, 'feature:debt_approval');

    // Never send hashes (password/pinHash) to the client - there's no legitimate reason
    // for the browser to hold them, hashed or not.
    const safeEmployees = employees.map(({ password, pinHash, ...emp }) => ({
      ...emp,
      ...(isLoggedIn ? { needsPasswordReset: !!password && !password.startsWith('$2') } : {}),
      canApproveWithoutPayment: !!debtApprovalByEmployee.get(emp.id)
    }));

    return NextResponse.json(safeEmployees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request) {
  // Same audience as the /employees pages (app/employees/layout.js): head management + programmer.
  // This used to be the default checkPageAccess() = branch managers too, which let a role-1
  // manager create an account with any roleId (incl. programmer) and a password they chose.
  if (!(await checkAuth('הנהלה ראשית'))) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  if (!(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    const actor = await getSessionEmployee();
    const newRoleId = body.roleId !== "" && body.roleId !== null && body.roleId !== undefined ? parseInt(body.roleId, 10) : null;
    if (!actor || !canManageRoles(actor.roleId, newRoleId)) {
      return NextResponse.json({ error: 'אין הרשאה להגדיר תפקיד בכיר מהתפקיד שלך' }, { status: 403 });
    }

    // An initial password is set in plaintext here (the "new employee" form field) and
    // hashed before it ever reaches the database - same treatment as a real login password.
    // The last-4-digit PIN hash is derived right now, while the plaintext is still in hand,
    // so the trusted-device fast path works for this employee from day one.
    const plainPassword = body.password || null;
    const hashedPassword = plainPassword ? await hashSecret(plainPassword) : null;
    const pinHash = plainPassword ? await hashSecret(last4Of(plainPassword)) : null;

    const newEmployee = await prisma.employee.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        phone1: body.phone1,
        phone2: body.phone2,
        city: body.city,
        street: body.street,
        houseNum: body.houseNum,
        email: body.email,
        joinDate: body.joinDate ? new Date(body.joinDate) : null,
        fullName: body.fullName,
        notes: body.notes,
        emailSuffix: body.emailSuffix,
        paymentMethod: body.paymentMethod,
        password: hashedPassword,
        pinHash: pinHash,
        roleId: body.roleId !== "" && body.roleId !== null ? parseInt(body.roleId, 10) : null,
        hourlyWage: body.hourlyWage !== "" && body.hourlyWage !== null ? parseFloat(body.hourlyWage) : null,
        travelExpenses: typeof body.travelExpenses === 'boolean' ? body.travelExpenses : (body.travelExpenses === 'true' || body.travelExpenses === true),
        isActive: body.isActive !== undefined ? body.isActive : true,
        // themeColor לא נכתב ביצירה — העמודה משמשת העדפות-עיצוב פר-עובד (JSON)
        profileImage: body.profileImage,
        receiveEmailAlerts: typeof body.receiveEmailAlerts === 'boolean' ? body.receiveEmailAlerts : (body.receiveEmailAlerts === 'true' || body.receiveEmailAlerts === true),
        showAi: typeof body.showAi === 'boolean' ? body.showAi : (body.showAi === 'true' || body.showAi === true)
      }
    });
    const { password, pinHash: _pinHash, ...safeEmployee } = newEmployee;
    return NextResponse.json(safeEmployee);
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
