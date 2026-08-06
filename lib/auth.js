import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';

// Role levels that satisfy a given requiredRole gate, keyed by Employee.roleId.
// Mirrors the existing client-side convention in app/components/PopupProvider.js
// (showAuthPrompt): roleId 1 = מנהל (admin), roleId 2 = מתכנת (developer) — both
// satisfy a 'מנהל'-gated route, only roleId 2 satisfies a 'מתכנת'-gated route.
const ROLE_LEVELS = {
  'מנהל': [1, 2],
  'מתכנת': [2],
};

// checkAuth() — no args: preserves original behavior exactly (gated by the
// require_login SystemSetting toggle, fail-open on DB errors).
// checkAuth(requiredRole) — additionally requires a logged-in employee whose
// roleId is in ROLE_LEVELS[requiredRole], regardless of the require_login
// toggle (an admin-only route must stay protected even if plain login is
// optional for staff). Fails CLOSED on DB errors when a role is required,
// since failing open would grant admin access on a DB hiccup.
// checkPageAccess() — server-side page guard for manager-only pages (/admin,
// /employees, /refunds), shared with the navbar visibility rule in app/layout.js.
// A LOGGED-IN employee is always judged by role — only roleId 1 (מנהל) or
// 2 (מתכנת) pass, even when require_login is off (login is optional at the
// gemach, so a voluntarily-logged-in secretary must still be restricted).
// An ANONYMOUS visitor passes only while require_login is off (there is no
// identity to check in open mode). Fails OPEN on DB errors so a DB hiccup
// doesn't lock the whole app — the sensitive APIs behind these pages still
// enforce checkAuth('מנהל') themselves and fail closed.
export async function checkPageAccess() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');

    if (token && token.value) {
      const parsedLegacy = parseInt(token.value, 10);
      const employee = await prisma.employee.findFirst({
        where: {
          OR: [
            { id: token.value },
            ...(isNaN(parsedLegacy) ? [] : [{ legacyId: parsedLegacy }])
          ]
        },
        select: { roleId: true }
      });
      if (employee) {
        return employee.roleId === 1 || employee.roleId === 2;
      }
      // עוגיה יתומה (עובד שנמחק) — נופלים להמשך ומתייחסים כאל אורח
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'require_login' }
    });
    const loginRequired = setting && setting.value === 'true';
    return !loginRequired;
  } catch (error) {
    console.error('Page access check error:', error);
    return true;
  }
}

export async function checkAuth(requiredRole) {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'require_login' }
    });
    const loginRequired = setting && setting.value === 'true';

    if (!loginRequired && !requiredRole) {
      return true;
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    if (!token || !token.value) {
      return false;
    }

    if (requiredRole) {
      const employee = await prisma.employee.findUnique({
        where: { id: token.value },
        select: { roleId: true }
      });
      const allowedRoles = ROLE_LEVELS[requiredRole] || [];
      if (!employee || !allowedRoles.includes(employee.roleId)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Auth check error:', error);
    // Preserve original fail-open behavior for the plain login check, but
    // fail closed when a specific role was required.
    return !requiredRole;
  }
}
