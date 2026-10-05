// Server approval hardening (2026-10-05) - the CLIENT side: lib/approvalTokenStore.js, lib/approvalClient.js, the new card's flows and
// payment actions, and a static guard on every legacy sender of an approver id. No server: fetch / prompt are fakes.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { baseState } from './fixtures.mjs';

const P = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const read = (rel) => fs.readFileSync(process.env.PROJ + '/' + rel, 'utf8');
const Store = await P('lib/approvalTokenStore.js');
const Client = await P('lib/approvalClient.js');
const L = await P('app/components/order-card/orderCardLogic.js');
const { createOrderCardFlows } = await P('app/components/order-card/orderCardFlows.js');
const { createPaymentActions } = await P('app/components/order-card/hooks/usePaymentActions.js');

const DEBT = Store.DEBT_APPROVAL_LEVEL;
const PAY = Store.MANUAL_PAYMENT_CREDIT_LEVEL;
const CHARGE = Store.MANUAL_CHARGE_LEVEL;
beforeEach(() => Store.resetApprovalTokenStore());

const jsonRes = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// ------------------------------------------------------------------------------------------------ store
test('store: keyed by level + order, the debt level has three spellings, 4.5-minute client expiry', () => {
  Store.stashApprovalToken('debt', 501, 'tok-a', 1000);
  assert.equal(Store.peekApprovalToken(DEBT, 501, 1000 + 1), 'tok-a');
  assert.equal(Store.peekApprovalToken('feature:debt_approval', 501, 1001), 'tok-a');
  assert.equal(Store.peekApprovalToken(DEBT, 502, 1001), null, 'other order');
  assert.equal(Store.peekApprovalToken(PAY, 501, 1001), null, 'other level');
  assert.equal(Store.peekApprovalToken(DEBT, 501, 1000 + Store.CLIENT_TOKEN_TTL_MS), null, 'expired');
  assert.equal(Store.peekApprovalToken(DEBT, 501, 1001), null, 'and dropped');
  Store.stashApprovalToken(PAY, 501, 'tok-b');
  Store.stashApprovalToken(PAY, 501, '');
  Store.stashApprovalToken(PAY, 501, undefined);
  assert.equal(Store.peekApprovalToken(PAY, 501), 'tok-b', 'empty values never overwrite');
  Store.clearApprovalToken(PAY, 501);
  assert.equal(Store.peekApprovalToken(PAY, 501), null);
  assert.ok(Store.CLIENT_TOKEN_TTL_MS < 5 * 60 * 1000, 'shorter than the server expiry');
});

// ------------------------------------------------------------------------------------------------ approvalClient
function fakeEnv({ responses, promptAnswer = { pin: 'secret-code', employeeId: 'mgr1' }, verify = { success: true, employeeId: 'mgr1', approvalToken: 'tok-new' } }) {
  const sent = [], prompts = [], verifyBodies = [], alerts = [];
  let i = 0;
  const send = async (extra) => { sent.push({ ...extra }); const r = responses[Math.min(i++, responses.length - 1)]; return jsonRes(r.status, r.body || {}); };
  const prompt = async (message, level) => { prompts.push({ message, level }); return promptAnswer; };
  const fetchImpl = async (url, opts) => { verifyBodies.push({ url, body: JSON.parse(opts.body) }); return jsonRes(verify.success ? 200 : 401, verify); };
  const notify = (m) => alerts.push(m);
  return { sent, prompts, verifyBodies, alerts, send, prompt, fetchImpl, notify };
}
const OPTS = (e, extra = {}) => ({ orderId: 501, kinds: ['manual_payment_credit'], fieldFor: () => 'approvalToken', prompt: e.prompt, fetchImpl: e.fetchImpl, notify: e.notify, ...extra });

test('sendWithApproval: flags OFF (server never says 403) = one request, no prompt, nothing attached when there is no token', async () => {
  const e = fakeEnv({ responses: [{ status: 200, body: { ok: 1 } }] });
  const res = await Client.sendWithApproval(e.send, OPTS(e));
  assert.equal(res.status, 200);
  assert.deepEqual(e.sent, [{}]);
  assert.equal(e.prompts.length, 0);
});

