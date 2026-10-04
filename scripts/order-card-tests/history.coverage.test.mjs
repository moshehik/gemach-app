// W6 — מטריצת הכיסוי של PLAN §C.6 (H01–H33): לכל פעולה בכרטיס החדש - השורות שהשרת באמת כותב (נבנות כאן דרך פונקציות
// הכתיבה האמיתיות של W0 ב-lib/history/orderEvents.js: diffOrderUpdate, sanitizeEventMeta + buildOrderEventRow, buildApprovalMeta,
// emailEventMeta; ושורות auditAs של ה-routes הקיימים בצורתן) → הממפה (lib/history/orderHistory.js) → מה שהלשונית מציגה.
// לכל H: בדיוק השורות הצפויות, הטקסט העברי, הקטגוריה (+ הסל בסינון, עם ספירות), מי ביצע, ובכל הפיד: אפס unmapped, אפס
// טקסט פעולה גולמי, אפס UUID, אפס תאריך לועזי (גם בשורות הייצוא). רץ ב-3 אזורי זמן (run.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderHistory, publicEntry, KNOWN_ACTIONS, searchEntries, SCHEDULE_MARK_CAT } from '@/lib/history/orderHistory.js';
import { diffOrderUpdate, sanitizeEventMeta, buildOrderEventRow, buildApprovalMeta, emailEventMeta, emailAttachmentSummary, parseEventsRequest } from '@/lib/history/orderEvents.js';
import { inCategory, filterCategories, categoryCount, visibleEntries, exportRows, tableRow } from '@/app/components/order-card/parts/ocHistoryModel.js';

const ORDER_UUID = '0b6e7f1c-2a3d-4e5f-8a9b-0c1d2e3f4a5b';
const ORDER_NO = 53375;
const EMP = { id: '11111111-1111-4111-8111-111111111111', name: 'רחל כהן' };
const MGR = { id: '22222222-2222-4222-8222-222222222222', name: 'שרה לוי' };
const ITEM = '33333333-3333-4333-8333-333333333333';
const ITEM2 = '44444444-4444-4444-8444-444444444444';
const PAY = '55555555-5555-4555-8555-555555555555';
const OBL = '66666666-6666-4666-8666-666666666666';
const REF = '77777777-7777-4777-8777-777777777777';
const MARK = '88888888-8888-4888-8888-888888888888';
const CUST_A = '99999999-9999-4999-8999-999999999999';
const CUST_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

let seq = 0;
const at = (min) => new Date(Date.UTC(2026, 8, 23, 7, 0, 0) + min * 60000); // 23.9.2026 10:00 שעון ישראל + דקות
// a row as the route hands it to the mapper (after attachEmployeeNames: employeeName, approverName inside changesJson)
const row = (over) => ({ id: `r${++seq}`, entityType: 'Order', entityId: ORDER_UUID, action: 'UPDATE', employeeId: EMP.id, employeeName: EMP.name, createdAt: at(seq), changesJson: '{}', ...over });
const named = (changes) => {
  const c = typeof changes === 'string' ? JSON.parse(changes) : { ...changes };
  if (c.approverId) c.approverName = c.approverId === MGR.id ? MGR.name : 'עובד שנמחק';
  return JSON.stringify(c);
};
// UPDATE_ORDER exactly as PUT /api/orders/[id] writes it (W0: auditAs('UPDATE_ORDER', …, diffOrderUpdate(existing, data)))
const putRow = (existing, data, over = {}) => {
  const diff = diffOrderUpdate(existing, data);
  return Object.keys(diff).length ? row({ action: 'UPDATE_ORDER', changesJson: JSON.stringify(diff), ...over }) : null;
};
// a client event exactly as POST /api/orders/events writes it
const eventRow = (action, meta, over = {}) => {
  const m = sanitizeEventMeta(action, meta);
  assert.ok(m.ok, `${action} meta: ${m.error}`);
  const r = buildOrderEventRow({ orderId: ORDER_NO, action, meta: m.meta, actorId: EMP.id, clientEventId: `cid${seq}abcdef` });
  return row({ ...r, id: `r${++seq}`, changesJson: named(r.changesJson), ...over });
};
// verify-pin with context (W0 §1.2): employeeId = who asked, meta.approverId = whose code matched
const approvalRow = (requiredLevel, reason, over = {}) => row({
  entityId: String(ORDER_NO), action: 'MANAGER_APPROVAL', changesJson: named(buildApprovalMeta({ requiredLevel, reason, approverId: MGR.id })), ...over,
});

