// זוגיות endpoints בין זרימות הכרטיס החדש (orderCardFlows.js) לכרטיס הישן: fetch מדומה, אותו state → אותן קריאות (URL, method,
// headers, גוף). הגופים מושווים לליטרלים של הישן (legacy.mjs) + extraDay; פעולות מיידיות (חתימה, מחיקה, ביטול שינויים, טעינה
// מחדש) מושוות לקוד המקור של הישן. אישורי מנהל (verify-pin) נבדקים סטטית מול OcApproval.js בסוף הקובץ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { baseState, item, payment } from './fixtures.mjs';
import { legacySaveBody, legacyExitBody, legacyPreviewSummaryBody, legacyValidateBody, LEGACY_SRC } from './legacy.mjs';

const P = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const L = await P('app/components/order-card/orderCardLogic.js');
const { createOrderCardFlows } = await P('app/components/order-card/orderCardFlows.js');
const snapOf = (x) => JSON.parse(JSON.stringify(x));
const DIALOGS = { ConflictDialog: 'Conflict', StockDialog: 'Stock', SummaryDialog: 'Summary', ExitDialog: 'Exit', DiscardDialog: 'Discard' };
const ROUTE_ID = '53375';

function harness(st, { settings = [], respond = () => ({}), answers = {}, approve = null, edit = null } = {}) {
  const snapshot = snapOf(st);
  const state = { ...snapOf(st), snapshot, openedDebt: L.openedDebtOf(st.obligations, st.payments), settings: L.parseSettings(settings), debtApproved: false };
  if (edit) edit(state);
  const calls = [], opened = [], toasts = [], nav = [], events = [];
  const flags = { pendingDebtBlock: false, bankPromptedOnExit: false, approvedDebtLevel: null };
  const setter = (k) => (v) => { state[k] = typeof v === 'function' ? v(state[k]) : v; };
  const ui = {
    confirm: async (o) => { opened.push(['confirm', o]); return answers.confirm ?? true; },
    prompt: async (o) => { opened.push(['prompt', o]); return answers.prompt ?? null; },
    alert: async (o) => { opened.push(['alert', o]); },
    toast: (...a) => toasts.push(a),
    openDialog: async (C, p) => { opened.push([C, p]); return answers[C] ?? null; },
  };
  const env = {
    fetch: async (url, opts = {}) => {
      calls.push({ url, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body !== undefined ? JSON.parse(opts.body) : undefined, rawBody: opts.body });
      const r = respond(url, opts, calls.length) || {};
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
    },
    ui,
    dialogs: DIALOGS,
    routeId: ROUTE_ID,
    get: () => state,
    set: { order: setter('order'), items: setter('items'), obligations: setter('obligations'), payments: setter('payments'), refunds: setter('refunds'), tab: setter('tab'), saving: setter('saving') },
    setSnapshot: (s) => { state.snapshot = s; },
    setOpenedDebt: (n) => { state.openedDebt = n; },
    setDebtApproved: (v) => { state.debtApproved = v; },
    flags,
    approve: approve || (async () => null),
    navigate: (h) => nav.push(h),
    emit: (type, payload) => { events.push([type, payload]); return 0; },
    bumpHistory: () => {},
    clearRedo: () => {},
  };
  return { flows: createOrderCardFlows(env), state, calls, opened, toasts, nav, events, flags };
}

const okValidate = (u) => u.includes('validate-inventory');
const serverOk = (st, extra = {}) => ({ body: { ...st.order, items: st.items, obligations: st.obligations, payments: st.payments, refunds: [], updatedAt: '2026-10-04T10:00:00.000Z', ...extra } });
const withNotes = (s) => { s.order = { ...s.order, notes: 'שונה' }; };

test('שמירה רגילה: validate-inventory ואז PUT /api/orders/<id> עם גוף הישן + extraDay', async () => {
  const st = baseState();
  const h = harness(st, { edit: withNotes, respond: (u) => (u.includes('validate-inventory') ? { body: { valid: true } } : serverOk(st)) });
  const r = await h.flows.save({ intent: 'save' });
  assert.equal(r.ok, true);
  assert.deepEqual(h.calls.map(c => `${c.method} ${c.url}`), ['POST /api/orders/validate-inventory', `PUT /api/orders/${ROUTE_ID}`]);
  const cur = { ...st, order: { ...st.order, notes: 'שונה' } };
  assert.equal(JSON.stringify(h.calls[0].body), JSON.stringify(legacyValidateBody(cur.items.filter(i => !i.isDeleted), cur.order)));
  const expected = { ...legacySaveBody(cur.order, cur, {}), extraDay: null, cardVariant: 'a5' };
  assert.equal(h.calls[1].rawBody, JSON.stringify(expected));
  assert.deepEqual(h.calls[1].headers, { 'Content-Type': 'application/json' });
});

test('אין שינויים → אין PUT ("אין שינויים לשמירה", R49/H32)', async () => {
  const h = harness(baseState());
  const r = await h.flows.save();
  assert.equal(r.noop, true);
  assert.equal(h.calls.length, 0);
  assert.equal(h.toasts[0][1], 'אין שינויים לשמירה');
});

