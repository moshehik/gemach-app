// בדיקות הרגרסיה של ממצאי הסקירה העצמאית (2026-10-04) באשף "הזמנה חדשה" החדש: כסף (יציאה באישור מנהל / חיוב אשראי),
// Q8 (פירוט לתופרת), מועדי לקיחה/החזרה מול השרת, נראות שלב המשלוח, חלון האישור, מגן "אחורה" בזמן חיוב, תצוגת אגורות.
// בלי DB, בלי רשת. ההכרעות מחושבות על הפונקציות הטהורות של האשף; כשאי אפשר (hook / JSX) - בדיקה סטטית של הקוד.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as N from '../../app/components/new-order/newOrderLogic.js';
import { LEGACY_SRC } from './legacy.mjs';
import { subtractBusinessDays, keyFromLocalDate, parseNonWorkingDaysSetting, addBusinessDays } from '../../lib/businessDays.js';
import { getExpectedReturnKey } from '../../lib/lateReturn.js';
import { SETTINGS_HEBREW_NAMES, SETTINGS_HEBREW_NOTES, SETTINGS_ORDER, SETTINGS_BOOLEAN_KEYS } from '../../lib/settingsMetadata.js';

const PROJ = process.env.PROJ;
const DIR = path.join(PROJ, 'app/components/new-order');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const CTL = strip(read('useNewOrderController.js'));

// ---------- 1 + 2: כסף ----------
test('1: "יציאה באישור מנהל" לא נרשמת כתשלום ₪; תשלום מפוצל (גם מזומן) דורש אישור לפי PAYMENT_APPROVAL_LEVEL', () => {
  const M = N.MANAGER_EXIT_METHOD;
  assert.equal(N.paymentAddDecision({}, M, 150).action, 'reject');
  assert.equal(N.paymentAddDecision({}, M, 150).reason, 'manager-exit');
  assert.equal(N.paymentAddDecision({ PAYMENT_APPROVAL_LEVEL: 'מנהל' }, M, 150).action, 'reject', 'גם כשרמת האישור דולקת - לא נרשמת');
  assert.equal(N.paymentAddDecision({}, 'מזומן', 0).reason, 'amount');
  assert.equal(N.paymentAddDecision({}, 'מזומן', 'abc').action, 'reject');
  assert.equal(N.paymentAddDecision({}, 'אשראי (דרך נדרים פלוס)', 100).action, 'credit');
  assert.equal(N.paymentAddDecision({ PAYMENT_APPROVAL_LEVEL: 'מנהל' }, 'אשראי (דרך נדרים פלוס)', 100).action, 'credit', 'אשראי עובר חיוב אמיתי - לא אישור');
  assert.equal(N.paymentAddDecision({}, 'מזומן', 100).action, 'add', 'כולם = בלי בקשה');
  for (const level of ['מנהל', 'עובד', 'מנהל סניף ומעלה']) {
    const d = N.paymentAddDecision({ PAYMENT_APPROVAL_LEVEL: level }, 'מזומן', 100);
    assert.equal(d.action, 'approve', level);
    assert.equal(d.amount, 100);
  }
  assert.equal(N.paymentAddDecision({ PAYMENT_APPROVAL_LEVEL: 'כולם' }, 'העברה בנקאית', 100).action, 'add');
});
test('1: handleAddPaymentClick ב-controller נשען על paymentAddDecision ומבקש אישור (feature:payment_exit_approval) לפני הרישום', () => {
  const m = /const handleAddPaymentClick = async \(\) => \{([\s\S]*?)\n {2}\};/.exec(CTL);
  assert.ok(m, 'handleAddPaymentClick (async)');
  const body = m[1];
  assert.match(body, /NL\.paymentAddDecision\(settings, payment\.method, payment\.amount\)/);
  assert.ok(body.indexOf('verifyPin(') < body.indexOf('setPaymentsList('), 'האישור לפני הרישום');
  assert.match(body, /'feature:payment_exit_approval'/);
  assert.match(body, /reason === 'manager-exit'/);
});
test('1: בסיום ההזמנה "יציאה באישור מנהל" עדיין נרשמת בסכום 0 (השרת סופר אותה כאישור, לא ככסף)', () => {
  const f = N.buildFinalPayments([], { amount: 300, method: N.MANAGER_EXIT_METHOD, notes: 'x' });
  assert.equal(f.length, 1);
  assert.equal(f[0].amount, 0);
  assert.equal(N.sumPaid(f), 0);
});

