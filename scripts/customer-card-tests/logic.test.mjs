// לוגיקה טהורה של כרטיס הלקוח החדש: שדות חובה מההגדרות, רשימת שינויים / ביטול, הערות אוטומטיות, נוסחת החוב, חתימה נגזרת,
// סמני לשוניות, מסנן מאשרים, חוזה אירועי הלקוח (W0 לישות Customer) ומיפוי האירועים בהיסטוריה.
// הרצה: node scripts/customer-card-tests/logic.test.mjs   (בלי DB, בלי דפדפן)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseRequiredFields, requiredFieldsFromSettings, missingRequiredFields, requiredFieldErrors, serializeRequiredFields, DEFAULT_CUSTOMER_REQUIRED_FIELDS,
} from '../../lib/customerRequiredFields.js';
import {
  computeChanges, undoField, splitNotes, joinNotes, accountSummary, openCharges, paymentRows, signatureState, tabMarkers, filterApprovers,
  validateForSave, isStarred, mailDocuments, histVisible, histCats, sortOrders, manualPaymentMethods, displayName,
} from '../../app/components/customer-card/customerCardLogic.js';
import {
  parseCustomerEventRequest, buildCustomerEventRow, buildCustomerApprovalMeta, describeCustomerEvent, cleanText,
} from '../../lib/history/customerEvents.js';
import { mapCustomerAuditRow } from '../../lib/history/customerHistory.js';

let passed = 0;
let failed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; } };

// ---------- שדות חובה ----------
t('customer_required_fields: ברירת מחדל = שם פרטי, שם משפחה, טלפון (מה שחובה היום)', () => {
  for (const v of [undefined, null, '', '   ', 'זבל,לא,מוכר']) assert.deepEqual(parseRequiredFields(v), ['firstName', 'lastName', 'phone1']);
  assert.deepEqual([...DEFAULT_CUSTOMER_REQUIRED_FIELDS], ['firstName', 'lastName', 'phone1']);
});
t('customer_required_fields: מפתחות, כינויים עבריים, JSON, none', () => {
  assert.deepEqual(parseRequiredFields('email,firstName'), ['firstName', 'email']);
  assert.deepEqual(parseRequiredFields('שם_פרטי, טלפון_1, עיר, ת"ז'), ['firstName', 'phone1', 'city', 'zeout']);
  assert.deepEqual(parseRequiredFields('["street","houseNum"]'), ['street', 'houseNum']);
  assert.deepEqual(parseRequiredFields('none'), []);
  assert.deepEqual(parseRequiredFields('[]'), []);
  assert.equal(serializeRequiredFields([]), 'none');
  assert.equal(serializeRequiredFields(['phone1', 'firstName']), 'firstName,phone1');
});
t('customer_required_fields: מהגדרות (מערך / מפה / Map) והודעות "X חובה"', () => {
  assert.deepEqual(requiredFieldsFromSettings([{ key: 'customer_required_fields', value: 'email' }]), ['email']);
  assert.deepEqual(requiredFieldsFromSettings({ customer_required_fields: 'city' }), ['city']);
  assert.deepEqual(requiredFieldsFromSettings(new Map([['customer_required_fields', 'zeout']])), ['zeout']);
  assert.deepEqual(requiredFieldsFromSettings([]), ['firstName', 'lastName', 'phone1']);
  assert.deepEqual(missingRequiredFields({ firstName: ' ', lastName: 'x', phone1: 0 }, ['firstName', 'lastName', 'phone1']), ['firstName']);
  assert.deepEqual(requiredFieldErrors({}, ['firstName', 'email']), ['שם פרטי חובה', 'מייל חובה']);
});
t('validateForSave: חובה + תבנית; לקוח חדש מוסיף את כללי היצירה הקיימים', () => {
  const ok = validateForSave({ firstName: 'א', lastName: 'ב', phone1: '0501234567' }, { requiredKeys: ['firstName', 'lastName', 'phone1'] });
  assert.equal(ok.ok, true);
  const bad = validateForSave({ firstName: 'א', lastName: '', phone1: '12', email: 'x@' }, { requiredKeys: ['firstName', 'lastName', 'phone1'] });
  assert.equal(bad.ok, false);
  assert.equal(bad.field, 'lastName');
  assert.ok(bad.errors.some((e) => e.includes('הטלפון הראשי')));
  const nw = validateForSave({ firstName: 'א', lastName: 'ב', phone1: '0501234567' }, { requiredKeys: [], isNew: true, settings: { require_full_address: 'true', require_customer_id_number: 'true' } });
  assert.equal(nw.ok, false);
  assert.ok(nw.errors.some((e) => e.includes('עיר') && e.includes('תעודת זהות')));
  assert.ok(nw.errors.some((e) => e.includes('אחד מבין')), 'ברירת המחדל של mandatory_field_groups (טלפון נוסף / אימייל)');
  assert.equal(isStarred('email', {}, { requiredKeys: [], isNew: true, settings: {} }), true);
  assert.equal(isStarred('email', {}, { requiredKeys: [], isNew: false, settings: { require_customer_email: 'true' } }), false, 'require_* חל רק על יצירה');
});