const ITEMS = [
  { id: ITEM, sizeText: '38', prefix: 4512, modelName: 'רוז', isDeleted: false },
  { id: ITEM2, sizeText: '36', prefix: 3087, modelName: 'ליה', isDeleted: false },
];
function feed(rows, extra = {}, options = {}) {
  return buildOrderHistory({
    order: { orderId: ORDER_NO, id: ORDER_UUID },
    auditRows: rows.filter(Boolean),
    items: ITEMS,
    payments: extra.payments || [],
    refunds: extra.refunds || [],
    obligations: extra.obligations || [],
    emailLogs: extra.emailLogs || [],
    printVisits: extra.printVisits || [],
    customers: extra.customers || [],
  }, options);
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const GREG_RE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|T\d{2}:\d{2}/;
const RAW_ACTION_RE = /\b[A-Z][A-Z_]{3,}\b/;
// what the tab / table / export show of an entry (ts / day are sort keys only, never displayed)
const shown = (e) => [e.text, e.sub || '', e.who || '', e.dateHe, e.weekdayHe, e.time, ...(e.det || []).flat().map(String)];

function assertClean(r, label) {
  assert.equal(r.unmappedCount, 0, `${label}: unmapped`);
  for (const e of r.entries) {
    const pub = publicEntry(e);
    assert.ok(!UUID_RE.test(JSON.stringify({ ...pub, id: '' })), `${label}: UUID in ${JSON.stringify(pub)}`);
    for (const s of shown(e)) {
      assert.ok(!GREG_RE.test(s), `${label}: Gregorian date in "${s}"`);
      assert.ok(!RAW_ACTION_RE.test(s), `${label}: raw action text in "${s}"`);
    }
    assert.ok(e.dateHe && /[א-ת]/.test(e.dateHe), `${label}: Hebrew date`);
    assert.match(e.time, /^\d{2}:\d{2}$/);
    for (const v of Object.values(tableRow(e))) if (v !== e.ts) assert.ok(!GREG_RE.test(String(v)), `${label}: table "${v}"`);
  }
  for (const x of exportRows(r.entries)) for (const v of Object.values(x)) assert.ok(!GREG_RE.test(String(v)) && !UUID_RE.test(String(v)), `${label}: export "${v}"`);
}
const one = (r, text, label) => {
  const hits = r.entries.filter((e) => (text instanceof RegExp ? text.test(e.text) : e.text === text));
  assert.equal(hits.length, 1, `${label}: expected exactly one "${text}", got [${r.entries.map((e) => e.text).join(' | ')}]`);
  return hits[0];
};
// the category of the line and the filter bucket it lands in, with the counts the filter menu shows
function assertBucket(r, e, cat, extra) {
  assert.equal(e.cat, cat, `category of "${e.text}"`);
  assert.ok(inCategory(e, cat));
  assert.equal(categoryCount(r.entries, cat), r.counts.categories[cat], `count ${cat}`);
  assert.equal(categoryCount(r.entries, 'all'), r.counts.all);
  if (extra) {
    assert.ok(inCategory(e, extra), `"${e.text}" in the ${extra} bucket`);
    assert.ok(filterCategories(r.entries).some((c) => c[0] === extra), `${extra} offered in the filter`);
    assert.equal(categoryCount(r.entries, extra), r.counts.extras[extra]);
    assert.ok(visibleEntries(r.entries, { selected: [extra] }).includes(e));
  }
  assert.ok(visibleEntries(r.entries, { selected: [cat] }).includes(e));
}
const det = (e, k) => (e.det.find((d) => d[0] === k) || [])[1];

const EXISTING = {
  eventDate: new Date('2026-10-07T21:00:00.000Z'), eventDateHebrew: 'כו תשרי תשפ"ז', isAbroad: false, isWeekdayEvent: false, fromDate: null, toDate: null,
  notes: 'ניילון', internalNotes: '', customSpacing: null, extraDay: null, isDelivery: false, deliveryDirection: null, deliveryCity: null,
  deliveryAddress: null, deliveryOneDayBefore: false, customerId: CUST_A, hasSignedRegulations: false, totalAmount: 530,
};

const H = {}; // H id -> rows (and extras) - reused by the all-in-one test at the end

test('H01 שינוי תאריך אירוע: dates · "עודכן תאריך האירוע" לפני ← אחרי עבריים, מבצע', () => {
  H.h01 = [putRow(EXISTING, { eventDate: new Date('2026-10-14T21:00:00.000Z'), eventDateHebrew: 'ג חשון תשפ"ז' })];
  const r = feed(H.h01);
  assertClean(r, 'H01');
  const e = one(r, 'עודכן תאריך האירוע', 'H01');
  assertBucket(r, e, 'dates');
  assert.equal(e.who, EMP.name);
  assert.ok(/תשרי/.test(det(e, 'לפני')) && /חשו?ון/.test(det(e, 'אחרי')), JSON.stringify(e.det));
  assert.equal(e.beforeSource, 'explicit');
  assert.equal(r.entries.length, 1, 'eventDateHebrew is not a second line');
});

test('H02 חו״ל + טווח / אמצע שבוע: dates · סוג אירוע + טווח', () => {
  H.h02 = [
    putRow(EXISTING, { isAbroad: true, fromDate: new Date('2026-10-12T21:00:00Z'), toDate: new Date('2026-10-19T21:00:00Z') }),
    putRow({ ...EXISTING, isAbroad: true }, { isAbroad: false, isWeekdayEvent: true }),
  ];
  const r = feed(H.h02);
  assertClean(r, 'H02');
  assertBucket(r, one(r, 'האירוע סומן חו״ל', 'H02'), 'dates');
  const range = one(r, 'עודכן טווח התאריכים', 'H02');
  assert.ok(/←/.test(det(range, 'מתאריך')) && /חשו?ון/.test(det(range, 'עד תאריך')));
  assertBucket(r, one(r, 'האירוע סומן כאירוע חול', 'H02'), 'dates');
});

test('H03 הערות / הערות פנימיות: gen (כללי)', () => {
  H.h03 = [putRow(EXISTING, { notes: 'ניילון + קולב', internalNotes: 'לקוחה ותיקה' })];
  const r = feed(H.h03);
  assertClean(r, 'H03');
  const a = one(r, 'הערות ההזמנה עודכנו', 'H03');
  assertBucket(r, a, 'gen');
  assert.equal(det(a, 'אחרי'), 'ניילון + קולב');
  assertBucket(r, one(r, 'הערות פנימיות עודכנו', 'H03'), 'gen');
});

test('H04 ציפוף / יום השכרה נוסף: dates', () => {
  H.h04 = [putRow(EXISTING, { customSpacing: 5, extraDay: 'after' })];
  const r = feed(H.h04);
  assertClean(r, 'H04');
  const s = one(r, 'עודכן ציפוף ימים', 'H04');
  assert.deepEqual([det(s, 'לפני'), det(s, 'אחרי')], ['רגיל', '5 ימים']);
  const x = one(r, 'עודכן יום השכרה נוסף', 'H04');
  assert.deepEqual([det(x, 'לפני'), det(x, 'אחרי')], ['ללא', 'יום אחרי']);
  assertBucket(r, x, 'dates');
});

test('H05 משלוח: הפעלה / כיוון / עיר / כתובת / יום לפני - del, + חיוב המשלוח מהמנוע (system)', () => {
  const on = { isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים' };
  H.h05 = [
    putRow(EXISTING, on),
    putRow({ ...EXISTING, ...on }, { deliveryAddress: 'עמוס 14', deliveryOneDayBefore: true }),
    row({ entityType: 'PaymentObligation', entityId: OBL, action: 'CREATE', employeeId: null, employeeName: null, changesJson: JSON.stringify({ amount: 80, description: 'משלוח הלוך-חזור - ירושלים', isManual: false }) }),
  ];
  const extra = { obligations: [{ id: OBL, description: 'משלוח הלוך-חזור - ירושלים', amount: 80, isManual: false }] };
  const r = feed(H.h05, extra);
  assertClean(r, 'H05');
  const add = one(r, 'נוסף משלוח', 'H05');
  assertBucket(r, add, 'del');
  assert.equal(add.sub, 'הלוך-חזור · ירושלים');
  const upd = r.entries.filter((e) => e.text === 'עודכן משלוח');
  assert.equal(upd.length, 2, 'direction/city line + address/one-day line');
  assert.ok(upd.some((e) => det(e, 'כתובת משלוח') && det(e, 'יציאת המשלוח') === 'יומיים לפני האירוע ← יום לפני האירוע'));
  assert.equal(r.hiddenSystemCount, 1, 'the engine charge is bookkeeping (system)');
  const sys = feed(H.h05, extra, { includeSystem: true });
  const charge = one(sys, 'נוצר חיוב: משלוח הלוך-חזור - ירושלים', 'H05 system');
  assert.equal(charge.cat, 'pay');
  assert.equal(charge.amt, 80);
});

test('H06 החלפת לקוח: gen (כללי) · "הוחלף לקוח" עם שמות, בלי מזהים', () => {
  H.h06 = [putRow(EXISTING, { customerId: CUST_B })];
  H.h06x = { customers: [{ id: CUST_A, name: 'מרים אברמוביץ' }, { id: CUST_B, name: 'רבקה לוין' }] };
  const r = feed(H.h06, H.h06x);
  assertClean(r, 'H06');
  const e = one(r, 'הוחלף לקוח', 'H06');
  assertBucket(r, e, 'gen');
  assert.deepEqual([det(e, 'לפני'), det(e, 'אחרי')], ['מרים אברמוביץ', 'רבקה לוין']);
  const unknown = feed(H.h06);
  assert.equal(det(one(unknown, 'הוחלף לקוח', 'H06b'), 'אחרי'), 'לקוח שנמחק', 'an unknown customer is never shown by id');
  assertClean(unknown, 'H06b');
});

test('H07 חתימה על תקנון: docs + סל "חתימות"', () => {
  H.h07 = [putRow(EXISTING, { hasSignedRegulations: true })];
  const r = feed(H.h07);
  assertClean(r, 'H07');
  const e = one(r, 'הלקוח חתם על התקנון', 'H07');
  assertBucket(r, e, 'docs', 'sig');
});

test('H08 הוספת פריט (+ אישור מנהל R47): items · "נוסף פריט: דגם, מידה" + "אישור מנהל: <שם> · שינוי פריטים בהזמנה"', () => {
  H.h08 = [
    approvalRow('feature:item_change_approval', 'ביטול פריט מהזמנה קיימת דורש גם אישור מנהל (בנוסף לאימות ת״ז).'),
    row({ entityType: 'OrderItem', entityId: ITEM2, action: 'CREATE', changesJson: JSON.stringify({ orderId: ORDER_NO, sizeText: '36', price: 120, finalPrice: 120, sleeveAlteration: 1, dressItemId: CUST_A }) }),
  ];
  const r = feed(H.h08);
  assertClean(r, 'H08');
  const e = one(r, 'נוסף פריט: דגם 3087, מידה 36', 'H08');
  assertBucket(r, e, 'items');
  assert.equal(e.amt, 120);
  assert.equal(det(e, 'תיקון'), 'שרוול');
  const a = one(r, `אישור מנהל: ${MGR.name} · שינוי פריטים בהזמנה`, 'H08');
  assertBucket(r, a, 'gen');
  assert.equal(a.who, EMP.name, 'who = the employee who asked; the approver is in the text');
  assert.equal(det(a, 'מאשר'), MGR.name);
});

test('H09 עריכת דגם/מידה/תיקון (+ אישור item_edit_reopen): items לפני ← אחרי', () => {
  H.h09 = [
    approvalRow('feature:item_edit_reopen', 'עריכת פריט אחרי 15 דקות'),
    row({ entityType: 'OrderItem', entityId: ITEM, action: 'UPDATE', changesJson: JSON.stringify({ sizeText: { from: '38', to: '40' }, dressItemId: { from: CUST_A, to: CUST_B } }) }),
    row({ entityType: 'OrderItem', entityId: ITEM, action: 'UPDATE', changesJson: JSON.stringify({ lengthAlteration: { from: null, to: '3' }, alterationDetails: { from: '', to: 'קיצור' } }) }),
  ];
  const r = feed(H.h09);
  assertClean(r, 'H09');
  const s = one(r, 'הוחלפה מידה: דגם 4512', 'H09');
  assertBucket(r, s, 'items');
  assert.deepEqual([det(s, 'לפני'), det(s, 'אחרי')], ['38', '40']);
  assertBucket(r, one(r, 'עודכן תיקון: דגם 4512, מידה 38', 'H09'), 'items', 'fix');
  one(r, `אישור מנהל: ${MGR.name} · עריכת פריט אחרי 15 דקות`, 'H09');
});

test('H10 מחיקת / שחזור פריט בשמירה (+ אישור item_change): items', () => {
  H.h10 = [
    row({ entityType: 'OrderItem', entityId: ITEM2, action: 'CANCEL_ITEM', changesJson: JSON.stringify({ isDeleted: { from: false, to: true } }) }),
    row({ entityType: 'OrderItem', entityId: ITEM2, action: 'RESTORE_ITEM', changesJson: JSON.stringify({ isDeleted: { from: true, to: false } }) }),
  ];
  const r = feed(H.h10);
  assertClean(r, 'H10');
  assertBucket(r, one(r, 'הוסר פריט: דגם 3087, מידה 36', 'H10'), 'items');
  assertBucket(r, one(r, 'שוחזר פריט: דגם 3087, מידה 36', 'H10'), 'items');
});

test('H11 תיקון בוצע / בוטל: items + סל "תיקונים" (כולל ביטול מהלו״ז - ALTERATION_UNDONE, ההערה בתאריך עברי)', () => {
  H.h11 = [
    row({ entityType: 'OrderItem', entityId: ITEM2, action: 'ALTERATION_DONE', changesJson: JSON.stringify({ alterationDone: { from: false, to: true } }) }),
    row({ entityType: 'OrderItem', entityId: ITEM2, action: 'ALTERATION_UNDONE', changesJson: JSON.stringify({ alterationDone: { from: true, to: false }, orderId: ORDER_NO, note: 'מהלו״ז היומי (2026-10-05)' }) }),
    row({ entityType: 'OrderItem', entityId: ITEM2, action: 'UPDATE', changesJson: JSON.stringify({ alterationDone: { from: false, to: true } }) }),
  ];
  const r = feed(H.h11);
  assertClean(r, 'H11');
  const done = r.entries.filter((e) => e.text === 'תיקון סומן כבוצע: דגם 3087, מידה 36');
  assert.equal(done.length, 2, 'done (named row), undone, done again (order save) = three real events');
  assertBucket(r, done[0], 'items', 'fix');
  const u = one(r, 'סימון התיקון בוטל: דגם 3087, מידה 36', 'H11');
  assert.ok(/תשרי/.test(det(u, 'הערה')), det(u, 'הערה'));
  assertBucket(r, u, 'items', 'fix');
});

test('H12 השכרה / החזרה / ביטולן (+ אישורי ברקוד / החזרה מוקדמת): items', () => {
  H.h12 = [
    approvalRow('feature:barcode_mismatch_override', 'ברקוד שלא תואם'),
    row({ entityType: 'OrderItem', entityId: ITEM, action: 'CONFIRM_RENTAL', changesJson: JSON.stringify({ isTaken: { from: false, to: true }, barcode: { from: null, to: '45120038' }, takenDate: { from: null, to: '2026-10-05T07:00:00.000Z' } }) }),
    row({ entityType: 'OrderItem', entityId: ITEM, action: 'CANCEL_RENTAL', changesJson: JSON.stringify({ isTaken: { from: true, to: false }, note: 'נסרק בטעות' }) }),
    approvalRow('feature:early_return_approval', 'החזרה מוקדמת'),
    row({ entityType: 'OrderItem', entityId: ITEM, action: 'RETURN_RENTAL', changesJson: JSON.stringify({ isReturned: { from: false, to: true }, returnedOk: { from: false, to: true } }) }),
    row({ entityType: 'OrderItem', entityId: ITEM, action: 'CANCEL_RETURN', changesJson: JSON.stringify({ isReturned: { from: true, to: false } }) }),
  ];
  const r = feed(H.h12);
  assertClean(r, 'H12');
  const taken = one(r, 'נלקח: דגם 4512, מידה 38', 'H12');
  assertBucket(r, taken, 'items');
  assert.ok(/תשרי/.test(det(taken, 'תאריך לקיחה')));
  one(r, 'בוטלה ההשכרה: דגם 4512, מידה 38', 'H12');
  one(r, 'הוחזר: דגם 4512, מידה 38', 'H12');
  one(r, 'בוטלה ההחזרה: דגם 4512, מידה 38', 'H12');
  one(r, `אישור מנהל: ${MGR.name} · ברקוד שלא תואם להזמנה`, 'H12');
  one(r, `אישור מנהל: ${MGR.name} · החזרה לפני מועד האירוע`, 'H12');
});

test('H13 מצב החזרה לא תקין (report-issue): items · "מצב ההחזרה עודכן" + "לא תקין"', () => {
  H.h13 = [row({ entityType: 'OrderItem', entityId: ITEM, action: 'RETURN_CONDITION', changesJson: JSON.stringify({ returnedOk: { from: true, to: false }, note: 'דווח כחזר לא תקין - כתם בשרוול' }) })];
  const r = feed(H.h13);
  assertClean(r, 'H13');
  const e = one(r, 'מצב ההחזרה עודכן: דגם 4512, מידה 38', 'H13');
  assertBucket(r, e, 'items');
  assert.equal(e.sub, 'לא תקין');
  assert.equal(e.icon, 'alert');
});

test('H14 תשלום אשראי (נדרים) / ידני: pay · "התקבל תשלום…" ₪N, ספרות אחרונות בלבד', () => {
  H.h14 = [
    row({ entityType: 'Payment', entityId: PAY, action: 'CREATE', changesJson: JSON.stringify({ amount: 300, paymentMethod: 'מזומן', orderId: ORDER_NO }) }),
    row({ entityType: 'Payment', entityId: 'p-nedarim', action: 'CREATE', changesJson: JSON.stringify({ amount: 230, paymentMethod: 'אשראי (נדרים פלוס)', notes: 'כרטיס 4580123412344432 תשלומים: 3', orderId: ORDER_NO }) }),
  ];
  const r = feed(H.h14);
  assertClean(r, 'H14');
  const cash = r.entries.find((e) => e.amt === 300);
  assert.match(cash.text, /^התקבל תשלום/);
  assertBucket(r, cash, 'pay');
  const card = r.entries.find((e) => e.amt === 230);
  assert.match(card.text, /^התקבל תשלום באשראי/);
  assert.ok(!JSON.stringify(card).includes('4580123412344432'), 'the card number never reaches the feed');
});

test('H15 מחיקת תשלום בשמירה: pay · "תשלום בוטל"', () => {
  H.h15 = [row({ entityType: 'Payment', entityId: PAY, action: 'CANCEL_PAYMENT', changesJson: JSON.stringify({ isDeleted: { from: false, to: true }, amount: 300, paymentMethod: 'מזומן' }) })];
  const r = feed(H.h15, { payments: [{ id: PAY, amount: 300, paymentMethod: 'מזומן', isDeleted: true }] });
  assertClean(r, 'H15');
  const e = one(r, 'תשלום בוטל: ₪300', 'H15');
  assertBucket(r, e, 'pay');
  assert.equal(e.amt, -300);
});

test('H16 חיוב ידני (מנהל): pay · "נוסף חיוב ידני" + "אישור מנהל: <שם> · חיוב ידני"', () => {
  H.h16 = [
    approvalRow('feature:manual_charge_add', 'הוספה או מחיקה של חיוב ידני דורשת אישור מנהל.'),
    row({ entityType: 'PaymentObligation', entityId: 'ob-man', action: 'CREATE', changesJson: JSON.stringify({ amount: 50, description: 'ניקוי כתם', isManual: true }) }),
  ];
  const r = feed(H.h16, { obligations: [{ id: 'ob-man', description: 'ניקוי כתם', amount: 50, isManual: true }] });
  assertClean(r, 'H16');
  const c = one(r, 'נוסף חיוב ידני: ניקוי כתם', 'H16');
  assertBucket(r, c, 'pay');
  assert.equal(c.amt, 50);
  const a = one(r, `אישור מנהל: ${MGR.name} · חיוב ידני`, 'H16');
  assert.equal(det(a, 'סיבה'), 'הוספה או מחיקה של חיוב ידני דורשת אישור מנהל.');
});

test('H17 בקשת זיכוי / פרטי בנק / ביצוע: pay, שורה אחת לכל שלב, בלי פרטי בנק', () => {
  H.h17 = [
    row({ entityType: 'Refund', entityId: REF, action: 'CREATE', changesJson: JSON.stringify({ amount: 100, reason: 'ביטול שמלה', orderId: ORDER_NO }) }),
    row({ entityType: 'Refund', entityId: REF, action: 'UPDATE', changesJson: JSON.stringify({ bankName: 'לאומי', bankBranch: '902', bankAccount: '12345678', bankAccountName: 'מרים' }) }),
    row({ entityType: 'Refund', entityId: REF, action: 'EXECUTE', changesJson: JSON.stringify({ isExecuted: { from: false, to: true } }), createdAt: at(400) }),
    row({ entityType: 'Payment', entityId: 'p-ref', action: 'CREATE', changesJson: JSON.stringify({ amount: -100, paymentMethod: 'העברה בנקאית', isRefund: true }), createdAt: at(400) }),
    row({ entityType: 'Order', entityId: String(ORDER_NO), action: 'ADD_PAYMENT', changesJson: JSON.stringify({ amount: -100 }), createdAt: at(400) }),
  ];
  const r = feed(H.h17, { refunds: [{ id: REF, amount: 100, reason: 'ביטול שמלה', isExecuted: true, createdAt: at(1) }] });
  assertClean(r, 'H17');
  assertBucket(r, one(r, 'נפתחה בקשת זיכוי ₪100', 'H17'), 'pay');
  one(r, 'פרטי הבנק לזיכוי עודכנו', 'H17');
  one(r, 'הוחזר ללקוח ₪100', 'H17');
  assert.ok(!/12345678|902|לאומי/.test(JSON.stringify(r.entries)), 'bank details never shown');
  assert.equal(r.dedupedBy.D3, 1);
  assert.equal(r.dedupedBy.D5, 1);
});

test('H18 חישוב מחדש: חיובי המנוע = system (מוסתרים, נראים עם ?system=1), אף פעם לא unmapped', () => {
  H.h18 = [
    row({ entityType: 'PaymentObligation', entityId: 'ob-a', action: 'DELETE', employeeId: null, employeeName: null, changesJson: JSON.stringify({ amount: 150, description: 'השכרת שמלה' }) }),
    row({ entityType: 'PaymentObligation', entityId: 'ob-b', action: 'CREATE', employeeId: null, employeeName: null, changesJson: JSON.stringify({ amount: 170, description: 'השכרת שמלה', isManual: false }) }),
  ];
  const ob = { obligations: [{ id: 'ob-b', description: 'השכרת שמלה', amount: 170, isManual: false }] };
  const r = feed(H.h18, ob);
  assertClean(r, 'H18');
  assert.equal(r.entries.length, 0);
  assert.equal(r.hiddenSystemCount, 2);
  const sys = feed(H.h18, ob, { includeSystem: true });
  assertClean(sys, 'H18 system');
  assert.ok(sys.entries.every((e) => e.cat === 'pay' && e.system && e.auto));
  one(sys, 'חיוב הוסר בחישוב מחדש: השכרת שמלה', 'H18');
});

test('H19 שמירה עם חוב (השאר חוב): DEBT_APPROVED + MANAGER_APPROVAL = שורה אחת "אישור מנהל: <שם> · הזמנה ללא תשלום ₪N" (D8)', () => {
  H.h19 = [
    approvalRow('מאשר הזמנה ללא תשלום', 'הזמנה ללא תשלום ₪120', { createdAt: at(500) }),
    row({ entityId: String(ORDER_NO), action: 'DEBT_APPROVED', employeeId: MGR.id, employeeName: MGR.name, changesJson: JSON.stringify({ approvedDebtAmount: 120 }), createdAt: at(501) }),
  ];
  const r = feed(H.h19);
  assertClean(r, 'H19');
  assert.equal(r.entries.length, 1);
  const e = one(r, `אישור מנהל: ${MGR.name} · הזמנה ללא תשלום ₪120`, 'H19');
  assertBucket(r, e, 'gen');
  assert.equal(e.who, EMP.name);
  assert.equal(r.dedupedBy.D8, 1);
  // more than 2 minutes apart: two separate events
  const far = feed([H.h19[0], { ...H.h19[1], createdAt: at(505) }]);
  assert.equal(far.entries.length, 2);
  assertClean(far, 'H19 far');
});

test('H20 שחרור נעילה: docs · "אישור מנהל: <שם> · עריכת הזמנה נעולה"', () => {
  H.h20 = [approvalRow('feature:locked_order_edit', 'הזמנה זו נעולה כי תאריך האירוע עבר. נדרש אישור מנהל לעריכה.')];
  const r = feed(H.h20);
  assertClean(r, 'H20');
  const e = one(r, `אישור מנהל: ${MGR.name} · עריכת הזמנה נעולה`, 'H20');
  assertBucket(r, e, 'gen');
  assert.equal(e.icon, 'shield');
});

test('H21 ציפוף בהקטנה / מייל מהיר / תשלום-זיכוי ידני: "אישור מנהל: …" לכל אחד; מאשר שנמחק = "עובד שנמחק"', () => {
  H.h21 = [
    approvalRow('feature:special_spacing_approval', 'הקטנת ציפוף'),
    approvalRow('feature:customer_email_approval', 'מייל מהיר'),
    approvalRow('feature:manual_payment_credit_add', 'תשלום ידני'),
  ];
  const r = feed(H.h21);
  assertClean(r, 'H21');
  for (const w of ['שינוי ציפוף ימים', 'שליחת מייל ללקוח', 'תשלום / זיכוי ידני']) assertBucket(r, one(r, `אישור מנהל: ${MGR.name} · ${w}`, 'H21'), 'gen');
  const gone = feed([row({ entityId: String(ORDER_NO), action: 'MANAGER_APPROVAL', changesJson: named(buildApprovalMeta({ requiredLevel: 'מנהל', reason: '', approverId: 'deadbeef-0000-4000-8000-000000000000' })) })]);
  assertClean(gone, 'H21 deleted approver');
  one(gone, 'אישור מנהל: עובד שנמחק · פעולה באישור מנהל', 'H21');
});

test('H22 הדפסת סיכום / השכרה (דף ההדפסה): docs · "הודפס סיכום הזמנה" / "הודפס דף השכרה" + סל "הדפסות"; שורת PageVisitLog של אותה טעינה לא כפולה (D9)', () => {
  H.h22 = [
    eventRow('ORDER_PRINTED', { doc: 'order', source: 'print-page', batch: false }, { createdAt: at(600) }),
    eventRow('ORDER_PRINTED', { doc: 'rental', source: 'print-page', batch: true, count: 12 }, { createdAt: at(610) }),
  ];
  H.h22x = { printVisits: [{ id: 'v1', timestamp: new Date(at(600).getTime() + 2000), employeeName: EMP.name }, { id: 'v2', timestamp: at(700), employeeName: EMP.name }] };
  const r = feed(H.h22, H.h22x);
  assertClean(r, 'H22');
  const o = one(r, 'הודפס סיכום הזמנה', 'H22');
  assertBucket(r, o, 'docs', 'print');
  assert.equal(det(o, 'הודפס מתוך'), 'דף ההדפסה');
  assert.equal(one(r, 'הודפס דף השכרה', 'H22').sub, 'בהדפסה מרוכזת של 12 הזמנות');
  assert.equal(r.dedupedBy.D9, 1, 'the PageVisitLog line of the same load');
  one(r, 'נפתח דף הדפסה של ההזמנה', 'H22 (an old print without a typed row stays)');
});

test('H23 דף הכנה (PP-07) / תעודת משלוח (PP-12): docs/print', () => {
  H.h23 = [eventRow('ORDER_PRINTED', { doc: 'prep', sheet: 'PP-07', source: 'print-page' }), eventRow('ORDER_PRINTED', { doc: 'delivery', sheet: 'PP-12', source: 'print-page' })];
  const r = feed(H.h23);
  assertClean(r, 'H23');
  assertBucket(r, one(r, 'הודפס דף הכנה', 'H23'), 'docs', 'print');
  assertBucket(r, one(r, 'הודפסה תעודת משלוח', 'H23'), 'docs', 'print');
});

// אינטגרציה W6+W7 (AMB-20, REQUESTS-W7 #1): הדפסת יום שלמה של דף לו״ז שההזמנה הופיעה בו - "(הדפסת יום)"; דף לו״ז אחר נקרא בשמו
test('H23b הדפסת יום (batch מדף ההדפסה של הלו״ז): "הודפס דף הכנה (הדפסת יום)", וגם דף לו״ז אחר בשמו', () => {
  const rows = [
    eventRow('ORDER_PRINTED', { doc: 'prep', sheet: 'PP-07', source: 'print-page', batch: true, count: 12 }),
    eventRow('ORDER_PRINTED', { doc: 'delivery', sheet: 'PP-12', source: 'print-page', batch: true, count: 3 }),
    eventRow('ORDER_PRINTED', { doc: 'schedule', sheet: 'PP-16', source: 'print-page', batch: true, count: 8 }),
    eventRow('ORDER_PRINTED', { doc: 'schedule', sheet: 'PP-01', source: 'print-page', batch: false }),
  ];
  const r = feed(rows);
  assertClean(r, 'H23b');
  assertBucket(r, one(r, 'הודפס דף הכנה (הדפסת יום)', 'H23b prep'), 'docs', 'print');
  one(r, 'הודפסה תעודת משלוח (הדפסת יום)', 'H23b delivery (the label keeps its own grammar)');
  assertBucket(r, one(r, 'הודפס דף קבלת החזרות (הדפסת יום)', 'H23b schedule sheet'), 'docs', 'print');
  const single = one(r, 'הודפס דוח הזמנות כללי', 'H23b schedule single print (no day-print suffix)');
  assert.equal(det(single, 'מסמך'), 'דוח הזמנות כללי');
});

test('H24 הורדת סיכום PDF: docs · "הורד סיכום ההזמנה (PDF)"', () => {
  H.h24 = [eventRow('ORDER_PDF_DOWNLOADED', { doc: 'order', fileName: 'הזמנה 53375.pdf' }), eventRow('ORDER_PDF_DOWNLOADED', { doc: 'rental' })];
  const r = feed(H.h24);
  assertClean(r, 'H24');
  const e = one(r, 'הורד סיכום ההזמנה (PDF)', 'H24');
  assertBucket(r, e, 'docs');
  assert.equal(det(e, 'קובץ'), 'הזמנה 53375.pdf');
  one(r, 'הורד דף ההשכרה (PDF)', 'H24');
});

test('H25 ייצוא Excel של ההזמנה: docs · "יוצאה ההזמנה ל-Excel"', () => {
  H.h25 = [eventRow('ORDER_XLSX_EXPORTED', { fileName: 'הזמנה 53375.xlsx' })];
  const r = feed(H.h25);
  assertClean(r, 'H25');
  assertBucket(r, one(r, 'יוצאה ההזמנה ל-Excel', 'H25'), 'docs');
});

test('H26 ייצוא / הורדה / הדפסת היסטוריה: docs · "יוצאה היסטוריית ההזמנה (Excel/PDF/הדפסה)"', () => {
  H.h26 = ['xlsx', 'pdf', 'print'].map((format) => eventRow('HISTORY_EXPORTED', { format, rows: 42 }));
  const r = feed(H.h26);
  assertClean(r, 'H26');
  for (const f of ['Excel', 'PDF', 'הדפסה']) {
    const e = one(r, `יוצאה היסטוריית ההזמנה (${f})`, 'H26');
    assertBucket(r, e, 'docs');
    assert.equal(det(e, 'שורות'), '42');
  }
  assert.ok(inCategory(one(r, 'יוצאה היסטוריית ההזמנה (הדפסה)', 'H26'), 'print'));
});

test('H27 מייל הזמנה / השכרה / מהיר עם צרופות: "נשלח מייל <סוג> · אל … · N קבצים · אושר ע״י …" עם מבצע; כשל → "שליחת המייל נכשלה" (פעם אחת, D10)', () => {
  const attachments = emailAttachmentSummary({ hasOrderPdf: true, printType: 'order', orderPdfName: 'הזמנה 53375.pdf', extraRaw: [{ fileName: 'תקנון.pdf', fileContent: 'x', kind: 'regulations' }] });
  const base = { subject: 'הזמנה #53375 - גמ"ח', to: 'miriam@example.com', type: 'order', sendMode: 'email', files: [{ fileName: 'הזמנה 53375.pdf' }] };
  H.h27 = [
    row({ entityId: String(ORDER_NO), action: 'EMAIL_SENT', changesJson: named(emailEventMeta({ base, approverId: MGR.id, selfApproved: false, attachments })), createdAt: at(800) }),
    row({ entityId: String(ORDER_NO), action: 'EMAIL_FAILED', changesJson: named(emailEventMeta({ base: { ...base, type: 'rental' }, approverId: null, attachments: [], error: 'ETIMEDOUT 535 user x@y.z' })), createdAt: at(810) }),
  ];
  H.h27x = { emailLogs: [{ id: 'm1', to: 'miriam@example.com', subject: base.subject, status: 'error', errorMessage: 'ETIMEDOUT', sentAt: new Date(at(810).getTime() + 1500) }] };
  const r = feed(H.h27, H.h27x);
  assertClean(r, 'H27');
  const sent = one(r, 'נשלח מייל הזמנה', 'H27');
  assertBucket(r, sent, 'docs', 'mail');
  assert.equal(sent.sub, `אל miriam@example.com · 2 קבצים · אושר ע״י ${MGR.name}`);
  assert.equal(sent.who, EMP.name, 'now with the sender (W0 §1.3)');
  assert.equal(det(sent, 'קבצים'), 'הזמנה 53375.pdf, תקנון.pdf');
  const failed = one(r, 'שליחת המייל נכשלה', 'H27');
  assertBucket(r, failed, 'docs', 'mail');
  assert.ok(!/x@y\.z|535/.test(JSON.stringify(failed)), 'SMTP details are not shown');
  assert.equal(r.dedupedBy.D10, 1);
});

test('H28 שמירת כתובת מייל חסרה (PUT customers): בכרטיס הלקוח בלבד - אין שורה בפיד ההזמנה', () => {
  const r = feed([row({ entityType: 'Customer', entityId: CUST_A, action: 'UPDATE', changesJson: JSON.stringify({ email: { from: '', to: 'a@b.c' } }) })]);
  assert.equal(r.entries.length, 0);
  assert.equal(r.unmappedCount, 0);
});

test('H29 סימון / ביטול "הכנה בוצעה" (ScheduleStageMark): docs · "סומן \'בוצע\' בלו״ז · הכנה" ביום עברי', () => {
  const changes = (to) => JSON.stringify({ orderId: ORDER_NO, scheduleStage: 'הכנה', scheduleDay: '2026-10-05', done: { from: to ? null : true, to } });
  H.h29 = [
    row({ entityType: 'ScheduleStageMark', entityId: MARK, action: 'SCHEDULE_STAGE_DONE', changesJson: changes(true) }),
    row({ entityType: 'ScheduleStageMark', entityId: MARK, action: 'SCHEDULE_STAGE_UNDONE', changesJson: changes(false) }),
    row({ entityType: 'ScheduleStageMark', entityId: 'mk2', action: 'SCHEDULE_STAGE_DONE', changesJson: JSON.stringify({ orderId: ORDER_NO, scheduleStage: 'החזרה ידנית', scheduleDay: '2026-10-11', done: { from: null, to: true }, outcome: { from: null, to: 'not_ok' } }) }),
  ];
  const r = feed(H.h29);
  assertClean(r, 'H29');
  const d = one(r, "סומן 'בוצע' בלו״ז · הכנה", 'H29');
  assertBucket(r, d, SCHEDULE_MARK_CAT);
  assert.ok(/תשרי/.test(det(d, 'יום בלו״ז')), det(d, 'יום בלו״ז'));
  one(r, "בוטל סימון 'בוצע' בלו״ז · הכנה", 'H29');
  assert.equal(det(one(r, "סומן 'בוצע' בלו״ז · החזרה ידנית", 'H29'), 'מצב החזרה'), 'לא תקין');
});

test('H30 ביטול כל השינויים: docs · "בוטלו שינויים שלא נשמרו"', () => {
  H.h30 = [row({ entityId: String(ORDER_NO), action: 'CANCEL_CHANGES', changesJson: JSON.stringify({ discarded: 'תאריך האירוע, הערות' }) })];
  const r = feed(H.h30);
  assertClean(r, 'H30');
  assertBucket(r, one(r, 'בוטלו שינויים שלא נשמרו', 'H30'), 'gen');
});

test('H31 מחיקת הזמנה: "ההזמנה בוטלה" - שורה אחת (D1 + D2)', () => {
  const t = at(900);
  H.h31 = [
    row({ action: 'CANCEL_ORDER', changesJson: JSON.stringify({ isDeleted: true }), createdAt: t }),
    row({ entityId: String(ORDER_NO), action: 'CANCEL_ORDER', changesJson: JSON.stringify({ note: 'בוטלו 2 פריטים' }), createdAt: new Date(t.getTime() + 300) }),
    row({ entityType: 'OrderItem', entityId: ITEM, action: 'CANCEL_ORDER', changesJson: JSON.stringify({ isDeleted: true }), createdAt: new Date(t.getTime() + 100) }),
    row({ entityType: 'PaymentObligation', entityId: OBL, action: 'CANCEL_ORDER', changesJson: JSON.stringify({ isDeleted: true }), createdAt: new Date(t.getTime() + 150) }),
  ];
  const r = feed(H.h31);
  assertClean(r, 'H31');
  assert.equal(r.entries.length, 1);
  const e = one(r, 'ההזמנה בוטלה', 'H31');
  assert.equal(det(e, 'פריטים שבוטלו'), '1');
});

test('H32 שמירה בלי שינוי: אין שורה (diff ריק = השרת לא כותב; שורה ישנה זהה = noop)', () => {
  assert.deepEqual(diffOrderUpdate(EXISTING, { ...EXISTING, eventDate: new Date(EXISTING.eventDate.getTime()), notes: 'ניילון', internalNotes: null }), {});
  assert.equal(putRow(EXISTING, { notes: 'ניילון' }), null);
  const create = row({ action: 'CREATE', changesJson: JSON.stringify({ orderId: ORDER_NO, notes: 'ניילון', totalAmount: 530 }) });
  const same = row({ action: 'UPDATE', changesJson: JSON.stringify({ notes: 'ניילון', totalAmount: 530 }) });
  const r = feed([create, same]);
  assert.equal(r.noopCount, 1);
  assert.deepEqual(r.entries.map((e) => e.text), ['ההזמנה נוצרה']);
});

test('H33 שחזור/מחיקת טיוטה, פתיחת הכרטיס, מעבר לשוניות: אין שורה (מקומי), והשרת לא מקבל אירועים כאלה', () => {
  assert.equal(feed([]).entries.length, 0);
  for (const action of ['DRAFT_RESTORED', 'DRAFT_DISCARDED', 'CARD_OPENED', 'TAB_SWITCH', 'MANAGER_APPROVAL', 'EMAIL_SENT']) {
    const p = parseEventsRequest({ orderId: ORDER_NO, action, meta: {} });
    assert.equal(p.ok, false, action);
  }
});

test('הכל יחד בהזמנה אחת: כל H01–H31 בפיד אחד - אפס unmapped, כל פעולה ידועה מכוסה, ספירות הסינון = ספירות השרת, חיפוש וייצוא נקיים', () => {
  const rows = Object.entries(H).filter(([k]) => !k.endsWith('x')).flatMap(([, v]) => v).filter(Boolean);
  const extra = {
    obligations: [{ id: OBL, description: 'משלוח הלוך-חזור - ירושלים', amount: 80, isManual: false }, { id: 'ob-man', description: 'ניקוי כתם', amount: 50, isManual: true }, { id: 'ob-b', description: 'השכרת שמלה', amount: 170, isManual: false }],
    payments: [{ id: PAY, amount: 300, paymentMethod: 'מזומן', isDeleted: true }],
    refunds: [{ id: REF, amount: 100, reason: 'ביטול שמלה', isExecuted: true, createdAt: at(1) }],
    ...H.h06x, ...H.h22x, ...H.h27x,
  };
  const r = feed(rows, extra);
  assertClean(r, 'all');
  assert.ok(r.entries.length >= 60, String(r.entries.length));
  // every action the mapper claims to know appears in the matrix (so a new action needs a new H row here)
  const used = new Set(rows.map((x) => `${x.entityType}:${x.action}`));
  const missing = Object.entries(KNOWN_ACTIONS).flatMap(([ent, acts]) => acts.map((a) => `${ent}:${a}`)).filter((k) => !used.has(k));
  const NOT_IN_CARD = new Set(['Order:CREATE', 'Order:UPDATE', 'Order:RESTORE_ORDER', 'Order:CANCEL_DEBT_APPROVAL', 'Order:REMOVE_PAYMENT', 'OrderItem:CANCEL_SCAN', 'OrderItem:BARCODE_INVALID',
    'Payment:UPDATE', 'Payment:RESTORE_PAYMENT', 'PaymentObligation:UPDATE', 'PaymentObligation:CANCEL_OBLIGATION', 'PaymentObligation:RESTORE_OBLIGATION',
    'Refund:AUTO_CREDIT_REFUND_CREATED', 'Refund:AUTO_CREDIT_REFUND_UPDATED', 'Refund:AUTO_CREDIT_REFUND_CLEARED']);
  assert.deepEqual(missing.filter((k) => !NOT_IN_CARD.has(k)), [], 'known actions without a matrix row');
  // the "not in the card" ones still map (no generic line)
  const legacy = feed([
    row({ entityId: String(ORDER_NO), action: 'RESTORE_ORDER', changesJson: '{}' }),
    row({ entityId: String(ORDER_NO), action: 'CANCEL_DEBT_APPROVAL', changesJson: '{}' }),
    row({ entityId: String(ORDER_NO), action: 'REMOVE_PAYMENT', changesJson: JSON.stringify({ note: 'x' }) }),
    row({ entityType: 'OrderItem', entityId: ITEM, action: 'CANCEL_SCAN', changesJson: '{}' }),
    row({ entityType: 'OrderItem', entityId: ITEM, action: 'BARCODE_INVALID', changesJson: '{}' }),
    row({ entityType: 'Payment', entityId: PAY, action: 'RESTORE_PAYMENT', changesJson: JSON.stringify({ amount: 300 }) }),
    row({ entityType: 'PaymentObligation', entityId: 'ob-man', action: 'CANCEL_OBLIGATION', changesJson: JSON.stringify({ amount: 50 }) }),
    row({ entityType: 'PaymentObligation', entityId: 'ob-man', action: 'RESTORE_OBLIGATION', changesJson: JSON.stringify({ amount: 50 }) }),
    row({ entityType: 'Refund', entityId: REF, action: 'AUTO_CREDIT_REFUND_CREATED', changesJson: JSON.stringify({ amount: 20 }) }),
    row({ entityType: 'Refund', entityId: REF, action: 'AUTO_CREDIT_REFUND_UPDATED', changesJson: JSON.stringify({ amount: 25 }) }),
    row({ entityType: 'Refund', entityId: REF, action: 'AUTO_CREDIT_REFUND_CLEARED', changesJson: '{}' }),
  ], extra);
  assertClean(legacy, 'legacy actions');
  // the filter menu counts = the server's counts; every category / bucket adds up
  for (const [k] of filterCategories(r.entries)) {
    const server = r.counts.categories[k] ?? r.counts.extras[k];
    assert.equal(categoryCount(r.entries, k), server, `count ${k}`);
  }
  assert.equal(Object.values(r.counts.categories).reduce((a, b) => a + b, 0), r.counts.all);
  // search: Hebrew words, a time, a Hebrew date; never matches hidden machine fields
  assert.ok(visibleEntries(r.entries, { q: 'אישור מנהל' }).length >= 8);
  assert.equal(visibleEntries(r.entries, { q: 'MANAGER_APPROVAL' }).length, 0);
  assert.equal(visibleEntries(r.entries, { q: ORDER_UUID }).length, 0);
  assert.deepEqual(searchEntries(r.entries, 'הודפס דף').map((e) => e.text).sort(), visibleEntries(r.entries, { q: 'הודפס דף' }).map((e) => e.text).sort());
  assert.ok(visibleEntries(r.entries, { q: 'תשרי' }).length === r.entries.length, 'every line carries its Hebrew date');
});

test('ייצוא Excel (A21): גיליון RTL, עמודות עבריות לפי PLAN §C.4, אין תא תאריך לועזי (Excel date) ואין ISO', async () => {
  const XLSX = (await import('xlsx')).default || (await import('xlsx'));
  const { buildRowsWorkbook } = await import('@/lib/xlsxExport.js');
  const { EXPORT_COLUMNS } = await import('@/app/components/order-card/parts/ocHistoryModel.js');
  const rows = Object.entries(H).filter(([k]) => !k.endsWith('x')).flatMap(([, v]) => v).filter(Boolean);
  const r = feed(rows, { ...H.h06x, ...H.h27x });
  const wb = buildRowsWorkbook(XLSX, exportRows(r.entries), { sheetName: 'היסטוריה', columns: EXPORT_COLUMNS });
  assert.equal(wb.Workbook.Views[0].RTL, true);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const header = EXPORT_COLUMNS.map((_, c) => ws[XLSX.utils.encode_cell({ r: 0, c })].v);
  assert.deepEqual(header, ['פעולה', 'תאריך', 'שעה', 'קודם', 'חדש', 'עובד מבצע', 'קטגוריה', 'סכום', 'פרטים']);
  for (const [ref, cell] of Object.entries(ws)) {
    if (ref.startsWith('!')) continue;
    assert.notEqual(cell.t, 'd', `${ref} is a Gregorian date cell`);
    assert.ok(!GREG_RE.test(String(cell.v)) && !UUID_RE.test(String(cell.v)), `${ref}: ${cell.v}`);
  }
  const amt = exportRows(r.entries).find((x) => x['פעולה'] === 'נוסף חיוב ידני: ניקוי כתם');
  assert.equal(amt['סכום'], 50, 'amounts are numbers (sortable / summable in Excel)');
  const pay = exportRows(r.entries).find((x) => x['פעולה'].startsWith('התקבל תשלום') && x['סכום'] === 300);
  assert.ok(pay && /תשרי/.test(pay['תאריך']) && /^\d{2}:\d{2}$/.test(pay['שעה']));
});

// F2 (בעלים 2026-10-05): סינון "כללי" = סימוני לו״ז + כל שורה כללית אחרת שלא שייכת לסינון אחר (יצירת הזמנה, סטטוס, הערות, ביטול/שחזור)
test('F2 "כללי": יצירת הזמנה / סטטוס / הערות / ביטול / סימון לו״ז - כולם ב-gen; פריט / תשלום / תאריך / מסמך נשארים בסינונים שלהם', () => {
  const create = row({ action: 'CREATE', changesJson: JSON.stringify({ orderId: ORDER_NO, totalAmount: 530 }) });
  const status = row({ action: 'UPDATE', changesJson: JSON.stringify({ status: { from: 'חדש', to: 'פעיל' } }) });
  const notes = putRow(EXISTING, { notes: 'הערה חדשה לגמרי' });
  const cancel = row({ action: 'CANCEL_ORDER', changesJson: JSON.stringify({ isDeleted: true }) });
  const gen = feed([create, status, notes, cancel]);
  assert.ok(gen.entries.length >= 3, gen.entries.map((e) => e.text).join(' | '));
  for (const e of gen.entries) assert.equal(e.cat, SCHEDULE_MARK_CAT, `"${e.text}" belongs to the general filter`);
  assert.equal(gen.counts.categories.gen, gen.entries.length);
  const other = feed([putRow(EXISTING, { eventDate: new Date(EXISTING.eventDate.getTime() + 86400000 * 3) }), eventRow('ORDER_PRINTED', { doc: 'order' })]);
  assert.ok(other.entries.length >= 2 && other.entries.every((e) => e.cat !== 'gen'));
  assert.equal(other.counts.categories.gen, 0);
});
