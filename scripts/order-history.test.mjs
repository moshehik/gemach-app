// Plain-node test of the order-history mapper (lib/history/orderHistory.js).
// No database, no dev server:   node scripts/order-history.test.mjs
// (The repo has no test runner - CLAUDE.md "Commands" - so this is a one-off script that exits
// non-zero when a case fails.)

import assert from 'node:assert/strict';
import {
  buildOrderHistory, paginateEntries, filterByCategory, decodeCursor, encodeCursor, normalizeLimit,
  publicEntry, parseOrderNumber, resolveOrderRef, DEFAULT_LIMIT, MAX_LIMIT, DEDUPE_WINDOW_MS,
} from '../lib/history/orderHistory.js';
import { isUuidShaped } from '../lib/history/labels.js';
import { cleanText, safeNoteText, safeMailError, stripInternalIds, maskCardNumbers } from '../lib/history/sanitize.js';

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`  FAIL ${name}\n       ${String(e.message).split('\n').join('\n       ')}`);
  }
}

const ORDER = { orderId: 100 };
const ORDER_WITH_DATE = { orderId: 100, orderDate: new Date('2026-09-21T07:00:00Z'), employeeId: 'emp-1', employeeName: 'רחל כהן' };
const T = (s) => new Date(`2026-09-2${s[0]}T${s.slice(2)}Z`); // T('3 09:00:00') = 2026-09-23T09:00:00Z
let n = 0;
const row = (over) => ({
  id: `r${++n}`, entityType: 'Order', entityId: 'uuid-1', action: 'UPDATE', employeeId: 'emp-1', employeeName: 'רחל כהן',
  createdAt: T('1 10:00:00'), changesJson: '{}', ...over,
});
const J = (o) => JSON.stringify(o);
const build = (auditRows, extra = {}, options) => buildOrderHistory({ order: ORDER, auditRows, ...extra }, options);
const texts = (r) => r.entries.map(e => e.text);
const only = (r, pred) => r.entries.filter(pred);

console.log('shapes: new-values-only and {from,to}');

test('a CREATE row seeds the baseline: an unchanged save yields nothing, a changed field yields before/after', () => {
  const create = row({ action: 'CREATE', createdAt: T('1 10:00:00'), changesJson: J({ orderId: 100, eventDate: '2026-10-08T00:00:00.000Z', notes: null, isDelivery: false, totalAmount: 500 }) });
  const same = row({ createdAt: T('1 10:05:00'), changesJson: J({ eventDate: '2026-10-08T00:00:00.000Z', notes: null, isDelivery: false, totalAmount: 500 }) });
  const changed = row({ createdAt: T('2 11:00:00'), changesJson: J({ eventDate: '2026-10-09T00:00:00.000Z', notes: 'הערה', isDelivery: false, totalAmount: 500 }) });
  const r = build([create, same, changed]);
  assert.equal(r.noopCount, 1, 'the unchanged save is counted, not hidden');
  const ev = only(r, e => e.text === 'עודכן תאריך האירוע');
  assert.equal(ev.length, 1);
  assert.deepEqual(ev[0].det.slice(0, 2), [['לפני', 'יום חמישי כז תשרי תשפ"ז'], ['אחרי', 'יום שישי כח תשרי תשפ"ז']]);
  assert.equal(ev[0].beforeSource, 'sequence');
  assert.ok(!ev[0].beforeUnknown);
  const notes = only(r, e => e.text === 'הערות ההזמנה עודכנו');
  assert.equal(notes.length, 1);
  assert.deepEqual(notes[0].det, [['לפני', 'ריק'], ['אחרי', 'הערה']]);
});

test('explicit {from,to} rows keep their own before and are marked explicit', () => {
  const r = build([row({ action: 'UPDATE', changesJson: J({ hasSignedRegulations: { from: false, to: true } }) })]);
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].text, 'הלקוח חתם על התקנון');
  assert.equal(r.entries[0].icon, 'sig');
  assert.equal(r.entries[0].beforeSource, 'explicit');
  assert.equal(r.counts.extras.sig, 1);
});

test('a big new-values row with no recorded start says beforeUnknown instead of inventing a change', () => {
  const snap = row({ changesJson: J({ eventDate: '2026-10-08T00:00:00.000Z', returnDate: null, fromDate: null, toDate: null, isAbroad: false, notes: 'x', hasSignedRegulations: true, totalAmount: 900, status: null }) });
  const r = build([snap]);
  assert.equal(r.entries.length, 1);
  const e = r.entries[0];
  assert.equal(e.beforeUnknown, true);
  assert.equal(e.beforeSource, 'unknown');
  assert.equal(e.text, 'ההזמנה נשמרה');
  assert.ok(e.det.some(([k]) => k === 'תאריך האירוע'));
  assert.ok(e.det.every(([, v]) => v !== 'ריק'), 'empty values are not listed');
});

test('a targeted new-values row (total recalculation) is the change even without a recorded before', () => {
  const r = build([row({ changesJson: J({ totalAmount: 750 }) })]);
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].text, 'סכום ההזמנה עודכן');
  assert.equal(r.entries[0].beforeUnknown, true);
  assert.equal(r.entries[0].amt, undefined, 'no delta without a before');
  const r2 = build([row({ createdAt: T('1 10:00:00'), changesJson: J({ totalAmount: 500, notes: null, isDelivery: false, eventDate: null }) }), row({ createdAt: T('1 10:10:00'), changesJson: J({ totalAmount: 750 }) })]);
  const e = only(r2, x => x.text === 'סכום ההזמנה עודכן')[0];
  assert.equal(e.amt, 250);
  assert.equal(e.beforeSource, 'sequence');
});

test('an unknown-start isDeleted:false is not reported as a restore', () => {
  const r = build([row({ changesJson: J({ isDeleted: false }) })]);
  assert.equal(r.entries.filter(e => /שוחזר/.test(e.text)).length, 0);
});

test('delivery and dates are separate lines in their own categories', () => {
  const rows = [
    row({ action: 'CREATE', createdAt: T('1 10:00:00'), changesJson: J({ orderId: 100, eventDate: null, isDelivery: false, deliveryCity: null, deliveryDirection: null, notes: null }) }),
    row({ createdAt: T('1 10:30:00'), changesJson: J({ eventDate: '2026-10-08T00:00:00.000Z', isDelivery: true, deliveryCity: 'ירושלים', deliveryDirection: 'הלוך-חזור', notes: null }) }),
  ];
  const r = build(rows);
  const d = only(r, e => e.cat === 'del')[0];
  assert.equal(d.text, 'נוסף משלוח');
  assert.equal(d.sub, 'הלוך-חזור · ירושלים');
  const dt = only(r, e => e.cat === 'dates')[0];
  assert.equal(dt.text, 'נקבע תאריך האירוע');
});

test('dates are Hebrew only - no Gregorian numbers anywhere in a row', () => {
  const rows = [
    row({ action: 'CREATE', changesJson: J({ orderId: 100, eventDate: '2026-10-08T00:00:00.000Z', orderDate: null }) }),
    row({ createdAt: T('2 11:00:00'), changesJson: J({ eventDate: '2026-10-09T00:00:00.000Z', orderDate: '2026-09-21T07:00:00.000Z' }) }),
  ];
  const r = build(rows);
  const gregorian = /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|\b20\d\d-\d\d-\d\d\b/;
  for (const e of r.entries) {
    for (const s of [e.text, e.sub || '', e.dateHe, ...e.det.flat().map(String)]) assert.ok(!gregorian.test(s), `${e.id}: ${s}`);
  }
  assert.ok(r.entries.every(e => e.dateHe && e.weekdayHe));
});

console.log('dedupe rules');

