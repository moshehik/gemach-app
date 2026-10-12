// בדיקות להגבלת ניסיונות הסיסמה בצד השרת (POST /api/auth/verify-pin): lib/authThrottleLogic.js.
// הלוגיקה טהורה - כאן היא רצה מול חנות בזיכרון עם החלפה אופטימית (CAS) ועם "השהיות" שמדמות כמה מופעי שרת במקביל.
// ללא DB, ללא רשת, ללא שעון אמיתי. הרצה: node scripts/test_auth_throttle.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PIN_EMPLOYEE_POLICY, PIN_IP_POLICY, decideAttempt, refundAttempt, reserveAttempt, beginAttempt, failureOutcome, successOutcome,
  ipKey, employeeIpKey, clientIpFromHeaders, retryMessageHe, validateVerifyPinBody,
} from '../lib/authThrottleLogic.js';

let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n     ${e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n     ') : e}`);
  }
}

// חנות בזיכרון עם אותו חוזה כמו ה-Postgres store; delay=true מוסיף yield בין קריאה לכתיבה כדי לדמות מרוץ בין בקשות
function memStore({ delay = false } = {}) {
  const rows = new Map();
  const yieldNow = () => (delay ? new Promise((r) => setImmediate(r)) : Promise.resolve());
  return {
    rows,
    async load(key) { await yieldNow(); const r = rows.get(key); return r ? { ...r } : null; },
    async create(key, s) { await yieldNow(); if (rows.has(key)) return false; rows.set(key, { ...s, version: 0 }); return true; },
    async update(key, version, s) { await yieldNow(); const r = rows.get(key); if (!r || r.version !== version) return false; rows.set(key, { ...s, version: version + 1 }); return true; },
    async remove(key) { rows.delete(key); },
  };
}

const T0 = Date.UTC(2026, 9, 11, 12, 0, 0);
const IP = '203.0.113.7';
const EMP = '11111111-2222-3333-4444-555555555555';

await test('decideAttempt: 4 attempts are free, the 5th sets the 30s lock, the 6th is refused with Retry-After', () => {
  let row = null;
  for (let i = 1; i <= 4; i++) {
    const d = decideAttempt(row, T0 + i, PIN_EMPLOYEE_POLICY);
    assert.equal(d.allowed, true); assert.equal(d.lockedNow, false);
    row = d.next;
  }
  const fifth = decideAttempt(row, T0 + 5, PIN_EMPLOYEE_POLICY);
  assert.equal(fifth.allowed, true); assert.equal(fifth.lockedNow, true); assert.equal(fifth.retryAfterSec, 30);
  assert.equal(fifth.next.lockedUntil, T0 + 5 + 30_000);
  const sixth = decideAttempt(fifth.next, T0 + 5 + 10_000, PIN_EMPLOYEE_POLICY);
  assert.equal(sixth.allowed, false); assert.equal(sixth.next, null);
  assert.equal(sixth.retryAfterSec, 20); // 30s lock, 10s elapsed (ceil)
});

await test('decideAttempt: locks escalate 30s -> 2m -> 10m -> 30m and stay at 30m', () => {
  let row = null; let now = T0; const seen = [];
  for (let round = 0; round < 6; round++) {
    let d;
    for (let i = 0; i < 5; i++) { d = decideAttempt(row, now, PIN_EMPLOYEE_POLICY); assert.equal(d.allowed, true); row = d.next; now += 1000; }
    assert.equal(d.lockedNow, true);
    seen.push(d.retryAfterSec);
    now = row.lockedUntil + 1000; // just after the lock ends (well inside the decay window)
  }
  assert.deepEqual(seen, [30, 120, 600, 1800, 1800, 1800]);
});

