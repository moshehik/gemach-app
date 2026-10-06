// בדיקות טהורות ל-delivery_leg_button_marks_order (דיווחים org2 a6e5fb70, e2c072b7): כפתורי "הוסף חיוב משלוח הלוך/חזור" בכרטיס ההזמנה הישן
// מסמנים גם את ההזמנה כמשלוח. הרצה (מהשורש, בלי DB/שרת/דפדפן): node --import ./scripts/business-days-tests/register.mjs scripts/test_delivery_leg_button.mjs
// יוצא בקוד 1 אם משהו נכשל. הבדיקות מוכיחות: (1) שלחיצה בלי שורת משלוח ידנית לא מוסיפה שורה (השרת יוצר אותה) והסכום זהה לתווית הכפתור,
// (2) שאין חיוב כפול בשום רצף לחיצות, (3) שהכיוון מתאחד נכון, (4) שהמתג כבוי = הקוד הישן, (5) שהכרטיס החדש (a5) לא נגע.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeDeliveryObligationPreview } from '../lib/pricingCalc.js';
import {
  legsOfDirection, legsOfDescription, directionFromLegs, planDeliveryLeg, needsAddressQuestion, canUseSavedAddress,
  defaultAddressChoice, validateOtherAddress, buildDeliveryFields, deliveryLegPrice, deliveryLegAmounts, customerCityKey,
  simulateServerDeliveryTotal, priceTableCities
} from '../lib/deliveryLegButton.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const TABLE = JSON.stringify({ 'בית שמש': 70, 'ירושלים': 50, 'מודיעין עילית': 90 });
const FLAT = '60';
const customer = { city: 'בית שמש', street: 'רחוב הרצל', houseNum: '5' };
const freshOrder = { orderId: 1, isDelivery: false, deliveryDirection: null, deliveryCity: null, deliveryAddress: null };
const manualLine = (desc, amount = 70, extra = {}) => ({ id: 1, description: desc, amount, isManual: true, isDeleted: false, ...extra });
const autoLine = (desc, amount = 70, extra = {}) => ({ id: 2, description: desc, amount, isManual: false, isDeleted: false, ...extra });

// "לחיצה" מקצה לקצה בלוגיקה הטהורה (בדיוק מה ש-applyDeliveryLeg ב-MPM עושה), מחזירה את מצב ההזמנה והחיובים אחרי הלחיצה.
function click({ order, obligations, leg, choice = 'saved', city, address }) {
  const plan = planDeliveryLeg({ order, obligations, leg });
  if (plan.disabled) return { order, obligations, plan, clicked: false };
  const fields = buildDeliveryFields({ direction: plan.direction, choice, customer, deliveryPriceByCity: TABLE, city, address });
  const nextOrder = { ...order, ...fields };
  let nextObs = obligations;
  if (plan.needsManualLine) {
    const effectiveCity = fields.deliveryCity !== undefined ? fields.deliveryCity : order.deliveryCity;
    nextObs = [...obligations, { isNew: true, description: `משלוח ${leg}`, amount: deliveryLegPrice(effectiveCity, TABLE, FLAT), isManual: true }];
  }
  return { order: nextOrder, obligations: nextObs, plan, clicked: true };
}
// מה השרת עושה בשמירה: recalculateOrderObligations מוחק כל שורה לא-ידנית; applyDeliveryCharge יוצר שורה אחת רק אם אין שורת "משלוח" פעילה.
function serverAfterSave(order, obligations) {
  const manual = obligations.filter((o) => !o.isDeleted && !o.isPreview && o.isManual !== false);
  const total = simulateServerDeliveryTotal({ order, manualLines: manual, deliveryPriceByCity: TABLE, deliveryPrice: FLAT });
  const auto = computeDeliveryObligationPreview({
    isDelivery: order.isDelivery, deliveryCity: order.deliveryCity, customerCity: customer.city, deliveryDirection: order.deliveryDirection,
    deliveryPriceByCity: TABLE, deliveryPrice: FLAT, existingObligations: manual
  });
  const deliveryLines = manual.filter((o) => String(o.description).includes('משלוח')).length + (auto ? 1 : 0);
  return { total, auto, deliveryLines };
}

