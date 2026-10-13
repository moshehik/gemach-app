// GET/POST /api/orders/[id]/shared-delivery עם lib/auth.js ו-lib/permissions.js האמיתיים (רק next/headers ו-prisma מוחלפים):
// החלפת "משלוח ראשי" דורשת את הרשאת עריכת הזמנות קיימות (page:orders) - לא כל עובדת מחוברת (החלטת הבעלים 12.10.2026, סעיף 15).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/orders/[id]/shared-delivery/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const Cache = await L('lib/settingsCache.js');
const Join = await L('lib/deliveryJoin.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');

const EVENT = new Date('2026-12-01T00:00:00Z');
const obl = (orderId, amount) => ({ id: `ob${orderId}`, orderId, amount, quantity: 2, description: 'משלוח הלוך-חזור - ירושלים', isManual: false, isDeleted: false });

function install() {
  const settings = {
    require_login: 'true', enable_deliveries: 'true', shared_delivery_enabled: 'true', shared_delivery_price: '20',
    delivery_price_by_city: JSON.stringify({ 'ירושלים': 40 }), delivery_price: '40', delivery_charge_customer_city_fallback: 'true',
  };
  const cust = (id) => ({ id, firstName: id, lastName: 'x', street: 'הנטקה', houseNum: 52, city: 'ירושלים' });
  const order = (orderId, customerId, t) => ({
    id: `o${orderId}`, orderId, customerId, totalAmount: null, orderDate: new Date(t), status: 'חדש', isDeleted: false, isDelivery: true,
    eventDate: EVENT, fromDate: null, deliveryDirection: 'הלוך-חזור', deliveryOneDayBefore: false, deliveryAddress: null, deliveryCity: null,
  });
  globalThis.__MOCK_DB = {
    systemSetting: Object.entries(settings).map(([key, value]) => ({ key, value })),
    customer: [cust('c1'), cust('c2')],
    order: [order(1, 'c1', 1000), order(2, 'c2', 2000)],
    paymentObligation: [obl(1, 80), obl(2, 40).id ? { ...obl(2, 40), description: 'משלוח הלוך-חזור - ירושלים (משלוח משותף - מחיר מוזל)' } : null],
    payment: [], refund: [], deliveryJoin: [],
    employee: [
      { id: 'emp-edit', roleId: 5, isActive: true, firstName: 'עורכת', lastName: 'הזמנות' },
      { id: 'emp-blocked', roleId: 6, isActive: true, firstName: 'חסומה', lastName: 'x' },
      { id: 'emp-norow', roleId: 7, isActive: true, firstName: 'בלי', lastName: 'שורה' },
    ],
    departmentPermission: [
      { roleId: 5, key: 'page:orders', value: 'true' },
      { roleId: 6, key: 'page:orders', value: 'false' },
    ],
    employeePermissionOverride: [],
  };
  globalThis.__MOCK_CALLS = [];
  globalThis.__MOCK_FAIL_ON = null;
  globalThis.__MOCK_NO_MODEL = [];
  Cache.invalidateAllSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache(); Join.resetDeliveryJoinTableState();
}
const ctx = (id) => ({ params: Promise.resolve({ id: String(id) }) });
const post = (id, body) => route.POST({ json: async () => body, url: 'http://localhost' }, ctx(id));
const get = (id) => route.GET({ url: 'http://localhost' }, ctx(id));
const charge = (orderId) => globalThis.__MOCK_DB.paymentObligation.find((o) => o.orderId === orderId);

beforeEach(() => { install(); globalThis.__AUTH_TOKEN = null; });

test('401 בלי התחברות (GET ו-POST)', async () => {
  assert.equal((await get(1)).status, 401);
  assert.equal((await post(1, { primaryOrderId: 1 })).status, 401);
});

test('POST: עובדת עם הרשאת עריכת הזמנות - מחליפה ראשי; ללא שורה / שורה סגורה - 403 ושום כתיבה', async () => {
  globalThis.__AUTH_TOKEN = 'emp-blocked';
  let r = await post(2, { primaryOrderId: 2 });
  assert.equal(r.status, 403, JSON.stringify(r.__json));
  globalThis.__AUTH_TOKEN = 'emp-norow';
  r = await post(2, { primaryOrderId: 2 });
  assert.equal(r.status, 403);
  assert.equal(globalThis.__MOCK_DB.deliveryJoin.length, 0);
  assert.equal(charge(1).amount, 80); assert.equal(charge(2).amount, 40);
  globalThis.__AUTH_TOKEN = 'emp-edit';
  r = await post(2, { primaryOrderId: 2 });
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.changed, true);
  assert.equal(charge(2).amount, 80); assert.equal(charge(1).amount, 40);
  assert.equal(r.__json.notices.length, 2);
});

