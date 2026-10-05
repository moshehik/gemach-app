// שדות בנק ללקוח לפי הגדרה (customer_bank_fields_enabled, החלטת הבעלים 5.10.2026): ברירת מחדל כבוי.
// חלק א' - פונקציות טהורות (lib/customerRequiredFields.js, lib/customerValidation.js, customerCardLogic.js).
// חלק ב' - ה-routes האמיתיים (POST /api/customers, PUT /api/customers/[id]) מול Prisma/הגדרות/אימות בזיכרון (בלי DB, בלי שרת).
// חלק ג' - בדיקות סטטיות של הממשק (טופס לקוח חדש, כרטיס, פיקר ההגדרות, מטא-דאטה, סקריפט seed).
// הרצה: node scripts/customer-card-tests/bank-fields.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(PROJ, p), 'utf8');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
let passed = 0;
let failed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; } };

// ---------- loader לחלק ב': shims ל-next/server, Prisma, אימות והגדרות. כל השאר אמיתי ----------
const SHIMS = path.join(PROJ, 'scripts', 'schedule-tests', 'shims');
const prismaShim = `
const S = () => globalThis.__CC;
const customer = {
  async findFirst({ where } = {}) { if (where && where.zeout) return S().zeoutOwner || null; return { legacyId: 100 }; },
  async findUnique({ where }) { return S().customers.find((c) => c.id === where.id) || null; },
  async create({ data }) { S().created.push(data); return { id: 'new1', ...data }; },
  async update(args) { S().updated.push(args); return { id: args.where.id, ...args.data }; },
};
export default { customer };
export function auditAs(action, args, changes) { return { ...args, __audit: { action, changes } }; }
`;
const authShim = 'export async function checkAuth() { return true; }';
const managerShim = 'export async function verifyManagerPin() { return { ok: false }; }';
const settingsShim = 'export async function getAllCachedSettings() { if (globalThis.__CC.settingsFail) throw new Error("settings read failed"); return globalThis.__CC.settings; }';
const hooksSrc = `
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const PROJ = ${JSON.stringify(PROJ)};
const NS = ${JSON.stringify(pathToFileURL(path.join(SHIMS, 'next-server.mjs')).href)};
const mk = (s) => 'data:text/javascript,' + encodeURIComponent(s);
const PRISMA = mk(${JSON.stringify(prismaShim)});
const AUTH = mk(${JSON.stringify(authShim)});
const SETTINGS = mk(${JSON.stringify(settingsShim)});
const MANAGER = mk(${JSON.stringify(managerShim)});
async function tryResolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    for (const suf of ['.js', '/index.js', '.mjs']) { try { return await next(spec + suf, ctx); } catch {} }
    throw e;
  }
}
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') return { url: NS, shortCircuit: true };
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  const r = await tryResolve(specifier, context, nextResolve);
  if (r.url.endsWith('/app/lib/prisma.js')) return { url: PRISMA, shortCircuit: true };
  if (r.url.endsWith('/lib/auth.js')) return { url: AUTH, shortCircuit: true };
  if (r.url.endsWith('/lib/managerAuth.js')) return { url: MANAGER, shortCircuit: true };
  if (r.url.endsWith('/lib/settingsCache.js')) return { url: SETTINGS, shortCircuit: true };
  return r;
}
`;
register('data:text/javascript,' + encodeURIComponent(hooksSrc));
const L = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);

const R = await L('lib/customerRequiredFields.js');
const V = await L('lib/customerValidation.js');
const C = await L('app/components/customer-card/customerCardLogic.js');
const postRoute = await L('app/api/customers/route.js');
const putRoute = await L('app/api/customers/[id]/route.js');

const rows = (obj) => Object.entries(obj).map(([key, value]) => ({ key, value }));
const reset = (settings = {}, customers = [], settingsFail = false) => { globalThis.__CC = { settings: rows(settings), customers, created: [], updated: [], zeoutOwner: null, settingsFail }; };
const BANK = { bankName: 'לאומי', bankBranch: '800', bankAccount: '123456', bankAccountName: 'רחל כהן' };
const BASE = { firstName: 'רחל', lastName: 'כהן', phone1: '0501234567', email: 'r@example.com', cardVariant: 'a5' };