test('2: חיוב אשראי נשמר תמיד באמצעי האשראי, גם כשהבורר על מזומן', () => {
  assert.equal(N.creditPaymentMethod(['מזומן', 'אשראי (דרך נדרים פלוס)', 'יציאה באישור מנהל']), 'אשראי (דרך נדרים פלוס)');
  assert.equal(N.creditPaymentMethod(['מזומן', 'אשראי חיצונית', 'אשראי', 'צ׳ק']), 'אשראי', 'אשראי חיצונית אינו אמצעי הסליקה');
  assert.equal(N.creditPaymentMethod(['מזומן']), N.DEFAULT_CREDIT_METHOD);
  assert.equal(N.creditPaymentMethod(undefined), N.DEFAULT_CREDIT_METHOD);
  assert.ok(N.isCreditMethod(N.creditPaymentMethod(['מזומן'])));
  const ok = /const newPayment = \{ amount: paymentAmount, method: ([^,]+),/.exec(CTL);
  assert.ok(ok, 'newPayment');
  assert.equal(ok[1], 'NL.creditPaymentMethod(paymentMethodOptions)');
  assert.ok(!/method: payment\.method, notes: conf/.test(CTL));
});

// ---------- 3: Q8 ----------
test('3 Q8: הפירוט האוטומטי (alteration_details_optional) נכנס לגוף הפריט שנשלח; בברירת המחדל נאכף', () => {
  const it = { ...N.EMPTY_NEW_ITEM, dressModelId: 'm-1', dressName: 'שמלה', selectedSizes: ['38'], neckAlteration: true, sleeveAlteration: true, lengthAlteration: '3', repairs: '' };
  const valid = [{ sizeText: '38', sampleItemId: 's' }];
  const optional = N.prepareItemForAdd({ alteration_details_optional: 'true' }, it);
  assert.equal(optional.itemToAdd.repairs, 'צוואר, שרוול, אורך (3)');
  assert.equal(N.buildItemsToAdd(optional.itemToAdd, valid, [{ basePrice: 100 }])[0].repairs, 'צוואר, שרוול, אורך (3)');
  assert.equal(N.buildItemsToAdd(it, valid, [{ basePrice: 100 }])[0].repairs, '', 'newItem גולמי (בלי prepareItemForAdd) לא מקבל פירוט - לכן הקורא חייב להעביר prep.itemToAdd');
  assert.ok(N.prepareItemForAdd({}, it).error, 'ברירת מחדל = אכיפה');
  assert.ok(N.prepareItemForAdd({ alteration_details_optional: 'false' }, it).error);
  assert.ok(N.prepareItemForAdd({ alteration_details_optional: '' }, it).error);
  const manual = N.prepareItemForAdd({}, { ...it, repairs: 'קיצור 3 ס"מ' });
  assert.equal(N.buildItemsToAdd(manual.itemToAdd, valid, [{ basePrice: 1 }])[0].repairs, 'קיצור 3 ס"מ');
  assert.match(CTL, /NL\.buildItemsToAdd\(prep\.itemToAdd, validSizes, prices\)/);
  assert.ok(!/NL\.buildItemsToAdd\(newItem,/.test(CTL));
});
test('3 Q8: alteration_details_optional רשום ב-lib/settingsMetadata (שם, הסבר, קטגוריה, מתג) ובישן אין אכיפה (חובה בחדש בלבד, החלטת בעלים פתוחה)', () => {
  const k = 'alteration_details_optional';
  assert.ok(SETTINGS_HEBREW_NAMES[k] && /[א-ת]/.test(SETTINGS_HEBREW_NAMES[k]));
  assert.ok(SETTINGS_HEBREW_NOTES[k] && /[א-ת]/.test(SETTINGS_HEBREW_NOTES[k]));
  assert.ok(Object.values(SETTINGS_ORDER).some(list => list.includes(k)), 'קטגוריה');
  assert.ok(SETTINGS_BOOLEAN_KEYS.includes(k), 'מתג');
  assert.ok(!/alteration_details_optional/.test(LEGACY_SRC), 'הישן לא קורא את ההגדרה (הוא תמיד ממלא פירוט ברירת מחדל, withDefaultAlterationDetails) - האכיפה בחדש בלבד');
});

// ---------- 4: מועדי לקיחה/החזרה ----------
const closed = (...days) => JSON.stringify({ version: 1, days: days.map(date => ({ date, status: 'closed' })) });
const ORD = (o) => ({ ...N.EMPTY_ORDER, ...o });
test('4: ימים שהבעלים סגר משפיעים על הלקיחה (דוגמת הסקירה: סגור 20.10, אירוע חמישי 22.10 -> לקיחה שני 19.10)', () => {
  const o = ORD({ eventDate: '2026-10-22' });
  assert.equal(N.pickupReturnKeys(o, {}).pickup, '2026-10-20', 'בלי הגדרה: יומיים עסקים אחורה');
  assert.equal(N.pickupReturnKeys(o, { non_working_days_extra: closed('2026-10-20') }).pickup, '2026-10-19');
  assert.equal(N.pickupReturnKeys(o, { non_working_days_extra: 'לא JSON' }).pickup, '2026-10-20', 'הגדרה שבורה = ברירת מחדל, בלי נפילה');
  assert.equal(N.pickupReturnKeys(o, { non_working_days_extra: closed('2026-10-25') }).ret, '2026-10-26', 'החזרה: יום העבודה הבא אחרי סופ"ש + יום סגור');
});
test('4: משלוח - delivery_days_before + חגים (דוגמת הסקירה: שישי 23.4.2027 -> שני 19.4, לא רביעי 21.4 ערב פסח)', () => {
  const o = ORD({ eventDate: '2027-04-23', isDelivery: true, deliveryDirection: 'הלוך-חזור' });
  assert.equal(N.pickupReturnKeys(o, { delivery_days_before: '2' }).pickup, '2027-04-19');
  assert.equal(N.pickupReturnKeys({ ...o, deliveryOneDayBefore: true }, { delivery_days_before: '2' }).pickup, '2027-04-20', 'יום לפני');
  assert.equal(N.pickupReturnKeys(o, {}).pickup, '2027-04-20', 'שורה חסרה = יום אחד (כמו getDeliveriesForDate)');
  assert.equal(N.pickupReturnKeys({ ...o, deliveryDirection: 'חזור' }, { delivery_days_before: '2' }).pickup, N.pickupReturnKeys(ORD({ eventDate: '2027-04-23' }), {}).pickup, 'משלוח חזור בלבד: לקיחה עצמית כרגיל');
  // delivery_skip_weekends: בלי = שישי/שבת נספרים; עם = מדולגים
  const sun = ORD({ eventDate: '2026-11-01', isDelivery: true });
  assert.equal(N.pickupReturnKeys(sun, { delivery_days_before: '2' }).pickup, '2026-10-30');
  assert.equal(N.pickupReturnKeys(sun, { delivery_days_before: '2', delivery_skip_weekends: 'true' }).pickup, '2026-10-28', 'שישי+שבת מדולגים: חמישי 29 (1), רביעי 28 (2)');
  assert.equal(N.pickupReturnKeys(ORD({ eventDate: '2026-10-22', isDelivery: true }), { delivery_days_before: '2', non_working_days_extra: closed('2026-10-20') }).pickup, '2026-10-19', 'יום שהבעלים סגר מדולג גם במשלוח');
});
test('4: ללא משלוח שווה בכל תאריך להדפסה/מייל/שמירה בשרת (subtractBusinessDays 2 + getExpectedReturnKey), כולל חו"ל ורשימת הבעלים', () => {
  const configs = ['', closed('2026-10-14', '2026-12-31'), closed('2027-04-13', '2027-04-14', '2027-04-15'), JSON.stringify({ version: 1, days: [{ date: '2026-10-16', status: 'open' }, { date: '2026-11-03', status: 'closed' }] })];
  let n = 0;
  for (const raw of configs) {
    const nw = parseNonWorkingDaysSetting(raw || null);
    for (let d = Date.UTC(2026, 8, 1); d < Date.UTC(2027, 7, 1); d += 864e5) {
      const key = new Date(d).toISOString().slice(0, 10);
      const o = ORD({ eventDate: key });
      const serverPickup = keyFromLocalDate(subtractBusinessDays(key, 2, nw));
      const got = N.pickupReturnKeys(o, { non_working_days_extra: raw });
      assert.equal(got.pickup, serverPickup, `pickup ${key}`);
      assert.equal(got.ret, getExpectedReturnKey({ eventDate: key }, nw), `return ${key}`);
      // חו"ל: eventDate=fromDate, החזרה = toDate מגולגל ליום עבודה
      const to = new Date(d + 6 * 864e5).toISOString().slice(0, 10);
      const ab = ORD({ isAbroad: true, fromDate: key, toDate: to, eventDate: key });
      const g2 = N.pickupReturnKeys(ab, { non_working_days_extra: raw });
      assert.equal(g2.ret, getExpectedReturnKey({ eventDate: key, toDate: to }, nw), `abroad return ${key}`);
      assert.equal(g2.pickup, serverPickup);
      n++;
    }
  }
  assert.ok(n > 1000);
});
test('4: כלל המשלוח זהה לביטוי ב-lib/deliveries.js (הקובץ מייבא prisma ולכן אי אפשר לייבא; מגן סחף)', () => {
  const src = fs.readFileSync(path.join(PROJ, 'lib/deliveries.js'), 'utf8');
  assert.ok(src.includes('plusBusiness(eventKey, -(order.deliveryOneDayBefore ? 1 : daysBefore))'), 'כלל יום ההוצאה השתנה בשרת - לעדכן pickupReturnKeys');
  assert.ok(src.includes('const daysBefore = isNaN(parsedBefore) ? 1 : parsedBefore;'));
  assert.ok(src.includes("settingsMap.delivery_skip_weekends === 'true'"));
  // ושוויון חישובי ישיר לאותו ביטוי
  const nw = parseNonWorkingDaysSetting(closed('2027-04-19'));
  const direct = addBusinessDays('2027-04-23', -2, nw, { skipWeekend: false });
  assert.equal(N.pickupReturnKeys(ORD({ eventDate: '2027-04-23', isDelivery: true }), { delivery_days_before: '2', non_working_days_extra: closed('2027-04-19') }).pickup, direct);
});
test('4: StepSummary משתמש ב-pickupReturnKeys(o, s) ולא בכלל קשיח', () => {
  const sum = strip(read('StepSummary.js'));
  assert.match(sum, /pickupReturnKeys\(o, s\)/);
  assert.ok(!/isChagDay|nonWorking\s*=/.test(sum));
});

// ---------- 5: נראות שלב המשלוח ----------
test('5: "הזמנת משלוח" מוצגת רק כשכרטיס המשלוח/סניף/טלפוני מוצג (כמו הישן) ו-enable_deliveries דלוק', () => {
  const v = N.deliveryStepVisibility;
  assert.deepEqual(v({ enable_deliveries: 'true' }), { showMode: false, showDelivery: true }, 'delivery_show_in_order חסר = מוצג');
  assert.deepEqual(v({ enable_deliveries: 'true', delivery_show_in_order: 'false' }), { showMode: false, showDelivery: false });
  assert.deepEqual(v({ enable_deliveries: 'true', delivery_show_in_order: 'false', track_branch_on_order: 'true' }), { showMode: true, showDelivery: true }, 'דגל סניף מציג את הכרטיס');
  assert.deepEqual(v({ delivery_show_in_order: 'true', phone_order_marker_enabled: 'true' }), { showMode: true, showDelivery: false }, 'בלי enable_deliveries אין משלוח');
  assert.deepEqual(v({}), { showMode: false, showDelivery: false });
  // אותו תנאי כמו בישן: (דגלים || delivery_show_in_order !== 'false') && enable_deliveries === 'true'
  assert.match(LEGACY_SRC, /phone_order_marker_enabled === 'true' \|\| settings\.track_branch_on_order === 'true' \|\| settings\.branches_enabled === 'true' \|\| settings\.delivery_show_in_order !== 'false'/);
  assert.match(strip(read('StepDelivery.js')), /deliveryStepVisibility\(s\)/);
});

// ---------- 6: חלון האישור ----------
test('6: תשובה מאוחרת של חלון שנסגר לא מאשרת את החלון הבא (מנהל חלונות עם id)', async () => {
  const slots = {};
  const mgr = N.createDialogManager((L, v) => { slots[L] = v; });
  const first = mgr.ask('approval', { message: 'a' });
  const firstId = slots[1].id;
  mgr.answer(1, null); // Escape
  assert.equal(await first, null);
  const second = mgr.ask('approval', { message: 'b' });
  const secondId = slots[1].id;
  assert.notEqual(firstId, secondId);
  assert.equal(mgr.answer(1, { pin: '1234', employeeId: '7' }, firstId), false, 'verify-pin איטי של החלון הראשון');
  assert.equal(slots[1].id, secondId, 'החלון השני נשאר פתוח');
  let settled = false;
  second.then(() => { settled = true; });
  await new Promise(r => setImmediate(r));
  assert.equal(settled, false, 'ההבטחה של החלון השני לא נפתרה');
  assert.equal(mgr.answer(1, { pin: 'x', employeeId: '8' }, secondId), true);
  assert.deepEqual(await second, { pin: 'x', employeeId: '8' });
  assert.equal(slots[1], null);
});
test('6: מנהל החלונות - שכבות, החלפה באותה שכבה, busy ו-answer בלי id (Escape)', async () => {
  const slots = {};
  const mgr = N.createDialogManager((L, v) => { slots[L] = v; });
  const a = mgr.ask('credit', {}, 1);
  const b = mgr.ask('approval', {});
  assert.equal(slots[2].type, 'approval', 'השכבה הפנויה הבאה');
  mgr.setBusy(true);
  assert.equal(mgr.occupied[2], true);
  mgr.setBusy(false);
  mgr.answer(2, true);
  assert.equal(await b, true);
  const c = mgr.ask('x', {}, 1); // מחליף את credit - הישן נפתר ב-undefined
  assert.equal(await a, undefined);
  mgr.answer(1, 5);
  assert.equal(await c, 5);
  assert.equal(mgr.answer(1, 1), true, 'answer בלי id תמיד סוגר (Escape)');
});
test('6: ApprovalDialog - אין בחירה מראש של המאשר הראשון; המשתמש המחובר נבחר רק אם הוא מאשר; ה-close של הדף מתויג ב-id', () => {
  const dlg = strip(read('NoDialogs.js'));
  const eff = /\]\)\.then\(\(\[all, me\]\) => \{([\s\S]*?)\n {4}\}\);/.exec(dlg);
  assert.ok(eff, 'אפקט טעינת המאשרים');
  assert.ok(!/list\[0\]/.test(eff[1]), 'בחירה אוטומטית של list[0]');
  assert.match(eff[1], /cur && list\.some\(e => e\.id === cur\.id\)\) setSel\(String\(cur\.id\)\)/);
  assert.match(dlg, /<option key="" value="">/, 'אפשרות ריקה "בחר ..."');
  assert.match(strip(read('NewOrderA5.js')), /ctl\.answer\(layer, r, d\.id\)/);
  assert.match(CTL, /createDialogManager/);
});

