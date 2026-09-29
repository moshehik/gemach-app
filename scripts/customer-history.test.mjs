// Plain-node test of the customer-history mapper (lib/history/customerHistory.js + labels.js).
// No database, no dev server, no dependencies:   node scripts/customer-history.test.mjs
// (The repo has no test runner - see CLAUDE.md "Commands" - so this is a one-off script that
// exits non-zero on the first failing group.)

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mapCustomerAuditRow, mapOrderRow, mapOrderAuditRow, mapPaymentRow, mapRefundRow, mapEmailLogRow,
  buildCustomerHistory, assemblePage, encodeCursor, decodeCursor, afterCursor, countByCategory,
  normalizeLimit, israelParts, compareEntries, MAX_LIMIT, DEFAULT_LIMIT, SOURCE_CAP,
} from '../lib/history/customerHistory.js';
import { getCustomerHistory } from '../lib/history/customerHistory.js';
import {
  redactFreeText, safePaymentNote, maskDigits, maskIdentifier, safeMailError, safeDisplayText, safeNoteText, maskCardNumbers, cleanText, stripInternalIds,
} from '../lib/history/sanitize.js';
import {
  CUSTOMER_ONLY_FIELD_LABELS, CUSTOMER_SHARED_FIELD_LABELS, CUSTOMER_FIELD_LABELS,
  formatFieldValue, formatMoney, shorten,
} from '../lib/history/labels.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`  FAIL ${name}\n       ${e.message.split('\n').join('\n       ')}`);
  }
}

const CID = 'cust-1';
const MASK_FOR_TEST = '•••';
const ctx = {
  customerId: CID,
  actorNames: new Map([['emp-1', 'רחל כהן'], ['emp-2', 'דוד לוי']]),
  hebrewDate: (d) => `H(${d.toISOString().slice(0, 10)})`,
};
const T = (iso) => new Date(iso);
const audit = (over) => ({ id: 'a1', entityType: 'Customer', entityId: CID, action: 'UPDATE', employeeId: 'emp-1', createdAt: T('2026-09-24T09:40:00Z'), changesJson: '{}', ...over });

console.log('explode');
test('one UPDATE row with 3 fields -> 3 entries sharing groupId, same instant, distinct ids', () => {
  const row = audit({ changesJson: JSON.stringify({ email: { from: 'a@x.com', to: 'b@x.com' }, city: { from: 'חיפה', to: 'ירושלים' }, notes: { from: null, to: 'הערה חדשה' } }) });
  const out = mapCustomerAuditRow(row, ctx);
  assert.equal(out.length, 3);
  assert.equal(new Set(out.map((e) => e.groupId)).size, 1);
  assert.equal(out[0].groupId, 'audit:a1');
  assert.equal(new Set(out.map((e) => e.id)).size, 3);
  assert.deepEqual(out.map((e) => e.field), ['email', 'city', 'notes']);
  assert.ok(out.every((e) => e.at === '2026-09-24T09:40:00.000Z' && e.category === 'cust' && e.actor.name === 'רחל כהן'));
  assert.equal(out[0].title, 'עודכן דוא"ל');
  assert.equal(out[1].title, 'עודכנה עיר'); // feminine
  assert.equal(out[2].title, 'עודכנו הערות'); // plural
  assert.equal(out[0].from, 'a@x.com');
  assert.equal(out[0].to, 'b@x.com');
  assert.equal(out[2].from, 'ריק');
  assert.deepEqual(out[0].details, [['לפני', 'a@x.com'], ['אחרי', 'b@x.com']]);
  assert.equal(out[0].detail, 'a@x.com ← b@x.com');
});

test('booleans: כן/לא values and A5 סומן/בוטל wording; block/unblock titles', () => {
  const out = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ marketingConsent: { from: false, to: true }, isBlocked: { from: false, to: true }, blockedReason: { from: null, to: 'מלוכלך' } }) }), ctx);
  const by = Object.fromEntries(out.map((e) => [e.field, e]));
  assert.equal(by.marketingConsent.title, 'אישור קבלת דיוורים סומן');
  assert.equal(by.marketingConsent.from, 'לא');
  assert.equal(by.marketingConsent.to, 'כן');
  assert.equal(by.isBlocked.title, 'הלקוח נחסם מהזמנות חדשות');
  assert.equal(by.blockedReason.title, 'עודכנה סיבת החסימה');
  const un = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ isBlocked: { from: true, to: false } }) }), ctx);
  assert.equal(un[0].title, 'החסימה הוסרה');
});

test('no-op fields are folded (from == to, both empty) but real ones stay', () => {
  const out = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ city: { from: '', to: null }, phone1: { from: '050', to: '050' }, street: { from: 'א', to: 'ב' } }) }), ctx);
  assert.deepEqual(out.map((e) => e.field), ['street']);
});

test('empty diff -> exactly ONE "no visible change" entry (row never dropped)', () => {
  const out = mapCustomerAuditRow(audit({ changesJson: '{}' }), ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].type, 'update-empty');
  assert.equal(out[0].id, 'audit:a1');
  const allNoop = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ city: { from: 'x', to: 'x' } }) }), ctx);
  assert.equal(allNoop.length, 1);
  assert.equal(allNoop[0].type, 'update-empty');
});

test('write-side bookkeeping columns (phonetic keys) get no line; alone -> one entry', () => {
  const mixed = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ firstName: { from: 'א', to: 'ב' }, firstNamePhoneticKey: { from: 'x', to: 'y' } }) }), ctx);
  assert.deepEqual(mixed.map((e) => e.field), ['firstName']);
  const only = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ lastNamePhoneticKey: { from: 'x', to: 'y' } }) }), ctx);
  assert.equal(only.length, 1);
  assert.equal(only[0].type, 'update-empty');
});

test('unknown field key -> still an entry, but a generic Hebrew line: no raw key, no value', () => {
  const out = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ someFutureColumn: { from: 1, to: 2 } }) }), ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'עודכנו פרטים');
  assert.equal(out[0].fieldLabel, 'פרטים נוספים');
  assert.ok(!JSON.stringify(out[0]).includes('someFutureColumn'), 'the raw English key stays out of the entry');
  assert.deepEqual(out[0].details, []);
  // two unknown keys next to a known one: ONE generic line after the known field's line
  const mixed = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ city: { from: 'a', to: 'b' }, hokDetails: { from: 'x', to: '{"LastNum":"4580123456781234"}' }, cardNumber: { from: null, to: '4580123456781234' } }) }), ctx);
  assert.deepEqual(mixed.map((e) => e.title), ['עודכנה עיר', 'עודכנו פרטים']);
  assert.ok(!JSON.stringify(mixed).includes('hokDetails') && !JSON.stringify(mixed).includes('4580') && !JSON.stringify(mixed).includes('cardNumber'));
  // a no-op unknown key adds no line
  assert.equal(mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ someFutureColumn: { from: 1, to: 1 } }) }), ctx)[0].type, 'update-empty');
});

test('snapshot-shaped row (refund flow writes plain values, not from/to)', () => {
  const out = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ bankName: '52', bankAccount: { set: '366145' } }) }), ctx);
  assert.equal(out.length, 2);
  assert.equal(out[0].fieldLabel, 'שם בנק');
  assert.equal(out[0].to, '52');
  assert.equal('from' in out[0], false);
  assert.equal(out[1].to, '•••145'); // { set } unwrapped; the account number is masked (last 3 digits only)
});

test('ISO date values go through the injected Hebrew-date formatter', () => {
  const out = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ registrationDate: { from: null, to: '2026-09-24T00:00:00.000Z' } }) }), ctx);
  assert.equal(out[0].to, 'H(2026-09-24)');
});

test('malformed / non-object changesJson -> one "unparsed" entry, not a crash and not a drop', () => {
  for (const bad of ['{not json', 'null', '"text"', '[1,2]']) {
    const out = mapCustomerAuditRow(audit({ changesJson: bad }), ctx);
    assert.equal(out.length, 1, bad);
    assert.ok(out[0].title.length > 0);
  }
});

test('unknown action -> generic entry with the raw action name', () => {
  const out = mapCustomerAuditRow(audit({ action: 'SOMETHING_NEW', changesJson: JSON.stringify({ x: 1 }) }), ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'פעולה: SOMETHING_NEW');
  assert.equal(out[0].type, 'other');
});

test('CREATE / DELETE / ADD_AUTO_NOTE / EMAIL_SENT', () => {
  const c = mapCustomerAuditRow(audit({ action: 'CREATE', changesJson: JSON.stringify({ firstName: 'מרים', lastName: 'אברמוביץ', phone1: '0507123456', city: 'ירושלים' }) }), ctx)[0];
  assert.equal(c.title, 'כרטיס לקוח נפתח');
  assert.equal(c.detail, 'מרים אברמוביץ · 0507123456');
  assert.equal(mapCustomerAuditRow(audit({ action: 'DELETE', changesJson: '{"deleted":true}' }), ctx)[0].title, 'כרטיס הלקוח נמחק');
  const n = mapCustomerAuditRow(audit({ action: 'ADD_AUTO_NOTE', changesJson: JSON.stringify({ note: '[16.9.2026] אוטומטי: שמלה כחול (קוד: 580) (הזמנה 20870) חזרה לא תקינה.', issueType: 'returned-bad' }) }), ctx)[0];
  assert.equal(n.title, 'נוספה הערה אוטומטית');
  assert.ok(!n.detail.includes('16.9.2026'));
  assert.equal(n.entityRef.href, '/orders/20870');
  assert.deepEqual(n.details.find(([k]) => k === 'סוג'), ['סוג', 'חזרה לא תקינה']);
  const m = mapCustomerAuditRow(audit({ action: 'EMAIL_SENT', changesJson: JSON.stringify({ subject: 'שלום', to: 'a@b.com', body: 'SECRET BODY', files: [{ fileName: 'x.pdf' }], sendMode: 'email' }) }), ctx)[0];
  assert.equal(m.category, 'docs');
  assert.equal(m.title, 'נשלח מייל: שלום');
  assert.equal(m.detail, 'אל a@b.com');
  assert.ok(!JSON.stringify(m).includes('SECRET BODY'), 'mail body must not leak into the feed');
});