console.log('A. pure');
await t('customerBankFieldsEnabled: ברירת מחדל כבוי; רק "true" מדליק (מפה / Map / מערך שורות)', () => {
  assert.equal(R.customerBankFieldsEnabled(undefined), false);
  assert.equal(R.customerBankFieldsEnabled({}), false);
  assert.equal(R.customerBankFieldsEnabled({ customer_bank_fields_enabled: 'false' }), false);
  assert.equal(R.customerBankFieldsEnabled({ customer_bank_fields_enabled: '1' }), false);
  assert.equal(R.customerBankFieldsEnabled({ customer_bank_fields_enabled: 'true' }), true);
  assert.equal(R.customerBankFieldsEnabled(new Map([['customer_bank_fields_enabled', 'true']])), true);
  assert.equal(R.customerBankFieldsEnabled([{ key: 'customer_bank_fields_enabled', value: 'true' }]), true);
  assert.equal(R.customerBankFieldsEnabled([{ key: 'x', value: 'true' }]), false);
});
await t('requiredFieldsFromSettings: כבוי = שדות בנק לא חובה גם אם מסומנים; פעיל = חובה', () => {
  const val = 'firstName,lastName,phone1,bankName,bankAccount';
  assert.deepEqual(R.requiredFieldsFromSettings({ customer_required_fields: val }), ['firstName', 'lastName', 'phone1']);
  assert.deepEqual(R.requiredFieldsFromSettings({ customer_required_fields: val, customer_bank_fields_enabled: 'false' }), ['firstName', 'lastName', 'phone1']);
  assert.deepEqual(R.requiredFieldsFromSettings({ customer_required_fields: val, customer_bank_fields_enabled: 'true' }), ['firstName', 'lastName', 'phone1', 'bankName', 'bankAccount']);
  assert.deepEqual(R.requiredFieldsFromSettings(new Map([['customer_required_fields', val]])), ['firstName', 'lastName', 'phone1']);
  assert.equal(R.requiredFieldsFromSettings([{ key: 'customer_required_fields', value: val }, { key: 'customer_bank_fields_enabled', value: 'true' }]).includes('bankName'), true);
});
await t('requiredFieldsFromSettings: אם כל מה שסומן הוא בנק וכבוי -> ברירת המחדל; "none" נשאר ריק', () => {
  assert.deepEqual(R.requiredFieldsFromSettings({ customer_required_fields: 'bankName,bankBranch' }), [...R.DEFAULT_CUSTOMER_REQUIRED_FIELDS]);
  assert.deepEqual(R.requiredFieldsFromSettings({ customer_required_fields: 'none' }), []);
  assert.deepEqual(R.requiredFieldsFromSettings({ customer_required_fields: 'שם_בנק, חשבון, firstName' }), ['firstName']);
  assert.deepEqual(R.requiredFieldsFromSettings(null), [...R.DEFAULT_CUSTOMER_REQUIRED_FIELDS]);
});
await t('requirableFieldsFor: הפיקר בלי שדות בנק כשהם כבויים', () => {
  assert.equal(R.requirableFieldsFor({}).some((f) => R.isBankFieldKey(f.key)), false);
  assert.equal(R.requirableFieldsFor({ customer_bank_fields_enabled: 'true' }).filter((f) => R.isBankFieldKey(f.key)).length, 4);
});
await t('validateCustomerBankFields: סניף/חשבון ספרות, אורכים, ריק תקין, onlyKeys', () => {
  assert.deepEqual(V.validateCustomerBankFields({}), []);
  assert.deepEqual(V.validateCustomerBankFields(BANK), []);
  assert.equal(V.validateCustomerBankFields({ bankBranch: '80a' }).length, 1);
  assert.equal(V.validateCustomerBankFields({ bankBranch: '12345' }).length, 1);
  assert.equal(V.validateCustomerBankFields({ bankAccount: '12-345-678' }).length, 0);
  assert.equal(V.validateCustomerBankFields({ bankAccount: 'AB123' }).length, 1);
  assert.equal(V.validateCustomerBankFields({ bankAccount: '1234567890123' }).length, 1);
  assert.equal(V.validateCustomerBankFields({ bankName: 'x'.repeat(61) }).length, 1);
  assert.equal(V.validateCustomerBankFields({ bankAccountName: 'x'.repeat(81) }).length, 1);
  assert.deepEqual(V.validateCustomerBankFields({ bankAccount: 'AB123', bankBranch: '1' }, ['bankBranch']), []);
});
await t('validateForSave: כבוי - בנק חסר לא חוסם גם עם requiredKeys ישן; פעיל - חובה + תבנית', () => {
  const s = { mandatory_field_groups: '[]' };
  const staleKeys = ['firstName', 'lastName', 'phone1', 'bankName'];
  const c = { firstName: 'ר', lastName: 'כ', phone1: '0501234567' };
  assert.equal(C.validateForSave(c, { requiredKeys: R.requiredFieldsFromSettings({ ...s, customer_required_fields: staleKeys.join(',') }), isNew: true, settings: s }).ok, true);
  const on = { ...s, customer_bank_fields_enabled: 'true', customer_required_fields: staleKeys.join(',') };
  const v = C.validateForSave(c, { requiredKeys: R.requiredFieldsFromSettings(on), isNew: true, settings: on });
  assert.equal(v.ok, false);
  assert.equal(v.field, 'bankName');
  const bad = C.validateForSave({ ...c, ...BANK, bankBranch: 'x' }, { requiredKeys: [], isNew: true, settings: on });
  assert.equal(bad.ok, false);
  assert.equal(bad.field, 'bankBranch');
});
await t('validateForSave בעריכה: בודק תבנית רק לשדות בנק שהשתנו (ערך ישן לא תקין לא חוסם)', () => {
  const on = { customer_bank_fields_enabled: 'true' };
  const saved = { firstName: 'ר', lastName: 'כ', phone1: '0501234567', bankAccount: 'IL-old' };
  const same = C.validateForSave({ ...saved, notes: 'x' }, { requiredKeys: [], isNew: false, settings: on, saved });
  assert.equal(same.ok, true);
  const changed = C.validateForSave({ ...saved, bankAccount: 'IL-new' }, { requiredKeys: [], isNew: false, settings: on, saved });
  assert.equal(changed.ok, false);
});
await t('buildNewCustomerPayload: bankEnabled===false מסיר שדות בנק; אחרת ללא שינוי', () => {
  const c = { ...BASE, ...BANK };
  const off = C.buildNewCustomerPayload(c, { bankEnabled: false });
  for (const k of R.CUSTOMER_BANK_FIELD_KEYS) assert.equal(k in off, false);
  assert.deepEqual(C.buildNewCustomerPayload(c), C.buildSavePayload(c));
  assert.deepEqual(C.buildNewCustomerPayload(c, { bankEnabled: true }), C.buildSavePayload(c));
});

