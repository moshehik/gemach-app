// שלב 1 בלו״ז: "שולם / שולם חלקי / טרם שולם" נגזר מהתשלומים שנרשמו בפועל, לא מהדגל הישן Order.isPaid
// (דיווח 7f3ee630, נווה יעקב 5.10.2026: האתר לא מעדכן את Order.isPaid, ולכן כל ההזמנות הוצגו "טרם שולם").
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb, ORDERS, NOW, DAY, SETTINGS_ORG2 } from './fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { orderPaymentView } = await L('lib/schedule/payment.js');
const { payText, subParts } = await L('app/components/schedule/scheduleMeta.js');
const { getScheduleDay } = await L('lib/schedule/index.js');
const { resolveScheduleSettings } = await L('lib/schedule/settings.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');

beforeEach(() => { installDb(); invalidateSettingsCache(); });

const pay = (amount, isDeleted = false) => ({ amount, isDeleted });

test('orderPaymentView: paid / partial / unpaid / nothing to pay, deleted payments ignored, overpayment is paid', () => {
  assert.deepEqual(orderPaymentView(720, [pay(720)]), { totalPaid: 720, balance: 0, payStatus: 'paid' });
  assert.deepEqual(orderPaymentView(120, [pay(200)]), { totalPaid: 200, balance: 0, payStatus: 'paid' }); // שולם יותר (זיכוי) - עדיין שולם
  assert.deepEqual(orderPaymentView(500, [pay(100), pay(150.5)]), { totalPaid: 250.5, balance: 249.5, payStatus: 'partial' });
  assert.deepEqual(orderPaymentView(500, []), { totalPaid: 0, balance: 500, payStatus: 'unpaid' });
  assert.deepEqual(orderPaymentView(500, undefined), { totalPaid: 0, balance: 500, payStatus: 'unpaid' });
  assert.equal(orderPaymentView(500, [pay(500, true)]).payStatus, 'unpaid', 'a deleted payment does not count');
  assert.equal(orderPaymentView(null, []).payStatus, null, 'no amount and no payment: nothing to show');
  assert.equal(orderPaymentView(0, [pay(50)]).payStatus, 'paid');
});

test('payText: the three phrases, and the old isPaid flag only as a fallback when payStatus is absent', () => {
  assert.equal(payText({ payStatus: 'paid' }), 'שולם');
  assert.equal(payText({ payStatus: 'unpaid' }), 'טרם שולם');
  assert.match(payText({ payStatus: 'partial', balance: 250 }), /^שולם חלקי · נותר ₪250$/);
  assert.equal(payText({ payStatus: null }), '');
  assert.equal(payText({ isPaid: true }), 'שולם');
  assert.equal(payText({ isPaid: false }), 'טרם שולם');
  const parts = subParts('order', { eventDateHebrew: 'ד חשון', totalAmount: 720, payStatus: 'paid', dressCount: 2 });
  assert.ok(parts.includes('שולם') && !parts.includes('טרם שולם'));
});

test('stage 1 row: paid order whose isPaid flag is false (the real Neve case) shows paid; the where clause still never filters on isPaid', async () => {
  globalThis.__MOCK_DB.order = ORDERS.map((o) => {
    if (o.orderId === 1001) return { ...o, isPaid: false, totalAmount: 240, payments: [pay(240)] };
    if (o.orderId === 1002) return { ...o, isPaid: false, totalAmount: 500, payments: [pay(100), pay(999, true)] };
    return o;
  });
  const res = await getScheduleDay({ date: DAY, user: { id: 'emp-head', roleId: 0 }, now: NOW, settings: resolveScheduleSettings(Object.fromEntries(SETTINGS_ORG2.map((r) => [r.key, r.value]))) });
  const rows = res.stages.find((s) => s.key === 'order').items;
  const r1 = rows.find((r) => r.orderId === 1001);
  const r2 = rows.find((r) => r.orderId === 1002);
  assert.equal(r1.payStatus, 'paid'); assert.equal(r1.isPaid, true); assert.equal(r1.totalPaid, 240); assert.equal(r1.balance, 0);
  assert.equal(r2.payStatus, 'partial'); assert.equal(r2.isPaid, false); assert.equal(r2.totalPaid, 100); assert.equal(r2.balance, 400);
  const q = globalThis.__MOCK_CALLS.find((c) => c.model === 'order' && c.args.where.orderDate);
  assert.equal(q.args.where.isPaid, undefined);
  assert.deepEqual(q.args.select.payments, { where: { isDeleted: false }, select: { amount: true } }, 'one relation select, no extra query');
  assert.equal(q.args.select.isPaid, true, 'the legacy flag is selected only as a fallback for orders without payment rows');
});

test('legacy isPaid fallback: imported order with isPaid=true and NO payment rows shows paid; any payment row makes the payments decide', () => {
  assert.deepEqual(orderPaymentView(500, [], true), { totalPaid: 0, balance: 0, payStatus: 'paid' });
  assert.deepEqual(orderPaymentView(500, undefined, true), { totalPaid: 0, balance: 0, payStatus: 'paid' });
  assert.equal(orderPaymentView(500, [pay(500, true)], true).payStatus, 'paid', 'only deleted payments: still the legacy flag');
  assert.equal(orderPaymentView(500, [pay(100)], true).payStatus, 'partial', 'real payments decide, the stale flag is ignored');
  assert.equal(orderPaymentView(500, [], false).payStatus, 'unpaid', 'the real Neve case: flag false, no payments');
  assert.equal(orderPaymentView(500, [], undefined).payStatus, 'unpaid');
  assert.equal(orderPaymentView(null, [], true).payStatus, null, 'no amount: nothing to show even if flagged');
});
