// משלוח משותף - השרת מול Prisma בזיכרון (lib/sharedDelivery.js + applyDeliveryCharge האמיתי + syncPendingCreditRefund האמיתי).
// כל מקרה בונה DB מאפס. הרצה: node scripts/shared-delivery-tests/run.mjs   (3 אזורי זמן)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const SD = await L('lib/sharedDelivery.js');
const Engine = await L('lib/pricingEngine.js');
const Cache = await L('lib/settingsCache.js');
const Join = await L('lib/deliveryJoin.js');

const DAY = '2026-12-01';
const EVENT = new Date(`${DAY}T00:00:00.000Z`); // כפי ש-UI שומר: חצות UTC של התאריך
const T0 = Date.parse('2026-11-01T08:00:00Z');

const BASE_SETTINGS = {
  enable_deliveries: 'true',
  shared_delivery_enabled: 'true',
  shared_delivery_price_mode: 'global',
  shared_delivery_price: '20',
  delivery_price_by_city: JSON.stringify({ 'ירושלים': 40, 'בית שמש': 70, 'ביתר': 70 }),
  delivery_price: '40',
  delivery_charge_customer_city_fallback: 'true',
};

let seq;
function reset(settings = {}) {
  seq = 0;
  globalThis.__MOCK_CALLS = [];
  globalThis.__MOCK_FAIL_ON = null;
  globalThis.__MOCK_NO_MODEL = [];
  const rows = Object.entries({ ...BASE_SETTINGS, ...settings }).filter(([, v]) => v !== undefined && v !== null).map(([key, value]) => ({ key, value }));
  globalThis.__MOCK_DB = { order: [], customer: [], paymentObligation: [], payment: [], refund: [], systemSetting: rows, deliveryJoin: [] };
  Cache.invalidateAllSettingsCache();
  Join.resetDeliveryJoinTableState();
}
const db = () => globalThis.__MOCK_DB;

function addCustomer(over = {}) {
  seq += 1;
  const c = { id: `c${seq}`, firstName: `ל${seq}`, lastName: `כ${seq}`, street: 'הנטקה', houseNum: 52, city: 'ירושלים', ...over };
  db().customer.push(c);
  return c;
}
let orderSeq = 1000;
function addOrder(over = {}) {
  orderSeq += 1;
  const cust = over.customerId ? db().customer.find((c) => c.id === over.customerId) : addCustomer();
  const o = {
    id: `o${orderSeq}`, orderId: orderSeq, customerId: cust.id, totalAmount: null, orderDate: new Date(T0 + (orderSeq - 1000) * 60000),
    status: 'חדש', isDeleted: false, isDelivery: true, eventDate: EVENT, fromDate: null, deliveryDirection: 'הלוך-חזור',
    deliveryOneDayBefore: false, deliveryAddress: null, deliveryCity: null, ...over,
  };
  db().order.push(o);
  return o;
}
const setOrder = (orderId, patch) => Object.assign(db().order.find((o) => o.orderId === orderId), patch);
const setCustomer = (id, patch) => Object.assign(db().customer.find((c) => c.id === id), patch);
const pay = (orderId, amount) => db().payment.push({ id: `p${++seq}`, orderId, amount, isDeleted: false });
const allObl = (orderId) => db().paymentObligation.filter((o) => o.orderId === orderId && !o.isDeleted);
const charge = (orderId) => allObl(orderId).find((o) => o.description.includes('משלוח'));
const refunds = (orderId) => db().refund.filter((r) => r.orderId === orderId && !r.isDeleted && !r.isExecuted);
const writes = () => (globalThis.__MOCK_CALLS || []).filter((c) => ['create', 'update', 'delete'].includes(c.method));

// מדמה "שמירת הזמנה": recalc מוחק את שורת המשלוח, applyDeliveryCharge יוצר מחדש (כמו ב-PUT/POST האמיתיים), ואז ההזמנה נשמרת כסכום "בלי משלוח"
async function saveOrder(orderId, { dropExisting = true } = {}) {
  if (dropExisting) db().paymentObligation = db().paymentObligation.filter((o) => !(o.orderId === orderId && !o.isManual && o.description.includes('משלוח')));
  await Engine.applyDeliveryCharge(orderId);
}
// מדמה POST של הזמנה חדשה: charge + reconcile לקבוצה
async function createFlow(orderId) {
  await saveOrder(orderId, { dropExisting: false });
  const key = await SD.getSharedGroupKeyForOrder(orderId);
  return SD.reconcileSharedDelivery({ groupKeys: [key], excludeOrderIds: [orderId] });
}
// מדמה PUT: preKey -> שינוי -> charge -> reconcile(pre, post)
async function editFlow(orderId, patch) {
  const pre = await SD.getSharedGroupKeyForOrder(orderId);
  setOrder(orderId, patch);
  await saveOrder(orderId);
  const post = await SD.getSharedGroupKeyForOrder(orderId);
  return SD.reconcileSharedDelivery({ groupKeys: [pre, post], excludeOrderIds: [orderId] });
}
async function cancelFlow(orderId) {
  const key = await SD.getSharedGroupKeyForOrder(orderId);
  setOrder(orderId, { isDeleted: true });
  db().paymentObligation.filter((o) => o.orderId === orderId).forEach((o) => { o.isDeleted = true; });
  return SD.reconcileSharedDelivery({ groupKeys: [key], excludeOrderIds: [orderId] });
}

beforeEach(() => reset());