test('sendWithApproval: a stashed token travels with the request and is cleared after success (single use)', async () => {
  Store.stashApprovalToken(PAY, 501, 'tok-stash');
  const e = fakeEnv({ responses: [{ status: 200 }] });
  await Client.sendWithApproval(e.send, OPTS(e));
  assert.deepEqual(e.sent, [{ approvalToken: 'tok-stash' }]);
  assert.equal(Store.peekApprovalToken(PAY, 501), null);
  // a failed request keeps it (the server hands the claim back too)
  Store.stashApprovalToken(PAY, 501, 'tok-keep');
  const e2 = fakeEnv({ responses: [{ status: 500 }] });
  await Client.sendWithApproval(e2.send, OPTS(e2));
  assert.equal(Store.peekApprovalToken(PAY, 501), 'tok-keep');
});

test('sendWithApproval: 403 + approvalKind -> the manager-code popup for that level, verify-pin names the order, resend with the fresh token', async () => {
  const e = fakeEnv({ responses: [{ status: 403, body: { approvalKind: 'manual_payment_credit', code: 'APPROVAL_PERMISSION_REQUIRED' } }, { status: 200 }] });
  const res = await Client.sendWithApproval(e.send, OPTS(e));
  assert.equal(res.status, 200);
  assert.equal(e.prompts.length, 1);
  assert.equal(e.prompts[0].level, PAY);
  assert.deepEqual(e.verifyBodies[0].body, { pin: 'secret-code', employeeId: 'mgr1', requiredLevel: PAY, orderId: 501 });
  assert.deepEqual(e.sent, [{}, { approvalToken: 'tok-new' }]);
  assert.equal(Store.peekApprovalToken(PAY, 501), null, 'spent');
});

test('sendWithApproval: cancelled / wrong code -> the original 403 is returned, no resend; an unrelated 403 never prompts', async () => {
  const e = fakeEnv({ responses: [{ status: 403, body: { approvalKind: 'manual_payment_credit' } }], promptAnswer: null });
  const res = await Client.sendWithApproval(e.send, OPTS(e));
  assert.equal(res.status, 403);
  assert.equal(e.sent.length, 1);
  const wrong = fakeEnv({ responses: [{ status: 403, body: { approvalKind: 'manual_payment_credit' } }], verify: { success: false, error: 'סיסמה שגויה' } });
  const r2 = await Client.sendWithApproval(wrong.send, OPTS(wrong));
  assert.equal(r2.status, 403);
  assert.deepEqual(wrong.alerts, ['סיסמה שגויה']);
  const other = fakeEnv({ responses: [{ status: 403, body: { error: 'x' } }] });
  await Client.sendWithApproval(other.send, OPTS(other));
  assert.equal(other.prompts.length, 0);
  const wrongKind = fakeEnv({ responses: [{ status: 403, body: { approvalKind: 'debt_approval' } }] });
  await Client.sendWithApproval(wrongKind.send, OPTS(wrongKind));
  assert.equal(wrongKind.prompts.length, 0, 'a kind this request did not declare');
});

test('sendWithApproval: at most 3 re-approvals; the debt re-approval also sends the id (the OFF-mode field)', async () => {
  const e = fakeEnv({ responses: [{ status: 403, body: { approvalKind: 'debt_approval' } }, { status: 403, body: { approvalKind: 'debt_approval' } }, { status: 403, body: { approvalKind: 'debt_approval' } }, { status: 403, body: { approvalKind: 'debt_approval' } }, { status: 200 }] });
  const res = await Client.sendWithApproval(e.send, OPTS(e, { kinds: ['debt_approval'], fieldFor: () => 'debtApprovalToken' }));
  assert.equal(res.status, 403);
  assert.equal(e.prompts.length, 3);
  assert.deepEqual(e.sent.at(-1), { debtApprovalToken: 'tok-new', debtApprovedBy: 'mgr1' });
});

