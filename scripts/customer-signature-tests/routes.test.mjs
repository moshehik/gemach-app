// Behavioural test of the REAL app/api/customers/[id]/route.js (PUT) and app/api/customers/route.js (POST) against an in-memory
// prisma + auth shim (scripts/customer-signature-tests/shims). No DB, no network.
//  - the signature timestamp is computed by the SERVER (a forged regulationsSignedAt in the body is never stored)
//  - only the new card (cardVariant:'a5') can write the flag; the old card (whole-object PUT, stale flag) cannot
//  - one history entry ("חתימה על התקנון"), none when nothing changed; un-signing keeps the timestamp (revoked marker)
//  - auth is enforced; a client/DB without the columns answers 503 instead of pretending to save
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(`${process.env.PROJ}/${rel}`).href);
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const idRoute = await L('app/api/customers/[id]/route.js');
const listRoute = await L('app/api/customers/route.js');

const OLD_AT = new Date('2026-03-01T10:00:00.000Z');
const baseRow = (over = {}) => ({
  id: 'c1', legacyId: 5, firstName: 'רחל', lastName: 'כהן', phone1: '0501234567', phone2: null, email: null, emailSuffix: null, city: null, street: null,
  houseNum: null, notes: null, bankName: null, bankBranch: null, bankAccount: null, bankAccountName: null, zeout: null, marketingConsent: false,
  isDeleted: false, hasSignedRegulations: false, regulationsSignedAt: null, updatedAt: new Date('2026-01-01T00:00:00.000Z'), ...over,
});
const body = (over = {}) => ({ cardVariant: 'a5', firstName: 'רחל', lastName: 'כהן', phone1: '0501234567', houseNum: '', ...over });

beforeEach(() => {
  globalThis.__CUSTOMERS = [baseRow()];
  globalThis.__SETTINGS = [];
  globalThis.__AUDIT = [];
  globalThis.__CALLS = [];
  globalThis.__AUTH = true;
  invalidateSettingsCache();
});

