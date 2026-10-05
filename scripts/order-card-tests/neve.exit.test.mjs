// "יציאה טורית" + "אין שינויים לשמירה" (R49) בכרטיס החדש (orderCardFlows.js, W1) מול handleExit / handleSave של ענף נווה יעקב
// (צילום handleExit ב-neve-oracle/page-handleExit.js.txt). W1 כבר מימש את הזרימה; כאן נבדקת הזוגיות של טבלת ההחלטות מול הנווה:
//   יציאה נקייה בלי חסימה = ניווט מיד בלי PUT · שינויים = שלוש בחירות (שמור/זרוק/חזור) · חוב חדש אחרי השמירה (>סף) = חסימה, מעבר לתשלומים,
//   ניסיון יציאה חוזר לא שואל שוב "לשמור?" אלא שולח PUT שוב ובודק חוב · אישור חוב מכסה · סף חוב newDebt = openedDebt + 0.01 · יעד היציאה לפי
//   order_edit_redirect_screen (אותו lib/orderRedirectScreens.js) · "אין שינויים לשמירה" = בלי PUT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { baseState, payment, obligation } from './fixtures.mjs';

const PROJ = process.env.PROJ;
const NEVE = fs.readFileSync(path.join(PROJ, 'scripts/order-card-tests/neve-oracle/page-handleExit.js.txt'), 'utf8').split('\r\n').join('\n');
const P = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const L = await P('app/components/order-card/orderCardLogic.js');
const { createOrderCardFlows } = await P('app/components/order-card/orderCardFlows.js');
const { resolveOrderRedirectHref } = await P('lib/orderRedirectScreens.js');
const snapOf = (x) => JSON.parse(JSON.stringify(x));
const DIALOGS = { ConflictDialog: 'Conflict', StockDialog: 'Stock', SummaryDialog: 'Summary', ExitDialog: 'Exit', DiscardDialog: 'Discard' };

function harness(st, { settings = [], respond = () => ({}), answers = {}, edit = null, debtApproved = false, approvedLevel = null } = {}) {
  const state = { ...snapOf(st), snapshot: snapOf(st), openedDebt: L.openedDebtOf(st.obligations, st.payments), settings: L.parseSettings(settings), debtApproved };
  if (edit) edit(state);
  const calls = [], opened = [], toasts = [], nav = [], events = [];
  const flags = { pendingDebtBlock: false, bankPromptedOnExit: false, approvedDebtLevel: approvedLevel };
  const setter = (k) => (v) => { state[k] = typeof v === 'function' ? v(state[k]) : v; };
  const ui = {
    confirm: async () => true, prompt: async () => null, alert: async (o) => { opened.push(['alert', o]); }, toast: (...a) => toasts.push(a),
    openDialog: async (C, p) => { opened.push([C, p]); return answers[C] ?? null; },
  };
  const env = {
    fetch: async (url, opts = {}) => {
      calls.push({ url, method: opts.method || 'GET', body: opts.body !== undefined ? JSON.parse(opts.body) : undefined });
      const r = respond(url, opts, calls.length) || {};
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
    },
    ui, dialogs: DIALOGS, routeId: '53375', get: () => state,
    set: { order: setter('order'), items: setter('items'), obligations: setter('obligations'), payments: setter('payments'), refunds: setter('refunds'), tab: setter('tab'), saving: setter('saving') },
    setSnapshot: (s) => { state.snapshot = s; }, setOpenedDebt: (n) => { state.openedDebt = n; }, setDebtApproved: (v) => { state.debtApproved = v; },
    flags, approve: async () => null, navigate: (h) => nav.push(h), emit: (type, payload) => { events.push([type, payload]); return 0; }, bumpHistory: () => {}, clearRedo: () => {},
  };
  return { flows: createOrderCardFlows(env), state, calls, opened, toasts, nav, events, flags };
}
const paidState = (over = {}) => baseState({ payments: [payment('p1', { amount: 300 })], ...over }); // חוב פתוח 0
const withNotes = (s) => { s.order = { ...s.order, notes: 'שונה' }; };
const server = (st, extra = {}) => ({ body: { ...st.order, items: st.items, obligations: st.obligations, payments: st.payments, refunds: [], updatedAt: '2026-10-04T10:00:00.000Z', ...extra } });
const reply = (st, extra) => (u) => (u.includes('validate-inventory') ? { body: { valid: true } } : server(st, extra));
const delivery = (amount) => obligation('ob-del', { amount, description: 'משלוח הלוך-חזור - ירושלים', isManual: false });
// תשובת השרת אחרי חיוב משלוח שנוצר רק בשרת: obligations + totalAmount (ביציאה W1/נווה קוראים totalAmount קודם)
const withDelivery = (st, amount, extra = {}) => ({ obligations: [...st.obligations, delivery(amount)], totalAmount: 300 + amount, ...extra });

