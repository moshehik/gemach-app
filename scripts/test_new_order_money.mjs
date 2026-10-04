// בדיקות רגרסיה טהורות ללוגיקת הכסף/הפריט של טופס ההזמנה החדשה (lib/newOrderPayments.js).
// הרצה: node scripts/test_new_order_money.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import {
  MANAGER_EXIT_METHOD, isManagerExitMethod, isCreditMethod, pickCreditMethod, validateSplitPayment,
  paymentApprovalLevelRequiresPrompt, splitPaymentNeedsApproval, describeItemAlterations, withDefaultAlterationDetails,
} from '../lib/newOrderPayments.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

console.log('payment method classification');
t('manager-exit exact match', () => {
  assert.equal(MANAGER_EXIT_METHOD, 'יציאה באישור מנהל');
  assert.equal(isManagerExitMethod('יציאה באישור מנהל'), true);
  assert.equal(isManagerExitMethod(' יציאה באישור מנהל '), true);
  assert.equal(isManagerExitMethod('מזומן'), false);
  assert.equal(isManagerExitMethod(undefined), false);
});
t('credit: internal yes, external no', () => {
  assert.equal(isCreditMethod('אשראי (דרך נדרים פלוס)'), true);
  assert.equal(isCreditMethod('אשראי'), true);
  assert.equal(isCreditMethod('אשראי חיצונית'), false);
  assert.equal(isCreditMethod('מזומן'), false);
  assert.equal(isCreditMethod(null), false);
});

console.log('bug 1: split payment');
t('manager-exit rejected as a paid amount (the 500 NIS hole)', () => {
  const r = validateSplitPayment('500', 'יציאה באישור מנהל');
  assert.equal(r.ok, false);
  assert.match(r.error, /אינה אמצעי תשלום/);
});
t('zero / empty / garbage amounts rejected', () => {
  for (const a of ['0', '', undefined, 'abc', '-5']) assert.equal(validateSplitPayment(a, 'מזומן').ok, false);
});
t('cash and credit accepted with parsed amount', () => {
  assert.deepEqual(validateSplitPayment('120.5', 'מזומן'), { ok: true, amount: 120.5 });
  assert.equal(validateSplitPayment(300, 'אשראי (דרך נדרים פלוס)').ok, true);
});
t('approval level levels', () => {
  assert.equal(paymentApprovalLevelRequiresPrompt({}), false);
  assert.equal(paymentApprovalLevelRequiresPrompt({ PAYMENT_APPROVAL_LEVEL: 'כולם' }), false);
  for (const l of ['מנהל', 'עובד', 'מנהל סניף ומעלה']) assert.equal(paymentApprovalLevelRequiresPrompt({ PAYMENT_APPROVAL_LEVEL: l }), true);
});
t('split cash payment is gated by PAYMENT_APPROVAL_LEVEL like the finish path', () => {
  assert.equal(splitPaymentNeedsApproval({ PAYMENT_APPROVAL_LEVEL: 'מנהל' }, 'מזומן', 200), true);
  assert.equal(splitPaymentNeedsApproval({ PAYMENT_APPROVAL_LEVEL: 'כולם' }, 'מזומן', 200), false);
  assert.equal(splitPaymentNeedsApproval({}, 'מזומן', 200), false);
});
t('credit goes through the card window, not the approval prompt', () => {
  assert.equal(splitPaymentNeedsApproval({ PAYMENT_APPROVAL_LEVEL: 'מנהל' }, 'אשראי (דרך נדרים פלוס)', 200), false);
});

console.log('bug 2: card charge method');
t('always the first credit option, whatever was selected', () => {
  assert.equal(pickCreditMethod(['מזומן', 'אשראי (דרך נדרים פלוס)', 'יציאה באישור מנהל']), 'אשראי (דרך נדרים פלוס)');
  assert.equal(pickCreditMethod(['מזומן', 'אשראי חיצונית', 'אשראי']), 'אשראי');
});
t('fallback when options hold no credit method', () => {
  assert.equal(pickCreditMethod(['מזומן']), 'אשראי (דרך נדרים פלוס)');
  assert.equal(pickCreditMethod(undefined), 'אשראי (דרך נדרים פלוס)');
});

console.log('bug 3: alteration details');
const base = { dressModelId: 1, repairs: '', neckAlteration: false, sleeveAlteration: false, lengthAlteration: '' };
t('alteration without free text gets auto details (no hard block)', () => {
  const r = withDefaultAlterationDetails({ ...base, neckAlteration: true, lengthAlteration: '3' }, true);
  assert.equal(r.repairs, 'צוואר, אורך (3)');
});
t('whitespace-only text counts as empty', () => {
  assert.equal(withDefaultAlterationDetails({ ...base, sleeveAlteration: true, repairs: '   ' }, true).repairs, 'שרוול');
});
t('clerk-typed text is kept', () => {
  assert.equal(withDefaultAlterationDetails({ ...base, neckAlteration: true, repairs: 'לקצר 2 ס"מ' }, true).repairs, 'לקצר 2 ס"מ');
});
t('no alteration / alterations disabled: untouched; input not mutated', () => {
  assert.equal(withDefaultAlterationDetails(base, true).repairs, '');
  const src = { ...base, neckAlteration: true };
  assert.equal(withDefaultAlterationDetails(src, false).repairs, '');
  withDefaultAlterationDetails(src, true);
  assert.equal(src.repairs, '');
});
t('describeItemAlterations', () => {
  assert.equal(describeItemAlterations(base), 'ללא תיקונים');
});

console.log(`\n${passed} passed`);
