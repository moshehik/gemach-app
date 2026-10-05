// תשובות הבעלים 4.10.2026 לשאלות הפתוחות של כרטיס הלקוח (CC-O1..CC-O9) - כל בדיקה נשענת על הקוד / ה-CSS בפועל.
// הרצה: node scripts/customer-card-tests/owner-answers.test.mjs   (בלי DB, בלי דפדפן)
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
let failed = 0;
const t = async (name, fn) => { try { await fn(); console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; } };

const CC = 'app/components/customer-card';
const lib = await import('../../lib/customerRequiredFields.js');
const logic = await import('../../app/components/customer-card/customerCardLogic.js');

// ---- CC-O1 (no-op): "שלם ₪" בגמ"ח הראשי פותח את כרטיס ההזמנה; תשלום בתוך הכרטיס רק עם allow_additional_payment_on_order ----
await t('CC-O1: תשלום מהכרטיס רק כש-allow_additional_payment_on_order=true; אחרת עוברים להזמנה', () => {
  const ctl = code(read(`${CC}/useCustomerCard.js`));
  assert.match(ctl, /const paymentsEnabled = settings\.allow_additional_payment_on_order === 'true';/);
  const pay = ctl.slice(ctl.indexOf('const pay = useCallback'));
  const gate = pay.indexOf('if (!paymentsEnabled)');
  assert.ok(gate > 0 && gate < pay.indexOf("fetch('/api/payments'"), 'בדיקת paymentsEnabled חייבת לבוא לפני רישום התשלום');
  assert.match(pay.slice(gate, gate + 300), /router\.push\(`\/orders\/\$\{target\}`\)/);
  for (const f of ['useCustomerCard.js', 'CcDialogs.js', 'CcApproval.js', 'CcRail.js', 'CustomerCardA5.js']) {
    const n = (code(read(`${CC}/${f}`)).match(/\/api\/payments/g) || []).length;
    assert.equal(n, f === 'useCustomerCard.js' ? 1 : 0, f);
  }
});

// ---- CC-O2 + CC-O2b (no-op): מחיקה חסומה לכולם, בלי "מחק בכל זאת" ----
await t('CC-O2/O2b: אין עקיפת מחיקה (לא בכרטיס ולא בשרת), גם לא להנהלה ראשית', () => {
  const files = [`${CC}/CcDialogs.js`, `${CC}/useCustomerCard.js`, `${CC}/CustomerCardA5.js`, `${CC}/CcRail.js`, `${CC}/CcApproval.js`, 'app/api/customers/[id]/route.js', 'lib/customerAccount.js'];
  for (const f of files) {
    const s = read(f);
    assert.ok(!/מחק בכל זאת|deleteAnyway|forceDelete|force:\s*true|ignoreBlockers|overrideBlock/i.test(s), `${f}: נמצאה עקיפת מחיקה`);
  }
  const dlg = code(read(`${CC}/CcDialogs.js`));
  assert.match(dlg, /act="delete-go" disabled=\{blocked\}/, 'לחצן המחיקה חייב להיות מנוטרל כשיש חסימה');
  const route = code(read('app/api/customers/[id]/route.js'));
  const del = route.slice(route.indexOf('export async function DELETE'));
  const idxBlock = del.indexOf('if (b.blocked)');
  assert.ok(idxBlock > 0 && del.indexOf('customer.update') > idxBlock, 'החסימה חייבת לבוא לפני העדכון');
  assert.match(del.slice(idxBlock, idxBlock + 400), /status: 409/);
  assert.ok(!/roleId|isHeadManagement|הנהלה ראשית/.test(del), 'אין ענף מיוחד להנהלה ראשית במחיקה');
});