test('R13 ת״ז: prompt → zeout בגוף + x-zeout בכותרת (כמו putOrder של הישן); ביטול = אין PUT', async () => {
  const st = baseState({ order: { customer: { firstName: 'א', zeout: '123456789' } } });
  const settings = [{ key: 'require_id_for_edit_cancel', value: 'true' }, { key: 'require_customer_id_number', value: 'true' }];
  const h = harness(st, { settings, edit: withNotes, answers: { prompt: ' 123456789 ' }, respond: (u) => (u.includes('validate') ? { body: { valid: true } } : serverOk(st)) });
  await h.flows.save();
  const put = h.calls.find(c => c.method === 'PUT');
  assert.equal(put.headers['x-zeout'], '123456789');
  assert.equal(put.body.zeout, '123456789');
  const h2 = harness(st, { settings, edit: withNotes, answers: { prompt: null }, respond: () => ({ body: { valid: true } }) });
  await h2.flows.save();
  assert.equal(h2.calls.filter(c => c.method === 'PUT').length, 0);
  assert.ok(/zeout|ת״ז|תעודת זהות/.test(LEGACY_SRC.slice(LEGACY_SRC.indexOf('const putOrder'), LEGACY_SRC.indexOf('const confirmSaveSummaryIfNeeded'))), 'אותו שער בישן');
});

test('R47 ביטול פריט שנשמר: approve(feature:item_change_approval) → managerEmployeeId/managerPin בגוף', async () => {
  const st = baseState();
  let asked = null;
  const h = harness(st, {
    settings: [{ key: 'require_manager_code_for_item_changes', value: 'true' }],
    edit: (s) => { s.items = [s.items[0], { ...s.items[1], isDeleted: true }]; },
    approve: async (kind, reason) => { asked = { kind, reason }; return { employeeId: 'm1', employeeName: 'שרה', pin: 'pw' }; },
    respond: (u) => (u.includes('validate') ? { body: { valid: true } } : serverOk(st)),
  });
  await h.flows.save();
  assert.equal(asked.kind, 'feature:item_change_approval');
  const put = h.calls.find(c => c.method === 'PUT');
  assert.equal(put.body.managerEmployeeId, 'm1');
  assert.equal(put.body.managerPin, 'pw');
  const cur = { ...st, items: [st.items[0], { ...st.items[1], isDeleted: true }] };
  assert.equal(put.rawBody, JSON.stringify({ ...legacySaveBody(cur.order, cur, { managerAuth: { employeeId: 'm1', pin: 'pw' } }), extraDay: null, cardVariant: 'a5' }));
});

test('R47 הוספה שנכשלה (שורה מקומית isNew) + require_manager_code → approve לפני ה-PUT; ביטול האישור = אין PUT (ביקורת W3 #2)', async () => {
  const st = baseState();
  const failedAdd = { _localId: 'L1', isNew: true, dressModelId: 'm2', sizeText: '42', price: 120, finalPrice: 0, isDeleted: false };
  const settings = [{ key: 'require_manager_code_for_item_changes', value: 'true' }];
  const edit = (s) => { s.items = [...s.items, failedAdd]; };
  let asked = null;
  const h = harness(st, { settings, edit, approve: async (kind, reason) => { asked = { kind, reason }; return { employeeId: 'm1', employeeName: 'שרה', pin: 'pw' }; }, respond: (u) => (u.includes('validate') ? { body: { valid: true } } : serverOk(st)) });
  await h.flows.save();
  assert.equal(asked.kind, 'feature:item_change_approval');
  assert.match(asked.reason, /הוספה/);
  const put = h.calls.find(c => c.method === 'PUT');
  assert.equal(put.body.managerEmployeeId, 'm1');
  assert.equal(put.body.managerPin, 'pw');
  const h2 = harness(st, { settings, edit, approve: async () => null, respond: () => ({ body: { valid: true } }) });
  const r2 = await h2.flows.save();
  assert.equal(r2.ok, false);
  assert.equal(h2.calls.filter(c => c.method === 'PUT').length, 0);
  // בלי ההגדרה — לא מבקשים אישור
  const h3 = harness(st, { edit, approve: async () => { throw new Error('לא אמור לבקש'); }, respond: (u) => (u.includes('validate') ? { body: { valid: true } } : serverOk(st)) });
  assert.equal((await h3.flows.save()).ok, true);
});

test('R12 409 התנגשות: חלון 3 בחירות; "דרוס" = PUT שני עם overwriteConflict; "טען מחדש" = GET; "חזרה" = כלום', async () => {
  const st = baseState();
  const respond409 = (u, o, n) => (u.includes('validate') ? { body: { valid: true } } : (o.method === 'PUT' && n === 2 ? { status: 409, body: { message: 'עודכנה בשרת' } } : serverOk(st)));
  const h = harness(st, { edit: withNotes, answers: { Conflict: 'overwrite' }, respond: respond409 });
  const r = await h.flows.save();
  assert.equal(r.ok, true);
  const puts = h.calls.filter(c => c.method === 'PUT');
  assert.equal(puts.length, 2);
  assert.equal(puts[1].body.overwriteConflict, true);
  assert.deepEqual({ ...puts[1].body, overwriteConflict: undefined }, { ...puts[0].body, overwriteConflict: undefined });
  assert.equal(h.opened.find(x => x[0] === 'Conflict')[1].message, 'עודכנה בשרת');
  const h2 = harness(st, { edit: withNotes, answers: { Conflict: 'reload' }, respond: respond409 });
  const r2 = await h2.flows.save();
  assert.equal(r2.reloaded, true);
  assert.equal(h2.calls.at(-1).url, `/api/orders/${ROUTE_ID}`);
  assert.equal(h2.calls.at(-1).method, 'GET');
  const h3 = harness(st, { edit: withNotes, answers: { Conflict: null }, respond: respond409 });
  assert.equal((await h3.flows.save()).ok, false);
  assert.equal(h3.calls.filter(c => c.method === 'PUT').length, 1);
});

