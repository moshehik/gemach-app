// זוגיות פעולות הכסף (W4) מול הכרטיס הישן: ה"אורקל" הוא קוד המקור החי של components/orders/modern/ModernPaymentsManager.js (MPM) -
// כל פונקציה של הישן מחולצת בזמן הבדיקה ומורצת (with-scope עם fetch מדומה ו-setters לוכדים), ומושווית לפעולה המקבילה ב-
// app/components/order-card/hooks/usePaymentActions.js על אותו מצב: אותם endpoints, methods וגופי בקשות (מחרוזת JSON זהה), ואותן
// שורות מקומיות. אם מישהו ישנה את הישן - הבדיקה תראה. הבדלים מכוונים מתועדים בכל בדיקה (ו-W4-NOTES.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { objectLiteralAt } from './legacy.mjs';

const PROJ = process.env.PROJ;
const MPM_PATH = path.join(PROJ, 'components/orders/modern/ModernPaymentsManager.js');
const MPM = fs.readFileSync(MPM_PATH, 'utf8');
const P = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const A = await P('app/components/order-card/hooks/usePaymentActions.js');
const L = await P('app/components/order-card/orderCardLogic.js');
const { createOrderCardFlows } = await P('app/components/order-card/orderCardFlows.js');

// ---------- חילוץ פונקציות מהישן ----------
function arrowText(name) {
  const i = MPM.indexOf(`const ${name} = `);
  if (i < 0) throw new Error(`MPM: ${name} not found`);
  const startExpr = i + `const ${name} = `.length;
  const arrow = MPM.indexOf('=>', startExpr);
  const body = objectLiteralAt(MPM, arrow);
  return MPM.slice(startExpr, MPM.indexOf(body, arrow)) + body;
}
function iifeText(name) {
  const i = MPM.indexOf(`const ${name} = (() =>`);
  if (i < 0) throw new Error(`MPM: IIFE ${name} not found`);
  const body = objectLiteralAt(MPM, MPM.indexOf('=>', i));
  return `(() => ${body})()`;
}
function functionText(name) {
  const i = MPM.indexOf(`function ${name}(`);
  if (i < 0) throw new Error(`MPM: function ${name} not found`);
  const body = objectLiteralAt(MPM, i);
  return MPM.slice(i, MPM.indexOf(body, i)) + body;
}
// מריץ ביטוי JS של הישן בתוך with(scope): מזהים שלא בהיקף נלקחים מ-globalThis
function evalLegacy(exprText, scope) {
  const proxy = new Proxy(scope, {
    has: (t, k) => typeof k === 'string',
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) { return (${exprText}); }`)(proxy);
}

// ---------- fetch מדומה ----------
function mockFetch(respond = () => ({})) {
  const calls = [];
  const fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body, headers: opts.headers || {} });
    const r = respond(url, opts, calls.length) || {};
    if (r.throw) throw new Error('network');
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetch, calls };
}
const writes = (calls) => calls.filter(c => c.method !== 'GET').map(c => ({ url: c.url, method: c.method, body: c.body }));

// ---------- מצבים ----------
const CUSTOMER = { id: 'c1', firstName: 'מרים', lastName: 'אברמוביץ', phone1: '050-7123456', email: 'm@example.com', city: 'ירושלים', street: 'עמוס', houseNum: 14, zeout: '012345678', bankName: 'לאומי', bankBranch: '800', bankAccount: '1234', bankAccountName: 'מרים' };
const ORDER_ID = 53375;
const OBL = [
  { id: 'ob1', amount: 1500, description: 'השכרת שמלה דגם 4512 מידה 38 (פריט #a1)', productName: 'שמלה 4512 (פריט #a1)', orderItemId: 'a1', isManual: false, isDeleted: false, createdAt: '2026-09-23T07:13:00.000Z' },
  { id: 'ob2', amount: 120, description: 'השכרת שמלה דגם 3087 (פריט #a2)', productName: 'שמלה 3087', orderItemId: 'a2', isManual: false, isDeleted: true },
  { id: 'ob3', amount: 30, description: 'הובלה', isManual: true, isDeleted: false, createdAt: '2026-09-24T07:13:00.000Z' },
];
const PAY = [
  { id: 'p1', amount: 100, paymentMethod: 'מזומן', isDeleted: false, paymentDate: '2026-09-23T07:18:00.000Z', notes: '' },
  { id: 'p2', amount: 50, paymentMethod: 'אשראי', isDeleted: false, paymentDate: '2026-09-25T07:18:00.000Z', notes: JSON.stringify({ LastNum: '4432', Confirmation: '0123' }) },
];
const totalsOf = (obl, pay) => { const required = L.requiredOf(obl, []); const paid = L.paidOf(pay); return { required, paid, balance: Math.round((required - paid) * 100) / 100 }; };

// סביבה של הפעולות החדשות; edit לוכד את הרשימות שהתקבלו
function newEnv({ customer = CUSTOMER, obligations = OBL, payments = PAY, refunds = [], dirty = true, respond, approve = async () => null, settings = [] } = {}) {
  const m = mockFetch(respond);
  const lists = { payments: [...payments], obligations: [...obligations], refunds: [...refunds] };
  const applied = [];
  const alerts = [];
  const env = {
    fetch: m.fetch,
    get: () => ({ order: { orderId: ORDER_ID, customer, hasSignedRegulations: false }, items: [], obligations: lists.obligations, payments: lists.payments, refunds: lists.refunds, settings: L.parseSettings(settings), totals: totalsOf(lists.obligations, lists.payments), dirty }),
    edit: {
      setPayments: (v) => { lists.payments = typeof v === 'function' ? v(lists.payments) : v; },
      setObligations: (v) => { lists.obligations = typeof v === 'function' ? v(lists.obligations) : v; },
      setRefunds: (v) => { lists.refunds = typeof v === 'function' ? v(lists.refunds) : v; },
    },
    applyServerOrder: (o) => applied.push(o),
    approve,
    toggleSignature: async () => true,
    ui: { alert: async (o) => { alerts.push(o); }, toast: () => {}, confirm: async () => true },
  };
  return { actions: A.createPaymentActions(env), calls: m.calls, lists, applied, alerts };
}

// סביבה של הישן; כל setter לוכד; window.customConfirm = true; alert לוכד
function legacyScope(extra = {}, respond) {
  const m = mockFetch(respond);
  const cap = { alerts: [], payments: null, obligations: null, refunds: null, orderUpdated: [], set: {} };
  const setter = (k) => (v) => { cap.set[k] = typeof v === 'function' ? v(cap.set[k] ?? extra[`__prev_${k}`]) : v; };
  const scope = {
    fetch: m.fetch,
    alert: (msg) => cap.alerts.push(msg),
    window: { customConfirm: async () => true },
    orderId: ORDER_ID, customer: CUSTOMER, obligations: OBL, payments: PAY, refunds: [], order: { hasSignedRegulations: false },
    onPaymentsChange: (v) => { cap.payments = v; }, onObligationsChange: (v) => { cap.obligations = v; }, onRefundsChange: (v) => { cap.refunds = v; },
    onOrderUpdated: (o) => cap.orderUpdated.push(o), onSignRegulations: () => {},
    setIsProcessing: () => {}, setShowCreditModal: () => {}, setShowRefundModal: () => {}, setShowAdditionalPaymentModal: () => {}, setShowAutoRefundBankModal: () => {},
    setIsSavingAutoRefundBank: () => {}, setIsRecalculating: () => {}, setShowAddChargeModal: () => {}, setShowQuickSwipeModal: () => {}, setShowRegulationsModal: () => {}, setConfirmingSigned: () => {},
    setCreditError: (v) => { cap.creditError = v; }, setAdditionalPaymentError: (v) => { cap.additionalError = v; },
    setRefundData: setter('refundData'), setAutoRefundBankData: setter('autoBank'), setAutoRefundTarget: setter('autoTarget'), setCreditCardData: setter('card'), setSwipeInput: () => {}, setNewObligation: () => {},
    ...extra,
  };
  return { scope, calls: m.calls, cap };
}
const noDate = (row) => { const { paymentDate, createdAt, _localId, ...rest } = row; return rest; };

// =============================================================================================
test('R36 חיוב אשראי מוצלח: POST /api/nedarim (גוף זהה) → POST /api/payments (גוף זהה) → שורת תשלום זהה', async () => {
  const cards = [
    { cardNumber: '4580 1234 5678 9012', tokef: '12/28', installments: 1, notes: '', amount: '200' },
    { cardNumber: '4580123456789012', tokef: '01/30', installments: '3', notes: 'הערה של העובד', amount: '120.5' },
    { cardNumber: '4580 1234', tokef: '0130', installments: '', notes: 'x', amount: '1' },
  ];
  const nedarimResponses = [{ success: true, rawResponse: JSON.stringify({ Confirmation: '777', LastNum: '9012' }) }, { success: true, confirmation: 'A1' }, { success: true, rawResponse: 'not json', confirmation: 'B2' }];
  for (const customer of [CUSTOMER, { ...CUSTOMER, idNumber: '999', zeout: '' }, { firstName: 'רק', phone1: '' }]) {
    for (let k = 0; k < cards.length; k++) {
      const card = cards[k];
      const respond = (u) => (u === '/api/nedarim' ? { body: nedarimResponses[k] } : u === '/api/payments' ? { body: { id: 'np1', amount: parseFloat(card.amount) } } : {});
      const totals = totalsOf(OBL, PAY);
      const leg = legacyScope({ creditCardData: card, totalRequired: totals.required, totalPaid: totals.paid, customer }, respond);
      await evalLegacy(arrowText('handleProcessCreditCard'), leg.scope)();
      const neu = newEnv({ customer, respond });
      const r = await neu.actions.chargeCard(card);
      assert.equal(r.ok, true);
      assert.deepEqual(writes(neu.calls), writes(leg.calls), `card ${k}`);
      assert.equal(writes(neu.calls)[0].url, '/api/nedarim');
      // השורה שנוספה = התשובה מהשרת, כמו בישן (dirty → הוספה מקומית, כמו onPaymentsChange)
      assert.deepEqual(neu.lists.payments, leg.cap.payments);
    }
  }
});

test('R36: כשל שמירת התשלום אחרי חיוב → שורה מקומית isNew זהה לישן + אזהרה (הכסף כבר נגבה)', async () => {
  const card = { cardNumber: '4580 1234 5678 9012', tokef: '12/28', installments: 2, notes: 'n', amount: '100' };
  for (const fail of [{ status: 500, body: { error: 'x' } }, { throw: true }]) {
    const respond = (u) => (u === '/api/nedarim' ? { body: { success: true, rawResponse: JSON.stringify({ Confirmation: '1' }) } } : u === '/api/payments' ? fail : {});
    const totals = totalsOf(OBL, PAY);
    const leg = legacyScope({ creditCardData: card, totalRequired: totals.required, totalPaid: totals.paid }, respond);
    await evalLegacy(arrowText('handleProcessCreditCard'), leg.scope)();
    const neu = newEnv({ respond, dirty: false });
    const r = await neu.actions.chargeCard(card);
    assert.equal(r.ok, true);
    assert.equal(r.persisted, false);
    assert.deepEqual(writes(neu.calls), writes(leg.calls));
    assert.deepEqual(neu.lists.payments.map(noDate), leg.cap.payments.map(noDate));
    assert.equal(neu.lists.payments.at(-1).isNew, true);
    assert.equal(leg.cap.alerts.length, 1);
    assert.equal(neu.alerts.length, 1);
    assert.ok(neu.alerts[0].sub.includes('הכרטיס חויב בהצלחה'));
    assert.equal(neu.applied.length, 0, 'אין סנכרון מהשרת כשהשמירה נכשלה');
  }
});

test('R36: שגיאות - שדות חסרים / מעל היתרה / נדרים נכשל / שגיאת תקשורת: אותן קריאות (אף אחת או רק נדרים) ואותה הודעה', async () => {
  const totals = totalsOf(OBL, PAY);
  const cases = [
    [{ cardNumber: '', tokef: '12/28', installments: 1, notes: '', amount: '10' }, () => ({})],
    [{ cardNumber: '4580', tokef: '', installments: 1, notes: '', amount: '10' }, () => ({})],
    [{ cardNumber: '4580', tokef: '12/28', installments: 1, notes: '', amount: String(totals.balance + 1) }, () => ({})],
    [{ cardNumber: '4580', tokef: '12/28', installments: 1, notes: '', amount: '10' }, (u) => (u === '/api/nedarim' ? { body: { success: false, error: 'כרטיס נדחה' } } : {})],
    [{ cardNumber: '4580', tokef: '12/28', installments: 1, notes: '', amount: '10' }, (u) => (u === '/api/nedarim' ? { body: { success: false } } : {})],
    [{ cardNumber: '4580', tokef: '12/28', installments: 1, notes: '', amount: '10' }, (u) => (u === '/api/nedarim' ? { throw: true } : {})],
  ];
  for (const [card, respond] of cases) {
    const leg = legacyScope({ creditCardData: card, totalRequired: totals.required, totalPaid: totals.paid }, respond);
    await evalLegacy(arrowText('handleProcessCreditCard'), leg.scope)();
    const neu = newEnv({ respond });
    const r = await neu.actions.chargeCard(card);
    assert.equal(r.ok, false);
    assert.deepEqual(writes(neu.calls), writes(leg.calls));
    // אותה הודעה (הסכום בפורמט כסף של הכרטיס במקום ₪<מספר גולמי>)
    assert.equal(r.error.replace(/₪[\d,.]+/, '₪N'), String(leg.cap.creditError).replace(/₪[\d,.]+/, '₪N'));
    assert.equal(neu.lists.payments.length, PAY.length);
  }
});

test('R36 בלי שינויים שלא נשמרו: אחרי שמירת התשלום - סנכרון מלא מהשרת (GET + applyServerOrder) במקום הוספה מקומית', async () => {
  const card = { cardNumber: '4580 1234 5678 9012', tokef: '12/28', installments: 1, notes: '', amount: '50' };
  const respond = (u, o) => (u === '/api/nedarim' ? { body: { success: true, confirmation: 'ok' } } : u === '/api/payments' ? { body: { id: 'np' } } : (o.method || 'GET') === 'GET' ? { body: { orderId: ORDER_ID, payments: [] } } : {});
  const neu = newEnv({ respond, dirty: false });
  await neu.actions.chargeCard(card);
  assert.deepEqual(neu.calls.map(c => `${c.method} ${c.url}`), ['POST /api/nedarim', 'POST /api/payments', `GET /api/orders/${ORDER_ID}`]);
  assert.equal(neu.applied.length, 1);
  assert.equal(neu.lists.payments.length, PAY.length, 'לא נוסף מקומית (התשלום כבר ב-snapshot דרך applyServerOrder)');
});

test('R36 מעקף מתכנת: אישור ברמת "מתכנת" → שורה מקומית זהה לישן, בלי שום קריאה לשרת; ביטול האישור = כלום', async () => {
  const totals = totalsOf(OBL, PAY);
  for (const notes of ['', 'תקלת סליקה']) {
    const card = { cardNumber: '', tokef: '', installments: 1, notes, amount: '60' };
    let legLevel = null;
    const leg = legacyScope({ creditCardData: card, totalRequired: totals.required, totalPaid: totals.paid, verifyPin: async (msg, level) => { legLevel = level; return { employeeId: 'dev1', pin: 'x' }; } });
    await evalLegacy(arrowText('handleBypassCreditPayment'), leg.scope)();
    let asked = null;
    const neu = newEnv({ approve: async (kind) => { asked = kind; return { employeeId: 'dev1', employeeName: 'מתכנת', pin: 'x' }; } });
    const r = await neu.actions.bypassCard(card);
    assert.equal(r.ok, true);
    assert.equal(asked, legLevel);
    assert.equal(asked, 'מתכנת');
    assert.equal(neu.calls.length, 0);
    assert.equal(leg.calls.length, 0);
    assert.deepEqual(neu.lists.payments.map(noDate), leg.cap.payments.map(noDate));
  }
  const neu2 = newEnv({ approve: async () => null });
  assert.equal((await neu2.actions.bypassCard({ amount: '10' })).cancelled, true);
  assert.equal(neu2.lists.payments.length, PAY.length);
  assert.match((await neu2.actions.bypassCard({ amount: '0' })).error, /סכום/);
});

test('תשלום נוסף (מזומן/העברה/צ׳ק): POST /api/payments עם גוף זהה; סכום לא חיובי = אין קריאה', async () => {
  for (const data of [{ amount: '120', paymentMethod: 'מזומן', notes: '' }, { amount: '45.5', paymentMethod: 'העברה בנקאית', notes: 'אסמכתא 77' }, { amount: '10', paymentMethod: '', notes: '' }, { amount: '0', paymentMethod: 'מזומן', notes: '' }, { amount: '', paymentMethod: 'מזומן', notes: '' }]) {
    const respond = (u) => (u === '/api/payments' ? { body: { id: 'np', amount: parseFloat(data.amount) } } : {});
    const leg = legacyScope({ additionalPaymentData: data }, respond);
    await evalLegacy(arrowText('submitAdditionalPayment'), leg.scope)();
    const neu = newEnv({ respond, approve: async () => ({ employeeId: 'm1' }) }); // W4-MANUAL: אישור גם בגמ"ח הראשי
    const r = await neu.actions.addManualPayment(data);
    assert.deepEqual(writes(neu.calls), writes(leg.calls), JSON.stringify(data));
    if (writes(leg.calls).length) { assert.equal(r.ok, true); assert.deepEqual(neu.lists.payments, leg.cap.payments); }
    else assert.equal(r.error, leg.cap.additionalError);
  }
});

test('R38 בקשת זיכוי: POST /api/refunds (אותם מפתחות ובאותו סדר; הסכום כמספר) → GET ההזמנה → applyServerOrder', async () => {
  const datas = [
    { amount: '120', reason: 'החזר', bankName: 'לאומי', bankBranch: '800', bankAccount: '99', bankAccountName: 'מרים', paymentDetails: 'אשראי (ספרות: 4432)', email: 'm@example.com' },
    { amount: '0', reason: '', bankName: 'לאומי', bankBranch: '800', bankAccount: '', bankAccountName: '', paymentDetails: '', email: '' },
    { amount: '50', reason: '', bankName: ' ', bankBranch: '800', bankAccount: '', bankAccountName: '', paymentDetails: '', email: '' },
  ];
  for (const refundData of datas) {
    const respond = (u, o) => (u === '/api/refunds' ? { status: 201, body: { id: 'r1' } } : { body: { orderId: ORDER_ID } });
    const leg = legacyScope({ refundData }, respond);
    await evalLegacy(arrowText('submitRefund'), leg.scope)();
    const neu = newEnv({ respond });
    const r = await neu.actions.createRefund(refundData);
    const lw = writes(leg.calls), nw = writes(neu.calls);
    assert.equal(nw.length, lw.length);
    if (!lw.length) { assert.equal(r.ok, false); assert.equal(r.error, leg.cap.alerts[0]); continue; }
    assert.equal(nw[0].url, lw[0].url);
    const lb = JSON.parse(lw[0].body), nb = JSON.parse(nw[0].body);
    assert.deepEqual(Object.keys(nb), Object.keys(lb));
    assert.deepEqual(nb, { ...lb, amount: parseFloat(lb.amount) });
    assert.deepEqual(neu.calls.map(c => `${c.method} ${c.url}`), leg.calls.map(c => `${c.method} ${c.url}`));
    assert.equal(neu.applied.length, 1);
    assert.equal(leg.cap.orderUpdated.length, 1);
  }
});

test('R38 "אשר ביצוע": PUT /api/refunds/<id> {isExecuted:true} → GET → applyServerOrder; כשל = אין GET', async () => {
  for (const status of [200, 409]) {
    const respond = (u, o) => ((o.method === 'PUT') ? { status, body: status === 200 ? { id: 'r1' } : { error: 'הזיכוי כבר סומן כבוצע' } } : { body: { orderId: ORDER_ID } });
    const leg = legacyScope({}, respond);
    await evalLegacy(arrowText('approveRefund'), leg.scope)('r1');
    const neu = newEnv({ respond });
    const r = await neu.actions.executeRefund('r1');
    assert.deepEqual(neu.calls.map(c => [c.method, c.url, c.body]), leg.calls.map(c => [c.method, c.url, c.body]));
    assert.equal(r.ok, status === 200);
    if (status !== 200) assert.equal(r.error, 'הזיכוי כבר סומן כבוצע', 'הכרטיס החדש מציג את הודעת השרת (הישן: "Failed to approve refund")');
  }
});

test('D4b / פרטי בנק לזיכוי קיים: PUT /api/refunds/<id> עם ארבעת השדות (זהה לישן), עדכון הזיכוי המקומי זהה; בלי בנק/סניף = אין קריאה', async () => {
  const refunds = [{ id: 'r1', amount: 80, isAutoGenerated: true, bankName: '', bankBranch: '' }, { id: 'r2', amount: 5 }];
  for (const bank of [{ bankName: 'לאומי', bankBranch: '800', bankAccount: '99999999', bankAccountName: 'מרים' }, { bankName: '', bankBranch: '800', bankAccount: '', bankAccountName: '' }]) {
    const respond = () => ({ body: { id: 'r1' } });
    const leg = legacyScope({ autoRefundBankData: bank, autoRefundTarget: 'r1', refunds }, respond);
    await evalLegacy(arrowText('submitAutoRefundBank'), leg.scope)();
    const neu = newEnv({ respond, refunds });
    const r = await neu.actions.saveRefundBank('r1', bank);
    assert.deepEqual(writes(neu.calls), writes(leg.calls));
    if (leg.calls.length) { assert.equal(r.ok, true); assert.deepEqual(neu.lists.refunds, leg.cap.refunds); }
    else assert.equal(r.error, leg.cap.alerts[0]);
  }
});

test('A15: IBAN שהוזן ב-D4b מפורק לשדות הקיימים - הגוף לא מכיל IBAN ולא מפתח נוסף', async () => {
  const I = await P('lib/iban.js');
  const p = I.parseIsraeliIban('IL62 0108 0000 0009 9999 999');
  const neu = newEnv({ respond: () => ({ body: {} }) });
  await neu.actions.saveRefundBank('r1', { bankName: p.bankName, bankBranch: p.bankBranch, bankAccount: p.bankAccount, bankAccountName: 'מרים', iban: 'IL620108000000099999999' });
  const body = JSON.parse(neu.calls[0].body);
  assert.deepEqual(Object.keys(body), ['bankName', 'bankBranch', 'bankAccount', 'bankAccountName']);
  assert.ok(!/IL62|0108000/.test(neu.calls[0].body));
  assert.deepEqual(body, { bankName: 'לאומי', bankBranch: '800', bankAccount: '99999999', bankAccountName: 'מרים' });
});

test('R33 חישוב מחדש: POST /api/admin/recalculations {orderIds:[id]} → GET → applyServerOrder; שגיאת שרת/errors[] = אין GET', async () => {
  for (const resp of [{ body: { success: true, errors: [] } }, { body: { success: true, errors: [{ orderId: ORDER_ID, error: 'boom' }] } }, { status: 401, body: { error: 'Unauthorized. Admin access required.' } }]) {
    const respond = (u, o) => (o.method === 'POST' ? resp : { body: { orderId: ORDER_ID } });
    const leg = legacyScope({}, respond);
    await evalLegacy(arrowText('handleRecalculate'), leg.scope)();
    const neu = newEnv({ respond });
    const r = await neu.actions.recalc();
    assert.deepEqual(neu.calls.map(c => [c.method, c.url, c.body]), leg.calls.map(c => [c.method, c.url, c.body]));
    if (!r.ok) assert.equal(r.error, leg.cap.alerts.at(-1));
  }
  assert.equal(A.canRecalcRole(0), true);
  assert.equal(A.canRecalcRole(2), true);
  for (const r of [1, 3, null, undefined]) assert.equal(A.canRecalcRole(r), false, 'R33: מוסתר ממי שאינו הנהלה ראשית/מתכנת (checkAuth("הנהלה ראשית") = 0/2)');
});

test('R37 מחיקת תשלום / R35 מחיקת חיוב ידני: אותה תוצאה מקומית כמו הישן (שמור → isDeleted; חדש → הסרה)', async () => {
  // סטייה מכוונת מהישן (סקירת כסף): שורה בלי id (עוד לא נשמרה - למשל חיוב אשראי שכבר זז) לא נמחקת; רק מעקף מתכנת (בלי כסף אמיתי) כן.
  const bypass = { isNew: true, amount: 7, paymentMethod: 'אשראי (מעקף מתכנת)', _localId: 'L3' };
  const pays = [...PAY, bypass];
  for (let idx = 0; idx < pays.length; idx++) {
    // הישן משנה את האובייקט במקום (updated[idx].isDeleted = true) - מעבירים לו עותק
    const leg = legacyScope({ payments: structuredClone(pays) });
    await evalLegacy(arrowText('removePayment'), leg.scope)(idx);
    const neu = newEnv({ payments: pays });
    const res = neu.actions.deletePayment(pays[idx]);
    assert.equal(res.ok, true);
    assert.deepEqual(neu.lists.payments, leg.cap.payments);
  }
  const obls = [...OBL, { isNew: true, description: 'x', amount: 3, isManual: true, _localId: 'L2' }];
  for (const idx of [2, 3]) {
    const leg = legacyScope({ obligations: structuredClone(obls) });
    await evalLegacy(arrowText('removeObligation'), leg.scope)(idx);
    const neu = newEnv({ obligations: obls });
    neu.actions.deleteManualCharge(obls[idx]);
    assert.deepEqual(neu.lists.obligations, leg.cap.obligations);
  }
});

test('R35 הוספת חיוב ידני: אותה שורה כמו addObligation של הישן (isNew, isManual, סכום מספרי)', async () => {
  for (const no of [{ description: 'הובלה מיוחדת', amount: '50' }, { description: 'תיקון', amount: '12.5' }, { description: 'זיכוי ידני', amount: '-20' }]) {
    const leg = legacyScope({ newObligation: no });
    evalLegacy(arrowText('addObligation'), leg.scope)();
    const neu = newEnv();
    neu.actions.addManualCharge(no);
    assert.deepEqual(neu.lists.obligations.map(noDate), leg.cap.obligations.map(noDate));
  }
  assert.ok(A.validateManualCharge({ description: '', amount: '5' }));
  assert.ok(A.validateManualCharge({ description: 'x', amount: '0' }));
  assert.equal(A.validateManualCharge({ description: 'x', amount: '-5' }), null);
});

test('R7 שער התקנון לפני אשראי: אותו PUT /api/orders/<id> עם hasSignedRegulations:true (דרך toggleSignature של הבקר)', async () => {
  const leg = legacyScope({}, () => ({ body: {} }));
  await evalLegacy(arrowText('confirmSignedThenOpenCredit'), leg.scope)();
  const m = mockFetch(() => ({ body: { updatedAt: 'u2' } }));
  const st = { order: { orderId: ORDER_ID, hasSignedRegulations: false, updatedAt: 'u1' }, items: [], obligations: [], payments: [], refunds: [], snapshot: { order: { orderId: ORDER_ID } }, settings: L.parseSettings([]) };
  const flows = createOrderCardFlows({ fetch: m.fetch, ui: { toast() {}, confirm: async () => true }, dialogs: {}, routeId: String(ORDER_ID), get: () => st, set: { order: () => {}, saving: () => {} }, setSnapshot: () => {}, setOpenedDebt() {}, setDebtApproved() {}, flags: {}, approve: async () => null, navigate() {}, emit: () => 0, bumpHistory() {}, clearRedo() {} });
  await flows.toggleSignature({ confirmed: true });
  assert.equal(m.calls[0].url, leg.calls[0].url);
  assert.equal(m.calls[0].method, leg.calls[0].method);
  const lb = JSON.parse(leg.calls[0].body), nb = JSON.parse(m.calls[0].body);
  assert.equal(nb.hasSignedRegulations, lb.hasSignedRegulations);
  assert.deepEqual(Object.keys(nb).filter(k => k !== 'updatedAt'), Object.keys(lb), 'הבדל מכוון של W1 (סקירה, סעיף 3): updatedAt נוסף לבדיקת התנגשות');
});

// ---------- עזרים טהורים מול הישן ----------
test('בקשת זיכוי - ערכי פתיחה (אמצעי התשלום האחרון + 4 ספרות, מייל עם סיומת) זהים ל-handleOpenRefundModal', () => {
  const variants = [
    [],
    PAY,
    [{ ...PAY[0], paymentDate: '2026-10-01T00:00:00.000Z' }, PAY[1]],
    [{ id: 'x', amount: 5, paymentMethod: 'אשראי', paymentDate: '2026-10-02', notes: JSON.stringify({ CardNumber: '4580111122223333' }) }],
    [{ id: 'x', amount: 5, paymentMethod: 'אשראי', paymentDate: '2026-10-02', notes: JSON.stringify({ Card: 'xxxx9876' }) }],
    [{ id: 'x', amount: 5, paymentMethod: 'אשראי', paymentDate: '2026-10-02', notes: '{"Other":"a","Z":"b"} "LastNum": "5555"' }],
    [{ id: 'x', amount: 5, paymentMethod: 'אשראי', paymentDate: '2026-10-02', notes: 'שולם בכרטיס אשראי 1234 בהצלחה' }],
    [{ id: 'x', amount: 5, paymentMethod: 'אשראי', paymentDate: '2026-10-02', notes: '{"a":1}' }],
    [{ id: 'x', amount: 5, paymentMethod: 'אשראי', paymentDate: '2026-10-02', notes: null }, { id: 'y', amount: 5, paymentMethod: 'מזומן', paymentDate: '2026-10-03', isDeleted: true }],
  ];
  const customers = [CUSTOMER, { ...CUSTOMER, email: 'miriam', emailSuffix: 'gmail.com' }, { ...CUSTOMER, email: 'miriam', emailSuffix: '@walla.co.il' }, {}, null];
  for (const payments of variants) {
    for (const customer of customers) {
      const leg = legacyScope({ payments, customer });
      evalLegacy(arrowText('handleOpenRefundModal'), leg.scope)();
      assert.deepEqual(A.refundPrefill(customer, payments), leg.cap.set.refundData);
    }
  }
});

test('פרטי בנק לזיכוי קיים - ערכי פתיחה זהים ל-openAutoRefundBankModal', () => {
  for (const refund of [{ id: 'r1' }, { id: 'r1', bankName: 'הפועלים', bankBranch: '612' }, { id: 'r1', bankAccount: '5', bankAccountName: 'א' }]) {
    for (const customer of [CUSTOMER, {}, null]) {
      const leg = legacyScope({ customer });
      evalLegacy(arrowText('openAutoRefundBankModal'), leg.scope)(refund);
      assert.deepEqual(A.autoRefundBankPrefill(refund, customer), leg.cap.set.autoBank);
      assert.equal(leg.cap.set.autoTarget, refund.id);
    }
  }
});

test('"העברה מהירה" + שדה מספר הכרטיס + תוקף: פענוח זהה לישן (טראק 1/2, הדבקה, ספרות בלבד)', () => {
  const swipes = [';4580123456789012=28121010000000000000?', '%B4580123456789012^ISRAEL/MIRIAM^2812101000000?', ';4580=2', '%B4580^NAME', '4580 1234', '', ';=2812?', '%B^N^2812'];
  for (const val of swipes) {
    const leg = legacyScope({ __prev_card: { cardNumber: '', tokef: '' } });
    evalLegacy(arrowText('handleSwipeInputChange'), leg.scope)({ target: { value: val } });
    const got = A.parseSwipe(val);
    if (leg.cap.set.card) assert.deepEqual(got, { cardNumber: leg.cap.set.card.cardNumber, tokef: leg.cap.set.card.tokef }, val);
    else assert.equal(got, null, val);
  }
  const typed = [';4580123456789012=2812', '%B4580123456789012^N^2812', '%B4580^N', '4580-1234 5678', 'abc', '45801234567890123456', ';45=', '%B45^^1'];
  for (const val of typed) {
    const leg = legacyScope({ __prev_card: { cardNumber: 'old', tokef: '01/30' } });
    evalLegacy(arrowText('handleCardNumberChange'), leg.scope)({ target: { value: val } });
    const got = A.cardNumberInput(val, '01/30');
    assert.deepEqual(got, { cardNumber: leg.cap.set.card.cardNumber, tokef: leg.cap.set.card.tokef }, val);
  }
  for (const val of ['1', '12', '123', '1228', '12/28', '12/289', 'ab12cd28']) {
    const leg = legacyScope({ __prev_card: { tokef: '' } });
    evalLegacy(arrowText('handleTokefChange'), leg.scope)({ target: { value: val } });
    assert.equal(A.tokefInput(val), leg.cap.set.card.tokef, val);
  }
});

test('R39: חלון זיכוי דמי ביטול (דקות) + "ניתן לזכות ₪X עוד mm:ss" - זהה ל-creditWindowMinutes/getCancellationCreditInfo של הישן', () => {
  const settingsCases = [[], [{ key: 'CANCELLATION_CREDIT_MINUTES', value: '120' }], [{ key: 'CANCELLATION_CREDIT_MINUTES', value: '0' }], [{ key: 'CANCELLATION_CREDIT_MINUTES', value: '' }], [{ key: 'CANCELLATION_CREDIT_MINUTES', value: 'abc' }], [{ key: 'CANCELLATION_CREDIT_MINUTES', value: '7.5' }]];
  for (const rows of settingsCases) {
    for (const loaded of [true, false]) {
      const legacySettings = Object.fromEntries(rows.map(r => [r.key, r.value]));
      const legMinutes = evalLegacy(iifeText('creditWindowMinutes'), { settings: legacySettings, settingsLoaded: loaded });
      assert.equal(A.creditWindowMinutes(L.parseSettings(rows), loaded), legMinutes, JSON.stringify(rows) + loaded);
    }
  }
  const items = [{ id: 'i1', deletedAt: '2026-10-04T10:00:00.000Z' }, { id: 'i2', deletedAt: null }];
  const obls = [
    { id: 'f1', orderItemId: 'i1', description: 'דמי ביטול דגם 4512', amount: 40 },
    { id: 'f2', orderItemId: 'i1', description: 'זיכוי דמי ביטול על פריט חלופי', amount: -13.3 },
    { id: 'f3', orderItemId: 'i2', description: 'דמי ביטול דגם 1', amount: 40 },
    { id: 'f4', orderItemId: 'i3', description: 'דמי ביטול דגם 2', amount: 40 },
    { id: 'f5', description: 'דמי ביטול בלי פריט', amount: 40 },
    { id: 'f6', orderItemId: 'i1', description: 'השכרה', amount: 40 },
    { id: 'f7', orderItemId: 'i1', description: 'זיכוי דמי ביטול', amount: -30, isDeleted: true },
  ];
  for (const minutes of [null, 15, 120]) {
    for (const extra of [[], [{ id: 'f8', orderItemId: 'i1', description: 'זיכוי דמי ביטול', amount: -26.7 }]]) {
      const all = [...obls, ...extra];
      const active = all.filter(o => !o.isDeleted);
      for (const o of all) {
        const leg = evalLegacy(arrowText('getCancellationCreditInfo'), { activeObligations: active, items, creditWindowMinutes: minutes })(o);
        const got = A.cancellationCreditInfo(o, { obligations: all, items, minutes });
        if (!leg || leg.remaining <= 0.000001) assert.equal(got, null, `${o.id} ${minutes}`);
        else assert.deepEqual(got, { deadline: leg.deadline, remaining: Math.round(leg.remaining * 100) / 100 }, `${o.id} ${minutes}`);
      }
    }
  }
  assert.deepEqual(A.countdownText(Date.parse('2026-10-04T10:15:00Z'), Date.parse('2026-10-04T10:00:00Z')), { text: '15:00', urgent: false });
  assert.deepEqual(A.countdownText(Date.parse('2026-10-04T10:00:59Z'), Date.parse('2026-10-04T10:00:00Z')), { text: '00:59', urgent: true });
  assert.equal(A.countdownText(1000, 1000), null);
});

test('R39 אייקוני סוג החיוב: אותה הכרעה כמו getObligationIcon (#i-* → #gmi-*), משלוח = משאית (מהעיצוב)', () => {
  const legacyIcon = evalLegacy(functionText('getObligationIcon'), {});
  const descs = ['דמי ביטול דגם 1', 'דמי ביטול ותיקונים', 'זיכוי דמי ביטול', 'זיכוי בגין ביטול פריט', 'חיוב מקורי', 'תיקון שרוול', 'השכרת שמלה', 'משלוח הלוך-חזור - ירושלים', '', undefined];
  for (const description of descs) {
    for (const isManual of [true, false, undefined]) {
      const o = { description, isManual };
      const leg = legacyIcon(o);
      const mine = A.obligationIconName(o);
      const expected = A.LEGACY_OBLIGATION_ICON_MAP[leg];
      if (leg === 'i-bag' && (description || '').includes('משלוח')) assert.equal(mine, 'truck');
      else assert.equal(mine, expected, `${description} ${isManual}`);
    }
  }
});

test('אופני "תשלום נוסף" מ-ALLOWED_PAYMENT_METHODS זהים לישן; חלון התשלום: אשראי רק כשנדרים פעיל, ידני רק כש-allow_additional_payment_on_order', () => {
  for (const v of [undefined, '', 'מזומן,אשראי', 'אשראי', ' מזומן , העברה בנקאית ,, צ\'ק ', 'כרטיס אשראי,ביט']) {
    const legacySettings = v === undefined ? {} : { ALLOWED_PAYMENT_METHODS: v };
    const leg = evalLegacy(iifeText('additionalPaymentMethodOptions'), { settings: legacySettings });
    const rows = v === undefined ? [] : [{ key: 'ALLOWED_PAYMENT_METHODS', value: v }];
    assert.deepEqual(A.additionalPaymentMethodOptions(L.parseSettings(rows)), leg, String(v));
  }
  const S = (r) => L.parseSettings(r.map(([key, value]) => ({ key, value })));
  assert.deepEqual(A.payMethodsFor(S([])), ['אשראי'], 'ראשי: רק נדרים (כמו הישן - תשלום נוסף כבוי)');
  assert.deepEqual(A.payMethodsFor(S([['nedarim_plus_enabled', 'false']])), []);
  assert.deepEqual(A.payMethodsFor(S([['allow_additional_payment_on_order', 'true']])), ['אשראי', 'מזומן', 'העברה בנקאית', "צ'ק"]);
  assert.deepEqual(A.payMethodsFor(S([['allow_additional_payment_on_order', 'true']]), { manualOnly: true }), ['מזומן', 'העברה בנקאית', "צ'ק"]);
});

test('W4-MANUAL: אישור feature:manual_payment_credit_add לתשלום/זיכוי ידני בשני הגמ"חים; AMB-17: הלחצן המאוחד רק בנווה (מתג consolidate_manual_payment_credit_ui)', () => {
  const S = (r) => L.parseSettings(r.map(([key, value]) => ({ key, value })));
  assert.equal(A.manualMoneyNeedsApproval(S([['consolidate_manual_payment_credit_ui', 'true']])), true);
  assert.equal(A.manualMoneyNeedsApproval(S([])), true, 'גמ"ח ראשי: גם כן (החלטת הבעלים)');
  assert.equal(A.isUnifiedManualButton(S([['consolidate_manual_payment_credit_ui', 'true']])), true);
  assert.equal(A.isUnifiedManualButton(S([])), false);
  const legacyPage = fs.readFileSync(path.join(PROJ, 'app/orders/[id]/LegacyOrderPage.js'), 'utf8');
  assert.ok(legacyPage.includes("'feature:manual_payment_credit_add'"));
  assert.equal(A.MANUAL_PAYMENT_CREDIT_KEY, 'feature:manual_payment_credit_add');
  assert.ok(MPM.includes("settings.consolidate_manual_payment_credit_ui !== 'true'"), 'בישן הכפתורים הנפרדים מוצגים רק כשהמתג כבוי');
});

test('פרטי תשלום: פענוח ההערות זהה לישן (JSON → שורות; טקסט " | " → שורות; ריק → אין הערות)', () => {
  assert.deepEqual(A.parsePaymentNotes(JSON.stringify({ 'אישור': '1', LastNum: 4432 })), { kind: 'kv', rows: [['אישור', '1'], ['LastNum', '4432']] });
  assert.deepEqual(A.parsePaymentNotes('א | ב'), { kind: 'text', text: 'א\nב' });
  assert.deepEqual(A.parsePaymentNotes('{bad'), { kind: 'text', text: '{bad' });
  assert.deepEqual(A.parsePaymentNotes(''), { kind: 'none' });
  assert.ok(MPM.includes("notes.split(' | ').join('\\n')"));
});

test('A13 שורות "ממתין לשמירה": preview זהה לשמור = רגיל; preview חדש/שונה + חיוב ידני חדש = ממתין; מחוק לא מוצג; החדש למעלה', () => {
  const saved = [OBL[0], OBL[2]];
  const cur = [
    { ...OBL[0], id: undefined, isPreview: true },
    { amount: 40, description: 'דמי ביטול דגם 4512 (פריט #a1)', orderItemId: 'a1', isManual: false, isPreview: true },
    { ...OBL[2] },
    { isNew: true, description: 'חדש', amount: 7, isManual: true, createdAt: '2026-10-04T00:00:00.000Z', _localId: 'L9' },
    { ...OBL[1] },
  ];
  const rows = A.obligationRows(cur, saved);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(r => [r.o.description, r.pend]), [
    ['חדש', true],
    ['הובלה', false],
    ['השכרת שמלה דגם 4512 מידה 38 (פריט #a1)', false],
    ['דמי ביטול דגם 4512 (פריט #a1)', true],
  ]);
  const rows2 = A.obligationRows([{ ...OBL[0], amount: 999, id: undefined, isPreview: true }], saved);
  assert.equal(rows2[0].pend, true, 'סכום שונה מהשמור = ממתין');
});
