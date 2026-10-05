// שוויון payload-ים: כרטיס הלקוח החדש שולח לשרת אותם גופים כמו הכרטיס הישן, לאותם קלטים.
// שיטה: הביטוי שבונה את הגוף בקוד הישן נשלף מקובץ המקור עצמו (בלי להעתיק אותו לבדיקה) ומורץ על אותם קלטים כמו בונה הגוף של
// הכרטיס החדש (app/components/customer-card/customerCardLogic.js). כך כל שינוי באחד הצדדים שובר את הבדיקה.
//   PUT  /api/customers/[id]   - שמירת פרטים / פרטי בנק        (LegacyCustomerPage.js handleSave)            — זהה + cardVariant:'a5'
//   POST /api/customers        - לקוח חדש                      (LegacyCustomerPage.js, id === 'new')        — זהה + cardVariant:'a5'
//   PATCH /api/customers/[id]  - ביטול חסימה                   (LegacyCustomerPage.js handleUnblockCustomer) — זהה
//   POST /api/payments         - תשלום                         (ModernPaymentsManager.js submitAdditionalPayment) — זהה
//   POST /api/send-email       - מייל                          (ModernSendEmailModal.js handleSubmit)        — זהה
// הרצה: node scripts/customer-card-tests/parity.test.mjs   (בלי DB, בלי דפדפן)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeEmail } from '../../lib/emailUtils.js';
import {
  buildSavePayload, legacySavePayload, buildNewCustomerPayload, newCustomerInitial, unblockPayload, buildPaymentPayload, buildMailPayload, CARD_VARIANT,
} from '../../app/components/customer-card/customerCardLogic.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const LEGACY = read('../../app/customers/[id]/LegacyCustomerPage.js');
const MAIL = read('../../components/customers/modern/ModernSendEmailModal.js');
const PAYM = read('../../components/orders/modern/ModernPaymentsManager.js');

let passed = 0;
let failed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; } };

// שולף את הביטוי המאוזן שמתחיל אחרי anchor (סוגריים / סוגריים מסולסלים), ממקום ה-anchor ה-n
function balanced(src, anchor, open = '(', from = 0) {
  const at = src.indexOf(anchor, from);
  assert.ok(at >= 0, `anchor not found: ${anchor}`);
  const start = src.indexOf(open, at + anchor.length - 1);
  const close = open === '(' ? ')' : '}';
  let d = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) d++;
    else if (src[i] === close) { d--; if (d === 0) return src.slice(start + 1, i); }
  }
  throw new Error('unbalanced');
}
const evalExpr = (expr, scope) => new Function(...Object.keys(scope), `return (${expr});`)(...Object.values(scope));
const withoutVariant = (o) => { const { cardVariant, ...rest } = o; return rest; };

// ---------- קלטים ----------
const ORDERS = [{ id: 'o1', orderId: 51216, payments: [{ id: 'p', amount: 100 }], obligations: [] }];
const CUSTOMERS = [
  { id: 'c1', firstName: 'מרים', lastName: 'אברמוביץ', phone1: '0501234567', phone2: '', email: 'miriam', emailSuffix: null, city: 'ירושלים', street: 'עמוס', houseNum: 14, notes: 'הערה', zeout: '123456782', marketingConsent: true, bankName: 'לאומי', bankBranch: '902', bankAccount: '1234567', bankAccountName: 'מרים', updatedAt: '2026-09-24T10:00:00.000Z', orders: ORDERS },
  { id: 'c2', firstName: 'רחל', lastName: 'כהן', phone1: '0527654321', phone2: '026543210', email: 'rachel@walla', emailSuffix: '', city: '', street: '', houseNum: '', notes: '', zeout: null, marketingConsent: false, bankName: null, bankBranch: null, bankAccount: null, bankAccountName: null, updatedAt: '2026-01-01T00:00:00.000Z', orders: [] },
  { id: 'c3', firstName: 'שרה', lastName: null, phone1: '', phone2: null, email: null, emailSuffix: 'gmail.com', city: null, street: null, houseNum: null, notes: null, marketingConsent: false, orders: [] },
];