test('G12: 409 של חוסר מלאי (validationErrors / code STOCK_SHORTAGE) → חלון R48, לא חלון התנגשות', async () => {
  const st = baseState();
  for (const body of [{ error: 'x', validationErrors: [{ dressName: '4512', sizeText: '38', requested: 1, available: 0 }] }, { code: 'STOCK_SHORTAGE', validationErrors: [] }]) {
    const h = harness(st, { edit: withNotes, respond: (u, o) => (u.includes('validate') ? { body: { valid: true } } : (o.method === 'PUT' ? { status: 409, body } : {})) });
    const r = await h.flows.save();
    assert.equal(r.stock, true);
    assert.ok(h.opened.some(x => x[0] === 'Stock'));
    assert.ok(!h.opened.some(x => x[0] === 'Conflict'));
    assert.equal(h.calls.filter(c => c.method === 'PUT').length, 1);
  }
});

test('R48 לפני השמירה: validate-inventory לא תקין → חלון חוסר + אין PUT; תיקון בלי פירוט / תאריך חסר → אין קריאות', async () => {
  const st = baseState();
  const h = harness(st, { edit: withNotes, respond: () => ({ body: { valid: false, errors: [{ dressName: 'א', sizeText: '1', requested: 2, available: 0, isCustomSpacingIssue: true }] } }) });
  await h.flows.save();
  assert.equal(h.calls.length, 1);
  const stock = h.opened.find(x => x[0] === 'Stock')[1];
  assert.equal(stock.lines[0].text, 'א (מידה 1): חסרים 2 במלאי (בגלל ציפוף)');
  assert.equal(stock.spacingHint, true);
  const h2 = harness(st, { edit: (s) => { s.items = [{ ...s.items[0], neckAlteration: 1, alterationDetails: '' }, s.items[1]]; } });
  await h2.flows.save();
  assert.equal(h2.calls.length, 0);
  const h3 = harness(st, { edit: (s) => { s.order = { ...s.order, eventDate: null }; } });
  await h3.flows.save();
  assert.equal(h3.calls.length, 0);
});

test('נווה (enable_order_edit_summary_confirm): preview-pricing (גוף הישן + extraDay) → חלון סיכום → PUT; ביטול = אין PUT', async () => {
  const st = baseState();
  const settings = [{ key: 'enable_order_edit_summary_confirm', value: 'true' }];
  const respond = (u) => (u.includes('validate') ? { body: { valid: true } } : u.includes('preview-pricing') ? { body: { newObligations: [{ amount: 400, description: 'x' }] } } : serverOk(st));
  const h = harness(st, { settings, edit: withNotes, answers: { Summary: true }, respond });
  await h.flows.save();
  assert.deepEqual(h.calls.map(c => c.method + ' ' + c.url), ['POST /api/orders/validate-inventory', `POST /api/orders/${st.order.orderId}/preview-pricing`, `PUT /api/orders/${ROUTE_ID}`]);
  const cur = { ...st, order: { ...st.order, notes: 'שונה' } };
  const pv = h.calls[1].body;
  assert.equal(JSON.stringify({ ...pv, order: { ...pv.order, extraDay: undefined } }), JSON.stringify(legacyPreviewSummaryBody(cur.items, cur.order)));
  const sum = h.opened.find(x => x[0] === 'Summary')[1];
  assert.equal(sum.totalRequired, 400);
  const h2 = harness(st, { settings, edit: withNotes, answers: { Summary: false }, respond });
  await h2.flows.save();
  assert.equal(h2.calls.filter(c => c.method === 'PUT').length, 0);
  const h3 = harness(st, { settings, edit: withNotes, respond });
  await h3.flows.save({ summaryConfirmed: true });
  assert.ok(!h3.opened.some(x => x[0] === 'Summary'), 'summaryConfirmed: הרייל כבר הציג D1');
  assert.equal(h3.calls.filter(c => c.method === 'PUT').length, 1);
});

test('A18: שמירה שיצרה חוב → debtCreated + pendingDebtBlock, בלי חלון אישור לפני ה-PUT', async () => {
  const st = baseState({ payments: [payment('p1', { amount: 300 })] });
  const h = harness(st, { edit: (s) => { s.items = [...s.items, { _localId: 'L', dressModelId: 'm', sizeText: '1', price: 100 }]; }, respond: (u) => (u.includes('validate') ? { body: { valid: true } } : serverOk(st, { obligations: [...st.obligations, { amount: 100 }] })) });
  const r = await h.flows.save({ intent: 'pay' });
  assert.equal(r.ok, true);
  assert.equal(r.debtCreated, 100);
  assert.equal(h.flags.pendingDebtBlock, true);
  assert.deepEqual(h.events[0], ['debtCreated', { amount: 100, source: 'save', intent: 'pay' }]);
  assert.equal(h.state.tab, 'payments');
  assert.equal(h.calls.find(c => c.method === 'PUT').body.debtApprovedBy, null);
});

test('יציאה בלי שינויים: ניווט ליעד order_edit_redirect_screen בלי קריאות (R44)', async () => {
  const h = harness(baseState(), { settings: [{ key: 'order_edit_redirect_screen', value: 'new_order' }] });
  await h.flows.exit();
  assert.deepEqual(h.nav, ['/orders/new']);
  assert.equal(h.calls.length, 0);
  const h2 = harness(baseState());
  await h2.flows.exit('/customers/c1');
  assert.deepEqual(h2.nav, ['/customers/c1']);
});

test('יציאה עם שינויים: D2 "שמור" → PUT בגוף handleExit + extraDay → ניווט; "צא בלי לשמור" → ניווט בלי PUT; "חזרה" → כלום', async () => {
  const st = baseState();
  const h = harness(st, { edit: withNotes, answers: { Exit: 'save' }, respond: (u) => (okValidate(u) ? { body: { valid: true } } : serverOk(st)) });
  const r = await h.flows.exit();
  assert.equal(r.left, true);
  const cur = { ...st, order: { ...st.order, notes: 'שונה' } };
  assert.deepEqual(h.calls.map(c => c.method + ' ' + c.url), ['POST /api/orders/validate-inventory', `PUT /api/orders/${ROUTE_ID}`]);
  assert.equal(h.calls[1].rawBody, JSON.stringify({ ...legacyExitBody(cur.order, cur, {}), extraDay: null, cardVariant: 'a5' }));
  assert.deepEqual(h.nav, ['/orders']);
  const h2 = harness(st, { edit: withNotes, answers: { Exit: 'discard' } });
  await h2.flows.exit('/x');
  assert.deepEqual([h2.calls.length, h2.nav], [0, ['/x']]);
  const h3 = harness(st, { edit: withNotes, answers: { Exit: null } });
  assert.equal((await h3.flows.exit()).left, false);
  assert.deepEqual([h3.calls.length, h3.nav.length], [0, 0]);
});