test('כבוי כברירת מחדל: בלי הגדרה / בלי enable_deliveries - מחיר מלא ואפס שאילתות הזמנות (הגמ"ח הראשי)', async () => {
  for (const settings of [{ shared_delivery_enabled: undefined }, { enable_deliveries: undefined }, { shared_delivery_enabled: 'false' }, { enable_deliveries: 'false' }]) {
    reset(settings);
    const a = addOrder(); const b = addOrder();
    await saveOrder(a.orderId); await saveOrder(b.orderId);
    assert.equal(charge(a.orderId).amount, 80);
    assert.equal(charge(b.orderId).amount, 80, JSON.stringify(settings));
    globalThis.__MOCK_CALLS = [];
    assert.equal(await SD.getSharedGroupKeyForOrder(a.orderId), null);
    const rec = await SD.reconcileSharedDelivery({ groupKeys: ['2026-12-01|x'] });
    assert.equal(rec.enabled, false);
    assert.deepEqual((await SD.getSharedDeliveryInfo(a.orderId)), { enabled: false });
    assert.equal((await SD.previewSharedDelivery({ isDelivery: true })).enabled, false);
    assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order').length, 0, 'אין נגיעה בטבלת ההזמנות כשהפיצ\'ר כבוי');
  }
});

test('שתי הזמנות לאותה כתובת ויום: הראשונה מלא, השנייה מוזלת; שמירה חוזרת אידמפוטנטית', async () => {
  const a = addOrder(); const b = addOrder();
  assert.deepEqual((await createFlow(a.orderId)).notices, []);
  assert.equal(charge(a.orderId).amount, 80);
  const rec = await createFlow(b.orderId);
  assert.equal(charge(b.orderId).amount, 40);
  assert.ok(charge(b.orderId).description.includes('משלוח משותף'));
  assert.equal(charge(a.orderId).amount, 80, 'הראשית נשארת במחיר הרגיל');
  assert.deepEqual(rec.notices, []);
  // שמירה חוזרת של B ושל A: אותו מצב, אפס כתיבות בחישוב מחדש
  globalThis.__MOCK_CALLS = [];
  const again = await SD.reconcileSharedDelivery({ groupKeys: [await SD.getSharedGroupKeyForOrder(a.orderId)] });
  assert.equal(again.notices.length, 0);
  assert.equal(writes().length, 0);
  await saveOrder(b.orderId);
  assert.equal(charge(b.orderId).amount, 40);
  assert.equal(allObl(b.orderId).filter((o) => o.description.includes('משלוח')).length, 1);
});

test('שלוש הזמנות: ראשית מלא, שתיים מוזלות; ההזמנה הראשונה נקבעת לפי orderDate ולא לפי מספר הזמנה', async () => {
  const a = addOrder({ orderDate: new Date(T0 + 5 * 3600e3) });
  const b = addOrder({ orderDate: new Date(T0) }); // מספר הזמנה גבוה יותר אבל נרשמה קודם
  const c = addOrder({ orderDate: new Date(T0 + 9 * 3600e3) });
  for (const o of [a, b, c]) await saveOrder(o.orderId);
  assert.deepEqual([charge(a.orderId).amount, charge(b.orderId).amount, charge(c.orderId).amount], [40, 80, 40]);
});

test('הזמנה ששולמה במלואה מוזלת בדיעבד: נרשם זיכוי אוטומטי יחיד ובגובה ההפרש; חישוב חוזר לא מכפיל', async () => {
  const a = addOrder({ totalAmount: 80 }); const b = addOrder({ totalAmount: 80 });
  await saveOrder(a.orderId, { dropExisting: false }); // לפני ש-B קיימת בקבוצה: a=80
  // B נוצרה ושולמה 80 (המחיר הרגיל) לפני שההנחה חושבה
  db().paymentObligation.push({ id: 'ob-b', orderId: b.orderId, amount: 80, quantity: 2, description: 'משלוח הלוך-חזור - ירושלים', isManual: false, isDeleted: false });
  pay(a.orderId, 80); pay(b.orderId, 80);
  const rec = await SD.reconcileSharedDelivery({ groupKeys: [await SD.getSharedGroupKeyForOrder(a.orderId)] });
  assert.equal(charge(b.orderId).amount, 40);
  assert.equal(rec.notices.length, 1);
  assert.equal(rec.notices[0].orderId, b.orderId);
  assert.equal(rec.notices[0].delta, -40);
  assert.equal(rec.notices[0].creditAmount, 40);
  assert.match(rec.notices[0].message, /זיכוי/);
  assert.equal(refunds(b.orderId).length, 1);
  assert.equal(refunds(b.orderId)[0].amount, 40);
  assert.equal(refunds(b.orderId)[0].isAutoGenerated, true);
  assert.equal(db().order.find((o) => o.orderId === b.orderId).totalAmount, 40, 'הסכום השמור התעדכן (כלל את המשלוח הישן 80)');
  // חזרה על אותו חישוב: אותה תוצאה, אין עוד זיכוי, אין כתיבות
  globalThis.__MOCK_CALLS = [];
  const again = await SD.reconcileSharedDelivery({ groupKeys: [await SD.getSharedGroupKeyForOrder(a.orderId)] });
  assert.equal(again.notices.length, 0);
  assert.equal(refunds(b.orderId).length, 1);
  assert.equal(writes().length, 0);
});