test('אורקל: הכללים שנבדקים כאן קיימים במקור של נווה (handleExit)', () => {
  for (const expr of [
    'if (!hasUnsavedChanges && !pendingDebtBlockRef.current) {',
    'if (hasUnsavedChanges && !pendingDebtBlockRef.current) {',
    'freshDebtNow > openedDebtRounded + 0.01 && !exitDebtApprovedBy',
    'pendingDebtBlockRef.current = true;',
    "setActiveTab('payments');",
    'pendingDebtBlockRef.current = false;',
    'router.push(fallbackExitHref);',
    'const exitDebtUnchangedSinceOpen = openedDebt !== null',
  ]) assert.ok(NEVE.includes(expr), `חסר במקור: ${expr}`);
});

test('יציאה נקייה (בלי שינויים ובלי חסימה): ניווט מיד, אפס קריאות; יעד = order_edit_redirect_screen כמו נווה', async () => {
  for (const screen of [undefined, 'orders_list', 'customer_card', 'order_card', 'home', 'weird']) {
    const st = paidState();
    const settings = screen === undefined ? [] : [{ key: 'order_edit_redirect_screen', value: screen }];
    const h = harness(st, { settings });
    const r = await h.flows.exit();
    assert.deepEqual(r, { left: true });
    assert.equal(h.calls.length, 0);
    assert.deepEqual(h.nav, [resolveOrderRedirectHref(screen === undefined ? 'orders_list' : screen, { orderId: st.order.orderId, customerId: st.order.customerId })]);
  }
  const h = harness(paidState());
  await h.flows.exit('/customers/c1');
  assert.deepEqual(h.nav, ['/customers/c1'], 'יעד מפורש גובר');
});

test('שינויים: נפתחת בחירה (שמור / זרוק / חזור): "זרוק" = ניווט בלי PUT; "חזור" = נשארים', async () => {
  const h1 = harness(paidState(), { edit: withNotes, answers: { Exit: 'discard' } });
  assert.deepEqual(await h1.flows.exit(), { left: true });
  assert.equal(h1.calls.length, 0);
  assert.equal(h1.opened.filter(o => o[0] === 'Exit').length, 1);
  const h2 = harness(paidState(), { edit: withNotes, answers: { Exit: null } });
  const r2 = await h2.flows.exit();
  assert.equal(r2.left, false); assert.equal(h2.nav.length, 0); assert.equal(h2.calls.length, 0);
});

test('"אין שינויים לשמירה": save בלי שינוי = טוסט, בלי PUT (גם כשהכרטיס נפתח עם חוב קיים)', async () => {
  for (const st of [paidState(), baseState()]) {
    const h = harness(st);
    const r = await h.flows.save();
    assert.equal(r.noop, true);
    assert.equal(h.calls.length, 0);
    assert.equal(h.toasts[0][1], 'אין שינויים לשמירה');
  }
});

test('יציאה טורית: שמירה יוצרת חוב חדש (חיוב משלוח מהשרת) → חסימה, לשונית תשלומים, debtCreated, בלי ניווט', async () => {
  const st = paidState();
  const fresh = withDelivery(st, 100);
  const h = harness(st, { edit: withNotes, answers: { Exit: 'save' }, respond: reply(st, fresh) });
  const r = await h.flows.exit();
  assert.deepEqual(r, { left: false, blocked: 'debt' });
  assert.equal(h.flags.pendingDebtBlock, true);
  assert.equal(h.state.tab, 'payments');
  assert.equal(h.nav.length, 0);
  const ev = h.events.find(e => e[0] === 'debtCreated');
  assert.equal(ev[1].amount, 100); assert.equal(ev[1].source, 'exit');
  assert.deepEqual(h.calls.map(c => c.method), ['POST', 'PUT'], 'validate-inventory ואז PUT');
});