console.log('other sources');
const order = { id: 'ord-uuid', orderId: 28315, orderDate: T('2026-09-22T14:02:00Z'), updatedAt: T('2026-09-23T00:00:00Z'), eventDateHebrew: 'כב תשרי תשפ"ז', totalAmount: 530, isDeleted: false, isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים', employeeId: 'emp-2', _count: { items: 3 } };
test('order opened: title, amount (chg), actor, link, Hebrew event date', () => {
  const [e] = mapOrderRow(order, ctx);
  assert.equal(e.title, 'נפתחה הזמנה #28315');
  assert.equal(e.category, 'orders');
  assert.equal(e.amount, 530);
  assert.equal(e.amountKind, 'chg');
  assert.equal(e.actor.name, 'דוד לוי');
  assert.equal(e.entityRef.href, '/orders/28315');
  assert.ok(e.detail.includes('3 פריטים') && e.detail.includes('אירוע כב תשרי'));
});

test('order without orderDate falls back to updatedAt; cancelled order says בוטלה', () => {
  const [e] = mapOrderRow({ ...order, orderDate: null, isDeleted: true, totalAmount: 0 }, ctx);
  assert.equal(e.at, '2026-09-23T00:00:00.000Z');
  assert.ok(e.detail.startsWith('בוטלה'));
  assert.equal('amount' in e, false);
});

test('order audit rows resolve BOTH id forms; allow-listed actions', () => {
  const c2 = { ...ctx, orderByKey: new Map([['ord-uuid', order], ['28315', order]]) };
  const a = mapOrderAuditRow({ id: 'o1', entityId: '28315', action: 'DEBT_APPROVED', employeeId: 'emp-1', createdAt: T('2026-09-23T10:00:00Z'), changesJson: '{"approvedDebtAmount":600}' }, c2)[0];
  assert.equal(a.title, 'אושרה יתרת חוב בהזמנה #28315');
  assert.equal(a.detail, '₪600');
  const b = mapOrderAuditRow({ id: 'o2', entityId: 'ord-uuid', action: 'UPDATE', employeeId: null, createdAt: T('2026-09-23T10:01:00Z'), changesJson: '{"totalAmount":50}' }, c2)[0];
  assert.equal(b.title, 'עודכנה הזמנה #28315');
  assert.equal(b.actor.name, 'מערכת');
});

test('payments: cash / card wording, refund-as-credit, zero amount, deleted', () => {
  const p = (o) => mapPaymentRow({ id: 'p', orderId: 28315, amount: 300, paymentDate: T('2026-09-23T10:18:00Z'), paymentMethod: 'מזומן', notes: '', isDeleted: false, isRefund: false, ...o }, { ...ctx, paymentActors: new Map([['p', 'emp-1']]) })[0];
  assert.equal(p({}).title, 'התקבל תשלום במזומן');
  assert.equal(p({}).amount, 300);
  assert.equal(p({}).amountKind, 'pay');
  assert.equal(p({}).actor.name, 'רחל כהן');
  assert.equal(p({ paymentMethod: 'אשראי' }).title, 'התקבל תשלום באשראי');
  assert.equal(p({ paymentMethod: 'אשראי' }).icon, 'card');
  const credit = p({ amount: -60 });
  assert.equal(credit.title, 'בוצע זיכוי');
  assert.equal(credit.amount, -60);
  assert.equal(credit.amountKind, 'crd');
  const zero = p({ amount: 0, paymentMethod: 'יציאה באישור מנהל' });
  assert.equal(zero.title, 'יציאה באישור מנהל');
  assert.equal('amount' in zero, false);
  assert.equal(p({ isDeleted: true }).type, 'payment-cancelled');
});

test('refund: request entry has no amount; execution entry is a credit; same groupId', () => {
  const es = mapRefundRow({ id: 'r1', orderId: 27865, amount: 2, reason: 'סתם', isExecuted: true, executionDate: T('2026-09-15T03:21:47Z'), executedBy: 'emp-2', isAutoGenerated: false, createdAt: T('2026-09-15T03:21:36Z') }, { ...ctx, refundCreators: new Map([['r1', 'emp-1']]), refundExecutors: new Map([['r1', 'emp-2']]) });
  assert.equal(es.length, 2);
  assert.equal(es[0].type, 'refund-requested');
  assert.equal('amount' in es[0], false);
  assert.equal(es[0].actor.name, 'רחל כהן');
  assert.equal(es[1].amount, -2);
  assert.equal(es[1].actor.name, 'דוד לוי');
  assert.equal(es[0].groupId, es[1].groupId);
  assert.equal(mapRefundRow({ id: 'r2', amount: 5, isExecuted: false, isAutoGenerated: true, createdAt: T('2026-09-15T00:00:00Z') }, ctx).length, 1);
});

test('email log: success / failure wording, no body', () => {
  const ok = mapEmailLogRow({ id: 'e1', to: 'a@b.com', subject: 'שלום', body: 'SECRET', status: 'success', employeeId: 'emp-1', sentAt: T('2026-09-24T09:05:00Z'), fileName: 'a.pdf, b.pdf' }, ctx)[0];
  assert.equal(ok.title, 'נשלח מייל: שלום');
  assert.ok(!JSON.stringify(ok).includes('SECRET'));
  const bad = mapEmailLogRow({ id: 'e2', to: 'a@b.com', subject: 'שלום', status: 'error', errorMessage: 'boom', sentAt: T('2026-09-24T09:06:00Z') }, ctx)[0];
  assert.equal(bad.title, 'שליחת מייל נכשלה: שלום');
  assert.deepEqual(bad.details.find(([k]) => k === 'שגיאה'), ['שגיאה', 'שליחה נכשלה (boom)']); // generic wording + short sanitized reason
});

console.log('ordering / dedupe / assembly');
const sources = {
  auditRows: [
    audit({ id: 'a1', createdAt: T('2026-09-24T09:40:00Z'), changesJson: JSON.stringify({ street: { from: 'א', to: 'ב' }, city: { from: 'ג', to: 'ד' } }) }),
    audit({ id: 'a2', createdAt: T('2026-08-14T15:44:00Z'), employeeId: 'emp-2', changesJson: JSON.stringify({ email: { from: 'x', to: 'y' } }) }),
  ],
  orders: [order],
  payments: [{ id: 'p1', orderId: 28315, amount: 300, paymentDate: T('2026-09-23T10:18:00Z'), paymentMethod: 'מזומן', isDeleted: false, isRefund: false }],
  refunds: [],
  emailLogs: [{ id: 'e1', to: 'a@b.com', subject: 'שלום', status: 'success', sentAt: T('2026-09-24T09:05:30Z') }],
  orderAuditRows: [
    { id: 'c1', entityType: 'Order', entityId: 'ord-uuid', action: 'CANCEL_ORDER', employeeId: 'emp-1', createdAt: T('2026-09-16T05:42:27.958Z'), changesJson: '{"isDeleted":{"from":false,"to":true}}' },
    { id: 'c2', entityType: 'Order', entityId: '28315', action: 'CANCEL_ORDER', employeeId: 'emp-1', createdAt: T('2026-09-16T05:42:28.526Z'), changesJson: '{"orderId":28315,"note":"ההזמנה בוטלה"}' },
    { id: 'm1', entityType: 'Order', entityId: '28315', action: 'EMAIL_SENT', employeeId: null, createdAt: T('2026-09-24T09:05:00Z'), changesJson: '{"subject":"שלום","to":"A@b.com"}' },
  ],
};
const built = buildCustomerHistory(sources, ctx);

test('newest first, total order, ids unique', () => {
  const sorted = [...built].sort(compareEntries);
  assert.deepEqual(built.map((e) => e.id), sorted.map((e) => e.id));
  for (let i = 1; i < built.length; i += 1) assert.ok(built[i - 1].at >= built[i].at);
  assert.equal(new Set(built.map((e) => e.id)).size, built.length);
  assert.equal(built[0].at, '2026-09-24T09:40:00.000Z');
});

test('one saved card keeps its stored field order top to bottom; a newer group at the same instant comes first', () => {
  const same = buildCustomerHistory({ auditRows: [
    audit({ id: 'a1', changesJson: JSON.stringify({ city: { from: 'x', to: 'y' }, street: { from: 'x', to: 'y' }, email: { from: 'x', to: 'y' } }) }),
    audit({ id: 'a2', changesJson: JSON.stringify({ notes: { from: 'x', to: 'y' } }) }),
  ] }, ctx);
  assert.deepEqual(same.map((e) => e.field), ['notes', 'city', 'street', 'email']);
  // paging through the middle of a group neither repeats nor skips lines
  const seen = [];
  let cursor = null;
  for (let i = 0; i < 10; i += 1) {
    const p = assemblePage(same, { limit: 1, cursor });
    seen.push(...p.entries.map((e) => e.field));
    if (!p.nextCursor) break;
    cursor = decodeCursor(p.nextCursor);
  }
  assert.deepEqual(seen, ['notes', 'city', 'street', 'email']);
});

test('CANCEL_ORDER written as two audit rows collapses to the one with the note', () => {
  const cancels = built.filter((e) => e.type === 'order-cancelled');
  assert.equal(cancels.length, 1);
  assert.equal(cancels[0].id, 'audit:c2');
});

test('a run of order UPDATE rows (one card save) collapses to one line, credited to the real employee', () => {
  const upd = (id, iso, employeeId) => ({ id, entityType: 'Order', entityId: '28315', action: 'UPDATE', employeeId, createdAt: T(iso), changesJson: '{"totalAmount":1}' });
  const c2 = { ...ctx, orderByKey: new Map([['28315', order]]) };
  const rows = [upd('u1', '2026-09-22T14:02:00Z', 'emp-1'), upd('u2', '2026-09-22T14:02:05Z', null), upd('u3', '2026-09-22T14:02:09Z', null), upd('u4', '2026-09-22T15:30:00Z', 'emp-2')];
  const out = buildCustomerHistory({ orders: [order], orderAuditRows: rows }, c2).filter((e) => e.type === 'order-updated');
  assert.equal(out.length, 2, 'the 14:02 run is one line, the 15:30 update another');
  const run = out.find((e) => e.detail.includes('3'));
  assert.equal(run.detail, '3 עדכונים ברצף');
  assert.equal(run.actor.name, 'רחל כהן');
  assert.equal(run.id, 'audit:u3'); // newest row stands for the run
  assert.equal(out.find((e) => e.id === 'audit:u4').detail, '');
});

test('EmailLog twin of an EMAIL_SENT audit row is dropped (case-insensitive recipient)', () => {
  const mails = built.filter((e) => e.type === 'mail');
  assert.equal(mails.length, 1);
  assert.equal(mails[0].source, 'order-audit');
});

test('only genuinely different mails survive', () => {
  const two = buildCustomerHistory({ emailLogs: [
    { id: 'e1', to: 'a@b.com', subject: 'אחד', status: 'success', sentAt: T('2026-09-24T09:05:00Z') },
    { id: 'e2', to: 'a@b.com', subject: 'שתיים', status: 'success', sentAt: T('2026-09-24T09:05:00Z') },
  ] }, ctx);
  assert.equal(two.length, 2);
});

test('every source row is represented (nothing dropped silently)', () => {
  const ids = new Set(built.map((e) => e.groupId));
  for (const r of sources.auditRows) assert.ok(ids.has(`audit:${r.id}`), r.id);
  assert.ok(ids.has('order:ord-uuid'));
  assert.ok(ids.has('payment:p1'));
});

test('israel day/time are not UTC slices', () => {
  // 22:30Z on 14 Sep is 01:30 on 15 Sep in Israel (UTC+3)
  assert.deepEqual(israelParts(T('2026-09-14T22:30:00Z')), { day: '2026-09-15', time: '01:30' });
  const [e] = mapPaymentRow({ id: 'p', amount: 1, paymentDate: T('2026-01-14T22:30:00Z'), paymentMethod: 'מזומן' }, ctx);
  assert.equal(e.day, '2026-01-15'); // UTC+2 in winter -> 00:30 on the 15th
  assert.equal(e.time, '00:30');
});

test('cursor round trip + malformed cursors', () => {
  const c = encodeCursor(built[3]);
  const d = decodeCursor(c);
  assert.equal(d.at.toISOString(), built[3].at);
  assert.equal(d.id, built[3].id);
  assert.equal(decodeCursor(''), null);
  assert.equal(decodeCursor('###'), null);
  assert.equal(decodeCursor(encodeCursor({ at: 'nope', id: 'x', groupId: 'g' })), null);
});

test('afterCursor returns strictly older entries, no repeats across pages', () => {
  const p1 = assemblePage(built, { limit: 3 });
  assert.equal(p1.entries.length, 3);
  assert.ok(p1.nextCursor);
  const p2 = assemblePage(built, { limit: 3, cursor: decodeCursor(p1.nextCursor) });
  const seen = new Set(p1.entries.map((e) => e.id));
  assert.ok(p2.entries.every((e) => !seen.has(e.id)));
  const all = [];
  let cursor = null;
  for (let i = 0; i < 20; i += 1) {
    const p = assemblePage(built, { limit: 2, cursor });
    all.push(...p.entries);
    if (!p.nextCursor) break;
    cursor = decodeCursor(p.nextCursor);
  }
  assert.deepEqual(all.map((e) => e.id), built.map((e) => e.id));
  assert.deepEqual(afterCursor(built, null), built);
});

test('exact last page has no nextCursor', () => {
  const p = assemblePage(built, { limit: built.length });
  assert.equal(p.nextCursor, null);
  assert.equal(p.entries.length, built.length);
});

test('paging is in memory over the assembled feed: no frontier, nextCursor exactly when entries remain', () => {
  const p = assemblePage(built, { limit: 2, frontier: T('2030-01-01T00:00:00Z') }); // a stale `frontier` option is ignored
  assert.equal(p.entries.length, 2);
  assert.deepEqual(p.entries.map((e) => e.id), built.slice(0, 2).map((e) => e.id));
  assert.ok(p.nextCursor);
  assert.equal(assemblePage(built, { limit: built.length }).nextCursor, null);
});

test('category filter + counts', () => {
  const p = assemblePage(built, { limit: 100, categories: new Set(['pay']) });
  assert.ok(p.entries.length >= 1 && p.entries.every((e) => e.category === 'pay'));
  const counts = countByCategory(built);
  assert.equal(counts.all, built.length);
  assert.equal(counts.cust + counts.orders + counts.pay + counts.docs, built.length);
});

test('limit is capped at 200 and defaults to 100', () => {
  assert.equal(normalizeLimit(undefined), DEFAULT_LIMIT);
  assert.equal(normalizeLimit('abc'), DEFAULT_LIMIT);
  assert.equal(normalizeLimit('0'), DEFAULT_LIMIT);
  assert.equal(normalizeLimit('50'), 50);
  assert.equal(normalizeLimit('100000'), MAX_LIMIT);
  assert.equal(MAX_LIMIT, 200);
});

console.log('labels');
test('value formatters', () => {
  assert.equal(formatFieldValue('x', null), 'ריק');
  assert.equal(formatFieldValue('x', '  '), 'ריק');
  assert.equal(formatFieldValue('x', true), 'כן');
  assert.equal(formatFieldValue('x', false), 'לא');
  assert.equal(formatFieldValue('x', 0), '0');
  assert.equal(formatMoney(1200), '₪1,200');
  assert.equal(formatMoney(-60), '-₪60');
  assert.equal(shorten('x'.repeat(30), 26), `${'x'.repeat(26)}…`);
});

test('every Customer column that can appear in audit rows has a Hebrew label', () => {
  const schema = fs.readFileSync(path.join(here, '..', 'prisma', 'schema.prisma'), 'utf8');
  const block = schema.split(/^model Customer \{/m)[1].split(/^\}/m)[0];
  const cols = block.split('\n').map((l) => l.trim()).filter((l) => /^[a-z][A-Za-z0-9]*\s+\S+/.test(l) && !l.startsWith('//') && !l.startsWith('@@'))
    .map((l) => l.split(/\s+/)[0]).filter((c) => !['orders', 'payments', 'refunds'].includes(c));
  assert.ok(cols.length > 25, `parsed ${cols.length} columns`);
  const missing = cols.filter((c) => !CUSTOMER_FIELD_LABELS[c]);
  assert.deepEqual(missing, []);
});

test('the labels missing from FIELD_TRANSLATIONS are spread into it; shared copies still match it', () => {
  const src = fs.readFileSync(path.join(here, '..', 'components', 'HistoryViewer.js'), 'utf8');
  const table = src.split('export const FIELD_TRANSLATIONS = {')[1].split('\n};')[0];
  assert.ok(table.includes('...CUSTOMER_ONLY_FIELD_LABELS'), 'HistoryViewer.js must spread CUSTOMER_ONLY_FIELD_LABELS');
  const literal = {};
  for (const m of table.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*'((?:[^'\\]|\\.)*)'/gm)) literal[m[1]] = m[2];
  for (const [k, v] of Object.entries(CUSTOMER_SHARED_FIELD_LABELS)) assert.equal(literal[k], v, `shared label drifted: ${k}`);
  for (const k of Object.keys(CUSTOMER_ONLY_FIELD_LABELS)) assert.equal(literal[k], undefined, `${k} is also defined literally - would be a duplicate`);
});