test('החלפת משלוח ראשי: הראשית הישנה מוזלת (זיכוי אוטומטי), החדשה עולה (חוב); החלפה פעמיים ברצף וחזרה', async () => {
  const a = addOrder({ totalAmount: 80 }); const b = addOrder({ totalAmount: 40 });
  await saveOrder(a.orderId); await saveOrder(b.orderId);
  db().order.find((o) => o.orderId === a.orderId).totalAmount = 80;
  db().order.find((o) => o.orderId === b.orderId).totalAmount = 40;
  pay(a.orderId, 80); pay(b.orderId, 40);
  const r1 = await SD.setSharedDeliveryPrimary(b.orderId, b.orderId);
  assert.equal(r1.ok, true); assert.equal(r1.changed, true);
  assert.equal(charge(a.orderId).amount, 40);
  assert.equal(charge(b.orderId).amount, 80);
  const na = r1.notices.find((n) => n.orderId === a.orderId); const nb = r1.notices.find((n) => n.orderId === b.orderId);
  assert.equal(na.creditAmount, 40); assert.equal(nb.debtAmount, 40);
  assert.match(nb.message, /יש לגבות 40/);
  assert.equal(refunds(a.orderId)[0].amount, 40);
  assert.equal(refunds(b.orderId).length, 0);
  assert.equal(r1.info.isPrimary, true);
  // בחירה חוזרת של אותה ראשית: אין שינוי
  const r1b = await SD.setSharedDeliveryPrimary(b.orderId, b.orderId);
  assert.equal(r1b.changed, false);
  // חזרה ל-A (ברירת המחדל): הסימון נמחק, המחירים חוזרים והזיכוי נמחק
  const r2 = await SD.setSharedDeliveryPrimary(a.orderId, a.orderId);
  assert.equal(r2.changed, true);
  assert.equal(charge(a.orderId).amount, 80);
  assert.equal(charge(b.orderId).amount, 40);
  assert.equal(refunds(a.orderId).length, 0, 'הזיכוי האוטומטי של A נמחק כי היתרה התאפסה');
  assert.equal(db().deliveryJoin.length, 0, 'ברירת המחדל = בלי שורת סימון');
  // החלפה פעמיים ברצף לאותו כיוון
  await SD.setSharedDeliveryPrimary(b.orderId, b.orderId);
  await SD.setSharedDeliveryPrimary(b.orderId, a.orderId);
  assert.equal(charge(a.orderId).amount, 80);
  assert.equal(charge(b.orderId).amount, 40);
});

test('החלפת ראשית: שגיאות (הזמנה לא בקבוצה, בודדת, טבלת DeliveryJoin חסרה)', async () => {
  const a = addOrder(); const lone = addOrder({ deliveryAddress: 'סולם יעקב 30' });
  await saveOrder(a.orderId); await saveOrder(lone.orderId);
  assert.match((await SD.setSharedDeliveryPrimary(lone.orderId, lone.orderId)).error, /אין הזמנות נוספות/);
  const b = addOrder();
  await saveOrder(b.orderId);
  assert.match((await SD.setSharedDeliveryPrimary(a.orderId, lone.orderId)).error, /אינה בקבוצת/);
  // טבלה חסרה: אי אפשר להחליף, אבל ברירת המחדל עובדת
  delete db().deliveryJoin; Cache.invalidateAllSettingsCache();
  const r = await SD.setSharedDeliveryPrimary(a.orderId, b.orderId);
  assert.equal(r.ok, false); assert.equal(r.unavailable, true);
  assert.equal(charge(a.orderId).amount, 80);
  const info = await SD.getSharedDeliveryInfo(a.orderId);
  assert.equal(info.canChangePrimary, false);
  assert.equal(info.shared, true);
});

test('ביטול / מחיקת הראשית: הבאה בתור הופכת לראשית ומחויבת במחיר מלא (חוב); ביטול הנוספת - הראשית לא משתנה', async () => {
  const a = addOrder({ totalAmount: 80 }); const b = addOrder({ totalAmount: 40 }); const c = addOrder({ totalAmount: 40 });
  for (const o of [a, b, c]) await saveOrder(o.orderId);
  [[a, 80], [b, 40], [c, 40]].forEach(([o, t]) => { db().order.find((x) => x.orderId === o.orderId).totalAmount = t; pay(o.orderId, t); });
  const rec = await cancelFlow(a.orderId);
  assert.equal(charge(b.orderId).amount, 80);
  assert.equal(charge(c.orderId).amount, 40);
  assert.equal(rec.notices.length, 1);
  assert.equal(rec.notices[0].orderId, b.orderId);
  assert.equal(rec.notices[0].debtAmount, 40);
  // ביטול C (לא ראשית): B נשארת ראשית, אין שינוי נוסף
  const rec2 = await cancelFlow(c.orderId);
  assert.equal(rec2.notices.length, 0);
  assert.equal(charge(b.orderId).amount, 80);
  // כשנשארת הזמנה אחת - היא כבר ראשית ומלאה (אין "הנחה" ללא עם מי לחלוק)
  assert.equal((await SD.getSharedDeliveryInfo(b.orderId)).shared, false);
});

test('ביטול הראשית כשהשנייה ידנית-ראשית: סימון ישן של הזמנה מבוטלת לא משפיע', async () => {
  const a = addOrder(); const b = addOrder(); const c = addOrder();
  for (const o of [a, b, c]) await saveOrder(o.orderId);
  await SD.setSharedDeliveryPrimary(a.orderId, b.orderId);
  assert.equal(charge(b.orderId).amount, 80);
  await cancelFlow(b.orderId);
  // A (נרשמה ראשונה) חוזרת להיות הראשית
  assert.equal(charge(a.orderId).amount, 80);
  assert.equal(charge(c.orderId).amount, 40);
});

test('עריכת כתובת של הזמנה מוזלת: יוצאת מהקבוצה וחוזרת למחיר מלא; חזרה לכתובת - מוזלת שוב', async () => {
  const a = addOrder(); const b = addOrder();
  await createFlow(a.orderId); await createFlow(b.orderId);
  assert.equal(charge(b.orderId).amount, 40);
  await editFlow(b.orderId, { deliveryAddress: 'סולם יעקב 30' });
  assert.equal(charge(b.orderId).amount, 80);
  assert.equal(charge(a.orderId).amount, 80);
  await editFlow(b.orderId, { deliveryAddress: null });
  assert.equal(charge(b.orderId).amount, 40);
  // שגיאת כתיב ברחוב (מקבצים כתיב מלא/חסר, לא שם רחוב אחר)
  await editFlow(b.orderId, { deliveryAddress: 'הנטקה 52 ירושלים' });
  assert.equal(charge(b.orderId).amount, 40);
  await editFlow(b.orderId, { deliveryAddress: 'הנטקא 52' });
  assert.equal(charge(b.orderId).amount, 80, 'שגיאת כתיב אמיתית (אות שונה) לא מקובצת - מחמירים');
});