const cancelRows = () => [
  row({ id: 'auto', entityType: 'Order', entityId: 'uuid-1', action: 'CANCEL_ORDER', createdAt: new Date('2026-09-23T09:00:00.000Z'), changesJson: J({ isDeleted: { from: false, to: true } }) }),
  row({ id: 'hand', entityType: 'Order', entityId: '100', action: 'CANCEL_ORDER', createdAt: new Date('2026-09-23T09:00:00.400Z'), changesJson: J({ isDeleted: { from: false, to: true }, orderId: 100, note: 'ההזמנה בוטלה (2 פריטים, 1 התחייבויות תשלום)' }) }),
  row({ id: 'i1', entityType: 'OrderItem', entityId: 'item-1', action: 'CANCEL_ORDER', createdAt: new Date('2026-09-23T09:00:00.500Z'), changesJson: J({ isDeleted: { from: false, to: true }, note: 'n' }) }),
  row({ id: 'i2', entityType: 'OrderItem', entityId: 'item-2', action: 'CANCEL_ORDER', createdAt: new Date('2026-09-23T09:00:00.500Z'), changesJson: J({ isDeleted: { from: false, to: true }, note: 'n' }) }),
  row({ id: 'o1', entityType: 'PaymentObligation', entityId: 'ob-1', action: 'CANCEL_ORDER', createdAt: new Date('2026-09-23T09:00:00.500Z'), changesJson: J({ isDeleted: { from: false, to: true }, note: 'n' }) }),
];

test('D1/D2: the double CANCEL_ORDER shows once, children are folded, nothing vanishes silently', () => {
  const r = build(cancelRows());
  const c = only(r, e => e.text === 'ההזמנה בוטלה');
  assert.equal(c.length, 1);
  assert.equal(c[0].id, 'a:hand#0', 'the hand-written row (with the note) wins');
  assert.deepEqual(c[0].det, [['פריטים שבוטלו', '2'], ['חיובים שבוטלו', '1']]);
  assert.equal(r.dedupedCount, 4);
  assert.deepEqual(r.dedupedBy, { D1: 1, D2: 3 });
  assert.equal(r.entries.length, 1);
});

test('D1 works when the hand-written row is the older one', () => {
  const rows = cancelRows();
  rows[0].createdAt = new Date('2026-09-23T09:00:01.000Z'); // automatic row now later
  const r = build(rows.slice(0, 2));
  assert.equal(only(r, e => e.text === 'ההזמנה בוטלה')[0].id, 'a:hand#0');
  assert.equal(r.dedupedCount, 1);
});

test('two cancels far apart are NOT merged (a restore/cancel cycle)', () => {
  const rows = [
    row({ id: 'c1', entityId: '100', action: 'CANCEL_ORDER', createdAt: T('3 09:00:00'), changesJson: J({ isDeleted: { from: false, to: true }, note: 'a' }) }),
    row({ id: 'c2', entityId: '100', action: 'CANCEL_ORDER', createdAt: T('4 09:00:00'), changesJson: J({ isDeleted: { from: false, to: true }, note: 'b' }) }),
  ];
  const r = build(rows);
  assert.equal(r.entries.length, 2);
  assert.equal(r.dedupedCount, 0);
});

test('D3/D5: refund execution shows the money once (payment row), not ADD_PAYMENT + EXECUTE as well', () => {
  const rows = [
    row({ id: 'ex', entityType: 'Refund', entityId: 'rf-1', action: 'EXECUTE', createdAt: new Date('2026-09-23T10:00:00.000Z'), changesJson: J({ isExecuted: { from: false, to: true } }) }),
    row({ id: 'pc', entityType: 'Payment', entityId: 'pay-9', action: 'CREATE', createdAt: new Date('2026-09-23T10:00:00.200Z'), changesJson: J({ amount: -45, paymentMethod: 'החזר/זיכוי', isRefund: true, notes: 'החזר ללקוח (בנק 12 סניף 345 חשבון 999888)' }) }),
    row({ id: 'ap', entityType: 'Order', entityId: '100', action: 'ADD_PAYMENT', createdAt: new Date('2026-09-23T10:00:00.400Z'), changesJson: J({ amount: -45, note: 'Refund' }) }),
  ];
  const r = build(rows, { refunds: [{ id: 'rf-1', amount: 45, isExecuted: true, createdAt: T('2 08:00:00') }] });
  assert.deepEqual(r.dedupedBy, { D3: 1, D5: 1 });
  const paid = only(r, e => e.text.startsWith('הוחזר ללקוח'));
  assert.equal(paid.length, 1);
  assert.equal(paid[0].amt, -45);
  assert.equal(paid[0].kind, 'refund');
  assert.ok(!JSON.stringify(r.entries.map(publicEntry)).includes('999888'), 'bank account never reaches the feed');
  assert.equal(paid[0].sub, 'החזר ללקוח (פרטי הבנק אינם מוצגים)');
});

test('D4: REMOVE_PAYMENT next to the payment UPDATE {isDeleted:true} shows once', () => {
  const rows = [
    row({ id: 'pc', entityType: 'Payment', entityId: 'pay-9', action: 'CREATE', createdAt: T('1 10:00:00'), changesJson: J({ amount: 100, paymentMethod: 'מזומן', isDeleted: false }) }),
    row({ id: 'pu', entityType: 'Payment', entityId: 'pay-9', action: 'UPDATE', createdAt: new Date('2026-09-22T10:00:00.000Z'), changesJson: J({ isDeleted: true }) }),
    row({ id: 'rp', entityType: 'Order', entityId: '100', action: 'REMOVE_PAYMENT', createdAt: new Date('2026-09-22T10:00:00.300Z'), changesJson: J({ paymentId: 'pay-9', note: 'x' }) }),
  ];
  const r = build(rows);
  assert.deepEqual(r.dedupedBy, { D4: 1 });
  assert.equal(only(r, e => /בוטל/.test(e.text)).length, 1);
});

test('a REMOVE_PAYMENT with no matching payment row is kept', () => {
  const r = build([row({ id: 'rp', action: 'REMOVE_PAYMENT', changesJson: J({ paymentId: 'pay-x', note: 'n' }) })]);
  assert.equal(r.entries.length, 1);
  assert.equal(r.dedupedCount, 0);
});

test('the dedupe window is the documented one', () => {
  assert.equal(DEDUPE_WINDOW_MS, 5000);
});

console.log('payments, sanitising, tables');

const NEDARIM = J({ LastNum: '4432', Tokef: '0129', Zeout: '123456789', Mail: 'a@b.c', Phone: '0501234567', Adresse: 'רחוב 1', Tashloumim: '3', ClientName: 'ישראל ישראלי', 'הערות משתמש': 'תשלום ראשון' });

test('a card payment keeps last 4 digits + instalments, nothing else from the Nedarim JSON', () => {
  const r = build([row({ entityType: 'Payment', entityId: 'p1', action: 'CREATE', changesJson: J({ amount: 230, paymentMethod: 'אשראי', notes: NEDARIM, customerId: 'cust-uuid-1', isDeleted: false }) })]);
  assert.equal(r.entries.length, 1);
  const e = r.entries[0];
  assert.equal(e.text, 'התקבל תשלום באשראי');
  assert.equal(e.sub, 'ספרות 4432');
  assert.equal(e.amt, 230);
  assert.equal(e.kind, 'pay');
  const dump = JSON.stringify(publicEntry(e));
  for (const secret of ['123456789', 'a@b.c', '0501234567', 'ישראלי', '0129', 'cust-uuid-1']) assert.ok(!dump.includes(secret), secret);
});