// ---------------------------------------------------------------------------------------------------
// Review fixes (foundation review B1-B5, R7-R12, R15, R16): each block failed against the previous code.
// ---------------------------------------------------------------------------------------------------
console.log('review fixes');

const NEDARIM = JSON.stringify({ LastNum: '4580123456781234', Zeout: '123456789', Phone: '0521234567', Mail: 'a@b.com', Tokef: '0128', Tashloumim: 3, 'הערות משתמש': 'כרטיס 4580 1234 5678 9012 של הבעל' });
const payRow = (over) => ({ id: 'pp', orderId: 7, amount: 300, paymentDate: T('2026-09-23T10:18:00Z'), paymentMethod: 'אשראי', notes: '', isDeleted: false, isRefund: false, ...over });

test('B1: card payment notes (Nedarim JSON) never reach the customer feed - only last 4 digits + instalments', () => {
  const [e] = mapPaymentRow(payRow({ notes: NEDARIM }), ctx);
  const dump = JSON.stringify(e);
  for (const secret of ['123456789', '0521234567', 'a@b.com', '0128', '4580', '5678', '9012', 'Zeout', 'LastNum']) assert.ok(!dump.includes(secret), `leaked ${secret}`);
  assert.ok(dump.includes('ספרות 1234'), 'last four digits stay');
  assert.ok(dump.includes('3 תשלומים'));
});

test('B1: a refund bank note on an unlinked payment is replaced outright; legacy Access notes keep only the last 4', () => {
  const [r] = mapPaymentRow(payRow({ amount: -50, isRefund: true, notes: 'החזר ללקוח (בנק 12 סניף 345 חשבון 999888)' }), ctx);
  const dump = JSON.stringify(r);
  for (const secret of ['999888', '345', 'בנק 12']) assert.ok(!dump.includes(secret), secret);
  const [l] = mapPaymentRow(payRow({ notes: '5537 | מס_אישור: 1234567 | מערכת: { "Zeout" : "123456789" }' }), ctx);
  assert.ok(!JSON.stringify(l).includes('1234567') && !JSON.stringify(l).includes('Zeout'));
  assert.ok(JSON.stringify(l).includes('ספרות 5537'));
});

test('R15: refund reason is redacted (bank / card digits, refund-flow bank note)', () => {
  const es = mapRefundRow({ id: 'r1', orderId: 7, amount: 5, reason: 'להעביר לחשבון 99887766 או כרטיס 4580 1234 5678 9012', isExecuted: false, createdAt: T('2026-09-15T00:00:00Z') }, ctx);
  const dump = JSON.stringify(es);
  assert.ok(!dump.includes('99887766') && !dump.includes('5678') && !dump.includes('9012'));
  const flow = mapRefundRow({ id: 'r2', orderId: 7, amount: 5, reason: 'החזר ללקוח (בנק 12 סניף 345 חשבון 999888)', isExecuted: false, createdAt: T('2026-09-15T00:00:00Z') }, ctx);
  assert.ok(!JSON.stringify(flow).includes('999888'));
});

test('R16: e-mail error text keeps no address / account / server name', () => {
  const msg = 'Invalid login: 535-5.7.8 Username and Password not accepted for gemach.office@gmail.com (smtp.gmail.com)';
  const [e] = mapEmailLogRow({ id: 'e9', to: 'x@y.com', subject: 'שלום', status: 'error', errorMessage: msg, sentAt: T('2026-09-24T09:06:00Z') }, ctx);
  const err = e.details.find(([k]) => k === 'שגיאה')[1];
  assert.ok(err.startsWith('שליחה נכשלה'));
  for (const secret of ['gemach.office', 'gmail', '@', '535']) assert.ok(!err.includes(secret), secret);
  const unknown = safeMailError('weird failure for boss@corp.co.il at 10.1.2.3 account 123456789');
  assert.ok(!/boss|corp|10\.1|123456789|@/.test(unknown), unknown);
  assert.ok(unknown.startsWith('שליחה נכשלה'));
});

