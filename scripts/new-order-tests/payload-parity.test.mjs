// השוואת גופי הבקשות והכללים של האשף החדש (app/components/new-order/newOrderLogic.js) מול הישן (האורקל ב-legacy.mjs, שמחולץ
// מ-LegacyNewOrderPage.js בזמן הבדיקה). לכל מקרה - אותו קלט לשני הצדדים ו-deepStrictEqual על התוצאה. בלי DB, בלי רשת.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from './legacy.mjs';
import * as N from '../../app/components/new-order/newOrderLogic.js';

const CUST = { id: 'c-1', firstName: 'מרים', lastName: 'אברמוביץ', phone1: '052-3341290', phone2: '', email: 'm@x.com', city: 'ירושלים', street: 'עמוס', houseNum: '12', idNumber: '', zeout: '' };
const ITEM = (o = {}) => ({ dressModelId: 'm-1', dressName: 'שמלת תחרה', sizeText: '38', sampleItemId: 's-1', quantity: 1, basePrice: 120, finalPrice: 120, repairs: '', neckAlteration: false, sleeveAlteration: false, lengthAlteration: '', ...o });
const ORDERS = [
  { ...N.EMPTY_ORDER, customerId: 'c-1', selectedCustomer: CUST, eventDate: '2026-11-12', items: [ITEM()] },
  { ...N.EMPTY_ORDER, customerId: 'c-1', selectedCustomer: CUST, isAbroad: true, fromDate: '2026-11-01', toDate: '2026-11-20', eventDate: '2026-11-01', customSpacing: 1, notes: 'הערה', items: [ITEM(), ITEM({ sizeText: '40', neckAlteration: true, repairs: 'צוואר' })] },
  { ...N.EMPTY_ORDER, customerId: 'c-1', selectedCustomer: CUST, eventDate: '2026-12-01', isDelivery: true, deliveryCity: 'בית שמש', deliveryDirection: 'הלוך', deliveryAddress: 'הרב קוק 4', deliveryOneDayBefore: true, isPhoneOrder: true, items: [ITEM({ lengthAlteration: '5' })] },
  { ...N.EMPTY_ORDER, customerId: 'c-1', selectedCustomer: CUST, eventDate: '2026-12-01', branch: 'נווה יעקב', pickupBranch: 'בית שמש', hokBankName: 'לאומי', hokBankAccount: '123', hokConsent: true, customSpacing: 0, items: [] },
  { ...N.EMPTY_ORDER },
];
const SETTINGS = [
  {},
  { hok_enabled: 'true' },
  { hok_enabled: 'false', require_customer_email: 'true', require_full_address: 'true', mandatory_fields: 'email,עיר', require_marketing_consent: 'true' },
  { hide_marketing_consent_field: 'true', require_marketing_consent: 'true', mandatory_fields: 'housenum, רחוב ' },
];

test('POST /api/orders - גוף השמירה זהה (itemsToSave + hokDetails + payload) בכל הצירופים', () => {
  const newCustomers = [{ ...N.EMPTY_NEW_CUSTOMER }, { ...N.EMPTY_NEW_CUSTOMER, hokBankName: 'פועלים', hokBankBranch: '12', hokConsent: true }];
  const calcs = [{ items: [] }, { items: [{ calculatedPrice: 150, repairsCost: 30 }] }, { items: [{ calculatedPrice: 99 }, { calculatedPrice: 240, repairsCost: 40 }] }];
  let n = 0;
  for (const order of ORDERS) for (const settings of SETTINGS) for (const newCustomer of newCustomers) for (const calculatedData of calcs) {
    for (const [reservedOrderId, draftOrderId, force] of [[null, null, false], [53412, 53412, true], [null, 9001, false]]) {
      const finalPaymentsList = [{ amount: 100, method: 'מזומן', notes: '' }];
      const totalAmount = 340;
      const legacy = L.legacySavePayload({ order, calculatedData, settings, newCustomer, totalAmount, finalPaymentsList, reservedOrderId, draftOrderId, force });
      const itemsToSave = N.buildItemsToSave(order, calculatedData.items);
      const hokDetailsPayload = N.buildHokDetailsPayload(settings, order, newCustomer);
      const mine = N.buildSavePayload({ order, totalAmount, itemsToSave, hokDetailsPayload, finalPaymentsList, reservedOrderId, draftOrderId, force });
      assert.deepStrictEqual(mine, legacy);
      assert.deepStrictEqual(Object.keys(mine), Object.keys(legacy), 'סדר השדות');
      n++;
    }
  }
  assert.ok(n > 300);
});

