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

// ---------- 1 (HIGH, כסף): סוג אירוע ויום נוסף - שונה ב-AMB-13 (הבעלים: "יום נוסף" בכל סוג אירוע) ----------
const SINGLE = baseOrder({ eventDate: '2026-10-08' });
test('1 (AMB-13): מעבר סוג אירוע שומר extraDay (הוא נתמך בכל סוג) - ה-PUT נושא אותו, והגלולה נשארת מוצגת', () => {
  const o = apply(ABROAD_AFTER, D.eventTypeUpdates(ABROAD_AFTER, false));
  assert.equal(o.extraDay, 'after');
  assert.equal(putOf(o).extraDay, 'after');
  assert.equal(o.fromDate, null);
  assert.equal(D.extraDayVisible({ enableRentalExtension: true }, o), true, 'הגלולה מוצגת גם באירוע רגיל');
  const before = baseOrder({ extraDay: 'before' });
  const back = apply(before, D.eventTypeUpdates(before, true));
  assert.equal(back.extraDay, 'before');
  assert.equal(D.extraDayReady(back), false, 'אין טווח עדיין - גלולות לפני/אחרי כבויות עד שיבחרו התאריכים');
});
test('1ב (AMB-13): מעבר רגיל→חו"ל עם דגל שנשמר, ואז בחירת הטווח: הדגל מוחל על הטווח הראשון (לא נעלם בשקט), ובחירה מחדש מאפסת', () => {
  const sw = apply(baseOrder({ eventDate: '2026-10-08', extraDay: 'before' }), D.eventTypeUpdates(baseOrder({ eventDate: '2026-10-08', extraDay: 'before' }), true));
  const startOnly = apply(sw, D.rangeUpdates(sw, '2026-11-01', ''));
  assert.equal(startOnly.extraDay, 'before', 'עד שהטווח שלם - הדגל נשאר, בלי הזזה');
  const full = apply(startOnly, D.rangeUpdates(startOnly, '2026-11-01', '2026-11-08'));
  assert.equal(full.extraDay, 'before');
  assert.ok(Math.abs(new Date(full.fromDate) - new Date(applyIso('2026-11-01', startOnly.fromDate)) + 24 * 3600e3) <= 3600e3, 'הלקיחה זזה יום אחורה (±שעה: מעבר שעון חורף בניו-יורק ב-1.11)');
  assert.equal(full.toDate, applyIso('2026-11-08', startOnly.toDate || startOnly.fromDate));
  assert.ok(D.extraDayReady(full));
  const again = apply(full, D.rangeUpdates(full, '2026-11-02', '2026-11-09'));
  assert.equal(again.extraDay, null, 'טווח שלם שנבחר מחדש = טווח נקי, הדגל מתאפס (סקירת W2a סעיף 2)');
});
function applyIso(key, prev) { return D.applyTime(key, prev, new Date(0)); }