test('יציאה שיצרה חוב חדש: נשארים, debtCreated עם href, ובניסיון הבא (אחרי אישור חוב) PUT עם debtApprovedBy', async () => {
  const st = baseState({ payments: [payment('p1', { amount: 300 })] });
  const respond = (u) => (okValidate(u) ? { body: { valid: true } } : serverOk(st, { totalAmount: 0, obligations: [...st.obligations, { amount: 80 }] }));
  const h = harness(st, { edit: withNotes, answers: { Exit: 'save' }, respond });
  const r = await h.flows.exit();
  assert.deepEqual(r, { left: false, blocked: 'debt' });
  assert.equal(h.events[0][0], 'debtCreated');
  assert.equal(h.events[0][1].href, '/orders');
  assert.equal(h.flags.pendingDebtBlock, true);
  h.state.debtApproved = 'mgr9';
  h.flags.approvedDebtLevel = 80; // oc.approveDebt({amount:80})
  const r2 = await h.flows.exit();
  assert.equal(r2.left, true);
  assert.equal(h.calls.at(-1).body.debtApprovedBy, 'mgr9');
});

test('זיכוי אוטומטי בלי פרטי בנק ביציאה: נעצרים פעם אחת (autoRefundNeedsBank), בפעם השנייה יוצאים', async () => {
  const st = baseState({ payments: [payment('p1', { amount: 300 })] });
  const refunds = [{ isAutoGenerated: true, isExecuted: false, isDeleted: false, bankName: '', bankBranch: '' }];
  const h = harness(st, { edit: withNotes, answers: { Exit: 'save' }, respond: (u) => (okValidate(u) ? { body: { valid: true } } : serverOk(st, { refunds })) });
  assert.equal((await h.flows.exit()).blocked, 'bank');
  assert.equal(h.events[0][0], 'autoRefundNeedsBank');
  h.state.order = { ...h.state.order, notes: 'שוב' };
  assert.equal((await h.flows.exit()).left, true);
});

test('בטל שינויים (D7): POST /api/orders/<id>/cancel-changes {changes: סיכום הישן}, ה-state חוזר ל-snapshot', async () => {
  const st = baseState();
  const h = harness(st, { edit: withNotes, answers: { Discard: true } });
  assert.equal(await h.flows.discardAll(), true);
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(h.calls.map(c => `${c.method} ${c.url}`), [`POST /api/orders/${ROUTE_ID}/cancel-changes`]);
  assert.deepEqual(h.calls[0].body, { changes: ['הערות השתנה'] });
  assert.equal(h.state.order.notes, st.order.notes);
  assert.ok(LEGACY_SRC.includes('fetch(`/api/orders/${id}/cancel-changes`') && LEGACY_SRC.includes('body: JSON.stringify({ changes })'), 'אותו endpoint וגוף בישן');
});

test('מחיקת הזמנה: DELETE /api/orders/<orderId> (בלי גוף; עם ת״ז: x-zeout + {zeout}), ניווט ל-/orders; חסימה אחרי השכרה', async () => {
  const st = baseState();
  const h = harness(st, { respond: () => ({ body: { success: true } }) });
  assert.equal(await h.flows.deleteOrder(), true);
  assert.deepEqual([h.calls[0].method, h.calls[0].url, h.calls[0].headers, h.calls[0].rawBody], ['DELETE', `/api/orders/${st.order.orderId}`, {}, undefined]);
  assert.deepEqual(h.nav, ['/orders']);
  const st2 = baseState({ order: { customer: { zeout: '1' } } });
  const h2 = harness(st2, { settings: [{ key: 'require_id_for_edit_cancel', value: 'true' }, { key: 'require_customer_id_number', value: 'true' }], answers: { prompt: '1' }, respond: () => ({}) });
  await h2.flows.deleteOrder();
  assert.deepEqual(h2.calls[0].headers, { 'x-zeout': '1', 'Content-Type': 'application/json' });
  assert.deepEqual(h2.calls[0].body, { zeout: '1' });
  const h3 = harness(baseState({ items: [item('a1', { isTaken: true })] }));
  assert.equal(await h3.flows.deleteOrder(), false);
  assert.equal(h3.calls.length, 0);
  const del = LEGACY_SRC.slice(LEGACY_SRC.indexOf('const handleDeleteOrder'), LEGACY_SRC.indexOf('const isLocked'));
  assert.ok(del.includes("method: 'DELETE'") && del.includes("'x-zeout': zeoutForDelete") && del.includes("router.push('/orders')"));
});