console.log('direction helpers');
t('legsOfDirection / legsOfDescription / directionFromLegs', () => {
  assert.deepEqual(legsOfDirection('הלוך'), ['הלוך']);
  assert.deepEqual(legsOfDirection('חזור'), ['חזור']);
  assert.deepEqual(legsOfDirection('הלוך-חזור'), ['הלוך', 'חזור']);
  assert.deepEqual(legsOfDirection(null), ['הלוך', 'חזור']); // כמו ברירת המחדל של הכרטיס/הרשימה
  assert.deepEqual(legsOfDescription('משלוח הלוך'), ['הלוך']);
  assert.deepEqual(legsOfDescription('משלוח חזור - בית שמש'), ['חזור']);
  assert.deepEqual(legsOfDescription('משלוח הלוך-חזור - בית שמש'), ['הלוך', 'חזור']);
  assert.deepEqual(legsOfDescription('דמי ביטול הלוך'), []);
  assert.equal(directionFromLegs(['הלוך']), 'הלוך');
  assert.equal(directionFromLegs(['חזור']), 'חזור');
  assert.equal(directionFromLegs(['חזור', 'הלוך']), 'הלוך-חזור');
});

console.log('planDeliveryLeg');
t('הזמנה רגילה בלי חיובי משלוח: אין שורה ידנית, הכיוון = הרגל', () => {
  for (const leg of ['הלוך', 'חזור']) {
    const p = planDeliveryLeg({ order: freshOrder, obligations: [autoLine('שמלה (פריט #1)')], leg });
    assert.deepEqual(p, { direction: leg, disabled: false, markOnly: false, needsManualLine: false });
  }
});
t('כיוון ישן/מיושן בהזמנה שלא מסומנת כמשלוח לא נספר', () => {
  const p = planDeliveryLeg({ order: { ...freshOrder, deliveryDirection: 'חזור' }, obligations: [], leg: 'הלוך' });
  assert.equal(p.direction, 'הלוך');
});
t('הזמנה מסומנת הלוך + לחיצה על חזור = הלוך-חזור; לחיצה על אותה רגל = אותו כיוון', () => {
  const o = { ...freshOrder, isDelivery: true, deliveryDirection: 'הלוך', deliveryCity: 'בית שמש' };
  assert.equal(planDeliveryLeg({ order: o, obligations: [], leg: 'חזור' }).direction, 'הלוך-חזור');
  assert.equal(planDeliveryLeg({ order: o, obligations: [], leg: 'הלוך' }).direction, 'הלוך');
  const both = { ...o, deliveryDirection: 'הלוך-חזור' };
  assert.equal(planDeliveryLeg({ order: both, obligations: [], leg: 'הלוך' }).direction, 'הלוך-חזור');
});
t('המצב שדווח: חיוב משלוח ידני קיים אבל ההזמנה לא מסומנת - הרגל המחויבת רק מסמנת (בלי שורה), הרגל האחרת מוסיפה שורה ידנית', () => {
  const obs = [manualLine('משלוח הלוך')];
  const mark = planDeliveryLeg({ order: freshOrder, obligations: obs, leg: 'הלוך' });
  assert.deepEqual(mark, { direction: 'הלוך', disabled: false, markOnly: true, needsManualLine: false });
  const add = planDeliveryLeg({ order: freshOrder, obligations: obs, leg: 'חזור' });
  assert.deepEqual(add, { direction: 'הלוך-חזור', disabled: false, markOnly: false, needsManualLine: true });
});
t('הזמנה מסומנת ורגל כבר מחויבת = הכפתור מנוטרל (כמו היום)', () => {
  const o = { ...freshOrder, isDelivery: true, deliveryDirection: 'הלוך', deliveryCity: 'בית שמש' };
  assert.equal(planDeliveryLeg({ order: o, obligations: [manualLine('משלוח הלוך')], leg: 'הלוך' }).disabled, true);
  assert.equal(planDeliveryLeg({ order: o, obligations: [autoLine('משלוח הלוך - בית שמש')], leg: 'הלוך' }).disabled, true);
  assert.equal(planDeliveryLeg({ order: o, obligations: [autoLine('משלוח הלוך-חזור - בית שמש', 140)], leg: 'חזור' }).disabled, true);
  assert.equal(planDeliveryLeg({ order: o, obligations: [manualLine('משלוח הלוך', 70, { isDeleted: true })], leg: 'הלוך' }).disabled, false);
});
t('שורה אוטומטית קיימת (או שורת תצוגה מקדימה) לא דורשת שורה ידנית - השרת ייצור אותה מחדש לפי הכיוון המאוחד', () => {
  const o = { ...freshOrder, isDelivery: true, deliveryDirection: 'הלוך', deliveryCity: 'בית שמש' };
  assert.equal(planDeliveryLeg({ order: o, obligations: [autoLine('משלוח הלוך - בית שמש')], leg: 'חזור' }).needsManualLine, false);
  assert.equal(planDeliveryLeg({ order: o, obligations: [autoLine('משלוח הלוך - בית שמש', 70, { isPreview: true })], leg: 'חזור' }).needsManualLine, false);
});