// ---------- 7: מגן "אחורה" ----------
test('7: Back בזמן חיוב/שמירה לא פותח את מגן היציאה (ולא נותן לעזוב)', () => {
  const m = /const handlePopState = async \(\) => \{([\s\S]*?)\n {4}\};/.exec(CTL);
  assert.ok(m);
  const body = m[1];
  const iPush = body.indexOf('pushState');
  const iBusy = body.indexOf('busyRef.current');
  const iAsk = body.indexOf("ask('backGuard'");
  assert.ok(iPush >= 0 && iBusy > iPush && iAsk > iBusy, 'מחזירים את ה-guard, בודקים busy, ורק אז שואלים');
  assert.match(CTL, /busyRef\.current = saving \|\| isProcessingCredit/);
  assert.match(strip(read('NewOrderA5.js')), /disabled=\{ctl\.saving \|\| ctl\.isProcessingCredit\}/, 'כפתור היציאה כבוי באותם מצבים');
});

// ---------- 8: תצוגה ----------
test('8: סכומים עם אגורות מוצגים עם שתי ספרות; שלמים בלי', () => {
  const norm = (s) => s.replace(/[‎‏]/g, '');
  assert.equal(norm(N.moneyTxt(100)), '₪100');
  assert.equal(norm(N.moneyTxt(0)), '₪0');
  assert.equal(norm(N.moneyTxt(1234)), '₪1,234');
  assert.equal(norm(N.moneyTxt(12.5)), '₪12.50');
  assert.equal(norm(N.moneyTxt(99.99)), '₪99.99');
  assert.equal(norm(N.moneyTxt(1234.5)), '₪1,234.50');
  assert.equal(norm(N.moneyTxt(-7.25)), '₪7.25');
  assert.equal(norm(N.moneyTxt(0.1 + 0.2)), '₪0.30');
  assert.equal(norm(N.moneyTxt(100.001)), '₪100');
  assert.equal(N.roundMoney(0.1 + 0.2), 0.3);
  assert.match(strip(fs.readFileSync(path.join(DIR, 'NoUi.js'), 'utf8')), /export const money = \(n\) => <bdi dir="ltr">₪\{moneyAmount\(n\)\}<\/bdi>/);
});
test('8: "להוספה" כולל את הסל - הפרש בין (סל + חדש) לסל לבד, באותם שדות משלוח', () => {
  const cart = [{ dressModelId: 'm-1', sizeText: '38', quantity: 1 }];
  const order = ORD({ eventDate: '2026-11-12', items: cart, isDelivery: true, deliveryCity: 'בית שמש', deliveryDirection: 'הלוך' });
  const item = { dressModelId: 'm-2', selectedSizes: ['40', '42'], neckAlteration: true };
  const b = N.buildAddPreviewBodies(order, item);
  assert.equal(b.withCart.items.length, 3);
  assert.deepEqual(b.withCart.items[0], cart[0]);
  assert.deepEqual(b.base, N.buildCalculateBody(order));
  assert.equal(b.withCart.isDelivery, true);
  assert.equal(b.withCart.deliveryCity, 'בית שמש');
  assert.equal(N.addPreviewTotal(470.5, 250), 220.5);
  assert.equal(N.addPreviewTotal(250, 250), 0);
  const empty = N.buildAddPreviewBodies(ORD({ eventDate: '2026-11-12' }), item);
  assert.equal(empty.base, null);
  assert.deepEqual(empty.withCart, N.buildAddPreviewBody(ORD({ eventDate: '2026-11-12' }), item), 'סל ריק: הגוף הקודם');
  assert.match(CTL, /NL\.addPreviewTotal\(sum && sum\.totalAmount, base && base\.totalAmount\)/);
});
