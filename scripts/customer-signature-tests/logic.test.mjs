// Pure / mocked tests for the customer-signature flip: card state derivation (stored signature + fallback to orders),
// the draft/changes rail, the server-side plan, the sync-from-orders helper (mock prisma), and static guards on the order route,
// the card wiring and the history labels. No DB, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = process.env.PROJ;
const L = (rel) => import(pathToFileURL(`${ROOT}/${rel}`).href);
const read = (rel) => readFileSync(`${ROOT}/${rel}`, 'utf8').replace(/\r\n/g, '\n');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const logic = await L('app/components/customer-card/customerCardLogic.js');
const sig = await L('lib/customerSignature.js');
const labels = await L('lib/history/labels.js');

const AT = '2026-03-01T10:00:00.000Z';
const signedOrder = (orderId, orderDate, over = {}) => ({ orderId, orderDate, isDeleted: false, hasSignedRegulations: true, eventDate: orderDate, ...over });

// ---------- card state ----------
test('state: the flip is on', () => {
  assert.equal(logic.SIGNATURE_COLUMNS_READY, true);
});

test('state: stored signed -> signed at the server timestamp, orderId null (no "#null"), not derived - even with no orders', () => {
  const s = logic.signatureState({ hasSignedRegulations: true, regulationsSignedAt: AT, orders: [] });
  assert.deepEqual(s, { signed: true, at: AT, orderId: null, derived: false });
  assert.equal(logic.signatureOrderText(s), '');
});

test('state: stored signed wins over the orders (an unsigned order does not un-sign)', () => {
  const s = logic.signatureState({ hasSignedRegulations: true, regulationsSignedAt: AT, orders: [signedOrder(9, '2026-02-01', { hasSignedRegulations: false })] });
  assert.equal(s.signed, true);
  assert.equal(s.derived, false);
});

test('state: not backfilled (stored false, no timestamp) falls back to the earliest-visible signed order, marked derived', () => {
  const s = logic.signatureState({ hasSignedRegulations: false, regulationsSignedAt: null, orders: [signedOrder(7, '2026-01-02')] });
  assert.deepEqual([s.signed, s.orderId, s.derived], [true, 7, true]);
  assert.equal(logic.signatureOrderText(s), ' בהזמנה #7');
});

test('state: not backfilled and no signed order (or only deleted ones) -> not signed', () => {
  assert.equal(logic.signatureState({ hasSignedRegulations: false, regulationsSignedAt: null, orders: [] }).signed, false);
  assert.equal(logic.signatureState({ hasSignedRegulations: false, regulationsSignedAt: null, orders: [signedOrder(7, '2026-01-02', { isDeleted: true })] }).signed, false);
});

test('state: revoked on purpose (stored false WITH a timestamp) stays unsigned even if an order is signed - so a signature can be cancelled', () => {
  const s = logic.signatureState({ hasSignedRegulations: false, regulationsSignedAt: AT, orders: [signedOrder(7, '2026-01-02')] });
  assert.deepEqual(s, { signed: false, at: null, orderId: null, derived: false });
});

test('state: no flag in the payload (old server / client) or columnsReady=false -> derived from orders only', () => {
  const orders = [signedOrder(7, '2026-01-02')];
  assert.deepEqual(logic.signatureState({ orders }), { signed: true, at: '2026-01-02', orderId: 7, derived: true });
  assert.deepEqual(logic.signatureState({ orders, hasSignedRegulations: false }, { columnsReady: false }), { signed: true, at: '2026-01-02', orderId: 7, derived: true });
  assert.equal(logic.signatureState({ hasSignedRegulations: true, orders: [] }, { columnsReady: false }).signed, false, 'flag off = rollback to derived');
  assert.equal(logic.signatureState(null).signed, false);
  assert.equal(logic.signatureState(undefined).signed, false);
});

test('state: a draft sign/unsign on top of a saved customer', () => {
  const saved = { hasSignedRegulations: false, regulationsSignedAt: null, orders: [] };
  assert.equal(logic.signatureState({ ...saved, hasSignedRegulations: true }).signed, true, 'draft sign (no date until the server stamps it)');
  const savedSigned = { hasSignedRegulations: true, regulationsSignedAt: AT, orders: [signedOrder(7, '2026-01-02')] };
  assert.equal(logic.signatureState({ ...savedSigned, hasSignedRegulations: false }).signed, false, 'draft unsign keeps the timestamp -> revoked, not derived');
});