console.log('B. routes (mocked)');
await t('POST כבוי (ברירת מחדל, בלי שורת הגדרה): שדה בנק מסומן כחובה לא חוסם יצירה, ושדות הבנק לא נשמרים', async () => {
  reset({ customer_required_fields: 'firstName,lastName,phone1,bankName,bankAccount', mandatory_field_groups: '[]' });
  const res = await postRoute.POST({ json: async () => ({ ...BASE, ...BANK }) });
  assert.equal(res.status, 200, JSON.stringify(res.__json));
  assert.equal(globalThis.__CC.created.length, 1);
  for (const k of R.CUSTOMER_BANK_FIELD_KEYS) assert.equal(k in globalThis.__CC.created[0], false, k);
});
await t('POST כבוי מפורש (false): גם אותו דבר', async () => {
  reset({ customer_bank_fields_enabled: 'false', customer_required_fields: 'bankName', mandatory_field_groups: '[]' });
  const res = await postRoute.POST({ json: async () => ({ ...BASE, ...BANK }) });
  assert.equal(res.status, 200);
  assert.equal('bankName' in globalThis.__CC.created[0], false);
});
await t('POST פעיל: שדות הבנק נשמרים (מקוצצים), ריק הופך ל-null', async () => {
  reset({ customer_bank_fields_enabled: 'true', mandatory_field_groups: '[]' });
  const res = await postRoute.POST({ json: async () => ({ ...BASE, bankName: ' לאומי ', bankBranch: '800', bankAccount: '', bankAccountName: undefined }) });
  assert.equal(res.status, 200, JSON.stringify(res.__json));
  const d = globalThis.__CC.created[0];
  assert.deepEqual([d.bankName, d.bankBranch, d.bankAccount, d.bankAccountName], ['לאומי', '800', null, null]);
});
await t('POST פעיל + שדה בנק חובה חסר -> 400 עם הודעה בעברית; עם ערך -> נוצר', async () => {
  reset({ customer_bank_fields_enabled: 'true', customer_required_fields: 'firstName,lastName,phone1,bankName', mandatory_field_groups: '[]' });
  const bad = await postRoute.POST({ json: async () => ({ ...BASE }) });
  assert.equal(bad.status, 400);
  assert.match(bad.__json.error, /שם בנק חובה/);
  assert.equal(globalThis.__CC.created.length, 0);
  const ok = await postRoute.POST({ json: async () => ({ ...BASE, ...BANK }) });
  assert.equal(ok.status, 200);
});
await t('POST פעיל: סניף לא ספרתי / חשבון עם אותיות -> 400', async () => {
  reset({ customer_bank_fields_enabled: 'true', mandatory_field_groups: '[]' });
  const a = await postRoute.POST({ json: async () => ({ ...BASE, bankBranch: 'abc' }) });
  assert.equal(a.status, 400);
  assert.match(a.__json.error, /הסניף/);
  const b = await postRoute.POST({ json: async () => ({ ...BASE, bankAccount: '12ab' }) });
  assert.equal(b.status, 400);
  assert.equal(globalThis.__CC.created.length, 0);
});
await t('POST פעיל אבל בלי cardVariant (טופס ישן / הזמנה): חובה לא נאכף', async () => {
  reset({ customer_bank_fields_enabled: 'true', customer_required_fields: 'bankName', mandatory_field_groups: '[]' });
  const { cardVariant, ...legacy } = BASE;
  const res = await postRoute.POST({ json: async () => ({ ...legacy }) });
  assert.equal(res.status, 200);
});
const OLD = { id: 'c1', firstName: 'רחל', lastName: 'כהן', phone1: '0501234567', email: 'r@example.com', bankName: 'ישן', bankBranch: '1', bankAccount: 'IL-old', bankAccountName: null, isDeleted: false };
const put = (body) => putRoute.PUT({ json: async () => body }, { params: Promise.resolve({ id: 'c1' }) });
await t('PUT כבוי: שדות בנק בגוף לא נכתבים; ערך קיים נשאר; שדה בנק חובה לא חוסם', async () => {
  reset({ customer_required_fields: 'firstName,lastName,phone1,bankName', mandatory_field_groups: '[]' }, [{ ...OLD }]);
  const res = await put({ ...OLD, ...BASE, notes: 'חדש', ...BANK, bankName: '' });
  assert.equal(res.status, 200, JSON.stringify(res.__json));
  const { data } = globalThis.__CC.updated[0];
  assert.equal(data.notes, 'חדש');
  for (const k of R.CUSTOMER_BANK_FIELD_KEYS) assert.equal(k in data, false, k);
  const audit = globalThis.__CC.updated[0].__audit;
  assert.equal(Object.keys(audit.changes).some((k) => R.isBankFieldKey(k)), false);
});
await t('PUT פעיל: שדות בנק נכתבים ונרשמים בשינויים', async () => {
  reset({ customer_bank_fields_enabled: 'true', mandatory_field_groups: '[]' }, [{ ...OLD }]);
  const res = await put({ ...OLD, ...BASE, bankName: 'פועלים', bankBranch: '600', bankAccount: '555555', bankAccountName: 'רחל' });
  assert.equal(res.status, 200, JSON.stringify(res.__json));
  const u = globalThis.__CC.updated[0];
  assert.equal(u.data.bankName, 'פועלים');
  assert.deepEqual(Object.keys(u.__audit.changes).filter((k) => R.isBankFieldKey(k)).sort(), ['bankAccount', 'bankAccountName', 'bankBranch', 'bankName']);
});
await t('PUT פעיל: ערך ישן לא תקין שלא השתנה לא חוסם; ערך חדש לא תקין חוסם', async () => {
  reset({ customer_bank_fields_enabled: 'true', mandatory_field_groups: '[]' }, [{ ...OLD }]);
  const ok = await put({ ...OLD, ...BASE, notes: 'x' });
  assert.equal(ok.status, 200, JSON.stringify(ok.__json));
  const bad = await put({ ...OLD, ...BASE, bankAccount: 'IL-new' });
  assert.equal(bad.status, 400);
  assert.match(bad.__json.error, /החשבון/);
});
await t('PUT פעיל + שדה בנק חובה (a5): ריק חוסם', async () => {
  reset({ customer_bank_fields_enabled: 'true', customer_required_fields: 'firstName,lastName,phone1,bankAccountName', mandatory_field_groups: '[]' }, [{ ...OLD }]);
  const res = await put({ ...OLD, ...BASE });
  assert.equal(res.status, 400);
  assert.match(res.__json.error, /שם בעל החשבון חובה/);
});