console.log('חיוב: אין כפל, והסכום זהה לתווית הכפתור ולחישוב השרת');
t('הזמנה חדשה, הלוך (V): בלי שורה ידנית; השרת מחייב 70 = מחיר העיר = computeDeliveryObligationPreview', () => {
  const r = click({ order: freshOrder, obligations: [], leg: 'הלוך', choice: 'saved' });
  assert.equal(r.plan.needsManualLine, false);
  assert.equal(r.obligations.length, 0);
  assert.deepEqual([r.order.isDelivery, r.order.deliveryDirection, r.order.deliveryCity, r.order.deliveryAddress], [true, 'הלוך', 'בית שמש', '']);
  const s = serverAfterSave(r.order, r.obligations);
  assert.equal(s.total, 70);
  assert.equal(s.auto.amount, 70);
  assert.equal(s.auto.quantity, 1);
  assert.equal(s.deliveryLines, 1);
  assert.equal(deliveryLegAmounts({ plan: r.plan, city: 'בית שמש', deliveryPriceByCity: TABLE, deliveryPrice: FLAT }).total, 70);
});
t('הלוך ואז חזור באותה עריכה: הכיוון מתאחד להלוך-חזור, שורה אחת של 140 (לא 70 + 140)', () => {
  const first = click({ order: freshOrder, obligations: [], leg: 'הלוך', choice: 'saved' });
  // בין הלחיצות ה-preview מציג שורה אוטומטית (isPreview) - היא לא מוסיפה שורה ידנית ולא משנה את התוכנית
  const withPreview = [...first.obligations, autoLine('משלוח הלוך - בית שמש', 70, { isPreview: true, id: undefined })];
  const second = click({ order: first.order, obligations: withPreview, leg: 'חזור', choice: 'keep' });
  assert.equal(second.plan.needsManualLine, false);
  assert.equal(second.order.deliveryDirection, 'הלוך-חזור');
  const s = serverAfterSave(second.order, second.obligations);
  assert.equal(s.total, 140);
  assert.equal(s.auto.quantity, 2);
  assert.equal(s.deliveryLines, 1);
});
t('מחיר השרת = מחיר הכפתור לכל כיוון ולכל עיר בטבלה (הלוך/חזור/הלוך-חזור x 3 ערים + עיר שלא בטבלה + בלי טבלה)', () => {
  for (const tbl of [TABLE, '', '{}', '{']) {
    for (const city of ['בית שמש', 'ירושלים', 'מודיעין עילית', 'חיפה']) {
      for (const direction of ['הלוך', 'חזור', 'הלוך-חזור']) {
        const server = computeDeliveryObligationPreview({ isDelivery: true, deliveryCity: city, deliveryDirection: direction, deliveryPriceByCity: tbl, deliveryPrice: FLAT, existingObligations: [] });
        const plan = { direction, markOnly: false, needsManualLine: false };
        const mine = deliveryLegAmounts({ plan, city, deliveryPriceByCity: tbl, deliveryPrice: FLAT }).total;
        assert.equal(mine, server.amount, `${tbl} ${city} ${direction}`);
      }
    }
  }
  // בלי מחיר אחיד -> 50
  const s50 = computeDeliveryObligationPreview({ isDelivery: true, deliveryCity: 'חיפה', deliveryDirection: 'הלוך', deliveryPriceByCity: '', deliveryPrice: '', existingObligations: [] });
  assert.equal(deliveryLegPrice('חיפה', '', ''), s50.amount);
  assert.equal(s50.amount, 50);
});
t('המצב שדווח (חיוב ידני בלי סימון): "חזור" מוסיפה שורה ידנית 70 והשרת לא מכפיל - סה"כ 140, שורת משלוח אחת לכל רגל', () => {
  const obs = [manualLine('משלוח הלוך')];
  const r = click({ order: freshOrder, obligations: obs, leg: 'חזור', choice: 'saved' });
  assert.equal(r.plan.needsManualLine, true);
  assert.equal(r.obligations.length, 2);
  assert.equal(r.obligations[1].amount, 70);
  assert.equal(r.order.deliveryDirection, 'הלוך-חזור');
  const s = serverAfterSave(r.order, r.obligations);
  assert.equal(s.total, 140);
  assert.equal(s.auto, null, 'השרת לא ייצור שורה אוטומטית נוספת מעל השורות הידניות');
  assert.equal(s.deliveryLines, 2);
});
t('המצב שדווח: "הלוך" על הזמנה שכבר חויבה הלוך ידנית רק מסמנת - בלי שורה חדשה, סה"כ 70', () => {
  const obs = [manualLine('משלוח הלוך')];
  const r = click({ order: freshOrder, obligations: obs, leg: 'הלוך', choice: 'saved' });
  assert.equal(r.obligations.length, 1);
  assert.equal(r.order.isDelivery, true);
  assert.equal(serverAfterSave(r.order, r.obligations).total, 70);
  assert.equal(serverAfterSave(r.order, r.obligations).auto, null);
});
t('שורה אוטומטית שמורה (הלוך) + חזור: אין שורה ידנית; אחרי שמירה השרת מוחק את הישנה ויוצר הלוך-חזור 140 - לא 70 + 70', () => {
  const o = { ...freshOrder, isDelivery: true, deliveryDirection: 'הלוך', deliveryCity: 'בית שמש' };
  const obs = [autoLine('משלוח הלוך - בית שמש')];
  const r = click({ order: o, obligations: obs, leg: 'חזור', choice: 'keep' });
  assert.equal(r.plan.needsManualLine, false);
  assert.equal(r.obligations.length, 1);
  const s = serverAfterSave(r.order, r.obligations); // השורה האוטומטית לא נספרת כ"ידנית" - נמחקת ב-recalc
  assert.equal(s.total, 140);
  assert.equal(s.deliveryLines, 1);
});
t('כתובת אחרת (X): עיר אחרת -> המחיר לפי העיר שנבחרה, והכתובת נשמרת', () => {
  const r = click({ order: freshOrder, obligations: [], leg: 'חזור', choice: 'other', city: 'מודיעין עילית', address: ' הרב קוק 3 ' });
  assert.deepEqual([r.order.deliveryCity, r.order.deliveryAddress, r.order.deliveryDirection], ['מודיעין עילית', 'הרב קוק 3', 'חזור']);
  assert.equal(serverAfterSave(r.order, r.obligations).total, 90);
});
t('רצף אקראי של לחיצות: בכל רצף שורת המשלוח האפקטיבית אחת לכל רגל ובסה"כ price x רגליים (אין כפל לעולם)', () => {
  const starts = [
    { order: freshOrder, obligations: [] },
    { order: freshOrder, obligations: [manualLine('משלוח הלוך')] },
    { order: freshOrder, obligations: [manualLine('משלוח חזור')] },
    { order: { ...freshOrder, isDelivery: true, deliveryDirection: 'הלוך', deliveryCity: 'בית שמש' }, obligations: [autoLine('משלוח הלוך - בית שמש')] },
    { order: { ...freshOrder, isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'בית שמש' }, obligations: [] },
  ];
  const seqs = [['הלוך'], ['חזור'], ['הלוך', 'חזור'], ['חזור', 'הלוך'], ['הלוך', 'הלוך', 'חזור']];
  for (const st of starts) {
    for (const seq of seqs) {
      let cur = { order: st.order, obligations: st.obligations };
      for (const leg of seq) {
        const r = click({ ...cur, leg, choice: cur.order.isDelivery && cur.order.deliveryCity ? 'keep' : 'saved' });
        cur = { order: r.order, obligations: r.obligations };
      }
      const s = serverAfterSave(cur.order, cur.obligations);
      const legsClicked = new Set([...seq, ...st.obligations.flatMap((o) => legsOfDescription(o.description)), ...(st.order.isDelivery ? legsOfDirection(st.order.deliveryDirection) : [])]);
      assert.equal(s.total, 70 * legsClicked.size, JSON.stringify({ st, seq, total: s.total }));
      // שורת משלוח אחת לכל היותר לכל רגל
      const manualLegs = cur.obligations.filter((o) => !o.isDeleted && o.isManual !== false).flatMap((o) => legsOfDescription(o.description));
      assert.equal(new Set(manualLegs).size, manualLegs.length, 'אין שתי שורות ידניות לאותה רגל: ' + JSON.stringify({ st, seq }));
      assert.equal(cur.order.isDelivery, true);
    }
  }
});