test('requestApproval never logs the code and a cancelled popup sends nothing', async () => {
  const logged = [];
  const orig = [console.log, console.warn, console.error];
  console.log = console.warn = console.error = (...a) => logged.push(a.join(' '));
  try {
    const e = fakeEnv({ responses: [] });
    assert.deepEqual(await Client.requestApproval({ level: DEBT, orderId: 7, message: 'm', prompt: e.prompt, fetchImpl: e.fetchImpl, notify: e.notify }), { employeeId: 'mgr1', approvalToken: 'tok-new' });
    const none = fakeEnv({ responses: [], promptAnswer: { employeeId: 'x' } });
    assert.equal(await Client.requestApproval({ level: DEBT, orderId: 7, message: 'm', prompt: none.prompt, fetchImpl: none.fetchImpl, notify: none.notify }), null);
    assert.equal(none.verifyBodies.length, 0);
  } finally { [console.log, console.warn, console.error] = orig; }
  assert.ok(!logged.join('\n').includes('secret-code'));
});

// ------------------------------------------------------------------------------------------------ the new card's flows
function flowHarness(st, { respond, approveAnswers = {} }) {
  const state = { ...JSON.parse(JSON.stringify(st)), snapshot: JSON.parse(JSON.stringify(st)), openedDebt: L.openedDebtOf(st.obligations, st.payments), settings: L.parseSettings([]), debtApproved: false };
  state.order = { ...state.order, notes: 'שונה' };
  const calls = [], approved = [];
  const setter = (k) => (v) => { state[k] = typeof v === 'function' ? v(state[k]) : v; };
  const orderId = st.order.orderId;
  const env = {
    fetch: async (url, opts = {}) => {
      const body = opts.body ? JSON.parse(opts.body) : undefined;
      calls.push({ url, method: opts.method || 'GET', body });
      const r = respond(url, body, calls.filter(c => c.method === 'PUT').length) || {};
      return jsonRes(r.status ?? 200, r.body ?? {});
    },
    ui: { confirm: async () => true, prompt: async () => null, alert: async () => {}, toast: () => {}, openDialog: async () => null },
    dialogs: {}, routeId: String(orderId), get: () => state,
    set: { order: setter('order'), items: setter('items'), obligations: setter('obligations'), payments: setter('payments'), refunds: setter('refunds'), tab: setter('tab'), saving: setter('saving') },
    setSnapshot: (s) => { state.snapshot = s; }, setOpenedDebt: () => {}, setDebtApproved: (v) => { state.debtApproved = v; },
    flags: { pendingDebtBlock: false, bankPromptedOnExit: false, approvedDebtLevel: null },
    approve: async (kind) => {
      approved.push(kind);
      const a = approveAnswers[kind];
      if (a && a.approvalToken) Store.stashApprovalToken(L.approvalLevelOf(kind).requiredLevel, orderId, a.approvalToken);
      return a || null;
    },
    peekApprovalToken: (kind) => Store.peekApprovalToken(L.approvalLevelOf(kind).requiredLevel, orderId),
    clearApprovalToken: (kind) => Store.clearApprovalToken(L.approvalLevelOf(kind).requiredLevel, orderId),
    navigate: () => {}, emit: () => 0, bumpHistory: () => {}, clearRedo: () => {},
  };
  return { flows: createOrderCardFlows(env), calls, approved, orderId };
}
const serverOk = (st) => ({ body: { ...st.order, items: st.items, obligations: st.obligations, payments: st.payments, refunds: [], updatedAt: '2026-10-04T10:00:00.000Z' } });
const putsOf = (h) => h.calls.filter(c => c.method === 'PUT');

test('new card PUT: with no stashed tokens the body is exactly today\'s (no token fields at all)', async () => {
  const st = baseState();
  const h = flowHarness(st, { respond: (u) => (u.includes('validate') ? { body: { valid: true } } : serverOk(st)) });
  await h.flows.save({ intent: 'save' });
  const put = putsOf(h)[0].body;
  assert.ok(!('debtApprovalToken' in put) && !('manualChargeApprovalToken' in put) && !('paymentApprovalToken' in put));
});

