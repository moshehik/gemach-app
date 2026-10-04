// רגרסיה לממצאי הסקירה העצמאית של W2a (כל בדיקה נכשלת בלי התיקון שלה). 3 אזורי זמן (run.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { baseOrder, baseState } from './fixtures.mjs';

const P = process.env.PROJ;
const D = await import(pathToFileURL(P + '/app/components/order-card/parts/ocDetailsLogic.js').href);
const L = await import(pathToFileURL(P + '/app/components/order-card/orderCardLogic.js').href);
const apply = (o, u) => (u ? { ...o, ...u } : o);
const putOf = (order) => { const st = baseState(); return L.buildPutPayload(order, { items: st.items, obligations: st.obligations, payments: st.payments, mode: 'save' }); };
const ABROAD_AFTER = baseOrder({ isAbroad: true, eventDate: '2026-10-04T21:00:00.000Z', fromDate: '2026-10-04T21:00:00.000Z', toDate: '2026-10-13T21:00:00.000Z', returnDate: '2026-10-13T21:00:00.000Z', extraDay: 'after' });
const ABROAD = baseOrder({ isAbroad: true, eventDate: '2026-10-04T21:00:00.000Z', fromDate: '2026-10-04T21:00:00.000Z', toDate: '2026-10-12T21:00:00.000Z', returnDate: '2026-10-12T21:00:00.000Z' });
const read = (f) => fs.readFileSync(P + '/app/components/order-card/' + f, 'utf8');

// ---------- 1 (HIGH, כסף): חו"ל עם יום נוסף → רגיל ----------
test('1: מעבר מחו"ל עם "יום אחרי" לאירוע רגיל מאפס extraDay - ה-PUT לא נושא יום נוסף (לא 50% בלי גלולה להסרה)', () => {
  const o = apply(ABROAD_AFTER, D.eventTypeUpdates(ABROAD_AFTER, false));
  assert.equal(o.extraDay, null);
  assert.equal(putOf(o).extraDay, null);
  assert.equal(D.extraDayVisible({ enableRentalExtension: true }, o), false, 'הגלולה מוסתרת - ולכן חייב להתאפס');
  const back = apply(baseOrder({ extraDay: 'before' }), D.eventTypeUpdates(baseOrder({ extraDay: 'before' }), true));
  assert.equal(back.extraDay, null, 'גם במעבר לחו"ל');
});

// ---------- 2 (MED): טווח חדש / יום נוסף בלי תאריכים ----------
test('2א: בחירת טווח חדש כשיש יום נוסף מאפסת אותו (בלי הזזה חלקית), וה-PUT בהתאם', () => {
  const o = apply(ABROAD_AFTER, D.rangeUpdates(ABROAD_AFTER, '2026-11-01', '2026-11-08'));
  assert.equal(o.extraDay, null);
  assert.equal(putOf(o).extraDay, null);
  // ובחירה מחדש של "יום אחרי" מזיזה את ההחזרה ביום אחד בלבד
  const again = apply(o, D.extraDayUpdates(o, 'after'));
  assert.equal(new Date(again.toDate) - new Date(o.toDate), 24 * 3600e3);
});
test('2ב: "יום לפני/אחרי" בלי לקיחה והחזרה = אין שינוי (לא נגבה 50% בלי יום); "ללא" תמיד אפשרי; הגלולה כבויה בלי תאריכים', () => {
  for (const o of [baseOrder({ isAbroad: true, eventDate: null }), baseOrder({ isAbroad: true, fromDate: '2026-10-05', toDate: null, returnDate: null }), baseOrder({ isWeekdayEvent: true, fromDate: null, toDate: '2026-10-06' })]) {
    assert.equal(D.extraDayReady(o), false);
    assert.equal(D.extraDayUpdates(o, 'after'), null);
    assert.equal(D.extraDayUpdates(o, 'before'), null);
  }
  const stray = baseOrder({ isAbroad: true, eventDate: null, extraDay: 'after' });
  assert.equal(apply(stray, D.extraDayUpdates(stray, null)).extraDay, null);
  assert.ok(D.extraDayReady(ABROAD));
  assert.ok(read('tabs/OcDetailsTab.js').includes('isDisabled={(v) => !!v && !extraDayReady(order)}'));
});

