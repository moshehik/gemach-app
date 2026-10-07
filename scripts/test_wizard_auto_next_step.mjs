// בדיקות למעבר האוטומטי לשלב הבא באשף "הזמנה חדשה" הישן (דיווח 3bded746, new_order_auto_next_step).
// plain node, בלי DB / דפדפן / רשת:   node scripts/test_wizard_auto_next_step.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NEW_ORDER_AUTO_NEXT_STEP_SETTING, isAutoNextStepOn, AUTO_NEXT_STEP_DELAY_MS, AUTO_NEXT_FROM_STEPS, nextStepOf,
  datesAreFilled, stepSignature, isStepComplete, shouldScheduleAutoNext, canFireAutoNext,
} from '../lib/newOrderAutoNextStep.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let passed = 0; let failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n       ', e.message); }
}

const okCustomer = { customerId: 'c1', customerBlocked: false, customerMissingCount: 0, hokFieldsOpen: false };
const okDates = { isAbroad: false, eventDate: '2026-11-03', fromDate: '', toDate: '', deliveryError: null, branchPending: false };

console.log('1. ההגדרה');
await t('מפתח, ברירת מחדל כבויה (חסר / false / ערך אחר = כבוי), רק "true" מפעיל', () => {
  assert.equal(NEW_ORDER_AUTO_NEXT_STEP_SETTING, 'new_order_auto_next_step');
  for (const s of [undefined, null, {}, { new_order_auto_next_step: 'false' }, { new_order_auto_next_step: '' }, { new_order_auto_next_step: true }, { new_order_auto_next_step: 'TRUE' }]) assert.equal(isAutoNextStepOn(s), false);
  assert.equal(isAutoNextStepOn({ new_order_auto_next_step: 'true' }), true);
  assert.ok(AUTO_NEXT_STEP_DELAY_MS >= 400 && AUTO_NEXT_STEP_DELAY_MS <= 1000, 'השהיה של כ-600ms');
});
await t('רק שלבים 1 ו-2 עוברים אוטומטית; 3/4/5 לעולם לא', () => {
  assert.deepEqual([...AUTO_NEXT_FROM_STEPS], [1, 2]);
  assert.equal(nextStepOf(1), 2); assert.equal(nextStepOf(2), 3);
  for (const s of [0, 3, 4, 5, 6, undefined]) assert.equal(nextStepOf(s), null);
});

console.log('2. "השלב הושלם" (אותו תנאי של כפתור המשך + תנאים שמרניים)');
await t('שלב 1: לקוח נבחר, בלי חוסרים, לא חסום, בלי שדות הוראת קבע פתוחים', () => {
  assert.equal(isStepComplete(1, okCustomer), true);
  assert.equal(isStepComplete(1, { ...okCustomer, customerId: '' }), false, 'לא נבחר לקוח');
  assert.equal(isStepComplete(1, { ...okCustomer, customerMissingCount: 1 }), false, 'חסרים פרטי חובה - נשאר ידני (ויש את חלון ההשלמה)');
  assert.equal(isStepComplete(1, { ...okCustomer, customerBlocked: true }), false, 'לקוח חסום דורש אישור הנהלה - ידני');
  assert.equal(isStepComplete(1, { ...okCustomer, hokFieldsOpen: true }), false, 'שדות הוראת קבע למילוי - ידני');
  assert.equal(isStepComplete(1, null), false);
});
await t('שלב 2: תאריך אירוע (רגיל) או טווח (חו"ל) + שדות משלוח תקינים + אין סניף שמחכה לבחירה', () => {
  assert.equal(isStepComplete(2, okDates), true);
  assert.equal(isStepComplete(2, { ...okDates, eventDate: '' }), false);
  assert.equal(isStepComplete(2, { ...okDates, deliveryError: 'חסרה עיר משלוח' }), false, 'ולידציית המשלוח של כפתור "המשך"');
  assert.equal(isStepComplete(2, { ...okDates, branchPending: true }), false);
  const abroad = { ...okDates, isAbroad: true, eventDate: '2026-11-03' };
  assert.equal(isStepComplete(2, abroad), false, 'חו"ל: חסר טווח');
  assert.equal(isStepComplete(2, { ...abroad, fromDate: '2026-11-03' }), false, 'חו"ל: חסר "עד תאריך"');
  assert.equal(isStepComplete(2, { ...abroad, fromDate: '2026-11-03', toDate: '2026-11-20' }), true);
  assert.equal(datesAreFilled({ isAbroad: true, fromDate: 'a', toDate: '' }), false);
  assert.equal(datesAreFilled(null), false);
});
await t('שלבים 3 / 4 / 5 אף פעם לא "שלמים" לצורך מעבר אוטומטי (גם עם פריטים, סיכום, תשלום)', () => {
  for (const s of [3, 4, 5, 6]) assert.equal(isStepComplete(s, { ...okCustomer, ...okDates, items: [1, 2] }), false);
});
await t('התנאי של שלב 2 זהה בדיוק לתנאי הכפתור "המשך לבחירת פריטים" בקוד העמוד (datesFilled + validateDeliveryFields)', () => {
  const page = read('app/orders/new/LegacyNewOrderPage.js');
  assert.match(page, /const datesFilled = order\.isAbroad \? \(order\.fromDate && order\.toDate\) : order\.eventDate;/);
  assert.match(page, /onClick=\{\(\) => setStep\(3\)\} disabled=\{!datesFilled \|\| !!validateDeliveryFields\(order, order\.selectedCustomer\?\.city, deliveryPriceCities\)\}/);
  assert.match(page, /deliveryError: validateDeliveryFields\(order, order\.selectedCustomer\?\.city, deliveryPriceCities\),/);
  assert.match(page, /onClick=\{proceedToStep2\} disabled=\{!order\.customerId\}/);
});