test('עריכת כתובת של הראשית: הנוספת הופכת לראשית (חוב), הראשית שיצאה מחויבת מלא', async () => {
  const a = addOrder({ totalAmount: 80 }); const b = addOrder({ totalAmount: 40 });
  await createFlow(a.orderId); await createFlow(b.orderId);
  db().order.find((o) => o.orderId === a.orderId).totalAmount = 80; db().order.find((o) => o.orderId === b.orderId).totalAmount = 40;
  pay(a.orderId, 80); pay(b.orderId, 40);
  const rec = await editFlow(a.orderId, { deliveryAddress: 'סולם יעקב 30' });
  assert.equal(charge(a.orderId).amount, 80);
  assert.equal(charge(b.orderId).amount, 80);
  assert.equal(rec.notices.find((n) => n.orderId === b.orderId).debtAmount, 40);
});

test('שינוי תאריך אירוע: יוצאת מהקבוצה; הצטרפות לקבוצה של יום אחר', async () => {
  const a = addOrder(); const b = addOrder(); const c = addOrder({ eventDate: new Date('2026-12-02T00:00:00Z') });
  for (const o of [a, b, c]) await createFlow(o.orderId);
  assert.deepEqual([charge(a.orderId).amount, charge(b.orderId).amount, charge(c.orderId).amount], [80, 40, 80]);
  await editFlow(b.orderId, { eventDate: new Date('2026-12-02T00:00:00Z') });
  // B נרשמה לפני C => B הופכת לראשית ביום 2 (מלא), C מוזלת; A לבד ביום 1
  assert.deepEqual([charge(a.orderId).amount, charge(b.orderId).amount, charge(c.orderId).amount], [80, 80, 40]);
});

test('כבוי משלוח בהזמנה / הפיכה לאיסוף עצמי: יוצאת מהקבוצה; הראשית שנותרה לבד - מלא', async () => {
  const a = addOrder(); const b = addOrder();
  await createFlow(a.orderId); await createFlow(b.orderId);
  setOrder(b.orderId, { isDelivery: false });
  db().paymentObligation = db().paymentObligation.filter((o) => !(o.orderId === b.orderId && o.description.includes('משלוח')));
  const rec = await SD.reconcileSharedDelivery({ groupKeys: [await SD.getSharedGroupKeyForOrder(a.orderId)], excludeOrderIds: [b.orderId] });
  assert.equal(charge(a.orderId).amount, 80);
  assert.equal(rec.notices.length, 0);
  assert.equal(charge(b.orderId), undefined);
  assert.equal(await SD.getSharedGroupKeyForOrder(b.orderId), null);
});

test('לא בקבוצה: טיוטה, "שמור לחיוב", מחוקה, יום אחר, איסוף עצמי, כתובת בלי מספר בית, בלי עיר מחויבת', async () => {
  const a = addOrder();
  const others = [
    addOrder({ status: 'טיוטה' }),
    addOrder({ status: 'שמור לחיוב' }),
    addOrder({ isDeleted: true }),
    addOrder({ eventDate: new Date('2026-12-02T00:00:00Z') }),
    addOrder({ isDelivery: false }),
    addOrder({ deliveryAddress: 'הנטקה' }),
    addOrder({ customerId: addCustomer({ city: 'עיר לא בטבלה' }).id }),
  ];
  await saveOrder(a.orderId);
  for (const o of others) await saveOrder(o.orderId);
  assert.equal(charge(a.orderId).amount, 80);
  const info = await SD.getSharedDeliveryInfo(a.orderId);
  assert.equal(info.shared, false);
  assert.equal(info.members.length, 1);
  // הזמנה עם עיר שאינה בטבלה אבל עם deliveryCity מפורשת + אותה כתובת - כן בקבוצה (מחויבת במחיר האחיד)
  const e = addOrder({ deliveryCity: 'ירושלים' });
  await saveOrder(e.orderId);
  assert.equal(charge(e.orderId).amount, 40);
});

test('קבוצות מקבילות לאותה כתובת בימים שונים ולכתובות שונות באותו יום - לא מתערבבות', async () => {
  const d1a = addOrder(); const d1b = addOrder();
  const d2a = addOrder({ eventDate: new Date('2026-12-02T00:00:00Z') }); const d2b = addOrder({ eventDate: new Date('2026-12-02T00:00:00Z') });
  const x = addOrder({ deliveryAddress: 'אלישע הנביא 10' }); const y = addOrder({ deliveryAddress: 'אלישע הנביא 10' });
  for (const o of [d1a, d1b, d2a, d2b, x, y]) await saveOrder(o.orderId);
  assert.deepEqual([d1a, d1b, d2a, d2b, x, y].map((o) => charge(o.orderId).amount), [80, 40, 80, 40, 80, 40]);
});

test('הזמנה שנוספת אחרי שהראשית שולמה: ראשית לא משתנה, הנוספת מוזלת', async () => {
  const a = addOrder({ totalAmount: 80 });
  await saveOrder(a.orderId); db().order.find((o) => o.orderId === a.orderId).totalAmount = 80; pay(a.orderId, 80);
  const b = addOrder();
  const rec = await createFlow(b.orderId);
  assert.equal(charge(a.orderId).amount, 80);
  assert.equal(charge(b.orderId).amount, 40);
  assert.equal(rec.notices.length, 0);
  assert.equal(refunds(a.orderId).length, 0);
});