test('POST: קלט שגוי', async () => {
  globalThis.__AUTH_TOKEN = 'emp-edit';
  assert.equal((await post(2, {})).status, 400);
  assert.equal((await post('abc', { primaryOrderId: 1 })).status, 400);
  assert.equal((await post(2, { primaryOrderId: 999 })).status, 400);
});

test('GET: canChangePrimary נכבה למי שאין לה הרשאת עריכה; פיצ\'ר כבוי = enabled:false', async () => {
  globalThis.__AUTH_TOKEN = 'emp-edit';
  let r = await get(2);
  assert.equal(r.status, 200);
  assert.equal(r.__json.shared, true);
  assert.equal(r.__json.canChangePrimary, true);
  globalThis.__AUTH_TOKEN = 'emp-blocked';
  r = await get(2);
  assert.equal(r.__json.canChangePrimary, false);
  assert.equal(r.__json.members.length, 2);
  install();
  globalThis.__MOCK_DB.systemSetting = globalThis.__MOCK_DB.systemSetting.filter((s) => s.key !== 'shared_delivery_enabled');
  Cache.invalidateAllSettingsCache();
  globalThis.__AUTH_TOKEN = 'emp-edit';
  assert.deepEqual((await get(2)).__json, { enabled: false });
});

test('הזמנות קפואות (shared_delivery_first_order_id): POST מחזיר 409 בעברית אל / מקפואה ובקבוצה שיש בה קפואה, בלי שום כתיבה; GET מכבה את הכפתורים', async () => {
  const MSG = 'הזמנה זו קיימת מלפני הפעלת המשלוח המשותף ואינה משתתפת בהנחה';
  // הזמנות 1 ו-2 קיימות מלפני ההפעלה (קפואות); 3 ו-4 חדשות באותה כתובת ויום
  globalThis.__MOCK_DB.systemSetting.push({ key: 'shared_delivery_first_order_id', value: '3' });
  globalThis.__MOCK_DB.customer.push({ id: 'c3', firstName: 'c3', lastName: 'x', street: 'הנטקה', houseNum: 52, city: 'ירושלים' }, { id: 'c4', firstName: 'c4', lastName: 'x', street: 'הנטקה', houseNum: 52, city: 'ירושלים' });
  const mk = (orderId, customerId, t) => ({ id: `o${orderId}`, orderId, customerId, totalAmount: null, orderDate: new Date(t), status: 'חדש', isDeleted: false, isDelivery: true, eventDate: EVENT, fromDate: null, deliveryDirection: 'הלוך-חזור', deliveryOneDayBefore: false, deliveryAddress: null, deliveryCity: null });
  globalThis.__MOCK_DB.order.push(mk(3, 'c3', 3000), mk(4, 'c4', 4000));
  globalThis.__MOCK_DB.paymentObligation.push({ ...obl(3, 40), description: 'משלוח הלוך-חזור - ירושלים (משלוח משותף - מחיר מוזל)' }, { ...obl(4, 40), description: 'משלוח הלוך-חזור - ירושלים (משלוח משותף - מחיר מוזל)' });
  Cache.invalidateAllSettingsCache();
  globalThis.__AUTH_TOKEN = 'emp-edit';
  const before = JSON.stringify([globalThis.__MOCK_DB.paymentObligation, globalThis.__MOCK_DB.deliveryJoin, globalThis.__MOCK_DB.refund]);
  for (const [id, target] of [[3, 1], [1, 3], [2, 1], [3, 4], [4, 3]]) {
    const r = await post(id, { primaryOrderId: target });
    assert.equal(r.status, 409, `${id}->${target}: ${JSON.stringify(r.__json)}`);
    assert.equal(r.__json.frozen, true);
    assert.match(r.__json.error, /קיימת מלפני הפעלת המשלוח המשותף/);
    if (id === 3 && target === 1) assert.equal(r.__json.error, MSG);
  }
  assert.equal(JSON.stringify([globalThis.__MOCK_DB.paymentObligation, globalThis.__MOCK_DB.deliveryJoin, globalThis.__MOCK_DB.refund]), before, 'שום כתיבה');
  // GET: הכרטיס של החדשה מכבה את כפתורי ההחלפה; הכרטיס של הקפואה לא רלוונטי
  const g3 = (await get(3)).__json;
  assert.equal(g3.shared, true); assert.equal(g3.canChangePrimary, false); assert.equal(g3.frozenInGroup, true);
  assert.deepEqual(g3.members.map((m) => [m.orderId, m.frozen]), [[1, true], [2, true], [3, false], [4, false]]);
  const g1 = (await get(1)).__json;
  assert.equal(g1.applicable, false); assert.equal(g1.frozen, true); assert.equal(g1.message, MSG);
});
