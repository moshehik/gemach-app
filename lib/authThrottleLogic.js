// Brute-force throttle for password-confirmation endpoints (POST /api/auth/verify-pin) - the PURE part.
// No DB, no Next, no clock of its own: every function takes `now` (ms) and a `store`, so the same code runs in the
// route (lib/authThrottle.js supplies a Postgres store) and in scripts/test_auth_throttle.mjs (in-memory store).
//
// Model: one row per throttle key {count, level, lockedUntil, updatedAt, version}.
//   * An attempt is RESERVED before the password is checked (count + 1), so a burst of parallel requests cannot all
//     slip through before the first one fails - the limit is hard, not "eventually".
//   * The attempt that makes count reach policy.maxFailures sets lockedUntil (policy.stepsSec[level], escalating) and
//     resets count to 0, level + 1. That attempt is still evaluated (`lockedNow`) - if it fails the route answers 429
//     right away; every later attempt is refused with Retry-After until lockedUntil.
//   * No failure for policy.decayMs -> the row is forgotten (level back to 0).
//   * Writes are compare-and-swap on `version`, so two instances racing on one key never lose an increment.
//   * A correct password refunds the reservation (per-IP key) or deletes the row (per employee+IP key).

export const PIN_EMPLOYEE_POLICY = Object.freeze({ maxFailures: 5, stepsSec: [30, 120, 600, 1800], decayMs: 60 * 60 * 1000 });
export const PIN_IP_POLICY = Object.freeze({ maxFailures: 20, stepsSec: [30, 120, 600, 1800], decayMs: 60 * 60 * 1000 });

const MAX_CAS_TRIES = 4;

function lockSeconds(policy, level) {
  const steps = policy.stepsSec;
  return steps[Math.min(Math.max(level, 0), steps.length - 1)];
}

/**
 * Pure decision for one attempt. row = stored state or null.
 * Returns { allowed, retryAfterSec, lockedNow, next } - `next` is the state to write (null = write nothing).
 */
export function decideAttempt(row, now, policy) {
  if (row && row.lockedUntil && row.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((row.lockedUntil - now) / 1000)), lockedNow: false, next: null };
  }
  const fresh = !row || now - row.updatedAt > policy.decayMs;
  const level = fresh ? 0 : row.level;
  const count = (fresh ? 0 : row.count) + 1;
  if (count >= policy.maxFailures) {
    const sec = lockSeconds(policy, level);
    return {
      allowed: true,
      retryAfterSec: sec,
      lockedNow: true,
      next: { count: 0, level: level + 1, lockedUntil: now + sec * 1000, updatedAt: now },
    };
  }
  return { allowed: true, retryAfterSec: 0, lockedNow: false, next: { count, level, lockedUntil: null, updatedAt: now } };
}

/**
 * Pure: undo one reserved attempt after the password turned out to be right (per-IP key only - the per
 * employee+IP key is simply deleted). `reservation.lockedNow` = that very attempt had triggered the lock, so
 * the lock it set is lifted again (only if it is still the same lock). Returns the state to write or null.
 */
export function refundAttempt(row, reservation, now, policy) {
  if (!row) return null;
  if (reservation && reservation.lockedNow && row.lockedUntil === reservation.lockedUntil) {
    return { count: Math.max(policy.maxFailures - 1, 0), level: Math.max(row.level - 1, 0), lockedUntil: null, updatedAt: now };
  }
  if (row.count <= 0) return null;
  return { count: row.count - 1, level: row.level, lockedUntil: row.lockedUntil, updatedAt: row.updatedAt };
}

/**
 * Reserve one attempt on `key`. store: { load(key) -> row|null, create(key, state) -> bool, update(key, version, state) -> bool }.
 * Contention that survives MAX_CAS_TRIES retries is refused (only a burst of parallel guesses causes that).
 */
export async function reserveAttempt(store, key, policy, now) {
  for (let i = 0; i < MAX_CAS_TRIES; i++) {
    const row = await store.load(key);
    const d = decideAttempt(row, now, policy);
    if (!d.allowed) return { key, allowed: false, retryAfterSec: d.retryAfterSec, lockedNow: false, lockedUntil: null };
    const ok = row ? await store.update(key, row.version, d.next) : await store.create(key, d.next);
    if (ok) return { key, allowed: true, retryAfterSec: d.retryAfterSec, lockedNow: d.lockedNow, lockedUntil: d.next.lockedUntil };
  }
  return { key, allowed: false, retryAfterSec: 5, lockedNow: false, lockedUntil: null, contended: true };
}