test('ניסיון יציאה חוזר אחרי החסימה: בלי "לשמור?" (כמו pendingDebtBlockRef בנווה), PUT נשלח שוב; אישור חוב שמכסה = יוצאים ו-pendingDebtBlock מתאפס', async () => {
  const st = paidState();
  const fresh = withDelivery(st, 100);
  const h = harness(st, { edit: withNotes, answers: { Exit: 'save' }, respond: reply(st, fresh) });
  await h.flows.exit();
  const exitDialogsBefore = h.opened.filter(o => o[0] === 'Exit').length;
  const putsBefore = h.calls.filter(c => c.method === 'PUT').length;
  // עדיין חוב ולא אושר: חוסם שוב
  const again = await h.flows.exit();
  assert.equal(again.blocked, 'debt');
  assert.equal(h.opened.filter(o => o[0] === 'Exit').length, exitDialogsBefore, 'לא נשאלת שוב בחירת שמירה');
  assert.equal(h.calls.filter(c => c.method === 'PUT').length, putsBefore + 1, 'ה-PUT נשלח שוב (כמו נווה: אין קיצור "אין שינויים")');
  assert.equal(h.nav.length, 0);
  // אישור מנהל לחוב (oc.approveDebt) שמכסה את הסכום → יציאה
  h.state.debtApproved = 'e2'; h.flags.approvedDebtLevel = 100;
  const done = await h.flows.exit();
  assert.deepEqual(done, { left: true });
  assert.equal(h.flags.pendingDebtBlock, false);
  assert.equal(h.nav.length, 1);
  const lastPut = h.calls.filter(c => c.method === 'PUT').at(-1);
  assert.equal(lastPut.body.debtApprovedBy, 'e2', 'debtApprovedBy נשלח ב-PUT של היציאה');
});

test('תשלום בין הניסיונות (החוב נסגר בשרת) → יציאה חופשית; סף החוב החדש = opened + 0.01 כמו נווה (לא נחסם על 0.01 / חוב קיים שלא גדל)', async () => {
  const st = paidState();
  // סף: חוב חדש של 0.01 אינו "חדש" (freshDebtNow > openedDebtRounded + 0.01), 0.02 כן
  for (const [amt, blocked] of [[0.01, false], [0.02, true], [5, true]]) {
    const h = harness(st, { edit: withNotes, answers: { Exit: 'save' }, respond: reply(st, withDelivery(st, amt)) });
    const r = await h.flows.exit();
    assert.equal(!!r.blocked, blocked, `חוב ${amt}`);
  }
  // חוב קיים שנפתח עם הכרטיס ולא גדל: לא חוסם
  const owing = baseState(); // חוב פתוח 200
  const h2 = harness(owing, { edit: withNotes, answers: { Exit: 'save' }, respond: reply(owing) });
  const r2 = await h2.flows.exit();
  assert.deepEqual(r2, { left: true });
  // תשלום בין הניסיונות
  const fresh = withDelivery(st, 100);
  const h3 = harness(st, { edit: withNotes, answers: { Exit: 'save' }, respond: reply(st, fresh) });
  await h3.flows.exit();
  h3.state.payments = [...h3.state.payments, payment('p2', { amount: 100 })];
  const h3respond = reply(st, { ...fresh, payments: [...st.payments, payment('p2', { amount: 100 })] });
  // הלקוח מדמה את תשובת השרת אחרי התשלום
  h3.calls.length = 0;
  const env2 = harness(st, { edit: withNotes, answers: { Exit: 'save' }, respond: h3respond });
  env2.flags.pendingDebtBlock = true;
  const done = await env2.flows.exit();
  assert.deepEqual(done, { left: true });
  assert.equal(env2.flags.pendingDebtBlock, false);
});