test('payments that never got an audit row come from the table (with the same sanitising)', () => {
  const r = build([], { payments: [{ id: 'p2', amount: 150, paymentMethod: 'מזומן', notes: null, paymentDate: new Date('2026-09-22T00:00:00Z'), isDeleted: false }, { id: 'p3', amount: 60, paymentMethod: 'אשראי', notes: NEDARIM, paymentDate: new Date('2026-09-22T05:00:00Z'), isDeleted: false }] });
  assert.equal(r.entries.length, 2);
  const cash = only(r, e => e.id === 't:payment:p2')[0];
  assert.equal(cash.src, 'Payment');
  assert.equal(cash.dateOnly, true, 'midnight UTC = a date without a time');
  assert.equal(cash.whoKnown, false);
  assert.ok(!JSON.stringify(r.entries).includes('123456789'));
});

test('a payment with an audit CREATE is not added a second time from the table', () => {
  const create = row({ entityType: 'Payment', entityId: 'p1', action: 'CREATE', changesJson: J({ amount: 50, paymentMethod: 'מזומן' }) });
  const r = build([create], { payments: [{ id: 'p1', amount: 50, paymentMethod: 'מזומן', paymentDate: new Date('2026-09-21T10:00:00Z') }] });
  assert.equal(only(r, e => e.cat === 'pay').length, 1);
});

test('payment UPDATE churn: identical re-saves are counted as no-ops; a baseline-less one is hidden bookkeeping', () => {
  const rows = [
    row({ entityType: 'Payment', entityId: 'p1', action: 'CREATE', createdAt: T('1 10:00:00'), changesJson: J({ amount: 50, paymentMethod: 'מזומן', notes: '', isDeleted: false }) }),
    row({ entityType: 'Payment', entityId: 'p1', action: 'UPDATE', createdAt: T('1 11:00:00'), changesJson: J({ amount: 50, paymentMethod: 'מזומן', notes: '', isDeleted: false }) }),
    row({ entityType: 'Payment', entityId: 'p9', action: 'UPDATE', createdAt: T('1 12:00:00'), changesJson: J({ amount: 70, paymentMethod: 'מזומן', notes: '', isDeleted: false }) }),
  ];
  const r = build(rows);
  assert.equal(r.noopCount, 1);
  assert.equal(r.hiddenSystemCount, 1);
  const withSystem = build(rows, {}, { includeSystem: true });
  assert.equal(only(withSystem, e => e.system).length, 1);
  assert.equal(only(withSystem, e => e.system)[0].beforeUnknown, true);
});

test('CANCEL_PAYMENT / RESTORE_PAYMENT reverse and restore the amount', () => {
  const r = build([
    row({ entityType: 'Payment', entityId: 'p1', action: 'CANCEL_PAYMENT', createdAt: T('1 10:00:00'), changesJson: J({ isDeleted: true, amount: 80, paymentMethod: 'מזומן', notes: '' }) }),
    row({ entityType: 'Payment', entityId: 'p1', action: 'RESTORE_PAYMENT', createdAt: T('1 10:05:00'), changesJson: J({ isDeleted: false, amount: 80, paymentMethod: 'מזומן', notes: '' }) }),
  ]);
  assert.equal(r.entries[0].amt, 80);
  assert.equal(r.entries[1].amt, -80);
});

test('refund bank details are never printed; a bank edit is stated without values', () => {
  const rows = [
    row({ entityType: 'Refund', entityId: 'rf-1', action: 'CREATE', createdAt: T('1 10:00:00'), changesJson: J({ amount: 300, reason: 'טעות', bankName: 'לאומי', bankBranch: '800', bankAccount: '55667788', bankAccountName: 'ישראל ישראלי', email: 'x@y.z', orderId: 100, customerId: 'c' }) }),
    row({ entityType: 'Refund', entityId: 'rf-1', action: 'UPDATE', createdAt: T('1 11:00:00'), changesJson: J({ bankName: 'פועלים', bankAccount: '11223344' }) }),
  ];
  const r = build(rows);
  const dump = JSON.stringify(r.entries.map(publicEntry));
  for (const secret of ['לאומי', '800', '55667788', 'ישראלי', 'x@y.z', 'פועלים', '11223344']) assert.ok(!dump.includes(secret), secret);
  assert.ok(texts(r).includes('פרטי הבנק לזיכוי עודכנו'));
});

test('EMAIL_SENT shows recipient + file names but never Drive links; who stays unknown when the row has no employee', () => {
  const r = build([row({ action: 'EMAIL_SENT', employeeId: null, employeeName: null, changesJson: J({ subject: 'הזמנה #100 - גמח', to: 'lady@example.com', type: 'rental', sendMode: 'attach', files: [{ fileName: 'הזמנה 100.pdf', sizeBytes: 10, dest: 'attach' }], driveLinks: [{ url: 'https://drive.google.com/secret' }] }) })]);
  const e = r.entries[0];
  assert.equal(e.text, 'נשלח מייל השכרה');
  assert.equal(e.icon, 'mail');
  assert.equal(e.who, null);
  assert.equal(e.whoKnown, false);
  assert.ok(e.det.some(([k, v]) => k === 'קבצים' && v.includes('הזמנה 100.pdf')));
  assert.ok(!JSON.stringify(e).includes('drive.google.com'));
});

test('charge descriptions lose internal item ids', () => {
  const id = '3f2b8c1e-1111-4222-8333-444455556666';
  const r = build([row({ entityType: 'PaymentObligation', entityId: 'ob-1', action: 'CANCEL_OBLIGATION', changesJson: J({ isDeleted: true, description: `שמלה מידה 38 (פריט #${id})`, amount: 150 }) })]);
  assert.ok(!JSON.stringify(r.entries).includes(id));
  assert.match(r.entries[0].text, /שמלה מידה 38/);
});

test('engine charge bookkeeping is hidden by default, counted, and available with includeSystem', () => {
  const rows = [
    row({ entityType: 'PaymentObligation', entityId: 'ob-1', action: 'CREATE', createdAt: T('1 10:00:00'), changesJson: J({ amount: 150, description: 'השכרת שמלה', isManual: false, orderId: 100 }) }),
    row({ entityType: 'PaymentObligation', entityId: 'ob-2', action: 'CREATE', createdAt: T('1 10:01:00'), changesJson: J({ amount: 40, description: 'חיוב ידני', isManual: true, orderId: 100 }) }),
  ];
  const r = build(rows);
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].text, 'נוסף חיוב ידני: חיוב ידני');
  assert.equal(r.hiddenSystemCount, 1);
  assert.equal(build(rows, {}, { includeSystem: true }).entries.length, 2);
});

test('items: rented / returned rows come from audit; legacy dates from the table only when no audit row exists', () => {
  const items = [
    { id: 'i1', sizeText: '38', prefix: 4512, modelName: 'רוני', takenDate: new Date('2026-10-06T07:00:00Z'), isReturned: true, returnedOk: true, returnDate: new Date('2026-10-11T07:00:00Z') },
    { id: 'i2', sizeText: '40', prefix: 3087, takenDate: new Date('2026-10-05T21:00:00Z') },
  ];
  const rows = [row({ entityType: 'OrderItem', entityId: 'i1', action: 'CONFIRM_RENTAL', createdAt: T('1 10:00:00'), changesJson: J({ isTaken: { from: false, to: true }, takenDate: { from: null, to: '2026-10-06T07:00:00.000Z' } }) })];
  const r = build(rows, { items });
  assert.equal(only(r, e => e.text === 'נלקח: דגם 4512, מידה 38').length, 1, 'audit row, no table duplicate');
  assert.equal(only(r, e => e.text === 'נלקח: דגם 3087, מידה 40')[0].src, 'OrderItem');
  assert.equal(only(r, e => e.text === 'נלקח: דגם 3087, מידה 40')[0].dateOnly, true, '21:00Z is an Israel-midnight legacy date');
  assert.equal(only(r, e => e.text === 'הוחזר: דגם 4512, מידה 38').length, 1);
});

