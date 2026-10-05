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

// הנפילה-לאחור לעיר הלקוח מאחורי מתג org (delivery_charge_customer_city_fallback, ברירת מחדל כבוי):
// הבדיקות שמצפות לנפילה-לאחור מדליקות אותו במפורש; בדיקות "כבוי" בסוף הקובץ.
const R = (o) => resolveEffectiveDeliveryCity({ allowCustomerCityFallback: true, ...o });
const P = (o) => computeDeliveryObligationPreview({ allowCustomerCityFallback: true, ...o });
const TABLE = JSON.stringify({ 'ירושלים': 30, 'בית שמש': 40 });
const base = { isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryPriceByCity: TABLE, deliveryPrice: '25', existingObligations: [] };

console.log('resolveEffectiveDeliveryCity');
t('explicit city wins, returned untouched (even if not in table, even if customer city differs)', () => {
  const r = R({ deliveryCity: 'חיפה', customerCity: 'ירושלים', deliveryPriceByCity: TABLE });
  assert.deepEqual([r.city, r.source], ['חיפה', 'order']);
});
t('empty city + customer city in table -> customer city', () => {
  for (const empty of ['', null, undefined, '   ']) {
    const r = R({ deliveryCity: empty, customerCity: 'ירושלים', deliveryPriceByCity: TABLE });
    assert.deepEqual([r.city, r.source], ['ירושלים', 'customer']);
  }
});
t('customer city is trimmed before matching; table key returned', () => {
  const r = R({ deliveryCity: '', customerCity: '  בית שמש ', deliveryPriceByCity: TABLE });
  assert.equal(r.city, 'בית שמש');
});
t('customer city not in table -> no city + reason', () => {
  const r = R({ deliveryCity: '', customerCity: 'חיפה', deliveryPriceByCity: TABLE });
  assert.deepEqual([r.city, r.reason], [null, 'customer-city-not-in-delivery-table']);
});
t('customer city empty -> no city + reason', () => {
  const r = R({ deliveryCity: '', customerCity: '', deliveryPriceByCity: TABLE });
  assert.deepEqual([r.city, r.reason], [null, 'no-delivery-city-and-no-customer-city']);
});
t('empty / malformed / non-object table -> no fallback, never throws', () => {
  for (const tbl of [undefined, '', '{', 'null', '[]', '5']) {
    const r = R({ deliveryCity: '', customerCity: 'ירושלים', deliveryPriceByCity: tbl });
    assert.equal(r.city, null, String(tbl));
  }
});
t('prototype keys are not matched', () => {
  const r = R({ deliveryCity: '', customerCity: 'constructor', deliveryPriceByCity: TABLE });
  assert.equal(r.city, null);
});

console.log('computeDeliveryObligationPreview');
t('isDelivery=false never charges (even with customer city in table)', () => {
  assert.equal(P({ ...base, isDelivery: false, deliveryCity: '', customerCity: 'ירושלים' }), null);
  assert.equal(P({ ...base, isDelivery: false, deliveryCity: 'ירושלים', customerCity: 'ירושלים' }), null);
});
t('the bug: delivery, no city, customer city in table -> charged (30 x2)', () => {
  const p = P({ ...base, deliveryCity: '', customerCity: 'ירושלים' });
  assert.equal(p.amount, 60);
  assert.equal(p.quantity, 2);
  assert.equal(p.description, 'משלוח הלוך-חזור - ירושלים');
  assert.equal(p.citySource, 'customer');
});
t('one-way direction charges once', () => {
  const p = P({ ...base, deliveryDirection: 'הלוך', deliveryCity: '', customerCity: 'בית שמש' });
  assert.equal(p.amount, 40);
});
t('delivery, no city, customer city missing or not in table -> no charge (as before)', () => {
  assert.equal(P({ ...base, deliveryCity: '', customerCity: '' }), null);
  assert.equal(P({ ...base, deliveryCity: '', customerCity: 'חיפה' }), null);
  assert.equal(P({ ...base, deliveryCity: '' }), null);
});
t('explicit city unchanged: same amount/description as before, customer city ignored', () => {
  const p = P({ ...base, deliveryCity: 'בית שמש', customerCity: 'ירושלים' });
  assert.equal(p.amount, 80);
  assert.equal(p.description, 'משלוח הלוך-חזור - בית שמש');
  assert.equal(p.citySource, 'order');
});
t('explicit city not in table still falls to flat price (unchanged)', () => {
  const p = P({ ...base, deliveryCity: 'חיפה', customerCity: '' });
  assert.equal(p.amount, 50); // flat 25 x2
});
t('idempotent: existing non-deleted delivery obligation -> no second charge, on both paths', () => {
  const existing = [{ description: 'משלוח הלוך-חזור - ירושלים', isDeleted: false }];
  assert.equal(P({ ...base, deliveryCity: '', customerCity: 'ירושלים', existingObligations: existing }), null);
  assert.equal(P({ ...base, deliveryCity: 'ירושלים', existingObligations: existing }), null);
});
t('deleted delivery obligation does not block a new charge', () => {
  const p = P({ ...base, deliveryCity: '', customerCity: 'ירושלים', existingObligations: [{ description: 'משלוח', isDeleted: true }] });
  assert.equal(p.amount, 60);
});


console.log('fallback switch OFF (default) = behavior before 5.10.2026');
t('default (no flag): empty city + customer city in table -> NO city, no charge', () => {
  const r = resolveEffectiveDeliveryCity({ deliveryCity: '', customerCity: 'ירושלים', deliveryPriceByCity: TABLE });
  assert.deepEqual([r.city, r.source, r.reason], [null, null, 'no-delivery-city']);
  assert.equal(computeDeliveryObligationPreview({ ...base, deliveryCity: '', customerCity: 'ירושלים' }), null);
  assert.equal(computeDeliveryObligationPreview({ ...base, deliveryCity: '', customerCity: 'ירושלים', allowCustomerCityFallback: false }), null);
});
t('flag OFF: an explicit city is still charged exactly as before', () => {
  const p = computeDeliveryObligationPreview({ ...base, deliveryCity: 'בית שמש', customerCity: 'ירושלים', allowCustomerCityFallback: false });
  assert.equal(p.amount, 80);
  assert.equal(p.citySource, 'order');
});
t('flag ON: same input falls back to the customer city', () => {
  const p = computeDeliveryObligationPreview({ ...base, deliveryCity: '', customerCity: 'ירושלים', allowCustomerCityFallback: true });
  assert.equal(p.amount, 60);
  assert.equal(p.citySource, 'customer');
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