test('B4: digit masking - separated card numbers, 6+ digit runs, 5-digit account after a keyword; short numbers survive', () => {
  for (const card of ['4580 1234 5678 9012', '4580-1234-5678-9012', '3782 822463 10005', '4580123456789012']) {
    assert.equal(maskDigits(`שולם בכרטיס ${card} תודה`), 'שולם בכרטיס ••• תודה', card);
  }
  assert.equal(maskDigits('חשבון 99887'), 'חשבון •••');
  assert.equal(maskDigits('ת.ז. 12345678'), 'ת.ז. •••');
  assert.equal(maskDigits('052-123-4567'), '052-123-4567', 'a phone written with dashes has no 6+ run');
  assert.equal(maskDigits('0521234567'), '•••');
  for (const ok of ['הזמנה 28315 שולם ₪1,200 ב-16.9.2026', 'אירוע 16 9 2026 והזמנה 28315', '2026-09-16T10:00:00', 'תשלום 3 מתוך 12 בסך 350']) assert.equal(maskDigits(ok), ok, ok);
  assert.equal(redactFreeText('החזר ללקוח (בנק 12 סניף 345 חשבון 999888)', 100), 'החזר ללקוח (פרטי הבנק אינם מוצגים)');
  assert.equal(safePaymentNote(NEDARIM).last4, '1234');
  assert.ok(!safePaymentNote(NEDARIM).text.includes('5678'));
});

test('R7: ID number / bank account / hok account are masked to the last 3-4 characters', () => {
  const out = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ zeout: { from: '123456789', to: '987654321' }, bankAccount: { from: null, to: '366145' }, hokBankAccount: { from: '11223344', to: '55667788' }, bankName: { from: 'a', to: '52' } }) }), ctx);
  const dump = JSON.stringify(out);
  for (const secret of ['123456789', '987654321', '366145', '11223344', '55667788']) assert.ok(!dump.includes(secret), secret);
  const by = Object.fromEntries(out.map((e) => [e.field, e]));
  assert.equal(by.zeout.to, '•••4321');
  assert.equal(by.bankAccount.to, '•••145');
  assert.equal(by.hokBankAccount.from, '•••3344');
  assert.equal(by.bankName.to, '52', 'a bank number is not an account');
  assert.equal(maskIdentifier('12'), '•••');
});

test('R7: a generic (unknown-action) row shows an ALLOW-LIST of keys - no uuid, no hok JSON, no card JSON', () => {
  const out = mapCustomerAuditRow(audit({
    action: 'SOMETHING_NEW',
    changesJson: JSON.stringify({ city: 'חיפה', customerId: '5a1b2c3d-1111-2222-3333-444455556666', hokDetails: '{"LastNum":"4580123456781234","Zeout":"123456789"}', bankAccount: '99887766', note: 'ראה בכרטיס 4580 1234 5678 9012' }),
  }), ctx);
  assert.equal(out.length, 1);
  const dump = JSON.stringify(out[0]);
  for (const secret of ['5a1b2c3d', 'LastNum', 'Zeout', '99887766', '5678']) assert.ok(!dump.includes(secret), secret);
  assert.ok(dump.includes('חיפה'));
  assert.deepEqual(out[0].details.map(([k]) => k), ['עיר', 'מספר חשבון בנק', 'הערה']);
  // an unparsable payload is never echoed
  const bad = mapCustomerAuditRow(audit({ action: 'X', changesJson: '{"LastNum":"4580123456781234","Zeo' }), ctx)[0];
  assert.ok(!JSON.stringify(bad).includes('4580'));
});

test('R8: long values are cut (a 200k-char note is not a 400 KB entry)', () => {
  const [e] = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ notes: { from: 'x'.repeat(200000), to: 'y'.repeat(200000) } }) }), ctx);
  assert.ok(JSON.stringify(e).length < 4000, `entry is ${JSON.stringify(e).length} chars`);
  assert.ok(e.from.endsWith('…') && e.to.endsWith('…'));
  const n = mapCustomerAuditRow(audit({ action: 'ADD_AUTO_NOTE', changesJson: JSON.stringify({ note: 'z'.repeat(50000) }) }), ctx)[0];
  assert.ok(JSON.stringify(n).length < 4000);
  const mail = mapCustomerAuditRow(audit({ action: 'EMAIL_SENT', changesJson: JSON.stringify({ subject: 's'.repeat(100000), to: 't'.repeat(100000) + '@x.com', sendMode: 'm'.repeat(100000) }) }), ctx)[0];
  assert.ok(JSON.stringify(mail).length < 4000, `mail entry is ${JSON.stringify(mail).length} chars`);
  const created = mapCustomerAuditRow(audit({ action: 'CREATE', changesJson: JSON.stringify({ firstName: 'a'.repeat(100000), phone1: '1'.repeat(100000) }) }), ctx)[0];
  assert.ok(JSON.stringify(created).length < 4000, `created entry is ${JSON.stringify(created).length} chars`);
});

test('R10: the entry never carries an employee id - the actor is the name only', () => {
  const es = buildCustomerHistory({ auditRows: [audit({ changesJson: JSON.stringify({ city: { from: 'a', to: 'b' } }) })], payments: [payRow({})] }, { ...ctx, paymentActors: new Map([['pp', 'emp-2']]) });
  for (const e of es) assert.deepEqual(Object.keys(e.actor), ['name']);
  assert.ok(!JSON.stringify(es).includes('emp-1') && !JSON.stringify(es).includes('emp-2'));
});

test('R9: a date-only value ("2026-09-16") and dates inside an auto-note are shown as Hebrew dates', () => {
  const [d] = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ registrationDate: { from: '2026-09-16', to: '2026-09-17' } }) }), ctx);
  assert.equal(d.from, 'H(2026-09-16)');
  assert.equal(d.to, 'H(2026-09-17)');
  const [n] = mapCustomerAuditRow(audit({ action: 'ADD_AUTO_NOTE', changesJson: JSON.stringify({ note: '[16.9.2026] חזרה ב-17.9.2026 (הזמנה 20870) ובתאריך 2026-09-18' }) }), ctx);
  const withoutHebrew = n.detail.replace(/H\([^)]*\)/g, ''); // H(...) is this test's stand-in for a Hebrew date
  assert.ok(!/\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2}/.test(withoutHebrew), n.detail);
  assert.ok(n.detail.includes('H(2026-09-17)') && n.detail.includes('H(2026-09-18)'));
  assert.ok(n.detail.includes('20870'), 'the order number is not a date');
});

test('B5: only a SUCCESSFUL EmailLog is the twin of an EMAIL_SENT audit row, one-to-one; a failed retry stays visible', () => {
  const auditMail = { id: 'm1', entityType: 'Customer', entityId: CID, action: 'EMAIL_SENT', employeeId: 'emp-1', createdAt: T('2026-09-24T10:00:00Z'), changesJson: JSON.stringify({ subject: 'שלום', to: 'a@b.com' }) };
  const okLog = { id: 'e1', to: 'a@b.com', subject: 'שלום', status: 'success', sentAt: T('2026-09-24T10:00:01Z') };
  const failedRetry = { id: 'e2', to: 'a@b.com', subject: 'שלום', status: 'error', errorMessage: 'ETIMEDOUT', sentAt: T('2026-09-24T10:00:40Z') };
  const es = buildCustomerHistory({ auditRows: [auditMail], emailLogs: [okLog, failedRetry] }, ctx).filter((e) => e.type === 'mail');
  assert.deepEqual(es.map((e) => e.id).sort(), ['audit:m1', 'email:e2'], 'success twin dropped, failure kept');
  // a failed log with no successful twin next to the audit row is never absorbed
  const onlyFailed = buildCustomerHistory({ auditRows: [auditMail], emailLogs: [failedRetry] }, ctx).filter((e) => e.type === 'mail');
  assert.equal(onlyFailed.length, 2, 'audit row + the failure');
  // one audit row absorbs ONE log row: a second successful send within 2 minutes is a second event
  const resend = { id: 'e3', to: 'a@b.com', subject: 'שלום', status: 'success', sentAt: T('2026-09-24T10:00:30Z') };
  const two = buildCustomerHistory({ auditRows: [auditMail], emailLogs: [okLog, resend] }, ctx).filter((e) => e.type === 'mail');
  assert.equal(two.length, 2);
});

test('R11: a merged burst is credited to the FIRST (oldest) real employee, not the newest', () => {
  const upd = (id, iso, employeeId) => ({ id, entityType: 'Order', entityId: '28315', action: 'UPDATE', employeeId, createdAt: T(iso), changesJson: '{"totalAmount":1}' });
  const c2 = { ...ctx, orderByKey: new Map([['28315', order]]) };
  const out = buildCustomerHistory({ orders: [order], orderAuditRows: [upd('u1', '2026-09-22T14:02:00Z', 'emp-1'), upd('u2', '2026-09-22T14:02:05Z', null), upd('u3', '2026-09-22T14:02:09Z', 'emp-2')] }, c2).filter((e) => e.type === 'order-updated');
  assert.equal(out.length, 1);
  assert.equal(out[0].actor.name, 'רחל כהן');
});

// ---- B2: paging through a collapsed burst ----
const updRow = (id, at) => ({ id, entityType: 'Order', entityId: '1', action: 'UPDATE', createdAt: new Date(at), employeeId: null, changesJson: '{}' });
test('B2: the cursor of a merged burst line points at the line - entries inside the run are not skipped (in-memory paging)', () => {
  const orders = [{ id: 'o1', orderId: 1, orderDate: new Date('2026-01-01T00:00:00Z'), _count: { items: 1 } }];
  const sources = {
    orders,
    orderAuditRows: [updRow('u1', '2026-09-01T10:00:00Z'), updRow('u2', '2026-09-01T10:01:00Z'), updRow('u3', '2026-09-01T10:02:00Z')],
    payments: [{ id: 'p1', orderId: 1, amount: 100, paymentDate: new Date('2026-09-01T10:01:30Z'), paymentMethod: 'מזומן', notes: null, isDeleted: false, isRefund: false }],
  };
  const c = { customerId: 'c1', actorNames: new Map(), hebrewDate: () => '' };
  const all = buildCustomerHistory(sources, c);
  assert.deepEqual(all.map((e) => e.id), ['audit:u3', 'payment:p1', 'order:o1']);
  const p1 = assemblePage(all, { limit: 1 });
  assert.deepEqual(p1.entries.map((e) => e.id), ['audit:u3']);
  const cur = decodeCursor(p1.nextCursor);
  assert.equal(cur.id, 'audit:u3', 'the cursor is the merged line itself');
  assert.equal('bursts' in cur, false, 'no burst list travels in the cursor any more');
  const p2 = assemblePage(all, { limit: 5, cursor: cur });
  assert.deepEqual(p2.entries.map((e) => e.id), ['payment:p1', 'order:o1']);
});