test('item cancel / restore / size change / alteration lines', () => {
  const items = [{ id: 'i1', sizeText: '40', prefix: 4512, modelName: 'רוני' }];
  const rows = [
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CREATE', createdAt: T('1 10:00:00'), changesJson: J({ sizeText: '38', neckAlteration: 0, sleeveAlteration: 1, finalPrice: 0 }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'UPDATE', createdAt: T('1 10:10:00'), changesJson: J({ sizeText: { from: '38', to: '40' } }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'UPDATE', createdAt: T('1 10:20:00'), changesJson: J({ sizeText: '40', neckAlteration: 1, sleeveAlteration: 1, alterationDone: false }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CANCEL_ITEM', createdAt: T('1 10:30:00'), changesJson: J({ sizeText: '40', isDeleted: true }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'RESTORE_ITEM', createdAt: T('1 10:40:00'), changesJson: J({ sizeText: '40', isDeleted: false }) }),
  ];
  const r = build(rows, { items });
  assert.deepEqual(texts(r).reverse().slice(0, 1), ['נוסף פריט: דגם 4512, מידה 38']);
  assert.ok(texts(r).some(t => t.startsWith('הוחלפה מידה')));
  assert.ok(texts(r).includes('עודכן תיקון: דגם 4512, מידה 40'));
  assert.ok(texts(r).includes('הוסר פריט: דגם 4512, מידה 40'));
  assert.ok(texts(r).includes('שוחזר פריט: דגם 4512, מידה 40'));
  const alt = only(r, e => e.text.startsWith('עודכן תיקון'))[0];
  assert.deepEqual(alt.det.filter(([k]) => k === 'תיקון צוואר'), [['תיקון צוואר', 'לא ← כן']]);
});

test('legacy Access card note ("5537 | מס_אישור: … | מערכת: {json}") keeps only the last four digits', () => {
  const legacy = '5537 | מס_אישור: 1234567 | מערכת: { "Status" : "OK" , "Zeout" : "123456789" , "Mail" : "a@b.c" , "ClientName" : "ישראל" }';
  const r = build([], { payments: [{ id: 'p1', amount: 190, paymentMethod: 'נדרים פלוס דרך תכנה', notes: legacy, paymentDate: new Date('2026-05-01T08:50:00Z') }, { id: 'p2', amount: 50, paymentMethod: 'אשראי', notes: 'תודה! 5537 | מס_אישור: 99 | מערכת: { "Zeout" : "1" }', paymentDate: new Date('2026-05-02T08:50:00Z') }] });
  const dump = JSON.stringify(r.entries.map(publicEntry));
  for (const secret of ['1234567', '123456789', 'a@b.c', 'ישראל', 'Status', 'Zeout', 'מס_אישור']) assert.ok(!dump.includes(secret), secret);
  const e = only(r, x => x.id === 't:payment:p1')[0];
  assert.equal(e.sub, 'ספרות 5537');
  assert.equal(e.text, 'התקבל תשלום באשראי (נדרים פלוס)');
  assert.equal(only(r, x => x.id === 't:payment:p2')[0].sub, 'תודה! 5537');
});

test('D6: an item added / resized twice by old code (generic + detailed row) shows once, the explicit row wins', () => {
  const items = [{ id: 'i1', sizeText: '40', prefix: 190 }];
  const rows = [
    row({ id: 'c1', entityType: 'OrderItem', entityId: 'i1', action: 'CREATE', createdAt: new Date('2026-09-21T10:00:00.000Z'), changesJson: J({ sizeText: '44' }) }),
    row({ id: 'c2', entityType: 'OrderItem', entityId: 'i1', action: 'CREATE', createdAt: new Date('2026-09-21T10:00:00.300Z'), changesJson: J({ sizeText: '44' }) }),
    row({ id: 'u1', entityType: 'OrderItem', entityId: 'i1', action: 'UPDATE', createdAt: new Date('2026-09-21T11:00:00.000Z'), changesJson: J({ sizeText: '40', neckAlteration: 0 }) }),
    row({ id: 'u2', entityType: 'OrderItem', entityId: 'i1', action: 'UPDATE', createdAt: new Date('2026-09-21T11:00:00.200Z'), changesJson: J({ sizeText: { from: '44', to: '40' } }) }),
  ];
  const r = build(rows, { items });
  assert.equal(only(r, e => e.text.startsWith('נוסף פריט')).length, 1);
  const resized = only(r, e => e.text.startsWith('הוחלפה מידה'));
  assert.equal(resized.length, 1);
  assert.equal(resized[0].beforeSource, 'explicit');
  assert.deepEqual(r.dedupedBy, { D6: 2 });
});

test('D6 does not merge identical lines that are far apart or on different records', () => {
  const rows = [
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CANCEL_RENTAL', createdAt: T('1 10:00:00'), changesJson: J({ isTaken: { from: true, to: false } }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CANCEL_RENTAL', createdAt: T('1 10:10:00'), changesJson: J({ isTaken: { from: true, to: false } }) }),
    row({ entityType: 'OrderItem', entityId: 'i2', action: 'CANCEL_RENTAL', createdAt: T('1 10:10:00'), changesJson: J({ isTaken: { from: true, to: false } }) }),
  ];
  assert.equal(build(rows).entries.length, 3);
});

test('D7: a stale client total followed by the engine putting it back cancels out; a real change survives', () => {
  const base = row({ action: 'CREATE', createdAt: T('1 09:00:00'), changesJson: J({ orderId: 100, totalAmount: 385, notes: null }) });
  const stale = row({ createdAt: new Date('2026-09-21T10:00:00.000Z'), changesJson: J({ totalAmount: 195 }) });
  const back = row({ createdAt: new Date('2026-09-21T10:00:02.000Z'), changesJson: J({ totalAmount: 385 }) });
  const real = row({ createdAt: new Date('2026-09-21T12:00:00.000Z'), changesJson: J({ totalAmount: 500 }) });
  const r = build([base, stale, back, real]);
  assert.deepEqual(r.dedupedBy, { D7: 2 });
  const tot = only(r, e => e.text === 'סכום ההזמנה עודכן');
  assert.equal(tot.length, 1);
  assert.equal(tot[0].amt, 115);
});

test('D5 also covers the automatic Refund UPDATE {isExecuted:true} written next to the refund payment', () => {
  const rows = [
    row({ id: 'ru', entityType: 'Refund', entityId: 'rf-1', action: 'UPDATE', createdAt: new Date('2026-09-23T10:00:00.000Z'), changesJson: J({ isExecuted: true, executedBy: '12' }) }),
    row({ id: 'pc', entityType: 'Payment', entityId: 'pay-9', action: 'CREATE', createdAt: new Date('2026-09-23T10:00:00.200Z'), changesJson: J({ amount: -45, paymentMethod: 'החזר/זיכוי', isRefund: true }) }),
  ];
  const r = build(rows, { refunds: [{ id: 'rf-1', amount: 45 }] });
  assert.deepEqual(r.dedupedBy, { D5: 1 });
  assert.equal(r.entries.length, 1);
});