test('שינוי כתובת בכרטיס לקוחה: יוצאת מהקבוצה => חוב + התראה; חזרה => מוזלת; לקוחה עם כתובת משלוח מפורשת לא מושפעת', async () => {
  const ca = addCustomer(); const cb = addCustomer();
  const a = addOrder({ customerId: ca.id, totalAmount: 80 }); const b = addOrder({ customerId: cb.id, totalAmount: 40 });
  const bExplicit = addOrder({ customerId: addCustomer().id, deliveryAddress: 'הנטקה 52', totalAmount: 40 });
  for (const o of [a, b, bExplicit]) await createFlow(o.orderId);
  db().order.forEach((o) => { if (o.orderId === a.orderId) o.totalAmount = 80; else o.totalAmount = 40; });
  [a, b, bExplicit].forEach((o) => pay(o.orderId, o.orderId === a.orderId ? 80 : 40));
  assert.equal(charge(b.orderId).amount, 40);
  const before = { street: cb.street, houseNum: cb.houseNum, city: cb.city };
  setCustomer(cb.id, { street: 'סולם יעקב', houseNum: 30 });
  const rec = await SD.reconcileAfterCustomerAddressChange(cb.id, before);
  assert.equal(charge(b.orderId).amount, 80);
  assert.deepEqual(rec.affectedOrders, [b.orderId]);
  assert.equal(rec.notices.length, 1);
  assert.match(rec.notices[0].message, /יש לגבות 40/);
  assert.equal(charge(bExplicit.orderId).amount, 40, 'לא מושפעת');
  // חזרה לכתובת: מוזלת שוב + זיכוי על ההפרש ששולם
  const before2 = { street: 'סולם יעקב', houseNum: 30, city: 'ירושלים' };
  pay(b.orderId, 40); db().order.find((o) => o.orderId === b.orderId).totalAmount = 80;
  setCustomer(cb.id, { street: 'הנטקה', houseNum: 52 });
  const rec2 = await SD.reconcileAfterCustomerAddressChange(cb.id, before2);
  assert.equal(charge(b.orderId).amount, 40);
  assert.equal(rec2.notices[0].creditAmount, 40);
  // שינוי כתובת שלא משנה קבוצה: אין התראות ואין כתיבות
  globalThis.__MOCK_CALLS = [];
  setCustomer(cb.id, { street: 'הנטקה', houseNum: 52 });
  const rec3 = await SD.reconcileAfterCustomerAddressChange(cb.id, { street: 'הנטקה', houseNum: 52, city: 'ירושלים' });
  assert.equal(rec3.notices.length, 0);
  assert.equal(writes().length, 0);
});

test('שינוי עיר בכרטיס לקוחה (לא נכנס לקבוצה חדשה): הזמנה בודדת לא נוגעים בה (אין תמחור מחדש לפי העיר)', async () => {
  const c = addCustomer(); const a = addOrder({ customerId: c.id });
  await createFlow(a.orderId);
  const before = { street: c.street, houseNum: c.houseNum, city: c.city };
  setCustomer(c.id, { city: 'בית שמש' });
  globalThis.__MOCK_CALLS = [];
  const rec = await SD.reconcileAfterCustomerAddressChange(c.id, before);
  assert.equal(rec.notices.length, 0);
  assert.equal(charge(a.orderId).amount, 80);
  assert.equal(writes().length, 0);
});

test('כיוונים מעורבים: הזמנת הלוך מצטרפת לצד ההלוך בלבד', async () => {
  const a = addOrder({ deliveryDirection: 'הלוך-חזור' }); const b = addOrder({ deliveryDirection: 'הלוך' }); const c = addOrder({ deliveryDirection: 'חזור' });
  for (const o of [a, b, c]) await createFlow(o.orderId);
  assert.deepEqual([a, b, c].map((o) => charge(o.orderId).amount), [80, 20, 20]);
  assert.match(charge(b.orderId).description, /משלוח הלוך - ירושלים/);
  // "יוצא יום לפני" שונה => הלוך לא משותף
  const d = addOrder({ deliveryOneDayBefore: true, deliveryDirection: 'הלוך' });
  await createFlow(d.orderId);
  assert.equal(charge(d.orderId).amount, 40);
});

test('מחיר מוזל לפי עיר עם נפילה לגלובלי; ללא מחיר מוגדר - אין הנחה; 0 = חינם; לא יותר מהרגיל', async () => {
  reset({ shared_delivery_price_mode: 'by_city', shared_delivery_price_by_city: JSON.stringify({ 'בית שמש': 35 }), shared_delivery_price: '25' });
  const cs = addCustomer({ city: 'בית שמש', street: 'רב שילא', houseNum: 5 });
  const j1 = addOrder(); const j2 = addOrder(); const s1 = addOrder({ customerId: cs.id }); const s2 = addOrder({ customerId: addCustomer({ city: 'בית שמש', street: 'רב שילא', houseNum: 5 }).id });
  for (const o of [j1, j2, s1, s2]) await saveOrder(o.orderId);
  assert.deepEqual([j1, j2, s1, s2].map((o) => charge(o.orderId).amount), [80, 50, 140, 70]);
  reset({ shared_delivery_price: '', shared_delivery_price_by_city: '' });
  const a = addOrder(); const b = addOrder(); await saveOrder(a.orderId); await saveOrder(b.orderId);
  assert.equal(charge(b.orderId).amount, 80, 'לא הוגדר מחיר מוזל - אין הנחה');
  reset({ shared_delivery_price: '0' });
  const c = addOrder(); const d = addOrder(); await saveOrder(c.orderId); await saveOrder(d.orderId);
  assert.equal(charge(d.orderId).amount, 0);
  reset({ shared_delivery_price: '55' });
  const e = addOrder(); const f = addOrder(); await saveOrder(e.orderId); await saveOrder(f.orderId);
  assert.equal(charge(f.orderId).amount, 80, 'המוזל לא עולה על הרגיל');
});

