'use strict';
// lib/authTokens.js — dependency-free core of the auth fast path (2026-08 infra work).
//
// Written as CommonJS on purpose: Next.js bundles CJS fine, and a plain
// `node` test script (no webpack, no '@/' alias, no next/headers) can
// `require()` this file directly and exercise the REAL logic. lib/auth.js is
// the thin Next-coupled wrapper (cookies() + prisma) around these functions.
//
// Two layers:
//  1) createRequireLoginCache — module-level TTL cache for the
//     `require_login` SystemSetting, so checkAuth() stops hitting the DB on
//     every one of its ~103 call sites. Errors from load() propagate (they
//     are NOT cached) so the caller's existing fail-open/fail-closed
//     semantics stay exactly as before.
//  2) HMAC-signed session token (cookie `auth_session`) carrying
//     employeeId + roleId + showAi, issued at login alongside the legacy
//     `auth_token` cookie (which stays the raw employee UUID — 25 route
//     files and the AuditLog prisma extension parse it directly and must
//     keep working). Role checks verify the signature in-memory instead of
//     querying Employee.
//
// Token format:  v1.<base64url(JSON payload)>.<base64url(HMAC-SHA256(payload))>
// Payload:       { e: employeeId, r: roleId, a: showAi, iat: ms, exp: ms }
//
// Trust model ("fresh window"):
//  - A signed token GRANTS a role only while it is "fresh" (iat within
//    SESSION_FRESH_MS). A fresh token can only grant what the DB itself
//    granted at issue time.
//  - A token is NEVER used to DENY: if the fresh-token check does not grant,
//    we fall through to the legacy DB path (so a just-promoted employee is
//    not locked out for the fresh window, and legacy cookies keep working).
//  - After the fresh window, the DB path runs again and (in route-handler
//    contexts, where cookies are mutable) re-issues a new token — so the DB
//    is consulted at most ~once per SESSION_FRESH_MS per user for role
//    checks, and role revocations propagate within that window.

const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'auth_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // matches auth_token cookie (1 week)
const SESSION_FRESH_MS = 15 * 60 * 1000; // role/showAi trusted without DB for 15 min
const REQUIRE_LOGIN_TTL_MS = 30 * 1000;
const TOKEN_VERSION = 'v1';

function createSessionToken(employee, secret, now = Date.now()) {
  if (!secret || !employee || !employee.id) return null;
  const payload = {
    e: employee.id,
    r: typeof employee.roleId === 'number' ? employee.roleId : null,
    a: !!employee.showAi,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${TOKEN_VERSION}.${body}`).digest('base64url');
  return `${TOKEN_VERSION}.${body}.${sig}`;
}

// Returns the payload object when the token is authentic and unexpired,
// otherwise null. Never throws.
function verifySessionToken(token, secret, now = Date.now()) {
  try {
    if (!secret || !token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
    const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const given = Buffer.from(parts[2], 'base64url');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload || typeof payload.e !== 'string' || !payload.e) return null;
    if (typeof payload.exp !== 'number' || now > payload.exp) return null;
    if (typeof payload.iat !== 'number') return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function isSessionFresh(payload, now = Date.now()) {
  return !!payload && typeof payload.iat === 'number' && now - payload.iat < SESSION_FRESH_MS;
}

// TTL cache for the require_login boolean. load() must resolve to the
// boolean; a rejected load() propagates to the caller and leaves the cache
// unpopulated (errors are never cached).
function createRequireLoginCache({ ttlMs = REQUIRE_LOGIN_TTL_MS, load }) {
  let cached = { value: false, expiresAt: 0 };
  return {
    async get() {
      if (cached.expiresAt > Date.now()) return cached.value;
      const value = await load();
      cached = { value, expiresAt: Date.now() + ttlMs };
      return value;
    },
    invalidate() {
      cached = { value: false, expiresAt: 0 };
    },
  };
}

// Mirrors the original checkAuth() decision flow exactly, with the signed
// token as a DB-free fast path for role grants. The caller wraps this in
// try/catch to keep the original fail-open (no role) / fail-closed (role)
// behavior on errors.
//
// deps:
//   getRequireLogin(): Promise<boolean>
//   findEmployeeRoleById(id): Promise<{ roleId, showAi } | null>  — the legacy DB path
//   reissueSession(employee): void — best-effort; may throw (ignored) in RSC context
async function checkAuthCore({
  requiredRole,
  authTokenValue,
  sessionTokenValue,
  secret,
  roleLevels,
  getRequireLogin,
  findEmployeeRoleById,
  reissueSession,
  now = Date.now(),
}) {
  const loginRequired = await getRequireLogin();

  if (!loginRequired && !requiredRole) {
    return true;
  }

  if (!authTokenValue) {
    return false;
  }

  if (requiredRole) {
    const allowedRoles = roleLevels[requiredRole] || [];

    // Fast path: authentic, fresh token bound to THIS auth_token cookie,
    // whose roleId satisfies the gate. Grant with zero DB calls.
    const session = verifySessionToken(sessionTokenValue, secret, now);
    if (
      session &&
      session.e === authTokenValue &&
      isSessionFresh(session, now) &&
      allowedRoles.includes(session.r)
    ) {
      return true;
    }

    // Legacy / stale / would-deny path: exactly the original DB check.
    const employee = await findEmployeeRoleById(authTokenValue);
    if (!employee || !allowedRoles.includes(employee.roleId)) {
      return false;
    }
    // DB granted — refresh the signed token so the next SESSION_FRESH_MS of
    // role checks are DB-free. cookies are only mutable in route handlers /
    // server actions; elsewhere .set throws and we swallow it.
    if (reissueSession) {
      try {
        reissueSession({ id: authTokenValue, roleId: employee.roleId, showAi: employee.showAi });
      } catch (e) {
        /* read-only cookie context (RSC render) — fine, purely an optimization */
      }
    }
  }

  return true;
}

// Mirrors the original checkPageAccess() flow (manager-only page guard).
// deps.findEmployeeForPageAccess(authTokenValue): Promise<{ roleId } | null>
// — the legacy DB path including the legacyId OR-lookup for very old cookies.
async function checkPageAccessCore({
  authTokenValue,
  sessionTokenValue,
  secret,
  getRequireLogin,
  findEmployeeForPageAccess,
  now = Date.now(),
}) {
  if (authTokenValue) {
    // Fast path — only ever used to GRANT manager access, never to deny.
    const session = verifySessionToken(sessionTokenValue, secret, now);
    if (
      session &&
      session.e === authTokenValue &&
      isSessionFresh(session, now) &&
      (session.r === 1 || session.r === 2)
    ) {
      return true;
    }

    const employee = await findEmployeeForPageAccess(authTokenValue);
    if (employee) {
      return employee.roleId === 1 || employee.roleId === 2;
    }
    // עוגיה יתומה (עובד שנמחק) — נופלים להמשך ומתייחסים כאל אורח
  }

  const loginRequired = await getRequireLogin();
  return !loginRequired;
}

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SESSION_FRESH_MS,
  REQUIRE_LOGIN_TTL_MS,
  createSessionToken,
  verifySessionToken,
  isSessionFresh,
  createRequireLoginCache,
  checkAuthCore,
  checkPageAccessCore,
};