// ---------- PUT /api/customers/[id] ----------
const legacySaveExpr = balanced(LEGACY, 'const normalizedCustomer = {', '{');
t('PUT: הביטוי של הכרטיס הישן נשלף (normalizedCustomer = {...customer, email: normalizeEmail(...)})', () => {
  assert.match(legacySaveExpr, /\.\.\.customer/);
  assert.match(legacySaveExpr, /normalizeEmail\(customer\.email, customer\.emailSuffix\)/);
  assert.match(LEGACY, /body: JSON\.stringify\(normalizedCustomer\)/);
});
t('PUT: אותו גוף לאותו לקוח (כל הלקוחות, כולל פרטי בנק) - חוץ מ-cardVariant', () => {
  for (const c of CUSTOMERS) {
    const legacy = evalExpr(`{${legacySaveExpr}}`, { customer: c, normalizeEmail });
    const a5 = buildSavePayload(c);
    assert.equal(a5.cardVariant, CARD_VARIANT);
    assert.deepEqual(withoutVariant(a5), legacy);
    assert.deepEqual(legacySavePayload(c), legacy);
  }
});
t('PUT: אחרי עריכות (מחרוזות מהשדות, בוליאני מהמתג) - עדיין זהה', () => {
  const edited = { ...CUSTOMERS[0], phone1: '0509998877', houseNum: '15', marketingConsent: false, notes: 'הערה חדשה', bankAccount: '7654321' };
  assert.deepEqual(withoutVariant(buildSavePayload(edited)), evalExpr(`{${legacySaveExpr}}`, { customer: edited, normalizeEmail }));
});

// ---------- POST /api/customers ----------
t('POST: אותו אובייקט פתיחה כמו הטופס הישן', () => {
  const init = balanced(LEGACY, "if (id === 'new') {\n      setCustomer(", '(');
  assert.deepEqual(newCustomerInitial(), evalExpr(init, {}));
});
t('POST: אותו גוף ליצירת לקוח (url /api/customers, method POST) - חוץ מ-cardVariant', () => {
  assert.match(LEGACY, /const url = id === 'new' \? '\/api\/customers' : `\/api\/customers\/\$\{id\}`;/);
  const filled = { ...newCustomerInitial(), firstName: 'חנה', lastName: 'לוי', phone1: '0541112233', email: 'hana', zeout: '123456782', marketingConsent: true, houseNum: '7' };
  assert.deepEqual(withoutVariant(buildNewCustomerPayload(filled)), evalExpr(`{${legacySaveExpr}}`, { customer: filled, normalizeEmail }));
});

// ---------- PATCH ביטול חסימה ----------
t('PATCH: ביטול חסימה - אותו גוף', () => {
  const at = LEGACY.indexOf('const handleUnblockCustomer');
  const expr = balanced(LEGACY, 'body: JSON.stringify(', '(', at);
  assert.deepEqual(unblockPayload(), evalExpr(expr, {}));
});

// ---------- POST /api/payments ----------
t('POST /api/payments: אותו גוף כמו "תשלום נוסף" בכרטיס ההזמנה הישן', () => {
  const at = PAYM.indexOf('const submitAdditionalPayment');
  const expr = balanced(PAYM, 'body: JSON.stringify(', '(', at);
  for (const [orderId, amount, method, notes] of [[51216, 150, 'מזומן', ''], [53375, 80.5, "צ'ק", 'צ׳ק 1234'], [1, 20, '', undefined]]) {
    const additionalPaymentData = { paymentMethod: method, notes };
    const legacy = evalExpr(expr, { orderId, amount, additionalPaymentData });
    assert.deepEqual(buildPaymentPayload({ orderId, amount, paymentMethod: method, notes }), legacy);
  }
});

// ---------- POST /api/send-email ----------
t('POST /api/send-email: אותו גוף כמו ModernSendEmailModal (עם ובלי קבצים, כל יעד)', () => {
  const at = MAIL.indexOf("fetch('/api/send-email'");
  const expr = balanced(MAIL, 'body: JSON.stringify(', '(', at);
  const files = [
    { name: 'a.pdf', type: 'application/pdf', size: 1200, b64: 'QUJD' },
    { name: 'b.jpg', type: '', size: 0, b64: 'REVG' },
  ];
  for (const sendMode of ['email', 'drive', 'both']) {
    for (const list of [[], files.slice(0, 1), files]) {
      // הלולאה של הישן: {fileName, fileContent, mimeType: f.type || 'application/octet-stream', sizeBytes: f.size || null, dest: sendMode}
      const attachments = list.map((f) => ({ fileName: f.name, fileContent: f.b64, mimeType: f.type || 'application/octet-stream', sizeBytes: f.size || null, dest: sendMode }));
      const customer = CUSTOMERS[0];
      const authResult = { employeeId: 'e1', pin: 'secret' };
      const legacy = evalExpr(expr, { customer, subject: 'נושא', body: 'גוף', authResult, attachments, sendMode, driveFolderId: sendMode === 'email' ? '' : 'FOLDER' });
      const a5 = buildMailPayload({
        customer, subject: 'נושא', body: 'גוף', sendMode, driveFolderId: sendMode === 'email' ? '' : 'FOLDER', auth: authResult,
        attachments: list.map((f) => ({ fileName: f.name, fileContent: f.b64, mimeType: f.type || 'application/octet-stream', sizeBytes: f.size || null })),
      });
      assert.deepEqual(a5, legacy);
    }
  }
});

console.log(`\nparity: ${passed} passed, ${failed} failed`);
