// W6 — "שלבי ההזמנה" (lib/schedule/orderStages.js) ו"יומן הזמנה" (lib/history/orderJournal.js): פונקציות טהורות, 3 אזורי זמן
// (run.mjs). שלבים לפי הגדרות הלו״ז (דלוק/כבוי, משלוח/איסוף, תיקונים כן/לא, offset), גלגול החזרה ליום עובד, "בוצע" מסימון
// או מהפריטים, השלב הנוכחי; ביומן: מי/מתי מכל מקור, צומת תשלום, משמרת בגבולות היום הישראלי (AMB-18: שעות + שמות).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOrderStages, dayKeyOf, dayLabels, returnDueKey, effectiveStartKey } from '@/lib/schedule/orderStages.js';
import { buildOrderJournal, shiftAt, timeOf, parseShiftDefinitions, shiftDefinitionAt } from '@/lib/history/orderJournal.js';
import { resolveScheduleSettings } from '@/lib/schedule/settings.js';
import { relativeDayLabel } from '@/app/components/order-card/parts/ocHistoryModel.js';

const IL = (key, hhmm = '00:00') => {
  // an Israel wall-clock time (October 2026 = UTC+3) as an instant
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 3, m));
};
const ORG_MAIN = resolveScheduleSettings({});
const ORG_NEVE = resolveScheduleSettings({ enable_deliveries: 'true' });
const keys = (r) => r.stages.map((s) => s.key);
const byKey = (r, k) => r.stages.find((s) => s.key === k);
const ORDER = {
  orderId: 53375, orderDate: IL('2026-09-23', '10:12'), eventDate: IL('2026-10-08'), // Thursday 8.10.2026 (Israel midnight = 21:00Z the day before)
  isAbroad: false, isDelivery: false, deliveryDirection: null,
  items: [{ id: 'a1', sleeveAlteration: 0 }, { id: 'a2', sleeveAlteration: 0 }],
};
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

