// W6 — תיקוני הסקירה העצמאית ב-lib/history/orderHistory.js: D6 לא מסתיר את המצב הסופי של הפעלה-וכיבוי מהירים (בוצע / בוטל / בוצע
// בתוך 5 שניות על אותה רשומה), D10 אחד-לאחד (שורת audit אחת של EMAIL_FAILED מסבירה כשל EmailLog אחד בלבד), וקטגוריית שורות
// סימון הלו״ז היא קבוע אחד. פונקציות טהורות, 3 אזורי זמן (run.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderHistory, SCHEDULE_MARK_CAT } from '@/lib/history/orderHistory.js';

const ORDER_UUID = '0b6e7f1c-2a3d-4e5f-8a9b-0c1d2e3f4a5b';
const ORDER_NO = 53375;
const ITEM = '33333333-3333-4333-8333-333333333333';
const MARK = '88888888-8888-4888-8888-888888888888';
const T0 = Date.UTC(2026, 8, 23, 7, 0, 0);
let seq = 0;
const row = (over, sec) => ({ id: `r${++seq}`, entityType: 'Order', entityId: ORDER_UUID, action: 'UPDATE', employeeId: 'e1', employeeName: 'רחל כהן', createdAt: new Date(T0 + sec * 1000), changesJson: '{}', ...over });
const feed = (rows, extra = {}) => buildOrderHistory({
  order: { orderId: ORDER_NO, id: ORDER_UUID },
  auditRows: rows,
  items: [{ id: ITEM, sizeText: '38', prefix: 4512, modelName: 'רוז', isDeleted: false }],
  payments: [], refunds: [], obligations: [], emailLogs: extra.emailLogs || [], printVisits: [], customers: [],
});
const texts = (r) => r.entries.map((e) => e.text); // newest first

const markChanges = (to) => JSON.stringify({ orderId: ORDER_NO, scheduleStage: 'הכנה', scheduleDay: '2026-10-05', done: { from: to ? null : true, to } });
const mark = (action, sec) => row({ entityType: 'ScheduleStageMark', entityId: MARK, action, changesJson: markChanges(action === 'SCHEDULE_STAGE_DONE') }, sec);

test('D6: סימון בוצע / בוטל / בוצע בתוך 5 שניות - שלוש שורות, והפיד מסתיים ב"בוצע" (המצב הסופי)', () => {
  const r = feed([mark('SCHEDULE_STAGE_DONE', 0), mark('SCHEDULE_STAGE_UNDONE', 1), mark('SCHEDULE_STAGE_DONE', 2)]);
  assert.deepEqual(texts(r), ["סומן 'בוצע' בלו״ז · הכנה", "בוטל סימון 'בוצע' בלו״ז · הכנה", "סומן 'בוצע' בלו״ז · הכנה"]);
  assert.equal(r.dedupedBy.D6 || 0, 0);
});

test('D6: עדיין מסיר כפילות אמיתית - אותה שורה פעמיים ברצף על אותה רשומה', () => {
  const r = feed([mark('SCHEDULE_STAGE_DONE', 0), mark('SCHEDULE_STAGE_DONE', 1)]);
  assert.equal(r.entries.length, 1);
  assert.equal(r.dedupedBy.D6, 1);
});

test('D6: השכרה / ביטול השכרה / השכרה, והחזרה / ביטול החזרה / החזרה - שלוש שורות כל אחת, הסוף = המצב הסופי', () => {
  const item = (action, changes, sec) => row({ entityType: 'OrderItem', entityId: ITEM, action, changesJson: JSON.stringify(changes) }, sec);
  const rent = (sec) => item('CONFIRM_RENTAL', { isTaken: { from: false, to: true }, takenDate: { from: null, to: '2026-10-05T07:00:00.000Z' } }, sec);
  const cancelRent = (sec) => item('CANCEL_RENTAL', { isTaken: { from: true, to: false } }, sec);
  const ret = (sec) => item('RETURN_RENTAL', { isReturned: { from: false, to: true }, returnedOk: { from: false, to: true } }, sec);
  const cancelRet = (sec) => item('CANCEL_RETURN', { isReturned: { from: true, to: false } }, sec);
  const a = texts(feed([rent(0), cancelRent(1), rent(2)]));
  assert.equal(a.length, 3, a.join(' | '));
  assert.equal(a[0], a[2], 'the newest line is the rental again, not the cancel');
  assert.match(a[1], /בוטלה ההשכרה/);
  const b = texts(feed([ret(10), cancelRet(11), ret(12)]));
  assert.equal(b.length, 3, b.join(' | '));
  assert.match(b[0], /^הוחזר/);
  assert.match(b[1], /בוטלה ההחזרה/);
  assert.equal(b[0], b[2]);
});

const failedRow = (sec) => row({ entityId: String(ORDER_NO), action: 'EMAIL_FAILED', changesJson: JSON.stringify({ type: 'order', subject: 'x', error: 'ETIMEDOUT' }) }, sec);
const logErr = (id, sec) => ({ id, to: 'a@b.c', subject: 's', status: 'error', errorMessage: 'ETIMEDOUT', sentAt: new Date(T0 + sec * 1000) });

test('D10: שורת EMAIL_FAILED אחת מסבירה כשל EmailLog אחד בלבד - כשל שני בחלון נשאר שורה', () => {
  const r = feed([failedRow(0)], { emailLogs: [logErr('m1', 1), logErr('m2', 30)] });
  assert.equal(r.dedupedBy.D10, 1);
  assert.equal(r.entries.filter((e) => e.text === 'שליחת המייל נכשלה').length, 2, 'one from the audit row + one from the unmatched EmailLog');
});

test('D10: אחד-לאחד - שתי שורות audit ושני כשלים בחלון = אין שורות כפולות; כשל בלי audit בכלל נשאר', () => {
  const r = feed([failedRow(0), failedRow(20)], { emailLogs: [logErr('m1', 1), logErr('m2', 21)] });
  assert.equal(r.dedupedBy.D10, 2);
  assert.equal(r.entries.filter((e) => e.text === 'שליחת המייל נכשלה').length, 2);
  const lone = feed([], { emailLogs: [logErr('m3', 5)] });
  assert.equal(lone.entries.filter((e) => e.text === 'שליחת המייל נכשלה').length, 1);
});

test('קטגוריית שורות סימון הלו״ז = הקבוע SCHEDULE_MARK_CAT (docs עד החלטת הבעלים)', () => {
  assert.equal(SCHEDULE_MARK_CAT, 'docs');
  const r = feed([mark('SCHEDULE_STAGE_DONE', 0)]);
  assert.equal(r.entries[0].cat, SCHEDULE_MARK_CAT);
});
