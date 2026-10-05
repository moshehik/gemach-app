// מי לקח / מי החזיר לכל פריט (הערת הבעלים 2026-10-05): itemRentalActors (lib/history/orderJournal.js) - נגזר משורות AuditLog קיימות, בלי DDL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const J = await import(pathToFileURL(process.env.PROJ + '/lib/history/orderJournal.js').href);
const row = (entityId, action, at, employeeName, employeeId = 'e1') => ({ entityType: 'OrderItem', entityId, action, createdAt: new Date(at), employeeName, employeeId });

test('לקיחה והחזרה: האחרונה לכל פריט, רק כשהפריט כרגע במצב הזה', () => {
  const rows = [
    row('a', 'CONFIRM_RENTAL', '2026-10-06T08:00:00Z', 'רחל'),
    row('a', 'CONFIRM_RENTAL', '2026-10-07T08:00:00Z', 'דוד'), // ביטול ולקיחה מחדש
    row('a', 'RETURN_RENTAL', '2026-10-11T12:00:00Z', 'שרה'),
    row('b', 'CONFIRM_RENTAL', '2026-10-06T09:00:00Z', 'רחל'),
    row('b', 'RETURN_RENTAL', '2026-10-10T09:00:00Z', 'דוד'), // הוחזר ואז בוטלה ההחזרה -> isReturned=false
    row('c', 'UPDATE', '2026-10-06T09:00:00Z', 'רחל'),
  ];
  const out = J.itemRentalActors(rows, [{ id: 'a', isTaken: true, isReturned: true }, { id: 'b', isTaken: true, isReturned: false }, { id: 'c', isTaken: false, isReturned: false }, { id: 'd', isDeleted: true, isTaken: true }]);
  assert.equal(out.a.took.who, 'דוד');
  assert.equal(out.a.took.at, '2026-10-07T08:00:00.000Z');
  assert.equal(out.a.returned.who, 'שרה');
  assert.equal(out.b.took.who, 'רחל');
  assert.equal(out.b.returned, null, 'ההחזרה בוטלה - אין "מי החזיר"');
  assert.deepEqual(out.c, { took: null, returned: null });
  assert.ok(!('d' in out), 'פריט מחוק לא נכלל');
});

test('בלי שורת יומן (ייבוא ישן / אין עובדת מזוהה): who=null או null - לא ממציאים שם', () => {
  const out = J.itemRentalActors([row('a', 'CONFIRM_RENTAL', '2026-10-06T08:00:00Z', null, null), row('x', 'CONFIRM_RENTAL', '2026-10-06T08:00:00Z', 'רחל')], [{ id: 'a', isTaken: true }, { id: 'b', isTaken: true, isReturned: true }]);
  assert.equal(out.a.took.who, null);
  assert.equal(out.b.took, null);
  assert.equal(out.b.returned, null);
  const deletedEmp = J.itemRentalActors([row('a', 'RETURN_RENTAL', '2026-10-06T08:00:00Z', null, 'gone')], [{ id: 'a', isTaken: true, isReturned: true }]);
  assert.equal(deletedEmp.a.returned.who, 'עובד שנמחק');
});

test('אין מזהי עובד בפלט (רק שם) ופריטים ריקים/חסרים לא שוברים', () => {
  const out = J.itemRentalActors([row('a', 'CONFIRM_RENTAL', '2026-10-06T08:00:00Z', 'רחל', 'uuid-1')], [{ id: 'a', isTaken: true }]);
  assert.ok(!JSON.stringify(out).includes('uuid-1'));
  assert.deepEqual(J.itemRentalActors(), {});
  assert.deepEqual(J.itemRentalActors(null, null), {});
});