// ---------- 3 (MED): ביטול "יום השכרה נוסף" ברשימת השינויים ----------
const cur = (order) => ({ order, items: [], obligations: [], payments: [] });
const snapOf = (order) => ({ order, items: [], obligations: [], payments: [] });
test('3א: ביטול "יום נוסף" שנוסף מחזיר גם את ההחזרה ליומה - אין שינויים שנשארים, ו"החזר ביטול" מחזיר את ההזזה', () => {
  const snap = snapOf(ABROAD);
  const edited = apply(ABROAD, D.extraDayUpdates(ABROAD, 'after'));
  assert.ok(L.changesOf(snap, cur(edited)).some((c) => c.key === 'xday'));
  const cap = L.captureChange(cur(edited), 'xday');
  const undone = L.revertChange(cur(edited), snap, 'xday');
  assert.equal(undone.order.extraDay, null);
  assert.equal(undone.order.toDate, ABROAD.toDate);
  assert.equal(undone.order.returnDate, ABROAD.returnDate);
  assert.deepEqual(L.changesOf(snap, undone), [], 'אחרי הביטול אין "תאריך האירוע" תקוע');
  const redone = L.applyCaptured(undone, cap);
  assert.equal(redone.order.extraDay, 'after');
  assert.equal(redone.order.toDate, edited.toDate);
});
test('3ב: ביטול הסרת יום נוסף שמור מחזיר את ההזזה (בלי הזזה כפולה), וגם כשהטווח הוחלף - ההזזה על הטווח החדש', () => {
  const snap = snapOf(ABROAD_AFTER);
  const removed = apply(ABROAD_AFTER, D.extraDayUpdates(ABROAD_AFTER, null));
  const undone = L.revertChange(cur(removed), snap, 'xday');
  assert.deepEqual(undone.order, ABROAD_AFTER);
  assert.deepEqual(L.changesOf(snap, undone), []);
  const ranged = apply(ABROAD_AFTER, D.rangeUpdates(ABROAD_AFTER, '2026-11-01', '2026-11-08'));
  const u2 = L.revertChange(cur(ranged), snap, 'xday');
  assert.equal(u2.order.extraDay, 'after');
  assert.equal(new Date(u2.order.toDate) - new Date(ranged.toDate), 24 * 3600e3, 'יום אחד בלבד מעבר לטווח שנבחר');
  assert.equal(u2.order.fromDate, ranged.fromDate);
});
test('3ג: ביטול יום נוסף כשאין תאריכים בהזמנה הנוכחית - חוזר לערכי ה-snapshot העקביים', () => {
  const snap = snapOf(ABROAD_AFTER);
  const regular = apply(ABROAD_AFTER, D.eventTypeUpdates(ABROAD_AFTER, false));
  const undone = L.revertChange(cur(regular), snap, 'xday');
  assert.equal(undone.order.extraDay, 'after');
  assert.equal(undone.order.fromDate, ABROAD_AFTER.fromDate);
  assert.equal(undone.order.toDate, ABROAD_AFTER.toDate);
});

// ---------- 5 (LOW): ערי לקוחות - כישלון לא נשמר ----------
test('5: כישלון בטעינת ערי הלקוחות מנקה את המטמון (ניסיון חוזר), ותשובה לא-ok נחשבת כישלון', () => {
  const src = read('tabs/OcDeliveryTab.js');
  assert.ok(/if \(!r\.ok\) throw/.test(src));
  assert.ok(/\.catch\(\(\) => \{ locationsPromise = null;/.test(src));
});

// ---------- 6 (LOW, נגישות) ----------
test('6: הלוח בלי role="grid" (אין שורות/תאים); טולטיפ עזרה עם aria-label = הטקסט עצמו', () => {
  assert.ok(!/role="grid"/.test(read('parts/OcHebrewCalendar.js')));
  assert.ok(read('tabs/OcDeliveryTab.js').includes('data-tip={text} aria-label={text}'));
  assert.ok(!/aria-label="עזרה"/.test(read('tabs/OcDeliveryTab.js') + read('tabs/OcDetailsTab.js')));
});

// ---------- 7 (LOW): השוואת שדות ההזמנה ----------
test('7: ריק/null/undefined שקולים, ותאריך באותו יום ישראלי בצורת שמירה אחרת אינו "שינוי"', () => {
  assert.ok(L.sameOrderField('notes', '', null));
  assert.ok(L.sameOrderField('deliveryAddress', undefined, ''));
  assert.ok(L.sameOrderField('eventDate', '2026-10-08', '2026-10-07T21:00:00.000Z'));
  assert.ok(L.sameOrderField('fromDate', '2026-10-07T21:00:00.000Z', '2026-10-08T09:30:00.000Z'));
  assert.ok(!L.sameOrderField('eventDate', '2026-10-08', '2026-10-08T21:00:00.000Z'), 'יום אחר');
  assert.ok(!L.sameOrderField('notes', 'a', ''));
  const s = baseOrder({ notes: null, deliveryAddress: null, eventDate: '2026-10-07T21:00:00.000Z' });
  const c = { ...s, notes: '', deliveryAddress: '', eventDate: '2026-10-08' };
  assert.deepEqual(L.changesOf(snapOf(s), cur(c)), []);
  assert.deepEqual(L.changesOf(snapOf(s), cur({ ...c, eventDate: '2026-10-09' })).map((x) => x.key), ['date']);
});

// ---------- 4 (לבעלים): מסיכת הת״ז - מתג יחיד ----------
test('4: מסיכת הת״ז נשלטת בקבוע יחיד (MASK_ZEOUT_WHEN_ID_GATE)', () => {
  assert.equal(typeof D.MASK_ZEOUT_WHEN_ID_GATE, 'boolean');
  const src = read('parts/ocDetailsLogic.js');
  assert.equal((src.match(/MASK_ZEOUT_WHEN_ID_GATE/g) || []).length, 2, 'הגדרה + שימוש אחד');
  assert.equal(D.zeoutDisplay('312456789', { requireIdForEdit: true }), D.MASK_ZEOUT_WHEN_ID_GATE ? '••••••789' : '312456789');
});