// ---------- changes rail / payload ----------
test('card field: hasSignedRegulations is an editable card field with its own value labels; regulationsSignedAt is not editable', () => {
  const f = logic.CARD_FIELDS.find((x) => x.key === 'hasSignedRegulations');
  assert.ok(f && f.bool && f.icon === 'sig' && f.label === 'חתימה על התקנון');
  assert.ok(!logic.CARD_FIELD_KEYS.includes('regulationsSignedAt'));
  assert.equal(logic.showValue('hasSignedRegulations', true), 'חתום');
  assert.equal(logic.showValue('hasSignedRegulations', false), 'לא חתום');
  assert.equal(logic.showValue('marketingConsent', true), 'מאושר', 'other bool fields keep their labels');
});

test('changes: signing in the draft shows one "חתימה על התקנון סומן" row; undo restores; unsigning shows "בוטל"', () => {
  const saved = { firstName: 'א', hasSignedRegulations: false };
  const cur = { ...saved, hasSignedRegulations: true };
  const ch = logic.computeChanges(saved, cur);
  assert.equal(ch.length, 1);
  assert.deepEqual([ch[0].field, ch[0].text, ch[0].note], ['hasSignedRegulations', 'חתימה על התקנון סומן', 'לא חתום ← חתום']);
  assert.deepEqual(logic.computeChanges(saved, logic.undoField(cur, saved, 'hasSignedRegulations')), []);
  assert.equal(logic.computeChanges({ hasSignedRegulations: true }, { hasSignedRegulations: false })[0].text, 'חתימה על התקנון בוטל');
  assert.deepEqual(logic.computeChanges({ hasSignedRegulations: undefined }, { hasSignedRegulations: false }), [], 'undefined and false are the same for an old payload');
});

test('save payload carries the flag and cardVariant a5 (the only variant the server lets write it)', () => {
  const p = logic.buildSavePayload({ firstName: 'א', hasSignedRegulations: true, regulationsSignedAt: AT, email: '', emailSuffix: '' });
  assert.equal(p.cardVariant, 'a5');
  assert.equal(p.hasSignedRegulations, true);
});

// ---------- server plan ----------
test('plan: only a real change produces a write; sign stamps now; unsign keeps the stamp', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');
  assert.equal(sig.planSignatureWrite({ requested: undefined, current: { hasSignedRegulations: false }, now }), null);
  assert.equal(sig.planSignatureWrite({ requested: true, current: { hasSignedRegulations: true }, now }), null);
  assert.equal(sig.planSignatureWrite({ requested: false, current: { hasSignedRegulations: false }, now }), null);
  const s = sig.planSignatureWrite({ requested: true, current: { hasSignedRegulations: false }, now });
  assert.deepEqual(s.data, { hasSignedRegulations: true, regulationsSignedAt: now });
  assert.deepEqual(s.changes, { hasSignedRegulations: { from: false, to: true } });
  const u = sig.planSignatureWrite({ requested: false, current: { hasSignedRegulations: true }, now });
  assert.deepEqual(u.data, { hasSignedRegulations: false });
  assert.ok(!('regulationsSignedAt' in u.data));
  const created = sig.planSignatureWrite({ requested: true, current: null, now });
  assert.equal(created.data.regulationsSignedAt, now);
});

test('readSignatureFlag: only the a5 variant, booleans only', () => {
  assert.equal(sig.readSignatureFlag({ hasSignedRegulations: true }), undefined, 'no cardVariant');
  assert.equal(sig.readSignatureFlag({ cardVariant: 'legacy', hasSignedRegulations: true }), undefined);
  assert.equal(sig.readSignatureFlag({ cardVariant: 'a5' }), undefined);
  assert.equal(sig.readSignatureFlag({ cardVariant: 'a5', hasSignedRegulations: true }), true);
  assert.equal(sig.readSignatureFlag({ cardVariant: 'a5', hasSignedRegulations: false }), false);
  for (const bad of ['true', 1, null, {}, []]) assert.equal(sig.readSignatureFlag({ cardVariant: 'a5', hasSignedRegulations: bad }), 'invalid');
  assert.equal(sig.readSignatureFlag(null), undefined);
});

