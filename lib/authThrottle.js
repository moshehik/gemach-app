// DB-backed brute-force throttle for POST /api/auth/verify-pin (the Postgres store + the fail-open wrapper).
// The rules live in lib/authThrottleLogic.js (pure, tested by scripts/test_auth_throttle.mjs). Module memory is
// per Vercel instance, so the counters are rows in "AuthThrottle" (raw SQL, additive table:
// prisma/migrations-pending/2026-10-11-auth-throttle.sql - apply to BOTH prod DBs before this code deploys).
// Raw SQL on purpose: the Prisma audit extension would log every counter bump into AuditLog.
// FAIL-OPEN: if the table is missing or the DB hiccups, the attempt goes through and the error is logged - the
// approval dialog must not die with the limiter (verify-pin needs the same DB right after anyway).
import prisma from '@/app/lib/prisma';
import { beginAttempt, failureOutcome, successOutcome, clientIpFromHeaders, retryMessageHe } from './authThrottleLogic.js';

export { clientIpFromHeaders, retryMessageHe, failureOutcome };

const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000;
let lastErrorLogAt = 0;

function toNum(v) {
  return v === null || v === undefined ? null : Number(v);
}

export const pgStore = {
  async load(key) {
    const rows = await prisma.$queryRaw`SELECT "count", "level", "lockedUntilMs", "updatedAtMs", "version" FROM "AuthThrottle" WHERE "key" = ${key}`;
    const r = rows[0];
    if (!r) return null;
    return { count: Number(r.count), level: Number(r.level), lockedUntil: toNum(r.lockedUntilMs), updatedAt: Number(r.updatedAtMs), version: Number(r.version) };
  },
  async create(key, s) {
    const n = await prisma.$executeRaw`INSERT INTO "AuthThrottle" ("key", "count", "level", "lockedUntilMs", "updatedAtMs", "version")
      VALUES (${key}, ${s.count}, ${s.level}, ${s.lockedUntil === null ? null : BigInt(s.lockedUntil)}, ${BigInt(s.updatedAt)}, 0)
      ON CONFLICT ("key") DO NOTHING`;
    return n === 1;
  },
  async update(key, version, s) {
    const n = await prisma.$executeRaw`UPDATE "AuthThrottle" SET "count" = ${s.count}, "level" = ${s.level},
      "lockedUntilMs" = ${s.lockedUntil === null ? null : BigInt(s.lockedUntil)}, "updatedAtMs" = ${BigInt(s.updatedAt)}, "version" = "version" + 1
      WHERE "key" = ${key} AND "version" = ${version}`;
    return n === 1;
  },
  async remove(key) {
    await prisma.$executeRaw`DELETE FROM "AuthThrottle" WHERE "key" = ${key}`;
  },
  async sweep(olderThanMs) {
    await prisma.$executeRaw`DELETE FROM "AuthThrottle" WHERE "updatedAtMs" < ${BigInt(olderThanMs)}`;
  },
};

function logLimiterError(where, e) {
  const now = Date.now();
  if (now - lastErrorLogAt < 60 * 1000) return;
  lastErrorLogAt = now;
  console.error(`[authThrottle] ${where} failed - NOT limiting this attempt (is the AuthThrottle table created? prisma/migrations-pending/2026-10-11-auth-throttle.sql):`, e && e.message ? e.message : e);
}

/** -> { allowed:false, retryAfterSec } | { allowed:true, handle } (handle = null when the limiter itself failed). */
export async function guardPinAttempt(request, employeeId, store = pgStore) {
  try {
    const now = Date.now();
    const r = await beginAttempt(store, { ip: clientIpFromHeaders(request.headers), employeeId }, now);
    if (r.allowed && Math.random() < 0.02 && store.sweep) store.sweep(now - CLEANUP_AFTER_MS).catch(() => {});
    return r;
  } catch (e) {
    logLimiterError('begin', e);
    return { allowed: true, handle: null };
  }
}

/** Correct password: reset this employee+IP counter, refund the per-IP reservation. Never throws. */
export async function recordPinSuccess(handle, store = pgStore) {
  try {
    await successOutcome(store, handle, Date.now());
  } catch (e) {
    logLimiterError('success', e);
  }
}
