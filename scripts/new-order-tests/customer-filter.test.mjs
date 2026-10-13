// סינון בורר "לקוח קיים" בהזמנה חדשה (new_order_customer_list_filter): הגדרת "לקוח תקין", ההגדרה עצמה, החיווט בשרת / באשף החדש / בישן,
// ושאין שום כיתוב חדש בכרטיסייה. בלי DB, בלי רשת. (השוואה מול נתוני TEST אמיתיים: scripts/test_customer_completeness_db.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_SRC, region } from './legacy.mjs';
import * as N from '../../app/components/new-order/newOrderLogic.js';
import { parseFieldGroups, getUnsatisfiedFieldGroups } from '../../lib/customerValidation.js';
import { requiredFieldsFromSettings } from '../../lib/customerRequiredFields.js';
import {
  buildCompletenessSpec, isCustomerComplete, isFieldFilled, prismaCompleteConditions, completeEdgeSql, completeIdsSql,
} from '../../lib/customerCompleteness.js';
import {
  resolveNewOrderCustomerFilter, NEW_ORDER_CUSTOMER_FILTERS, NEW_ORDER_CUSTOMER_FILTER_KEY, NEW_ORDER_PICKER_PARAM, NEW_ORDER_PICKER_VALUE,
} from '../../lib/newOrderCustomerFilter.js';
import { SETTINGS_SELECT_OPTIONS, SETTINGS_ORDER, SETTINGS_HEBREW_NAMES, SETTINGS_HEBREW_NOTES, classifySettingField } from '../../lib/settingsMetadata.js';

import { normalizeEmail } from '../../lib/emailUtils.js';

const PROJ = process.env.PROJ;
// אותו נרמול שה-API עושה לפני ההחזרה ללקוח (normalizeEmail)
const normalizedForApi = (c) => normalizeEmail(c.email, c.emailSuffix);
const read = (f) => fs.readFileSync(path.join(PROJ, f), 'utf8').replace(/\r\n/g, '\n');

const FULL = { firstName: 'מרים', lastName: 'כהן', phone1: '0501234567', phone2: '0521234567', email: 'a@b.co', emailSuffix: null, city: 'ביתר', street: 'הרצל', houseNum: 5, zeout: '123456782', marketingConsent: true };

// הרכבה ישירה של הפונקציות הקיימות (האורקל): חסר אם הפונקציה של האשף, ת"ז (require_customer_id_number), קבוצות, או customer_required_fields מצביעים על חוסר
function reference(settings, c) {
  const asApi = { ...c, email: c.email };
  if (N.getMissingMandatoryCustomerFields(settings, asApi).length) return false;
  if (settings.require_customer_id_number === 'true' && !String(c.zeout || '').trim()) return false;
  if (getUnsatisfiedFieldGroups(asApi, parseFieldGroups(settings.mandatory_field_groups)).length) return false;
  for (const k of requiredFieldsFromSettings(settings)) if (!String(asApi[k] ?? '').trim()) return false;
  return true;
}

const SETTING_SETS = {
  main: { require_customer_email: 'true', require_full_address: 'true', require_marketing_consent: 'false', hide_marketing_consent_field: 'true' },
  neve: { require_customer_email: 'false', require_full_address: 'true', require_customer_id_number: 'true', require_marketing_consent: 'true', hide_marketing_consent_field: 'false' },
  minimal: {},
  picker: { mandatory_fields: 'אימייל,עיר,רחוב', mandatory_field_groups: '[["phone2","email"]]' },
  noGroups: { mandatory_field_groups: '[]' },
  twoGroups: { mandatory_field_groups: '[["phone2","email"],["city","street"]]', customer_required_fields: 'firstName,lastName,phone1,zeout' },
};

test('ההגדרה: ברירת מחדל all (שורה חסרה / ערך לא מוכר), רק complete מדליק; שתי האפשרויות בעברית כפי שהבעלים ביקש', () => {
  assert.equal(NEW_ORDER_CUSTOMER_FILTER_KEY, 'new_order_customer_list_filter');
  for (const v of [undefined, null, '', 'all', 'ALL', 'completeX', 'true', ' x ']) assert.equal(resolveNewOrderCustomerFilter(v), 'all', String(v));
  assert.equal(resolveNewOrderCustomerFilter('complete'), 'complete');
  assert.equal(resolveNewOrderCustomerFilter(' complete '), 'complete');
  assert.deepEqual(NEW_ORDER_CUSTOMER_FILTERS, [{ value: 'all', label: 'כל הלקוחות הפעילים' }, { value: 'complete', label: 'רק לקוחות עם כל הפרטים' }]);
});