console.log('3. מתי מתזמנים מעבר');
const S = (step, sig) => ({ step, sig });
await t('שינוי חתימת הנתונים באותו שלב = מתזמנים; בלי שינוי / כניסה לשלב / "חזור" = לא', () => {
  assert.equal(shouldScheduleAutoNext(true, S(1, ''), S(1, 'c1')), true);
  assert.equal(shouldScheduleAutoNext(true, S(2, '||'), S(2, '2026-11-03||')), true);
  assert.equal(shouldScheduleAutoNext(true, S(1, 'c1'), S(1, 'c1')), false, 'אותו לקוח נבחר שוב');
  assert.equal(shouldScheduleAutoNext(true, S(1, ''), S(2, 'x')), false, 'כניסה לשלב 2 (למשל "כן, זה הלקוח")');
  assert.equal(shouldScheduleAutoNext(true, S(3, 'a'), S(2, 'b')), false, 'חזרה לשלב שהושלם');
  assert.equal(shouldScheduleAutoNext(true, S(3, ''), S(3, 'x')), false, 'שלב 3 אף פעם');
  assert.equal(shouldScheduleAutoNext(true, S(4, ''), S(4, 'x')), false);
  assert.equal(shouldScheduleAutoNext(false, S(1, ''), S(1, 'c1')), false, 'ההגדרה כבויה');
  assert.equal(shouldScheduleAutoNext(true, null, S(1, 'c1')), false);
});
await t('חתימות: שלב 1 = מזהה לקוח; שלב 2 = שלושת התאריכים בלבד (לא איש אירוע-רגיל/חו"ל, לא משלוח/הערות)', () => {
  assert.equal(stepSignature(1, { customerId: 7 }), '7');
  assert.equal(stepSignature(1, {}), '');
  const base = { eventDate: '2026-11-03', fromDate: '', toDate: '', isAbroad: false, notes: '', isDelivery: false };
  assert.equal(stepSignature(2, base), stepSignature(2, { ...base, isAbroad: true }), 'החלפת לשונית אירוע/חו"ל לא מזיזה');
  assert.equal(stepSignature(2, base), stepSignature(2, { ...base, notes: 'x', isDelivery: true, deliveryCity: 'y' }), 'הערות/משלוח לא מזיזים');
  assert.notEqual(stepSignature(2, base), stepSignature(2, { ...base, eventDate: '2026-11-04' }));
  assert.equal(stepSignature(3, base), null); assert.equal(stepSignature(5, base), null);
});

console.log('4. ברגע המעבר (אחרי ההשהיה)');
const fire = { enabled: true, scheduledStep: 1, currentStep: 1, complete: true, overlayOpen: false, busy: false, typing: false, userActed: false };
await t('עוברים רק כשהכל תקין; כל אחד מהחוסמים עוצר', () => {
  assert.equal(canFireAutoNext(fire), true);
  assert.equal(canFireAutoNext({ ...fire, scheduledStep: 2, currentStep: 2 }), true);
  for (const k of ['overlayOpen', 'busy', 'typing', 'userActed']) assert.equal(canFireAutoNext({ ...fire, [k]: true }), false, k);
  assert.equal(canFireAutoNext({ ...fire, complete: false }), false, 'השלב כבר לא שלם');
  assert.equal(canFireAutoNext({ ...fire, enabled: false }), false);
  assert.equal(canFireAutoNext({ ...fire, currentStep: 2 }), false, 'המשתמש כבר עבר שלב');
  for (const s of [3, 4, 5]) assert.equal(canFireAutoNext({ ...fire, scheduledStep: s, currentStep: s }), false, `שלב ${s} אף פעם`);
  assert.equal(canFireAutoNext(null), false);
});