test('a soft-deleted order with no cancel row in the log still shows a cancel line (from the table)', () => {
  const noRow = buildOrderHistory({ order: { orderId: 100, isDeleted: true, deletedAt: new Date('2026-09-22T10:00:00Z') }, auditRows: [] });
  assert.equal(noRow.entries.length, 1);
  assert.equal(noRow.entries[0].text, 'ההזמנה בוטלה');
  assert.equal(noRow.entries[0].src, 'Order');
  const withRow = buildOrderHistory({ order: { orderId: 100, isDeleted: true, deletedAt: new Date('2026-09-22T10:00:00Z') }, auditRows: [row({ action: 'CANCEL_ORDER', entityId: '100', changesJson: J({ note: 'x', isDeleted: { from: false, to: true } }) })] });
  assert.equal(withRow.entries.length, 1);
  assert.equal(withRow.entries[0].src, 'audit');
});

test('an item size edit written as {from,to} labels the item with the NEW size, not "[object Object]"', () => {
  const r = build([row({ entityType: 'OrderItem', entityId: 'i1', action: 'UPDATE', changesJson: J({ sizeText: { from: '38', to: '40' }, neckAlteration: { from: 0, to: 1 } }) })], { items: [{ id: 'i1', sizeText: '40', prefix: 4512 }] });
  assert.ok(!JSON.stringify(r.entries).includes('[object Object]'));
  assert.ok(r.entries.some(e => e.text === 'עודכן תיקון: דגם 4512, מידה 40'));
});

test('debt approval: a non-positive recorded amount is not called a debt', () => {
  const r = build([row({ action: 'DEBT_APPROVED', changesJson: J({ approvedDebtAmount: -190 }) }), row({ action: 'DEBT_APPROVED', createdAt: T('2 10:00:00'), changesJson: J({ approvedDebtAmount: 82 }) })]);
  const [newer, older] = r.entries;
  assert.equal(newer.sub, 'חוב שאושר ₪82');
  assert.equal(older.sub, undefined);
  assert.equal(older.det[0][1], '-₪190');
});

test('unmapped actions are shown generically and counted', () => {
  const r = build([row({ action: 'SOME_NEW_ACTION' })]);
  assert.equal(r.unmappedCount, 1);
  assert.equal(r.entries[0].unmapped, true);
});

test('a row with unreadable JSON never throws', () => {
  const r = build([row({ changesJson: 'not json' }), row({ entityType: 'Payment', entityId: 'p', changesJson: null })]);
  assert.ok(Array.isArray(r.entries));
});

console.log('ordering, counts, paging');

test('empty input', () => {
  const r = buildOrderHistory({ order: { orderId: 1 }, auditRows: [] });
  assert.deepEqual(r.entries, []);
  assert.equal(r.counts.all, 0);
  assert.equal(r.dedupedCount, 0);
  assert.deepEqual(paginateEntries(r.entries, {}), { entries: [], nextCursor: null });
  assert.doesNotThrow(() => buildOrderHistory({ order: { orderId: 1 } }));
});

test('newest first; same-instant rows keep a stable order; counts add up', () => {
  const rows = [
    row({ entityType: 'Payment', entityId: 'p1', action: 'CREATE', createdAt: T('1 10:00:00'), changesJson: J({ amount: 10, paymentMethod: 'מזומן' }) }),
    row({ action: 'EMAIL_SENT', createdAt: T('3 10:00:00'), changesJson: J({ to: 'a@b.c', type: 'order', files: [] }) }),
    row({ action: 'CANCEL_CHANGES', createdAt: T('2 10:00:00'), changesJson: J({ discarded: 'הערות' }) }),
  ];
  const r = build(rows);
  const ts = r.entries.map(e => e.ts);
  assert.deepEqual(ts, [...ts].sort().reverse());
  assert.equal(r.counts.all, r.entries.length);
  assert.equal(Object.values(r.counts.categories).reduce((a, b) => a + b, 0), r.entries.length);
  assert.equal(build(rows).entries.map(e => e.id).join(), build(rows).entries.map(e => e.id).join());
});

test('the entry carries Israel time, not UTC', () => {
  const r = build([row({ action: 'CANCEL_CHANGES', createdAt: new Date('2026-09-23T21:30:00Z'), changesJson: J({}) })]);
  assert.equal(r.entries[0].day, '2026-09-24');
  assert.equal(r.entries[0].time, '00:30');
});

test('paging: limit cap, cursor round-trip, no repeats or gaps, category filter', () => {
  const rows = [];
  for (let i = 0; i < 25; i++) rows.push(row({ entityType: 'Payment', entityId: `p${i}`, action: 'CREATE', createdAt: new Date(Date.UTC(2026, 8, 21, 8, i)), changesJson: J({ amount: 10 + i, paymentMethod: 'מזומן' }) }));
  rows.push(row({ action: 'EMAIL_SENT', createdAt: new Date(Date.UTC(2026, 8, 22, 8, 0)), changesJson: J({ to: 'a@b.c' }) }));
  const r = build(rows);
  assert.equal(normalizeLimit(undefined), DEFAULT_LIMIT);
  assert.equal(normalizeLimit('5000'), MAX_LIMIT);
  assert.equal(normalizeLimit('-3'), DEFAULT_LIMIT);
  const seen = [];
  let cursor = null;
  let pages = 0;
  do {
    const p = paginateEntries(r.entries, { limit: 10, cursor });
    seen.push(...p.entries.map(e => e.id));
    cursor = p.nextCursor;
    pages++;
    assert.ok(pages < 10);
  } while (cursor);
  assert.equal(pages, 3);
  assert.deepEqual(seen, r.entries.map(e => e.id));
  assert.equal(new Set(seen).size, seen.length);
  assert.ok(!('_at' in paginateEntries(r.entries, { limit: 1 }).entries[0]));
  assert.equal(filterByCategory(r.entries, ['docs']).length, 1);
  assert.equal(filterByCategory(r.entries, ['mail']).length, 1);
  assert.equal(filterByCategory(r.entries, []).length, r.entries.length);
  assert.equal(decodeCursor('###'), undefined);
  assert.equal(decodeCursor(''), null);
  assert.deepEqual(decodeCursor(encodeCursor({ _at: 5, id: 'x' })), { at: 5, id: 'x' });
  assert.equal(publicEntry({ _at: 1, _ord: 2, _sub: 3, id: 'x' }).id, 'x');
});

test('a cursor whose entry disappeared falls back to its timestamp', () => {
  const rows = [1, 2, 3].map(i => row({ action: 'CANCEL_CHANGES', createdAt: new Date(Date.UTC(2026, 8, 21, 8, i)), changesJson: J({ discarded: 'x' }) }));
  const r = build(rows);
  const cur = encodeCursor({ _at: Date.UTC(2026, 8, 21, 8, 2) + 30000, id: 'gone' });
  const p = paginateEntries(r.entries, { limit: 10, cursor: cur });
  assert.equal(p.entries.length, 2); // minutes 2 and 1 are older than the cursor time
});

test('order created line: audit CREATE wins; otherwise orderDate + creator from the table', () => {
  const withAudit = build([row({ action: 'CREATE', changesJson: J({ orderId: 100 }) })]);
  assert.equal(only(withAudit, e => e.text === 'ההזמנה נוצרה').length, 1);
  assert.equal(only(withAudit, e => e.src === 'Order').length, 0);
  const without = buildOrderHistory({ order: ORDER_WITH_DATE, auditRows: [] });
  const e = only(without, x => x.text === 'ההזמנה נוצרה')[0];
  assert.equal(e.src, 'Order');
  assert.equal(e.who, 'רחל כהן');
});

test('print visits and failed e-mails appear only when passed in', () => {
  const none = build([]);
  assert.equal(only(none, e => e.icon === 'print' || e.icon === 'mail').length, 0);
  const some = build([], {
    printVisits: [{ id: 'v1', timestamp: T('2 10:00:00'), employeeName: 'דוד לוי' }],
    emailLogs: [{ id: 'm1', to: 'a@b.c', subject: 'הזמנה #100 - גמח', status: 'error', errorMessage: 'boom', sentAt: T('2 11:00:00') }, { id: 'm2', to: 'a@b.c', status: 'success', sentAt: T('2 12:00:00') }],
  });
  assert.equal(some.counts.extras.print, 1);
  assert.equal(some.counts.extras.mail, 1, 'only the failed send; a successful one has its EMAIL_SENT audit row');
});


