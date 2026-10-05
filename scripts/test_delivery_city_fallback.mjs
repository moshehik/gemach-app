// בדיקות טהורות לנפילה-לאחור של עיר משלוח לעיר הלקוח (lib/pricingCalc.js) - org2 06467870, 3a4d36df.
// הרצה (מהשורש): node --import ./scripts/business-days-tests/register.mjs scripts/test_delivery_city_fallback.mjs
// (ה-hook מאפשר ייבוא בלי סיומת קובץ; בלי DB ובלי שרת; יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { resolveEffectiveDeliveryCity, computeDeliveryObligationPreview } from '../lib/pricingCalc.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const TABLE = JSON.stringify({ 'ירושלים': 30, 'בית שמש': 40 });
const base = { isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryPriceByCity: TABLE, deliveryPrice: '25', existingObligations: [] };

console.log('resolveEffectiveDeliveryCity');
t('explicit city wins, returned untouched (even if not in table, even if customer city differs)', () => {
  const r = resolveEffectiveDeliveryCity({ deliveryCity: 'חיפה', customerCity: 'ירושלים', deliveryPriceByCity: TABLE });
  assert.deepEqual([r.city, r.source], ['חיפה', 'order']);
});
t('empty city + customer city in table -> customer city', () => {
  for (const empty of ['', null, undefined, '   ']) {
    const r = resolveEffectiveDeliveryCity({ deliveryCity: empty, customerCity: 'ירושלים', deliveryPriceByCity: TABLE });
    assert.deepEqual([r.city, r.source], ['ירושלים', 'customer']);
  }
});
t('customer city is trimmed before matching; table key returned', () => {
  const r = resolveEffectiveDeliveryCity({ deliveryCity: '', customerCity: '  בית שמש ', deliveryPriceByCity: TABLE });
  assert.equal(r.city, 'בית שמש');
});
t('customer city not in table -> no city + reason', () => {
  const r = resolveEffectiveDeliveryCity({ deliveryCity: '', customerCity: 'חיפה', deliveryPriceByCity: TABLE });
  assert.deepEqual([r.city, r.reason], [null, 'customer-city-not-in-delivery-table']);
});
t('customer city empty -> no city + reason', () => {
  const r = resolveEffectiveDeliveryCity({ deliveryCity: '', customerCity: '', deliveryPriceByCity: TABLE });
  assert.deepEqual([r.city, r.reason], [null, 'no-delivery-city-and-no-customer-city']);
});
t('empty / malformed / non-object table -> no fallback, never throws', () => {
  for (const tbl of [undefined, '', '{', 'null', '[]', '5']) {
    const r = resolveEffectiveDeliveryCity({ deliveryCity: '', customerCity: 'ירושלים', deliveryPriceByCity: tbl });
    assert.equal(r.city, null, String(tbl));
  }
});
t('prototype keys are not matched', () => {
  const r = resolveEffectiveDeliveryCity({ deliveryCity: '', customerCity: 'constructor', deliveryPriceByCity: TABLE });
  assert.equal(r.city, null);
});

console.log('computeDeliveryObligationPreview');
t('isDelivery=false never charges (even with customer city in table)', () => {
  assert.equal(computeDeliveryObligationPreview({ ...base, isDelivery: false, deliveryCity: '', customerCity: 'ירושלים' }), null);
  assert.equal(computeDeliveryObligationPreview({ ...base, isDelivery: false, deliveryCity: 'ירושלים', customerCity: 'ירושלים' }), null);
});
t('the bug: delivery, no city, customer city in table -> charged (30 x2)', () => {
  const p = computeDeliveryObligationPreview({ ...base, deliveryCity: '', customerCity: 'ירושלים' });
  assert.equal(p.amount, 60);
  assert.equal(p.quantity, 2);
  assert.equal(p.description, 'משלוח הלוך-חזור - ירושלים');
  assert.equal(p.citySource, 'customer');
});
t('one-way direction charges once', () => {
  const p = computeDeliveryObligationPreview({ ...base, deliveryDirection: 'הלוך', deliveryCity: '', customerCity: 'בית שמש' });
  assert.equal(p.amount, 40);
});
t('delivery, no city, customer city missing or not in table -> no charge (as before)', () => {
  assert.equal(computeDeliveryObligationPreview({ ...base, deliveryCity: '', customerCity: '' }), null);
  assert.equal(computeDeliveryObligationPreview({ ...base, deliveryCity: '', customerCity: 'חיפה' }), null);
  assert.equal(computeDeliveryObligationPreview({ ...base, deliveryCity: '' }), null);
});
t('explicit city unchanged: same amount/description as before, customer city ignored', () => {
  const p = computeDeliveryObligationPreview({ ...base, deliveryCity: 'בית שמש', customerCity: 'ירושלים' });
  assert.equal(p.amount, 80);
  assert.equal(p.description, 'משלוח הלוך-חזור - בית שמש');
  assert.equal(p.citySource, 'order');
});
t('explicit city not in table still falls to flat price (unchanged)', () => {
  const p = computeDeliveryObligationPreview({ ...base, deliveryCity: 'חיפה', customerCity: '' });
  assert.equal(p.amount, 50); // flat 25 x2
});
t('idempotent: existing non-deleted delivery obligation -> no second charge, on both paths', () => {
  const existing = [{ description: 'משלוח הלוך-חזור - ירושלים', isDeleted: false }];
  assert.equal(computeDeliveryObligationPreview({ ...base, deliveryCity: '', customerCity: 'ירושלים', existingObligations: existing }), null);
  assert.equal(computeDeliveryObligationPreview({ ...base, deliveryCity: 'ירושלים', existingObligations: existing }), null);
});
t('deleted delivery obligation does not block a new charge', () => {
  const p = computeDeliveryObligationPreview({ ...base, deliveryCity: '', customerCity: 'ירושלים', existingObligations: [{ description: 'משלוח', isDeleted: true }] });
  assert.equal(p.amount, 60);
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