test('מסך ההגדרות: רשימת בחירה, שם ותיאור בעברית, בלשונית "הזמנות" ובקבוצת "שדות חובה בלקוח"', () => {
  assert.deepEqual(SETTINGS_SELECT_OPTIONS.new_order_customer_list_filter, NEW_ORDER_CUSTOMER_FILTERS);
  assert.equal(classifySettingField('new_order_customer_list_filter', 'select', 'all'), 'select');
  assert.match(SETTINGS_HEBREW_NAMES.new_order_customer_list_filter, /לקוח קיים בהזמנה חדשה/);
  assert.match(SETTINGS_HEBREW_NOTES.new_order_customer_list_filter, /כל הלקוחות הפעילים/);
  assert.ok(SETTINGS_ORDER['הזמנות'].includes('new_order_customer_list_filter'));
  const sim = read('lib/settingsSimLayout.js');
  assert.match(sim, /id: 'mandatory'[^\n]*'new_order_customer_list_filter'/);
  assert.match(sim, /new_order_customer_list_filter: \{ icon: 'userck', ctl: 'pills'/);
});

test('המפרט נגזר מאותן פונקציות: נווה (ת"ז + כתובת + דיוור) מול ראשי (מייל + כתובת, בלי ת"ז)', () => {
  const neve = buildCompletenessSpec(SETTING_SETS.neve);
  for (const k of ['firstName', 'lastName', 'phone1', 'city', 'street', 'houseNum', 'marketingConsent', 'zeout']) assert.ok(neve.keys.includes(k), `neve ${k}`);
  assert.ok(!neve.keys.includes('email'), 'מייל לא חובה בנווה בהגדרה הזו (רק בקבוצה)');
  assert.deepEqual(neve.groups, [['phone2', 'email']]);
  const main = buildCompletenessSpec(SETTING_SETS.main);
  assert.ok(main.keys.includes('email') && main.keys.includes('city') && !main.keys.includes('zeout') && !main.keys.includes('marketingConsent'));
  assert.deepEqual(buildCompletenessSpec({}).keys, ['firstName', 'lastName', 'phone1']);
  assert.deepEqual(buildCompletenessSpec(SETTING_SETS.noGroups).groups, []);
  assert.deepEqual(buildCompletenessSpec(SETTING_SETS.twoGroups).groups, [['phone2', 'email'], ['city', 'street']]);
  assert.ok(buildCompletenessSpec(SETTING_SETS.twoGroups).keys.includes('zeout'), 'customer_required_fields נכנס');
  assert.ok(buildCompletenessSpec(SETTING_SETS.picker).keys.includes('email'), 'mandatory_fields נכנס (הפונקציה של האשף)');
});

test('isCustomerComplete זהה להרכבת הפונקציות הקיימות - מטריצה של לקוחות x הגדרות', () => {
  const variants = [{}];
  const without = (k) => ({ [k]: '' });
  for (const k of Object.keys(FULL)) variants.push(without(k), { [k]: '   ' }, { [k]: null });
  variants.push({ houseNum: 0 }, { marketingConsent: false }, { email: '@', emailSuffix: null }, { email: '', emailSuffix: '@gmail.com' }, { email: '', emailSuffix: 'walla.co.il' },
    { email: 'abc', emailSuffix: null }, { phone2: '', email: '' }, { phone2: '', email: '', city: '', street: '' }, { zeout: '', phone2: '' });
  let complete = 0, incomplete = 0;
  for (const [name, settings] of Object.entries(SETTING_SETS)) {
    const spec = buildCompletenessSpec(settings);
    for (const v of variants) {
      const c = { ...FULL, ...v };
      // הפונקציה של האשף מקבלת את הלקוח כפי שה-API מחזיר אותו (email כבר מנורמל)
      const got = isCustomerComplete(c, spec);
      const exp = reference(settings, { ...c, email: normalizedForApi(c) });
      assert.equal(got, exp, `${name} ${JSON.stringify(v)}`);
      got ? complete++ : incomplete++;
    }
  }
  assert.ok(complete > 10 && incomplete > 30, `מטריצה מגוונת (${complete}/${incomplete})`);
});

test('isFieldFilled: רווחים בלבד = ריק, מספר בית 0 = ריק, מייל "@" = ריק, אישור דיוור חייב true', () => {
  assert.equal(isFieldFilled({ firstName: '  ' }, 'firstName'), false);
  assert.equal(isFieldFilled({ firstName: ' א ' }, 'firstName'), true);
  assert.equal(isFieldFilled({ houseNum: 0 }, 'houseNum'), false);
  assert.equal(isFieldFilled({ houseNum: 12 }, 'houseNum'), true);
  assert.equal(isFieldFilled({ email: '@' }, 'email'), false);
  assert.equal(isFieldFilled({ email: '', emailSuffix: '@gmail.com' }, 'email'), false);
  assert.equal(isFieldFilled({ email: 'x', emailSuffix: null }, 'email'), true);
  assert.equal(isFieldFilled({ marketingConsent: false }, 'marketingConsent'), false);
});

test('תנאי Prisma ו-SQL נבנים מאותו מפרט: מבנה, בלי קלט משתמש, ומשתנים עם ההגדרות', () => {
  const spec = buildCompletenessSpec(SETTING_SETS.neve);
  const conds = prismaCompleteConditions(spec);
  assert.equal(conds.length, spec.keys.length + spec.groups.length);
  assert.ok(conds.some((c) => c.marketingConsent === true));
  const sql = completeEdgeSql(spec);
  assert.match(sql, /^SELECT "id" FROM "Customer" WHERE "isDeleted" = false AND \(/);
  assert.match(sql, /NOT \(/);
  assert.ok(!/\$\d/.test(sql), 'בלי פרמטרים - המפתחות מהמפרט בלבד');
  assert.match(completeIdsSql(spec), /"zeout"/);
  assert.equal(completeEdgeSql({ keys: [], groups: [] }), null);
  assert.throws(() => prismaCompleteConditions({ keys: ['evil"; DROP'], groups: [] }), /unknown field/);
  assert.throws(() => completeEdgeSql({ keys: ['evil"; DROP'], groups: [] }), /unknown field/);
  assert.notEqual(completeEdgeSql(buildCompletenessSpec(SETTING_SETS.main)), sql);
});

test('העותק הקפוא של האשף הישן: אותה getMissingMandatoryCustomerFields כמו בחדש (אותו קלט -> אותו פלט)', () => {
  const src = region('const CUSTOMER_FIELD_ALIASES = {', 'const handleSaveNewCustomerAndProceed');
  // eslint-disable-next-line no-new-func
  const build = new Function('settings', `${src}\nreturn getMissingMandatoryCustomerFields;`);
  for (const settings of Object.values(SETTING_SETS)) {
    const legacy = build(settings);
    for (const v of [{}, { city: '' }, { email: '' }, { marketingConsent: false }, { firstName: '' }, { houseNum: '' }]) {
      const c = { ...FULL, ...v };
      assert.deepEqual(legacy(c), N.getMissingMandatoryCustomerFields(settings, c), JSON.stringify(v));
    }
  }
});

test('חיווט: השרת מסנן רק עם pickerFor=new-order; בדיקת הכפילות (?phone=) וכל שאר הקריאות לא מסומנות', () => {
  assert.equal(NEW_ORDER_PICKER_PARAM, 'pickerFor');
  assert.equal(NEW_ORDER_PICKER_VALUE, 'new-order');
  const route = read('app/api/customers/route.js');
  assert.match(route, /searchParams\.get\(NEW_ORDER_PICKER_PARAM\) === NEW_ORDER_PICKER_VALUE/);
  assert.match(route, /conditions\.push\(\.\.\.await memoLookup\(opts\.cache, 'pickerFilter'/);
  // הסינון בתוך queryCustomersList (גם בנסיונות החוזרים של החיפוש), לא ב-POST
  const list = route.slice(route.indexOf('async function queryCustomersList'), route.indexOf('async function POST'));
  assert.match(list, /newOrderPickerConditions/);
  assert.ok(!route.slice(route.indexOf('async function POST')).includes('newOrderPickerConditions'));
  const ctl = read('app/components/new-order/useNewOrderController.js');
  const fetches = [...ctl.matchAll(/fetch\(`(\/api\/customers\?[^`]*)`/g)].map((m) => m[1]);
  const searches = fetches.filter((u) => u.includes('?search='));
  assert.equal(searches.length, 2, 'חיפוש טלפון + מהרשימה');
  for (const u of searches) assert.match(u, /&\$\{NEW_ORDER_PICKER_PARAM\}=\$\{NEW_ORDER_PICKER_VALUE\}/, u);
  for (const u of fetches.filter((x) => x.includes('?phone='))) assert.ok(!/pickerFor|PICKER/.test(u), 'בדיקת כפילות - בלי סינון');
  assert.match(LEGACY_SRC, /api\/customers\?search=\$\{encodeURIComponent\(phoneSearchInput\.trim\(\)\)\}&limit=20&pickerFor=new-order/);
  assert.match(LEGACY_SRC, /<CustomerSelector\n\s+pickerFor="new-order"/);
  const sel = read('components/CustomerSelector.js');
  assert.match(sel, /pickerFor \? `&pickerFor=/);
  // החלפת לקוח בכרטיס הזמנה: בלי הסימון
  assert.ok(!/pickerFor/.test(read('components/orders/modern/ModernGeneralDetails.js')));
  assert.ok(!/pickerFor/.test(read('app/components/order-card/parts/OcCustomerSwap.js')));
  assert.ok(!/pickerFor/.test(read('app/customers/page.js')));
});

test('בלי כיתוב חדש בכרטיסייה / ברשימה: אין אף מחרוזת על סינון בקבצי התצוגה, והלקוח שנבחר מוצג תמיד', () => {
  for (const f of ['app/components/new-order/StepCustomer.js', 'components/CustomerSelector.js']) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/לקוחות תקינ|רק לקוחות|מסונ|סינון/.test(code), `${f}: כיתוב על הסינון`);
    assert.ok(!/new_order_customer_list_filter/.test(code), `${f}: הלקוח לא מכיר את ההגדרה`);
  }
  // הלקוח שנבחר (גם כשחסרים לו פרטים עכשיו) מוצג מ-order.selectedCustomer ולא מהתוצאות המסוננות
  assert.match(read('app/components/new-order/StepCustomer.js'), /const c = ctl\.order\.selectedCustomer;/);
});