console.log('שאלת V/X');
t('needsAddressQuestion: שואלים פעם אחת - לא כשההזמנה כבר משלוח עם פרטים שלמים', () => {
  const full = { isDelivery: true, deliveryCity: 'בית שמש', deliveryAddress: '' };
  assert.equal(needsAddressQuestion(full, 'בית שמש'), false);
  assert.equal(needsAddressQuestion({ ...freshOrder }, 'בית שמש'), true); // לא מסומנת
  assert.equal(needsAddressQuestion({ isDelivery: true, deliveryCity: '' }, 'בית שמש'), true); // אין עיר
  assert.equal(needsAddressQuestion({ isDelivery: true, deliveryCity: 'ירושלים', deliveryAddress: '' }, 'בית שמש'), true); // עיר שונה בלי כתובת
  assert.equal(needsAddressQuestion({ isDelivery: true, deliveryCity: 'ירושלים', deliveryAddress: 'הרצל 1' }, 'בית שמש'), false);
});
t('canUseSavedAddress: עיר בטבלה + רחוב שמור; אחרת ישר "כתובת אחרת"', () => {
  assert.equal(canUseSavedAddress(customer, TABLE), true);
  assert.equal(canUseSavedAddress({ ...customer, city: ' בית שמש ' }, TABLE), true);
  assert.equal(canUseSavedAddress({ ...customer, city: 'חיפה' }, TABLE), false);
  assert.equal(canUseSavedAddress({ ...customer, street: null, houseNum: null }, TABLE), false);
  assert.equal(canUseSavedAddress(customer, ''), false);
  assert.equal(canUseSavedAddress({}, TABLE), false);
});
t('defaultAddressChoice: V כברירת מחדל; X (ממולא מראש) כשבהזמנה כבר עיר/כתובת שונות מהרגילה; X כש-V לא אפשרי', () => {
  assert.equal(defaultAddressChoice({ order: freshOrder, customer, canSaved: true }), 'saved');
  assert.equal(defaultAddressChoice({ order: { deliveryCity: 'בית שמש' }, customer, canSaved: true }), 'saved');
  assert.equal(defaultAddressChoice({ order: { deliveryCity: 'ירושלים' }, customer, canSaved: true }), 'other');
  assert.equal(defaultAddressChoice({ order: { deliveryAddress: 'הרצל 1' }, customer, canSaved: true }), 'other');
  assert.equal(defaultAddressChoice({ order: freshOrder, customer, canSaved: false }), 'other');
});
t('validateOtherAddress + buildDeliveryFields', () => {
  assert.equal(validateOtherAddress({ city: '', address: 'x' }), 'יש לבחור עיר למשלוח');
  assert.equal(validateOtherAddress({ city: 'ירושלים', address: '  ' }), 'יש להקליד כתובת למשלוח');
  assert.equal(validateOtherAddress({ city: 'ירושלים', address: 'הרצל 1' }), null);
  assert.deepEqual(buildDeliveryFields({ direction: 'הלוך', choice: 'keep', customer, deliveryPriceByCity: TABLE }), { isDelivery: true, deliveryDirection: 'הלוך' });
  assert.deepEqual(buildDeliveryFields({ direction: 'חזור', choice: 'saved', customer: { ...customer, city: ' בית שמש ' }, deliveryPriceByCity: TABLE }),
    { isDelivery: true, deliveryDirection: 'חזור', deliveryCity: 'בית שמש', deliveryAddress: '' });
  assert.equal(customerCityKey('  ירושלים', TABLE), 'ירושלים');
  assert.equal(customerCityKey('חיפה', TABLE), null);
  assert.deepEqual(priceTableCities('{"א":1,"ב":2}'), ['א', 'ב']);
  assert.deepEqual(priceTableCities('['), []);
});

