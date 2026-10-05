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

// ---------- תצוגה בשורת הפריט ----------
import fs from 'node:fs';
import path from 'node:path';
const A = await import(pathToFileURL(process.env.PROJ + '/app/components/order-card/hooks/useItemActions.js').href);
const read = (p) => fs.readFileSync(path.join(process.env.PROJ, p), 'utf8').split('\r\n').join('\n');
const dateText = (iso) => A.dayTimeOf(iso);

test('rentalActorLines: לקיחה + החזרה עם תאריך ועובדת; תווית משלוח; בלי נתונים - אין שורה', () => {
  const item = { id: 'a', isTaken: true, takenDate: '2026-10-06T08:00:00.000Z', isReturned: true, returnDate: '2026-10-11T12:00:00.000Z' };
  const actors = { a: { took: { who: 'רחל', at: '2026-10-06T08:00:00.000Z' }, returned: { who: 'דוד', at: '2026-10-11T12:00:00.000Z' } } };
  const lines = A.rentalActorLines(item, { isDelivery: false }, actors);
  assert.deepEqual(lines.map((l) => [l.key, l.label]), [['took', 'לקיחה'], ['returned', 'החזרה']]);
  assert.equal(lines[0].text, `${dateText(item.takenDate)} · רחל`);
  assert.equal(lines[1].text, `${dateText(item.returnDate)} · דוד`);
  const del = A.rentalActorLines(item, { isDelivery: true, deliveryDirection: 'הלוך-חזור' }, actors);
  assert.deepEqual(del.map((l) => l.label), ['מסירה', 'איסוף']);
  assert.deepEqual(A.rentalActorLines({ id: 'b', isTaken: false }, {}, actors), [], 'לא נלקח - אין שורה');
  assert.deepEqual(A.rentalActorLines({ id: 'c', isTaken: true }, {}, {}), [], 'בלי תאריך ובלי עובדת - אין שורה');
  assert.equal(A.rentalActorLines({ id: 'c', isTaken: true, takenDate: item.takenDate }, {}, null)[0].text, dateText(item.takenDate), 'בלי עובדת - רק התאריך');
  assert.deepEqual(A.rentalActorLines({ id: 'p', _localId: 'x', isNew: true, isTaken: true }, {}, actors), [], 'פריט שטרם נשמר');
  const optimistic = A.rentalActorLines({ id: 'a', isTaken: true, isReturned: true, takenDate: item.takenDate, returnDate: new Date('2026-10-12T09:00:00Z') }, {}, { a: { took: actors.a.took } });
  assert.equal(optimistic.length, 2, 'החזרה אופטימית: התאריך מוצג גם לפני שהעובדת נטענה');
});

test('חיווט: הנתיב מחזיר itemActors; OrderCardA5 טוען פעם אחת ומשתף (ציר + שורות); OcItemRow מציג; אין שאילתה נוספת', () => {
  const route = read('app/api/orders/[id]/journal/route.js');
  assert.match(route, /itemActors: itemRentalActors\(auditRows, items\)/);
  assert.equal((route.match(/prisma\.auditLog\.findMany/g) || []).length, 2, 'אותן שתי שאילתות AuditLog כמו קודם (בלי N+1)');
  const a5 = read('app/components/order-card/OrderCardA5.js');
  assert.match(a5, /const journalData = useOrderJournalData\(oc\);/);
  assert.match(a5, /<OcJournalContext\.Provider value=\{journalData\}>/);
  assert.match(a5, /<OcStepper oc=\{oc\} data=\{journalData\} \/>/);
  const row = read('app/components/order-card/parts/OcItemRow.js');
  assert.match(row, /rentalActorLines\(item, oc\.order, journal && journal\.itemActors\)/);
  assert.match(row, /data-actor=\{l\.key\}/);
});
