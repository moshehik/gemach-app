// סבב סקירה 2, צד שרת (S1): מחיר הצטרפות למשלוח רק כשההצטרפות עדיין תקפה. prisma בזיכרון (neve-shims). בלי DB.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
function resetFake() {
  globalThis.__neveFake = { db: { deliveryJoin: [], order: [], paymentObligation: [] }, audits: [], queries: [], failWith: null, noModel: false,
    settings: { enable_delivery_join: 'true', delivery_join_price: '20', delivery_price_by_city: JSON.stringify({ 'ירושלים': 40 }), delivery_price: '50' } };
  return globalThis.__neveFake;
}
resetFake();
register(pathToFileURL(path.join(PROJ, 'scripts/order-card-tests/neve-shims/hooks.mjs')).href);
const J = await import(pathToFileURL(path.join(PROJ, 'lib/deliveryJoin.js')).href);
const E = await import(pathToFileURL(path.join(PROJ, 'lib/pricingEngine.js')).href);

const cust = { firstName: 'א', lastName: 'ב', phone1: '050', phone2: null, city: 'ירושלים', street: 'עמוס', houseNum: '3' };
const ord = (orderId, over = {}) => ({
  orderId, isDeleted: false, isDelivery: true, eventDate: '2026-10-07T09:00:00.000Z', fromDate: null, deliveryDirection: 'הלוך-חזור', deliveryOneDayBefore: false,
  deliveryAddress: 'עמוס 3', deliveryCity: 'ירושלים', customer: cust, obligations: [], ...over,
});
const seed = (orders, joins = []) => { const f = globalThis.__neveFake; f.db.order.push(...orders); f.db.deliveryJoin.push(...joins); return f; };
const jrow = (orderId, over = {}) => ({ orderId, joinedToOrderId: null, isPrimary: false, direction: null, ...over });
const charged = (f) => f.db.paymentObligation.map(o => o.amount);

beforeEach(() => { resetFake(); J.resetDeliveryJoinTableState(); });

test('S1: הצטרפות תקפה = מחיר הצטרפות (20 לצד, 40 להלוך-חזור); אין מחיקה', async () => {
  const f = seed([ord(1), ord(2)], [jrow(2, { joinedToOrderId: 1, direction: 'הלוך-חזור' })]);
  await E.applyDeliveryCharge(2);
  assert.deepEqual(charged(f), [40]);
  assert.equal(f.db.deliveryJoin.length, 1);
});

test('S1: יום האירוע של ההזמנה השתנה אחרי ההצטרפות - מחיר רגיל (40 לצד, 80 להלוך-חזור), שורת ההצטרפות נמחקת עם audit', async () => {
  const f = seed([ord(1), ord(2, { eventDate: '2026-10-09T09:00:00.000Z' })], [jrow(2, { joinedToOrderId: 1, direction: 'הלוך-חזור' })]);
  await E.applyDeliveryCharge(2);
  assert.deepEqual(charged(f), [80]);
  assert.equal(f.db.deliveryJoin.length, 0);
  assert.equal(f.audits.at(-1).action, 'DELIVERY_JOIN_CANCELLED');
});

test('S1: כיוון המשלוח השתנה (הלוך-חזור → הלוך מול שורש "חזור") - מחיר רגיל', async () => {
  const f = seed([ord(1, { deliveryDirection: 'חזור' }), ord(2, { deliveryDirection: 'הלוך' })], [jrow(2, { joinedToOrderId: 1 })]);
  await E.applyDeliveryCharge(2);
  assert.deepEqual(charged(f), [40]);
  assert.equal(f.db.deliveryJoin.length, 0);
});

test('S1: השורש נמחק / כבר לא משלוח / הצטרף בעצמו למשלוח אחר - מחיר רגיל', async () => {
  for (const [rootOver, extraRows] of [[{ isDeleted: true }, []], [{ isDelivery: false }, []], [{}, [jrow(1, { joinedToOrderId: 9 })]]]) {
    resetFake(); J.resetDeliveryJoinTableState();
    const f = seed([ord(1, rootOver), ord(2), ord(9)], [jrow(2, { joinedToOrderId: 1 }), ...extraRows]);
    await E.applyDeliveryCharge(2);
    assert.deepEqual(charged(f), [80], JSON.stringify(rootOver));
    assert.ok(!f.db.deliveryJoin.some(r => r.orderId === 2), 'שורת ההצטרפות נמחקה');
  }
});

test('S1: הצטרפות תקפה לא נוגעת בשורת "ראשי"; הצטרפות שהתיישנה לא נוגעת בשורת ה"ראשי" של השורש', async () => {
  const f = seed([ord(1), ord(2, { eventDate: '2026-10-09T09:00:00.000Z' })], [jrow(1, { isPrimary: true }), jrow(2, { joinedToOrderId: 1 })]);
  await E.applyDeliveryCharge(2);
  assert.deepEqual(f.db.deliveryJoin.map(r => r.orderId), [1]);
});

test('S1: isOrderJoinValid עם overrides (תצוגה מקדימה): תאריך שהשתנה בכרטיס ← לא תקף, בלי מחיקה', async () => {
  const f = seed([ord(1), ord(2)], [jrow(2, { joinedToOrderId: 1, direction: 'הלוך-חזור' })]);
  assert.equal(await J.isOrderJoinValid(2), true);
  assert.equal(await J.isOrderJoinValid(2, { overrides: { eventDate: '2026-10-09T09:00:00.000Z' } }), false);
  assert.equal(await J.isOrderJoinValid(2, { overrides: { isDelivery: false } }), false);
  assert.equal(await J.isOrderJoinValid(2, { overrides: { deliveryDirection: 'חזור' } }), true, 'הלוך-חזור של השורש מכסה חזור');
  assert.equal(f.db.deliveryJoin.length, 1, 'ללא dropStale אין מחיקה');
});

test('S1: טבלה חסרה / אין שורת הצטרפות = לא תקף (מחיר רגיל), בלי זריקה', async () => {
  const f = seed([ord(1), ord(2)], []);
  assert.equal(await J.isOrderJoinValid(2), false);
  globalThis.__neveFake.noModel = true; J.resetDeliveryJoinTableState();
  assert.equal(await J.isOrderJoinValid(2, { dropStale: true }), false);
  assert.equal(f.audits.length, 0);
});

test('S1 (סטטי): preview-pricing ו-applyDeliveryCharge משתמשים ב-isOrderJoinValid', async () => {
  const fs = await import('node:fs');
  const eng = fs.readFileSync(path.join(PROJ, 'lib/pricingEngine.js'), 'utf8');
  assert.ok(/isOrderJoinValid\(order\.orderId, \{ dropStale: true \}\)/.test(eng) && !/isOrderJoined\(/.test(eng));
  const prev = fs.readFileSync(path.join(PROJ, 'app/api/orders/[id]/preview-pricing/route.js'), 'utf8');
  assert.ok(/isOrderJoinValid\(parsedOrderId, \{ overrides:/.test(prev) && !/isOrderJoined\(/.test(prev));
});
