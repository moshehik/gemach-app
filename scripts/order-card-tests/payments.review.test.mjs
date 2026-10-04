// בדיקות רגרסיה לסקירת הכסף של לשונית התשלומים (W4): כל סעיף = ליקוי שנמצא בסקירה עצמאית. הפעולות רצות עם fetch מדומה (בלי רשת/DB);
// מה שהוא JSX/חלונות נבדק סטטית (אותן הגבלות כמו payments.static.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const P = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const A = await P('app/components/order-card/hooks/usePaymentActions.js');
const L = await P('app/components/order-card/orderCardLogic.js');
const { createOrderCardFlows } = await P('app/components/order-card/orderCardFlows.js');
const { buildIsraeliIban, formatIban } = await P('lib/iban.js');
const OC = path.join(PROJ, 'app/components/order-card');
const read = (rel) => fs.readFileSync(path.join(OC, rel), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

const ORDER_ID = 777;
const CUSTOMER = { id: 'c1', firstName: 'דנה', lastName: 'כהן', phone1: '050-1', email: 'd@example.com' };
const S = (r) => L.parseSettings(r.map(([key, value]) => ({ key, value })));
const saved = (id, over = {}) => ({ id, amount: 100, paymentMethod: 'מזומן', isDeleted: false, paymentDate: '2026-10-01T00:00:00.000Z', notes: '', ...over });
const unsavedCard = (over = {}) => ({ isNew: true, _localId: 'LC1', amount: 250, paymentMethod: 'אשראי', notes: '{"Confirmation":"55"}', paymentDate: '2026-10-04T10:00:00.000Z', ...over });
const bypassRow = () => ({ isNew: true, _localId: 'LB1', amount: 9, paymentMethod: 'אשראי (מעקף מתכנת)', notes: '{}' });

function mkFetch(respond) {
  const calls = [];
  const fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    const r = (await respond(url, opts, calls.length)) || {};
    if (r.throw) throw new Error('network');
    if (r.raw !== undefined) return new Response(r.raw, { status: r.status ?? 200 });
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetch, calls };
}

function mkEnv({ payments = [], refunds = [], dirty = false, settings = [], respond = () => ({}), approve = async () => ({ employeeId: 'e1' }), serverOrder } = {}) {
  const m = mkFetch(respond);
  const lists = { payments: [...payments], refunds: [...refunds] };
  const applied = [];
  const alerts = [];
  const approvals = [];
  const env = {
    fetch: m.fetch,
    get: () => ({ order: { orderId: ORDER_ID, customer: CUSTOMER, hasSignedRegulations: true }, items: [], obligations: [], payments: lists.payments, refunds: lists.refunds, settings: S(settings), totals: { balance: 1000, required: 1000, paid: 0 }, dirty }),
    edit: {
      setPayments: (v) => { lists.payments = typeof v === 'function' ? v(lists.payments) : v; },
      setObligations: () => {},
      setRefunds: (v) => { lists.refunds = typeof v === 'function' ? v(lists.refunds) : v; },
    },
    applyServerOrder: (o) => applied.push(o),
    approve: async (kind, reason) => { approvals.push(kind); return approve(kind, reason); },
    toggleSignature: async () => true,
    ui: { alert: async (o) => { alerts.push(o); }, toast: () => {}, confirm: async () => true },
  };
  return { actions: A.createPaymentActions(env), calls: m.calls, lists, applied, alerts, approvals };
}
const writes = (calls) => calls.filter(c => c.method !== 'GET');

// ===================================================================================================
// 1 (HIGH) - מחיקת תשלום שעוד לא נשמר
// ===================================================================================================
test('1: deletePayment מסרב לשורה בלי id (חיוב אשראי שלא נשמר / מזומן שלא נשמר) - רק מעקף מתכנת ושורה שמורה ניתנים למחיקה', () => {
  for (const row of [unsavedCard(), { isNew: true, _localId: 'LM', amount: 5, paymentMethod: 'מזומן' }]) {
    const env = mkEnv({ payments: [saved('p1'), row] });
    const r = env.actions.deletePayment(row);
    assert.equal(r.ok, false);
    assert.ok(r.error && /לא נשמר/.test(r.error));
    assert.equal(env.lists.payments.length, 2, 'השורה נשארת');
  }
  const env = mkEnv({ payments: [saved('p1'), saved('p2'), bypassRow()] });
  assert.equal(env.actions.deletePayment(env.lists.payments[2]).ok, true);
  assert.equal(env.lists.payments.length, 2, 'מעקף מתכנת - מוסר מקומית');
  assert.equal(env.actions.deletePayment(env.lists.payments[0]).ok, true);
  assert.equal(env.lists.payments[0].isDeleted, true, 'שמור → isDeleted (נשמר ב-PUT)');
});

