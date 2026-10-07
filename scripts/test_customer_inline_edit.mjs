// בדיקות להשלמת פרטי לקוח קיים בתוך אשף "הזמנה חדשה" (דיווח f96f3952, order_inline_customer_edit). בלי DB, בלי שרת, בלי דפדפן.
//   node --import ./scripts/new-order-tests/register.mjs scripts/test_customer_inline_edit.mjs   (ה-register: ייבוא בלי סיומת ו-'@/' כמו Next)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCompletionPlan, initialValues, validateCompletion, buildPutBody, saveCustomerCompletion, isInlineCustomerEditOn, INLINE_CUSTOMER_EDIT_SETTING,
} from '../lib/customerInlineEdit.js';
import { getMissingMandatoryCustomerFields } from '../app/components/new-order/newOrderLogic.js';
import { parseFieldGroups, getUnsatisfiedFieldGroups } from '../lib/customerValidation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let passed = 0; let failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log(`  ok   - ${name}`); } catch (e) { failed++; console.log(`  FAIL - ${name}\n         ${e.message}`); }
}

// ברירת מחדל של נווה יעקב: mandatory_fields ריק, require_customer_email כבוי, קבוצה ברירת מחדל [phone2,email]
const planFor = (customer, settings = {}) => buildCompletionPlan(
  getMissingMandatoryCustomerFields(settings, customer),
  getUnsatisfiedFieldGroups(customer, parseFieldGroups(settings.mandatory_field_groups)),
);
const full = { id: 'c1', firstName: 'רבקה', lastName: 'כהן', phone1: '0501234567', phone2: '', email: '', city: 'בית שמש', street: 'הרצל', houseNum: 5, zeout: '123456782', marketingConsent: false };

console.log('1. המתג');
await t('כבוי כברירת מחדל (חסר / ערך אחר); דולק רק ב-"true"', () => {
  assert.equal(INLINE_CUSTOMER_EDIT_SETTING, 'order_inline_customer_edit');
  assert.equal(isInlineCustomerEditOn({}), false);
  assert.equal(isInlineCustomerEditOn(undefined), false);
  assert.equal(isInlineCustomerEditOn({ order_inline_customer_edit: 'false' }), false);
  assert.equal(isInlineCustomerEditOn({ order_inline_customer_edit: 'true' }), true);
});

console.log('2. "רק מה שחסר, לא יותר ולא פחות"');
await t('לקוח שחסר לו רק טלפון נוסף/אימייל (קבוצת "אחד מספיק") - שני שדות, אף אחד לא חובה בנפרד, קבוצה אחת', () => {
  const p = planFor(full);
  assert.deepEqual(p.fields.map(f => f.key), ['phone2', 'email']);
  assert.ok(p.fields.every(f => !f.required));
  assert.equal(p.groups.length, 1);
});
await t('לקוח שלם (טלפון נוסף מולא) - אין שום שדה', () => {
  const p = planFor({ ...full, phone2: '0527654321' });
  assert.equal(p.fields.length, 0);
  assert.equal(p.groups.length, 0);
});
await t('mandatory_fields=email + require_full_address: רק מה שחסר בפועל (עיר ורחוב מולאו -> רק אימייל ומספר בית)', () => {
  const s = { mandatory_fields: 'email', require_full_address: 'true', mandatory_field_groups: '[]' };
  const p = planFor({ ...full, houseNum: null }, s);
  assert.deepEqual(p.fields.map(f => f.key).sort(), ['email', 'houseNum']);
  assert.ok(p.fields.every(f => f.required));
});
await t('אימייל חובה בנפרד + קבוצה (phone2/email): האימייל חובה והקבוצה לא מוסיפה שדות מיותרים (phone2 לא מוצג)', () => {
  const s = { require_customer_email: 'true' };
  const p = planFor(full, s);
  assert.deepEqual(p.fields.map(f => f.key), ['email']);
  assert.equal(p.fields[0].required, true);
  assert.equal(p.groups.length, 0);
});
await t('ת"ז לא נשאלת (require_customer_id_number חל רק על לקוח חדש)', () => {
  const p = planFor({ ...full, zeout: '' }, { require_customer_id_number: 'true' });
  assert.ok(!p.fields.some(f => f.key === 'zeout'));
});
await t('אישור דיוור חובה (require_marketing_consent) - שדה מתג; מוסתר כש-hide_marketing_consent_field=true', () => {
  assert.deepEqual(planFor(full, { require_marketing_consent: 'true', mandatory_field_groups: '[]' }).fields.map(f => [f.key, f.kind]), [['marketingConsent', 'switch']]);
  assert.equal(planFor(full, { require_marketing_consent: 'true', hide_marketing_consent_field: 'true', mandatory_field_groups: '[]' }).fields.length, 0);
});