test('חתימה על תקנון: PUT /api/orders/<id> {hasSignedRegulations, updatedAt} (בדיקת 409 בשרת), updatedAt מהתשובה נשמר', async () => {
  const st = baseState();
  const h = harness(st, { respond: () => ({ body: { ...st.order, hasSignedRegulations: true, updatedAt: '2026-10-04T11:00:00.000Z' } }) });
  assert.equal(await h.flows.toggleSignature(), true);
  assert.deepEqual([h.calls[0].method, h.calls[0].url, h.calls[0].body], ['PUT', `/api/orders/${ROUTE_ID}`, { hasSignedRegulations: true, updatedAt: st.order.updatedAt }]);
  assert.equal(h.state.order.hasSignedRegulations, true);
  assert.equal(h.state.order.updatedAt, '2026-10-04T11:00:00.000Z');
  assert.equal(h.state.snapshot.order.hasSignedRegulations, true, 'נשמר - לא "שינוי" ברייל');
  const sig = LEGACY_SRC.slice(LEGACY_SRC.indexOf('const handleToggleSignature'), LEGACY_SRC.indexOf('const handleQuickScan'));
  assert.ok(sig.includes('fetch(`/api/orders/${id}`') && sig.includes("method: 'PUT'") && sig.includes('JSON.stringify({ hasSignedRegulations: nowYes })'));
});

test('טעינה מחדש: GET /api/orders/<id> ומאפס snapshot ו-openedDebt', async () => {
  const st = baseState();
  const h = harness(st, { edit: withNotes, respond: () => serverOk(st) });
  assert.equal(await h.flows.reload(), true);
  assert.deepEqual(h.calls.map(c => c.method + ' ' + c.url), [`GET /api/orders/${ROUTE_ID}`]);
  assert.equal(h.state.order.notes, st.order.notes);
  assert.equal(h.state.openedDebt, 200);
});

test('applyServerOrder (= handleOrderUpdate): שורת פריט לוקאלית נשמרת, ה-snapshot = מצב השרת', () => {
  const st = baseState();
  const h = harness(st, { edit: (s) => { s.items = [...s.items, { _localId: 'L1' }, { _localId: 'L2' }]; } });
  h.flows.applyServerOrder({ ...st.order, items: [...st.items, { id: 'a3' }], obligations: st.obligations, payments: st.payments, refunds: [] }, { savedLocalId: 'L1' });
  assert.deepEqual(h.state.items.map(i => i.id || i._localId), ['a1', 'a2', 'a3', 'L2']);
  assert.deepEqual(h.state.snapshot.items.map(i => i.id), ['a1', 'a2', 'a3']);
  assert.deepEqual(L.changesOf(h.state.snapshot, h.state).map(c => c.key), ['item:add:L2'], 'רק השורה שלא נשלחה נשארת "שינוי"');
});

test('אישורי מנהל: OcApproval שולח ל-verify-pin את {pin, employeeId, requiredLevel} של הישן + context; אין window.customAuthPrompt', () => {
  const src = fs.readFileSync(process.env.PROJ + '/app/components/order-card/OcApproval.js', 'utf8');
  assert.ok(src.includes("'/api/auth/verify-pin'"));
  assert.ok(/JSON\.stringify\(verifyPinBody\(\{ pin, employeeId: sel, requiredLevel: level\.requiredLevel, orderId, reason \}\)\)/.test(src));
  assert.deepEqual(L.verifyPinBody({ pin: 'x', employeeId: 'e', requiredLevel: 'feature:locked_order_edit', orderId: 53375, reason: 'ר'.repeat(250) }), { pin: 'x', employeeId: 'e', requiredLevel: 'feature:locked_order_edit', context: { orderId: 53375, reason: 'ר'.repeat(200) } });
  assert.deepEqual(L.verifyPinBody({ pin: 'x', employeeId: 'e', requiredLevel: 'עובד', orderId: undefined, reason: 'r' }), { pin: 'x', employeeId: 'e', requiredLevel: 'עובד' }, 'בלי מספר הזמנה תקין - בלי context (W0: context לא תקין = 400)');
  for (const lvl of ["'feature:locked_order_edit'", "'feature:item_change_approval'", "'feature:manual_payment_credit_add'"]) assert.ok(LEGACY_SRC.includes(`requiredLevel: ${lvl}`), `הישן מאמת ${lvl}`);
  const ctl = fs.readFileSync(process.env.PROJ + '/app/components/order-card/useOrderCardController.js', 'utf8');
  assert.ok(ctl.includes("approve('feature:locked_order_edit'"), 'unlock = feature:locked_order_edit כמו handleUnlock');
  const flows = fs.readFileSync(process.env.PROJ + '/app/components/order-card/orderCardFlows.js', 'utf8');
  assert.ok(flows.includes("env.approve('feature:item_change_approval'"), 'ביטול פריט = feature:item_change_approval כמו handleSave');
});

test('חוזה W0: 403 MANUAL_CHARGE_APPROVAL_REQUIRED → אישור feature:manual_charge_add ושליחה חוזרת עם manualChargeApproverId/Pin', async () => {
  const st = baseState();
  let asked = null;
  const h = harness(st, {
    edit: (s) => { s.obligations = [...s.obligations, { amount: 40, description: 'ידני', isManual: true, isNew: true }]; },
    approve: async (kind) => { asked = kind; return { employeeId: 'mg', employeeName: 'מ', pin: 'k' }; },
    respond: (u, o, n) => (u.includes('validate') ? { body: { valid: true } } : (o.method === 'PUT' && n === 2 ? { status: 403, body: { code: 'MANUAL_CHARGE_APPROVAL_REQUIRED', error: 'x' } } : serverOk(st))),
  });
  const r = await h.flows.save();
  assert.equal(r.ok, true);
  assert.equal(asked, 'feature:manual_charge_add');
  const puts = h.calls.filter(c => c.method === 'PUT');
  assert.equal(puts.length, 2);
  assert.deepEqual([puts[1].body.manualChargeApproverId, puts[1].body.manualChargeApproverPin, puts[1].body.cardVariant], ['mg', 'k', 'a5']);
  assert.ok(!h.opened.some(x => x[0] === 'alert'), 'בלי חלון שגיאה כשהאישור הצליח');
});