// ---------- 2 (MED): טווח חדש / יום נוסף בלי תאריכים ----------
test('2א: בחירת טווח חדש כשיש יום נוסף מאפסת אותו (בלי הזזה חלקית), וה-PUT בהתאם', () => {
  const o = apply(ABROAD_AFTER, D.rangeUpdates(ABROAD_AFTER, '2026-11-01', '2026-11-08'));
  assert.equal(o.extraDay, null);
  assert.equal(putOf(o).extraDay, null);
  // ובחירה מחדש של "יום אחרי" מזיזה את ההחזרה ביום אחד בלבד
  const again = apply(o, D.extraDayUpdates(o, 'after'));
  assert.equal(new Date(again.toDate) - new Date(o.toDate), 24 * 3600e3);
});
test('2ב: "יום לפני/אחרי" בלי התאריכים הנדרשים = אין שינוי (לא נגבה 50% בלי יום); "ללא" תמיד אפשרי; הגלולה כבויה בלי תאריכים', () => {
  for (const o of [baseOrder({ isAbroad: true, eventDate: null }), baseOrder({ isAbroad: true, fromDate: '2026-10-05', toDate: null, returnDate: null }), baseOrder({ isAbroad: true, fromDate: null, toDate: '2026-10-06' }),
    baseOrder({ eventDate: null })]) {
    assert.equal(D.extraDayReady(o), false);
    assert.equal(D.extraDayUpdates(o, 'after'), null);
    assert.equal(D.extraDayUpdates(o, 'before'), null);
  }
  const stray = baseOrder({ isAbroad: true, eventDate: null, extraDay: 'after' });
  assert.equal(apply(stray, D.extraDayUpdates(stray, null)).extraDay, null);
  const strayRegular = baseOrder({ eventDate: null, extraDay: 'before' });
  assert.equal(apply(strayRegular, D.extraDayUpdates(strayRegular, null)).extraDay, null);
  assert.ok(D.extraDayReady(ABROAD));
  assert.ok(D.extraDayReady(SINGLE), 'AMB-13: באירוע רגיל מספיק תאריך אירוע');
  assert.ok(read('tabs/OcDetailsTab.js').includes('isDisabled={(v) => !!v && !extraDayReady(order)}'));
});
test('2ג (AMB-13): אירוע רגיל עם תאריך - יום נוסף = דגל בלבד (בלי הזזת תאריכים), ה-PUT נושא אותו, וביטול חוזר ל"ללא"', () => {
  const o = apply(SINGLE, D.extraDayUpdates(SINGLE, 'after'));
  assert.equal(o.extraDay, 'after');
  assert.equal(o.eventDate, SINGLE.eventDate);
  assert.equal(o.fromDate ?? null, SINGLE.fromDate ?? null);
  assert.equal(o.toDate ?? null, SINGLE.toDate ?? null);
  assert.equal(putOf(o).extraDay, 'after');
  const sw = apply(o, D.extraDayUpdates(o, 'before'));
  assert.equal(sw.extraDay, 'before');
  const none = apply(sw, D.extraDayUpdates(sw, null));
  assert.equal(none.extraDay, null);
  assert.equal(D.extraDayUpdates(none, null), null);
  assert.equal(D.extraDayUpdates(o, 'after'), null);
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
test('3ג: ביטול יום נוסף כשאין תאריכי טווח בהזמנה הנוכחית (חו"ל בלי תאריכים) - חוזר לערכי ה-snapshot העקביים', () => {
  const snap = snapOf(ABROAD_AFTER);
  const noDates = baseOrder({ isAbroad: true, eventDate: null, extraDay: null });
  const undone = L.revertChange(cur(noDates), snap, 'xday');
  assert.equal(undone.order.extraDay, 'after');
  assert.equal(undone.order.fromDate, ABROAD_AFTER.fromDate);
  assert.equal(undone.order.toDate, ABROAD_AFTER.toDate);
  assert.equal(undone.order.returnDate, ABROAD_AFTER.returnDate);
});
test('3ד (AMB-13): ביטול יום נוסף באירוע רגיל מחזיר רק את הדגל (לא נוגע בתאריכי טווח)', () => {
  const snap = snapOf(SINGLE);
  const edited = apply(SINGLE, D.extraDayUpdates(SINGLE, 'before'));
  const undone = L.revertChange(cur(edited), snap, 'xday');
  assert.deepEqual(undone.order, SINGLE);
  assert.deepEqual(L.changesOf(snap, undone), []);
  const snap2 = snapOf(apply(SINGLE, D.extraDayUpdates(SINGLE, 'after')));
  const removed = apply(snap2.order, D.extraDayUpdates(snap2.order, null));
  assert.equal(L.revertChange(cur(removed), snap2, 'xday').order.extraDay, 'after');
  // אירוע שהיה חו"ל עם דגל ועבר לרגיל (הדגל נשמר): הביטול לא מדביק תאריכי טווח לאירוע רגיל
  const snap3 = snapOf(ABROAD_AFTER);
  const regular = apply(ABROAD_AFTER, D.eventTypeUpdates(ABROAD_AFTER, false));
  const u3 = L.revertChange(cur(regular), snap3, 'xday').order;
  assert.equal(u3.fromDate, null);
  assert.equal(u3.extraDay, 'after');
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

// ---------- 4: W2A-ID - הת״ז תמיד במלואה ----------
test('4 (W2A-ID): אין מסיכת ת״ז - הקבוע והמסלול הוסרו, והלשונית מציגה את הערך המלא', () => {
  assert.ok(!/MASK_ZEOUT_WHEN_ID_GATE|'•'\.repeat/.test(read('parts/ocDetailsLogic.js')));
  assert.equal(D.zeoutDisplay('312456789'), '312456789');
  assert.ok(read('tabs/OcDetailsTab.js').includes('zeoutDisplay(c.zeout)'));
});