console.log('5. תרחישים מלאים (סימולציה של הלוגיקה של העמוד)');
// מדמה את ה-effect של העמוד: לכל "רינדור" נקרא shouldScheduleAutoNext, ובסוף ההשהיה canFireAutoNext
function sim(events, enabled = true) {
  const st = { step: 1, order: { customerId: '', eventDate: '', fromDate: '', toDate: '', isAbroad: false }, ctx: { ...okCustomer, ...okDates, customerId: '', eventDate: '' } };
  let prev = { step: st.step, sig: stepSignature(st.step, st.order) };
  let pending = null; const log = [];
  const render = () => {
    const cur = { step: st.step, sig: stepSignature(st.step, st.order) };
    if (prev.step !== cur.step || prev.sig !== cur.sig) pending = null; // cleanup של ה-effect מבטל המתנה קודמת
    if (shouldScheduleAutoNext(enabled, prev, cur)) pending = { step: cur.step, userActed: false };
    prev = cur;
  };
  for (const ev of events) {
    if (ev.set) { Object.assign(st.order, ev.set); Object.assign(st.ctx, ev.ctx || {}); if (ev.set.customerId !== undefined) st.ctx.customerId = ev.set.customerId; if (ev.set.eventDate !== undefined) st.ctx.eventDate = ev.set.eventDate; render(); }
    if (ev.step) { st.step = ev.step; render(); }
    if (ev.act && pending) pending.userActed = true;
    if (ev.wait && pending) {
      const complete = isStepComplete(pending.step, { ...st.ctx, ...st.order });
      if (canFireAutoNext({ enabled, scheduledStep: pending.step, currentStep: st.step, complete, overlayOpen: !!ev.overlay, busy: false, typing: !!ev.typing, userActed: pending.userActed })) { st.step = nextStepOf(pending.step); log.push(`auto ${pending.step}->${st.step}`); pending = null; render(); } else { log.push(`blocked ${pending.step}`); pending = null; }
    }
  }
  return { step: st.step, log };
}
await t('בוחרים לקוח מהרשימה -> אחרי ההשהיה עוברים לשלב 2; בוחרים תאריך -> עוברים לשלב 3; אחר כך נשארים (פריטים ידני)', () => {
  const r = sim([{ set: { customerId: 'c1' } }, { wait: 1 }, { set: { eventDate: '2026-11-03' } }, { wait: 1 }, { set: { items: [1] } }, { wait: 1 }]);
  assert.equal(r.step, 3); assert.deepEqual(r.log, ['auto 1->2', 'auto 2->3']);
});
await t('"חזור" לשלב שהושלם לא קופץ קדימה; שינוי אמיתי (לקוח אחר) כן', () => {
  const r = sim([{ set: { customerId: 'c1' } }, { wait: 1 }, { step: 1 }, { wait: 1 }]); // חזרה לשלב 1 בלי לשנות כלום
  assert.equal(r.step, 1); assert.deepEqual(r.log, ['auto 1->2']);
  const r2 = sim([{ set: { customerId: 'c1' } }, { wait: 1 }, { step: 1 }, { set: { customerId: 'c2' } }, { wait: 1 }]);
  assert.equal(r2.step, 2); assert.deepEqual(r2.log, ['auto 1->2', 'auto 1->2']);
  // חזרה מתאריכים ללקוח, ושוב לבחור אותו לקוח: אין שינוי -> אין קפיצה
  const r3 = sim([{ set: { customerId: 'c1' } }, { wait: 1 }, { step: 1 }, { set: { customerId: 'c1' } }, { wait: 1 }]);
  assert.equal(r3.step, 1);
});
await t('פעולת משתמש בזמן ההמתנה / חלון פתוח / הקלדה / לקוח עם חוסרים - לא עוברים', () => {
  assert.equal(sim([{ set: { customerId: 'c1' } }, { act: 1 }, { wait: 1 }]).step, 1, 'נגע בעמוד בזמן ההמתנה');
  assert.equal(sim([{ set: { customerId: 'c1' } }, { wait: 1, overlay: true }]).step, 1, 'חלון פתוח');
  assert.equal(sim([{ set: { customerId: 'c1' }, ctx: { customerMissingCount: 2 } }, { wait: 1 }]).step, 1, 'חסרים פרטי חובה');
  assert.equal(sim([{ step: 2 }, { set: { eventDate: '2026-11-03' } }, { wait: 1, typing: true }]).step, 2, 'מקלידים בשדה בשלב 2');
  assert.equal(sim([{ step: 2 }, { set: { eventDate: '2026-11-03' }, ctx: { deliveryError: 'חסרה עיר' } }, { wait: 1 }]).step, 2, 'משלוח לא תקין');
});
await t('שינוי נוסף בזמן ההמתנה מאתחל את ההשהיה (דבאונס): רק המעבר האחרון נספר', () => {
  const r = sim([{ step: 2 }, { set: { eventDate: '2026-11-03' } }, { set: { eventDate: '2026-11-04' } }, { wait: 1 }, { wait: 1 }]);
  assert.equal(r.step, 3); assert.deepEqual(r.log, ['auto 2->3']);
});
await t('ההגדרה כבויה: שום מעבר אוטומטי', () => {
  assert.equal(sim([{ set: { customerId: 'c1' } }, { wait: 1 }, { step: 2 }, { set: { eventDate: '2026-11-03' } }, { wait: 1 }], false).step, 2);
});
await t('החלפת לשונית אירוע/חו"ל ושינוי הערות/משלוח אחרי בחירת תאריך לא מפעילים מעבר', () => {
  const r = sim([{ step: 2 }, { set: { eventDate: '2026-11-03' } }, { wait: 1 }, { step: 2 }, { set: { isAbroad: true } }, { wait: 1 }]);
  assert.equal(r.step, 2, 'אחרי "חזור" והחלפת לשונית נשארים בשלב 2'); assert.deepEqual(r.log, ['auto 2->3']); // המעבר היחיד: אחרי בחירת התאריך
});