const { cardVariant: _cv, ...LEGACY_BASE } = BASE;
await t('PUT של הכרטיס הישן (בלי cardVariant), ההגדרה חסרה: שדות בנק נשמרים כמו תמיד (רגרסיה B1)', async () => {
  reset({ mandatory_field_groups: '[]' }, [{ ...OLD }]);
  const res = await put({ ...OLD, ...LEGACY_BASE, bankName: 'פועלים', bankBranch: '600', bankAccount: '555555', bankAccountName: 'רחל' });
  assert.equal(res.status, 200, JSON.stringify(res.__json));
  const u = globalThis.__CC.updated[0];
  assert.deepEqual([u.data.bankName, u.data.bankBranch, u.data.bankAccount, u.data.bankAccountName], ['פועלים', '600', '555555', 'רחל']);
  assert.equal(Object.keys(u.__audit.changes).filter((k) => R.isBankFieldKey(k)).length, 4);
});
await t('PUT של הכרטיס הישן, ההגדרה כבויה במפורש: שדות בנק נשמרים; ההגדרה פעילה: אין ולידציית תבנית חדשה', async () => {
  reset({ customer_bank_fields_enabled: 'false', mandatory_field_groups: '[]' }, [{ ...OLD }]);
  const off = await put({ ...OLD, ...LEGACY_BASE, bankName: 'פועלים' });
  assert.equal(off.status, 200);
  assert.equal(globalThis.__CC.updated[0].data.bankName, 'פועלים');
  reset({ customer_bank_fields_enabled: 'true', mandatory_field_groups: '[]' }, [{ ...OLD }]);
  const on = await put({ ...OLD, ...LEGACY_BASE, bankAccount: 'IL-new', bankBranch: 'abc' });
  assert.equal(on.status, 200, JSON.stringify(on.__json));
  assert.equal(globalThis.__CC.updated[0].data.bankAccount, 'IL-new');
});
await t('PUT של הכרטיס החדש (a5), ההגדרה חסרה: שדות הבנק מוסרים מהכתיבה', async () => {
  reset({ mandatory_field_groups: '[]' }, [{ ...OLD }]);
  const res = await put({ ...OLD, ...BASE, bankName: 'פועלים' });
  assert.equal(res.status, 200);
  assert.equal('bankName' in globalThis.__CC.updated[0].data, false);
});
await t('קריאת ההגדרות נכשלה (fail-open): PUT לא מסיר ולא בודק שדות בנק (a5 וישן), POST שומר מה שנשלח', async () => {
  reset({}, [{ ...OLD }], true);
  const a5 = await put({ ...OLD, ...BASE, bankName: 'פועלים', bankAccount: 'IL-new' });
  assert.equal(a5.status, 200, JSON.stringify(a5.__json));
  assert.equal(globalThis.__CC.updated[0].data.bankName, 'פועלים');
  assert.equal(globalThis.__CC.updated[0].data.bankAccount, 'IL-new');
  reset({}, [{ ...OLD }], true);
  const legacy = await put({ ...OLD, ...LEGACY_BASE, bankName: 'פועלים' });
  assert.equal(legacy.status, 200);
  assert.equal(globalThis.__CC.updated[0].data.bankName, 'פועלים');
  reset({}, [], true);
  const post = await postRoute.POST({ json: async () => ({ ...BASE, ...BANK }) });
  assert.equal(post.status, 200, JSON.stringify(post.__json));
  assert.equal(globalThis.__CC.created[0].bankName, 'לאומי');
});