console.log('3. בדיקות לפני שליחה');
await t('שדה חובה ריק -> שגיאה; מולא -> תקין', () => {
  const p = planFor({ ...full, city: '' }, { require_full_address: 'true', mandatory_field_groups: '[]' });
  assert.equal(validateCompletion(p, initialValues(p), full).ok, false);
  assert.equal(validateCompletion(p, { city: 'ירושלים' }, full).ok, true);
});
await t('קבוצת "אחד מספיק": ריק -> שגיאת קבוצה; מילוי אחד מהם מספיק', () => {
  const p = planFor(full);
  const empty = validateCompletion(p, initialValues(p), full);
  assert.equal(empty.ok, false);
  assert.match(empty.groupErrors[0], /לפחות אחד מבין: טלפון נוסף \/ אימייל/);
  assert.equal(validateCompletion(p, { phone2: '0527654321', email: '' }, full).ok, true);
  assert.equal(validateCompletion(p, { phone2: '', email: 'a@b.co' }, full).ok, true);
});
await t('תבנית: טלפון לא תקין / אימייל לא תקין / טלפון נוסף זהה לראשי / מספר בית לא ספרות', () => {
  const p = planFor({ ...full, houseNum: null }, { require_full_address: 'true' });
  assert.ok(validateCompletion(p, { phone2: '123', email: '', houseNum: '5' }, full).errors.phone2);
  assert.ok(validateCompletion(p, { phone2: '', email: 'abc', houseNum: '5' }, full).errors.email);
  assert.ok(validateCompletion(p, { phone2: '050-123-4567', email: '', houseNum: '5' }, full).errors.phone2);
  assert.ok(validateCompletion(p, { phone2: '', email: 'a@b.co', houseNum: '5א' }, full).errors.houseNum);
});

console.log('4. גוף ה-PUT');
await t('houseNum תמיד נשלח (השרת עושה parseInt); null -> ""; מספר נשאר מספר', () => {
  assert.equal(buildPutBody({ ...full, houseNum: null }, {}).houseNum, '');
  assert.equal(buildPutBody(full, {}).houseNum, 5);
  assert.equal(buildPutBody(full, { houseNum: ' 12 ' }).houseNum, 12);
});
await t('ערכים שהוקלדו נשלחים (מקוצצים); null/undefined לא נשלחים; ריק שנשאר ריק לא הופך null ל-""', () => {
  const b = buildPutBody({ ...full, phone2: null }, { phone2: '', email: ' a@b.co ' });
  assert.equal(b.email, 'a@b.co');
  assert.ok(!('phone2' in b));
  assert.equal(b.firstName, 'רבקה');
  const b2 = buildPutBody({ ...full, phone2: '0527654321' }, { phone2: '' });
  assert.equal(b2.phone2, ''); // מחיקה מכוונת של ערך קיים
});
await t('לא נשלח cardVariant / אין שדות שאינם בטופס (אותה אכיפה כמו הכרטיס הישן)', () => {
  const b = buildPutBody({ ...full, isBlocked: true, legacyId: 9, id: 'c1' }, {});
  assert.ok(!('cardVariant' in b) && !('isBlocked' in b) && !('legacyId' in b) && !('id' in b));
});
await t('מתג אישור דיוור נשלח כבוליאני', () => {
  assert.equal(buildPutBody(full, { marketingConsent: true }).marketingConsent, true);
});

