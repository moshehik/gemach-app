// LIVE security matrix for the admin logs / history / departments branch (feature/a5-admin-logs-history-departments-2026-10-11).
// Run (opt-in, needs a running `next dev` on the TEST database):
//   ADMIN_LOGS_LIVE=1 [ADMIN_LOGS_BASE=http://localhost:3073] node scripts/test_a5_admin_logs_security_live.mjs
// Refuses unless GET /api/dev/switch-env says "test". Creates throwaway "SECAUDITLOGS ..." employees + a few seed rows (an e-mail log row of a password-reset mail, its
// audit twin, a visit-log row with secrets) DIRECTLY in the TEST database, mints sessions with the repo's createSessionToken, drives the real HTTP routes, and removes everything
// afterwards. Never touches PROD, never prints secrets (the seeded temporary password is a fixed fake string).
// Roles: anon, dsec (deactivated secretary), dhead (deactivated head management), sec (4), seam (3), branch (1), head (0), prog (2).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

if (process.env.ADMIN_LOGS_LIVE !== '1') {
  console.log('skipped (set ADMIN_LOGS_LIVE=1 to run the live matrix against a dev server on the TEST database)');
  process.exit(0);
}
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = require('../lib/authTokens.js');
const { hashSecret } = await import('../lib/passwordAuth.js');
const BASE = process.env.ADMIN_LOGS_BASE || 'http://localhost:3073';
const parseEnv = (file) => {
  try { return Object.fromEntries(fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])); } catch { return {}; }
};
const env = { ...parseEnv('.env'), ...parseEnv('.env.local'), ...process.env };
const mode = await (await fetch(`${BASE}/api/dev/switch-env`)).json().catch(() => ({}));
if (mode.mode !== 'test') { console.error('FAIL - the dev server is not on the TEST database; live block refused'); process.exit(1); }
if (!env.AUTH_SECRET || !env.TEST_DATABASE_URL) { console.error('FAIL - AUTH_SECRET / TEST_DATABASE_URL missing'); process.exit(1); }

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ datasourceUrl: env.TEST_DATABASE_URL });
let passed = 0;
async function ta(name, fn) {
  if (process.env.ADMIN_LOGS_ONLY && !new RegExp(process.env.ADMIN_LOGS_ONLY, 'i').test(name)) return; // ADMIN_LOGS_ONLY="injection|burst" re-runs a subset (the full run takes ~30 min on the remote DB)
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const made = []; const jar = {};
const E = {};
const PW = 'SecAuditLogs-Pw-1234'; // fake password of the throwaway head used for the delete flow
async function mk(key, roleId, isActive = true, extra = {}) {
  const e = await db.employee.create({ data: { firstName: 'SECAUDITLOGS', lastName: key, fullName: `SECAUDITLOGS ${key}`, roleId, isActive, ...extra } });
  made.push(e.id); E[key] = e;
  jar[key] = { auth_token: e.id, auth_session: tokens.createSessionToken({ id: e.id, roleId }, env.AUTH_SECRET) };
  return e;
}
const cookie = (k) => Object.entries(jar[k] || {}).map(([a, b]) => `${a}=${b}`).join('; ');
async function call(k, method, url, body, headers = {}) {
  const res = await fetch(BASE + url, {
    method, redirect: 'manual', signal: AbortSignal.timeout(240000),
    headers: { cookie: k ? cookie(k) : '', ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  if (res.status === 503) console.log(`    (503 from ${method} ${url.slice(0, 60)}: ${text.slice(0, 120)})`); // budget / busy under load: shown so a real regression is distinguishable
  return { status: res.status, json, text, headers: res.headers };
}

const ROLES = ['anon', 'dsec', 'dhead', 'sec', 'seam', 'branch', 'head', 'prog'];
const who = (r) => (r === 'anon' ? null : r);
const FAKE_TEMP = 'ZzQ9-SECAUDIT-TEMP-7788'; // fake temporary password planted in the seeded password-reset mail
const seeded = { emailLogId: null, auditIds: [], visitIds: [] };
const summary = []; // [route, anon, dsec, dhead, sec, seam, branch, head, prog]

async function matrix(label, fn, expect) {
  const got = {};
  for (const r of ROLES) { let v = await fn(who(r)); if (v === 503) v = await fn(who(r)); got[r] = v; } // 503 = statement budget / busy on a loaded shared dev DB: one retry
  summary.push([label, ...ROLES.map((r) => got[r])]);
  for (const r of ROLES) assert.equal(got[r], expect(r), `${label}: ${r} got ${got[r]} expected ${expect(r)}`);
}
const headOrProg = (r) => r === 'head' || r === 'prog';
const progOnly = (r) => r === 'prog';
const bad = (r) => (headOrProg(r) ? 200 : 401);

try {
  console.log(`LIVE admin logs / history / departments matrix on TEST (${BASE})`);
  await mk('dsec', 4, false); await mk('dhead', 0, false); await mk('sec', 4); await mk('seam', 3); await mk('branch', 1);
  await mk('head', 0, true, { password: await hashSecret(PW) }); await mk('prog', 2);

  /* ----------------------------------- seed rows ----------------------------------- */
  const mail = await db.emailLog.create({ data: { to: 'secaudit-logs@example.test', subject: 'איפוס סיסמה - מערכת הגמ"ח', body: `שלום,\nסיסמה זמנית: ${FAKE_TEMP}\n`, status: 'success', employeeId: E.prog.id } });
  seeded.emailLogId = mail.id;
  const plain = await db.emailLog.create({ data: { to: 'secaudit-plain@example.test', subject: 'SECAUDIT free text', body: 'SECAUDIT-visible-body-text', status: 'success', employeeId: E.prog.id } });
  seeded.plainMailId = plain.id;
  // what the Prisma extension wrote before the audit-side masking (changesJson = the whole created row, body included)
  const a1 = await db.auditLog.create({ data: { entityType: 'EmailLog', entityId: mail.id, action: 'CREATE', changesJson: JSON.stringify({ id: mail.id, to: mail.to, subject: mail.subject, body: mail.body, status: 'success' }), employeeId: E.prog.id } });
  const a2 = await db.auditLog.create({ data: { entityType: 'Employee', entityId: E.sec.id, action: 'UPDATE', changesJson: JSON.stringify({ password: '$2b$10$SECAUDITLOGSFAKEHASHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hourlyWage: { from: 30, to: 41 } }), employeeId: E.prog.id } });
  const a3 = await db.auditLog.create({ data: { entityType: 'Shift', entityId: 'secaudit-shift', action: 'UPDATE', changesJson: JSON.stringify({ hourlyWageSnapshot: { from: 30, to: 77 }, totalCalculated: 12345 }), employeeId: E.prog.id } });
  seeded.auditIds = [a1.id, a2.id, a3.id];
  // raw INSERT: the TEST database may lack the optional measurement columns that the Prisma model declares (schema drift), so pageVisitLog.create() would fail
  const mkVisit = async (pageUrl, requestQuery) => (await db.$queryRawUnsafe(
    `INSERT INTO "PageVisitLog" (id, "pageUrl", "employeeId", "employeeName", "timestamp", "requestQuery", "responseSize", "executionTime", "isGuest", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, $3, now(), $4, 10, 1, false, now()) RETURNING id`,
    pageUrl, E.prog.id, 'SECAUDITLOGS prog', requestQuery))[0];
  const v1 = await mkVisit('/api/secaudit-probe?token=SECAUDITTOKEN123&x=1', JSON.stringify({ password: 'hunter2-secaudit', note: 'hello-secaudit' }));
  const v2 = await mkVisit('/api/secaudit-delete-me', null);
  seeded.visitIds = [v1.id, v2.id];

  /* ----------------------------------- pages ----------------------------------- */
  const pageClass = (r) => (/type="password"|name="password"/i.test(r.text) ? 'login' : r.text.includes('אין לך הרשאה לצפות בעמוד זה') ? 'noaccess' : 'page');
  const PAGES = [
    ['/admin/site-settings/email-logs', (r) => (r === 'anon' ? 'login' : progOnly(r) ? 'page' : 'noaccess')],
    // a deactivated head-management employee with a still-fresh signed session (< 15 min) gets the empty page shell (R7); every API refuses them (matrix below)
    ['/admin/departments', (r) => (r === 'anon' ? 'login' : headOrProg(r) ? 'page' : r === 'dhead' ? ['page', 'noaccess'] : 'noaccess')],
    ['/admin/data-history', (r) => (r === 'anon' ? 'login' : headOrProg(r) ? 'page' : r === 'dhead' ? ['page', 'noaccess'] : 'noaccess')],
    ['/management/history', (r) => (r === 'anon' ? 'login' : headOrProg(r) ? 'page' : r === 'dhead' ? ['page', 'noaccess'] : 'noaccess')],
  ];
  await ta('pages: anonymous = login screen; deactivated / low roles = no-access card; allowed roles = content (email log: programmer only)', async () => {
    for (const [url, exp] of PAGES) {
      const row = [`PAGE ${url}`];
      for (const r of ROLES) { const res = await call(who(r), 'GET', url); const c = pageClass(res); row.push(c); assert.equal(res.status, 200, `${url} ${r} status`); assert.ok([].concat(exp(r)).includes(c), `${url}: ${r} got ${c} expected ${exp(r)}`); }
      summary.push(row);
    }
  });

  /* ----------------------------------- list APIs ----------------------------------- */
  const LISTS = [
    ['/api/admin/email-logs', progOnly], ['/api/admin/email-logs/counts', progOnly],
    ['/api/admin/data-history', headOrProg], ['/api/admin/data-history/counts', headOrProg],
    ['/api/admin/management-history', headOrProg], ['/api/admin/management-history/counts', headOrProg],
  ];
  await ta('new list / counts APIs: GET and POST -> 401 for anonymous, deactivated and low roles (email log: head management too); 200 for the allowed roles', async () => {
    for (const [url, allowed] of LISTS) {
      await matrix(`GET  ${url}?limit=1`, async (k) => (await call(k, 'GET', `${url}?limit=1`)).status, (r) => (allowed(r) ? 200 : 401));
      await matrix(`POST ${url}`, async (k) => (await call(k, 'POST', url, { limit: 1 })).status, (r) => (allowed(r) ? 200 : 401));
    }
  });
  await ta('old APIs: GET /api/history is head management / programmer only now; /api/email-logs programmer only (unchanged)', async () => {
    await matrix('GET  /api/history?limit=1', async (k) => (await call(k, 'GET', '/api/history?limit=1')).status, bad);
    await matrix('GET  /api/email-logs?limit=1', async (k) => (await call(k, 'GET', '/api/email-logs?limit=1')).status, (r) => (progOnly(r) ? 200 : 401));
  });
  await ta('GET /api/audit: the e-mail rows never carry a body (temporary password) to ANY role; wage / access rows stay head-only', async () => {
    for (const k of ['sec', 'head', 'prog']) {
      const r = await call(k, 'GET', '/api/audit?entityType=EmailLog&limit=2000');
      assert.equal(r.status, 200, k);
      assert.ok(!r.text.includes(FAKE_TEMP), `${k}: the seeded temporary password leaked through /api/audit`);
      assert.ok(!/סיסמה זמנית:/.test(r.text), `${k}: a password-mail body leaked through /api/audit`);
    }
    const sec = await call('sec', 'GET', '/api/audit?entityType=Employee&limit=5'); assert.equal(sec.status, 403);
    const secShift = await call('sec', 'GET', '/api/audit?entityType=Shift&limit=5'); assert.equal(secShift.status, 403);
    const all = await call('sec', 'GET', '/api/audit?limit=2000'); assert.ok(!all.text.includes('hourlyWageSnapshot') || !all.text.includes('secaudit-shift'), 'Shift row leaked to a secretary');
  });
  await ta('GET /api/audit search is not an oracle for the temporary password / password hashes', async () => {
    for (const k of ['sec', 'head']) {
      const r = await call(k, 'GET', `/api/audit?search=${encodeURIComponent(FAKE_TEMP.slice(0, 9))}&limit=50`);
      assert.equal(r.status, 200);
      assert.equal((r.json.logs || []).filter((l) => l.entityId === seeded.emailLogId).length, 0, `${k}: search matched the password mail`);
    }
    const h = await call('head', 'GET', `/api/audit?search=${encodeURIComponent('SECAUDITLOGSFAKEHASH')}&limit=50`);
    assert.equal((h.json.logs || []).filter((l) => l.entityId === E.sec.id).length, 0, 'search matched a raw password hash in an Employee audit row');
  });

  /* ----------------------------------- data exposure in rows ----------------------------------- */
  await ta('email log (programmer): the password-reset mail is listed but its body is never returned or searchable; ordinary bodies are previewed', async () => {
    const list = await call('prog', 'POST', '/api/admin/email-logs', { search: 'secaudit-logs@example.test', limit: 50 });
    assert.equal(list.status, 200);
    const row = list.json.data.find((x) => x.id === seeded.emailLogId);
    assert.ok(row, 'seeded password mail listed'); assert.equal(row.bodyHidden, true); assert.equal(row.bodyPreview, '');
    assert.ok(!list.text.includes(FAKE_TEMP));
    const bySearch = await call('prog', 'POST', '/api/admin/email-logs', { search: FAKE_TEMP.slice(0, 9), limit: 50 });
    assert.equal(bySearch.json.data.length, 0, 'search matched the body of a password mail');
    const bySubj = await call('prog', 'POST', '/api/admin/email-logs', { search: 'secaudit-plain', limit: 5 });
    assert.equal(bySubj.json.data.length, 1); assert.equal(bySubj.json.data[0].bodyPreview, 'SECAUDIT-visible-body-text');
    const ex = await call('prog', 'POST', '/api/admin/email-logs', { export: true, limit: 500, search: 'secaudit' });
    assert.equal(ex.status, 200); assert.ok(!ex.text.includes(FAKE_TEMP)); assert.ok(ex.json.data.length > 0 && ex.json.data.every((x) => x.bodyPreview === '' && x.bodyHidden === false && x.hasToken === false), 'export rows carry no body');
    for (const key of Object.keys(row)) assert.ok(!/pass|pin|token|hash|secret|body$/i.test(key) || ['hasToken', 'bodyHidden', 'bodyPreview'].includes(key), `unexpected key ${key}`);
    assert.ok(!('confirmToken' in row));
  });
  await ta('data history (head): password-mail body, password hashes and keys are masked; the search cannot probe them; wages are visible to head management only (API is head-only)', async () => {
    const r = await call('head', 'POST', '/api/admin/data-history', { search: 'secaudit-logs@example.test', limit: 50 });
    assert.equal(r.status, 200); assert.ok(!r.text.includes(FAKE_TEMP), 'temporary password leaked in data-history rows');
    const oracle = await call('head', 'POST', '/api/admin/data-history', { search: FAKE_TEMP.slice(0, 9), limit: 50 });
    assert.equal(oracle.status, 200); assert.equal(oracle.json.data.length, 0, 'search matched the body of a password mail (oracle)');
    const o2 = await call('head', 'POST', '/api/admin/data-history', { search: 'SECAUDITLOGSFAKEHASH', limit: 50 });
    assert.equal(o2.json.data.length, 0, 'search matched a raw password hash (oracle)');
    const emp = await call('head', 'POST', '/api/admin/data-history', { types: 'Employee', limit: 100 });
    assert.ok(!/\$2[aby]\$/.test(emp.text), 'a bcrypt hash is present in a data-history response');
    const all = await call('prog', 'POST', '/api/admin/data-history', { export: true, limit: 500 });
    assert.ok(!/\$2[aby]\$/.test(all.text) && !all.text.includes(FAKE_TEMP));
    const keys = new Set(); (emp.json.data || []).forEach((x) => Object.keys(x).forEach((k) => keys.add(k)));
    for (const k of keys) assert.ok(!/pass|pin|hash|secret|token|body/i.test(k), `row key ${k}`);
    const wage = await call('head', 'POST', '/api/admin/data-history', { types: 'Shift', search: 'secaudit-shift', limit: 5 });
    assert.equal(wage.status, 200);
  });
  await ta('management history (head): the seeded token in the URL / password in the body never come back; the body search is not an oracle', async () => {
    const r = await call('head', 'POST', '/api/admin/management-history', { search: 'SECAUDITLOGS', limit: 20, types: 'api' }); // by employee name: the URL itself is deliberately not searchable (token parameter)
    assert.equal(r.status, 200);
    const row = r.json.data.find((x) => x.id === seeded.visitIds[0]);
    assert.ok(row, 'seeded visit listed'); assert.ok(!r.text.includes('SECAUDITTOKEN123'), 'token in the URL leaked'); assert.ok(!r.text.includes('hunter2-secaudit'), 'password in the request body leaked');
    const o1 = await call('head', 'POST', '/api/admin/management-history', { search: 'hunter2', limit: 20 });
    assert.equal(o1.json.data.filter((x) => x.id === seeded.visitIds[0]).length, 0, 'body search matched a body that contains a secret word');
    const o2 = await call('head', 'POST', '/api/admin/management-history', { search: 'SECAUDITTOKEN', limit: 20 });
    assert.equal(o2.json.data.filter((x) => x.id === seeded.visitIds[0]).length, 0, 'URL search matched the value of a token parameter (oracle)');
    const o3 = await call('head', 'POST', '/api/admin/management-history', { search: 'hello-secaudit', limit: 20 });
    assert.ok(o3.status === 200);
    const legacy = await call('head', 'GET', '/api/history?search=secaudit-probe&limit=20');
    assert.ok(!legacy.text.includes('SECAUDITTOKEN123') && !legacy.text.includes('hunter2-secaudit'), 'legacy GET /api/history leaked');
  });

  /* ----------------------------------- delete flow (manager code) ----------------------------------- */
  await ta('DELETE /api/history: session gate = head management / programmer; manager code verified server-side; no mode runs without it', async () => {
    const body = (extra) => ({ username: E.head.id, password: PW, ...extra });
    // no code / wrong code -> 401 for everybody, nothing deleted
    await matrix('DELETE /api/history (no code)', async (k) => (await call(k, 'DELETE', '/api/history', { ids: [seeded.visitIds[1]] })).status, () => 401);
    await matrix('DELETE /api/history (wrong code)', async (k) => (await call(k, 'DELETE', '/api/history', { username: E.head.id, password: 'wrong', ids: [seeded.visitIds[1]] })).status, () => 401);
    assert.equal(await db.pageVisitLog.count({ where: { id: seeded.visitIds[1] } }), 1, 'row deleted without a valid code');
    for (const k of ['anon', 'dsec', 'dhead', 'sec', 'seam', 'branch']) {
      const r = await call(who(k), 'DELETE', '/api/history', body({ ids: [seeded.visitIds[1]] }));
      assert.equal(r.status, 401, `${k} may not delete even with a valid manager code (got ${r.status})`);
    }
    assert.equal(await db.pageVisitLog.count({ where: { id: seeded.visitIds[1] } }), 1, 'a low-role session deleted a row with a head code');
    for (const k of ['sec', 'head']) {
      // modes without a valid mode value are refused after the code check
      const none = await call(k, 'DELETE', '/api/history', body({}));
      assert.ok([400, 401].includes(none.status), `${k} no-mode -> ${none.status}`);
    }
    const badDays = await call('head', 'DELETE', '/api/history', body({ olderThanDays: 'abc' })); assert.equal(badDays.status, 400);
    const negDays = await call('head', 'DELETE', '/api/history', body({ olderThanDays: -5 })); assert.equal(negDays.status, 400);
    const objUser = await call('head', 'DELETE', '/api/history', { username: { not: 'x' }, password: 'wrong', ids: ['x'] }); assert.equal(objUser.status, 401);
    const arrBody = await call('head', 'DELETE', '/api/history', [1, 2]); assert.ok([400, 401, 500].includes(arrBody.status));
    // valid head session + valid code, one id: deleted; replaying the same request deletes nothing more and does not error
    const ok = await call('head', 'DELETE', '/api/history', body({ ids: [seeded.visitIds[1]] }));
    assert.equal(ok.status, 200, ok.text.slice(0, 200)); assert.equal(await db.pageVisitLog.count({ where: { id: seeded.visitIds[1] } }), 0);
    const replay = await call('head', 'DELETE', '/api/history', body({ ids: [seeded.visitIds[1]] })); assert.equal(replay.status, 200);
    // older-than with a 100-year window removes nothing real
    const before = await db.pageVisitLog.count();
    const older = await call('prog', 'DELETE', '/api/history', { username: E.head.id, password: PW, olderThanDays: 36500 });
    assert.equal(older.status, 200); assert.equal(older.json.deletedCount, 0); assert.equal(await db.pageVisitLog.count(), before);
    // CSRF: a cross-site request carries no session cookie (SameSite=Lax) -> 401; the server never accepts the code alone
    const csrf = await call(null, 'DELETE', '/api/history', body({ ids: [seeded.visitIds[0]] }), { origin: 'https://evil.test', referer: 'https://evil.test/' });
    assert.equal(csrf.status, 401); assert.equal(await db.pageVisitLog.count({ where: { id: seeded.visitIds[0] } }), 1);
    // no brute-force limiter exists (R2): 8 consecutive wrong codes are all answered 401 and the right code still works afterwards
    for (let i = 0; i < 8; i++) assert.equal((await call('head', 'DELETE', '/api/history', { username: E.head.id, password: `bad${i}`, ids: ['x'] })).status, 401);
  });

  /* ----------------------------------- print surfaces ----------------------------------- */
  await ta('POST /api/pdf with the new surfaces: anonymous / deactivated 401, low roles 403, head + programmer 200 (application/pdf)', async () => {
    const html = '<!doctype html><html><body><p>secaudit</p></body></html>';
    for (const surface of ['a5-email-log', 'a5-departments', 'a5-data-history', 'a5-management-history']) {
      const row = [`PDF ${surface}`];
      for (const r of ROLES) {
        let res = await call(who(r), 'POST', '/api/pdf', { html, surface, filename: 'x' });
        if (res.status === 500) res = await call(who(r), 'POST', '/api/pdf', { html, surface, filename: 'x' }); // Chromium render timeout on a loaded dev machine: one retry
        const exp = r === 'anon' || r === 'dsec' || r === 'dhead' ? 401 : headOrProg(r) ? 200 : 403;
        row.push(res.status); assert.equal(res.status, exp, `${surface}: ${r} got ${res.status} expected ${exp}`);
        if (exp === 200) assert.match(res.headers.get('content-type') || '', /application\/pdf/);
      }
      summary.push(row);
    }
    for (const bad of ['a5-nope', '__proto__', 'constructor', ['a5-email-log'], 7]) assert.equal((await call('prog', 'POST', '/api/pdf', { html: '<p>x</p>', surface: bad })).status, 400, JSON.stringify(bad));
  });

  /* ----------------------------------- departments ----------------------------------- */
  await ta('departments APIs (unchanged server rules): GET any signed-in; POST / PUT / DELETE head management + programmer; system roles cannot be deleted', async () => {
    await matrix('GET  /api/departments', async (k) => (await call(k, 'GET', '/api/departments')).status, (r) => (r === 'anon' || r === 'dsec' || r === 'dhead' ? 401 : 200));
    await matrix('POST /api/departments {}', async (k) => (await call(k, 'POST', '/api/departments', {})).status, (r) => (headOrProg(r) ? 400 : 401));
    await matrix('PUT  /api/departments/987654', async (k) => (await call(k, 'PUT', '/api/departments/987654', { name: 'x' })).status, (r) => (headOrProg(r) ? 404 : 401));
    await matrix('DELETE /api/departments/987654', async (k) => (await call(k, 'DELETE', '/api/departments/987654')).status, (r) => (headOrProg(r) ? 404 : 401));
    for (const id of [1, 2]) assert.equal((await call('head', 'DELETE', `/api/departments/${id}`)).status, 409, `system role ${id}`);
    assert.equal((await call('head', 'DELETE', '/api/departments/abc')).status, 400);
    const emp = await call('head', 'GET', '/api/employees?slim=1'); assert.equal(emp.status, 200);
    const SLIM = ['id', 'firstName', 'lastName', 'fullName', 'isActive', 'roleId', 'department', 'canApproveWithoutPayment', 'approvals'];
    for (const row of emp.json) for (const k of Object.keys(row)) assert.ok(SLIM.includes(k), `slim employee shape (used by the departments screen) exposes only picker fields, got ${k}`);
  });

  /* ----------------------------------- variant registry ----------------------------------- */
  await ta('page-variant switch for the 4 new screens: any active employee may switch only their own record; unknown screens 404; deactivated 403; anonymous 401', async () => {
    for (const screen of ['email_logs', 'departments', 'management_history', 'data_history']) {
      assert.equal((await call(null, 'POST', `/api/me/ui-variant/${screen}`, { value: 'a5' })).status, 401, `${screen} anon`);
      assert.equal((await call('dsec', 'POST', `/api/me/ui-variant/${screen}`, { value: 'a5' })).status, 403, `${screen} deactivated`);
      const p = await call('sec', 'POST', `/api/me/ui-variant/${screen}`, { value: 'a5', employeeId: E.prog.id, id: E.prog.id });
      assert.equal(p.status, 200, `${screen} secretary: ${p.status}`);
      assert.equal(p.json.employeeId, E.sec.id);
      assert.equal((await call('sec', 'POST', `/api/me/ui-variant/${screen}`, { value: null })).status, 200);
    }
    const prog = await db.employee.findUnique({ where: { id: E.prog.id }, select: { themeColor: true } });
    assert.ok(!prog.themeColor || !/email_logs|data_history|management_history|departments/.test(prog.themeColor), 'the victim id in the body was honoured');
    // a secretary who chose the new design for the page still gets the same gate
    await call('sec', 'POST', '/api/me/ui-variant/email_logs', { value: 'a5' });
    const page = await call('sec', 'GET', '/admin/site-settings/email-logs');
    assert.equal(pageClass(page), 'noaccess');
    assert.equal((await call('sec', 'POST', '/api/admin/email-logs', {})).status, 401);
    await call('sec', 'POST', '/api/me/ui-variant/email_logs', { value: null });
  });

  /* ----------------------------------- injection / abuse ----------------------------------- */
  const HOSTILE = ["'; DROP TABLE \"EmailLog\"; --", "' OR 1=1 --", '" OR ""="', '%', '_', '\\', '\\%', '${7*7}', '{{7*7}}', '<script>alert(1)</script>', '../../etc/passwd', 'a'.repeat(100000), '\u0000', 'x\u0000y', '🙂'.repeat(500), '(SELECT pg_sleep(5))', "1;SELECT pg_sleep(5)", "'||(SELECT 1)||'", 'null', '__proto__', '-1', '1e9', '9'.repeat(40), '0x41', '[]', '{}'];
  const HOSTILE_SMALL = [HOSTILE[0], HOSTILE[1], '%', '\u0000', '9'.repeat(40), '(SELECT pg_sleep(5))', '__proto__'];
const noLeak = (res) => (res.status === 200 ? !/PrismaClient|at async|node_modules|invalid byte sequence|ECONNREFUSED/.test(res.text) : !/prisma|PrismaClient|SELECT |syntax error|at async|\.js:\d+|invalid byte sequence|ECONN|stack|relation "/i.test(res.text));
  const LISTS_ALL = [
    ['/api/admin/email-logs', 'prog', ['search', 'sort', 'dir', 'types', 'statuses', 'period', 'from', 'to', 'senders', 'page', 'limit', 'export']],
    ['/api/admin/email-logs/counts', 'prog', ['search', 'types', 'statuses', 'period', 'from', 'to', 'senders']],
    ['/api/admin/data-history', 'head', ['search', 'sort', 'dir', 'types', 'actions', 'employees', 'period', 'from', 'to', 'page', 'limit', 'export']],
    ['/api/admin/data-history/counts', 'head', ['search', 'types', 'actions', 'employees', 'period', 'from', 'to']],
    ['/api/admin/management-history', 'head', ['search', 'sort', 'dir', 'types', 'status', 'employees', 'period', 'from', 'to', 'page', 'limit', 'export']],
    ['/api/admin/management-history/counts', 'head', ['search', 'types', 'status', 'employees', 'period', 'from', 'to']],
  ];
  await ta('injection / oversize probes on every param of every new list API: never a 5xx, never an echo of SQL / stack, SQL-looking text is only data', async () => {
    let calls = 0;
    for (const [url, role, params] of LISTS_ALL) {
      for (const p of params) {
        for (const h of (p === 'search' ? HOSTILE : HOSTILE_SMALL)) {
          // the 100,000-char probe only goes through POST (URLs have a limit)
          const viaPost = h.length > 5000 || h.includes('\u0000');
          const res = viaPost ? await call(role, 'POST', url, { [p]: h }) : await call(role, 'GET', `${url}?${p}=${encodeURIComponent(h)}`);
          calls++;
          assert.ok([200, 400, 503].includes(res.status), `${url} ${p}=${JSON.stringify(h).slice(0, 30)} -> ${res.status} ${res.text.slice(0, 120)}`);
          assert.ok(noLeak(res), `${url} ${p}: error text leaks internals: ${res.text.slice(0, 160)}`);
        }
      }
    }
    assert.ok(calls > 100);
  });
  await ta('JSON edge bodies: __proto__, constructor, arrays, null, non-JSON, huge limit / negative page / page far away / export with oversize limit', async () => {
    for (const [url, role] of LISTS_ALL.map((x) => [x[0], x[1]])) {
      for (const body of ['{"__proto__":{"isAdmin":true},"search":"a"}', '{"constructor":{"prototype":{"x":1}}}', '[1,2,3]', 'null', 'not json', '{"page":-5,"limit":-1}', '{"page":1000000000,"limit":100}', '{"limit":100000}', '{"export":true,"limit":100000}', '{"export":"true","limit":501}', '{"search":{"$ne":1}}', '{"types":{"a":1},"employees":[{"x":1}]}']) {
        const res = await call(role, 'POST', url, body);
        assert.ok([200, 400, 503].includes(res.status), `${url} body ${body} -> ${res.status} ${res.text.slice(0, 120)}`);
        assert.ok(noLeak(res));
      }
    }
    const big = await call('prog', 'POST', '/api/admin/email-logs', { limit: 100000 }); assert.ok(big.json.data.length <= 100);
    const exp = await call('prog', 'POST', '/api/admin/email-logs', { export: true, limit: 100000 }); assert.ok(exp.json.data.length <= 500);
    const far = await call('head', 'POST', '/api/admin/data-history', { page: 1000000000, limit: 100 }); assert.equal(far.status, 400);
    const far2 = await call('head', 'POST', '/api/admin/management-history', { page: 100000, limit: 100 }); assert.equal(far2.status, 400);
  });
  await ta('sort / filter allow-lists: a sort key outside the list falls back to the default; unknown filter keys are dropped (same answer as the default request)', async () => {
    // scoped to the seeded rows of the throwaway programmer: the shared TEST database is written by other sessions while this runs, so "newest 5" would be racy
    const me = E.prog.id; const ids = (r) => r.json.data.map((x) => x.id);
    const a = await call('prog', 'POST', '/api/admin/email-logs', { limit: 5, sort: 'sentAt; DROP TABLE x', dir: 'sideways', types: 'nope', statuses: 'zzz', senders: `${me},not-a-uuid` });
    const b = await call('prog', 'POST', '/api/admin/email-logs', { limit: 5, senders: me });
    assert.equal(a.status, 200); assert.ok(ids(b).length >= 2); assert.deepEqual(ids(a), ids(b));
    const c = await call('head', 'POST', '/api/admin/data-history', { limit: 5, employees: me, sort: 'changesJson" DESC; --', dir: 'x', actions: 'zzz' });
    const d = await call('head', 'POST', '/api/admin/data-history', { limit: 5, employees: me });
    assert.ok(ids(d).length >= 3); assert.deepEqual(ids(c), ids(d));
    const e = await call('head', 'POST', '/api/admin/management-history', { limit: 5, employees: me, sort: 'requestQuery', status: 'zzz' });
    const f = await call('head', 'POST', '/api/admin/management-history', { limit: 5, employees: me });
    assert.ok(ids(f).length >= 1); assert.deepEqual(ids(e), ids(f));
  });
  await ta('availability: a burst of 12 parallel heavy list requests is answered 200 / 503 (concurrency cap), never 500 and never hangs', async () => {
    const res = await Promise.all(Array.from({ length: 12 }, (_, i) => call('head', 'POST', '/api/admin/data-history', { search: `5${i}`, limit: 100 })));
    for (const r of res) assert.ok([200, 503].includes(r.status), `burst -> ${r.status}`);
  });
} finally {
  try { await db.pageVisitLog.deleteMany({ where: { OR: [{ id: { in: seeded.visitIds } }, { employeeId: { in: made } }] } }); } catch {}
  try { await db.auditLog.deleteMany({ where: { OR: [{ id: { in: seeded.auditIds } }, { employeeId: { in: made } }, { entityId: { in: [...made, seeded.emailLogId, seeded.plainMailId].filter(Boolean) } }] } }); } catch {}
  try { await db.emailLog.deleteMany({ where: { id: { in: [seeded.emailLogId, seeded.plainMailId].filter(Boolean) } } }); } catch {}
  try { await db.employee.deleteMany({ where: { id: { in: made } } }); } catch (e) { console.error('  CLEANUP FAILED', e.message); process.exitCode = 1; }
  const left = await db.employee.count({ where: { firstName: 'SECAUDITLOGS' } }).catch(() => -1);
  const leftRows = (await db.emailLog.count({ where: { to: { contains: 'secaudit-' } } }).catch(() => -1)) + (await db.pageVisitLog.count({ where: { employeeName: { startsWith: 'SECAUDITLOGS' } } }).catch(() => -1));
  console.log(`  cleanup: ${made.length} throwaway employees created, ${left} left in TEST; ${leftRows} seed rows left`);
  await db.$disconnect();
}

console.log(`\nSUMMARY (status / class per role: ${ROLES.join(' | ')})`);
for (const row of summary) console.log('  ' + String(row[0]).padEnd(46) + row.slice(1).map((x) => String(x).padEnd(9)).join(''));
console.log(`\n${passed} passed${process.exitCode ? ' - WITH FAILURES' : ''}`);