// ---- CC-O3 (no-op): חלון סיכום לפני כל שמירה ----
await t('CC-O3: חלון הסיכום תמיד (בשמירה ובשמירה-ויציאה), לא מאחורי הגדרה', () => {
  const ctl = code(read(`${CC}/useCustomerCard.js`));
  assert.ok(!/enable_order_edit_summary_confirm/.test(ctl));
  assert.match(ctl, /SummaryDialog, \{ intent: 'save'/);
  assert.match(ctl, /SummaryDialog, \{ intent: 'exit'/);
});

// ---- CC-O4 (no-op): לחצן "השלם ל-@gmail.com" קטן ----
await t('CC-O4: לחצן gmail קטן (32px) ולא לחצן מלא', () => {
  const css = read(`${CC}/customer-card.css`);
  assert.match(css, /\.cc-gmail\{[^}]*height:32px/);
  assert.match(read(`${CC}/CcFields.js`), /data-act="gmail"/);
});

// ---- CC-O5: כוכבית חובה אדומה ----
await t('CC-O5: כוכבית השדה החובה באדום של הפלטה (--gm-rose-700), לא בכחול הישן', () => {
  const css = read(`${CC}/customer-card.css`);
  const m = /\.gm-ds\.gm-cc \.cc-req\{([^}]*)\}/.exec(css);
  assert.ok(m, 'אין כלל .cc-req');
  assert.match(m[1], /color:var\(--gm-rose-700\)/);
  assert.ok(!/#2f4a6b/i.test(m[1]));
  assert.match(read('design-system/tokens.css'), /--gm-rose-700:#a8442a/, 'הטוקן קיים בפלטה');
});

// ---- CC-O6: DDL לא הורץ; הקוד מתנהג יפה בלי העמודות ----
await t('CC-O6: SIGNATURE_COLUMNS_READY=false, בלי נגיעה במודל Customer, וה-SQL תוספתי נקי', () => {
  assert.equal(logic.SIGNATURE_COLUMNS_READY, false);
  const schema = read('prisma/schema.prisma');
  const start = schema.indexOf('model Customer {');
  assert.ok(start > 0);
  const cust = schema.slice(start, schema.indexOf('\n}', start));
  assert.ok(!/regulationsSignedAt|hasSignedRegulations/.test(cust), 'המודל Customer לא נוגעים בו לפני אישור הרצת DDL');
  const buf = readFileSync(new URL('../../prisma/migrations-pending/2026-10-04-customer-signed-regulations.sql', import.meta.url));
  assert.notDeepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM');
  assert.ok(!buf.includes(0x0d), 'CR');
  assert.ok(![...buf].some((b) => b < 0x20 && b !== 0x0a && b !== 0x09), 'תווי בקרה');
  new TextDecoder('utf-8', { fatal: true }).decode(buf);
  const sql = buf.toString('utf8');
  const stmts = sql.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--')).join('\n').split(';').map((x) => x.trim()).filter(Boolean);
  assert.equal(stmts.length, 2);
  for (const s of stmts) assert.match(s, /^ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "(hasSignedRegulations|regulationsSignedAt)" /);
  const all = stmts.join('\n');
  assert.ok(!/\b(DROP|TRUNCATE|DELETE|UPDATE|RENAME|ALTER COLUMN|SET NOT NULL)\b/i.test(all));
  assert.match(all, /"hasSignedRegulations" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(all, /"regulationsSignedAt" TIMESTAMP\(3\)$/m);
});
await t('CC-O6: בלי העמודות החתימה נגזרת מההזמנות, והעמודות החסרות לא נשלחות ב-PUT', () => {
  const orders = [{ orderId: 7, orderDate: '2026-01-02', hasSignedRegulations: true }];
  assert.deepEqual(logic.signatureState({ orders }), { signed: true, at: '2026-01-02', orderId: 7, derived: true });
  assert.equal(logic.signatureState({ orders: [] }).signed, false);
  assert.equal(logic.signatureState(null).signed, false);
  assert.ok(!/hasSignedRegulations|regulationsSignedAt/.test(code(read(`${CC}/useCustomerCard.js`))), 'ה-PUT לא שולח את העמודות');
  assert.ok(!/hasSignedRegulations|regulationsSignedAt/.test(code(read('app/api/customers/[id]/route.js'))), 'השרת לא כותב את העמודות');
});

// ---- CC-O7: ערך ההגדרה לכל ארגון מחושב מהגדרות החובה הקיימות ----
await t('CC-O7: computeCustomerRequiredFieldsFromLegacy - בסיס + require_* + mandatory_fields', () => {
  const f = lib.computeCustomerRequiredFieldsFromLegacy;
  assert.equal(f({}).value, 'firstName,lastName,phone1');
  assert.equal(f({ require_customer_email: 'true' }).value, 'firstName,lastName,phone1,email');
  assert.equal(f({ require_customer_email: 'false' }).value, 'firstName,lastName,phone1');
  assert.equal(f({ require_full_address: 'true' }).value, 'firstName,lastName,phone1,city,street,houseNum');
  assert.equal(f({ require_customer_id_number: 'true' }).value, 'firstName,lastName,phone1,zeout');
  // mandatory_fields = חובה קשיחה רק כש-strict_mandatory_fields='true' (D3 של הסקירה); אחרת רכה ומופיעה ב-soft
  const base = [['require_customer_email', 'true'], ['require_customer_id_number', 'true'], ['mandatory_fields', 'אימייל, עיר,טלפון_1,לא_קיים'], ['mandatory_field_groups', '[["phone2","email"]]']];
  const neve = f(new Map([...base, ['strict_mandatory_fields', 'true']]));
  assert.deepEqual(neve.keys, ['firstName', 'lastName', 'phone1', 'email', 'city', 'zeout']);
  assert.deepEqual(neve.reasons.email, ['require_customer_email', 'mandatory_fields']);
  assert.deepEqual(neve.soft, []);
  assert.deepEqual(lib.parseRequiredFields(neve.value), neve.keys);
  const lax = f(new Map(base)); // strict חסר / כבוי
  assert.deepEqual(lax.keys, ['firstName', 'lastName', 'phone1', 'email', 'zeout'], 'city לא חובה קשיחה בלי strict');
  assert.deepEqual(lax.soft, ['city'], 'city רכה; email כבר קשיחה מ-require_customer_email ולא מופיעה כרכה');
  assert.deepEqual(f(new Map([...base, ['strict_mandatory_fields', 'false']])).keys, lax.keys);
  assert.deepEqual(f({ mandatory_fields: 'שם_משפחה,טלפון_1,טלפון_2' }).soft, ['phone2'], 'שם משפחה וטלפון כבר בבסיס');
});
await t('CC-O7: סקריפט הזריעה קורא בלבד עד --apply, בלי ערך קבוע, וכותב פעם אחת בלבד', () => {
  const c = code(read('scripts/seed_customer_required_fields_setting.js'));
  assert.ok(!/value:\s*'firstName,lastName,phone1'/.test(c), 'נשאר ערך קבוע');
  assert.match(c, /computeCustomerRequiredFieldsFromLegacy/);
  assert.match(c, /require_customer_email/);
  assert.match(c, /require_customer_id_number/);
  assert.match(c, /findMany/);
  assert.equal((c.match(/\.create\(/g) || []).length, 1);
  assert.ok(!/\.(update|upsert|delete|deleteMany|updateMany|createMany|\$executeRaw|\$queryRawUnsafe)\(/.test(c));
  assert.ok(c.indexOf('if (!apply)') < c.indexOf('.create('), 'ה-create חייב לבוא אחרי חסימת ה-dry-run');
  assert.ok(c.indexOf('hostMatches(host, expectHost)') < c.indexOf('new PrismaClient'), 'בדיקת ה-host לפני החיבור');
  const m = createRequire(import.meta.url)('../seed_customer_required_fields_setting.js');
  assert.deepEqual(m.parseArgs(['--org=1']), { org: 1, apply: false, expectHost: null });
  assert.throws(() => m.parseArgs(['--org=1', '--apply']), /expect-host/);
  assert.throws(() => m.parseArgs([]), /--org/);
  assert.ok(!('value' in m.ROW_BASE));
});

// ---- CC-O8: אותו חלון "אין הרשאה" כהה ----
await t('CC-O8: PageGate מקבל fallback, /customers משתמש ב-CustomersGate -> NoAccessCard', () => {
  const pg = code(read('app/components/PageGate.js'));
  assert.match(pg, /fallback \|\| <NoAccessMessage \/>/);
  assert.match(pg, /\{ pageKey, pageKeys, fallback, children \}/);
  const lay = code(read('app/customers/layout.js'));
  assert.match(lay, /<PageGate pageKey="page:customers" fallback=\{<CustomersGate \/>\}>/);
  assert.match(code(read(`${CC}/CustomersGate.js`)), /<NoAccessCard guest=\{!employee\}/);
  for (const f of ['app/components/gate/NoAccessCard.js', 'app/components/gate/gate.css']) assert.ok(existsSync(new URL(`../../${f}`, import.meta.url)), f);
  assert.match(read('app/components/gate/NoAccessCard.js'), /dlg dk gt-card/);
});

// ---- CC-O9: דף פרטי קשר ברשימת הצירוף ----
await t('CC-O9: "דף פרטי קשר" ברשימת המסמכים לצירוף, מצביע על /print/customer?type=contact', () => {
  const docs = logic.mailDocuments({ id: 'u1', firstName: 'א', lastName: 'ב', orders: [] });
  const d = docs.find((x) => x.id === 'contact');
  assert.ok(d, 'חסר');
  assert.equal(d.name, 'דף פרטי קשר');
  assert.match(d.path, /^\/print\/customer\?customerId=u1&type=contact&downloadPdf=true$/);
  assert.match(d.preview, /type=contact&preview=1$/);
  assert.match(read('app/print/customer/page.js'), /TYPES = \['card', 'account', 'contact'\]/);
});

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log('\nowner-answers: all passed');