// ---------------------------------------------------------------------------------------------------
// Review fixes (foundation review B3, B4, R14, R15, R16, R18): each block failed against the previous code.
// ---------------------------------------------------------------------------------------------------
console.log('review fixes');

test('B3: remove / restore / remove of an item within 5 s is three lines - the final removal is not merged away', () => {
  const items = [{ id: 'i1', sizeText: '40', prefix: 4512 }];
  const rows = [
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CANCEL_ITEM', createdAt: new Date('2026-09-21T10:00:00.000Z'), changesJson: J({ sizeText: '40', isDeleted: true }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'RESTORE_ITEM', createdAt: new Date('2026-09-21T10:00:02.000Z'), changesJson: J({ sizeText: '40', isDeleted: false }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CANCEL_ITEM', createdAt: new Date('2026-09-21T10:00:04.000Z'), changesJson: J({ sizeText: '40', isDeleted: true }) }),
  ];
  const r = build(rows, { items });
  assert.deepEqual(texts(r), ['הוסר פריט: דגם 4512, מידה 40', 'שוחזר פריט: דגם 4512, מידה 40', 'הוסר פריט: דגם 4512, מידה 40']);
  assert.equal(r.dedupedBy.D6, undefined);
});

test('B3: payment cancel / restore / cancel within 5 s keeps all three lines (named and UPDATE-isDeleted forms)', () => {
  const at = (s) => new Date(`2026-09-21T10:00:0${s}.000Z`);
  const named = build([
    row({ entityType: 'Payment', entityId: 'p1', action: 'CANCEL_PAYMENT', createdAt: at(0), changesJson: J({ isDeleted: true, amount: 80, paymentMethod: 'מזומן' }) }),
    row({ entityType: 'Payment', entityId: 'p1', action: 'RESTORE_PAYMENT', createdAt: at(2), changesJson: J({ isDeleted: false, amount: 80, paymentMethod: 'מזומן' }) }),
    row({ entityType: 'Payment', entityId: 'p1', action: 'CANCEL_PAYMENT', createdAt: at(4), changesJson: J({ isDeleted: true, amount: 80, paymentMethod: 'מזומן' }) }),
  ]);
  assert.equal(texts(named).filter((t) => t.startsWith('תשלום בוטל')).length, 2);
  assert.equal(texts(named).filter((t) => t.startsWith('תשלום שוחזר')).length, 1);
  const plain = build([
    row({ entityType: 'Payment', entityId: 'p2', action: 'UPDATE', createdAt: at(0), changesJson: J({ isDeleted: { from: false, to: true }, amount: 80 }) }),
    row({ entityType: 'Payment', entityId: 'p2', action: 'UPDATE', createdAt: at(2), changesJson: J({ isDeleted: { from: true, to: false }, amount: 80 }) }),
    row({ entityType: 'Payment', entityId: 'p2', action: 'UPDATE', createdAt: at(4), changesJson: J({ isDeleted: { from: false, to: true }, amount: 80 }) }),
  ]);
  assert.equal(plain.entries.filter((e) => e.text.startsWith('תשלום')).length, 3);
});

test('B4: a card number typed with spaces or dashes is masked in payment notes (Nedarim user note and staff note)', () => {
  const nedarim = JSON.stringify({ LastNum: '9012', Tashloumim: 1, 'הערות משתמש': 'כרטיס 4580 1234 5678 9012 של הבעל' });
  const r = build([], { payments: [
    { id: 'p1', amount: 190, paymentMethod: 'אשראי', notes: nedarim, paymentDate: new Date('2026-05-01T08:50:00Z') },
    { id: 'p2', amount: 50, paymentMethod: 'מזומן', notes: 'לקוחה שילמה בכרטיס 4580-1234-5678-9012 וחשבון 99887', paymentDate: new Date('2026-05-02T08:50:00Z') },
  ] });
  const dump = JSON.stringify(r.entries.map(publicEntry));
  for (const secret of ['4580', '1234 5678', '5678', '99887']) assert.ok(!dump.includes(secret), secret);
  assert.ok(dump.includes('ספרות 9012'));
});

test('B4: order notes with a full card number are masked; ordinary numbers survive', () => {
  const create = row({ action: 'CREATE', createdAt: T('1 10:00:00'), changesJson: J({ orderId: 100, notes: null }) });
  const save = row({ createdAt: T('1 10:05:00'), changesJson: J({ notes: 'לחייב כרטיס 4580 1234 5678 9012, להביא 3 שמלות עד 16.9' }) });
  const e = only(build([create, save]), (x) => x.text === 'הערות ההזמנה עודכנו')[0];
  const after = e.det.find(([k]) => k === 'אחרי')[1];
  assert.ok(!after.includes('5678') && after.includes('3 שמלות') && after.includes('16.9'), after);
});

test('R15: refund reason (audit CREATE row and table-only refund) is redacted', () => {
  const create = build([row({ entityType: 'Refund', entityId: 'rf1', action: 'CREATE', changesJson: J({ amount: 60, reason: 'להעביר לחשבון 99887766' }) })]);
  assert.ok(!JSON.stringify(create.entries).includes('99887766'));
  const table = build([], { refunds: [{ id: 'rf2', amount: 60, reason: 'החזר ללקוח (בנק 12 סניף 345 חשבון 999888)', createdAt: new Date('2026-09-15T00:00:00Z') }] });
  assert.ok(!JSON.stringify(table.entries).includes('999888'));
  assert.ok(JSON.stringify(table.entries).includes('פרטי הבנק אינם מוצגים'));
});

test('R15: the refund-flow note on a REMOVE_PAYMENT row does not print the bank account', () => {
  const r = build([row({ action: 'REMOVE_PAYMENT', changesJson: J({ note: 'החזר ללקוח (בנק 12 סניף 345 חשבון 999888)' }) })]);
  assert.ok(!JSON.stringify(r.entries).includes('999888'));
});

test('R16: a failed order e-mail shows a generic reason, not the SMTP account / address', () => {
  const r = build([], { emailLogs: [{ id: 'm1', to: 'a@b.c', subject: 'הזמנה #100 - גמח', status: 'error', errorMessage: 'Invalid login: 535 user gemach.office@gmail.com rejected by smtp.gmail.com', sentAt: T('2 11:00:00') }] });
  const err = r.entries[0].det.find(([k]) => k === 'שגיאה')[1];
  assert.ok(err.startsWith('שליחה נכשלה'));
  for (const secret of ['gemach.office', 'gmail', '535']) assert.ok(!err.includes(secret), secret);
});

test('R14: a missing cursor entry (category filter changed) resumes at the exact position - same-timestamp entries are not skipped', () => {
  const same = new Date('2026-09-21T10:00:00.000Z');
  const rows = [];
  for (let i = 0; i < 6; i += 1) rows.push(row({ action: 'CANCEL_CHANGES', createdAt: same, changesJson: J({ discarded: `x${i}` }) }));
  // one more, in another category, at the same instant
  rows.push(row({ action: 'EMAIL_SENT', createdAt: same, changesJson: J({ to: 'a@b.c' }) }));
  const r = build(rows);
  const all = r.entries;
  assert.equal(new Set(all.map((e) => e._at)).size, 1, 'everything shares one instant');
  // page 1 over the whole feed, then page 2 over a list that no longer contains the cursor's entry
  const p1 = paginateEntries(all, { limit: 3 });
  const cursorEntry = all[2];
  const without = all.filter((e) => e.id !== cursorEntry.id);
  const p2 = paginateEntries(without, { limit: 10, cursor: p1.nextCursor });
  assert.deepEqual(p2.entries.map((e) => e.id), all.slice(3).map((e) => e.id), 'exactly the entries after the cursor position');
});

