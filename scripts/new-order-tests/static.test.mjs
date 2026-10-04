// בדיקות סטטיות של אשף "הזמנה חדשה" החדש: אותם endpoints ואותן רמות אישור כמו בישן, המתג (ברירת מחדל = הישן),
// הפריטים שהבעלים הסיר לא קיימים, הפריטים שהוסיף קיימים, ובלי חלונות דפדפן / gm-home / title=. בלי DB, בלי רשת.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_APPROVAL_LEVELS, LEGACY_ENDPOINTS, LEGACY_SRC } from './legacy.mjs';
import * as N from '../../app/components/new-order/newOrderLogic.js';
import { resolveUiVariant, UI_SCREENS, UI_VARIANT_SETTING_KEYS } from '../../lib/uiVariant.js';
import { SELF_SWITCH_SCREENS } from '../../lib/uiVariantSelfSwitch.js';

const DIR = path.join(process.env.PROJ, 'app/components/new-order');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const FILES = fs.readdirSync(DIR).filter(f => f.endsWith('.js'));
const ALL = FILES.map(read).join('\n');
const CODE = ALL.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const VIEW = ['NewOrderA5.js', 'StepCustomer.js', 'StepDates.js', 'StepDelivery.js', 'StepItems.js', 'StepSummary.js', 'StepPayment.js', 'NoDialogs.js', 'NoHebrewCalendar.js']
  .map(read).join('\n').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('המתג: מסך new_order, ברירת מחדל legacy, לא ניתן להחלפה עצמית, page.js עטיפה דקה', () => {
  assert.ok(UI_SCREENS.includes('new_order'));
  assert.equal(UI_VARIANT_SETTING_KEYS.new_order, 'ui_variant_new_order');
  assert.equal(resolveUiVariant('new_order', {}), 'legacy');
  assert.equal(resolveUiVariant('new_order', { settings: [{ key: 'ui_variant_new_order', value: 'a5' }] }), 'a5');
  assert.ok(!SELF_SWITCH_SCREENS.includes('new_order'));
  const page = fs.readFileSync(path.join(process.env.PROJ, 'app/orders/new/page.js'), 'utf8');
  assert.match(page, /NewOrderSwitch/);
  assert.ok(page.split('\n').length < 20, 'page.js חייב להישאר עטיפה דקה');
  const sw = read('NewOrderSwitch.js');
  assert.match(sw, /useUiVariant\('new_order'\)/);
  assert.match(sw, /if \(variant !== 'a5'\) return <LegacyNewOrderPage \/>/);
  // הקובץ הישן הועבר כמו שהוא - עדיין מייצא את הדף עם אותה פונקציה
  assert.match(LEGACY_SRC, /export default function NewOrderPage\(\)/);
});