// ---------- שינויים ----------
const SAVED = { firstName: 'מרים', lastName: 'א', phone1: '0501234567', houseNum: 14, notes: 'א', marketingConsent: false, bankName: null, orders: [] };
t('computeChanges: רק שדות שבאמת השתנו (14 ≡ "14", null ≡ ""), בסדר הקבוע', () => {
  assert.deepEqual(computeChanges(SAVED, { ...SAVED, houseNum: '14', bankName: '' }), []);
  const ch = computeChanges(SAVED, { ...SAVED, phone1: '0509999999', marketingConsent: true, bankName: 'לאומי' });
  assert.deepEqual(ch.map((c) => c.key), ['f:phone1', 'f:marketingConsent', 'f:bankName']);
  assert.equal(ch[1].verb, 'סומן');
  assert.equal(ch[0].note, '0501234567 ← 0509999999');
  assert.equal(ch[2].cat, 'pay');
});
t('undoField מחזיר רק את השדה הזה לערך השמור', () => {
  const cur = { ...SAVED, phone1: 'x', notes: 'y' };
  const u = undoField(cur, SAVED, 'phone1');
  assert.equal(u.phone1, SAVED.phone1);
  assert.equal(u.notes, 'y');
});
t('הערות: שורות אוטומטיות מוגנות - הטקסט הידני נערך, האוטומטיות נשארות; בלי שינוי = אותו טקסט בדיוק', () => {
  const notes = 'שורה 1\n[16.9.2026] אוטומטי: שמלה 45123 (הזמנה 777) חזרה לא תקינה\nשורה 2';
  const s = splitNotes(notes);
  assert.equal(s.manual, 'שורה 1\nשורה 2');
  assert.equal(s.auto.length, 1);
  assert.equal(s.auto[0].orderId, 777);
  assert.equal(joinNotes(notes, 'שורה 1\nשורה 2'), notes, 'ללא שינוי - המקור כמו שהוא');
  assert.equal(joinNotes(notes, 'חדש'), 'חדש\n[16.9.2026] אוטומטי: שמלה 45123 (הזמנה 777) חזרה לא תקינה');
  assert.equal(joinNotes(notes, ''), '[16.9.2026] אוטומטי: שמלה 45123 (הזמנה 777) חזרה לא תקינה', 'מחיקת הטקסט הידני לא מוחקת אוטומטיות');
  assert.equal(joinNotes(null, 'א'), 'א');
});