test('שמירת מחיר ישן: חישוב מחדש של הזמנה אחרת לא "מתקן" מחיר שהשתנה בטבלה מאז', async () => {
  const a = addOrder({ totalAmount: 60 }); const b = addOrder();
  // A חויבה לפני שהטבלה עודכנה: 30 לצד (60 בסך הכל), הטבלה היום 40
  db().paymentObligation.push({ id: 'old-a', orderId: a.orderId, amount: 60, quantity: 2, description: 'משלוח הלוך-חזור - ירושלים', isManual: false, isDeleted: false });
  await saveOrder(b.orderId);
  const rec = await SD.reconcileSharedDelivery({ groupKeys: [await SD.getSharedGroupKeyForOrder(a.orderId)], excludeOrderIds: [b.orderId] });
  assert.equal(charge(a.orderId).amount, 60, 'A ראשית - נשארת 60');
  assert.equal(rec.notices.length, 0);
  // כש-A הופכת למוזלת: מחיר מוזל (20) פחות מ-30 => 40 בסך הכל
  await SD.setSharedDeliveryPrimary(a.orderId, b.orderId);
  assert.equal(charge(a.orderId).amount, 40);
  // וכשחוזרת להיות ראשית: המחיר המלא מהטבלה הנוכחית (40*2), כי השורה המוזלת לא שומרת מחיר ישן
  await SD.setSharedDeliveryPrimary(a.orderId, a.orderId);
  assert.equal(charge(a.orderId).amount, 80);
});

test('חיוב ידני / כמה שורות משלוח / בלי שורה: לא נוגעים', async () => {
  const a = addOrder(); const b = addOrder(); const c = addOrder();
  await saveOrder(a.orderId);
  db().paymentObligation.push({ id: 'm', orderId: b.orderId, amount: 100, quantity: 1, description: 'משלוח מיוחד', isManual: true, isDeleted: false });
  db().paymentObligation.push({ id: 'd1', orderId: c.orderId, amount: 80, quantity: 2, description: 'משלוח הלוך-חזור - ירושלים', isManual: false, isDeleted: false });
  db().paymentObligation.push({ id: 'd2', orderId: c.orderId, amount: 80, quantity: 2, description: 'משלוח הלוך-חזור - ירושלים', isManual: false, isDeleted: false });
  const rec = await SD.reconcileSharedDelivery({ groupKeys: [await SD.getSharedGroupKeyForOrder(a.orderId)], excludeOrderIds: [a.orderId] });
  const byId = Object.fromEntries(rec.results.map((r) => [r.orderId, r]));
  assert.equal(byId[b.orderId].reason, 'manual-charge');
  assert.equal(byId[c.orderId].reason, 'multiple-charges');
  assert.equal(db().paymentObligation.find((o) => o.id === 'm').amount, 100);
  const lonely = addOrder(); // בלי שורת חיוב בכלל
  const rec2 = await SD.reconcileSharedDelivery({ groupKeys: [await SD.getSharedGroupKeyForOrder(a.orderId)], excludeOrderIds: [a.orderId] });
  assert.equal(rec2.results.find((r) => r.orderId === lonely.orderId).reason, 'no-existing-charge');
  assert.equal(allObl(lonely.orderId).length, 0, 'לא יוצרים חיוב חדש בהזמנה אחרת');
});

test('Order.totalAmount: סכום שמור כולל משלוח / בלי משלוח (הבאג הקיים) / לא תואם - מתעדכן נכון ויתרת הזכות מדויקת', async () => {
  for (const [stored, label] of [[380, 'כולל'], [300, 'בלי משלוח'], [null, 'ריק']]) {
    reset();
    const a = addOrder(); const b = addOrder({ totalAmount: stored });
    await saveOrder(a.orderId);
    db().paymentObligation.push({ id: `i${label}`, orderId: b.orderId, amount: 300, quantity: 1, description: 'שמלה', isManual: false, isDeleted: false });
    db().paymentObligation.push({ id: `b${label}`, orderId: b.orderId, amount: 80, quantity: 2, description: 'משלוח הלוך-חזור - ירושלים', isManual: false, isDeleted: false });
    pay(b.orderId, 380);
    await SD.reconcileSharedDelivery({ groupKeys: [await SD.getSharedGroupKeyForOrder(a.orderId)], excludeOrderIds: [a.orderId] });
    const o = db().order.find((x) => x.orderId === b.orderId);
    if (stored === null) assert.equal(o.totalAmount, null, label);
    else assert.equal(o.totalAmount, 340, label);
    assert.equal(refunds(b.orderId).length, 1, label);
    assert.equal(refunds(b.orderId)[0].amount, 40, `זיכוי בגובה ההפרש בלבד (${label})`);
  }
});

test('הצטרפות מפורשת (enable_delivery_join) מוחרגת מהקבוצה האוטומטית', async () => {
  reset({ enable_delivery_join: 'true', delivery_join_price: '15' });
  const a = addOrder(); const b = addOrder(); const c = addOrder();
  db().deliveryJoin.push({ orderId: c.orderId, joinedToOrderId: a.orderId, isPrimary: false, direction: 'הלוך-חזור', createdAt: new Date(), updatedAt: new Date() });
  const st = await SD.getDayState(DAY, await SD.loadSharedDeliverySettings());
  assert.equal(st.byOrder.has(c.orderId), false);
  assert.equal(st.byOrder.get(b.orderId).info.isPrimary, false);
  assert.equal(st.byOrder.get(a.orderId).info.isPrimary, true);
  // ההגדרה כבויה: שורת ההצטרפות לא משפיעה והיא חלק מהקבוצה
  reset({ enable_delivery_join: 'false' });
  const x = addOrder(); const y = addOrder();
  db().deliveryJoin.push({ orderId: y.orderId, joinedToOrderId: x.orderId, isPrimary: false, direction: null, createdAt: new Date(), updatedAt: new Date() });
  const st2 = await SD.getDayState(DAY, await SD.loadSharedDeliverySettings());
  assert.equal(st2.byOrder.has(y.orderId), true);
});