console.log('מתג כבוי = קוד ישן; הכרטיס החדש לא נגע; הרשמה בהגדרות');
const MPM = read('components/orders/modern/ModernPaymentsManager.js');
t('MPM: המתג נקרא מ-settings, ברירת מחדל כבוי; במתג כבוי הכפתור קורא ל-addDeliveryObligation הישן, וההשבתה היא hasActiveObligationWithDescription הישנה', () => {
  assert.ok(MPM.includes("const legMarksOrder = settings.delivery_leg_button_marks_order === 'true' && typeof onOrderChange === 'function';"));
  assert.ok(MPM.includes("if (!legMarksOrder) { addDeliveryObligation(`משלוח ${leg}`); return; }"));
  assert.ok(MPM.includes("hasActiveObligationWithDescription('משלוח הלוך')}") || MPM.includes(": hasActiveObligationWithDescription('משלוח הלוך')}"));
  assert.ok(MPM.includes("hasActiveObligationWithDescription('משלוח חזור')"));
  // ה-addDeliveryObligation הישן לא השתנה (שורה ידנית בלבד, בלי נגיעה בשדות ההזמנה)
  const fn = MPM.slice(MPM.indexOf('const addDeliveryObligation = (description) => {'), MPM.indexOf('// delivery_leg_button_marks_order (כבוי'));
  assert.ok(!/onOrderChange|isDelivery/.test(fn));
  assert.ok(/amount: deliveryPrice,\n\s+isManual: true/.test(fn));
});
t('MPM: הכפתורים נשארים מאחורי enable_deliveries, שני כפתורי רגל (הלוך/חזור) ללא כפתור שלישי מתחרה', () => {
  assert.ok(MPM.includes("const enableDeliveries = settings.enable_deliveries === 'true';"));
  assert.equal((MPM.match(/<\/svg>הוסף חיוב משלוח (הלוך|חזור)/g) || []).length, 2);
  assert.ok(MPM.includes("onClick={() => onDeliveryLegClick('הלוך')}") && MPM.includes("onClick={() => onDeliveryLegClick('חזור')}"));
});
t('MPM: שאלת V/X בעברית פשוטה כפי שאושרה', () => {
  assert.ok(MPM.includes('לכתובת הרגילה של הלקוחה או לכתובת אחרת?'));
  assert.ok(MPM.includes('ההזמנה תסומן כהזמנת משלוח'));
  assert.ok(!/טוגל/.test(MPM));
});
t('הדף הישן מעביר onOrderChange ל-MPM (אותו עדכון כמו לשונית הפרטים: setOrder + hasUnsavedChanges); שמירה לא שונתה', () => {
  const L = read('app/orders/[id]/LegacyOrderPage.js');
  const i = L.indexOf('<ModernPaymentsManager');
  const block = L.slice(i, L.indexOf('/>', L.indexOf('isLivePreviewing={isLivePreviewing}', i)));
  assert.ok(/onOrderChange=\{\(val\) => \{\s*\n\s*setOrder\(prev => \(typeof val === 'function' \? val\(prev\) : val\)\);\s*\n\s*setHasUnsavedChanges\(true\);/.test(block));
  // putOrder כבר שולח את שדות המשלוח (אין שינוי בסמנטיקת השמירה - דיווח רבקה: יציאה עם "אל תשמור" לא שומרת)
  assert.ok(L.includes('isDelivery: currentOrder.isDelivery,') && L.includes('deliveryAddress: currentOrder.deliveryAddress,'));
});
t('כרטיס ההזמנה החדש (a5) לא נגע: אין בו את המתג, את ה-lib או כפתורי משלוח ידניים', () => {
  const dir = path.join(ROOT, 'app/components/order-card');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(dir)) {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(!/delivery_leg_button_marks_order|deliveryLegButton|onDeliveryLegClick/.test(s), f);
  }
  assert.ok(!/ModernPaymentsManager['"]/.test(walk(dir).map((f) => fs.readFileSync(f, 'utf8')).join('\n').replace(/\/\/.*$/gm, '')), 'a5 לא מייבא את MPM');
});
t('הגדרה: שם + הערה + קטגוריית משלוחים + רשימת בוליאנים + פריסת הסימולציה; ברירת מחדל כבוי (השורה חסרה = כבוי)', () => {
  const M = read('lib/settingsMetadata.js');
  const key = 'delivery_leg_button_marks_order';
  assert.ok(new RegExp(`\\n  ${key}: '[^']+',`).test(M), 'שם');
  assert.equal((M.match(new RegExp(`\\n  ${key}: '`, 'g')) || []).length, 2, 'שם + הערה');
  assert.ok(M.includes(`'delivery_charge_customer_city_fallback', '${key}',\n    'delivery_show_in_order'`), 'קטגוריית משלוחים');
  assert.ok(M.includes(`'delivery_charge_customer_city_fallback', '${key}',\n`) && M.split(`'${key}'`).length === 3, 'קטגוריה + בוליאני');
  const SIM = read('lib/settingsSimLayout.js');
  assert.ok(SIM.includes(`'delivery_charge_customer_city_fallback', '${key}'] },`));
  assert.ok(SIM.includes(`  ${key}: { icon: 'truck' },`));
  // אין שום קוד שמניח שהמפתח קיים: רק === 'true'
  assert.ok(!/delivery_leg_button_marks_order\s*[!=]==?\s*'false'/.test(MPM));
});
t('סקריפט seed: dry-run כברירת מחדל דרך seedBoolSetting (בדיקת host), org2 = true בלבד, org1 נוצר false; לא נכתב דבר', () => {
  const seed = read('scripts/seed_delivery_leg_button_marks_order_setting.js');
  assert.ok(seed.includes("require('./lib/seed-bool-setting')") && seed.includes('trueForOrg: 2') && seed.includes("key: 'delivery_leg_button_marks_order'"));
  assert.ok(!/\$executeRaw|\.create\(|\.update\(|--write'\)\s*\|\||process\.argv\.push/.test(seed), 'כל הכתיבה רק בתוך seed-bool-setting עם --write');
});
t('הנחות השרת שהתכנון נשען עליהן עדיין בקוד: applyDeliveryCharge = חיוב קיים -> לא יוצר; recalc מוחק לא-ידניים; מנוע החישוב', () => {
  const calc = read('lib/pricingCalc.js');
  assert.ok(calc.includes("!o.isDeleted && String(o.description || '').includes('משלוח')"));
  const eng = read('lib/pricingEngine.js');
  assert.ok(eng.includes('where: { orderId: numericOrderId, isManual: false }'), 'recalc מוחק/מחשב מחדש רק לא-ידניים');
  assert.ok(eng.includes('await prisma.paymentObligation.create('), 'applyDeliveryCharge כותב את השורה האוטומטית');
  const route = read('app/api/orders/[id]/route.js');
  assert.ok(route.includes('await recalculateOrderObligations(parsedOrderId);') && route.includes('await applyDeliveryCharge(parsedOrderId);'));
  assert.ok(route.includes('validateDeliveryFields(effectiveOrderForValidation'), 'השרת גם אוכף שדות משלוח תקינים');
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
