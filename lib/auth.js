import { cookies } from 'next/headers';
import prisma from '@/app/lib/prisma';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
  isSessionFresh,
  createRequireLoginCache,
  checkAuthCore,
  checkPageAccessCore,
} from '@/lib/authTokens';

// Role levels that satisfy a given requiredRole gate, keyed by Employee.roleId.
// Mirrors the existing client-side convention in app/components/PopupProvider.js
// (showAuthPrompt): roleId 1 = מנהל (admin), roleId 2 = מתכנת (developer) — both
// satisfy a 'מנהל'-gated route, only roleId 2 satisfies a 'מתכנת'-gated route.
// roleId 0 = הנהלה ראשית (head management, above a branch מנהל) — a small set
// of company-wide pages (employee list/attendance, price list, revenue
// dashboard, the whole /admin section) are meant for head management only,
// not every branch מנהל; see HEAD_MANAGEMENT_ROLES below.
const ROLE_LEVELS = {
  'מנהל': [1, 2],
  'מתכנת': [2],
  'הנהלה ראשית': [0, 2],
};

// Shared with checkPageAccess()'s allowedRoles param — kept as one constant
// so the page-guard and API-guard gates for these head-management-only
// screens can't drift apart.
export const HEAD_MANAGEMENT_ROLES = [0, 2];

// ---------------------------------------------------------------------------
// Layer 1 — require_login TTL cache (30s).
//
// checkAuth() is called from ~75 route files on every request; before this
// cache each call did a systemSetting.findUnique. The cache is module-level,
// so in a serverless deployment each warm lambda instance has its own copy:
// invalidateRequireLoginCache() (called by the admin settings save route)
// clears the instance that handled the save immediately, and the 30s TTL
// bounds staleness on every other instance. Errors from the DB load are NOT
// cached — they propagate so the original fail-open/fail-closed semantics of
// the callers below are preserved exactly.
// ---------------------------------------------------------------------------
const requireLoginCache = createRequireLoginCache({
  load: async () => {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'require_login' },
    });
    return !!(setting && setting.value === 'true');
  },
});

export function invalidateRequireLoginCache() {
  requireLoginCache.invalidate();
}

// ---------------------------------------------------------------------------
// Layer 2 — HMAC-signed session cookie (`auth_session`).
//
// Issued at login ALONGSIDE the legacy `auth_token` cookie (which stays the
// raw employee UUID — many routes and the AuditLog prisma extension read it
// directly, and already-logged-in production browsers only have that cookie).
// The signed token carries employeeId+roleId+showAi and lets role checks be
// verified in-memory instead of querying Employee. Secret: AUTH_SECRET env
// var; when it is absent, or the cookie is missing/invalid/stale (legacy
// sessions!), everything silently falls back to the original DB path.
// See lib/authTokens.js for the token format and the fresh-window trust model.
// ---------------------------------------------------------------------------
function getAuthSecret() {
  return process.env.AUTH_SECRET || null;
}

// Sets the signed session cookie on a mutable cookie store (route handler /
// server action). Returns false when AUTH_SECRET isn't configured (legacy
// mode — callers proceed without the fast path). Used by the login route.
export function issueSessionCookie(cookieStore, employee) {
  const token = createSessionToken(
    { id: employee.id, roleId: employee.roleId, showAi: !!employee.showAi },
    getAuthSecret()
  );
  if (!token) return false;
  // Session cookie (no maxAge) to match auth_token — see the comment in
  // app/api/login/route.js. The token's own `exp` (SESSION_MAX_AGE_SECONDS,
  // signed into the payload) is left as-is; that's an internal validity
  // bound, unrelated to how long the browser keeps the cookie around.
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  return true;
}

// Read-only helper for server components (app/layout.js): returns the
// verified, FRESH session payload bound to the current auth_token cookie, or
// null (missing/invalid/stale/foreign token → caller uses its DB path).
export function readVerifiedSession(cookieStore) {
  const authToken = cookieStore.get('auth_token');
  if (!authToken || !authToken.value) return null;
  const session = verifySessionToken(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    getAuthSecret()
  );
  if (!session || session.e !== authToken.value || !isSessionFresh(session)) return null;
  return session;
}

// checkAuth() — no args: preserves original behavior exactly (gated by the
// require_login SystemSetting toggle, fail-open on DB errors).
// checkAuth(requiredRole) — additionally requires a logged-in employee whose
// roleId is in ROLE_LEVELS[requiredRole], regardless of the require_login
// toggle (an admin-only route must stay protected even if plain login is
// optional for staff). Fails CLOSED on DB errors when a role is required,
// since failing open would grant admin access on a DB hiccup.
// checkAuth(requiredRole, { forceDb: true }) — opt-in for extra-sensitive
// operations (irreversible deletions etc.): skips the signed-token fast path
// and always re-verifies the role against the DB. No existing call site
// passes it, so all 100+ existing calls keep their exact signature.
export async function checkAuth(requiredRole, { forceDb = false } = {}) {
  try {
    const cookieStore = await cookies();
    return await checkAuthCore({
      requiredRole,
      authTokenValue: cookieStore.get('auth_token')?.value || null,
      sessionTokenValue: forceDb ? null : cookieStore.get(SESSION_COOKIE_NAME)?.value || null,
      secret: getAuthSecret(),
      roleLevels: ROLE_LEVELS,
      getRequireLogin: () => requireLoginCache.get(),
      findEmployeeRoleById: (id) =>
        prisma.employee.findUnique({
          where: { id },
          select: { roleId: true, showAi: true },
        }),
      reissueSession: (employee) => issueSessionCookie(cookieStore, employee),
    });
  } catch (error) {
    console.error('Auth check error:', error);
    // Preserve original fail-open behavior for the plain login check, but
    // fail closed when a specific role was required.
    return !requiredRole;
  }
}

// checkPageAccess() — server-side page guard for manager-only pages (/admin,
// /employees, /refunds), shared with the navbar visibility rule in app/layout.js.
// A LOGGED-IN employee is always judged by role — only roleId 1 (מנהל) or
// 2 (מתכנת) pass, even when require_login is off (login is optional at the
// gemach, so a voluntarily-logged-in secretary must still be restricted).
// An ANONYMOUS visitor passes only while require_login is off (there is no
// identity to check in open mode). Fails OPEN on DB errors so a DB hiccup
// doesn't lock the whole app — the sensitive APIs behind these pages still
// enforce checkAuth('מנהל') themselves and fail closed.
export async function checkPageAccess(allowedRoles) {
  try {
    const cookieStore = await cookies();
    return await checkPageAccessCore({
      authTokenValue: cookieStore.get('auth_token')?.value || null,
      sessionTokenValue: cookieStore.get(SESSION_COOKIE_NAME)?.value || null,
      secret: getAuthSecret(),
      ...(allowedRoles ? { allowedRoles } : {}),
      getRequireLogin: () => requireLoginCache.get(),
      findEmployeeForPageAccess: (authTokenValue) => {
        const parsedLegacy = parseInt(authTokenValue, 10);
        return prisma.employee.findFirst({
          where: {
            OR: [
              { id: authTokenValue },
              ...(isNaN(parsedLegacy) ? [] : [{ legacyId: parsedLegacy }]),
            ],
          },
          select: { roleId: true },
        });
      },
    });
  } catch (error) {
    console.error('Page access check error:', error);
    return true;
  }
}