// A tiny Prisma stand-in: where-evaluation (equals/in/not/lte/gte/NOT/OR), orderBy, take.
function fakePrisma(data) {
  const match = (row, where) => Object.entries(where || {}).every(([k, cond]) => {
    if (k === 'NOT') return !match(row, cond);
    if (k === 'OR') return cond.some((w) => match(row, w));
    const v = row[k];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond && !cond.in.includes(v)) return false;
      if ('equals' in cond && v !== cond.equals) return false;
      if ('not' in cond && v === cond.not) return false;
      if ('lte' in cond && !(v <= cond.lte)) return false;
      if ('gte' in cond && !(v >= cond.gte)) return false;
      return true;
    }
    return v === cond;
  });
  const q = (rows, dateField) => async ({ where, take } = {}) => rows.filter((r) => match(r, where))
    .sort((a, b) => (b[dateField] - a[dateField]) || (a.id < b.id ? 1 : -1)).slice(0, take ?? rows.length);
  return {
    auditLog: { findMany: async ({ where, take }) => data.audit.filter((r) => match(r, where)).sort((a, b) => (b.createdAt - a.createdAt) || (a.id < b.id ? 1 : -1)).slice(0, take ?? 1e9) },
    order: { findMany: async ({ take } = {}) => data.orders.slice(0, take ?? data.orders.length) },
    payment: { findMany: q(data.payments, 'paymentDate') },
    refund: { findMany: async () => data.refunds || [] },
    emailLog: { findMany: q(data.mails, 'sentAt') },
    employee: { findMany: async () => [] },
  };
}

console.log('review round 3');
test('SAN-5: an ID / account number behind every common spelling of its keyword is masked (notes, display text, free text)', () => {
  const ids = ['ת"ז', 'ת״ז', "ת''ז", 'תז', 'ת ז', 'ת.ז', 'ת.ז.', 'ת׳ז', 'ח"ן', 'ח״ן', 'ח-ן', 'ח.ן', 'ID', 'id', 'ID:', 'זהות', 'תעודת זהות', 'חשבון', 'IBAN', 'account', 'acct'];
  for (const kw of ids) {
    for (const fn of [safeNoteText, cleanText, maskDigits, (t) => redactFreeText(t, 300)]) {
      const out = fn(`לקוח ${kw} 123456789 תודה`);
      assert.ok(!out.includes('123456789') && out.includes(MASK_FOR_TEST), `${kw} -> ${out}`);
    }
  }
  assert.equal(safeNoteText('ת"ז 123456789'), 'ת"ז •••');
  assert.equal(safeNoteText('ח״ן: 12345678'), 'ח״ן: •••');
  // ... without touching order numbers, first names, or words that merely contain the letters
  for (const t of ['הזמנה 28315', 'הזמנה מס\' 28315 ת"ז', 'חן 0501234567', 'חן 123456', 'לחן 123456', 'מתז 123456789', 'תזמון 123456789', 'idea 123456', 'video 123456', 'קוד 123456']) {
    assert.equal(safeNoteText(t), t, t);
  }
});

test('SAN-6: a list of order numbers / amounts / years is not masked as a card - but a real card still is', () => {
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const seps = [' ', '-', '/', ' - ', ', ', '.'];
  for (let i = 0; i < 4000; i += 1) {
    const order = () => String(10000 + rnd(20000));
    const price = () => String(100 + rnd(9900));
    const parts = [[order(), order(), order()], [order(), order(), order(), order()], [order(), price(), price()], [order(), order(), price(), price()]][i % 4];
    const sep = seps[rnd(seps.length)];
    const t = `הזמנות ${parts.join(sep)}`;
    assert.equal(maskCardNumbers(t), t, t);
    assert.equal(safeNoteText(t), t, t);
  }
  for (const t of ['הזמנות 25138 21757 21552', 'הזמנה 26995 2356 3507', '1200 1300 1400 1500', '2026 2027 2028 2029', '12345678 12345678', '1234 5678 9012 3456']) {
    assert.equal(maskCardNumbers(t), t, t);
  }
  // real cards: Visa / Mastercard / Amex / a 2-series Mastercard, and any digits explicitly after a card word
  for (const c of ['4580 1234 5678 9012', '5326 1234 5678 9014', '3782 822463 10005', '2221 0012 3456 7890', '4580123456789015', '6011 0000 0000 0004']) {
    assert.equal(maskCardNumbers(`שולם ${c} תודה`), 'שולם ••• תודה', c);
  }
  assert.equal(maskDigits('כרטיס 1234 5678 9012 3456'), 'כרטיס •••');
  assert.equal(maskDigits('כרטיס אשראי 1234567890123'), 'כרטיס אשראי •••');
});

test('SAN-9: a run of two-digit numbers (sizes, days, models) is not a card unless it passes Luhn', () => {
  for (const t of ['מידות 34 36 38 40 42 44 46', 'ימים 10,11,12,13,14,15,16', 'דגמים 12 13 14 15 16 17 18', 'מידות 34-36-38-40-42-44-46', '40 42 44 46 48 50 52 54']) {
    assert.equal(maskCardNumbers(t), t, t);
    assert.equal(safeNoteText(t), t, t);
    assert.equal(safeDisplayText(t), t, t);
  }
  assert.equal(maskCardNumbers('4 5 8 0 1 2 3 4 5 6 7 8 9 0 1 5'), MASK_FOR_TEST, 'a Luhn-valid single-digit card');
  assert.equal(maskCardNumbers('45 80 12 34 56 78 90 15'), MASK_FOR_TEST, 'a Luhn-valid 2-digit card');
});

test('SAN-7: keyword + up to 3 filler words + number is still an identifier; order numbers after a keyword are not', () => {
  const masked = [
    ['ת.ז. הלקוחה היא 123456789', 'ת.ז. הלקוחה היא •••'],
    ['ת.ז. (בעל) 123456789', 'ת.ז. (בעל) •••'],
    ['חשבון הבנק: 1234567', 'חשבון הבנק: •••'],
    ['חשבון בנק הפועלים 12345', 'חשבון בנק הפועלים •••'],
    ['account 12345678', 'account •••'],
    ['account number 12345678', 'account number •••'],
    ['acct: 123456', 'acct: •••'],
    ['תעודת זהות של הלקוח 123456789', 'תעודת זהות של הלקוח •••'],
  ];
  for (const [t, want] of masked) {
    assert.equal(safeNoteText(t), want, t);
    assert.equal(maskDigits(t), want, t);
  }
  for (const t of ['חשבון להזמנה 28315', 'חשבון של דנה הזמנה 28315', 'ת.ז. ההזמנה 28315', 'account order 28315', 'חשבון של הלקוח 28315', 'זיכוי אשראי להזמנה 28315', 'חשבון מספר הזמנה 28315', 'חשבון שולם ביום 5 עבור הזמנה 28315']) {
    assert.equal(safeNoteText(t), t, t);
    assert.equal(maskDigits(t), t, t);
  }
  // no runaway backtracking on filler-shaped input
  const t0 = Date.now();
  safeNoteText(`חשבון ${'א '.repeat(100000)}12345`);
  safeNoteText('חשבון '.repeat(30000));
  assert.ok(Date.now() - t0 < 500, `took ${Date.now() - t0} ms`);
});

test('SAN-8: a 13-digit barcode introduced as one is not masked; the same digits elsewhere still are', () => {
  for (const t of ['ברקוד 7290012345678', 'ברקוד: 7290012345678', 'barcode 7290012345678', 'Barcode: 7290012345678', 'EAN 7290012345678']) assert.equal(maskCardNumbers(t), t, t);
  assert.equal(maskCardNumbers('7290012345678'), MASK_FOR_TEST);
  assert.equal(maskCardNumbers('כרטיס 7290012345678'), 'כרטיס •••');
  assert.equal(maskCardNumbers('ברקוד 7290012345678901'), 'ברקוד •••', 'a 16-digit run is not an EAN');
});

test('PERF-1: stripInternalIds is linear - 200k spaces after a Hebrew letter take well under 100 ms', () => {
  const adversarial = `א${' '.repeat(200000)}x`;
  const t0 = process.hrtime.bigint();
  const out = stripInternalIds(adversarial);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 100, `took ${ms} ms`);
  assert.equal(out, 'א x');
  // the tail is still removed, with the gap before it collapsed
  assert.equal(stripInternalIds('שכר (פריט #12345678-abcd) נוסף'), 'שכר נוסף');
  assert.equal(stripInternalIds('שכר פריט #12345678abcd'), 'שכר');
});

test('PERF-1/2: every sanitizer stays fast on 200k-character adversarial strings', () => {
  const bad = [
    `א${' '.repeat(200000)}x`, ' '.repeat(200000), 'a'.repeat(200000), `${'a'.repeat(200000)}@`, '1'.repeat(200000), '1 '.repeat(100000), '12-'.repeat(66000),
    '.'.repeat(200000), 'a.'.repeat(100000), '@'.repeat(100000), 'ת.ז '.repeat(50000), `ID${' '.repeat(200000)}`, `חשבון ${'א '.repeat(100000)}`,
    `(פריט #${'a'.repeat(200000)}`, 'פריט '.repeat(40000), `${'0'.repeat(100000)} ${'0'.repeat(100000)}`, '4580 '.repeat(40000), 'IL62 '.repeat(40000),
  ];
  const fns = [
    ['stripInternalIds', stripInternalIds], ['cleanText', cleanText], ['safeNoteText', safeNoteText], ['safeDisplayText', safeDisplayText],
    ['redactFreeText', (t) => redactFreeText(t, 300)], ['maskDigits', maskDigits], ['maskCardNumbers', maskCardNumbers], ['safeMailError', safeMailError],
    ['safePaymentNote', (t) => safePaymentNote(t)],
  ];
  for (const [name, fn] of fns) {
    for (const s of bad) {
      const t0 = process.hrtime.bigint();
      fn(s);
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      assert.ok(ms < 1000, `${name}(${JSON.stringify(s.slice(0, 12))}... x${s.length}) took ${ms} ms`);
    }
  }
});