test('חוזה W0: 409 code CONFLICT הוא התנגשות גם אם יש בגוף validationErrors', async () => {
  const st = baseState();
  const h = harness(st, { edit: withNotes, respond: (u, o) => (u.includes('validate') ? { body: { valid: true } } : (o.method === 'PUT' ? { status: 409, body: { code: 'CONFLICT', validationErrors: [] } } : {})) });
  await h.flows.save();
  assert.ok(h.opened.some(x => x[0] === 'Conflict'));
  assert.ok(!h.opened.some(x => x[0] === 'Stock'));
});

// ===================== תיקוני הסקירה (כל בדיקה נכשלת בלי התיקון שלה) =====================

test('סקירה 2: אישור חוב מכסה רק עד הרמה שאושרה - שמירה שיוצרת חוב גדול יותר מבטלת אותו וחוסמת שוב', async () => {
  const st = baseState({ payments: [payment('p1', { amount: 300 })] });
  const h = harness(st, { edit: withNotes, respond: (u) => (okValidate(u) ? { body: { valid: true } } : serverOk(st, { obligations: [...st.obligations, { amount: 180 }] })) });
  h.state.debtApproved = 'mgr9';
  h.flags.approvedDebtLevel = 100;
  const r = await h.flows.save();
  assert.equal(r.debtCreated, 180);
  assert.equal(h.state.debtApproved, false, 'האישור (עד ₪100) לא מכסה חוב ₪180');
  assert.equal(h.flags.pendingDebtBlock, true);
  // חוב בתוך הרמה שאושרה - האישור נשאר והיציאה לא נחסמת
  const h2 = harness(st, { edit: withNotes, respond: (u) => (okValidate(u) ? { body: { valid: true } } : serverOk(st, { obligations: [...st.obligations, { amount: 60 }] })) });
  h2.state.debtApproved = 'mgr9';
  h2.flags.approvedDebtLevel = 100;
  await h2.flows.save();
  assert.equal(h2.state.debtApproved, 'mgr9');
  assert.equal(h2.flags.pendingDebtBlock, false);
});

test('סקירה 2: ביציאה - אישור ישן שלא מכסה את החוב לא נשלח ב-PUT, האישור מתאפס והיציאה נחסמת', async () => {
  const st = baseState({ payments: [payment('p1', { amount: 300 })] });
  const respond = (u) => (okValidate(u) ? { body: { valid: true } } : serverOk(st, { totalAmount: 0, obligations: [...st.obligations, { amount: 200 }] }));
  const h = harness(st, { edit: (s) => { withNotes(s); s.obligations = [...s.obligations, { _localId: 'M', amount: 200, isManual: true, description: 'ידני' }]; }, answers: { Exit: 'save' }, respond });
  h.state.debtApproved = 'mgr9';
  h.flags.approvedDebtLevel = 50;
  const r = await h.flows.exit();
  assert.deepEqual(r, { left: false, blocked: 'debt' });
  assert.equal(h.calls.find(c => c.method === 'PUT').body.debtApprovedBy, null, 'חוב צד-לקוח ₪200 > ₪50 שאושרו');
  assert.equal(h.state.debtApproved, false);
});

test('סקירה 3: חתימה - 409 → שליחה חוזרת עם overwriteConflict ושמירת updatedAt הישן ב-state', async () => {
  const st = baseState();
  const h = harness(st, { respond: (u, o, n) => (n === 1 ? { status: 409, body: { code: 'CONFLICT' } } : { body: { ...st.order, hasSignedRegulations: true, updatedAt: '2026-10-04T12:00:00.000Z' } }) });
  assert.equal(await h.flows.toggleSignature(), true);
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.calls[1].body, { hasSignedRegulations: true, updatedAt: st.order.updatedAt, overwriteConflict: true });
  assert.equal(h.state.order.updatedAt, st.order.updatedAt, 'השינוי של המשתמש האחר יזוהה בשמירה הבאה');
  assert.equal(h.state.order.hasSignedRegulations, true);
});

test('סקירה 4: פעולה שנייה בזמן שמירה/יציאה/מחיקה רצה - נדחית בלי קריאות נוספות', async () => {
  const st = baseState();
  const settings = [{ key: 'enable_order_edit_summary_confirm', value: 'true' }];
  const h = harness(st, { settings, edit: withNotes, answers: { Summary: true }, respond: (u) => (okValidate(u) ? { body: { valid: true } } : u.includes('preview') ? { body: { newObligations: [] } } : serverOk(st)) });
  const p1 = h.flows.save(); // רצה (ממתינה ל-fetch) כשהפעולות הבאות נלחצות
  const second = await h.flows.save();
  const third = await h.flows.exit('/x');
  const fourth = await h.flows.deleteOrder();
  assert.equal(second.busy, 'save');
  assert.equal(third.busy, 'save');
  assert.equal(fourth, false);
  assert.equal((await p1).ok, true);
  assert.equal(h.calls.filter(c => c.method === 'PUT').length, 1, 'רק השמירה הראשונה הגיעה לשרת');
  assert.equal(h.calls.filter(c => c.method === 'DELETE').length, 0);
  assert.deepEqual(h.nav, []);
  assert.equal(h.flows.isBusy(), null, 'אחרי הסיום אפשר שוב');
});