test('יום ישראלי בכל אזור זמן: אירוע בחצות ישראל = 8.10, תוויות עבריות בלבד', () => {
  assert.equal(dayKeyOf(ORDER.eventDate), '2026-10-08');
  assert.equal(dayKeyOf(new Date('2026-10-07T21:30:00Z')), '2026-10-08');
  assert.equal(dayKeyOf(new Date('2026-10-07T20:59:00Z')), '2026-10-07');
  const l = dayLabels('2026-10-08');
  assert.equal(l.wd, "יום ה'");
  assert.equal(l.wdFull, 'יום חמישי');
  assert.match(l.he, /^כז תשרי תשפ"ז$/);
  assert.equal(l.heShort, 'כז תשרי');
});

test('הגמ״ח הראשי (בלי משלוחים): הזמנה → הכנה → איסוף → אירוע → החזרה ידנית; ימים לפי כללי הלו״ז', () => {
  const r = computeOrderStages(ORDER, { schedule: ORG_MAIN, todayKey: '2026-10-04' });
  assert.deepEqual(keys(r), ['order', 'prep', 'pick', 'event', 'manret']);
  assert.equal(byKey(r, 'order').dayKey, '2026-09-23');
  assert.equal(byKey(r, 'prep').dayKey, '2026-10-05', 'prep = 3 business days before the event');
  assert.equal(byKey(r, 'pick').dayKey, '2026-10-06', 'pick = 2 business days before');
  assert.equal(byKey(r, 'event').dayKey, '2026-10-08');
  assert.equal(byKey(r, 'manret').dayKey, '2026-10-11', 'Thursday event: return rolls past Friday/Saturday to Sunday');
  assert.equal(r.currentKey, 'prep');
  assert.ok(byKey(r, 'prep').current && !byKey(r, 'pick').current);
  assert.ok(byKey(r, 'prep').markable, 'prep is the one stage marked from the card');
  assert.ok(!byKey(r, 'pick').markable);
  assert.equal(byKey(r, 'event').done, false);
});

test('נווה (משלוחים דלוקים): הלוך-חזור → משלוח הלוך + משלוח חזור במקום איסוף / החזרה ידנית; יום לפני', () => {
  const o = { ...ORDER, isDelivery: true, deliveryDirection: 'הלוך-חזור' };
  const r = computeOrderStages(o, { schedule: ORG_NEVE, delivery: { daysBefore: 2, daysAfter: 1 }, todayKey: '2026-10-04' });
  assert.deepEqual(keys(r), ['order', 'prep', 'dout', 'event', 'dback']);
  assert.equal(byKey(r, 'dout').dayKey, '2026-10-06');
  assert.equal(byKey(r, 'dback').dayKey, '2026-10-09', 'deliveries count Friday unless delivery_skip_weekends');
  const skip = computeOrderStages(o, { schedule: ORG_NEVE, delivery: { daysBefore: 2, daysAfter: 1, skipWeekends: true }, todayKey: '2026-10-04' });
  assert.equal(byKey(skip, 'dback').dayKey, '2026-10-11');
  const oneDay = computeOrderStages({ ...o, deliveryOneDayBefore: true }, { schedule: ORG_NEVE, delivery: { daysBefore: 2 }, todayKey: '2026-10-04' });
  assert.equal(byKey(oneDay, 'dout').dayKey, '2026-10-07');
  assert.deepEqual(keys(computeOrderStages({ ...o, deliveryDirection: 'הלוך' }, { schedule: ORG_NEVE, todayKey: '2026-10-04' })), ['order', 'prep', 'dout', 'event', 'manret']);
  assert.deepEqual(keys(computeOrderStages({ ...o, deliveryDirection: 'חזור' }, { schedule: ORG_NEVE, todayKey: '2026-10-04' })), ['order', 'prep', 'pick', 'event', 'dback']);
  // a delivery order in an org whose deliveries are off: the schedule lists it in no delivery stage - neither do we
  assert.deepEqual(keys(computeOrderStages(o, { schedule: ORG_MAIN, todayKey: '2026-10-04' })), ['order', 'prep', 'event']);
});

test('תיקונים רק כשיש פריט עם תיקון ותיקונים דלוקים; שלב כבוי בהגדרות לא מוצג; offset מההגדרות', () => {
  const alt = { ...ORDER, items: [{ id: 'a1', sleeveAlteration: 1, alterationDone: false }, { id: 'a2' }] };
  // chronological; repair (offset 0 = the event day) before the event on the same day (schedule numbering)
  assert.deepEqual(keys(computeOrderStages(alt, { schedule: ORG_MAIN, todayKey: '2026-10-04' })), ['order', 'prep', 'pick', 'repair', 'event', 'manret']);
  const offAlt = resolveScheduleSettings({ enable_alterations: 'false' });
  assert.ok(!keys(computeOrderStages(alt, { schedule: offAlt, todayKey: '2026-10-04' })).includes('repair'));
  const noPrep = resolveScheduleSettings({ schedule_stage_prep_enabled: 'false', schedule_stage_repair_days: '5' });
  const r = computeOrderStages(alt, { schedule: noPrep, todayKey: '2026-10-04' });
  assert.ok(!keys(r).includes('prep'));
  assert.equal(byKey(r, 'repair').dayKey, '2026-10-15', 'repair offset 5 business days after the event (configured magnitude, default direction)');
});

test('חו״ל: יום ההתחלה = fromDate; החזרה = toDate מגולגל ליום עובד; אירוע עם טווח', () => {
  const o = { ...ORDER, isAbroad: true, fromDate: IL('2026-10-12'), toDate: IL('2026-10-16'), eventDate: IL('2026-10-14') };
  assert.equal(effectiveStartKey(o), '2026-10-12');
  const r = computeOrderStages(o, { schedule: ORG_MAIN, todayKey: '2026-10-04' });
  assert.equal(byKey(r, 'event').dayKey, '2026-10-12');
  assert.equal(byKey(r, 'event').endKey, '2026-10-16');
  assert.equal(byKey(r, 'manret').dayKey, '2026-10-18', 'toDate Friday 16.10 rolls to Sunday 18.10');
  assert.equal(returnDueKey({ eventDate: IL('2026-10-08') }), '2026-10-11');
});

test('"בוצע": מהפריטים (כולם נלקחו / הוחזרו + מצב), מסימון בלו״ז (עדיף אותו יום, אחרת האחרון), ביטול סימון באותו יום', () => {
  const taken = { ...ORDER, items: ORDER.items.map((i) => ({ ...i, isTaken: true, isReturned: true, returnedOk: i.id === 'a1' })) };
  const r = computeOrderStages(taken, { schedule: ORG_MAIN, todayKey: '2026-10-20' });
  assert.equal(byKey(r, 'pick').done, true);
  assert.equal(byKey(r, 'pick').doneVia, 'fact');
  assert.equal(byKey(r, 'manret').outcome, 'not_ok');
  assert.equal(byKey(r, 'event').done, true, 'event day passed');
  assert.equal(r.currentKey, 'prep', 'prep is never done by a fact');
  const marks = [
    { stageKey: 'prep', dayKey: '2026-10-01', done: true, markedAt: IL('2026-10-01', '09:00'), markedBy: 'דוד לוי' },
    { stageKey: 'prep', dayKey: '2026-10-05', done: true, markedAt: IL('2026-10-05', '11:20'), markedBy: 'רחל כהן' },
  ];
  const m = computeOrderStages(taken, { schedule: ORG_MAIN, marks, todayKey: '2026-10-20' });
  assert.equal(byKey(m, 'prep').doneVia, 'mark');
  assert.equal(byKey(m, 'prep').mark.markedBy, 'רחל כהן', 'the mark of the stage day wins');
  assert.equal(m.currentKey, null);
  const other = computeOrderStages(ORDER, { schedule: ORG_MAIN, marks: [marks[0]], todayKey: '2026-10-04' });
  assert.equal(byKey(other, 'prep').mark.markedBy, 'דוד לוי', 'a mark from another day (dates changed) still counts');
  const undone = computeOrderStages(ORDER, { schedule: ORG_MAIN, marks: [{ ...marks[1], done: false }, marks[0]], todayKey: '2026-10-04' });
  assert.equal(byKey(undone, 'prep').done, false, 'un-marked on the stage day = not done');
  const noItems = computeOrderStages({ ...ORDER, items: [] }, { schedule: ORG_MAIN, todayKey: '2026-10-04' });
  assert.equal(byKey(noItems, 'pick').done, false, 'no items is not "all taken"');
});

test('משמרת (AMB-18): כניסה ≤ T ≤ יציאה, משמרת פתוחה רק באותו יום ישראלי, מחוקה לא נספרת, שעות + שמות', () => {
  const T = IL('2026-10-05', '11:20');
  const shifts = [
    { name: 'רחל כהן', entryTime: IL('2026-10-05', '08:00'), exitTime: IL('2026-10-05', '16:00') },
    { name: 'שרה לוי', entryTime: IL('2026-10-05', '09:30'), exitTime: IL('2026-10-05', '14:00') },
    { name: 'דוד לוי', entryTime: IL('2026-10-05', '12:00'), exitTime: IL('2026-10-05', '20:00') },
    { name: 'מיכל לוי', entryTime: IL('2026-10-04', '10:00'), exitTime: null },
    { name: 'אסתר גולד', entryTime: IL('2026-10-05', '07:00'), exitTime: IL('2026-10-05', '18:00'), isDeleted: true },
    { name: 'יוסי מזרחי', entryTime: IL('2026-10-05', '10:00'), exitTime: null },
  ];
  const definitions = parseShiftDefinitions([{ name: 'יום', from: '00:00', to: '24:00' }]); // D3: בלי הגדרות אין משמרות בכלל
  const s = shiftAt(shifts, T, { todayKey: '2026-10-05', definitions });
  assert.deepEqual(s.names, ['רחל כהן', 'שרה לוי', 'יוסי מזרחי']);
  assert.equal(s.from, '08:00');
  assert.equal(s.to, 'עכשיו');
  const closed = shiftAt(shifts.slice(0, 2), T, { todayKey: '2026-10-09', definitions });
  assert.equal(closed.to, '16:00');
  assert.equal(shiftAt(shifts, IL('2026-10-05', '06:00'), { definitions }), null);
  assert.equal(shiftAt(shifts, new Date('2026-10-04T21:00:00Z'), { definitions }), null, 'a date-only instant (import) has no shift');
  assert.equal(timeOf(T), '11:20');
});

test('יומן: מי/מתי לכל שלב מכל מקור, צומת תשלום אחרי ההזמנה, משמרות, בלי מזהים ובלי תאריך לועזי', () => {
  const o = { ...ORDER, items: [{ id: 'a1', sleeveAlteration: 1, alterationDone: true, isTaken: true, takenDate: IL('2026-10-06', '18:05') }, { id: 'a2', isTaken: true, takenDate: IL('2026-10-06', '18:10') }] };
  const marks = [{ stageKey: 'prep', dayKey: '2026-10-05', done: true, markedAt: IL('2026-10-05', '11:20'), markedBy: 'רחל כהן', markedById: 'e-uuid-should-not-leak' }];
  const { stages } = computeOrderStages(o, { schedule: ORG_MAIN, marks, todayKey: '2026-10-07' });
  const audit = [
    { entityType: 'Order', entityId: 'x', action: 'CREATE', createdAt: IL('2026-09-23', '10:12'), employeeId: 'e1', employeeName: 'רחל כהן', changesJson: '{}' },
    { entityType: 'OrderItem', entityId: 'a1', action: 'ALTERATION_DONE', createdAt: IL('2026-10-04', '13:00'), employeeId: 'e3', employeeName: 'אסתר גולד', changesJson: '{}' },
    { entityType: 'OrderItem', entityId: 'a1', action: 'CONFIRM_RENTAL', createdAt: IL('2026-10-06', '18:05'), employeeId: 'e2', employeeName: 'דוד לוי', changesJson: '{}' },
    { entityType: 'OrderItem', entityId: 'a2', action: 'CONFIRM_RENTAL', createdAt: IL('2026-10-06', '18:10'), employeeId: 'e1', employeeName: 'רחל כהן', changesJson: '{}' },
    { entityType: 'Payment', entityId: 'p2', action: 'CREATE', createdAt: IL('2026-09-23', '10:20'), employeeId: 'e1', employeeName: 'רחל כהן', changesJson: '{}' },
  ];
  const payments = [
    { id: 'p1', amount: 300, paymentDate: IL('2026-09-23', '10:18'), isDeleted: false },
    { id: 'p2', amount: 230, paymentDate: IL('2026-09-23', '10:19'), isDeleted: false },
    { id: 'p3', amount: 100, paymentDate: IL('2026-09-24', '10:19'), isDeleted: true },
  ];
  const shifts = [{ name: 'רחל כהן', entryTime: IL('2026-09-23', '08:00'), exitTime: IL('2026-09-23', '16:00') }, { name: 'שרה כהן', entryTime: IL('2026-09-23', '08:00'), exitTime: IL('2026-09-23', '16:00') }];
  const j = buildOrderJournal({ order: { orderId: 53375, orderDate: o.orderDate, employeeName: 'רחל כהן' }, stages, auditRows: audit, items: o.items, payments, shifts, todayKey: '2026-10-07', shiftDefinitions: parseShiftDefinitions([{ name: 'בוקר', from: '08:00', to: '16:00' }]) });
  const n = Object.fromEntries(j.nodes.map((x) => [x.key, x]));
  assert.deepEqual(j.nodes.map((x) => x.key).slice(0, 2), ['order', 'pay'], 'payment node right after the order (as in the design)');
  assert.equal(n.order.who, 'רחל כהן');
  assert.equal(n.order.when.time, '10:12');
  assert.equal(n.order.shift.title, 'משמרת בוקר · 08:00–16:00');
  assert.deepEqual(n.order.shift.names, ['רחל כהן', 'שרה כהן']);
  assert.equal(n.pay.done, true);
  assert.equal(n.pay.paid, 530, 'net of live payments');
  assert.equal(n.pay.paidText, 'שולם ₪530');
  assert.equal(n.pay.who, 'רחל כהן', 'the CREATE row of the latest payment');
  assert.equal(n.pay.when.time, '10:20');
  assert.equal(n.prep.who, 'רחל כהן');
  assert.equal(n.prep.via, 'mark');
  assert.equal(n.prep.when.time, '11:20');
  assert.equal(n.repair.who, 'אסתר גולד', 'last ALTERATION_DONE');
  assert.equal(n.pick.who, 'דוד לוי', 'first CONFIRM_RENTAL');
  assert.equal(n.pick.when.time, '18:05');
  assert.equal(n.event.when, null);
  assert.equal(n.manret.done, false);
  assert.equal(n.manret.when, null);
  const blob = JSON.stringify(j);
  assert.ok(!UUID_RE.test(blob) && !blob.includes('e-uuid-should-not-leak'), 'no employee ids');
  for (const x of j.nodes) for (const lbl of [x.when && x.when.day, x.plannedDay].filter(Boolean)) assert.ok(/[א-ת]/.test(lbl.he) && !/\d{1,2}[./]\d{1,2}/.test(lbl.he));
});

test('יומן: נפילה למקורות הטבלה (takenDate / returnDate בלי "מי"), הזמנה מיובאת בתאריך בלבד = בלי שעה ובלי משמרת', () => {
  const o = { ...ORDER, orderDate: new Date('2026-09-22T21:00:00Z'), items: [{ id: 'a1', isTaken: true, takenDate: IL('2026-10-06', '18:00'), isReturned: true, returnDate: IL('2026-10-11', '12:20'), returnedOk: true }] };
  const { stages } = computeOrderStages(o, { schedule: ORG_MAIN, todayKey: '2026-10-20' });
  const j = buildOrderJournal({ order: { orderId: 1, orderDate: o.orderDate, employeeName: null }, stages, auditRows: [], items: o.items, payments: [], shifts: [{ name: 'x', entryTime: IL('2026-09-23', '00:00'), exitTime: IL('2026-09-23', '20:00') }], todayKey: '2026-10-20' });
  const n = Object.fromEntries(j.nodes.map((x) => [x.key, x]));
  assert.equal(n.order.when.time, null);
  assert.equal(n.order.when.dateOnly, true);
  assert.equal(n.order.shift, null);
  assert.equal(n.pick.via, 'table');
  assert.equal(n.pick.who, null);
  assert.equal(n.pick.when.time, '18:00');
  assert.equal(n.manret.when.dayKey, '2026-10-11');
  assert.equal(n.pay.done, false);
  assert.equal(n.pay.when, null);
});

test('תווית יום יחסית: היום / מחר / אתמול / יום + תאריך עברי (בלי שנה)', () => {
  const l = dayLabels('2026-10-08');
  assert.equal(relativeDayLabel('2026-10-08', '2026-10-08', l), 'היום');
  assert.equal(relativeDayLabel('2026-10-09', '2026-10-08', l), 'מחר');
  assert.equal(relativeDayLabel('2026-10-07', '2026-10-08', l), 'אתמול');
  assert.equal(relativeDayLabel('2026-10-08', '2026-10-01', l), 'יום חמישי כ״ז תשרי');
  assert.equal(relativeDayLabel('2026-12-31', '2027-01-01', dayLabels('2026-12-31')), 'אתמול', 'across a year end');
});

// ---------- AMB-18 (B): שמות משמרות לפי הגדרה (shift_definitions) ----------
const DEFS = parseShiftDefinitions([{ name: 'בוקר', from: '08:00', to: '16:00' }, { name: 'ערב', from: '16:00', to: '24:00' }]);
const SHIFTS_1120 = [
  { name: 'רחל כהן', entryTime: IL('2026-10-05', '08:00'), exitTime: IL('2026-10-05', '16:00') },
  { name: 'שרה לוי', entryTime: IL('2026-10-05', '09:30'), exitTime: IL('2026-10-05', '14:00') },
];

test('שמות משמרות: parseShiftDefinitions מנקה (JSON / מערך, שעות מרופדות, פריט לא תקין מדולג, עד 12), ריק/שבור = []', () => {
  assert.deepEqual(parseShiftDefinitions('[{"name":" בוקר ","from":"8:00","to":"16:00"}]'), [{ name: 'בוקר', from: '08:00', to: '16:00' }]);
  assert.deepEqual(parseShiftDefinitions([{ name: 'א', from: '08:00', to: '08:00' }, { name: '', from: '08:00', to: '09:00' }, { name: 'ב', from: '25:00', to: '09:00' }, { name: 'ג', from: '09:00' }, null, 5, { name: 'ד', from: '09:00', to: '10:61' }]), []);
  assert.deepEqual(parseShiftDefinitions(''), []);
  assert.deepEqual(parseShiftDefinitions(undefined), []);
  assert.deepEqual(parseShiftDefinitions('not json'), []);
  assert.deepEqual(parseShiftDefinitions('{"name":"x"}'), [], 'לא מערך');
  assert.equal(parseShiftDefinitions(Array.from({ length: 30 }, (_, i) => ({ name: `מ${i}`, from: '01:00', to: '02:00' }))).length, 12);
});

test('שמות משמרות: הגדרה לפי שעת הרישום (גבול כלול בהתחלה, לא בסוף), הראשונה מנצחת, טווח שחוצה חצות', () => {
  const at = (hhmm) => shiftDefinitionAt(DEFS, IL('2026-10-05', hhmm));
  assert.equal(at('08:00').name, 'בוקר');
  assert.equal(at('15:59').name, 'בוקר');
  assert.equal(at('16:00').name, 'ערב', 'גבול הסיום של בוקר = תחילת ערב');
  assert.equal(at('07:59'), null);
  const night = parseShiftDefinitions([{ name: 'לילה', from: '22:00', to: '06:00' }, { name: 'כללי', from: '00:00', to: '23:59' }]);
  const n = (hhmm) => shiftDefinitionAt(night, IL('2026-10-05', hhmm));
  assert.equal(n('23:30').name, 'לילה');
  assert.equal(n('02:15').name, 'לילה', 'אחרי חצות, באותו טווח');
  assert.equal(n('06:00').name, 'כללי', 'סוף הטווח לא כלול - נופל להגדרה הבאה');
  assert.equal(n('12:00').name, 'כללי');
  const overlap = parseShiftDefinitions([{ name: 'א', from: '08:00', to: '12:00' }, { name: 'ב', from: '10:00', to: '14:00' }]);
  assert.equal(shiftDefinitionAt(overlap, IL('2026-10-05', '11:00')).name, 'א', 'כמה התאמות = הראשונה');
  assert.equal(shiftDefinitionAt([], IL('2026-10-05', '11:00')), null);
});

test('שמות משמרות: כותרת הטולטיפ "משמרת בוקר · 08:00–16:00" (שעות ההגדרה) + שמות העובדים; בלי הגדרות / בלי התאמה = הכותרת הרגילה', () => {
  const T = IL('2026-10-05', '11:20');
  const named = shiftAt(SHIFTS_1120, T, { todayKey: '2026-10-09', definitions: DEFS });
  assert.equal(named.title, 'משמרת בוקר · 08:00–16:00');
  assert.equal(named.name, 'בוקר');
  assert.deepEqual(named.names, ['רחל כהן', 'שרה לוי']);
  // D3 (בעלים 2026-10-05): כל עוד לא הוגדרו משמרות - אין מידע משמרת בכלל (לא כותרת, לא שמות, לא שעות)
  assert.equal(shiftAt(SHIFTS_1120, T, { todayKey: '2026-10-09' }), null, 'בלי הגדרות: אין משמרת');
  assert.equal(shiftAt(SHIFTS_1120, T, { todayKey: '2026-10-09', definitions: [] }), null);
  assert.equal(shiftAt(SHIFTS_1120, T, { todayKey: '2026-10-09', definitions: undefined }), null);
  const evening = parseShiftDefinitions([{ name: 'ערב', from: '16:00', to: '23:00' }]);
  const noMatch = shiftAt(SHIFTS_1120, T, { todayKey: '2026-10-09', definitions: evening });
  assert.equal(noMatch, null, 'השעה לא באף הגדרה - אין משמרת (D3)');
  assert.equal(shiftAt(SHIFTS_1120, IL('2026-10-05', '06:00'), { definitions: DEFS }), null, 'אין עובדים במשמרת = אין משמרת (גם עם הגדרה)');
  assert.equal(shiftAt(SHIFTS_1120, new Date('2026-10-04T21:00:00Z'), { definitions: DEFS }), null, 'תאריך בלבד (ייבוא) - בלי משמרת');
});

test('שמות משמרות: buildOrderJournal מעביר את ההגדרות לצומתי היומן (שלב מסומן + תשלום) - ובלי הגדרות הפלט זהה להיום', () => {
  const o = { ...ORDER, items: [{ id: 'a1', sleeveAlteration: 0 }] };
  const marks = [{ stageKey: 'prep', dayKey: '2026-10-05', done: true, markedAt: IL('2026-10-05', '11:20'), markedBy: 'רחל כהן' }];
  const stages = computeOrderStages(o, { schedule: ORG_MAIN, marks, todayKey: '2026-10-07' }).stages;
  const payments = [{ id: 'p1', amount: 300, paymentDate: IL('2026-09-23', '17:30'), isDeleted: false, isRefund: false }];
  const shifts = [
    { name: 'רחל כהן', entryTime: IL('2026-10-05', '08:00'), exitTime: IL('2026-10-05', '16:00') },
    { name: 'דוד לוי', entryTime: IL('2026-09-23', '16:00'), exitTime: IL('2026-09-23', '23:30') },
  ];
  const base = { order: { orderId: 53375, orderDate: o.orderDate, employeeName: 'רחל כהן' }, stages, auditRows: [], items: o.items, payments, shifts, todayKey: '2026-10-07' };
  const plain = buildOrderJournal(base);
  const named = buildOrderJournal({ ...base, shiftDefinitions: DEFS });
  const nodes = (j) => Object.fromEntries(j.nodes.map((n) => [n.key, n]));
  assert.ok(Object.values(nodes(plain)).every((x) => x.shift === null), 'D3: בלי הגדרות אף צומת לא נושא משמרת');
  assert.ok(Object.values(nodes(named)).some((x) => x.shift), 'עם הגדרות - יש');
  assert.equal(nodes(named).prep.shift.title, 'משמרת בוקר · 08:00–16:00');
  assert.equal(nodes(named).pay.shift.title, 'משמרת ערב · 16:00–24:00', 'צומת התשלום (17:30) = ערב');
  assert.deepEqual(buildOrderJournal({ ...base, shiftDefinitions: [] }), plain, 'הגדרות ריקות = בדיוק כמו בלי');
});

// ---- 2026-10-05, דיווח הבעלים (צילום): הזמנה שהוחזרה (החזרה ידנית היום 15:00) נשארה על "הכנה" כ"שלב הנוכחי" עם "סמן הכנה בוצעה" ----
const RET_ORDER = {
  ...ORDER,
  items: [{ id: 'a1', sleeveAlteration: 0, isTaken: true, takenDate: IL('2026-10-06', '11:00'), isReturned: true, returnDate: IL('2026-10-11', '15:00'), returnedOk: true },
    { id: 'a2', sleeveAlteration: 0, isTaken: true, takenDate: IL('2026-10-06', '11:00'), isReturned: true, returnDate: IL('2026-10-11', '15:00'), returnedOk: true }],
};
const RET_AUDIT = [
  { entityType: 'Order', entityId: 'x', action: 'CREATE', createdAt: IL('2026-09-23', '10:12'), employeeName: 'רחל כהן' },
  { entityType: 'OrderItem', entityId: 'a1', action: 'RETURN_RENTAL', createdAt: IL('2026-10-11', '15:00'), employeeName: 'דוד לוי' },
  { entityType: 'OrderItem', entityId: 'a2', action: 'RETURN_RENTAL', createdAt: IL('2026-10-11', '15:00'), employeeName: 'דוד לוי' },
];

test('צילום הבעלים: הזמנה שהוחזרה (הכנה בעבר ולא סומנה, אירוע בעבר, החזרה היום) -> אין שלב נוכחי, אין סימון הכנה', () => {
  const todayKey = '2026-10-11';
  const old = computeOrderStages(RET_ORDER, { schedule: ORG_MAIN, todayKey });
  assert.equal(old.currentKey, 'prep', 'ברירת המחדל (לו״ז/ללא אפשרות) לא השתנתה');
  const r = computeOrderStages(RET_ORDER, { schedule: ORG_MAIN, todayKey, closeWhenReturned: true });
  assert.equal(byKey(r, 'manret').done, true);
  assert.equal(r.closed, true);
  assert.equal(r.currentKey, null);
  assert.ok(r.stages.every((s) => !s.current));
  const prep = byKey(r, 'prep');
  assert.equal(prep.done, false);
  assert.equal(prep.markable, false, 'לא מוצע "סמן הכנה בוצעה"');
  assert.equal(prep.closedByReturn, true);
  const j = buildOrderJournal({ order: { orderId: 53375, orderDate: RET_ORDER.orderDate }, stages: r.stages, auditRows: RET_AUDIT, items: RET_ORDER.items, payments: [], todayKey });
  assert.equal(j.currentKey, null);
  assert.ok(j.nodes.every((n) => !n.current), 'אף צומת ביומן לא "נוכחי"');
  const man = j.nodes.find((n) => n.key === 'manret');
  assert.equal(man.done, true);
  assert.equal(man.when.time, '15:00');
  assert.equal(man.who, 'דוד לוי');
});

test('שלב ההחזרה סומן בלו״ז (בלי עובדת הפריטים) = סגור; משלוח חזור בוצע = סגור', () => {
  const marked = computeOrderStages(ORDER, { schedule: ORG_MAIN, todayKey: '2026-10-12', closeWhenReturned: true,
    marks: [{ stageKey: 'manret', dayKey: '2026-10-11', done: true, markedAt: IL('2026-10-11', '15:00'), markedBy: 'דוד לוי' }] });
  assert.equal(marked.currentKey, null);
  assert.equal(byKey(marked, 'prep').closedByReturn, true);
  const del = computeOrderStages({ ...RET_ORDER, isDelivery: true, deliveryDirection: 'הלוך-חזור' }, { schedule: ORG_NEVE, todayKey: '2026-10-12', closeWhenReturned: true });
  assert.equal(byKey(del, 'dback').done, true);
  assert.equal(del.currentKey, null);
});

test('מקרי גבול: אין החזרה = הכנה נשארת נוכחית; החזרה חלקית לא סוגרת; הזמנה מבוטלת סגורה; ריק לא נחשב "הוחזר"', () => {
  const todayKey = '2026-10-11';
  const none = computeOrderStages(ORDER, { schedule: ORG_MAIN, todayKey: '2026-10-04', closeWhenReturned: true });
  assert.equal(none.currentKey, 'prep');
  assert.equal(none.closed, false);
  assert.ok(byKey(none, 'prep').markable && !byKey(none, 'prep').closedByReturn);
  const partial = computeOrderStages({ ...RET_ORDER, items: [RET_ORDER.items[0], { id: 'a2', sleeveAlteration: 0, isTaken: true }] }, { schedule: ORG_MAIN, todayKey, closeWhenReturned: true });
  assert.equal(partial.closed, false, 'return of one of two items is not a closed order');
  assert.equal(partial.currentKey, 'prep');
  const cancelled = computeOrderStages({ ...ORDER, isDeleted: true }, { schedule: ORG_MAIN, todayKey, closeWhenReturned: true });
  assert.equal(cancelled.closed, true);
  assert.equal(cancelled.currentKey, null);
  const empty = computeOrderStages({ ...ORDER, items: [] }, { schedule: ORG_MAIN, todayKey, closeWhenReturned: true });
  assert.equal(empty.closed, false, 'no items is not "all returned"');
  const deletedOnly = computeOrderStages({ ...RET_ORDER, items: [...RET_ORDER.items, { id: 'z', isDeleted: true }] }, { schedule: ORG_MAIN, todayKey, closeWhenReturned: true });
  assert.equal(deletedOnly.closed, true, 'a deleted item does not keep the order open');
});

// דוח ההשוואה F12: תבנית תאריך עברי אחת בכרטיס - גרשיים ("כ״ח תשרי"), כמו כרטיס האירוע (gematriya) והדמו
test('גרשיים בתאריכים העבריים של היומן / ההיסטוריה / הציר: כח->כ״ח, ל->ל׳, טו->ט״ו, השנה והחודש "אדר א׳" נשמרים', async () => {
  const H = await import('@/app/components/order-card/parts/ocHistoryModel.js');
  assert.equal(H.shortHebrew('כח תשרי תשפ"ז'), 'כ״ח תשרי');
  assert.equal(H.shortHebrew('ל תשרי תשפ"ז'), 'ל׳ תשרי');
  assert.equal(H.shortHebrew('טו אדר א\' תשפ"ז'), 'ט״ו אדר א׳');
  assert.equal(H.shortHebrew('כ״ז תשרי תשפ״ז'), 'כ״ז תשרי', 'idempotent');
  assert.equal(H.hebrewWithGershayim('כח תשרי תשפ"ז'), 'כ״ח תשרי תשפ״ז');
  assert.equal(H.hebrewWithGershayim(dayLabels('2026-10-08').he), 'כ״ז תשרי תשפ״ז');
  assert.equal(H.relativeDayLabel('2026-10-08', '2026-10-01', dayLabels('2026-10-08')), 'יום חמישי כ״ז תשרי');
  assert.equal(H.shortHebrew(''), '');
  // אותו פורמט כמו הפורמטר המשותף של כרטיס האירוע
  const D = await import('@/app/components/order-card/parts/ocDetailsLogic.js');
  assert.equal(H.hebrewWithGershayim(dayLabels('2026-10-08').he), D.hebDateLabel('2026-10-08'));
});

// סקירה: שנה מעוברת - heShort בלי שנה ('יג אדר א׳') לא נחתך; השנה נחתכת רק כשהטוקן האחרון הוא שנה
test('shortHebrew / hebrewWithGershayim: אדר א׳/ב׳ (שנה מעוברת), יום וחודש בלבד, מחרוזות מלאות עם שנה', async () => {
  const H = await import('@/app/components/order-card/parts/ocHistoryModel.js');
  assert.equal(H.shortHebrew("יג אדר א'"), 'י״ג אדר א׳');
  assert.equal(H.shortHebrew("יג אדר ב'"), 'י״ג אדר ב׳');
  assert.equal(H.shortHebrew('יג אדר א׳'), 'י״ג אדר א׳');
  assert.equal(H.shortHebrew('כ״ח תשרי'), 'כ״ח תשרי');
  assert.equal(H.shortHebrew('כח תשרי'), 'כ״ח תשרי');
  assert.equal(H.shortHebrew('כח תשרי תשפ"ז'), 'כ״ח תשרי');
  assert.equal(H.shortHebrew("יג אדר א' תשפ\"ז"), 'י״ג אדר א׳');
  assert.equal(H.shortHebrew('ט תמוז התשפ״ז'), 'ט׳ תמוז', 'שנה עם ה׳');
  assert.equal(H.shortHebrew('ל תשרי'), 'ל׳ תשרי');
  assert.equal(H.shortHebrew('טו תמוז'), 'ט״ו תמוז', 'תמוז/תשרי הם חודשים ולא שנה');
  assert.equal(H.hebrewWithGershayim("יג אדר א' תשפ\"ז"), 'י״ג אדר א׳ תשפ״ז');
  assert.equal(H.hebrewWithGershayim('כח תשרי תשפ"ז'), 'כ״ח תשרי תשפ״ז');
  assert.equal(H.isHebrewYearToken('תשפ"ז') && H.isHebrewYearToken('התשפ״ז'), true);
  assert.equal(H.isHebrewYearToken('תשרי') || H.isHebrewYearToken('תמוז') || H.isHebrewYearToken('טבת'), false);
  // פוטנציאלי אמיתי: 13 באדר א׳ תשפ״ז (פברואר 2027) דרך dayLabels
  const l = dayLabels('2027-02-19');
  assert.match(l.heShort, /אדר/);
  assert.ok(H.shortHebrew(l.heShort).includes('אדר'), l.heShort);
  assert.equal(H.shortHebrew(l.heShort), H.shortHebrew(l.he), 'heShort ו-he נותנים אותו יום וחודש');
  assert.equal(H.relativeDayLabel('2027-02-19', '2027-02-01', l), `${l.wdFull} ${H.shortHebrew(l.heShort)}`);
});

// ---- בעלים 2026-10-06: "אם הושכר, ההכנה (והתיקונים) נרשמות אוטומטית כבוצעו" - הסקה לתצוגה (inferPrepWhenTaken, רק היומן/הציר) ----
const TAKEN_ITEMS = [{ id: 'a1', sleeveAlteration: 0, isTaken: true, takenDate: IL('2026-10-05', '21:53') }, { id: 'a2', sleeveAlteration: 0, isTaken: true, takenDate: IL('2026-10-05', '21:53') }];
test('צילום הבעלים: איסוף בוצע (נלקח), הכנה לא סומנה, האירוע עבר -> הכנה בוצעה (מוסקת), השלב הנוכחי = החזרה, בלי כפתור סימון', () => {
  const o = { ...ORDER, items: TAKEN_ITEMS };
  const todayKey = '2026-10-09';
  const plain = computeOrderStages(o, { schedule: ORG_MAIN, todayKey, closeWhenReturned: true });
  assert.equal(plain.currentKey, 'prep', 'ברירת מחדל (בלי האפשרות) לא משתנה');
  const r = computeOrderStages(o, { schedule: ORG_MAIN, todayKey, closeWhenReturned: true, inferPrepWhenTaken: true });
  const prep = byKey(r, 'prep');
  assert.equal(byKey(r, 'pick').done, true);
  assert.equal(prep.done, true);
  assert.equal(prep.doneVia, 'inferred');
  assert.equal(prep.markable, false, 'אין "סמן הכנה בוצעה"');
  assert.equal(r.currentKey, 'manret');
  const j = buildOrderJournal({ order: { orderId: 53375, orderDate: o.orderDate }, stages: r.stages, auditRows: [], items: o.items, payments: [], todayKey });
  const pn = j.nodes.find((n) => n.key === 'prep');
  assert.equal(pn.done, true);
  assert.equal(pn.when, null, 'אין מי/מתי להכנה מוסקת');
  assert.equal(j.currentKey, 'manret');
});

test('הסקה: לקיחה חלקית (פריט אחד) מספיקה להכנה; האיסוף עצמו עדיין ממתין; ללא לקיחה כלל - הכנה נשארת נוכחית', () => {
  const partial = { ...ORDER, items: [TAKEN_ITEMS[0], { id: 'a2', sleeveAlteration: 0 }] };
  const r = computeOrderStages(partial, { schedule: ORG_MAIN, todayKey: '2026-10-06', inferPrepWhenTaken: true });
  assert.equal(byKey(r, 'prep').done, true);
  assert.equal(byKey(r, 'pick').done, false);
  assert.equal(r.currentKey, 'pick');
  const none = computeOrderStages(ORDER, { schedule: ORG_MAIN, todayKey: '2026-10-06', inferPrepWhenTaken: true });
  assert.equal(none.currentKey, 'prep');
  assert.equal(byKey(none, 'prep').inferred, undefined);
  const eventOnly = computeOrderStages(ORDER, { schedule: ORG_MAIN, todayKey: '2026-10-20', inferPrepWhenTaken: true });
  assert.equal(byKey(eventOnly, 'prep').done, false, 'אירוע שחלף (מידע בלבד) לא מסיק הכנה');
});

test('הסקה: תיקונים נחשבים בוצעו כשנלקח; סימון קיים לא נדרס; שלב מסומן לפני כן נשאר mark', () => {
  const alt = { ...ORDER, items: [{ id: 'a1', sleeveAlteration: 1, isTaken: true }, { id: 'a2', sleeveAlteration: 0 }] };
  const r = computeOrderStages(alt, { schedule: ORG_MAIN, todayKey: '2026-10-06', inferPrepWhenTaken: true });
  assert.ok(byKey(r, 'repair'), 'שלב תיקונים קיים בהזמנה עם תיקון');
  assert.equal(byKey(r, 'repair').done, true);
  assert.equal(byKey(r, 'repair').doneVia, 'inferred');
  const marks = [{ stageKey: 'prep', dayKey: '2026-10-05', done: true, markedAt: IL('2026-10-05', '11:20'), markedBy: 'רחל כהן' }];
  const m = computeOrderStages({ ...ORDER, items: TAKEN_ITEMS }, { schedule: ORG_MAIN, marks, todayKey: '2026-10-09', inferPrepWhenTaken: true });
  assert.equal(byKey(m, 'prep').doneVia, 'mark', 'סימון אמיתי נשמר');
  assert.equal(byKey(m, 'prep').mark.markedBy, 'רחל כהן');
});

test('הסקה: משלוח הלוך (נלקח) / חו״ל / מבוטלת / הוחזרה', () => {
  const del = { ...ORDER, isDelivery: true, deliveryDirection: 'הלוך-חזור', items: TAKEN_ITEMS };
  const r = computeOrderStages(del, { schedule: ORG_NEVE, delivery: { daysBefore: 2, daysAfter: 1 }, todayKey: '2026-10-07', inferPrepWhenTaken: true });
  assert.equal(byKey(r, 'dout').done, true, 'משלוח הלוך בוצע (כל הפריטים נלקחו)');
  assert.equal(byKey(r, 'prep').done, true);
  assert.equal(r.currentKey, 'dback');
  const abroad = { ...ORDER, isAbroad: true, fromDate: IL('2026-10-06'), toDate: IL('2026-10-14'), eventDate: IL('2026-10-06'), items: TAKEN_ITEMS };
  const a = computeOrderStages(abroad, { schedule: ORG_MAIN, todayKey: '2026-10-08', inferPrepWhenTaken: true });
  assert.equal(byKey(a, 'prep').done, true);
  assert.equal(a.currentKey, 'manret');
  const cancelled = computeOrderStages({ ...ORDER, isDeleted: true, items: TAKEN_ITEMS }, { schedule: ORG_MAIN, todayKey: '2026-10-09', closeWhenReturned: true, inferPrepWhenTaken: true });
  assert.equal(byKey(cancelled, 'prep').done, false, 'מבוטלת: אין הסקה');
  assert.equal(cancelled.currentKey, null);
  const returned = computeOrderStages({ ...ORDER, items: RET_ORDER.items }, { schedule: ORG_MAIN, todayKey: '2026-10-11', closeWhenReturned: true, inferPrepWhenTaken: true });
  assert.equal(byKey(returned, 'prep').done, true);
  assert.equal(returned.closed, true);
  assert.equal(returned.currentKey, null);
});

test('הנתיב /journal מעביר inferPrepWhenTaken; הלו״ז / prep-mark לא', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const rd = (p) => fs.readFileSync(path.join(process.env.PROJ, p), 'utf8');
  assert.match(rd('app/api/orders/[id]/journal/route.js'), /closeWhenReturned: true, inferPrepWhenTaken: true/);
  assert.ok(!/inferPrepWhenTaken/.test(rd('app/api/orders/[id]/prep-mark/route.js')));
  assert.ok(!/inferPrepWhenTaken/.test(rd('lib/schedule/loaders.js')));
});