// ---------- sync from orders (mock prisma) ----------
function mockEnv(customer, { failFind = false, failUpdate = false } = {}) {
  const calls = [];
  const prisma = {
    customer: {
      findUnique: async (a) => { calls.push(['findUnique', a]); if (failFind) throw new Error('db down'); return customer ? { ...customer } : null; },
      update: async (a) => { calls.push(['update', a]); if (failUpdate) throw new Error('write failed'); return { ...customer, ...a.data }; },
      updateMany: async () => { throw new Error('updateMany bypasses the audit extension - must not be used'); },
    },
  };
  const auditAs = (action, args, changes) => ({ ...args, __audit: { action, changes } });
  return { prisma, auditAs, calls };
}
const NOW = new Date('2026-10-05T12:00:00.000Z');
const run = (env, o = {}) => sig.syncCustomerSignatureFromOrder({ prisma: env.prisma, auditAs: env.auditAs, customerId: 'c1', orderWasSigned: false, orderIsSigned: true, now: NOW, ...o });

test('sync: an order that becomes signed signs an unsigned customer (server now), through update + auditAs (one history row)', async () => {
  const env = mockEnv({ id: 'c1', isDeleted: false, hasSignedRegulations: false });
  const r = await run(env);
  assert.deepEqual(r, { ok: true, synced: true });
  const upd = env.calls.find((c) => c[0] === 'update')[1];
  assert.deepEqual(upd.where, { id: 'c1' });
  assert.deepEqual(upd.data, { hasSignedRegulations: true, regulationsSignedAt: NOW });
  assert.deepEqual(upd.__audit, { action: 'UPDATE', changes: { hasSignedRegulations: { from: false, to: true } } });
});

test('sync: never overwrites an existing signature (and never re-stamps it)', async () => {
  const env = mockEnv({ id: 'c1', isDeleted: false, hasSignedRegulations: true });
  const r = await run(env);
  assert.deepEqual(r, { ok: true, synced: false, reason: 'already-signed' });
  assert.ok(!env.calls.some((c) => c[0] === 'update'));
});

test('sync: only a false->true order transition counts (already-signed order, unsigned order, no customer id)', async () => {
  for (const o of [{ orderWasSigned: true }, { orderIsSigned: false }, { orderIsSigned: undefined }, { customerId: null }]) {
    const env = mockEnv({ id: 'c1', isDeleted: false, hasSignedRegulations: false });
    const r = await run(env, o);
    assert.equal(r.synced, false);
    assert.equal(env.calls.length, 0, `no DB access for ${JSON.stringify(o)}`);
  }
});

test('sync: deleted customer, missing customer, or a client without the columns are skipped quietly', async () => {
  assert.equal((await run(mockEnv({ id: 'c1', isDeleted: true, hasSignedRegulations: false }))).reason, 'customer-deleted');
  assert.equal((await run(mockEnv(null))).reason, 'no-customer');
  const bare = mockEnv({ id: 'c1', isDeleted: false });
  assert.equal((await run(bare)).reason, 'columns-unavailable');
  assert.ok(!bare.calls.some((c) => c[0] === 'update'));
});

test('sync: a failure is swallowed (returns ok:false, never throws) so the order save is never failed by it', async () => {
  const origErr = console.error;
  console.error = () => {};
  try {
    for (const flags of [{ failFind: true }, { failUpdate: true }]) {
      const r = await run(mockEnv({ id: 'c1', isDeleted: false, hasSignedRegulations: false }, flags));
      assert.deepEqual(r, { ok: false, synced: false, reason: 'error' });
    }
  } finally { console.error = origErr; }
});