test('R14: a cursor issued before positions existed still resumes without skipping', () => {
  const same = new Date('2026-09-21T10:00:00.000Z');
  const r = build([1, 2, 3].map((i) => row({ action: 'CANCEL_CHANGES', createdAt: same, changesJson: J({ discarded: `x${i}` }) })));
  const old = Buffer.from(JSON.stringify([same.getTime(), 'gone'])).toString('base64url');
  assert.equal(paginateEntries(r.entries, { limit: 10, cursor: old }).entries.length, 3);
});

test('R18: an order number above INT4 (or below 1, or not a number) is "not found", never a database query', () => {
  assert.equal(parseOrderNumber('28315'), 28315);
  assert.equal(parseOrderNumber('2147483647'), 2147483647);
  assert.equal(parseOrderNumber('2147483648'), null);
  assert.equal(parseOrderNumber('3000000000'), null);
  assert.equal(parseOrderNumber('0'), null);
  assert.equal(parseOrderNumber('-5'), null);
  assert.equal(parseOrderNumber('abc'), null);
  assert.equal(parseOrderNumber(''), null);
  assert.equal(parseOrderNumber('99999999999999999999999'), null);
});

test('R13 stays as documented: D7 still nets out a revert, and dedupedBy exposes every rule that fired', () => {
  const base = row({ action: 'CREATE', createdAt: T('1 09:00:00'), changesJson: J({ orderId: 100, totalAmount: 385, notes: null }) });
  const stale = row({ createdAt: new Date('2026-09-21T10:00:00.000Z'), changesJson: J({ totalAmount: 195 }) });
  const back = row({ createdAt: new Date('2026-09-21T10:00:05.000Z'), changesJson: J({ totalAmount: 385 }) });
  const r = build([base, stale, back]);
  assert.deepEqual(r.dedupedBy, { D7: 2 });
  assert.equal(r.dedupedCount, 2);
});

// ---------------------------------------------------------------------------------------------------
// Review round 2 (fix3): ORD-1 .. ORD-4. Each block failed against the previous code.
// ---------------------------------------------------------------------------------------------------
console.log('review round 2');

test('ORD-1: cancel / restore / cancel within the D1 window keeps both cancels - the feed ends in the right state', () => {
  const cancel = (id, ms, note) => row({ id, entityId: '100', action: 'CANCEL_ORDER', createdAt: new Date(Date.parse('2026-09-23T09:00:00.000Z') + ms), changesJson: J({ isDeleted: { from: false, to: true }, note }) });
  const restoreFromTo = row({ id: 'rs', entityId: 'uuid-1', action: 'UPDATE', createdAt: new Date('2026-09-23T09:00:02.000Z'), changesJson: J({ isDeleted: { from: true, to: false } }) });
  const r = build([cancel('c1', 0, 'a'), restoreFromTo, cancel('c2', 4000, 'b')]);
  assert.deepEqual(texts(r), ['ההזמנה בוטלה', 'ההזמנה שוחזרה', 'ההזמנה בוטלה'], 'newest first: cancelled, restored, cancelled');
  assert.equal(r.dedupedBy.D1, undefined);
  // a new-values-only restore row and a RESTORE_ORDER action count as restores too
  const restoreNew = row({ id: 'rs2', entityId: 'uuid-1', action: 'UPDATE', createdAt: new Date('2026-09-23T09:00:02.000Z'), changesJson: J({ isDeleted: false }) });
  assert.equal(only(build([cancel('c1', 0, 'a'), restoreNew, cancel('c2', 4000, 'b')]), (e) => e.text === 'ההזמנה בוטלה').length, 2);
  const restoreNamed = row({ id: 'rs3', entityId: '100', action: 'RESTORE_ORDER', createdAt: new Date('2026-09-23T09:00:02.000Z'), changesJson: J({}) });
  assert.equal(only(build([cancel('c1', 0, 'a'), restoreNamed, cancel('c2', 4000, 'b')]), (e) => e.text === 'ההזמנה בוטלה').length, 2);
  // without a restore in between the double write is still one line (D1 untouched), even when an unrelated row sits between
  const other = row({ id: 'x', entityId: '100', action: 'DEBT_APPROVED', createdAt: new Date('2026-09-23T09:00:02.000Z'), changesJson: J({ approvedDebtAmount: 5 }) });
  const merged = build([cancel('c1', 0, 'a'), other, cancel('c2', 4000, 'b')]);
  assert.equal(only(merged, (e) => e.text === 'ההזמנה בוטלה').length, 1);
  assert.equal(merged.dedupedBy.D1, 1);
  assert.equal(build([cancel('c1', 0, 'a'), cancel('c2', 300, 'b')]).dedupedBy.D1, 1);
});