test('סקירה 7: "שמור וצא" עובר את שערי השמירה - תיקון בלי פירוט / חוסר מלאי / אישור ביטול פריט חוסמים את היציאה', async () => {
  const st = baseState();
  const h = harness(st, { edit: (s) => { s.items = [{ ...s.items[0], neckAlteration: 1, alterationDetails: '' }, s.items[1]]; }, answers: { Exit: 'save' } });
  assert.equal((await h.flows.exit()).left, false);
  assert.deepEqual([h.calls.length, h.nav.length], [0, 0]);
  const h2 = harness(st, { edit: withNotes, answers: { Exit: 'save' }, respond: () => ({ body: { valid: false, errors: [{ dressName: 'א', sizeText: '1', requested: 1, available: 0 }] } }) });
  assert.equal((await h2.flows.exit()).left, false);
  assert.ok(h2.opened.some(x => x[0] === 'Stock'));
  assert.equal(h2.calls.filter(c => c.method === 'PUT').length, 0);
  let asked = null;
  const h3 = harness(st, { settings: [{ key: 'require_manager_code_for_item_changes', value: 'true' }], edit: (s) => { s.items = [s.items[0], { ...s.items[1], isDeleted: true }]; }, answers: { Exit: 'save' }, approve: async (k) => { asked = k; return null; }, respond: () => ({ body: { valid: true } }) });
  assert.equal((await h3.flows.exit()).left, false);
  assert.equal(asked, 'feature:item_change_approval');
  assert.equal(h3.calls.filter(c => c.method === 'PUT').length, 0);
});

test('סקירה 1: הגנות היציאה פעילות גם כשאין שינויים אבל היציאה חסומה בחוב (exitGuardActive בבקר)', () => {
  assert.equal(L.exitGuardActive(false, true), true);
  assert.equal(L.exitGuardActive(true, false), true);
  assert.equal(L.exitGuardActive(false, false), false);
  const ctl = fs.readFileSync(process.env.PROJ + '/app/components/order-card/useOrderCardController.js', 'utf8');
  assert.ok(/const exitGuard = exitGuardActive\(dirty, pendingDebtBlock\)/.test(ctl));
  assert.equal((ctl.match(/if \(!exitGuard\) return undefined;/g) || []).length, 2, 'beforeunload + יירוט קישורים');
  assert.equal((ctl.match(/\}, \[exitGuard\]\);/g) || []).length, 2);
  assert.ok(!/if \(!dirty\) return undefined;\s*const h = \(e\)/.test(ctl));
  assert.ok(/exitRef\.current\(href\)/.test(ctl), 'קישור שיורט עובר דרך exit()');
  // ובזרימה: יציאה כשהחסימה פעילה ואין שינויים - לא מנווטים בלי PUT/בדיקת חוב
  return (async () => {
    const st = baseState({ payments: [payment('p1', { amount: 300 })] });
    const h = harness(st, { respond: (u) => (okValidate(u) ? { body: { valid: true } } : serverOk(st, { totalAmount: 0, obligations: [...st.obligations, { amount: 80 }] })) });
    h.flags.pendingDebtBlock = true;
    const r = await h.flows.exit('/orders');
    assert.deepEqual(r, { left: false, blocked: 'debt' });
    assert.equal(h.nav.length, 0);
  })();
});

// ---------------------------------------------------------------------------------------------
// דיווח 72a80404 (נווה יעקב, 5.10.2026): ת״ז פעם אחת לביקור בהזמנה, מאחורי customer_id_once_per_order_visit
// ---------------------------------------------------------------------------------------------
const ID_SETTINGS = [{ key: 'require_id_for_edit_cancel', value: 'true' }, { key: 'require_customer_id_number', value: 'true' }];
const ID_ONCE = [...ID_SETTINGS, { key: 'customer_id_once_per_order_visit', value: 'true' }];
const idState = () => baseState({ order: { customer: { firstName: 'א', zeout: '123456789' } } });
const idRespond = (st) => (u) => (u.includes('validate') ? { body: { valid: true } } : serverOk(st));
const prompts = (h) => h.opened.filter(o => o[0] === 'prompt').length;
const putsOf = (h) => h.calls.filter(c => c.method === 'PUT');

test('72a80404: ההגדרה כבויה (ברירת מחדל) - ת״ז בכל שמירה, כמו היום', async () => {
  const st = idState();
  const h = harness(st, { settings: ID_SETTINGS, edit: withNotes, answers: { prompt: '123456789' }, respond: idRespond(st) });
  await h.flows.save();
  h.state.order = { ...h.state.order, notes: 'שונה שוב' };
  await h.flows.save();
  assert.equal(putsOf(h).length, 2);
  assert.equal(prompts(h), 2);
});

test('72a80404: ההגדרה דולקת - ת״ז נשאלת פעם אחת ונשלחת בכל השמירות (השרת ממשיך לאמת)', async () => {
  const st = idState();
  const h = harness(st, { settings: ID_ONCE, edit: withNotes, answers: { prompt: ' 123456789 ' }, respond: idRespond(st) });
  await h.flows.save();
  h.state.order = { ...h.state.order, notes: 'שונה שוב' };
  await h.flows.save();
  h.state.order = { ...h.state.order, notes: 'שלישית' };
  await h.flows.save();
  const puts = putsOf(h);
  assert.equal(puts.length, 3);
  assert.equal(prompts(h), 1, 'פעם אחת בלבד');
  for (const c of puts) { assert.equal(c.headers['x-zeout'], '123456789'); assert.equal(c.body.zeout, '123456789'); }
});

test('72a80404: השרת דחה את הת״ז (לא תואמת) - הזיכרון נמחק והשמירה הבאה שואלת שוב', async () => {
  const st = idState();
  let n = 0;
  const h = harness(st, { settings: ID_ONCE, edit: withNotes, answers: { prompt: '111111111' }, respond: (u) => {
    if (u.includes('validate')) return { body: { valid: true } };
    n += 1;
    return n === 1 ? { status: 403, body: { error: 'תעודת הזהות אינה תואמת לרשום אצל הלקוח.' } } : serverOk(st);
  } });
  await h.flows.save();
  assert.equal(h.flags.verifiedZeout, null, 'ת״ז שנדחתה לא נזכרת');
  await h.flows.save();
  assert.equal(prompts(h), 2);
});