console.log('6. חיווט בעמוד, רישום הגדרה, סקריפט seed');
await t('העמוד: ייבוא, hook אחד, מאזינים נוקים, אין setStep(4/5) אוטומטי; ללא נגיעה בשמירת ההזמנה', () => {
  const page = read('app/orders/new/LegacyNewOrderPage.js');
  assert.match(page, /import \{ isAutoNextStepOn, stepSignature, isStepComplete, shouldScheduleAutoNext, canFireAutoNext, nextStepOf, AUTO_NEXT_STEP_DELAY_MS \} from '\.\.\/\.\.\/\.\.\/lib\/newOrderAutoNextStep';/);
  assert.equal((page.match(/shouldScheduleAutoNext\(autoNextOn, prev, cur\)/g) || []).length, 1);
  assert.match(page, /setStep\(s => \(s === scheduledStep \? nextStepOf\(s\) : s\)\)/);
  assert.match(page, /document\.removeEventListener\('pointerdown', onUser, true\);/);
  assert.match(page, /\}, \[step, autoSig, autoNextOn\]\);/);
  assert.match(page, /document\.querySelector\('\.modal-backdrop, \.toast\.error'\)/);
  const block = page.slice(page.indexOf('const autoNextOn = '), page.indexOf('}, [step, autoSig, autoNextOn]);'));
  assert.ok(!/saveOrder|setStep\((4|5)\)/.test(block), 'אין שמירה/מעבר לשלב 4-5 אוטומטי');
});
await t('הגדרה רשומה: שם + הערה + רשימת הזמנות + בוליאני + מסך הגדרות; seed: נווה true, הראשי false (ברירת מחדל)', () => {
  const meta = read('lib/settingsMetadata.js');
  assert.equal((meta.match(/^  new_order_auto_next_step: /gm) || []).length, 2, 'שם + הערה');
  // המפתח מופיע בדיוק פעם אחת בכל אחת משתי הרשימות (SETTINGS_ORDER ו-SETTINGS_BOOLEAN_KEYS) - לא נעול למיקום צמוד, כי ענפי שחרור אחרים מוסיפים מפתחות באותן שורות
  assert.equal((meta.match(/'new_order_auto_next_step',/g) || []).length, 2, 'SETTINGS_ORDER + SETTINGS_BOOLEAN_KEYS');
  assert.match(meta, /'order_inline_customer_edit', 'new_order_auto_next_step',/);
  const sim = read('lib/settingsSimLayout.js');
  assert.match(sim, /'order_inline_customer_edit', 'new_order_auto_next_step', 'order_new_redirect_screen'/);
  assert.match(sim, /new_order_auto_next_step: \{ icon: 'check' \}/);
  const seed = read('scripts/seed_new_order_auto_next_step_setting.js');
  assert.match(seed, /key: 'new_order_auto_next_step'/);
  assert.match(seed, /trueForOrg: 2/);
  assert.match(seed, /seedBoolSetting\(/);
  assert.ok(!/--write.*true|process\.argv/.test(seed), 'כל ההגנות (dry-run / host) בעזר המשותף');
});
await t('האשף החדש (a5) לא נוגע: אין התייחסות להגדרה בקבצי new-order', () => {
  for (const f of ['app/components/new-order/NewOrderA5.js', 'app/components/new-order/useNewOrderController.js', 'app/components/new-order/StepCustomer.js']) {
    assert.ok(!read(f).includes('new_order_auto_next_step') && !read(f).includes('newOrderAutoNextStep'), f);
  }
});

console.log(`\n${passed} passed${failed ? `, ${failed} FAILED` : ''}`);
if (failed) process.exitCode = 1;