test('POST /api/orders/draft, /calculate, /validate-inventory - גופים זהים', () => {
  for (const order of ORDERS) {
    const active = (order.items || []).filter(i => !i.isDeleted);
    for (const id of [null, 777]) {
      assert.deepStrictEqual(N.buildDraftBody(order, id, 340, active), L.legacyDraftBody(order, id, 340, active));
      assert.deepStrictEqual(N.buildValidateBody(active, order, id), L.legacyValidateBody(active, order, id));
    }
    assert.deepStrictEqual(N.buildCalculateBody(order), L.legacyCalculateBody(order));
  }
});

test('GET /api/inventory/preload - פרמטרים זהים (אפקט חי + רענון עם _t)', () => {
  for (const order of ORDERS) for (const id of [null, 555]) {
    assert.equal(N.buildPreloadParams(order, id), L.legacyPreloadParams(order, id));
    assert.equal(N.buildPreloadParams(order, id, 1700000000000), L.legacyRefreshParams(order, id, 1700000000000));
  }
});

test('שינוי תאריך: אותה הזמנה מוצעת ואותה שגיאת טווח הפוך', () => {
  const cases = [
    [ORDERS[0], 'eventDate', '2026-11-20'], [ORDERS[1], { fromDate: '2026-11-05', toDate: '2026-11-25' }], [ORDERS[1], { fromDate: '2026-11-25', toDate: '2026-11-05' }],
    [ORDERS[1], 'toDate', '2026-10-01'], [ORDERS[0], 'isAbroad', true], [ORDERS[1], 'isAbroad', false], [ORDERS[0], 'customSpacing', 2], [ORDERS[1], 'customSpacing', null],
  ];
  for (const [o, f, v] of cases) assert.deepStrictEqual(N.proposeDateChange(o, f, v), L.legacyProposeDateChange(o, f, v));
});