// ---------- כספים ----------
const ord = (orderId, required, paid, extra = {}) => ({ id: `o${orderId}`, orderId, obligations: [{ amount: required, isDeleted: false }], payments: paid ? [{ id: `p${orderId}`, amount: paid, isDeleted: false, paymentDate: '2026-01-0' + (orderId % 9 + 1) + 'T10:00:00Z', paymentMethod: 'מזומן' }] : [], ...extra });
const CUST = { orders: [ord(1, 530, 380, { eventDate: '2026-10-08' }), ord(2, 240, 240, { eventDate: '2026-06-18' }), ord(3, 40, 40, { isDeleted: true, eventDate: '2024-12-02' })] };
t('נוסחת החוב כמו הכרטיס הישן: חיובים − (תשלומים − זיכויים); זיכוי משפיע על היתרה (J3 ב\')', () => {
  const a = accountSummary(CUST, []);
  assert.deepEqual([a.required, a.paid, a.refunds, a.balance], [810, 660, 0, 150]);
  const b = accountSummary(CUST, [{ amount: 100, orderId: 2 }]);
  assert.equal(b.balance, 250);
  assert.equal(accountSummary({ orders: [] }, []).pct, 100);
});
t('חיובים פתוחים: רק הזמנות לא מחוקות עם יתרה; תשלומים + זיכויים ממוזגים וממוינים מהחדש', () => {
  const oc = openCharges(CUST, []);
  assert.deepEqual(oc.map((x) => [x.order.orderId, x.due]), [[1, 150]]);
  const rows = paymentRows(CUST, [{ id: 'r', amount: 20, createdAt: '2027-01-01T00:00:00Z', reason: 'החזר' }]);
  assert.equal(rows[0].entryType, 'refund');
  assert.equal(rows.length, 4);
});
t('חתימה נגזרת מההזמנות עד שתהיה עמודה ברמת לקוח', () => {
  assert.equal(signatureState(CUST).signed, false);
  const s = signatureState({ orders: [ord(5, 1, 0, { hasSignedRegulations: true, eventDate: '2026-01-01' })] });
  assert.deepEqual([s.signed, s.orderId, s.derived], [true, 5, true]);
});
t('סמני לשוניות: חסר / יש חוב / יש זיכוי', () => {
  assert.deepEqual(tabMarkers({ customer: { firstName: 'א', lastName: '', phone1: '1' }, requiredKeys: ['firstName', 'lastName'], balance: 0 }).details.tip, 'חסר: שם משפחה');
  assert.equal(tabMarkers({ customer: {}, requiredKeys: [], balance: 10 }).payments.tip, 'יש חוב');
  assert.equal(tabMarkers({ customer: {}, requiredKeys: [], balance: -1 }).payments.cls, 'cred');
  assert.deepEqual(tabMarkers({ customer: {}, requiredKeys: [], balance: 0 }), {});
});
t('מסנן מאשרים: רק מי שיש לו את ההרשאה המבוקשת (PG1)', () => {
  const emps = [{ id: 1, roleId: 1, approvals: { 'feature:customer_email_approval': true } }, { id: 2, roleId: 3, approvals: {} }, { id: 3, roleId: 0, isActive: false, approvals: { 'feature:customer_email_approval': true } }];
  assert.deepEqual(filterApprovers(emps, 'feature:customer_email_approval').map((e) => e.id), [1]);
  assert.deepEqual(filterApprovers(emps, 'מנהל').map((e) => e.id), [1]);
  assert.deepEqual(filterApprovers(emps, 'הנהלה ראשית'), []);
});
t('אופני תשלום ידני = כמו "תשלום נוסף" בכרטיס ההזמנה (בלי אשראי)', () => {
  assert.deepEqual(manualPaymentMethods({}), ['מזומן', 'העברה בנקאית', "צ'ק"]);
  assert.deepEqual(manualPaymentMethods({ ALLOWED_PAYMENT_METHODS: 'אשראי, מזומן ,ביט' }), ['מזומן', 'ביט']);
  assert.deepEqual(manualPaymentMethods({ ALLOWED_PAYMENT_METHODS: 'אשראי' }), ['מזומן']);
});
t('מסמכי מייל: כרטיס לקוחה + דף חשבון + דף פרטי קשר (CC-O9) + סיכומי הזמנות לא מחוקות (עד 6), דרך /api/pdf במצב path', () => {
  const docs = mailDocuments({ id: 'abc', firstName: 'א', lastName: 'ב', orders: CUST.orders });
  assert.deepEqual(docs.map((d) => d.id), ['card', 'account', 'contact', 'order-1', 'order-2']);
  assert.ok(docs.every((d) => /downloadPdf=true/.test(d.path)));
  assert.equal(displayName({ firstName: 'null', lastName: 'כהן' }), 'כהן');
});
t('מיון הזמנות כמו בכרטיס הישן (לפי אירוע, אירוע חול לפי מתאריך)', () => {
  const list = sortOrders([{ orderId: 1, eventDate: '2025-01-01' }, { orderId: 2, isWeekdayEvent: true, fromDate: '2026-01-01', eventDate: '2020-01-01' }, { orderId: 3, eventDate: '2025-06-01' }]);
  assert.deepEqual(list.map((o) => o.orderId), [2, 3, 1]);
});
t('היסטוריה: סינון קטגוריות (כולל הדפסות/מיילים לפי אייקון) וחיפוש מילים', () => {
  const E = [{ id: 1, category: 'docs', icon: 'print', title: 'הודפס כרטיס', actor: { name: 'רחל' } }, { id: 2, category: 'cust', icon: 'phone', title: 'עודכן טלפון', actor: { name: 'דוד' }, from: '1', to: '2' }];
  assert.deepEqual(histVisible(E, ['print']).map((e) => e.id), [1]);
  assert.deepEqual(histVisible(E, [], 'דוד טלפון').map((e) => e.id), [2]);
  assert.ok(histCats(E).some(([k]) => k === 'print'));
  assert.ok(!histCats(E).some(([k]) => k === 'mail'));
});