await test('decideAttempt: a quiet hour forgets the failures and the level', () => {
  let row = null; let now = T0;
  for (let i = 0; i < 5; i++) { row = decideAttempt(row, now, PIN_EMPLOYEE_POLICY).next; now += 1000; }
  assert.equal(row.level, 1);
  const later = decideAttempt(row, row.lockedUntil + PIN_EMPLOYEE_POLICY.decayMs + 1, PIN_EMPLOYEE_POLICY);
  assert.equal(later.allowed, true); assert.equal(later.lockedNow, false);
  assert.equal(later.next.count, 1); assert.equal(later.next.level, 0);
});

await test('refundAttempt: gives one failure back; lifts the lock only when that attempt caused it', () => {
  const row = { count: 3, level: 0, lockedUntil: null, updatedAt: T0, version: 1 };
  assert.equal(refundAttempt(row, { lockedNow: false }, T0, PIN_IP_POLICY).count, 2);
  assert.equal(refundAttempt({ ...row, count: 0 }, { lockedNow: false }, T0, PIN_IP_POLICY), null);
  assert.equal(refundAttempt(null, { lockedNow: false }, T0, PIN_IP_POLICY), null);
  const locked = { count: 0, level: 1, lockedUntil: T0 + 30_000, updatedAt: T0, version: 5 };
  const lifted = refundAttempt(locked, { lockedNow: true, lockedUntil: T0 + 30_000 }, T0 + 1, PIN_IP_POLICY);
  assert.equal(lifted.lockedUntil, null); assert.equal(lifted.level, 0); assert.equal(lifted.count, PIN_IP_POLICY.maxFailures - 1);
  // somebody else's newer lock is not lifted
  const other = refundAttempt(locked, { lockedNow: true, lockedUntil: T0 + 999 }, T0 + 1, PIN_IP_POLICY);
  assert.equal(other, null);
});

await test('beginAttempt: 5 wrong passwords for one employee+IP -> the 5th answers locked, the 6th is refused (even with the right password)', async () => {
  const store = memStore();
  const outcomes = [];
  for (let i = 0; i < 5; i++) {
    const r = await beginAttempt(store, { ip: IP, employeeId: EMP }, T0 + i);
    assert.equal(r.allowed, true);
    outcomes.push(failureOutcome(r.handle));
  }
  assert.deepEqual(outcomes.map((o) => o.locked), [false, false, false, false, true]);
  assert.equal(outcomes[4].retryAfterSec, 30);
  const sixth = await beginAttempt(store, { ip: IP, employeeId: EMP }, T0 + 6000);
  assert.equal(sixth.allowed, false); assert.ok(sixth.retryAfterSec >= 1 && sixth.retryAfterSec <= 30);
  assert.equal(store.rows.get(ipKey(IP)).count, 5, 'a refused attempt does not count against the IP');
  const afterLock = await beginAttempt(store, { ip: IP, employeeId: EMP }, T0 + 4 + 30_001);
  assert.equal(afterLock.allowed, true);
});

await test('beginAttempt: other employees / other IPs are unaffected by one employee+IP lock', async () => {
  const store = memStore();
  for (let i = 0; i < 5; i++) await beginAttempt(store, { ip: IP, employeeId: EMP }, T0 + i);
  assert.equal((await beginAttempt(store, { ip: IP, employeeId: 'other-employee' }, T0 + 10)).allowed, true);
  assert.equal((await beginAttempt(store, { ip: '198.51.100.9', employeeId: EMP }, T0 + 10)).allowed, true);
});

await test('successOutcome: a right password resets the employee counter and refunds the IP reservation', async () => {
  const store = memStore();
  for (let i = 0; i < 4; i++) await beginAttempt(store, { ip: IP, employeeId: EMP }, T0 + i); // 4 wrong
  const ok = await beginAttempt(store, { ip: IP, employeeId: EMP }, T0 + 10); // 5th attempt is the right one
  assert.equal(ok.allowed, true); assert.equal(ok.handle.emp.lockedNow, true); // it reserved the lock...
  await successOutcome(store, ok.handle, T0 + 11); // ...which the success lifts again
  assert.equal(store.rows.has(employeeIpKey(EMP, IP)), false);
  assert.equal(store.rows.get(ipKey(IP)).count, 4); // 5 reservations, 1 refunded = 4 net failures
  assert.equal(store.rows.get(ipKey(IP)).lockedUntil, null);
  for (let i = 0; i < 4; i++) assert.equal((await beginAttempt(store, { ip: IP, employeeId: EMP }, T0 + 20 + i)).allowed, true);
});