// ---------- static guards ----------
test('order route: the sync runs after the $transaction, before the final fetch, only on a true flag, with the pre-update order as "was"', () => {
  const src = code(read('app/api/orders/[id]/route.js'));
  assert.match(src, /import \{ syncCustomerSignatureFromOrder \} from '@\/lib\/customerSignature'/);
  const iTx = src.indexOf('const updatedOrder = await prisma.$transaction(');
  const iSync = src.indexOf('await syncCustomerSignatureFromOrder(');
  const iFinal = src.indexOf('prisma.order.findUnique({\n        where: { orderId: parsedOrderId },\n        include: {\n          customer: true');
  assert.ok(iTx > 0 && iSync > iTx && iFinal > iSync, 'order: transaction < sync < final fetch');
  assert.equal(src.split('await syncCustomerSignatureFromOrder(').length - 1, 1);
  const call = src.slice(iSync, src.indexOf('});', iSync) + 3);
  assert.match(call, /customerId: existingOrder\.customerId/);
  assert.match(call, /orderWasSigned: !!existingOrder\.hasSignedRegulations/);
  assert.match(call, /orderIsSigned: data\.hasSignedRegulations === true/);
  // the transaction body (from its start to the sync call) must not mention the customer signature (no reads/writes of Customer in the tx)
  assert.ok(!/regulationsSignedAt|customerSignature/.test(src.slice(iTx, iSync)), 'nothing signature-related inside the transaction');
});

test('customer routes: use the shared plan, never read regulationsSignedAt from the body, never write AuditLog by hand', () => {
  for (const f of ['app/api/customers/[id]/route.js', 'app/api/customers/route.js']) {
    const src = code(read(f));
    assert.match(src, /planSignatureWrite/, f);
    assert.match(src, /readSignatureFlag/, f);
    assert.ok(!/body\.regulationsSignedAt|body\[['"]regulationsSignedAt['"]\]|\.\.\.body/.test(src), `${f}: the timestamp must not come from the body`);
    assert.ok(!/auditLog\./i.test(src), `${f}: no manual AuditLog writes`);
  }
});

test('card wiring: the button toggles through setField, is locked (aria-disabled) only when read-only or derived, and has an accessible state', () => {
  const src = code(read('app/components/customer-card/tabs/CcDetailsTab.js'));
  assert.match(src, /id="termsBtn"/);
  assert.match(src, /setField\('hasSignedRegulations', !cur\.hasSignedRegulations\)/);
  assert.match(src, /sigLocked = cc\.readOnly \|\| sig\.derived/);
  assert.match(src, /aria-pressed=\{sig\.signed\}/);
  assert.match(src, /aria-disabled=\{sigLocked \? 'true' : undefined\}/);
  assert.ok(!/aria-disabled="true"/.test(src), 'no longer permanently disabled');
  assert.ok(!/אחרי עדכון מסד הנתונים/.test(src), 'the "after DB update" placeholder text is gone');
  assert.match(read('app/components/customer-card/tabs/CcDetailsTab.js'), /חתמה על התקנון/);
  const setField = code(read('app/components/customer-card/useCustomerCard.js'));
  assert.match(setField, /CARD_FIELD_KEYS\.includes\(key\)/, 'setField only accepts card fields (hasSignedRegulations is one now)');
});

test('history labels: both columns have a Hebrew label and the sig icon', () => {
  assert.equal(labels.CUSTOMER_ONLY_FIELD_LABELS.hasSignedRegulations, 'חתימה על התקנון');
  assert.equal(labels.CUSTOMER_ONLY_FIELD_LABELS.regulationsSignedAt, 'מועד החתימה על התקנון');
  assert.match(read('lib/history/labels.js'), /hasSignedRegulations: 'sig', regulationsSignedAt: 'sig'/);
});

test('schema: Customer declares both columns exactly like the DDL (additive); the DDL file is unchanged and still only ADD COLUMN IF NOT EXISTS', () => {
  const schema = read('prisma/schema.prisma');
  const model = schema.slice(schema.indexOf('model Customer {'), schema.indexOf('\n}', schema.indexOf('model Customer {')));
  assert.match(model, /^\s*hasSignedRegulations\s+Boolean\s+@default\(false\)/m);
  assert.match(model, /^\s*regulationsSignedAt\s+DateTime\?(\s|$)/m);
  const ddl = read('prisma/migrations-pending/2026-10-04-customer-signed-regulations.sql');
  assert.match(ddl, /ADD COLUMN IF NOT EXISTS "hasSignedRegulations" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(ddl, /ADD COLUMN IF NOT EXISTS "regulationsSignedAt" TIMESTAMP\(3\)/);
  assert.match(read('package.json'), /"build": "prisma generate && next build/, 'the client is regenerated from the schema on every build');
});