test('ימים שעברו לא נוגעים (הזמנות שכבר נמסרו וחויבו)', async () => {
  const past = new Date('2026-01-10T00:00:00Z');
  const a = addOrder({ eventDate: past }); const b = addOrder({ eventDate: past });
  for (const o of [a, b]) db().paymentObligation.push({ id: `p${o.orderId}`, orderId: o.orderId, amount: 80, quantity: 2, description: 'משלוח הלוך-חזור - ירושלים', isManual: false, isDeleted: false });
  const key = await SD.getSharedGroupKeyForOrder(a.orderId);
  globalThis.__MOCK_CALLS = [];
  const rec = await SD.reconcileSharedDelivery({ groupKeys: [key] });
  assert.equal(rec.results.length, 0);
  assert.equal(writes().length, 0);
  const rec2 = await SD.reconcileSharedDelivery({ groupKeys: [key], includePast: true });
  assert.equal(charge(b.orderId).amount, 40);
  assert.equal(rec2.notices.length, 1);
});

test('אזור זמן: אירוע עם שעה אמיתית (22:30 UTC = למחרת בישראל) מקובץ ליום הישראלי', async () => {
  const a = addOrder({ eventDate: new Date('2026-12-01T22:30:00Z') }); // 2.12 00:30 בישראל
  const b = addOrder({ eventDate: new Date('2026-12-02T00:00:00Z') });
  const c = addOrder({ eventDate: new Date('2026-12-01T00:00:00Z') });
  for (const o of [a, b, c]) await saveOrder(o.orderId);
  assert.deepEqual([a, b, c].map((o) => charge(o.orderId).amount), [80, 40, 80]);
  // fromDate (אירוע חו"ל): נספר כיום האירוע כשאין eventDate
  const d = addOrder({ eventDate: null, fromDate: new Date('2026-12-02T00:00:00Z') });
  await saveOrder(d.orderId);
  assert.equal(charge(d.orderId).amount, 40);
});

test('כישלון בעדכון הזמנה אחת לא עוצר את השאר ומדווח', async () => {
  const a = addOrder(); const b = addOrder({ totalAmount: 80 }); const c = addOrder({ totalAmount: 80 });
  await saveOrder(a.orderId);
  for (const o of [b, c]) db().paymentObligation.push({ id: `p${o.orderId}`, orderId: o.orderId, amount: 80, quantity: 2, description: 'משלוח הלוך-חזור - ירושלים', isManual: false, isDeleted: false });
  globalThis.__MOCK_FAIL_ON = (model, method, args) => model === 'paymentObligation' && method === 'update' && args.where.id === `p${b.orderId}`;
  const rec = await SD.reconcileSharedDelivery({ groupKeys: [await SD.getSharedGroupKeyForOrder(a.orderId)], excludeOrderIds: [a.orderId] });
  assert.equal(rec.results.find((r) => r.orderId === b.orderId).status, 'error');
  assert.equal(charge(c.orderId).amount, 40);
  assert.equal(charge(b.orderId).amount, 80, 'ללא שינוי חלקי');
  // ניסיון חוזר אחרי שהתקלה נפתרה מתקן
  globalThis.__MOCK_FAIL_ON = null;
  await SD.reconcileSharedDelivery({ groupKeys: [await SD.getSharedGroupKeyForOrder(a.orderId)], excludeOrderIds: [a.orderId] });
  assert.equal(charge(b.orderId).amount, 40);
});

test('previewSharedDelivery: הזמנה חדשה (אחרונה), הזמנה קיימת בעריכה, כתובת מפורשת, ללא כתובת מזוהה', async () => {
  const a = addOrder({ orderDate: new Date('2026-01-01T08:00:00Z') });
  await saveOrder(a.orderId);
  const cust = addCustomer();
  const p = await SD.previewSharedDelivery({ customerId: cust.id, eventDate: EVENT, isDelivery: true, deliveryDirection: 'הלוך-חזור' });
  assert.equal(p.shared, true); assert.equal(p.isPrimary, false);
  assert.deepEqual(p.discount.discountedLegs, ['out', 'ret']); assert.equal(p.discount.discountedPerLeg, 20);
  assert.equal(p.matches[0].orderId, a.orderId);
  const q = await SD.previewSharedDelivery({ customerId: cust.id, eventDate: EVENT, isDelivery: true, deliveryAddress: 'סולם יעקב 3' });
  assert.equal(q.shared, false);
  const n = await SD.previewSharedDelivery({ customerId: cust.id, eventDate: EVENT, isDelivery: false });
  assert.equal(n.shared, false);
  // עריכת A עצמה: נשארת ראשית (זמן הרישום המקורי), לא מוזלת
  const self = await SD.previewSharedDelivery({ orderId: a.orderId, customer: db().customer.find((c) => c.id === a.customerId), eventDate: EVENT, isDelivery: true });
  assert.equal(self.isPrimary, true); assert.equal(self.discount, null);
  // טבלת DeliveryJoin חסרה לא מפילה תצוגה מקדימה
  delete db().deliveryJoin; Cache.invalidateAllSettingsCache();
  const m = await SD.previewSharedDelivery({ customerId: cust.id, eventDate: EVENT, isDelivery: true });
  assert.equal(m.shared, true);
});

test('כמות גדולה: 8 הזמנות, ראשית אחת מלאה, שבע מוזלות; החלפת ראשית ל-5 ואז ביטול הראשית החדשה', async () => {
  const os = [];
  for (let i = 0; i < 8; i += 1) os.push(addOrder());
  for (const o of os) await saveOrder(o.orderId);
  assert.deepEqual(os.map((o) => charge(o.orderId).amount), [80, 40, 40, 40, 40, 40, 40, 40]);
  await SD.setSharedDeliveryPrimary(os[0].orderId, os[4].orderId);
  assert.deepEqual(os.map((o) => charge(o.orderId).amount), [40, 40, 40, 40, 80, 40, 40, 40]);
  await cancelFlow(os[4].orderId);
  assert.deepEqual(os.map((o, i) => (i === 4 ? 'x' : charge(o.orderId).amount)), [80, 40, 40, 40, 'x', 40, 40, 40]);
});