test('PERF-2: safeMailError cuts its input before any regex runs', () => {
  for (const s of ['a'.repeat(200000), `${'a'.repeat(200000)}@`, '1'.repeat(200000), '.'.repeat(200000), 'a.'.repeat(100000), '-'.repeat(200000)]) {
    const t0 = process.hrtime.bigint();
    const out = safeMailError(s);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(ms < 100, `took ${ms} ms`);
    assert.ok(out.startsWith('שליחה נכשלה'));
  }
  assert.equal(safeMailError('connect ECONNREFUSED 10.0.0.1:587'), 'שליחה נכשלה (תקלת חיבור לשרת הדואר)');
  assert.ok(!safeMailError('boom for a@b.com 4580123456789012').includes('4580'));
});

const asyncTests = [];
asyncTests.push(['B2: end to end (DB-paged, dense order-UPDATE bursts): every page size lists exactly what one big page lists', async () => {
  const data = { audit: [], orders: [{ id: 'o1', orderId: 1, orderDate: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'), isDeleted: false, employeeId: null, _count: { items: 1 } }], payments: [], mails: [] };
  const base = Date.parse('2026-08-01T00:00:00Z');
  let k = 0;
  // two bursts (rows 20 s apart for 5 min, then an hour later) with payments / mails / customer edits inside and around them
  for (const start of [0, 3600]) for (let i = 0; i < 16; i += 1) data.audit.push(updRow(`u${String(k += 1).padStart(3, '0')}`, base + (start + i * 20) * 1000));
  for (let i = 0; i < 9; i += 1) data.payments.push({ id: `p${i}`, customerId: 'c1', orderId: 1, amount: 10 + i, paymentDate: new Date(base + i * 47 * 1000 + 1000), paymentMethod: 'מזומן', notes: null, isDeleted: false, isRefund: false });
  for (let i = 0; i < 5; i += 1) data.mails.push({ id: `m${i}`, customerId: 'c1', to: 'x@y.com', subject: `S${i}`, status: 'success', sentAt: new Date(base + 3600000 + i * 61000), employeeId: null, fileName: null });
  for (let i = 0; i < 4; i += 1) data.audit.push({ id: `c${i}`, entityType: 'Customer', entityId: 'c1', action: 'UPDATE', createdAt: new Date(base + i * 90000 + 500), employeeId: null, changesJson: JSON.stringify({ city: { from: 'a', to: `b${i}` } }) });
  const prisma = fakePrisma(data);
  const walk = async (limit) => {
    const ids = [];
    let cursor = null;
    for (let guard = 0; guard < 300; guard += 1) {
      const r = await getCustomerHistory(prisma, 'c1', { limit, cursor });
      ids.push(...r.entries.map((e) => e.id));
      cursor = r.nextCursor;
      if (!cursor) return ids;
    }
    throw new Error('paging did not terminate');
  };
  const reference = await walk(200);
  assert.ok(reference.includes('audit:u016') && reference.includes('audit:u032'), 'each burst is one merged line');
  assert.equal(reference.filter((id) => /^audit:u\d+$/.test(id)).length, 2);
  for (const limit of [1, 2, 3, 5, 8]) {
    const ids = await walk(limit);
    assert.equal(new Set(ids).size, ids.length, `limit ${limit}: no repeats`);
    assert.deepEqual(ids, reference, `limit ${limit}: same feed as one big page`);
  }
}]);

test('cursor: opaque, round-trips, and every malformed / tampered form decodes to null (never throws)', () => {
  const merged = { at: '2026-09-01T10:02:00.000Z', groupId: 'audit:u3', seq: 2, id: 'audit:u3' };
  const c = encodeCursor(merged);
  assert.match(c, /^[A-Za-z0-9_-]+$/, 'base64url');
  assert.deepEqual(decodeCursor(c), { at: new Date(merged.at), id: 'audit:u3', groupId: 'audit:u3', seq: 2 });
  const enc = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const ok = { at: merged.at, g: 'g', s: 0, id: 'x' };
  assert.ok(decodeCursor(enc(ok)));
  assert.ok(decodeCursor(enc({ ...ok, bs: [['k', '2026-01-01T00:00:00Z']] })), 'a cursor issued by the old burst-carrying code still decodes (bursts ignored)');
  for (const bad of [
    enc({ ...ok, at: 'nope' }), enc({ ...ok, at: 5 }), enc({ ...ok, id: 5 }), enc({ ...ok, g: null }), enc({ ...ok, s: -1 }), enc({ ...ok, s: 1.5 }),
    enc({ ...ok, s: 'x' }), enc({ ...ok, id: 'x'.repeat(500) }), enc('[1,2]'), enc('null'), enc('"str"'), enc('{not json'), 'a'.repeat(2000),
    '###', 'a b', `${c}!`, 12345, {}, [],
  ]) assert.equal(decodeCursor(bad), null, String(typeof bad === 'string' ? bad.slice(0, 30) : JSON.stringify(bad)));
  // unicode ids survive a round trip (TextEncoder based, no btoa latin1 limit)
  assert.equal(decodeCursor(encodeCursor({ at: merged.at, groupId: 'g', seq: 0, id: 'audit:שלום' })).id, 'audit:שלום');
});

test('R12: customer counts describe the WHOLE assembled feed (countsScope "feed"), not the page or the category filter', () => {
  const p = assemblePage(built, { limit: 2 });
  assert.equal(p.countsScope, 'feed');
  assert.equal(p.entries.length, 2);
  assert.equal(p.counts.all, built.length);
  const onlyPay = assemblePage(built, { limit: 100, categories: new Set(['pay']) });
  assert.deepEqual(onlyPay.counts, countByCategory(built), 'a category filter narrows the entries, never the totals');
  assert.ok(onlyPay.entries.every((e) => e.category === 'pay'));
  const later = assemblePage(built, { limit: 2, cursor: decodeCursor(p.nextCursor) });
  assert.deepEqual(later.counts, p.counts, 'totals do not change from page to page');
});

test('sanitize: safeDisplayText strips ids and masks only card-like numbers (phones and house numbers survive)', () => {
  assert.equal(safeDisplayText('טלפון 052-123-4567 בית 14'), 'טלפון 052-123-4567 בית 14');
  assert.equal(safeDisplayText('כרטיס 4580 1234 5678 9012'), 'כרטיס •••');
  assert.equal(safeDisplayText('ref 5a1b2c3d-1111-2222-3333-444455556666 end'), 'ref end');
});

// ---------------------------------------------------------------------------------------------------
// Review round 2 (fix3): sanitising (SAN-1..4, ORD-4), customer-feed leaks (CUS-1), mail pairing, and the
// in-memory paging that replaced the source-level cursor (PG-1, PG-2, PG-3).
// ---------------------------------------------------------------------------------------------------
console.log('review round 2');

test('SAN-1: a card glued to a Latin letter / punctuation is masked (\\b was ASCII-word based)', () => {
  for (const [input, want] of [
    ['ref4580 1234 5678 9012', 'ref•••'], ['4580 1234 5678 9012x', '•••x'], ['card4580-1234-5678-9012.', 'card•••.'],
    ['(4580 1234 5678 9012)', '(•••)'], ['אשראי4580123456789012', 'אשראי•••'], ['x4580123456789012y', 'x•••y'],
  ]) {
    for (const fn of [maskCardNumbers, maskDigits, safeDisplayText, safeNoteText, cleanText]) assert.equal(fn(input), want, `${fn.name}(${input})`);
    assert.equal(redactFreeText(input, 100), want, `redactFreeText(${input})`);
  }
});

test('SAN-2: every separator a person can type between the groups of a card is covered', () => {
  const seps = [' ', '  ', ' - ', '.', '/', '_', ',', ' ', '‑', '־', '–', '-', ' / '];
  for (const sep of seps) {
    const card = ['4580', '1234', '5678', '9012'].join(sep);
    for (const fn of [maskCardNumbers, maskDigits, safeDisplayText, safeNoteText, cleanText]) assert.equal(fn(`שולם ${card} תודה`), 'שולם ••• תודה', `${fn.name} sep=${JSON.stringify(sep)}`);
  }
  // groups of 2 / single digits / 8+8 / Amex / Arabic-Indic digits / a 13-digit card
  for (const card of ['4580 12 34 56 78 90 15', '4 5 8 0 1 2 3 4 5 6 7 8 9 0 1 5', '45801234 56789012', '3782 822463 10005', '٤٥٨٠ ١٢٣٤ ٥٦٧٨ ٩٠١٢', '٤٥٨٠١٢٣٤٥٦٧٨٩٠١٢', '4580 1234 5678 9', '458012345678901234']) {
    for (const fn of [maskCardNumbers, maskDigits, safeDisplayText]) assert.equal(fn(`כרטיס ${card}.`), 'כרטיס •••.', `${fn.name}(${card})`);
  }
  // the card is masked INSIDE a longer run of numbers and the rest survives
  assert.equal(maskCardNumbers('הזמנה 28315 4580 1234 5678 9012 סכום 1,200'), 'הזמנה 28315 ••• סכום 1,200');
  assert.equal(maskCardNumbers('4580 1234 5678 9012 ו-4580 1234 5678 9010'), '••• ו-•••');
});

test('SAN-3: the order number after an account / card word stays readable', () => {
  for (const t of ['זיכוי אשראי להזמנה 28315', 'חשבון להזמנה 28315', 'החזר אשראי על הזמנה 28315 סכום 1200', 'אשראי 28315', 'כרטיס 28315', 'כרטיס אשראי חדש להזמנה 28315', 'חשבונית 28315', 'כרטיס לקוח 12345']) {
    assert.equal(redactFreeText(t, 200), t, t);
    assert.equal(maskDigits(t), t, t);
  }
  // ... while a real identifier right after its keyword is still masked
  assert.equal(maskDigits('חשבון 99887'), 'חשבון •••');
  assert.equal(maskDigits("חשבון מס' 99887"), "חשבון מס' •••");
  assert.equal(maskDigits('ח-ן 12345'), 'ח-ן •••');
  assert.equal(maskDigits('ת.ז. 12345678'), 'ת.ז. •••');
  assert.equal(maskDigits('תעודת זהות: 123456789'), 'תעודת זהות: •••');
  assert.equal(maskDigits('בנק 12 סניף 345 חשבון 999888'), 'בנק 12 סניף 345 חשבון •••');
  assert.equal(maskDigits('IBAN IL62 0108 0000 0009 9999 999'), 'IBAN •••');
  assert.equal(maskDigits('IL620108000000099999999'), '•••');
  assert.equal(maskDigits('כרטיס 4580 12 34 56 78 90 12'), 'כרטיס •••');
  assert.equal(maskDigits('כרטיס 4580 1234'), 'כרטיס •••', 'a partial card number (2 groups of 4) after the word');
});

test('SAN-4: a list of ordinary numbers is not a card - order + amounts, dates, phones stay', () => {
  for (const t of [
    '28315 1200 5000', '1200 1300 1400', '16.9.2026 17.9.2026', '16/9/2026 - 17/9/2026', '1,200 1,300 1,400 1,500', '₪1,234,567',
    '050-1234567', '052-123-4567 050-123-4567', '0501234567 / 0521234567', 'הזמנה 28315, 28316, 28317, 28318', '2026-09-16 2026-09-17', '100 200 300 400 500', '12345678 1234',
  ]) {
    assert.equal(maskCardNumbers(t), t, t);
    assert.equal(safeDisplayText(t), t, t);
  }
  assert.equal(safeNoteText('לתאם עם 052-123-4567 או 0501234567, בית 14'), 'לתאם עם 052-123-4567 או 0501234567, בית 14', 'phones stay in notes');
  // documented trade-off: four 4-digit groups that start like a real card (3-6 / 2221-2720) have exactly the shape of a
  // card and ARE masked (privacy first); ones that cannot start a card (1200 ..., 2026 ...) stay (SAN-6)
  assert.equal(maskCardNumbers('4200 4300 4400 4500'), MASK_FOR_TEST);
  assert.equal(maskCardNumbers('1200 1300 1400 1500'), '1200 1300 1400 1500');
});

test('SAN: no super-linear blow-up on hostile input', () => {
  const t0 = Date.now();
  for (const bad of ['1 '.repeat(100000), '1234 '.repeat(50000), `${'9'.repeat(200000)}x`, '-'.repeat(100000), '1-'.repeat(100000), `${'12 '.repeat(30000)}חשבון`, 'IL62 '.repeat(20000)]) {
    maskDigits(bad); safeNoteText(bad); cleanText(bad);
  }
  assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0} ms`);
});

test('ORD-4: notes mask an ID / account number behind its keyword and a card, but keep phones and house numbers', () => {
  assert.equal(safeNoteText('ת.ז 123456789 טלפון 0501234567'), 'ת.ז ••• טלפון 0501234567');
  assert.equal(safeNoteText('ח-ן 12345678 בנק 12'), 'ח-ן ••• בנק 12');
  assert.equal(safeNoteText('חשבון 99887766 סניף 345'), 'חשבון ••• סניף 345');
  assert.equal(safeNoteText('IBAN IL62-0108-0000-0009-9999-999'), 'IBAN •••');
  assert.equal(safeNoteText('כרטיס 4580 1234 5678 9012'), 'כרטיס •••');
  assert.equal(safeNoteText('רחוב הרצל 14 דירה 3, הזמנה 28315'), 'רחוב הרצל 14 דירה 3, הזמנה 28315');
  // customer notes / edits go through the same function
  const [e] = mapCustomerAuditRow(audit({ changesJson: JSON.stringify({ notes: { from: 'x', to: 'ת.ז 123456789 חשבון 99887766' } }) }), ctx);
  assert.equal(e.to, 'ת.ז ••• חשבון •••');
  assert.ok(!JSON.stringify(e).includes('123456789') && !JSON.stringify(e).includes('99887766'));
});

test('CUS-1: the CANCEL_ORDER note and every mail subject of the customer feed are redacted', () => {
  const c2 = { ...ctx, orderByKey: new Map([['28315', order], ['ord-uuid', order]]) };
  const cancel = mapOrderAuditRow({ id: 'k1', entityId: '28315', action: 'CANCEL_ORDER', employeeId: 'emp-1', createdAt: T('2026-09-23T10:00:00Z'), changesJson: JSON.stringify({ note: 'בוטל, כרטיס 4580 1234 5678 9012 חשבון 99887766' }) }, c2)[0];
  const dumpC = JSON.stringify(cancel);
  for (const secret of ['4580', '5678', '9012', '99887766']) assert.ok(!dumpC.includes(secret), `cancel note leaked ${secret}`);
  assert.ok(cancel.detail.startsWith('בוטל,'));
  assert.equal(cancel.details.find(([k]) => k === 'הערה')[1], cancel.detail);
  const subj = 'חשבונית כרטיס 4580 1234 5678 9012 להזמנה 28315';
  const audMail = mapCustomerAuditRow(audit({ id: 'sm1', action: 'EMAIL_SENT', changesJson: JSON.stringify({ subject: subj, to: 'a@b.com' }) }), ctx)[0];
  const orderMail = mapOrderAuditRow({ id: 'sm2', entityId: '28315', action: 'EMAIL_SENT', employeeId: null, createdAt: T('2026-09-23T10:00:00Z'), changesJson: JSON.stringify({ subject: subj, to: 'a@b.com' }) }, c2)[0];
  const logMail = mapEmailLogRow({ id: 'sm3', to: 'a@b.com', subject: subj, status: 'success', sentAt: T('2026-09-23T10:00:00Z') }, ctx)[0];
  const logFail = mapEmailLogRow({ id: 'sm4', to: 'a@b.com', subject: subj, status: 'error', errorMessage: 'ETIMEDOUT', sentAt: T('2026-09-23T10:00:00Z') }, ctx)[0];
  for (const e of [audMail, orderMail, logMail, logFail]) {
    const dump = JSON.stringify(e);
    for (const secret of ['4580', '5678', '9012']) assert.ok(!dump.includes(secret), `${e.id} leaked ${secret}`);
    assert.ok(e.title.includes('28315'), 'the order number in the subject stays readable');
  }
  // the redaction does not break the twin pairing (it pairs on the raw subject)
  const es = buildCustomerHistory({ auditRows: [audit({ id: 'sm1', action: 'EMAIL_SENT', changesJson: JSON.stringify({ subject: subj, to: 'a@b.com' }) })], emailLogs: [{ id: 'sm3', to: 'a@b.com', subject: subj, status: 'success', sentAt: T('2026-09-24T09:40:01Z') }] }, ctx).filter((e) => e.type === 'mail');
  assert.equal(es.length, 1);
});

test('mail pairing: each log pairs with the NEAREST unmatched audit row, not the first one it meets', () => {
  const a = (id, iso) => audit({ id, action: 'EMAIL_SENT', createdAt: T(iso), changesJson: JSON.stringify({ subject: 'S', to: 'a@b.com' }) });
  const l = (id, iso) => ({ id, to: 'a@b.com', subject: 'S', status: 'success', sentAt: T(iso) });
  // A@0, A@119, L@60, L@125 (seconds): greedy pairing sends L@60 to A@119 and strands L@125
  const es = buildCustomerHistory({
    auditRows: [a('A1', '2026-09-24T10:00:00Z'), a('A2', '2026-09-24T10:01:59Z')],
    emailLogs: [l('L1', '2026-09-24T10:01:00Z'), l('L2', '2026-09-24T10:02:05Z')],
  }, ctx).filter((e) => e.type === 'mail');
  assert.deepEqual(es.map((e) => e.id).sort(), ['audit:A1', 'audit:A2'], 'both logs are absorbed by their nearest audit row');
  // the log nearest to the audit row is its twin; the farther one is a second (resent) mail and stays visible
  const one = buildCustomerHistory({ auditRows: [a('A1', '2026-09-24T10:00:00Z')], emailLogs: [l('L1', '2026-09-24T10:01:40Z'), l('L2', '2026-09-24T10:00:03Z')] }, ctx).filter((e) => e.type === 'mail');
  assert.deepEqual(one.map((e) => e.id).sort(), ['audit:A1', 'email:L1'], 'L2 (3 s) is the twin, L1 (100 s) is a separate send');
});

// ---- the in-memory paging (PG-1, PG-2, PG-3) ----
const updRow2 = (id, entityId, s, base) => ({ id, entityType: 'Order', entityId, action: 'UPDATE', createdAt: new Date(base + s * 1000), employeeId: null, changesJson: '{}' });
const order2 = (n) => ({ id: `o${n}`, orderId: n, orderDate: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'), isDeleted: false, employeeId: null, _count: { items: 1 } });
const walkFeed = async (prisma, limit, extra = {}) => {
  const ids = [];
  let cursor = null;
  for (let guard = 0; guard < 2000; guard += 1) {
    const r = await getCustomerHistory(prisma, 'c1', { limit, cursor, ...extra });
    ids.push(...r.entries.map((e) => e.id));
    cursor = r.nextCursor;
    if (!cursor) return ids;
  }
  throw new Error('paging did not terminate');
};

asyncTests.push(['PG-1: tied UPDATE rows at the window edge no longer leapfrog older entries (limit 1..10 == one big page)', async () => {
  const b = Date.parse('2026-08-01T00:00:00Z');
  const A = (id, action, entityId, s, json = '{}', et = 'Order') => ({ id, entityType: et, entityId, action, createdAt: new Date(b + s * 1000), employeeId: null, changesJson: json });
  const data = {
    orders: [order2(1), order2(2)], payments: [], mails: [],
    audit: [
      A('a1', 'DEBT_APPROVED', 'o1', 5000, '{"approvedDebtAmount":5}'), A('b1', 'UPDATE', 'o1', 3000), A('b2', 'UPDATE', 'o1', 3000), A('b3', 'UPDATE', 'o1', 3000),
      A('c1', 'DEBT_APPROVED', 'o2', 2000, '{"approvedDebtAmount":7}'), A('m1', 'EMAIL_SENT', 'c1', 1500, '{"to":"a@b.c","subject":"S"}', 'Customer'),
    ],
  };
  const prisma = fakePrisma(data);
  const ref = await walkFeed(prisma, 200);
  assert.ok(ref.includes('audit:c1'), 'the o2 debt approval is in the feed');
  for (let limit = 1; limit <= 10; limit += 1) assert.deepEqual(await walkFeed(prisma, limit), ref, `limit ${limit}`);
}]);

asyncTests.push(['PG-3: an EMAIL_SENT audit row and its EmailLog twin never split across pages (no ghost second "mail sent")', async () => {
  const b = Date.parse('2026-08-01T00:00:00Z');
  const data = {
    orders: [], refunds: [],
    audit: [
      { id: 'm1', entityType: 'Customer', entityId: 'c1', action: 'EMAIL_SENT', createdAt: new Date(b + 100000), employeeId: null, changesJson: '{"to":"a@b.c","subject":"S"}' },
      { id: 'e1', entityType: 'Customer', entityId: 'c1', action: 'UPDATE', createdAt: new Date(b + 99000), employeeId: null, changesJson: '{"city":{"from":"a","to":"b"}}' },
    ],
    payments: [{ id: 'p1', customerId: 'c1', orderId: null, amount: 5, paymentDate: new Date(b + 50000), paymentMethod: 'מזומן', notes: null, isDeleted: false, isRefund: false }],
    mails: [{ id: 'l1', customerId: 'c1', to: 'a@b.c', subject: 'S', status: 'success', sentAt: new Date(b + 97000), employeeId: null, fileName: null }],
  };
  const prisma = fakePrisma(data);
  const ref = await walkFeed(prisma, 200);
  assert.deepEqual(ref, ['audit:m1', 'audit:e1#city', 'payment:p1']);
  for (let limit = 1; limit <= 10; limit += 1) assert.deepEqual(await walkFeed(prisma, limit), ref, `limit ${limit}`);
}]);

asyncTests.push(['PG-2: a chained run of 102 order UPDATE rows is ONE line on every page size (no partial ghost line)', async () => {
  const b = Date.parse('2026-08-01T00:00:00Z');
  const data = { orders: [order2(1)], payments: [], mails: [], audit: [] };
  for (let i = 0; i < 102; i += 1) data.audit.push(updRow2(`u${String(i).padStart(3, '0')}`, 'o1', i * 100, b)); // one row every 100 s: gaps < 2 min chain them all
  for (let i = 0; i < 6; i += 1) data.payments.push({ id: `p${i}`, customerId: 'c1', orderId: 1, amount: 5 + i, paymentDate: new Date(b + i * 1700 * 1000), paymentMethod: 'מזומן', notes: null, isDeleted: false, isRefund: false });
  const prisma = fakePrisma(data);
  const whole = await getCustomerHistory(prisma, 'c1', { limit: 200 });
  const runs = whole.entries.filter((e) => e.type === 'order-updated');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].detail, '102 עדכונים ברצף');
  const ref = whole.entries.map((e) => e.id);
  for (const limit of [1, 2, 3, 5, 7, 10]) {
    const ids = await walkFeed(prisma, limit);
    assert.deepEqual(ids, ref, `limit ${limit}`);
    assert.equal(ids.filter((id) => id.startsWith('audit:u')).length, 1, `limit ${limit}: one merged line`);
  }
}]);

// seeded fuzz: paged walks == one big page, no duplicate, no omission, for every page size 1..10 and category filter
function makeFuzzData(rnd) {
  const ri = (n) => Math.floor(rnd() * n);
  const base = Date.parse('2026-08-01T00:00:00Z');
  const data = { audit: [], orders: [], payments: [], mails: [], refunds: [] };
  const nOrd = 1 + ri(3);
  for (let i = 1; i <= nOrd; i += 1) data.orders.push({ ...order2(i), orderDate: new Date(base + ri(400) * 1000) });
  let id = 0;
  const nid = (p) => `${p}${String(++id).padStart(4, '0')}`;
  const grid = () => new Date(base + ri(600) * (rnd() < 0.5 ? 1000 : 10000)); // ties on a 1 s / 10 s grid
  for (const o of data.orders) {
    for (let bIdx = 0, nb = ri(4); bIdx < nb; bIdx += 1) {
      let t = base + ri(1500) * 1000;
      for (let i = 0, len = 1 + ri(12); i < len; i += 1) {
        t += ri(3) === 0 ? 0 : ri(rnd() < 0.1 ? 200 : 60) * 1000;
        data.audit.push({ id: nid('u'), entityType: 'Order', entityId: rnd() < 0.5 ? o.id : String(o.orderId), action: 'UPDATE', createdAt: new Date(t), employeeId: null, changesJson: '{}' });
      }
    }
    if (rnd() < 0.5) {
      const t = base + ri(1500) * 1000;
      const noteFirst = rnd() < 0.5;
      for (let j = 0; j < 2; j += 1) data.audit.push({ id: nid('x'), entityType: 'Order', entityId: o.id, action: 'CANCEL_ORDER', createdAt: new Date(t + j * 3), employeeId: null, changesJson: JSON.stringify({ note: j === (noteFirst ? 0 : 1) ? 'n' : '' }) });
    }
    if (rnd() < 0.3) data.audit.push({ id: nid('d'), entityType: 'Order', entityId: o.id, action: 'DEBT_APPROVED', createdAt: grid(), employeeId: null, changesJson: '{"approvedDebtAmount":5}' });
  }
  for (let i = 0, n = ri(10); i < n; i += 1) data.audit.push({ id: nid('c'), entityType: 'Customer', entityId: 'c1', action: 'UPDATE', createdAt: grid(), employeeId: null, changesJson: JSON.stringify({ city: { from: 'a', to: `b${i}` }, street: { from: 'q', to: 'r' } }) });
  for (let i = 0, n = ri(10); i < n; i += 1) data.payments.push({ id: nid('p'), customerId: 'c1', orderId: 1, amount: 10 + i, paymentDate: grid(), paymentMethod: 'מזומן', notes: null, isDeleted: false, isRefund: false });
  for (let i = 0, n = ri(6); i < n; i += 1) {
    const t = base + ri(1500) * 1000;
    const subj = `S${i}`;
    if (rnd() < 0.8) data.audit.push({ id: nid('m'), entityType: 'Customer', entityId: 'c1', action: 'EMAIL_SENT', createdAt: new Date(t), employeeId: null, changesJson: JSON.stringify({ to: 'a@b.c', subject: subj }) });
    if (rnd() < 0.8) data.mails.push({ id: nid('l'), customerId: 'c1', to: 'a@b.c', subject: subj, status: rnd() < 0.8 ? 'success' : 'failed', errorMessage: 'x', sentAt: new Date(t + (ri(11) - 5) * 1000), employeeId: null, fileName: null });
  }
  return data;
}

asyncTests.push(['B2 fuzz: 150 random datasets x page sizes 1..10 x category filters - concatenated pages == one big page, no duplicate, no omission', async () => {
  let seed = 20260929;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const CATS = [null, ['orders'], ['cust'], ['pay'], ['docs'], ['orders', 'docs'], ['cust', 'pay']];
  let runs = 0;
  for (let it = 0; it < 150; it += 1) {
    const prisma = fakePrisma(makeFuzzData(rnd));
    const cats = CATS[Math.floor(rnd() * CATS.length)];
    const categories = cats ? new Set(cats) : undefined;
    const whole = await getCustomerHistory(prisma, 'c1', { limit: 200, categories });
    assert.equal(whole.nextCursor, null, 'fuzz data fits one page');
    const ref = whole.entries.map((e) => e.id);
    for (let limit = 1; limit <= 10; limit += 1) {
      runs += 1;
      const ids = await walkFeed(prisma, limit, { categories });
      assert.equal(new Set(ids).size, ids.length, `dataset ${it} limit ${limit}: duplicate`);
      assert.deepEqual(ids, ref, `dataset ${it} limit ${limit} cats ${cats}`);
    }
    // the filtered feed is the full feed with the other categories removed (nothing is decided per source)
    if (categories) {
      const full = (await getCustomerHistory(prisma, 'c1', { limit: 200 })).entries.filter((e) => categories.has(e.category)).map((e) => e.id);
      assert.deepEqual(ref, full, `dataset ${it}: filtered == full feed filtered`);
    }
  }
  assert.equal(runs, 1500);
}]);

asyncTests.push(['loader: a source at its cap is reported in meta.truncated (newest rows kept); exactly at the cap is not; reads stay bounded', async () => {
  const b = Date.parse('2026-08-01T00:00:00Z');
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${String(i).padStart(5, '0')}`, customerId: 'c1', orderId: null, amount: 1, paymentDate: new Date(b + i * 1000), paymentMethod: 'מזומן', notes: null, isDeleted: false, isRefund: false }));
  const calls = [];
  const spy = (prisma) => {
    for (const model of Object.keys(prisma)) for (const fn of Object.keys(prisma[model])) {
      const orig = prisma[model][fn];
      prisma[model][fn] = async (args) => { calls.push([model, fn, args && args.take]); return orig(args); };
    }
    return prisma;
  };
  const exact = await getCustomerHistory(spy(fakePrisma({ audit: [], orders: [], payments: mk(SOURCE_CAP), mails: [] })), 'c1', { limit: 200 });
  assert.deepEqual(exact.meta.truncated, []);
  assert.equal(exact.counts.all, SOURCE_CAP);
  calls.length = 0;
  const over = await getCustomerHistory(spy(fakePrisma({ audit: [], orders: [], payments: mk(SOURCE_CAP + 1), mails: [] })), 'c1', { limit: 200 });
  assert.deepEqual(over.meta.truncated, ['payments']);
  assert.equal(over.counts.all, SOURCE_CAP, 'counts describe the assembled (bounded) feed');
  assert.equal(over.entries[0].id, `payment:p${String(SOURCE_CAP).padStart(5, '0')}`, 'the NEWEST rows are kept');
  assert.ok(!over.entries.some((e) => e.id === 'payment:p00000'), 'the oldest row is the one left out');
  assert.ok(over.nextCursor);
  // every read is capped, nothing runs in a transaction, and the round count is small
  assert.ok(calls.length <= 9, `${calls.length} reads`);
  assert.ok(calls.filter(([m, f]) => f === 'findMany' && m !== 'employee').every(([, , take]) => Number.isFinite(take) && take <= SOURCE_CAP * 3), JSON.stringify(calls));
}]);

asyncTests.push(['getCustomerHistory rejects a tampered cursor and needs no transaction', async () => {
  const prisma = fakePrisma({ audit: [], orders: [], payments: [], mails: [] });
  await assert.rejects(() => getCustomerHistory(prisma, 'c1', { cursor: 'bm90LWEtY3Vyc29y' }), (e) => e.code === 'INVALID_CURSOR');
  assert.equal(typeof prisma.$transaction, 'undefined');
  const r = await getCustomerHistory(prisma, 'c1', {});
  assert.deepEqual(r.entries, []);
  assert.equal(r.nextCursor, null);
  assert.equal(r.countsScope, 'feed');
}]);

for (const [name, fn] of asyncTests) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`  FAIL ${name}\n       ${e.message.split('\n').join('\n       ')}`);
  }
}

if (failures) {
  console.log(`\n${failures} test(s) FAILED`);
  process.exit(1);
}
console.log('\nall customer-history tests passed');