await test('per-IP limit: 20 wrong passwords spread over many employees lock the IP; a success never resets it', async () => {
  const store = memStore();
  let lastLock = null;
  for (let i = 0; i < 20; i++) {
    // every 5th attempt the attacker logs in to his own account (success) - must not buy extra guesses
    const guessEmp = `emp-${i}`;
    const r = await beginAttempt(store, { ip: IP, employeeId: guessEmp }, T0 + i);
    assert.equal(r.allowed, true, `attempt ${i + 1} allowed`);
    lastLock = failureOutcome(r.handle);
    if (i % 5 === 4 && i < 19) {
      const mine = await beginAttempt(store, { ip: IP, employeeId: 'mine' }, T0 + i);
      await successOutcome(store, mine.handle, T0 + i);
    }
  }
  assert.equal(lastLock.locked, true); assert.equal(lastLock.retryAfterSec, 30);
  const next = await beginAttempt(store, { ip: IP, employeeId: 'mine' }, T0 + 100);
  assert.equal(next.allowed, false);
});

await test('scan mode (no employeeId) is throttled under the "*" key', async () => {
  const store = memStore();
  assert.equal(employeeIpKey(undefined, IP), `pe:*:${IP}`);
  const res = [];
  for (let i = 0; i < 6; i++) res.push((await beginAttempt(store, { ip: IP, employeeId: null }, T0 + i)).allowed);
  assert.deepEqual(res, [true, true, true, true, true, false]);
});

await test('parallel burst: 60 simultaneous guesses on one key let at most 5 through (CAS, no lost increments)', async () => {
  const store = memStore({ delay: true });
  const results = await Promise.all(Array.from({ length: 60 }, () => beginAttempt(store, { ip: IP, employeeId: EMP }, T0)));
  const allowed = results.filter((r) => r.allowed).length;
  assert.ok(allowed >= 1 && allowed <= 5, `allowed=${allowed}`);
});

await test('parallel burst across two instances sharing the store: the lock still holds', async () => {
  const store = memStore({ delay: true });
  const waves = [];
  for (let wave = 0; wave < 3; wave++) waves.push(Promise.all(Array.from({ length: 10 }, () => beginAttempt(store, { ip: IP, employeeId: EMP }, T0 + wave))));
  const all = (await Promise.all(waves)).flat();
  assert.ok(all.filter((r) => r.allowed).length <= 5);
});

await test('reserveAttempt: contention that never resolves is refused, not waved through', async () => {
  const store = { async load() { return { count: 0, level: 0, lockedUntil: null, updatedAt: T0, version: 1 }; }, async update() { return false; }, async create() { return false; } };
  const r = await reserveAttempt(store, 'k', PIN_EMPLOYEE_POLICY, T0);
  assert.equal(r.allowed, false); assert.equal(r.contended, true);
});