test('ORD-2: the old double write (generic UPDATE isDeleted + named CANCEL_ITEM / CANCEL_PAYMENT) prints ONE line; B3 sequences keep every line', () => {
  const at = (ms) => new Date(Date.parse('2026-09-21T10:00:00.000Z') + ms);
  const items = [{ id: 'i1', sizeText: '40', prefix: 4512 }];
  const item = build([
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'UPDATE', createdAt: at(0), changesJson: J({ isDeleted: true }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CANCEL_ITEM', createdAt: at(200), changesJson: J({ sizeText: '40', isDeleted: true }) }),
  ], { items });
  assert.deepEqual(texts(item), ['הוסר פריט: דגם 4512, מידה 40']);
  assert.equal(item.dedupedBy.D6, 1);
  const pay = build([
    row({ entityType: 'Payment', entityId: 'p1', action: 'UPDATE', createdAt: at(0), changesJson: J({ isDeleted: { from: false, to: true }, amount: 80 }) }),
    row({ entityType: 'Payment', entityId: 'p1', action: 'CANCEL_PAYMENT', createdAt: at(200), changesJson: J({ isDeleted: true, amount: 80, paymentMethod: 'מזומן' }) }),
  ]);
  assert.equal(texts(pay).filter((t) => t.startsWith('תשלום בוטל')).length, 1);
  assert.equal(pay.entries.find((e) => e.text.startsWith('תשלום בוטל')).action, 'CANCEL_PAYMENT', 'the named row is the one kept');
  // legacy restore twin
  const restoreTwin = build([
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'UPDATE', createdAt: at(0), changesJson: J({ isDeleted: false }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'RESTORE_ITEM', createdAt: at(300), changesJson: J({ sizeText: '40', isDeleted: false }) }),
  ], { items });
  assert.equal(texts(restoreTwin).filter((t) => t.startsWith('שוחזר פריט')).length, 1);
  // B3 must stay: named cancel, named restore, GENERIC cancel 4 s later = three real events (outside the 1 s twin window)
  const mixed = build([
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CANCEL_ITEM', createdAt: at(0), changesJson: J({ sizeText: '40', isDeleted: true }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'RESTORE_ITEM', createdAt: at(2000), changesJson: J({ sizeText: '40', isDeleted: false }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'UPDATE', createdAt: at(4000), changesJson: J({ isDeleted: true }) }),
  ], { items });
  assert.deepEqual(texts(mixed), ['הוסר פריט: דגם 4512, מידה 40', 'שוחזר פריט: דגם 4512, מידה 40', 'הוסר פריט: דגם 4512, מידה 40']);
  // one-to-one: two generic flips (explicit from/to) next to ONE named row -> only one of them is absorbed
  const oneToOne = build([
    row({ entityType: 'Payment', entityId: 'p3', action: 'UPDATE', createdAt: at(0), changesJson: J({ isDeleted: { from: false, to: true }, amount: 80 }) }),
    row({ entityType: 'Payment', entityId: 'p3', action: 'CANCEL_PAYMENT', createdAt: at(200), changesJson: J({ isDeleted: true, amount: 80, paymentMethod: 'מזומן' }) }),
    row({ entityType: 'Payment', entityId: 'p3', action: 'UPDATE', createdAt: at(400), changesJson: J({ isDeleted: { from: false, to: true }, amount: 80 }) }),
  ]);
  assert.equal(texts(oneToOne).filter((t) => t.startsWith('תשלום בוטל')).length, 2);
  // a different record is never a twin
  const other = build([
    row({ entityType: 'OrderItem', entityId: 'i2', action: 'UPDATE', createdAt: at(0), changesJson: J({ isDeleted: true }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CANCEL_ITEM', createdAt: at(200), changesJson: J({ sizeText: '40', isDeleted: true }) }),
  ], { items: [...items, { id: 'i2', sizeText: '40', prefix: 4512 }] });
  assert.equal(texts(other).length, 2);
});

test('ORD-3: free text of the order feed (item / rental notes, charge descriptions, mail subjects, alteration details) never shows a card number', () => {
  const card = '4580 1234 5678 9012';
  const items = [{ id: 'i1', sizeText: '40', prefix: 4512 }];
  const r = build([
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CANCEL_RENTAL', createdAt: T('1 10:00:00'), changesJson: J({ note: `כרטיס ${card}` }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CONFIRM_RENTAL', createdAt: T('1 10:01:00'), changesJson: J({ barcode: { from: null, to: '4512040001' }, note: `שולם ב-${card}` }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'RETURN_CONDITION', createdAt: T('1 10:02:00'), changesJson: J({ returnedOk: { from: null, to: false }, note: `ref${card}` }) }),
    row({ entityType: 'OrderItem', entityId: 'i1', action: 'CREATE', createdAt: T('1 10:03:00'), changesJson: J({ finalPrice: 100, alterationDetails: `להתקשר ${card}` }) }),
    row({ entityType: 'PaymentObligation', entityId: 'ob1', action: 'CREATE', createdAt: T('1 10:04:00'), changesJson: J({ amount: 50, description: `חיוב אשראי ${card}`, isManual: true }) }),
    row({ action: 'EMAIL_SENT', entityId: '100', createdAt: T('1 10:05:00'), changesJson: J({ to: 'a@b.com', subject: `חשבונית ${card} להזמנה 100`, sendMode: `m ${card}` }) }),
    row({ action: 'CANCEL_CHANGES', entityId: '100', createdAt: T('1 10:06:00'), changesJson: J({ discarded: `הערה ${card}` }) }),
  ], { items, obligations: [{ id: 'ob1', description: 'x', amount: 50, isManual: true }], emailLogs: [{ id: 'm1', to: 'a@b.com', subject: `הזמנה #100 ${card}`, status: 'error', errorMessage: 'ETIMEDOUT', sentAt: T('1 10:07:00') }] });
  const dump = JSON.stringify(r.entries.map(publicEntry));
  for (const secret of ['4580', '1234 5678', '5678', '9012']) assert.ok(!dump.includes(secret), `leaked ${secret}: ${dump.slice(0, 200)}`);
  assert.ok(dump.includes('להזמנה 100'), 'the order number in a subject stays readable');
  assert.ok(dump.includes('4512040001'), 'a barcode is not a card number and stays');
});

test('ORD-3: an item barcode (a long digit string) is shown in full in an edit line', () => {
  const items = [{ id: 'i1', sizeText: '40', prefix: 4512 }];
  const r = build([row({ entityType: 'OrderItem', entityId: 'i1', action: 'UPDATE', createdAt: T('1 10:00:00'), changesJson: J({ barcode: { from: '1234567890123', to: '1234567890124' } }) })], { items });
  const dump = JSON.stringify(r.entries.map(publicEntry));
  assert.ok(dump.includes('1234567890123') && dump.includes('1234567890124'), dump);
});

test('ORD-4: order notes / internal notes mask ID and account numbers behind their keyword; phones and numbers survive', () => {
  const create = row({ action: 'CREATE', createdAt: T('1 10:00:00'), changesJson: J({ orderId: 100, notes: null, internalNotes: null }) });
  const save = row({ createdAt: T('1 10:05:00'), changesJson: J({
    notes: 'ת.ז 123456789, לתאם 052-123-4567, הזמנה 28315',
    internalNotes: 'ח-ן 12345678 חשבון 99887766 IBAN IL62-0108-0000-0009-9999-999 כרטיס 4580 1234 5678 9012',
  }) });
  const r = build([create, save]);
  const dump = JSON.stringify(r.entries.map(publicEntry));
  for (const secret of ['123456789', '12345678', '99887766', '0108', '4580', '5678']) assert.ok(!dump.includes(secret), `leaked ${secret}: ${dump}`);
  assert.ok(dump.includes('052-123-4567') && dump.includes('28315'));
});

console.log('review round 3');
test('ID-1: only a UUID-shaped id or a positive INT4 order number reaches Prisma (both history routes)', () => {
  const uuid = '5a1b2c3d-1111-4222-8333-444455556666';
  assert.equal(isUuidShaped(uuid), true);
  assert.equal(isUuidShaped(uuid.toUpperCase()), true);
  for (const bad of ['', 'abc', 'cust-1', `${uuid} `, '5a1b2c3d-1111-4222-8333-44445555666', `${uuid}x`, ` ${uuid}`, ' ', `${uuid.slice(0, 35)} `, null, undefined, 5, {}, [uuid]]) {
    assert.equal(isUuidShaped(bad), false, JSON.stringify(bad));
  }
  assert.deepEqual(resolveOrderRef(uuid), { id: uuid });
  assert.deepEqual(resolveOrderRef('28315'), { orderId: 28315 });
  assert.deepEqual(resolveOrderRef('2147483647'), { orderId: 2147483647 });
  for (const bad of ['', '0', '00', '-5', '2147483648', '12abc', 'abc', '1.5', ' 12', '12 ', '1 2', ' ', '%00', 'a-b', '-', '99999999999999999999', '123456789012', '٣', null, undefined, 12, ['12']]) {
    assert.equal(resolveOrderRef(bad), null, JSON.stringify(bad));
  }
});

test('SAN-5/PERF-1/SAN-9 reach the order feed: cleanText masks ת"ז / ח"ן, stays linear and keeps size lists', () => {
  for (const t of ['ת"ז 123456789', 'ת״ז 123456789', 'תז 123456789', 'ח"ן 12345678', 'ID: 123456789']) assert.ok(!cleanText(t).includes('12345678'), t);
  assert.equal(cleanText('הזמנה 28315'), 'הזמנה 28315');
  assert.equal(cleanText('מידות 34 36 38 40 42 44 46'), 'מידות 34 36 38 40 42 44 46');
  assert.equal(safeNoteText('הזמנות 25138 21757 21552'), 'הזמנות 25138 21757 21552');
  assert.equal(maskCardNumbers('ברקוד 7290012345678'), 'ברקוד 7290012345678');
  const t0 = process.hrtime.bigint();
  stripInternalIds(`א${' '.repeat(200000)}x`); cleanText(`א${' '.repeat(200000)}x`); safeMailError('a'.repeat(200000));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 300, `took ${ms} ms`);
});

if (failures) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall order-history tests passed');