test('יציאה אחרי שמירה (save) שיצרה חוב: debtCreated עם source=save והחסימה נשארת עד טיפול (חיוב משלוח שנוצר בשרת בלבד - דיווח 6124472b)', async () => {
  const st = paidState();
  const fresh = withDelivery(st, 100);
  const h = harness(st, { edit: withNotes, respond: reply(st, fresh) });
  const r = await h.flows.save({ intent: 'save' });
  assert.equal(r.ok, true); assert.equal(r.debtCreated, 100);
  const ev = h.events.find(e => e[0] === 'debtCreated');
  assert.equal(ev[1].amount, 100); assert.equal(ev[1].source, 'save');
  assert.equal(h.flags.pendingDebtBlock, true);
  assert.equal(h.state.tab, 'payments');
  // ניסיון יציאה מיד אחרי: חסום (אין שינויים, אבל pendingDebtBlock)
  const x = await h.flows.exit();
  assert.equal(x.blocked, 'debt');
  assert.equal(h.nav.length, 0);
});

// ---------------- סקירה 3: כישלון בשמירת ההצטרפות למשלוח אינו שקט ----------------
test('סקירה 3: שמירה - joinError מהשרת מוצג כטוסט שגיאה, לא נשמר ב-state/snapshot, ושאר השמירה תקינה', async () => {
  const st = paidState();
  const h = harness(st, { edit: (s) => { s.order = { ...s.order, notes: 'שונה', deliveryJoinedTo: 7 }; }, respond: reply(st, { joinError: 'המשלוח שנבחר הוא ביום אירוע אחר מזה של ההזמנה - לא ניתן להצטרף אליו' }) });
  const r = await h.flows.save();
  assert.equal(r.ok, true);
  assert.equal(r.joinError, 'המשלוח שנבחר הוא ביום אירוע אחר מזה של ההזמנה - לא ניתן להצטרף אליו');
  assert.equal(h.calls.find(c => c.method === 'PUT').body.deliveryJoin.joinedToOrderId, 7);
  const t = h.toasts.find(x => x[0] === 'error' && /ההצטרפות למשלוח לא נשמרה/.test(x[1]));
  assert.ok(t, 'טוסט שגיאה');
  assert.match(t[2], /ביום אירוע אחר/); assert.match(t[2], /במחיר המלא/);
  assert.ok(!('joinError' in h.state.order), 'joinError לא נשאר ב-order');
  assert.ok(!('joinError' in h.state.snapshot.order), 'joinError לא נשאר ב-snapshot');
});

test('סקירה 3: שמירה בלי joinError = אין טוסט הצטרפות', async () => {
  const st = paidState();
  const h = harness(st, { edit: withNotes, respond: reply(st) });
  const r = await h.flows.save();
  assert.equal(r.ok, true); assert.ok(!('joinError' in r));
  assert.ok(!h.toasts.some(x => /הצטרפות/.test(String(x[1]))));
});

test('סקירה 3: יציאה עם joinError - לא יוצאים בשקט: התראה, נשארים בכרטיס, מצב השרת מוחל', async () => {
  const st = paidState();
  const h = harness(st, { edit: (s) => { s.order = { ...s.order, notes: 'שונה', deliveryJoinedTo: 7 }; }, answers: { Exit: 'save' }, respond: reply(st, { joinError: 'המשלוח שנבחר כבר אינו קיים' }) });
  const r = await h.flows.exit();
  assert.equal(r.left, false); assert.equal(r.joinError, 'המשלוח שנבחר כבר אינו קיים');
  assert.equal(h.nav.length, 0);
  const a = h.opened.find(o => o[0] === 'alert');
  assert.ok(a && /ההצטרפות למשלוח לא נשמרה/.test(a[1].title) && /כבר אינו קיים/.test(a[1].sub));
  assert.ok(!('joinError' in h.state.order));
  // בלי joinError - יוצאים כרגיל
  const h2 = harness(st, { edit: withNotes, answers: { Exit: 'save' }, respond: reply(st) });
  assert.equal((await h2.flows.exit()).left, true);
});