// ---------- חוזה אירועי הלקוח ----------
t('parseCustomerEventRequest: פעולות מותרות, meta מסונן, EMAIL_SENT שרת-בלבד, clientEventId', () => {
  const ok = parseCustomerEventRequest({ action: 'CUSTOMER_PRINTED', meta: { doc: 'account', junk: 1 } });
  assert.deepEqual([ok.ok, ok.meta], [true, { source: 'card', doc: 'account' }]);
  assert.equal(parseCustomerEventRequest({ action: 'CUSTOMER_PRINTED', meta: {} }).code, 'BAD_META');
  assert.equal(parseCustomerEventRequest({ action: 'EMAIL_SENT' }).code, 'UNKNOWN_ACTION');
  assert.equal(parseCustomerEventRequest({ action: 'NOPE' }).code, 'UNKNOWN_ACTION');
  assert.equal(parseCustomerEventRequest({ action: 'HISTORY_EXPORTED', meta: { format: 'xlsx', rows: 3 }, clientEventId: 'bad id!' }).code, 'BAD_REQUEST');
  assert.equal(parseCustomerEventRequest({ action: 'MANAGER_APPROVAL', meta: { reason: 'x' } }).code, 'BAD_APPROVAL');
  const ap = parseCustomerEventRequest({ action: 'MANAGER_APPROVAL', meta: { reason: 'מחיקה' }, approval: { employeeId: 'e1', pin: 'p', requiredLevel: 'feature:customer_delete_approval' } });
  assert.equal(ap.ok, true);
  assert.equal(ap.approval.pin, 'p');
});
t('שורת האירוע: Customer, בלי PIN, ספרות ארוכות מוסתרות', () => {
  const meta = buildCustomerApprovalMeta({ requiredLevel: 'feature:customer_delete_approval', reason: cleanText('חשבון 12345678 נמחק', 200), approverId: 'e1' });
  const row = buildCustomerEventRow({ customerId: 'c1', action: 'MANAGER_APPROVAL', meta, actorId: 'e9', clientEventId: 'abcdefgh1' });
  assert.equal(row.entityType, 'Customer');
  assert.equal(row.employeeId, 'e9');
  assert.ok(!/pin/i.test(row.changesJson));
  assert.ok(row.changesJson.includes('[מוסתר]'));
  assert.ok(row.changesJson.includes('"clientEventId":"abcdefgh1"'));
});
t('ההיסטוריה ממפה את האירועים (מסמכים) ומציגה את שם המאשר ולא את המזהה', () => {
  const ctx = { customerId: 'c1', actorNames: new Map([['e1', 'שרה לוי'], ['e9', 'דנה']]) };
  const [p] = mapCustomerAuditRow({ id: 'a1', action: 'CUSTOMER_PRINTED', changesJson: JSON.stringify({ doc: 'account', source: 'print-page' }), employeeId: 'e9', createdAt: new Date('2026-10-01T10:00:00Z') }, ctx);
  assert.equal(p.title, 'הודפס דף חשבון');
  assert.equal(p.category, 'docs');
  const [m] = mapCustomerAuditRow({ id: 'a2', action: 'MANAGER_APPROVAL', changesJson: JSON.stringify({ featureKey: 'feature:customer_delete_approval', reason: 'מחיקת כרטיס', approverId: 'e1' }), employeeId: 'e9', createdAt: new Date('2026-10-01T10:00:00Z') }, ctx);
  assert.match(m.detail, /אושר ע״י שרה לוי/);
  assert.ok(!JSON.stringify(m).includes('"e1"'));
  assert.equal(describeCustomerEvent('UNKNOWN', {}), null);
});
t('דרגות האישור בנתיב האירועים זהות לאלה של /api/auth/verify-pin', () => {
  const vp = readFileSync(new URL('../../app/api/auth/verify-pin/route.js', import.meta.url), 'utf8');
  const ev = readFileSync(new URL('../../app/api/customers/[id]/events/route.js', import.meta.url), 'utf8');
  for (const lvl of ['מנהל', 'מתכנת', 'הנהלה ראשית', 'מנהל סניף ומעלה', 'מאשר הזמנה ללא תשלום']) {
    assert.ok(vp.includes(`requiredLevel === '${lvl}'`), `verify-pin ${lvl}`);
    assert.ok(ev.includes(`requiredLevel === '${lvl}'`), `events ${lvl}`);
  }
  assert.ok(ev.includes("feature:debt_approval"));
});

console.log(`\nlogic: ${passed} passed, ${failed} failed`);