test('אותם endpoints כמו בישן (כל endpoint של הישן נקרא גם מהחדש)', () => {
  const mine = new Set([...ALL.matchAll(/['`](\/api\/[a-z0-9/_-]+)/gi)].map(m => m[1]));
  const missing = LEGACY_ENDPOINTS.filter(e => !mine.has(e));
  assert.deepEqual(missing, []);
});

test('אותן רמות אישור (requiredLevel) כמו בישן - דרך חלון האישור החדש שקורא ל-/api/auth/verify-pin', () => {
  const mine = [...new Set([...CODE.matchAll(/'(feature:[a-z_]+|הנהלה ראשית)'/g)].map(m => m[1]))].sort();
  assert.deepEqual(mine, LEGACY_APPROVAL_LEVELS);
  assert.match(read('NoDialogs.js'), /fetch\)\('\/api\/auth\/verify-pin'[\s\S]{0,200}requiredLevel: level/);
});

test('בלי חלונות דפדפן, בלי gm-home, בלי title= על אלמנטים', () => {
  assert.ok(!/window\.(alert|confirm|customConfirm|customAuthPrompt|prompt)\b|[^.\w]alert\(|[^.\w]confirm\(/.test(CODE));
  assert.ok(!/gm-home/.test(CODE));
  assert.ok(!/<[a-z][a-z0-9]*\b[^>]*\stitle=/.test(CODE));
});

test('פריטים שהבעלים הסיר (R01, R10, R11, R19, R21, S01, S02, S04, S05) לא קיימים בתצוגה', () => {
  assert.ok(!/href=\{`\/orders\/\$\{draftOrderId\}`\}/.test(VIEW), 'R01 קישור טיוטה בשורה העליונה');
  assert.ok(!/בחירה מהירה|3 חודשים/.test(VIEW), 'R10 בחירה מהירה לטווח');
  assert.ok(!/>החודש<|בחירת חודש ושנה/.test(VIEW), 'R11 קפיצה לחודש / בחירת חודש ושנה');
  assert.ok(!/פנויות|· אזל|line-through/.test(VIEW), 'R19 מספר פנויות / אזל');
  assert.ok(!/notes/.test(read('StepItems.js').replace(/\/\/.*$/gm, '')) && !/הערות כלליות/.test(read('StepItems.js').replace(/\/\/.*$/gm, '')), 'R21 הערות בשלב הפריטים');
  assert.ok(!/class(Name)?="card cust"/.test(VIEW), 'S02 כרטיס לקוח שנבחר עם 5 שדות');
  assert.ok(!/דמי משלוח/.test(read('StepDelivery.js').replace(/\/\/.*$/gm, '')), 'S04 דמי משלוח בשלב המשלוח');
  assert.ok(!/החל מ/.test(VIEW), 'S05 "החל מ-₪"');
  // S01: בחירה מהרשימה לא עוברת בבדיקות החוסרים (רק החסימה, ב"המשך")
  const pick = /const pickFromList = \(c\) => \{([\s\S]*?)\n {2}\};/.exec(read('useNewOrderController.js'));
  assert.ok(pick && !/verifyPin|missingOf|ask\(/.test(pick[1]), 'S01');
});

test('פריטים שהבעלים הוסיף/אישר קיימים (S03, S06, S07, S08, R35, Q8, R06, R03, R13, R29, R02, G1-G4)', () => {
  assert.match(read('NoHebrewCalendar.js'), /getHolidaysOnDate[\s\S]*hasH/, 'S03 חגים וצומות');
  assert.match(read('StepItems.js'), /להוספה:/, 'S06 להוספה');
  assert.match(read('StepItems.js'), /pv\.alt\[n\]/, 'S06 מחיר ליד כל תיקון');
  assert.match(read('StepSummary.js'), /לקיחה \/ החזרה[\s\S]*סוג הזמנה[\s\S]*סניף ביצוע[\s\S]*משלוח \{o\.deliveryDirection\}/, 'S07');
  assert.match(read('NoDialogs.js'), /ההזמנה נשמרה[\s\S]*הזמנה חדשה[\s\S]*הדפסה[\s\S]*targetLabel[\s\S]*המשך לצפות במסך/, 'S08 ארבעה כפתורים');
  assert.match(read('NoDialogs.js'), /נשלח מייל אישור[\s\S]*נוספה לרשימת תפוצה/, 'R35');
  assert.match(read('StepItems.js'), /\* \(חובה\)/, 'Q8 תווית');
  assert.match(read('StepCustomer.js'), /מאשר\/ת קבלת דיוורים\{/, 'R06 הנוסח של כרטיס הלקוח');
  assert.ok(!/דיוורים ועדכונים/.test(VIEW), 'R06 לא הנוסח הישן של האשף');
  assert.match(read('StepCustomer.js'), /className="no-grp"/, 'R03');
  assert.match(read('useNewOrderController.js'), /ask\('stock'/, 'R13 חלון חוסר מלאי');
  assert.match(read('NewOrderA5.js'), /function SaveError[\s\S]*<details className="coll"/, 'R29 הודעה + פירוט נפתח');
  assert.match(read('useNewOrderController.js'), /ask\('backGuard'/, 'R02');
  assert.match(read('NewOrderA5.js'), /className="pbars"/, 'G3');
  assert.match(read('NoSuggest.js'), /className="advlist"/, 'G2');
  assert.match(read('StepItems.js'), /className="altopts"[\s\S]*lenopt/, 'G4');
  assert.match(read('NewOrderA5.js'), /className="gm-ds gm-no home-bg dlg-dark"/, 'Q2 חלונות כהים');
});

test('לוגיקה: Q8 פירוט לתופרת נאכף אלא אם alteration_details_optional', () => {
  const it = { ...N.EMPTY_NEW_ITEM, neckAlteration: true, repairs: '' };
  assert.ok(N.prepareItemForAdd({}, it).error);
  assert.equal(N.prepareItemForAdd({ alteration_details_optional: 'true' }, it).itemToAdd.repairs, 'צוואר');
  assert.ok(!N.prepareItemForAdd({ enable_alterations: 'false' }, it).error);
  assert.ok(!N.prepareItemForAdd({}, { ...it, repairs: 'קיצור' }).error);
});

test('לוגיקה: R23 שם/קוד דגם, R27 רמת אישור, תאריך שעבר לפי מפתח ישראלי', () => {
  assert.equal(N.displayModelName({ name: 'ללא שם 17', barcodePrefix: '1893' }), '1893');
  assert.equal(N.modelCodeSuffix({ name: 'ללא שם 17', barcodePrefix: '1893' }), '');
  assert.equal(N.modelCodeSuffix({ name: '4512', barcodePrefix: '4512' }), '', 'נווה יעקב: קוד = שם');
  assert.equal(N.modelCodeSuffix({ name: 'שמלת תחרה', barcodePrefix: '4512' }), '4512');
  assert.equal(N.paymentApprovalRequired({}, 'יציאה באישור מנהל', 0), false, 'כולם = בלי בקשה');
  assert.equal(N.paymentApprovalRequired({ PAYMENT_APPROVAL_LEVEL: 'מנהל סניף ומעלה' }, 'יציאה באישור מנהל', 0), true);
  assert.equal(N.isPastDateKey('2026-10-03', '2026-10-04'), true);
  assert.equal(N.isPastDateKey('2026-10-04', '2026-10-04'), false);
});