console.log('5. שמירה');
await t('PUT ל-/api/customers/<id>; מחזיר את הלקוח המעודכן במבנה של תוצאת החיפוש', async () => {
  let call;
  const fakeFetch = async (url, init) => { call = { url, init }; return { ok: true, json: async () => ({ ...full, phone2: '0527654321', email: 'x@y.co', emailSuffix: null, updatedAt: 'z' }) }; };
  const upd = await saveCustomerCompletion(full, { phone2: '0527654321' }, fakeFetch);
  assert.equal(call.url, '/api/customers/c1');
  assert.equal(call.init.method, 'PUT');
  assert.equal(JSON.parse(call.init.body).phone2, '0527654321');
  assert.equal(upd.phone2, '0527654321');
  assert.equal(upd.email, 'x@y.co');
  assert.equal(upd.id, 'c1');
});
await t('שגיאת שרת -> Error עם הודעת השרת בעברית; כשל רשת -> הודעה מובנת', async () => {
  await assert.rejects(saveCustomerCompletion(full, {}, async () => ({ ok: false, json: async () => ({ error: 'מספר תעודת זהות זה כבר קיים' }) })), /כבר קיים/);
  await assert.rejects(saveCustomerCompletion(full, {}, async () => { throw new Error('net'); }), /אין חיבור/);
  await assert.rejects(saveCustomerCompletion(full, {}, async () => ({ ok: false, json: async () => { throw new Error('x'); } })), /שגיאה בשמירת פרטי הלקוח/);
});

console.log('6. חיווט (סטטי)');
await t('האשף הישן: כל חמשת הקישורים מחוברים ל-openInlineCustomerEdit, והחלון נטען רק כשהמתג דולק (isInlineCustomerEditOn)', () => {
  const s = read('app/orders/new/LegacyNewOrderPage.js');
  assert.equal((s.match(/onClick=\{\(e\) => openInlineCustomerEdit\(e, /g) || []).length, 5);
  assert.match(s, /if \(!isInlineCustomerEditOn\(settings\)\) return;/);
  assert.match(s, /<CustomerCompleteModal/);
  assert.equal((s.match(/target="_blank" rel="noreferrer"[^>]*onClick=\{\(e\) => openInlineCustomerEdit/g) || []).length, 5, 'הקישור הקיים נשאר (כבוי = כמו קודם)');
});
await t('האשף החדש: הכפתור רק כש-inlineCustomerEdit; אחרת הקישור הקיים; הדיאלוג רשום ב-NewOrderA5', () => {
  const sc = read('app/components/new-order/StepCustomer.js');
  assert.equal((sc.match(/ctl\.inlineCustomerEdit/g) || []).length, 2);
  assert.match(sc, /target="_blank" rel="noreferrer" className="lnk"/);
  const a5 = read('app/components/new-order/NewOrderA5.js');
  assert.match(a5, /case 'completeCustomer'/);
  assert.match(a5, /onEdit=\{ctl\.inlineCustomerEdit \?/);
  const ctl = read('app/components/new-order/useNewOrderController.js');
  assert.match(ctl, /const inlineCustomerEdit = isInlineCustomerEditOn\(settings\);/);
});
await t('ההגדרה רשומה: שם + הערה + רשימת הזמנות + בוליאני + מסך הגדרות; סקריפט seed קיים (בדיקה בטקסט - הכיסוי המלא ב-test_settings_sim.mjs)', () => {
  const meta = read('lib/settingsMetadata.js');
  assert.match(meta, /^  order_inline_customer_edit: '.+',$/gm);
  assert.equal((meta.match(/^  order_inline_customer_edit: /gm) || []).length, 2, 'שם + הערה');
  assert.match(meta, /'delivery_leg_button_marks_order', 'customer_credit_offset_prompt', 'order_inline_customer_edit',/);
  const sim = read('lib/settingsSimLayout.js');
  assert.match(sim, /'allow_abroad_long_stay_orders', 'order_inline_customer_edit',/);
  assert.match(sim, /order_inline_customer_edit: { icon: 'user' }/);
  const seed = read('scripts/seed_order_inline_customer_edit_setting.js');
  assert.match(seed, /trueForOrg: 2/);
  assert.match(seed, /key: 'order_inline_customer_edit'/);
});

console.log(`\n${passed} passed${failed ? `, ${failed} FAILED` : ''}`);
if (failed) process.exitCode = 1;