console.log('C. static');
await t('טופס לקוח חדש: כרטיס בנק רק תחת bankEnabled, והגוף נבנה עם bankEnabled', () => {
  const s = code(read('app/components/customer-card/NewCustomerA5.js'));
  assert.match(s, /customerBankFieldsEnabled\(settings\)/);
  assert.match(s, /\{bankEnabled \? \(/);
  assert.match(s, /buildNewCustomerPayload\(c, \{ bankEnabled \}\)/);
  for (const k of R.CUSTOMER_BANK_FIELD_KEYS) assert.match(s, new RegExp(`field="${k}"`));
});
await t('כרטיס לקוח: לשונית הפרטים והתשלומים מסתירות את הבנק כשכבוי', () => {
  assert.match(code(read('app/components/customer-card/tabs/CcDetailsTab.js')), /const bankCard = !cc\.bankEnabled \? null :/);
  assert.match(code(read('app/components/customer-card/tabs/CcPaymentsTab.js')), /\{cc\.bankEnabled \? \(/);
  assert.match(code(read('app/components/customer-card/useCustomerCard.js')), /bankEnabled = customerBankFieldsEnabled\(settings\)/);
});
await t('שרת: POST/PUT קוראים את ההגדרה ולא כותבים בנק כשכבוי', () => {
  const post = code(read('app/api/customers/route.js'));
  assert.match(post, /bankOn = customerBankFieldsEnabled\(sMap\)/);
  assert.match(post, /\.\.\.\(bankOn !== false \? /);
  const put2 = code(read('app/api/customers/[id]/route.js'));
  assert.match(put2, /if \(bankOn === false && body\.cardVariant === 'a5'\) for \(const k of CUSTOMER_BANK_FIELD_KEYS\) delete data\[k\]/);
  assert.match(put2, /bankOn === true && body\.cardVariant === 'a5'/);
});
await t('הגדרות: מטא-דאטה (שם, הערה, סדר, בוליאני), סימולטור וסקריפט seed (ברירת מחדל כבוי בשני הגמחים)', async () => {
  const M = await L('lib/settingsMetadata.js');
  const K = 'customer_bank_fields_enabled';
  assert.ok(M.SETTINGS_HEBREW_NAMES[K] && M.SETTINGS_HEBREW_NOTES[K]);
  assert.ok(M.SETTINGS_BOOLEAN_KEYS.includes(K));
  assert.ok(Object.values(M.SETTINGS_ORDER).some((l) => l.includes(K)));
  const SL = await L('lib/settingsSimLayout.js');
  assert.ok(SL.SECTIONS.some((s) => s.keys.includes(K)));
  assert.ok(SL.KEY_UI[K]);
  const seed = read('scripts/seed_customer_bank_fields_enabled_setting.js');
  assert.match(seed, /1: \{ value: 'false', overwrite: false \}, 2: \{ value: 'false', overwrite: false \}/);
});
await t('פיקר ההגדרות: כבוי -> בלי שדות בנק + הערה בעברית; מבוסס על מצב ההגדרה (כולל שינוי שלא נשמר)', () => {
  const s = read('app/admin/settings/SettingsClient.js');
  assert.match(s, /CUSTOMER_CARD_REQUIRED_PICKER_FIELDS_NO_BANK/);
  assert.match(s, /fieldList=\{bankFieldsOn \? CUSTOMER_CARD_REQUIRED_PICKER_FIELDS : CUSTOMER_CARD_REQUIRED_PICKER_FIELDS_NO_BANK\}/);
  assert.match(s, /modified\[CUSTOMER_BANK_FIELDS_ENABLED_KEY\]/);
  assert.match(s, /שדות הבנק .* מוסתרים כאן/);
});

console.log(`\nbank-fields: ${passed} passed, ${failed} failed`);