await test('validateVerifyPinBody: types and lengths', () => {
  assert.deepEqual(validateVerifyPinBody({ pin: 'abc', employeeId: EMP, requiredLevel: 'מנהל' }), { ok: true, value: { pin: 'abc', employeeId: EMP } });
  assert.deepEqual(validateVerifyPinBody({ pin: 'abc' }).value, { pin: 'abc', employeeId: null });
  assert.deepEqual(validateVerifyPinBody({ pin: 'abc', employeeId: '' }).value, { pin: 'abc', employeeId: null });
  assert.equal(validateVerifyPinBody({}).ok, false);
  assert.equal(validateVerifyPinBody({ pin: '' }).error, 'לא סופקה סיסמה');
  assert.equal(validateVerifyPinBody(null).ok, false);
  assert.equal(validateVerifyPinBody([]).ok, false);
  assert.equal(validateVerifyPinBody({ pin: 1234 }).ok, false);
  assert.equal(validateVerifyPinBody({ pin: 'x'.repeat(257) }).ok, false);
  assert.equal(validateVerifyPinBody({ pin: 'x'.repeat(256) }).ok, true);
  assert.equal(validateVerifyPinBody({ pin: 'a', employeeId: { contains: '' } }).ok, false);
  assert.equal(validateVerifyPinBody({ pin: 'a', employeeId: 7 }).ok, false);
  assert.equal(validateVerifyPinBody({ pin: 'a', employeeId: ['a'] }).ok, false);
  assert.equal(validateVerifyPinBody({ pin: 'a', employeeId: 'x'.repeat(65) }).ok, false);
  assert.equal(validateVerifyPinBody({ pin: 'a', requiredLevel: { a: 1 } }).ok, false);
  assert.equal(validateVerifyPinBody({ pin: 'a', requiredLevel: 'x'.repeat(101) }).ok, false);
});

await test('keys and client IP: sanitized, bounded, x-forwarded-for first hop', () => {
  const h = (o) => ({ get: (n) => o[n] ?? null });
  assert.equal(clientIpFromHeaders(h({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })), '203.0.113.7');
  assert.equal(clientIpFromHeaders(h({ 'x-vercel-forwarded-for': '198.51.100.2', 'x-forwarded-for': '1.1.1.1' })), '198.51.100.2');
  assert.equal(clientIpFromHeaders(h({})), 'unknown');
  assert.equal(clientIpFromHeaders(null), 'unknown');
  assert.equal(clientIpFromHeaders(h({ 'x-real-ip': "1.2.3.4'; DROP TABLE x;--" })), '1.2.3.4DROPTABLEx--');
  assert.ok(employeeIpKey('a'.repeat(500), 'b'.repeat(500)).length <= 3 + 64 + 1 + 64);
  assert.equal(ipKey(''), 'ip:unknown');
});

await test('retryMessageHe: seconds / minutes / hours', () => {
  assert.match(retryMessageHe(30), /30 שניות/);
  assert.match(retryMessageHe(120), /2 דקות/);
  assert.match(retryMessageHe(1800), /30 דקות/);
  assert.match(retryMessageHe(7200), /2 שעות/);
  assert.match(retryMessageHe(0), /1 שניות/);
});

await test('wiring: verify-pin validates, throttles before bcrypt, answers 429 + Retry-After, keeps the success shape', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(here, '..', 'app', 'api', 'auth', 'verify-pin', 'route.js'), 'utf8');
  const pos = (s) => { const i = src.indexOf(s); assert.ok(i >= 0, `missing: ${s}`); return i; };
  assert.ok(pos('checkAuth()') < pos('validateVerifyPinBody('), 'auth first');
  assert.ok(pos('validateVerifyPinBody(') < pos('guardPinAttempt('), 'validate before the throttle');
  assert.ok(pos('guardPinAttempt(') < pos('prisma.employee.findMany'), 'throttle before the employee lookup');
  assert.ok(pos('guardPinAttempt(') < pos('verifySecret(pin'), 'throttle before bcrypt');
  assert.ok(pos('recordPinSuccess(') > pos('verifySecret(pin'), 'success reset only after a match');
  assert.ok(src.includes('status: 429') && src.includes("'Retry-After'"));
  assert.ok(src.includes('{ success: true, employeeId: employee.id, employeeName, approvalLogged, ...tokenPart }'));
  assert.ok(src.includes('{ success: true, employeeId: employee.id, employeeName, ...tokenPart }'));
});

console.log(failed ? `\n${failed} test(s) FAILED` : '\nall tests passed');
process.exit(failed ? 1 : 0);
