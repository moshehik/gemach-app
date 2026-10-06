// סקירה עצמאית 6.10.2026 על העברת האשף למתכנת: (1) חישוב מחיר שנכשל חוסם שמירה / חיוב, (2) עריכת פריט + ביטול כל התיקונים לא שולחים פירוט ישן,
// (3) כפל לחיצה על שמירת לקוח / סיום, (4) window.__gmDirty, (5) סכום חיוב בכרטיס. בלי DB, בלי רשת.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as N from '../../app/components/new-order/newOrderLogic.js';
import * as P from '../../lib/newOrderPayments.js';

const PROJ = process.env.PROJ;
const DIR = path.join(PROJ, 'app/components/new-order');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const CTL = strip(read('useNewOrderController.js'));

test('1: תשובת calculate לא תקינה / לא 200 = שגיאה; חסימה בזמן חישוב ואחרי כשל', () => {
  assert.equal(N.isValidCalculation({ totalAmount: 385, calculatedItems: [] }), true);
  assert.equal(N.isValidCalculation({ totalAmount: 0 }), true, 'סכום 0 תקין');
  assert.equal(N.isValidCalculation({ totalAmount: '120.5' }), true);
  for (const bad of [null, undefined, {}, { error: 'Failed to calculate' }, { totalAmount: null }, { totalAmount: 'abc' }, { totalAmount: NaN }, 'x', 5]) assert.equal(N.isValidCalculation(bad), false, JSON.stringify(bad));
  assert.equal(N.calcBlockMessage({ calculating: false, calcError: false }), null);
  assert.match(N.calcBlockMessage({ calculating: true, calcError: false }).title, /עדיין מחושב/);
  assert.match(N.calcBlockMessage({ calculating: false, calcError: true }).title, /נכשל/);
  assert.match(N.calcBlockMessage({ calculating: true, calcError: true }).title, /נכשל/, 'שגיאה גוברת');
  // הקוד: res.ok נבדק, כשל מאפס את הסכום ומדליק calcError, תשובה מאוחרת לא דורסת, ושמירה / תשלום / חיוב חסומים
  assert.match(CTL, /if \(!res\.ok\) throw new Error\(`calculate \$\{res\.status\}`\)/);
  assert.match(CTL, /\.catch\(\(\) => \{\s*if \(off\) return;[\s\S]*setCalculatedData\(\{ totalAmount: 0, items: \[\], deliveryAmount: 0 \}\);\s*setCalcError\(true\);/);
  assert.match(CTL, /return \(\) => \{ off = true; \};/);
  assert.match(CTL, /const saveOrderInner = async \(\) => \{\s*setSaveError\(null\);\s*if \(calcBlock\) \{ say\('info', calcBlock\.title, calcBlock\.detail\); return; \}/);
  assert.match(CTL, /const handleAddPaymentClick = async \(\) => \{\s*if \(calcBlock\) \{ say\('info', calcBlock\.title, calcBlock\.detail\); return; \}/);
  assert.match(CTL, /if \(calcBlock\) \{ setCreditError\(/);
  assert.match(CTL, /calcError, retryCalc/, 'ה-controller מייצא calcError + retryCalc');
  for (const f of ['StepItems.js', 'StepSummary.js', 'StepPayment.js']) assert.match(read(f), /<CalcErrorNote ctl=\{ctl\} \/>/, f);
  assert.match(read('NoDeliveryBits.js'), /onClick=\{ctl\.retryCalc\}/);
});

test('2: עריכת פריט מנקה פירוט אוטומטי (repairsForEdit); בלי תיקון שנבחר אין פירוט בגוף', () => {
  assert.match(CTL, /repairs: NL\.repairsForEdit\(itemToEdit\)/);
  assert.equal(N.repairsForEdit, P.repairsForEdit, 'אותה פונקציה מ-lib/newOrderPayments');
  // פירוט אוטומטי (מהתיוג) מתנקה, פירוט ידני נשמר
  assert.equal(N.repairsForEdit({ neckAlteration: true, repairs: 'צוואר' }), '');
  assert.equal(N.repairsForEdit({ neckAlteration: true, sleeveAlteration: true, repairs: 'צוואר, שרוול' }), '');
  assert.equal(N.repairsForEdit({ neckAlteration: true, repairs: 'להצר בצדדים' }), 'להצר בצדדים');
  // הטקסט האוטומטי של האשף זהה לזה של lib (אחרת הניקוי לא יזהה אותו)
  for (const it of [{ neckAlteration: true }, { sleeveAlteration: true, lengthAlteration: '3' }, { neckAlteration: true, sleeveAlteration: true, lengthAlteration: '2' }]) assert.equal(N.describeAlterations(it), P.describeItemAlterations(it));
  // אחרי עריכה וביטול כל הסימונים: לא נשלח פירוט (גם עם alteration_details_optional='true' וגם בלעדיו, וגם פירוט ידני ישן)
  for (const settings of [{}, { alteration_details_optional: 'true' }, { enable_alterations: 'false' }]) {
    for (const repairs of ['', 'צוואר', 'להצר בצדדים']) {
      const prep = N.prepareItemForAdd(settings, { dressModelId: 'm1', selectedSizes: ['38'], quantity: 1, neckAlteration: false, sleeveAlteration: false, lengthAlteration: '', repairs });
      assert.equal(prep.error, undefined);
      assert.equal(prep.itemToAdd.repairs, '', `${JSON.stringify(settings)} / ${repairs}`);
    }
  }
  // תיקון שסומן: ההתנהגות הקודמת (אכיפה / פירוט ברירת מחדל / פירוט ידני נשמר)
  const chosen = { dressModelId: 'm1', selectedSizes: ['38'], quantity: 1, neckAlteration: true, repairs: '' };
  assert.ok(N.prepareItemForAdd({}, chosen).error);
  assert.equal(N.prepareItemForAdd({ alteration_details_optional: 'true' }, chosen).itemToAdd.repairs, 'צוואר');
  assert.equal(N.prepareItemForAdd({}, { ...chosen, repairs: 'להצר' }).itemToAdd.repairs, 'להצר');
});

test('3: כפל לחיצה - שמירת לקוח חדש, "סיום" ושמירה בפועל מוגנים ב-ref', () => {
  assert.match(CTL, /const handleSaveNewCustomerAndProceed = async \(skipDuplicateCheck = false\) => \{\s*if \(savingCustomerRef\.current\) return;\s*savingCustomerRef\.current = true;/);
  assert.match(CTL, /finally \{ savingCustomerRef\.current = false; setSavingCustomer\(false\); \}/);
  assert.match(CTL, /const saveOrder = async \(\) => \{\s*if \(saveOrderBusyRef\.current\) return;\s*saveOrderBusyRef\.current = true;\s*try \{ await saveOrderInner\(\); \} finally \{ saveOrderBusyRef\.current = false; \}/);
  assert.match(CTL, /await executeSaveOrderForList\(NL\.buildFinalPayments\(paymentsList, payment\)\)/);
  assert.match(CTL, /const executeSaveOrderForList = async \(finalPaymentsList, force = false\) => \{\s*if \(saveExecRef\.current\) return;\s*saveExecRef\.current = true;/);
  assert.match(CTL, /const abandonSave = \(\) => \{[^}]*saveExecRef\.current = false;/, 'כשל / 409 / כפילות משחררים את הנעילה, כדי שאפשר לנסות שוב');
  assert.match(read('StepCustomer.js'), /disabled=\{ctl\.savingCustomer\}/);
  assert.match(CTL, /savingCustomer,/);
  // "סיום" כבר מושבת בזמן שמירה (busy)
  assert.match(read('NewOrderA5.js'), /disabled=\{busy\} aria-busy=\{ctl\.saving\} onClick=\{ctl\.saveOrder\}/);
});

test('4: window.__gmDirty - פונקציה שמחזירה hasStartedOrderRef (false אחרי שמירה), מנוקה ביציאה', () => {
  assert.match(CTL, /window\.__gmDirty = \(\) => hasStartedOrderRef\.current;\s*return \(\) => \{ window\.__gmDirty = false; \};/);
  assert.match(CTL, /hasStartedOrderRef\.current = !!\([^;]*\) && !saved;/, 'אחרי שמירה מוצלחת (saved) הדגל false');
});

test('5: חיוב בכרטיס - סכום > 0 ולא מעל היתרה; תשלום אחר מעל היתרה נרשם עם אזהרה', () => {
  assert.equal(N.cardAmountError(100, 100), null);
  assert.equal(N.cardAmountError(50.5, 100), null);
  assert.equal(N.cardAmountError(385.00000000000006, 385), null, 'רעש נקודה צפה לא חוסם');
  for (const bad of [0, -5, NaN, undefined, '', 'abc', 0.004]) assert.match(N.cardAmountError(bad, 100), /גדול מ-0/, String(bad));
  assert.match(N.cardAmountError(100.01, 100), /גבוה מיתרת התשלום/);
  assert.match(N.cardAmountError(10, 0), /גבוה מיתרת התשלום/, 'כבר שולם במלואו');
  assert.equal(N.isOverpayment(101, 100), true);
  assert.equal(N.isOverpayment(100, 100), false);
  assert.match(CTL, /const amountError = NL\.cardAmountError\(paymentAmount, NL\.roundMoney\(totalAmount - NL\.sumPaid\(paymentsList\)\)\);\s*if \(amountError\) \{ setCreditError\(amountError\); return; \}/);
  assert.match(CTL, /NL\.isOverpayment\(decision\.amount/);
  // תשלום ≤ 0 נדחה כבר בהכרעה
  assert.equal(N.paymentAddDecision({}, 'מזומן', -3).action, 'reject');
  assert.equal(N.paymentAddDecision({}, 'אשראי (דרך נדרים פלוס)', 0).action, 'reject');
});