test('1: חלון "פרטי תשלום" - "מחק תשלום" רק כש-canDelete, והקורא מעביר canDelete: !!p.id', () => {
  const det = strip(read('dialogs/OcPaymentDetails.js'));
  assert.ok(/canDelete = false/.test(det), 'ברירת מחדל: אין מחיקה');
  assert.ok(/canDelete \? <DlgBtn[^>]*act="paydel"/.test(det));
  const hook = strip(read('hooks/usePaymentActions.js'));
  assert.ok(/D\.PaymentDetails, \{ payment: p, canDelete: !!p\.id \}/.test(hook));
  assert.ok(/if \(!p\.id\) \{ ui\.toast\('error'/.test(hook), 'גם אחרי החלון: בלי id לא ממשיכים');
  const tab = strip(read('tabs/OcPaymentsTab.js'));
  assert.ok(/fresh \? null : <button[^>]*aria-label="מחק תשלום"/.test(tab), 'אייקון הפח מוסתר לשורה ללא id');
});

// ===================================================================================================
// 2 (MED-HIGH) - אישור תשלום ידני ב-D3 בנווה
// ===================================================================================================
test('2: addManualPayment (בשני הגמ"חים) דורש approve(feature:manual_payment_credit_add) לפני ה-POST', async () => {
  const NEVE = [['consolidate_manual_payment_credit_ui', 'true'], ['allow_additional_payment_on_order', 'true']];
  // לא אושר → אין POST
  let env = mkEnv({ settings: NEVE, approve: async () => null });
  let r = await env.actions.addManualPayment({ amount: '40', paymentMethod: 'מזומן', notes: '' });
  assert.deepEqual(env.approvals, [A.MANUAL_PAYMENT_CREDIT_KEY]);
  assert.equal(r.ok, false);
  assert.equal(r.cancelled, true);
  assert.equal(writes(env.calls).length, 0, 'בלי אישור - אין כתיבה');
  // אושר → POST
  env = mkEnv({ settings: NEVE, respond: () => ({ body: saved('n1', { amount: 40 }) }) });
  r = await env.actions.addManualPayment({ amount: '40', paymentMethod: 'העברה בנקאית', notes: '' });
  assert.equal(r.ok, true);
  assert.deepEqual(env.approvals, [A.MANUAL_PAYMENT_CREDIT_KEY]);
  assert.equal(writes(env.calls).length, 1);
  // כבר אושר ע"י הלחצן "חיוב / זיכוי ידני" → לא שואלים שוב
  env = mkEnv({ settings: NEVE, respond: () => ({ body: saved('n2', { amount: 40 }) }) });
  r = await env.actions.addManualPayment({ amount: '40', paymentMethod: 'מזומן', notes: '', approved: true });
  assert.equal(r.ok, true);
  assert.equal(env.approvals.length, 0);
  // גמ"ח ראשי (מתג כבוי): W4-MANUAL - גם שם נדרש אישור (החלטת הבעלים 2026-10-04)
  env = mkEnv({ settings: [['allow_additional_payment_on_order', 'true']], approve: async () => null });
  r = await env.actions.addManualPayment({ amount: '40', paymentMethod: 'מזומן', notes: '' });
  assert.equal(r.cancelled, true);
  assert.equal(writes(env.calls).length, 0);
  env = mkEnv({ settings: [['allow_additional_payment_on_order', 'true']], respond: () => ({ body: saved('n3', { amount: 40 }) }) });
  r = await env.actions.addManualPayment({ amount: '40', paymentMethod: 'מזומן', notes: '' });
  assert.equal(r.ok, true);
  assert.deepEqual(env.approvals, [A.MANUAL_PAYMENT_CREDIT_KEY]);
});

test('2: מסלול האשראי (chargeCard) לא דורש את אישור התשלום הידני גם בנווה', async () => {
  const env = mkEnv({
    settings: [['consolidate_manual_payment_credit_ui', 'true']],
    respond: (u) => (u === '/api/nedarim' ? { body: { success: true, confirmation: 'A' } } : u === '/api/payments' ? { body: saved('c9', { amount: 100, paymentMethod: 'אשראי' }) } : {}),
  });
  const r = await env.actions.chargeCard({ cardNumber: '4580 1234 5678 9012', tokef: '12/28', installments: 1, notes: '', amount: '100' });
  assert.equal(r.ok, true);
  assert.equal(env.approvals.length, 0);
});

test('2: ה-D3 מעביר approved מהלחצן המאוחד, ומתייחס ל-cancelled בלי להציג שגיאה', () => {
  const pay = strip(read('dialogs/OcPayDialog.js'));
  assert.ok(/addManualPayment\(\{ amount: amt, paymentMethod: method, notes, approved \}\)/.test(pay));
  assert.ok(/if \(r\.cancelled\) return;\s*\n\s*if \(!r\.ok\)/.test(pay));
  const hook = strip(read('hooks/usePaymentActions.js'));
  assert.ok(/openPay\(\{ source: 'manual', approved: true \}\)/.test(hook));
});

// ===================================================================================================
// 3 (MED) - Esc / רקע בזמן חיוב
// ===================================================================================================
test('3: חלון התשלום לא ניתן לסגירה (Esc/רקע) בזמן שחיוב האשראי / שמירת התשלום רצים', async () => {
  let release;
  const gate = new Promise(res => { release = res; });
  const env = mkEnv({
    respond: async (u) => {
      if (u === '/api/nedarim') { await gate; return { body: { success: true, confirmation: 'Z' } }; }
      if (u === '/api/payments') return { body: saved('c1', { amount: 100, paymentMethod: 'אשראי' }) };
      return {};
    },
  });
  assert.equal(env.actions.isBusy(), false);
  const p = env.actions.chargeCard({ cardNumber: '4580 1234 5678 9012', tokef: '12/28', installments: 1, notes: '', amount: '100' });
  assert.equal(env.actions.isBusy(), true, 'בזמן החיוב');
  release();
  const r = await p;
  assert.equal(r.ok, true);
  assert.equal(env.actions.isBusy(), false, 'אחרי החיוב');
});

test('3: openPay מעביר dismissable דינמי ו-OcUi מכבד אותו ב-Esc וגם בלחיצה על הרקע', () => {
  const hook = strip(read('hooks/usePaymentActions.js'));
  assert.ok(/D\.Pay, \{ api, \.\.\.ctx \}, \{[^}]*dismissable: \(\) => !actions\.isBusy\(\)/.test(hook));
  const ui = strip(read('OcUi.js'));
  assert.ok(/typeof opts\.dismissable === 'function'/.test(ui));
  assert.ok(/if \(!canDismiss\(top\.opts\)\)/.test(ui), 'Esc');
  assert.ok(/canDismiss\(top\.opts\)\) close\(top\.id, null\)/.test(ui), 'רקע');
  assert.ok(!/top\.opts\.dismissable/.test(ui), 'אין עוד בדיקה גולמית שמתעלמת מפונקציה');
});

// ===================================================================================================
// 4 (MED) - חיוב אשראי שלא נשמר לא נעלם בסנכרון/ביטול
// ===================================================================================================
test('4: createRefund / executeRefund / recalc נחסמים (בלי קריאת רשת) כשיש חיוב אשראי שלא נשמר; מעקף ושורה שמורה לא חוסמים', async () => {
  const refundData = { amount: '50', bankName: 'לאומי', bankBranch: '800', reason: '' };
  const ok = (u) => (u.startsWith('/api/orders/') ? { body: { orderId: ORDER_ID, payments: [] } } : u === '/api/admin/recalculations' ? { body: { success: true } } : { body: {} });
  const env = mkEnv({ payments: [saved('p1'), unsavedCard()], respond: ok });
  for (const r of [await env.actions.createRefund(refundData), await env.actions.executeRefund('r1'), await env.actions.recalc()]) {
    assert.equal(r.ok, false);
    assert.ok(/הכרטיס חויב בסך/.test(r.error) && /שמור/.test(r.error));
  }
  assert.equal(env.calls.length, 0, 'אפס בקשות');
  // בלי חיוב שלא נשמר (מעקף / מחוק / שמור) - ממשיך כרגיל
  for (const rows of [[saved('p1')], [saved('p1'), bypassRow()], [saved('p1'), unsavedCard({ isDeleted: true })], [saved('p1', { paymentMethod: 'אשראי' })]]) {
    const e2 = mkEnv({ payments: rows, respond: ok });
    assert.equal((await e2.actions.executeRefund('r1')).ok, true);
    assert.equal((await e2.actions.recalc()).ok, true);
    assert.equal((await e2.actions.createRefund(refundData)).ok, true);
  }
});

test('4: "בטל שינויים" (discardAll), יציאה עם "אל תשמור" ו-undo שורה ברייל נחסמים כשיש חיוב אשראי שלא נשמר', async () => {
  const snap = { order: { orderId: ORDER_ID }, items: [], obligations: [], payments: [saved('p1')], refunds: [] };
  const cur = { order: { orderId: ORDER_ID }, items: [], obligations: [], payments: [saved('p1'), unsavedCard()], refunds: [], snapshot: snap, settings: S([]), openedDebt: 0 };
  const mkFlows = (st, uiExtra = {}) => {
    const alerts = []; const set = []; const m = mkFetch(() => ({}));
    const flows = createOrderCardFlows({
      fetch: m.fetch, ui: { toast() {}, confirm: async () => true, alert: async (o) => { alerts.push(o); }, openDialog: async () => 'discard', ...uiExtra }, dialogs: {}, routeId: String(ORDER_ID), get: () => st,
      set: { order: (v) => set.push('order'), items: () => set.push('items'), obligations: () => set.push('obl'), payments: () => set.push('pay'), refunds: () => set.push('ref'), tab() {}, saving() {} },
      setSnapshot() {}, setOpenedDebt() {}, setDebtApproved() {}, flags: {}, approve: async () => null, navigate: () => set.push('navigate'), emit: () => 0, bumpHistory() {}, clearRedo() {},
    });
    return { flows, alerts, set, calls: m.calls };
  };
  const a = mkFlows(cur);
  assert.equal(await a.flows.discardAll({ confirmed: true }), false);
  assert.equal(a.alerts.length, 1);
  assert.ok(/הכרטיס חויב/.test(a.alerts[0].sub));
  assert.equal(a.set.length, 0, 'המצב המקומי לא אופס');
  assert.equal(a.calls.length, 0);
  const x = mkFlows(cur);
  const xr = await x.flows.exit('/orders');
  assert.equal(xr.left, false);
  assert.equal(x.set.includes('navigate'), false, 'לא יוצאים');
  assert.ok(x.alerts.length === 1);
  // בלי חיוב שלא נשמר - discardAll עובד כרגיל
  const b = mkFlows({ ...cur, payments: [saved('p1'), { isNew: true, _localId: 'LM', amount: 5, paymentMethod: 'מזומן' }] });
  assert.equal(await b.flows.discardAll({ confirmed: true }), true);
  // undo ברייל: רק שורת האשראי שלא נשמרה חסומה
  const st = { payments: [saved('p1'), unsavedCard()] };
  assert.equal(L.undoDropsUnsavedCardCharge(st, 'pay:add:LC1'), true);
  assert.equal(L.undoDropsUnsavedCardCharge(st, 'pay:del:p1'), false);
  assert.equal(L.undoDropsUnsavedCardCharge({ payments: [saved('p1'), bypassRow()] }, 'pay:add:LB1'), false);
  const ctl = strip(read('useOrderCardController.js'));
  assert.ok(/if \(undoDropsUnsavedCardCharge\(cur, key\)\)/.test(ctl));
});

test('4: isUnsavedCardCharge - בלי id, לא מחוק, אשראי, לא מעקף', () => {
  assert.equal(L.isUnsavedCardCharge(unsavedCard()), true);
  assert.equal(L.isUnsavedCardCharge(unsavedCard({ isDeleted: true })), false);
  assert.equal(L.isUnsavedCardCharge(saved('x', { paymentMethod: 'אשראי' })), false);
  assert.equal(L.isUnsavedCardCharge(bypassRow()), false);
  assert.equal(L.isUnsavedCardCharge({ isNew: true, paymentMethod: 'מזומן' }), false);
  assert.equal(L.unsavedCardChargeMessage([saved('a')]), '');
});

// ===================================================================================================
// 5 (MED) - "תשלום נוסף" בזמן שיש שינויים שלא נשמרו
// ===================================================================================================
test('5: "תשלום נוסף" (source manual) עם שינויים פתוחים נדחה לפני החלון והאישור; ה-payNow ממשיך לשמור קודם', () => {
  const hook = strip(read('hooks/usePaymentActions.js'));
  const pay = hook.slice(hook.indexOf('const openPay = useCallback'), hook.indexOf('const openBank = useCallback'));
  assert.ok(/ctx\.source === 'manual' && ocRef\.current\.dirty/.test(pay));
  assert.ok(pay.indexOf("ctx.source === 'manual'") < pay.indexOf('ui.openDialog(D.Pay'));
  assert.ok(/יש לשמור את ההזמנה לפני רישום תשלום נוסף/.test(pay));
  const man = hook.slice(hook.indexOf('const openManualPayment = useCallback'), hook.indexOf('const openManualRefund = useCallback'));
  assert.ok(man.indexOf('ocRef.current.dirty') > -1 && man.indexOf('ocRef.current.dirty') < man.indexOf('manualMoneyGate()'), 'הודעת "לשמור קודם" לפני בקשת האישור (גם בלחצן הנפרד של הגמ"ח הראשי)');
  const payNow = hook.slice(hook.indexOf('const payNow = useCallback'), hook.indexOf('const creditNow = useCallback'));
  assert.ok(/if \(o\.dirty\)[\s\S]*o\.save\(\{ intent: 'pay' \}\)/.test(payNow));
});

// ===================================================================================================
// 6 (MED) - D4 "אשר ביצוע" דורש אישור מפורש
// ===================================================================================================
test('6: D4 - "אשר ביצוע" הוא "כן, בוצעה העברה" (אחרי שורת "בוצעה העברה בנקאית?"), נחסם בלי בנק/סניף; האישור בפעולה (AMB-22)', () => {
  const dlg = strip(read('dialogs/OcCreditDialog.js'));
  assert.ok(/בוצעה העברה בנקאית\?/.test(dlg));
  assert.ok(/if \(busy \|\| noBank\) return;/.test(dlg), 'גם Enter/קריאה ישירה לא עוברים בלי בנק');
  assert.ok(/disabled=\{busy \|\| noBank\} onClick=\{execute\}/.test(dlg));
  assert.ok(!/approve\(/.test(dlg), 'האישור בתוך executeRefundApproved');
});

// ===================================================================================================
// 7 (LOW) - עיגול לאגורות + תשלומים 1-36
// ===================================================================================================
test('7: סכומים מעוגלים לאגורות בכל גופי הבקשה, ותשלומים נחתכים ל-1..36', () => {
  assert.equal(A.clampInstallments(99), 36);
  assert.equal(A.clampInstallments('0'), 1);
  assert.equal(A.clampInstallments(-4), 1);
  assert.equal(A.clampInstallments(''), 1);
  assert.equal(A.clampInstallments('12'), 12);
  const card = { cardNumber: '4580 1234 5678 9012', tokef: '12/28', installments: 99, notes: '', amount: 0.1 + 0.2 };
  const nb = A.nedarimBody({ customer: CUSTOMER, obligations: [], orderId: 1, card });
  assert.equal(nb.amount, 0.3);
  assert.equal(nb.installments, 36);
  assert.equal(A.nedarimBody({ customer: CUSTOMER, obligations: [], orderId: 1, card: { ...card, amount: '19.999', installments: 0 } }).amount, 20);
  assert.equal(A.creditPaymentRow({ confirmation: 'x' }, { ...card, amount: '19.999' }).amount, 20);
  assert.equal(A.bypassPaymentRow({ ...card, amount: '10.234' }, 'e1').amount, 10.23);
  assert.equal(A.additionalPaymentBody({ orderId: 1, amount: '33.333', paymentMethod: 'מזומן' }).amount, 33.33);
  assert.equal(A.refundBody({ customerId: 'c', orderId: 1, refundData: { amount: '12.345', bankName: 'b' } }).amount, 12.35);
  // ולידציה על הסכום המעוגל: חצי אגורה = לא חיובי; מעל היתרה לפי המעוגל
  assert.ok(A.validateCreditCard({ ...card, amount: '0.004' }, 100));
  assert.equal(A.validateCreditCard({ ...card, amount: '100.004' }, 100), null);
  assert.ok(A.validateCreditCard({ ...card, amount: '100.01' }, 100));
  assert.ok(A.validateManualPayment('0.003'));
  assert.ok(A.validateRefund({ amount: '0.001', bankName: 'b', bankBranch: '1' }));
  assert.ok(A.validateBypass({ amount: '0.002' }, 100));
});

// ===================================================================================================
// 8 (LOW) - POST /api/payments הצליח אבל התשובה אבדה
// ===================================================================================================
const CARD = { cardNumber: '4580 1234 5678 9012', tokef: '12/28', installments: 1, notes: '', amount: '100' };
const NOTES = JSON.stringify({ 'אישור': 'בוצע' });
const nedarimOk = { body: { success: true, confirmation: undefined } };

for (const [label, lostResponse] of [['שגיאת רשת', { throw: true }], ['תשובה לא ניתנת לפענוח', { raw: '<html>bad gateway</html>', status: 200 }]]) {
  test(`8: אחרי חיוב מוצלח + תשובת שמירה אבודה (${label}) - מוצאים את התשלום בשרת ולא מוסיפים שורה כפולה`, async () => {
    for (const dirty of [true, false]) {
      const twin = saved('srv1', { amount: 100, paymentMethod: 'אשראי', notes: NOTES });
      const env = mkEnv({
        dirty,
        payments: [saved('p0')],
        respond: (u, o) => {
          if (u === '/api/nedarim') return nedarimOk;
          if (u === '/api/payments') return lostResponse;
          if (u === `/api/orders/${ORDER_ID}`) return { body: { orderId: ORDER_ID, payments: [saved('p0'), twin] } };
          return {};
        },
      });
      const r = await env.actions.chargeCard(CARD);
      assert.equal(r.ok, true);
      assert.equal(r.persisted, true, 'נשמר (נמצא בשרת)');
      assert.equal(env.alerts.length, 0, 'אין אזהרת "לא נשמר"');
      assert.equal(env.lists.payments.filter(p => p.isNew).length, 0, 'אין שורה מקומית isNew שתישמר שוב ב-PUT');
      if (dirty) assert.ok(env.lists.payments.some(p => p.id === 'srv1'), 'נוספה השורה השמורה');
      else assert.equal(env.applied.length, 1, 'סנכרון מלא מהשרת');
    }
  });
}

test('8: התשלום לא נמצא בשרת → שורה מקומית isNew + אזהרה (כמו קודם); תשלום שכבר מוכר למסך לא נחשב תאום', async () => {
  const env = mkEnv({
    dirty: true,
    payments: [saved('p0')],
    respond: (u) => (u === '/api/nedarim' ? nedarimOk : u === '/api/payments' ? { throw: true } : { body: { payments: [saved('p0')] } }),
  });
  const r = await env.actions.chargeCard(CARD);
  assert.equal(r.ok, true);
  assert.equal(r.persisted, false);
  assert.equal(env.alerts.length, 1);
  assert.equal(env.lists.payments.filter(p => p.isNew).length, 1);
  // אותו תשלום כבר ברשימה המקומית (id מוכר) → לא תאום
  const twin = saved('known', { amount: 100, paymentMethod: 'אשראי', notes: NOTES });
  const env2 = mkEnv({
    dirty: true,
    payments: [twin],
    respond: (u) => (u === '/api/nedarim' ? nedarimOk : u === '/api/payments' ? { throw: true } : { body: { payments: [twin] } }),
  });
  const r2 = await env2.actions.chargeCard(CARD);
  assert.equal(r2.persisted, false);
});

test('8: תשובת POST תקינה - אין קריאת GET מיותרת', async () => {
  const env = mkEnv({ respond: (u) => (u === '/api/nedarim' ? nedarimOk : u === '/api/payments' ? { body: saved('s1', { amount: 100, paymentMethod: 'אשראי', notes: NOTES }) } : { body: { payments: [] } }), dirty: true });
  const r = await env.actions.chargeCard(CARD);
  assert.equal(r.persisted, true);
  assert.equal(env.calls.filter(c => c.method === 'GET').length, 0);
});

// ===================================================================================================
// 9 (LOW) - IBAN מקורי נשמר בטקסט הזיכוי
// ===================================================================================================
test('9: ה-IBAN המעוצב נשמר בסיבת הזיכוי (בקשת זיכוי ופרטי בנק לזיכוי קיים); בלי IBAN - אותם גופים כמו קודם', async () => {
  const iban = buildIsraeliIban('010', '801', '0000000123456');
  assert.ok(iban);
  const fmt = formatIban(iban);
  // בקשת זיכוי
  let env = mkEnv({ respond: (u) => (u === '/api/refunds' ? { body: { id: 'r1' } } : { body: { payments: [] } }) });
  await env.actions.createRefund({ amount: '50', bankName: 'לאומי', bankBranch: '801', bankAccount: '123456', reason: 'ביטול', email: 'a@b.c' }, { iban });
  let body = JSON.parse(env.calls[0].body);
  assert.equal(body.reason, `ביטול | IBAN: ${fmt}`);
  assert.equal(body.bankBranch, '801');
  env = mkEnv({ respond: (u) => (u === '/api/refunds' ? { body: { id: 'r1' } } : { body: { payments: [] } }) });
  await env.actions.createRefund({ amount: '50', bankName: 'לאומי', bankBranch: '801', reason: '' }, { iban });
  assert.equal(JSON.parse(env.calls[0].body).reason, `IBAN: ${fmt}`);
  env = mkEnv({ respond: (u) => (u === '/api/refunds' ? { body: { id: 'r1' } } : { body: { payments: [] } }) });
  await env.actions.createRefund({ amount: '50', bankName: 'לאומי', bankBranch: '801', reason: 'ביטול' });
  assert.equal(JSON.parse(env.calls[0].body).reason, 'ביטול', 'בלי IBAN - ללא שינוי');
  // פרטי בנק לזיכוי קיים: הסיבה הקיימת נשמרת + ה-IBAN
  env = mkEnv({ refunds: [{ id: 'r9', reason: 'זיכוי אוטומטי', amount: 10 }], respond: () => ({ body: {} }) });
  await env.actions.saveRefundBank('r9', { bankName: 'לאומי', bankBranch: '801', bankAccount: '123456', bankAccountName: 'דנה' }, { iban });
  body = JSON.parse(env.calls[0].body);
  assert.equal(body.reason, `זיכוי אוטומטי | IBAN: ${fmt}`);
  assert.deepEqual(Object.keys(body), ['bankName', 'bankBranch', 'bankAccount', 'bankAccountName', 'reason']);
  // בלי IBAN: ארבעת השדות בלבד (זוגיות עם הישן)
  env = mkEnv({ refunds: [{ id: 'r9', reason: 'x', amount: 10 }], respond: () => ({ body: {} }) });
  await env.actions.saveRefundBank('r9', { bankName: 'לאומי', bankBranch: '801', bankAccount: '123456', bankAccountName: 'דנה' });
  assert.deepEqual(Object.keys(JSON.parse(env.calls[0].body)), ['bankName', 'bankBranch', 'bankAccount', 'bankAccountName']);
  // idempotent
  assert.equal(A.withIbanNote(`a | IBAN: ${fmt}`, iban), `a | IBAN: ${fmt}`);
});

test('9: BankFields מדווח את ה-IBAN התקין (onIban) והחלונות מעבירים אותו לפעולה', () => {
  const bank = strip(read('dialogs/OcBankDialog.js'));
  assert.ok(/onIban && onIban\(s\)/.test(bank));
  assert.ok(/saveRefundBank\(refund\.id, bank, \{ iban \}\)/.test(bank));
  const rf = strip(read('dialogs/OcRefundDialogs.js'));
  assert.ok(/createRefund\(data, \{ iban \}\)/.test(rf));
  // ה-IBAN לא נכנס לגוף דרך ה-state של הטופס (data) - רק דרך הפרמטר
  assert.ok(!/iban/.test(strip(read('hooks/usePaymentActions.js')).match(/export const refundBody[^\n]*/)[0]));
});

// ===================================================================================================
// AMB-22 / W4-MANUAL - אישורי מנהל בפעולות (התנהגות)
// ===================================================================================================
test('AMB-22: executeRefundApproved - בלי אישור אין PUT; עם אישור PUT {isExecuted:true}; חיוב אשראי שלא נשמר חוסם לפני בקשת האישור', async () => {
  let env = mkEnv({ approve: async () => null });
  let r = await env.actions.executeRefundApproved('r1');
  assert.equal(r.cancelled, true);
  assert.deepEqual(env.approvals, [A.REFUND_EXECUTE_APPROVAL_KEY]);
  assert.equal(writes(env.calls).length, 0);
  env = mkEnv({ respond: (u, o) => (o.method === 'PUT' ? { body: { id: 'r1' } } : { body: { orderId: ORDER_ID } }) });
  r = await env.actions.executeRefundApproved('r1');
  assert.equal(r.ok, true);
  assert.deepEqual(writes(env.calls).map(c => [c.method, c.url, c.body]), [['PUT', '/api/refunds/r1', JSON.stringify({ isExecuted: true })]]);
  env = mkEnv({ payments: [unsavedCard()] });
  r = await env.actions.executeRefundApproved('r1');
  assert.equal(r.ok, false);
  assert.equal(env.approvals.length, 0, 'לא מבקשים אישור לפעולה שתיחסם');
});

test('AMB-22: deletePaymentApproved - בלי אישור התשלום נשאר; עם אישור מסומן isDeleted; שורה שלא נשמרה נדחית בלי בקשת אישור; מעקף מתכנת מאושר', async () => {
  let env = mkEnv({ payments: [saved('p1'), saved('p2')], approve: async () => null });
  let r = await env.actions.deletePaymentApproved(env.lists.payments[0]);
  assert.equal(r.cancelled, true);
  assert.deepEqual(env.approvals, [A.PAYMENT_DELETE_APPROVAL_KEY]);
  assert.equal(env.lists.payments[0].isDeleted, false);
  env = mkEnv({ payments: [saved('p1'), saved('p2')] });
  r = await env.actions.deletePaymentApproved(env.lists.payments[1]);
  assert.equal(r.ok, true);
  assert.equal(env.lists.payments[1].isDeleted, true);
  assert.equal(env.lists.payments[0].isDeleted, false);
  env = mkEnv({ payments: [unsavedCard()] });
  r = await env.actions.deletePaymentApproved(env.lists.payments[0]);
  assert.equal(r.ok, false);
  assert.equal(env.approvals.length, 0);
  env = mkEnv({ payments: [bypassRow()] });
  r = await env.actions.deletePaymentApproved(env.lists.payments[0]);
  assert.equal(r.ok, true);
  assert.deepEqual(env.approvals, [A.PAYMENT_DELETE_APPROVAL_KEY]);
  assert.equal(env.lists.payments.length, 0);
});

test('AMB-22/W4-MANUAL: המפתחות הם הרשאה קיימת בקטלוג (אין הרשאה חדשה שחוסמת את העבודה)', async () => {
  const { PERMISSION_CATALOG } = await P('lib/permissionsMetadata.js').then(m => ({ PERMISSION_CATALOG: m.PERMISSION_CATALOG || m.PERMISSIONS_CATALOG || m.PERMISSIONS || m.default }));
  const src = fs.readFileSync(path.join(PROJ, 'lib/permissionsMetadata.js'), 'utf8');
  for (const k of [A.PAYMENT_DELETE_APPROVAL_KEY, A.REFUND_EXECUTE_APPROVAL_KEY, A.MANUAL_PAYMENT_CREDIT_KEY, A.MANUAL_CHARGE_KEY]) assert.ok(src.includes(`key: '${k}'`), k);
  void PERMISSION_CATALOG;
});