test('new card PUT: stashed payment / manual-charge tokens are attached; the debt token only when debtApprovedBy is sent; all cleared after success', async () => {
  const st = baseState();
  const h = flowHarness(st, { respond: (u) => (u.includes('validate') ? { body: { valid: true } } : serverOk(st)) });
  Store.stashApprovalToken(PAY, h.orderId, 'tok-pay');
  Store.stashApprovalToken(CHARGE, h.orderId, 'tok-chg');
  Store.stashApprovalToken(DEBT, h.orderId, 'tok-debt');
  await h.flows.save({ intent: 'save' });
  const put = putsOf(h)[0].body;
  assert.equal(put.paymentApprovalToken, 'tok-pay');
  assert.equal(put.manualChargeApprovalToken, 'tok-chg');
  assert.ok(!('debtApprovalToken' in put), 'no debtApprovedBy in this save -> the debt token is not sent (it would record an approval)');
  assert.equal(Store.peekApprovalToken(PAY, h.orderId), null);
  assert.equal(Store.peekApprovalToken(CHARGE, h.orderId), null);
  assert.equal(Store.peekApprovalToken(DEBT, h.orderId), 'tok-debt', 'untouched');
  const h2 = flowHarness(st, { respond: (u) => (u.includes('validate') ? { body: { valid: true } } : serverOk(st)) });
  Store.stashApprovalToken(DEBT, h2.orderId, 'tok-debt2');
  await h2.flows.save({ intent: 'save', debtApprovedBy: 'mgr9' });
  const put2 = putsOf(h2)[0].body;
  assert.equal(put2.debtApprovedBy, 'mgr9');
  assert.equal(put2.debtApprovalToken, 'tok-debt2');
  assert.equal(Store.peekApprovalToken(DEBT, h2.orderId), null);
});

test('new card PUT: 403 approvalKind manual_payment_credit (payment deleted, enforced server) -> approve again, resend once with the fresh token; cancel = no resend', async () => {
  const st = baseState();
  const respond = (u, body, nPut) => {
    if (u.includes('validate')) return { body: { valid: true } };
    if (!body.paymentApprovalToken) return { status: 403, body: { code: 'APPROVAL_PERMISSION_REQUIRED', approvalKind: 'manual_payment_credit', error: 'x' } };
    return serverOk(st);
  };
  const h = flowHarness(st, { respond, approveAnswers: { 'feature:manual_payment_credit_add': { employeeId: 'mgr1', employeeName: 'מ', pin: 'p', approvalToken: 'tok-fresh' } } });
  const r = await h.flows.save({ intent: 'save' });
  assert.equal(r.ok, true);
  assert.deepEqual(h.approved, ['feature:manual_payment_credit_add']);
  assert.equal(putsOf(h).length, 2);
  assert.equal(putsOf(h)[1].body.paymentApprovalToken, 'tok-fresh');
  const h2 = flowHarness(st, { respond, approveAnswers: {} });
  const r2 = await h2.flows.save({ intent: 'save' });
  assert.equal(r2.ok, false);
  assert.equal(putsOf(h2).length, 1);
});

test('new card PUT: 403 approvalKind debt_approval -> approve(debt) again and resend with debtApprovedBy + the fresh token', async () => {
  const st = baseState();
  const respond = (u, body) => {
    if (u.includes('validate')) return { body: { valid: true } };
    if (!body.debtApprovalToken) return { status: 403, body: { code: 'APPROVAL_TOKEN_REQUIRED', approvalKind: 'debt_approval', error: 'x' } };
    return serverOk(st);
  };
  const h = flowHarness(st, { respond, approveAnswers: { debt: { employeeId: 'mgr1', employeeName: 'מ', pin: 'p', approvalToken: 'tok-d' } } });
  const r = await h.flows.save({ intent: 'save', debtApprovedBy: 'old-id' });
  assert.equal(r.ok, true);
  assert.equal(putsOf(h)[1].body.debtApprovedBy, 'mgr1');
  assert.equal(putsOf(h)[1].body.debtApprovalToken, 'tok-d');
});

