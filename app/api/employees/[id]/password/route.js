import prisma from '@/app/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAuth, getSessionEmployee, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import { decidePasswordChangeMode } from '@/lib/employeeCardSave';
import { hashSecret, verifySecret, last4Of } from '@/lib/passwordAuth';
import { getVerifiedAuthCookie } from '@/lib/authTokens';

// "Change password" with two modes (decided by decidePasswordChangeMode in lib/employeeCardSave.js):
//  - self: the signed-in employee changes their OWN password. Requires knowing the CURRENT password
//    (verified server-side via bcrypt).
//  - manager: head management / programmer (HEAD_MANAGEMENT_ROLES) changes ANOTHER employee's
//    password from that employee's card, provided the target is not more senior than the actor
//    (canManageRoles). The target's old password is not required (a manager doesn't know it) - the
//    manager instead re-proves their OWN password (`managerPassword`) as an extra confirmation on this
//    endpoint. (This does not make head management's account-takeover surface smaller overall:
//    PUT /api/employees/[id] still accepts body.password from head management without re-auth.)
//    Before 2026-10-04 only the self mode existed, so the button on someone else's card always failed
//    with 403.
// Either way the new password is bcrypt-hashed and the trusted-device PIN hash is re-derived from its
// last 4 characters; plaintext is never stored or logged. This is deliberately different from the
// reset-password endpoint (emails a temp password) and set-password (needs a manager code prompt).
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

    const { oldPassword, newPassword, managerPassword } = await request.json();
    // Non-string values (numbers, objects, arrays) would break .length / bcrypt - reject up front.
    for (const v of [oldPassword, newPassword, managerPassword]) {
      if (v !== undefined && v !== null && typeof v !== 'string') {
        return NextResponse.json({ success: false, message: 'ערך סיסמה לא תקין' }, { status: 400 });
      }
    }
    if (!newPassword) {
      return NextResponse.json({ success: false, message: 'יש להזין סיסמה חדשה' }, { status: 400 });
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ success: false, message: 'הסיסמה החדשה קצרה מדי' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionEmployeeId = getVerifiedAuthCookie(cookieStore)?.value;
    const isSelf = !!sessionEmployeeId && sessionEmployeeId === id;

    // Resolve WHO is calling first and only look the target up for a caller who may act on it, so a
    // non-manager can't use 404-vs-403 to probe which employee ids exist.
    const actor = isSelf ? null : await getSessionEmployee();
    const mayLookup = isSelf || (!!actor && HEAD_MANAGEMENT_ROLES.includes(actor.roleId));
    const employee = mayLookup ? await prisma.employee.findUnique({ where: { id } }) : null;
    const decision = decidePasswordChangeMode({
      sessionEmployeeId,
      targetId: id,
      actor,
      target: employee ? { roleId: employee.roleId } : null,
    });
    if (decision.mode === 'deny') {
      return NextResponse.json({ success: false, message: decision.message }, { status: decision.status });
    }
    if (!employee) {
      return NextResponse.json({ success: false, message: 'עובד לא נמצא' }, { status: 404 });
    }

    if (decision.mode === 'manager') {
      // Manager changing someone else's password: re-verify the MANAGER's own password.
      if (!managerPassword) {
        return NextResponse.json({ success: false, message: 'יש להזין את הסיסמה שלך (של המנהל) לאימות' }, { status: 400 });
      }
      const actorRow = await prisma.employee.findUnique({ where: { id: actor.id }, select: { password: true } });
      if (!(await verifySecret(managerPassword, actorRow?.password))) {
        return NextResponse.json({ success: false, message: 'סיסמת המנהל שהוזנה אינה נכונה' }, { status: 401 });
      }
    } else {
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