/** Give one reserved attempt back (see refundAttempt). Best effort: gives up after MAX_CAS_TRIES lost races. */
export async function refundReservation(store, reservation, policy, now) {
  for (let i = 0; i < MAX_CAS_TRIES; i++) {
    const row = await store.load(reservation.key);
    const next = refundAttempt(row, reservation, now, policy);
    if (!next) return true;
    if (await store.update(reservation.key, row.version, next)) return true;
  }
  return false;
}

export function ipKey(ip) {
  return `ip:${cleanKeyPart(ip, 64) || 'unknown'}`;
}

export function employeeIpKey(employeeId, ip) {
  return `pe:${cleanKeyPart(employeeId, 64) || '*'}:${cleanKeyPart(ip, 64) || 'unknown'}`;
}

function cleanKeyPart(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[^A-Za-z0-9:._-]/g, '').slice(0, max);
}

/**
 * Client IP from request headers (a Headers-like object with .get). On Vercel the platform sets these itself;
 * first hop of x-forwarded-for is the client. Locally everything falls into one 'unknown' bucket.
 */
export function clientIpFromHeaders(headers) {
  const get = (n) => (headers && typeof headers.get === 'function' ? headers.get(n) : null);
  const first = (v) => (typeof v === 'string' ? v.split(',')[0].trim() : '');
  const ip = first(get('x-vercel-forwarded-for')) || first(get('x-real-ip')) || first(get('x-forwarded-for'));
  return cleanKeyPart(ip, 64) || 'unknown';
}

/**
 * Attempt a guarded verification. Reserves the per-IP key, then the per employee+IP key.
 * Returns { allowed:false, retryAfterSec } or { allowed:true, handle }.
 */
export async function beginAttempt(store, { ip, employeeId }, now, { ipPolicy = PIN_IP_POLICY, employeePolicy = PIN_EMPLOYEE_POLICY } = {}) {
  const ipRes = await reserveAttempt(store, ipKey(ip), ipPolicy, now);
  if (!ipRes.allowed) return { allowed: false, retryAfterSec: ipRes.retryAfterSec };
  const empRes = await reserveAttempt(store, employeeIpKey(employeeId, ip), employeePolicy, now);
  if (!empRes.allowed) {
    // refused by the employee lock: no password was tested, so it must not eat the IP's shared budget (a user
    // hammering a locked dialog would otherwise lock the whole branch's IP)
    await refundReservation(store, ipRes, ipPolicy, now);
    return { allowed: false, retryAfterSec: empRes.retryAfterSec };
  }
  return { allowed: true, handle: { ip: ipRes, emp: empRes, ipPolicy } };
}

/** Wrong password: nothing to write (the reservation already counted). Tells the route whether to answer 429. */
export function failureOutcome(handle) {
  if (!handle) return { locked: false, retryAfterSec: 0 };
  const locks = [handle.ip, handle.emp].filter((r) => r.lockedNow);
  if (locks.length === 0) return { locked: false, retryAfterSec: 0 };
  return { locked: true, retryAfterSec: Math.max(...locks.map((r) => r.retryAfterSec)) };
}

/** Right password: employee+IP counter is reset, the per-IP reservation is refunded (never reset - see header). */
export async function successOutcome(store, handle, now) {
  if (!handle) return;
  await Promise.all([
    store.remove(handle.emp.key),
    refundReservation(store, handle.ip, handle.ipPolicy || PIN_IP_POLICY, now),
  ]);
}

export function retryMessageHe(retryAfterSec) {
  const s = Math.max(1, Math.ceil(retryAfterSec));
  const wait = s < 60 ? `${s} שניות` : s < 3600 ? `${Math.ceil(s / 60)} דקות` : `${Math.ceil(s / 3600)} שעות`;
  return `יותר מדי ניסיונות שגויים. נסו שוב בעוד ${wait}.`;
}

/** Strict body validation for verify-pin. Returns { ok:true, value } or { ok:false, error }. */
export function validateVerifyPinBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'בקשה לא תקינה' };
  const { pin, requiredLevel, employeeId } = body;
  if (pin === undefined || pin === null || pin === '') return { ok: false, error: 'לא סופקה סיסמה' };
  if (typeof pin !== 'string' || pin.length > 256) return { ok: false, error: 'סיסמה לא תקינה' };
  let emp = null;
  if (employeeId !== undefined && employeeId !== null && employeeId !== '') {
    if (typeof employeeId !== 'string' || employeeId.length > 64) return { ok: false, error: 'מזהה עובד לא תקין' };
    emp = employeeId;
  }
  if (requiredLevel !== undefined && requiredLevel !== null && (typeof requiredLevel !== 'string' || requiredLevel.length > 100)) {
    return { ok: false, error: 'רמת אישור לא תקינה' };
  }
  return { ok: true, value: { pin, employeeId: emp } };
}