test('new card PUT: the existing manual-charge retry still sends the typed code and now the token as well', async () => {
  const st = baseState();
  const respond = (u, body) => {
    if (u.includes('validate')) return { body: { valid: true } };
    if (!body.manualChargeApproverId) return { status: 403, body: { code: 'MANUAL_CHARGE_APPROVAL_REQUIRED', approvalKind: 'manual_charge', error: 'x' } };
    return serverOk(st);
  };
  const h = flowHarness(st, { respond, approveAnswers: { 'feature:manual_charge_add': { employeeId: 'mgr1', employeeName: 'מ', pin: 'pw', approvalToken: 'tok-c' } } });
  const r = await h.flows.save({ intent: 'save' });
  assert.equal(r.ok, true);
  const second = putsOf(h)[1].body;
  assert.equal(second.manualChargeApproverId, 'mgr1');
  assert.equal(second.manualChargeApproverPin, 'pw');
  assert.equal(second.manualChargeApprovalToken, 'tok-c');
});

// ------------------------------------------------------------------------------------------------ the new card's payment actions
function payHarness(respond, approveAnswer = null) {
  const calls = [];
  const orderId = 53375;
  const state = { order: { orderId }, payments: [], refunds: [], settings: L.parseSettings([]), dirty: false, totals: {} };
  const env = {
    fetch: async (url, opts = {}) => { const body = opts.body ? JSON.parse(opts.body) : undefined; calls.push({ url, method: opts.method || 'GET', body }); const r = respond(url, body, calls.length) || {}; return jsonRes(r.status ?? 200, r.body ?? {}); },
    get: () => state,
    edit: { setPayments: () => {}, setObligations: () => {}, setRefunds: () => {} },
    applyServerOrder: () => {},
    approve: async () => { if (approveAnswer && approveAnswer.approvalToken) Store.stashApprovalToken(PAY, orderId, approveAnswer.approvalToken); return approveAnswer; },
    peekApprovalToken: (k) => Store.peekApprovalToken(L.approvalLevelOf(k).requiredLevel, orderId),
    clearApprovalToken: (k) => Store.clearApprovalToken(L.approvalLevelOf(k).requiredLevel, orderId),
    toggleSignature: async () => true,
    ui: { confirm: async () => true, alert: async () => {}, toast: () => {} },
  };
  return { actions: createPaymentActions(env), calls, orderId };
}

test('payments: addManualPayment sends the token the manager-code dialog produced (approved:true path) and clears it', async () => {
  const h = payHarness((u) => (u === '/api/payments' ? { body: { id: 'p1', amount: 50 } } : { body: {} }));
  Store.stashApprovalToken(PAY, h.orderId, 'tok-m');
  const r = await h.actions.addManualPayment({ amount: 50, paymentMethod: 'מזומן', notes: '', approved: true });
  assert.equal(r.ok, true);
  const post = h.calls.find(c => c.url === '/api/payments');
  assert.equal(post.body.approvalToken, 'tok-m');
  assert.equal(Store.peekApprovalToken(PAY, h.orderId), null);
});

test('payments: addManualPayment with no token and a server that does not enforce = the old body (no approvalToken field)', async () => {
  const h = payHarness((u) => (u === '/api/payments' ? { body: { id: 'p1', amount: 50 } } : { body: {} }));
  await h.actions.addManualPayment({ amount: 50, paymentMethod: 'מזומן', notes: '', approved: true });
  assert.ok(!('approvalToken' in h.calls.find(c => c.url === '/api/payments').body));
});

test('payments: 403 approvalKind -> approve again and one resend with the fresh token; cancel -> cancelled, one request', async () => {
  const respond = (u, body) => (u === '/api/payments'
    ? (body.approvalToken ? { body: { id: 'p1', amount: 50 } } : { status: 403, body: { code: 'APPROVAL_PERMISSION_REQUIRED', approvalKind: 'manual_payment_credit', error: 'x' } })
    : { body: {} });
  const h = payHarness(respond, { employeeId: 'm', approvalToken: 'tok-again' });
  const r = await h.actions.addManualPayment({ amount: 50, paymentMethod: 'מזומן', notes: '', approved: true });
  assert.equal(r.ok, true);
  assert.deepEqual(h.calls.filter(c => c.url === '/api/payments').map(c => c.body.approvalToken || null), [null, 'tok-again']);
  const h2 = payHarness(respond, null);
  const r2 = await h2.actions.addManualPayment({ amount: 50, paymentMethod: 'מזומן', notes: '', approved: true });
  assert.equal(r2.cancelled, true);
  assert.equal(h2.calls.filter(c => c.url === '/api/payments').length, 1);
});