test('סיכום כספי אחרי סדרת פעולות: סך חיובי המשלוח בקבוצה = משלם מלא יחיד + מוזלים, בלי חיובים כפולים', async () => {
  const os = [addOrder(), addOrder(), addOrder()];
  for (const o of os) await createFlow(o.orderId);
  await SD.setSharedDeliveryPrimary(os[0].orderId, os[2].orderId);
  await editFlow(os[1].orderId, { deliveryAddress: 'סולם יעקב 30' });
  await SD.setSharedDeliveryPrimary(os[0].orderId, os[0].orderId);
  for (const o of os) assert.equal(allObl(o.orderId).filter((x) => x.description.includes('משלוח')).length, 1);
  const total = os.reduce((s, o) => s + charge(o.orderId).amount, 0);
  // 0 ו-2 באותה כתובת (0 ראשית 80, 2 מוזלת 40), 1 בכתובת אחרת (80)
  assert.equal(total, 200);
});

test('שינוי עיר המשלוח (תעריף עירוני שונה) בהזמנה מוזלת: יוצאת מהקבוצה ומחויבת לפי תעריף העיר החדשה במחיר מלא', async () => {
  const a = addOrder(); const b = addOrder();
  await createFlow(a.orderId); await createFlow(b.orderId);
  assert.equal(charge(b.orderId).amount, 40);
  await editFlow(b.orderId, { deliveryCity: 'בית שמש', deliveryAddress: 'הנטקה 52' });
  assert.equal(charge(b.orderId).amount, 140, 'בית שמש 70 לצד x2, מלא (אין כבר חבר בקבוצה)');
  assert.equal(charge(a.orderId).amount, 80);
  // שתי הזמנות באותה כתובת בבית שמש: מוזלת במחיר הגלובלי (20) ולא יותר מהרגיל
  const c = addOrder({ deliveryCity: 'בית שמש', deliveryAddress: 'הנטקה 52' });
  await createFlow(c.orderId);
  assert.equal(charge(c.orderId).amount, 40);
});

test('מחיקה והחזרה של שורת ההזמנה (שמירה אחרי שהחיוב אבד) לא יוצרת חיוב כפול ולא זיכוי כפול', async () => {
  const a = addOrder({ totalAmount: 80 }); const b = addOrder({ totalAmount: 40 });
  await createFlow(a.orderId); await createFlow(b.orderId);
  db().order.find((o) => o.orderId === b.orderId).totalAmount = 40; pay(b.orderId, 40);
  for (let i = 0; i < 3; i += 1) await editFlow(b.orderId, {});
  assert.equal(allObl(b.orderId).filter((o) => o.description.includes('משלוח')).length, 1);
  assert.equal(charge(b.orderId).amount, 40);
  assert.equal(refunds(b.orderId).length, 0);
});

test('סעיף 16 - סטטוס תשלום שמור: ששולמה והחיוב עלה => "שולם חלקי"; החוב נסגר => חוזר "שולם"; אידמפוטנטי; סטטוס אחר לא נוגעים', async () => {
  const a = addOrder({ status: 'שולם' }); const b = addOrder({ status: 'שולם' }); const c = addOrder({ status: 'חדש' });
  for (const o of [a, b, c]) await saveOrder(o.orderId);
  // הכל ששולם לפי המחירים הנוכחיים: A 80+שמלה, B 40+שמלה
  for (const o of [a, b, c]) db().paymentObligation.push({ id: `d${o.orderId}`, orderId: o.orderId, amount: 300, quantity: 1, description: 'שמלה', isManual: false, isDeleted: false });
  pay(a.orderId, 380); pay(b.orderId, 340); pay(c.orderId, 340);
  const st = (o) => db().order.find((x) => x.orderId === o.orderId).status;
  // החלפת ראשי ל-B: B עולה ל-80 (חוב 40) => "שולם חלקי"; A יורדת ל-40 (זיכוי 40) => נשארת "שולם"; C ("חדש") לא נוגעים
  const r = await SD.setSharedDeliveryPrimary(a.orderId, b.orderId);
  assert.equal(st(b), 'שולם חלקי');
  assert.equal(st(a), 'שולם');
  assert.equal(st(c), 'חדש');
  const nb = r.notices.find((n) => n.orderId === b.orderId);
  assert.equal(nb.statusTo, 'שולם חלקי'); assert.match(nb.message, /סטטוס התשלום עודכן ל"שולם חלקי"/);
  // חזרה: החוב של B נסגר => "שולם"
  await SD.setSharedDeliveryPrimary(a.orderId, a.orderId);
  assert.equal(st(b), 'שולם');
  // חישוב חוזר: אפס כתיבות
  globalThis.__MOCK_CALLS = [];
  await SD.reconcileSharedDelivery({ groupKeys: [await SD.getSharedGroupKeyForOrder(a.orderId)] });
  assert.equal(writes().length, 0);
  // סנכרון ההזמנה הנשמרת עצמה (PUT): שולם במלואו ואז המשלוח עולה
  db().paymentObligation.find((o) => o.orderId === b.orderId && o.description.includes('משלוח')).amount = 80;
  assert.deepEqual(await SD.syncStoredPaymentStatus(b.orderId), { changed: true, from: 'שולם', to: 'שולם חלקי' });
  assert.equal((await SD.syncStoredPaymentStatus(b.orderId)).changed, false);
  assert.equal((await SD.syncStoredPaymentStatus(c.orderId)).changed, false, '"חדש" לא נוגעים');
  // סטטוסים אחרים (טיוטה / שמור לחיוב / ריק) לא משתנים לעולם
  for (const s of ['טיוטה', 'שמור לחיוב', null, 'בוטל']) assert.equal(SD.storedStatusFor(s, 500, 0), s);
  assert.equal(SD.storedStatusFor('שולם', 500, 0), 'חדש');
  assert.equal(SD.storedStatusFor('שולם חלקי', 340, 340), 'שולם');
  assert.equal(SD.storedStatusFor('שולם', 340, 380), 'שולם', 'ממתין לזיכוי נשאר "שולם"');
  assert.equal(SD.storedStatusFor('שולם', 0, 0), 'חדש');
});