const put = async (b, id = 'c1') => {
  const res = await idRoute.PUT(new Request(`http://t.local/api/customers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }), { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
};
const post = async (b) => {
  b = { email: 'new@example.com', ...b }; // mandatory_field_groups default (phone2 / email) on creation
  const res = await listRoute.POST(new Request('http://t.local/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }));
  return { status: res.status, body: await res.json() };
};
const row = (id = 'c1') => globalThis.__CUSTOMERS.find((c) => c.id === id);
const auditFor = (id = 'c1') => globalThis.__AUDIT.filter((a) => a.entityId === id);

test('PUT a5: signing sets the flag + a SERVER timestamp; a forged regulationsSignedAt in the body is ignored', async () => {
  const t0 = Date.now();
  const r = await put(body({ signatureEdit: true, hasSignedRegulations: true, regulationsSignedAt: '1999-01-01T00:00:00.000Z' }));
  const t1 = Date.now();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(row().hasSignedRegulations, true);
  assert.ok(row().regulationsSignedAt instanceof Date, 'stored as a Date computed by the server');
  assert.ok(row().regulationsSignedAt.getTime() >= t0 && row().regulationsSignedAt.getTime() <= t1, 'server "now", not the client value');
  assert.notEqual(row().regulationsSignedAt.getFullYear(), 1999);
});

test('PUT a5: signing writes ONE history entry (only the flag - no separate row for the timestamp)', async () => {
  await put(body({ signatureEdit: true, hasSignedRegulations: true }));
  const rows = auditFor();
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0].changes), ['hasSignedRegulations']);
  assert.deepEqual(rows[0].changes.hasSignedRegulations, { from: false, to: true });
  assert.equal(rows[0].action, 'UPDATE');
});

test('PUT a5: un-signing clears the flag, keeps the stored timestamp as the "revoked" marker, one history entry', async () => {
  globalThis.__CUSTOMERS = [baseRow({ hasSignedRegulations: true, regulationsSignedAt: OLD_AT })];
  const r = await put(body({ signatureEdit: true, hasSignedRegulations: false, regulationsSignedAt: null }));
  assert.equal(r.status, 200);
  assert.equal(row().hasSignedRegulations, false);
  assert.equal(row().regulationsSignedAt.getTime(), OLD_AT.getTime(), 'timestamp untouched (also never taken from the body)');
  assert.deepEqual(auditFor().map((a) => a.changes.hasSignedRegulations), [{ from: true, to: false }]);
});

test('PUT a5: same value (already signed, flag true again) changes nothing - timestamp kept, no signature history row', async () => {
  globalThis.__CUSTOMERS = [baseRow({ hasSignedRegulations: true, regulationsSignedAt: OLD_AT })];
  const r = await put(body({ signatureEdit: true, hasSignedRegulations: true, regulationsSignedAt: '2030-01-01T00:00:00.000Z' }));
  assert.equal(r.status, 200);
  assert.equal(row().regulationsSignedAt.getTime(), OLD_AT.getTime());
  assert.ok(!auditFor().some((a) => 'hasSignedRegulations' in a.changes || 'regulationsSignedAt' in a.changes));
  const upd = globalThis.__CALLS.find((c) => c.op === 'customer.update');
  assert.ok(!('regulationsSignedAt' in upd.args.data) && !('hasSignedRegulations' in upd.args.data), 'neither signature field is in the write');
});

test('PUT a5: flag not sent (partial body) leaves the signature alone', async () => {
  globalThis.__CUSTOMERS = [baseRow({ hasSignedRegulations: true, regulationsSignedAt: OLD_AT })];
  const r = await put(body({ firstName: 'שרה' }));
  assert.equal(r.status, 200);
  assert.equal(row().firstName, 'שרה');
  assert.equal(row().hasSignedRegulations, true);
  assert.equal(row().regulationsSignedAt.getTime(), OLD_AT.getTime());
  assert.deepEqual(Object.keys(auditFor()[0].changes), ['firstName']);
});

test('PUT a5: signing together with another field edit = one history row carrying both changes', async () => {
  await put(body({ city: 'בית שמש', signatureEdit: true, hasSignedRegulations: true }));
  const rows = auditFor();
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0].changes).sort(), ['city', 'hasSignedRegulations']);
});

test('PUT without cardVariant (old card sends the WHOLE customer incl. a stale flag): the flag is NOT written', async () => {
  const legacyBody = { ...body(), hasSignedRegulations: true, regulationsSignedAt: '2026-05-05T00:00:00.000Z' };
  delete legacyBody.cardVariant;
  const r = await put(legacyBody);
  assert.equal(r.status, 200);
  assert.equal(row().hasSignedRegulations, false);
  assert.equal(row().regulationsSignedAt, null);
  assert.ok(!auditFor().some((a) => 'hasSignedRegulations' in a.changes));
});

test('PUT a5: a non-boolean flag is a 400 (nothing guessed, nothing written)', async () => {
  for (const bad of ['true', 1, 0, null, {}]) {
    const r = await put(body({ signatureEdit: true, hasSignedRegulations: bad }));
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
  assert.equal(row().hasSignedRegulations, false);
  assert.ok(!globalThis.__CALLS.some((c) => c.op === 'customer.update'));
});

test('PUT a5: a row without the columns (old client / DB) -> 503 SIGNATURE_UNAVAILABLE when the flag is sent, normal save when it is not', async () => {
  const bare = baseRow();
  delete bare.hasSignedRegulations;
  delete bare.regulationsSignedAt;
  globalThis.__CUSTOMERS = [bare];
  let r = await put(body({ signatureEdit: true, hasSignedRegulations: true }));
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'SIGNATURE_UNAVAILABLE');
  assert.ok(!globalThis.__CALLS.some((c) => c.op === 'customer.update'));
  r = await put(body({ firstName: 'דינה' }));
  assert.equal(r.status, 200);
  assert.equal(row().firstName, 'דינה');
});

test('PUT: unauthenticated -> 401 and no write; deleted customer -> 409 and no write; unknown -> 404', async () => {
  globalThis.__AUTH = false;
  assert.equal((await put(body({ signatureEdit: true, hasSignedRegulations: true }))).status, 401);
  globalThis.__AUTH = true;
  globalThis.__CUSTOMERS = [baseRow({ isDeleted: true })];
  assert.equal((await put(body({ signatureEdit: true, hasSignedRegulations: true }))).status, 409);
  assert.equal((await put(body({ signatureEdit: true, hasSignedRegulations: true }), 'nope')).status, 404);
  assert.ok(!globalThis.__CALLS.some((c) => c.op === 'customer.update'));
  assert.equal(globalThis.__CUSTOMERS[0].hasSignedRegulations, false);
});

test('PUT a5: a 409 data collision (stale updatedAt) blocks the signature write too', async () => {
  globalThis.__CUSTOMERS = [baseRow({ updatedAt: new Date('2026-06-01T00:00:00.000Z') })];
  const r = await put(body({ signatureEdit: true, hasSignedRegulations: true, updatedAt: '2026-01-01T00:00:00.000Z' }));
  assert.equal(r.status, 409);
  assert.equal(row().hasSignedRegulations, false);
});

test('POST a5: creating a customer already signed stores the flag + a server timestamp (client timestamp ignored)', async () => {
  const t0 = Date.now();
  const r = await post(body({ signatureEdit: true, hasSignedRegulations: true, regulationsSignedAt: '1999-01-01T00:00:00.000Z' }));
  const t1 = Date.now();
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const created = globalThis.__CUSTOMERS.find((c) => c.id !== 'c1');
  assert.equal(created.hasSignedRegulations, true);
  assert.ok(created.regulationsSignedAt.getTime() >= t0 && created.regulationsSignedAt.getTime() <= t1);
});

test('POST a5 without the flag / POST without cardVariant: stored unsigned, no timestamp', async () => {
  await post(body());
  const legacy = body({ firstName: 'לאה', signatureEdit: true, hasSignedRegulations: true, regulationsSignedAt: '2026-01-01T00:00:00.000Z' });
  delete legacy.cardVariant;
  await post(legacy);
  const created = globalThis.__CUSTOMERS.filter((c) => c.id !== 'c1');
  assert.equal(created.length, 2);
  for (const c of created) assert.deepEqual([c.hasSignedRegulations, c.regulationsSignedAt], [false, null]);
});

test('POST a5: a non-boolean flag is a 400 and creates nothing', async () => {
  const r = await post(body({ signatureEdit: true, hasSignedRegulations: 'yes' }));
  assert.equal(r.status, 400);
  assert.equal(globalThis.__CUSTOMERS.length, 1);
});

test('POST: unauthenticated -> 401', async () => {
  globalThis.__AUTH = false;
  assert.equal((await post(body({ signatureEdit: true, hasSignedRegulations: true }))).status, 401);
  assert.equal(globalThis.__CUSTOMERS.length, 1);
});

// ---- A1 (review): a stale card must never silently cancel (or set) a signature ----
test('PUT a5 whole-object save with a STALE flag and NO signatureEdit marker (e.g. stale false after the backfill signed the customer): the stored signature is untouched', async () => {
  globalThis.__CUSTOMERS = [baseRow({ hasSignedRegulations: true, regulationsSignedAt: OLD_AT, updatedAt: new Date('2026-01-01T00:00:00.000Z') })];
  // matching updatedAt: the 409 check cannot catch it (the backfill is raw SQL and does not bump updatedAt)
  const r = await put(body({ hasSignedRegulations: false, regulationsSignedAt: null, firstName: 'שרה', updatedAt: '2026-01-01T00:00:00.000Z' }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(row().firstName, 'שרה', 'the unrelated edit is saved');
  assert.equal(row().hasSignedRegulations, true, 'the stale false is ignored');
  assert.equal(row().regulationsSignedAt.getTime(), OLD_AT.getTime());
  assert.ok(!auditFor().some((a) => 'hasSignedRegulations' in a.changes), 'no "signature: yes -> no" history row');
});

test('PUT a5: a stale TRUE without the marker does not sign an unsigned customer either', async () => {
  const r = await put(body({ hasSignedRegulations: true, regulationsSignedAt: '2026-05-05T00:00:00.000Z' }));
  assert.equal(r.status, 200);
  assert.equal(row().hasSignedRegulations, false);
  assert.equal(row().regulationsSignedAt, null);
});

test('PUT: the marker alone is not enough - it needs cardVariant a5 and must be exactly true; with it only the explicit flag is honoured', async () => {
  const noVariant = { ...body({ signatureEdit: true, hasSignedRegulations: true }) };
  delete noVariant.cardVariant;
  assert.equal((await put(noVariant)).status, 200);
  assert.equal(row().hasSignedRegulations, false, 'no cardVariant -> ignored');
  for (const m of ['true', 1, 'yes']) {
    assert.equal((await put(body({ signatureEdit: m, hasSignedRegulations: true }))).status, 200);
    assert.equal(row().hasSignedRegulations, false, `marker ${JSON.stringify(m)} is not true`);
  }
  assert.equal((await put(body({ signatureEdit: true, hasSignedRegulations: true }))).status, 200);
  assert.equal(row().hasSignedRegulations, true);
});

test('PUT a5: a non-boolean flag WITHOUT the marker is simply ignored (200), WITH the marker it is a 400', async () => {
  assert.equal((await put(body({ hasSignedRegulations: 'yes' }))).status, 200);
  assert.equal((await put(body({ signatureEdit: true, hasSignedRegulations: 'yes' }))).status, 400);
});