test('payments: executeRefund carries the token and re-asks on 403; the body keeps isExecuted:true', async () => {
  const respond = (u, body) => (u.startsWith('/api/refunds/')
    ? (body.approvalToken ? { body: { id: 'r1', isExecuted: true } } : { status: 403, body: { approvalKind: 'manual_payment_credit' } })
    : { body: {} });
  const h = payHarness(respond, { employeeId: 'm', approvalToken: 'tok-r' });
  const r = await h.actions.executeRefund('r1');
  assert.equal(r.ok, true);
  const puts = h.calls.filter(c => c.method === 'PUT');
  assert.deepEqual(puts.map(c => c.body), [{ isExecuted: true }, { isExecuted: true, approvalToken: 'tok-r' }]);
});

// ------------------------------------------------------------------------------------------------ static guards
test('static: OcApproval returns the token; the controller stores it per level/order and exposes peek/clear; no token or code in a log line', () => {
  const a = read('app/components/order-card/OcApproval.js');
  assert.match(a, /\.\.\.\(data\.approvalToken \? \{ approvalToken: data\.approvalToken \} : \{\}\)/);
  const c = read('app/components/order-card/useOrderCardController.js');
  assert.match(c, /stashToken\(approvalLevelOf\(kind\)\.requiredLevel, stateRef\.current\.order\?\.orderId, r\.approvalToken\)/);
  assert.match(c, /peekApprovalToken, clearApprovalToken, approveDebt/);
  for (const f of ['lib/approvalClient.js', 'lib/approvalTokenStore.js', 'app/components/order-card/useOrderCardController.js']) {
    for (const line of read(f).split('\n')) if (/console\.(log|warn|error)/.test(line)) assert.ok(!/token|pin\b/i.test(line), `${f}: ${line.trim()}`);
  }
});

test('static: every legacy sender of a debt approver now asks verify-pin for the debt level WITH the order and stashes the token', () => {
  const legacy = read('app/orders/[id]/LegacyOrderPage.js');
  assert.ok(!/requiredLevel: 'עובד'/.test(legacy), 'the permission-less "עובד" level is gone from the debt prompts');
  assert.equal((legacy.match(/requiredLevel: DEBT_APPROVAL_LEVEL, orderId:/g) || []).length, 2, 'save + exit');
  assert.equal((legacy.match(/stashApprovalToken\(DEBT_APPROVAL_LEVEL/g) || []).length, 2);
  assert.match(legacy, /stashApprovalToken\('feature:manual_payment_credit_add', order\?\.orderId, data\.approvalToken\)/);
  assert.match(legacy, /sendWithApproval\(\(extra\) => send\(\{ \.\.\.base, \.\.\.extra \}\)/);
  assert.match(legacy, /sendApproved\(\{ \.\.\.payload, overwriteConflict: true \}\)/, 'the overwrite retry carries tokens too');
  const refunds = read('app/refunds/page.js');
  assert.match(refunds, /'feature:debt_approval', \{ orderIds: confirmModal\.orderIds \}/);
  assert.match(refunds, /'feature:debt_approval', \{ orderId \}/);
  assert.equal((refunds.match(/\.\.\.\(auth\.approvalToken \? \{ approvalToken: auth\.approvalToken \} : \{\}\)/g) || []).length, 2, 'POST + DELETE debt-approval');
  assert.match(refunds, /putRefundExecution\(id, true\)/);
  assert.match(refunds, /putRefundExecution\(id, false\)/);
  const mpm = read('components/orders/modern/ModernPaymentsManager.js');
  assert.equal((mpm.match(/sendWithApproval\(/g) || []).length, 2, 'manual payment + refund execution');
  const moc = read('components/orders/modern/mocAuth.js');
  assert.match(moc, /opts\.orderId \? \{ orderId: opts\.orderId \}/);
});