test('72a80404: שגיאת 403 שאינה ת״ז (למשל אישור מנהל) לא מוחקת את הזיכרון', async () => {
  const st = idState();
  const h = harness(st, { settings: ID_ONCE, edit: withNotes, answers: { prompt: '123456789' }, respond: (u) => (u.includes('validate') ? { body: { valid: true } } : { status: 403, body: { error: 'דרוש אישור מנהל' } }) });
  await h.flows.save();
  assert.equal(h.flags.verifiedZeout.zeout, '123456789');
});

test('72a80404: ביטול הזמנה שלמה תמיד שואל מחדש, וחילוף לקוח מבקש ת״ז חדשה', async () => {
  const st = idState();
  const h = harness(st, { settings: ID_ONCE, edit: withNotes, answers: { prompt: '123456789' }, respond: (u) => (u.includes('validate') ? { body: { valid: true } } : serverOk(st)) });
  await h.flows.save();
  assert.equal(prompts(h), 1);
  await h.flows.deleteOrder();
  assert.equal(prompts(h), 2, 'מחיקה = שאלה טרייה');
  h.state.order = { ...h.state.order, customerId: 'another-customer', notes: 'x' };
  await h.flows.save();
  assert.equal(prompts(h), 3, 'לקוח אחר = ת״ז אחרת');
});

test('72a80404: הישן - אותו זיכרון בדף בלבד (ref), בלי localStorage; ביטול הזמנה שלמה fresh; ה-PUT עדיין נושא ת״ז', () => {
  const src = LEGACY_SRC;
  assert.ok(src.includes("data.find(s => s.key === 'customer_id_once_per_order_visit')"));
  const req = src.slice(src.indexOf('const requestZeout'), src.indexOf('// Fetch Order'));
  assert.ok(req.includes('verifiedZeoutRef.current') && req.includes('idOncePerOrderVisit') && !/localStorage|sessionStorage/.test(req));
  assert.ok(src.includes('requestZeout({ fresh: true })'), 'ביטול הזמנה שלמה שואל מחדש');
  assert.ok(src.includes("headers: { 'Content-Type': 'application/json', ...(zeoutForRequest ? { 'x-zeout': zeoutForRequest } : {}) }"), 'ה-PUT עדיין נושא את הת״ז');
  assert.ok(/useEffect\(\(\) => \{ verifiedZeoutRef\.current = null; \}, \[id\]\)/.test(src), 'מעבר להזמנה אחרת מנקה');
});

// ---------------------------------------------------------------------------------------------
// דיווח f6da1794: רענון כשחוזרים לכרטיס אחרי שינוי ממקום אחר
// ---------------------------------------------------------------------------------------------
test('f6da1794: orderServerSignature - החזרת שמלה משנה חתימה, אותו מצב = אותה חתימה', () => {
  const st = baseState();
  const snap = (items) => ({ order: st.order, items, obligations: st.obligations, payments: st.payments, refunds: [] });
  const a = L.orderServerSignature(snap(st.items));
  assert.equal(a, L.orderServerSignature(JSON.parse(JSON.stringify(snap(st.items)))));
  const returned = st.items.map((i, k) => (k === 0 ? { ...i, isReturned: true, isTaken: true } : i));
  assert.notEqual(a, L.orderServerSignature(snap(returned)));
  assert.equal(L.orderServerSignature(null), '');
});

test('f6da1794: הישן - בדיקה רק בפוקוס/חזרת לשונית, מרווח 15 שניות, לא דורס שינויים שלא נשמרו', () => {
  const src = LEGACY_SRC;
  assert.ok(src.includes('EXTERNAL_CHECK_MIN_GAP_MS = 15000'));
  assert.ok(src.includes("window.addEventListener('focus', check)") && src.includes("document.addEventListener('visibilitychange', check)"));
  assert.ok(!/setInterval/.test(src.slice(src.indexOf('const EXTERNAL_CHECK_MIN_GAP_MS'), src.indexOf('const handleRefreshFromElsewhere'))), 'בלי בדיקה מחזורית');
  assert.ok(src.includes("if (live.dirty || live.busy) { setExternalNotice('dirty'); return; }"), 'שינויים שלא נשמרו = הודעה בלבד');
  assert.ok(src.includes('ההזמנה עודכנה ממקום אחר — רענן'));
});

// ---------------------------------------------------------------------------------------------
// דיווח 2c827b93: לשונית ההדפסה נפתחת בלי opener (תהליך נפרד ב-Chromium)
// ---------------------------------------------------------------------------------------------
test('2c827b93: כל פתיחות דף ההדפסה אחרי יצירה/שמירה של הזמנה הן עם noopener', () => {
  const read = (rel) => fs.readFileSync(process.env.PROJ + '/' + rel, 'utf8');
  const targets = [
    ['app/orders/[id]/LegacyOrderPage.js', "window.open(`/print/order?orderId=${updatedOrder.orderId}&type=order`, '_blank', 'noopener')"],
    ['app/orders/new/LegacyNewOrderPage.js', "window.open(`/print/order?orderId=${data.orderId}&type=order`, '_blank', 'noopener')"],
    ['app/components/new-order/useNewOrderController.js', "window.open(`/print/order?orderId=${data.orderId}&type=order`, '_blank', 'noopener')"],
    ['app/components/new-order/useNewOrderController.js', "window.open(`/print/order?orderId=${saved.orderId}&type=order`, '_blank', 'noopener')"],
    ['components/orders/OrderPrintMenu.js', "window.open(`/print/order?orderId=${order.orderId}&type=${type}`, '_blank', 'noopener')"],
    ['app/components/order-card/parts/OcRail.js', "window.open(printUrl(order.orderId), '_blank', 'noopener')"],
  ];
  for (const [f, needle] of targets) assert.ok(read(f).includes(needle), f);
});