test('הוספה לסל: פיצול מידות זמינות/אזלו, פריטים שנוצרים, כתובת המחיר', () => {
  const avail = [{ sizeText: '36', availableQuantity: 2, sampleItemId: 'a' }, { sizeText: '38', availableQuantity: 0, sampleItemId: 'b' }, { sizeText: '40', availableQuantity: 1, sampleItemId: 'c' }];
  for (const sizes of [['36'], ['36', '38', '40'], ['38'], ['42', '40']]) {
    const newItem = { dressModelId: 'm-9', dressName: 'שמלה', selectedSizes: sizes, quantity: 1, repairs: 'קיצור', neckAlteration: true, sleeveAlteration: false, lengthAlteration: '3' };
    const a = N.splitSizesByAvailability(sizes, avail);
    assert.deepStrictEqual(a, L.legacySplitSizes(newItem, avail));
    const prices = a.validSizes.map((_, i) => (i ? {} : { basePrice: 130 }));
    // buildItemsToAdd עצמה זהה לישן. סטייה מכוונת (Q8, 2026-10): הקורא בחדש (useNewOrderController.addItemToOrder) מעביר לה את
    // prep.itemToAdd - עם הפירוט האוטומטי describeAlterations - ולא את newItem הגולמי כמו בישן (שם repairs נשלח ריק כשהפירוט אוטומטי;
    // commit 97ea96be הוסיף את ההערה האוטומטית בכוונה). כשהפירוט ידני/אין תיקון - זהה לישן. ההוכחה: review-fixes.test.mjs (Q8).
    assert.deepStrictEqual(N.buildItemsToAdd(newItem, a.validSizes, prices), L.legacyItemsToAdd(newItem, a.validSizes, prices));
  }
  // eslint-disable-next-line no-new-func
  const legacyUrl = new Function('newItem', 'sizeText', 'order', 'return ' + L.LEGACY_PRICING_URL_SRC.replace(/^fetch\(/, '') + ';');
  for (const ev of ['2026-11-12', '']) assert.equal(N.buildPricingUrl('m-9', '38', ev), legacyUrl({ dressModelId: 'm-9' }, '38', { eventDate: ev }));
});

test('תשלום: הרשימה הסופית בשמירה ותנאי בקשת האישור (PAYMENT_APPROVAL_LEVEL) זהים', () => {
  const methods = ['אשראי (דרך נדרים פלוס)', 'אשראי חיצונית', 'מזומן', 'העברה בנקאית', 'יציאה באישור מנהל'];
  const levels = [undefined, 'כולם', 'מנהל', 'עובד', 'מנהל סניף ומעלה', 'אחר'];
  for (const method of methods) for (const amount of ['', '0', '150', 'abc']) {
    const payment = { amount, method, notes: 'הערה' };
    const list = [{ amount: 50, method: 'מזומן', notes: '' }];
    assert.deepStrictEqual(N.buildFinalPayments(list, payment), L.legacyFinalPayments(list, payment));
    for (const lvl of levels) {
      const s = lvl === undefined ? {} : { PAYMENT_APPROVAL_LEVEL: lvl };
      const p = parseFloat(amount) || 0;
      assert.equal(N.paymentApprovalRequired(s, method, p), L.legacyPaymentApprovalRequired(s, method, p), `${method}/${amount}/${lvl}`);
    }
  }
});

test('POST /api/nedarim - גוף החיוב זהה (כולל מס׳ ההזמנה המשוריין בהערה)', () => {
  const custs = [CUST, { ...CUST, street: '', houseNum: '', zeout: '123', idNumber: '' }, { firstName: '', lastName: '', phone1: '' }];
  for (const c of custs) for (const no of [null, 53412]) for (const notes of ['', 'אישור']) {
    const cc = { cardNumber: '4580 1234 5678 9012', tokef: '12/27', installments: '3', notes, amount: '200' };
    assert.deepStrictEqual(N.buildNedarimBody(c, cc, 200, no), L.legacyNedarimBody(c, cc, 200, no, N.getCustomerFullName));
  }
  assert.match(L.LEGACY_RESERVE_BODY_SRC.replace(/\s+/g, ' '), /customerId: order\.customerId \|\| null/);
});

test('אמצעי תשלום, שדות חובה, תיאור תיקונים, נעילת שלבים - זהים לישן', () => {
  const sets = [{}, { nedarim_plus_enabled: 'false' }, { ALLOWED_PAYMENT_METHODS: 'אשראי (דרך נדרים פלוס), מזומן ,צ׳ק' }, { ALLOWED_PAYMENT_METHODS: 'אשראי', nedarim_plus_enabled: 'false' }];
  for (const s of sets) assert.deepStrictEqual(N.computePaymentMethodOptions(s), L.legacyComputePaymentMethodOptions(s));
  const custs = [CUST, { firstName: 'א' }, { ...CUST, email: '', city: '', marketingConsent: false }, {}];
  for (const s of SETTINGS) for (const c of custs) assert.deepStrictEqual(N.getMissingMandatoryCustomerFields(s, c), L.legacyMissingFields(s, c));
  for (const it of [ITEM(), ITEM({ neckAlteration: true, lengthAlteration: '4' }), ITEM({ sleeveAlteration: true })]) assert.equal(N.describeAlterations(it), L.legacyDescribeAlterations(it));
  // הישן: 1 לקוח, 2 תאריכים, 3 פריטים, 4 סיכום, 5 תשלום. החדש: + "משלוח" עם אותו שער כמו "פריטים"
  const map = { 2: 'dates', 3: 'items', 4: 'summary', 5: 'payment' };
  for (const o of [...ORDERS, { ...ORDERS[0], isWeekdayEvent: true }, { ...ORDERS[0], isWeekdayEvent: true, fromDate: '2026-11-01', toDate: '2026-11-02' }]) {
    const info = N.stepOpenInfo(o);
    for (const [t, k] of Object.entries(map)) assert.equal(info[k].open, !!L.legacyCanNavigate(o, +t), `${k}`);
    assert.equal(info.delivery.open, info.items.open);
  }
});

test('כרטיס אשראי: קורא מגנטי והקלדה - אותם ערכים כמו handlers הישנים', () => {
  assert.deepStrictEqual(N.parseSwipe(';4580123456789012=27121010000?'), { cardNumber: '4580 1234 5678 9012', tokef: '12/27' });
  assert.deepStrictEqual(N.parseSwipe('%B4580123456789012^COHEN/M^2712101?'), { cardNumber: '4580 1234 5678 9012', tokef: '12/27' });
  assert.equal(N.parseSwipe('4580'), null);
  assert.deepStrictEqual(N.cardNumberInput('45801234567', ''), { cardNumber: '4580 1234 567', tokef: '' });
  assert.equal(N.tokefInput('1227'), '12/27');
  assert.equal(N.tokefInput('1'), '1');
});
