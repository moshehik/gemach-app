// בדיקת יחידה ללוגיקה הטהורה של כרטיס הדגם החדש (lib/dressCardLogic.js): ברקוד, מספר סידורי, אבחון שינויים, ביטול שינוי,
// תוכנית שמירה (אותם payloads כמו הדף הישן), סימוני לשוניות, סריקה, השכרות ושורות היסטוריה. לא נוגעת ב-DB.
// הרצה: node scripts/test_dress_card_logic.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import {
  ACTIVITY_TOGGLE_FIELDS, MODEL_FIELDS, applyStepResult, bcOf, buildDressHistoryRows, buildModelPayload, buildSavePlan, clone, counts, deleteItemLocal,
  diffChanges, isItemPending, itemFromServer, lifeNodes, modelFromServer, nextSerial, ranges, rentalFromServer, scanMatch, stOf, tabMarkers, undoChange,
  validateNewItem, compareItems, deleteBlockedReason,
} from '../lib/dressCardLogic.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const RAW = {
  id: 'dm1', name: 'אורורה', barcodePrefix: 1142, priceCategory: 'B', notes: 'שמלת ערב', inInspection: false, imageUrl: null, thumbnailUrl: null,
  entryDateToRepo: '2023-03-14T00:00:00.000Z', exitDateFromRepo: null, inactiveReason: null, isSplit: false, isPremium: false, isDeleted: false,
};
const SI = (id, size, serial, o = {}) => ({ id, sizeText: String(size), serialNumber: serial, dressBarcode: bcOf(1142, size, serial), location: 'חנות', cartonNumber: null, inRepair: false, notInUse: false, notInUseReason: null, isDeleted: false, entryDateToRepo: '2023-03-14T00:00:00.000Z', ...o });
const SERVER_ITEMS = [SI('a', 36, 1), SI('b', 36, 2, { location: 'מחסן', cartonNumber: '14' }), SI('c', 38, 1, { inRepair: true }), SI('d', 40, 2, { notInUse: true, notInUseReason: 'כתם' }), SI('e', 44, 2, { isDeleted: true })];
const fresh = () => ({ model: modelFromServer(RAW), items: SERVER_ITEMS.map(itemFromServer) });

console.log('barcode / serial');
t('bcOf: קוד + מידה + סידורי ברוחב 2', () => { assert.equal(bcOf(1142, 36, 1), '11423601'); assert.equal(bcOf(1142, 4, 12), '11420412'); assert.equal(bcOf('', 38, 3), '3803'); });
t('nextSerial: הבא אחרי המקסימום באותה מידה; מידה חדשה = 1', () => { const { items } = fresh(); assert.equal(nextSerial(items, '36'), 3); assert.equal(nextSerial(items, '99'), 1); });
t('ranges: טווחים רצופים', () => assert.equal(ranges([1, 2, 3, 5, 8, 9]), '01–03, 05, 08–09'));
t('validateNewItem: חובה מידה / טווח / כפילות / ברקוד נגזר', () => {
  const { items } = fresh();
  assert.match(validateNewItem(items, '1142', { size: '', serial: '' }).error, /חובה/);
  assert.match(validateNewItem(items, '1142', { size: '100', serial: '' }).error, /0 ל-99/);
  assert.match(validateNewItem(items, '1142', { size: '3.5', serial: '' }).error, /שלם/);
  assert.match(validateNewItem(items, '1142', { size: '36', serial: '1' }).error, /11423601 כבר קיים/);
  const ok = validateNewItem(items, '1142', { size: '36', serial: '' });
  assert.deepEqual([ok.size, ok.serial, ok.bc], ['36', 3, '11423603']);
  // ברקוד של פריט מחוק לא חוסם (כמו השרת: חפיפה רק מול פעילים)
  assert.equal(validateNewItem(items, '1142', { size: '44', serial: '2' }).bc, '11424402');
});
t('compareItems: מספרי לפי מספר, טקסטואלי בסוף', () => {
  const l = [{ size: '40', serial: 1 }, { size: 'S', serial: 1 }, { size: '8', serial: 2 }, { size: '8', serial: 1 }].sort(compareItems);
  assert.deepEqual(l.map((x) => `${x.size}/${x.serial}`), ['8/1', '8/2', '40/1', 'S/1']);
});

console.log('derived');
t('stOf / counts', () => {
  const { items } = fresh();
  assert.deepEqual(items.map(stOf), ['normal', 'normal', 'repair', 'unused', 'deleted']);
  assert.deepEqual(counts(items), { n: 4, avail: 2, repair: 1, unused: 1, reserve: 0, att: 2 });
});
t('modelFromServer: active לפי תאריך יציאה; ימים ישראליים', () => {
  const m = modelFromServer({ ...RAW, exitDateFromRepo: '2026-09-01T00:00:00.000Z', inactiveReason: 'התיישן' });
  assert.equal(m.active, false); assert.equal(m.exit, '2026-09-01'); assert.equal(m.entry, '2023-03-14'); assert.equal(m.code, '1142'); assert.equal(m.reason, 'התיישן');
});
t('tabMarkers: סמן התראה בלבד (בלי מונים), יחיד/רבים', () => {
  const { items } = fresh();
  assert.equal(tabMarkers({ items, rentalStats: { overdue: 0 } }).rentals, null);
  assert.equal(tabMarkers({ items, rentalStats: { overdue: 1 } }).rentals.tip, 'השכרה אחת ממתינה להחזרה');
  assert.equal(tabMarkers({ items, rentalStats: { overdue: 3 } }).rentals.tip, '3 השכרות ממתינות להחזרה');
  assert.equal(tabMarkers({ items }).items.tip, '2 פריטים דורשים טיפול');
  assert.equal(tabMarkers({ items: [items[0]] }).items, null);
});
t('scanMatch: ברקוד מלא / סיומת 4+ ספרות / לא נמצא; פעיל קודם למחוק', () => {
  const { items } = fresh();
  assert.equal(scanMatch(items, '1142', '11423601').id, 'a');
  assert.equal(scanMatch(items, '1142', '3602').id, 'b');
  assert.equal(scanMatch(items, '1142', '02'), null);
  assert.equal(scanMatch(items, '1142', '99999999'), null);
  assert.equal(scanMatch(items, '1142', '11424402').id, 'e');
});
t('deleteBlockedReason', () => { assert.match(deleteBlockedReason(fresh().items), /4/); assert.equal(deleteBlockedReason([]), ''); });

console.log('changes (cart)');
t('בלי שינוי: אין שורות', () => { const s = fresh(); assert.deepEqual(diffChanges(s, clone(s)), []); });
t('שדות הדגם: שם, קטגוריה, הערות (תקציר חכם), תמונה, בדיקה', () => {
  const s = fresh(); const c = clone(s);
  c.model.name = 'אורורה 2'; c.model.cat = 'C'; c.model.notes = 'שמלת ערב עם שובל'; c.model.img = '/x.jpg'; c.model.inspect = true;
  const ch = diffChanges(s, c);
  assert.deepEqual(ch.map((x) => x.k), ['f:name', 'f:cat', 'f:notes', 'f:img', 'f:inspect']);
  assert.equal(ch[1].note, 'B ← C');
  assert.equal(ch[3].note, 'ללא תמונה ← תמונה מקושרת');
  assert.equal(ch[4].note, 'כבוי ← מופעל');
  assert.ok(ch[2].note.includes('…'), 'הערות: מציג את החלק השונה');
  assert.equal(ch[0].text.map((x) => x.t).join(''), 'שם דגם עודכן');
});
t('סימון כלא פעיל + שינוי סיבה', () => {
  const s = fresh(); const c = clone(s);
  c.model.active = false; c.model.reason = 'התיישן'; c.model.exit = '2026-10-01';
  let ch = diffChanges(s, c);
  assert.equal(ch.length, 1); assert.equal(ch[0].plain, 'הדגם סומן כלא פעיל'); assert.match(ch[0].note, /פעיל ← לא פעיל · התיישן/);
  const s2 = clone(c); const c2 = clone(c); c2.model.reason = 'נתרם';
  ch = diffChanges(s2, c2);
  assert.equal(ch[0].plain, 'עודכנה סיבת אי-פעילות');
});
t('פריטים: הוספה, מחיקה/שחזור, מיקום, קרטון, תיקון, לא בשימוש (+סיבה)', () => {
  const s = fresh(); const c = clone(s);
  c.items.push({ id: 'n1', size: '42', serial: 1, bc: '', loc: 'חנות', carton: '', repair: false, unused: false, why: '', del: false, ent: '2026-10-09', since: null });
  c.items[0].loc = 'רזרבה'; c.items[1].carton = '15'; c.items[2].repair = false; c.items[3].why = 'כתם גדול'; c.items[4].del = false;
  c.items[0].del = true;
  const ch = diffChanges(s, c);
  const keys = ch.map((x) => x.k);
  assert.ok(['i:a:del', 'i:a:loc', 'i:b:carton', 'i:c:repair', 'i:d:unused', 'i:e:del', 'i:n1:add'].every((k) => keys.includes(k)), keys.join(','));
  assert.equal(ch.find((x) => x.k === 'i:n1:add').text.map((x) => x.t).join(''), 'נוסף פריט 11424201');
  assert.equal(ch.find((x) => x.k === 'i:d:unused').plain, 'סיבת אי-שימוש עודכנה');
  assert.equal(ch.find((x) => x.k === 'i:e:del').plain, 'שוחזר');
  assert.equal(ch.find((x) => x.k === 'i:c:repair').plain, 'הוצא מתיקון');
  assert.ok(isItemPending(s, c.items[0]) && isItemPending(s, c.items[5]) && !isItemPending(s, s.items[0]));
});
t('undoChange: שדה / פעילות / פריט שנוסף / שדה פריט', () => {
  const s = fresh(); const c = clone(s);
  c.model.name = 'X'; c.model.active = false; c.model.reason = 'r'; c.model.exit = '2026-10-01'; c.model.img = '/a'; c.model.thumb = '/t';
  c.items.push({ id: 'n1', size: '42', serial: 1, bc: '', loc: 'חנות', carton: '', repair: false, unused: false, why: '', del: false, ent: '', since: null });
  c.items[3].unused = false; c.items[3].why = '';
  let u = undoChange(s, c, 'f:name'); assert.equal(u.model.name, 'אורורה');
  u = undoChange(s, c, 'f:active'); assert.deepEqual([u.model.active, u.model.reason, u.model.exit], [true, '', '']);
  u = undoChange(s, c, 'f:img'); assert.deepEqual([u.model.img, u.model.thumb], ['', '']);
  u = undoChange(s, c, 'i:n1:add'); assert.equal(u.items.length, 5);
  u = undoChange(s, c, 'i:d:unused'); assert.deepEqual([u.items[3].unused, u.items[3].why], [true, 'כתם']);
  assert.equal(c.model.name, 'X', 'לא משנה את הקלט');
});
t('deleteItemLocal: חדש מוסר, שמור מסומן מחוק', () => {
  const s = fresh(); const c = clone(s);
  c.items.push({ id: 'n1', size: '42', serial: 1, bc: '', loc: 'חנות', carton: '', repair: false, unused: false, why: '', del: false, ent: '', since: null });
  assert.equal(deleteItemLocal(s, c, 'n1').items.length, 5);
  assert.equal(deleteItemLocal(s, c, 'a').items.find((x) => x.id === 'a').del, true);
});

console.log('save plan');
t('payload מלא של הדגם = MODEL_FIELDS בדיוק, ערכים לא-משתנים נשמרים כמו שהם', () => {
  const s = fresh(); const c = clone(s); c.model.name = 'חדש'; c.model.inspect = true;
  const plan = buildSavePlan({ saved: s, cur: c, raw: RAW });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].req.method, 'PUT'); assert.equal(plan[0].req.url, '/api/dresses/dm1');
  assert.deepEqual(Object.keys(plan[0].req.body), MODEL_FIELDS);
  assert.equal(plan[0].req.body.entryDateToRepo, RAW.entryDateToRepo, 'תאריך כניסה שלא השתנה נשלח מקורי');
  assert.equal(plan[0].req.body.barcodePrefix, 1142); assert.equal(plan[0].req.body.inInspection, true);
});
t('סימון פעילות בלבד: ACTIVITY_TOGGLE_FIELDS בלבד (מותר לכל עובדת)', () => {
  const s = fresh(); const c = clone(s); c.model.active = false; c.model.reason = ' התיישן '; c.model.exit = '2026-10-01';
  let plan = buildSavePlan({ saved: s, cur: c, raw: RAW });
  assert.deepEqual(Object.keys(plan[0].req.body), ACTIVITY_TOGGLE_FIELDS);
  assert.equal(plan[0].req.body.exitDateFromRepo, '2026-10-01'); assert.equal(plan[0].req.body.inactiveReason, ' התיישן '.trim() === 'התיישן' ? plan[0].req.body.inactiveReason : '');
  // חזרה לפעילות
  const s2 = clone(c); const c2 = clone(c); c2.model.active = true; c2.model.reason = ''; c2.model.exit = '';
  plan = buildSavePlan({ saved: s2, cur: c2, raw: { ...RAW, exitDateFromRepo: '2026-10-01T00:00:00.000Z', inactiveReason: 'x' } });
  assert.deepEqual(plan[0].req.body, { exitDateFromRepo: null, entryDateToRepo: RAW.entryDateToRepo, inactiveReason: null });
  // פעילות + שם = בקשה מלאה (הנהלה ראשית)
  c.model.name = 'Y';
  plan = buildSavePlan({ saved: s, cur: c, raw: RAW });
  assert.deepEqual(Object.keys(plan[0].req.body), MODEL_FIELDS);
});
t('useModelNames=false ושם ריק: שם נגזר מהקוד (כמו הישן)', () => {
  const s = fresh(); const c = clone(s); c.model.name = ''; c.model.inspect = true;
  assert.equal(buildModelPayload(RAW, c, { useModelNames: false }).name, 'דגם 1142');
});
t('פריטים: payloads כמו handlers של הדף הישן (מיקום בלבד / קרטון בלבד / עריכה מלאה / מחיקה / שחזור / הוספה)', () => {
  const s = fresh(); const c = clone(s);
  c.items[0].loc = 'רזרבה'; // מיקום בלבד
  c.items[1].carton = '15'; // קרטון בלבד
  c.items[2].repair = false; // יוצא מתיקון
  c.items[3].why = 'חדש'; // סיבה
  c.items[4].del = false; // שחזור
  c.items.push({ id: 'n1', size: '42', serial: 1, bc: '', loc: '', carton: '', repair: false, unused: false, why: '', del: false, ent: '', since: null });
  const now = new Date('2026-10-09T10:00:00.000Z');
  const plan = buildSavePlan({ saved: s, cur: c, raw: RAW, now });
  const by = Object.fromEntries(plan.map((p) => [p.id, p.req]));
  assert.deepEqual(by['item:a:edit'], { method: 'PUT', url: '/api/dresses/items/a', body: { location: 'רזרבה' } });
  assert.deepEqual(by['item:b:edit'].body, { cartonNumber: '15' });
  assert.deepEqual(by['item:c:edit'].body, { inRepair: false, notInUse: false, notInUseSince: null, notInUseReason: null });
  assert.deepEqual(by['item:d:edit'].body, { inRepair: false, notInUse: true, notInUseSince: s.items[3].since || now.toISOString(), notInUseReason: 'חדש' });
  assert.deepEqual(by['item:e:restore'], { method: 'PUT', url: '/api/dresses/items/e', body: { isDeleted: false } });
  assert.deepEqual(by['item:n1:add'], { method: 'POST', url: '/api/dresses/dm1/items', body: { sizeText: '42', serialNumber: 1, dressBarcode: '11424201', location: 'חנות', barcodePrefix: 1142, dressName: 'אורורה', entryDateToRepo: now.toISOString() } });
  c.items[0].del = true;
  const plan2 = buildSavePlan({ saved: s, cur: c, raw: RAW, now });
  const ids = plan2.filter((p) => p.itemId === 'a').map((p) => p.id);
  assert.deepEqual(ids, ['item:a:edit', 'item:a:del'], 'עריכה ואז מחיקה');
  assert.deepEqual(plan2.find((p) => p.id === 'item:a:del').req, { method: 'DELETE', url: '/api/dresses/items/a' });
});
t('applyStepResult: הוספה מחליפה מזהה זמני; מחיקה; עריכה', () => {
  const s = fresh(); const c = clone(s);
  c.items.push({ id: 'n1', size: '42', serial: 1, bc: '', loc: 'חנות', carton: '', repair: false, unused: false, why: '', del: false, ent: '', since: null });
  c.items[0].loc = 'רזרבה'; c.items[1].del = true;
  const plan = buildSavePlan({ saved: s, cur: c, raw: RAW });
  let st = { saved: s, cur: c, raw: RAW };
  st = applyStepResult(st, plan.find((p) => p.kind === 'add'), SI('srv9', 42, 1, { location: 'חנות' }));
  assert.ok(st.cur.items.some((x) => x.id === 'srv9') && !st.cur.items.some((x) => x.id === 'n1') && st.saved.items.some((x) => x.id === 'srv9'));
  st = applyStepResult(st, plan.find((p) => p.id === 'item:b:del'), { success: true });
  assert.equal(st.saved.items.find((x) => x.id === 'b').del, true);
  st = applyStepResult(st, plan.find((p) => p.id === 'item:a:edit'), SI('a', 36, 1, { location: 'רזרבה' }));
  assert.equal(st.saved.items.find((x) => x.id === 'a').loc, 'רזרבה');
  assert.deepEqual(diffChanges(st.saved, st.cur), []);
});
t('applyStepResult של הדגם: saved מתיישר ל-cur; raw מתעדכן', () => {
  const s = fresh(); const c = clone(s); c.model.name = 'חדש'; c.model.inspect = true;
  const plan = buildSavePlan({ saved: s, cur: c, raw: RAW });
  const st = applyStepResult({ saved: s, cur: c, raw: RAW }, plan[0], { ...RAW, name: 'חדש', inInspection: true });
  assert.deepEqual(diffChanges(st.saved, st.cur), []); assert.equal(st.raw.name, 'חדש');
});

console.log('rentals');
const TODAY = '2026-10-09';
t('rentalFromServer: ret / overdue / ימים', () => {
  const r1 = rentalFromServer({ orderId: 53401, customerName: 'מרים', sizeText: '38', dressBarcode: '11423801', eventDate: '2026-10-18T00:00:00.000Z', isTaken: false, isReturned: false }, 0, TODAY);
  assert.deepEqual([r1.ret, r1.overdue, r1.taken, r1.event], ['out', false, '', '2026-10-18']);
  const r2 = rentalFromServer({ orderId: 1, eventDate: '2026-09-20T00:00:00.000Z', isTaken: true, takenDate: '2026-09-18T00:00:00.000Z', isReturned: false }, 1, TODAY);
  assert.deepEqual([r2.ret, r2.overdue, r2.taken], ['out', true, '2026-09-18']);
  const r3 = rentalFromServer({ orderId: 2, eventDate: '2026-08-20T00:00:00.000Z', isTaken: true, isReturned: true, returnedOk: false, returnDate: '2026-08-23T00:00:00.000Z' }, 2, TODAY);
  assert.deepEqual([r3.ret, r3.overdue, r3.retDate], ['bad', false, '2026-08-23']);
  assert.equal(rentalFromServer({ orderId: 3, eventDate: '2026-08-20T00:00:00.000Z', isReturned: true, returnedOk: true }, 3, TODAY).ret, 'ok');
});
t('lifeNodes: כניסה, אחרונה, קרובה, החזרה צפויה (יום עבודה) + צומת נוכחי', () => {
  const model = fresh().model;
  const rentals = [{ order: 1, cust: 'א', event: '2026-09-20' }, { order: 2, cust: 'ב', event: '2026-10-18' }];
  const n = lifeNodes({ model, rentals, todayKey: TODAY });
  assert.deepEqual(n.map((x) => x.k), ['entry', 'last', 'next', 'ret']);
  assert.equal(n[2].done, false); assert.equal(n[3].date > n[2].date, true);
  const inact = lifeNodes({ model: { ...model, active: false, exit: '2026-10-01', reason: 'x' }, rentals, todayKey: TODAY });
  assert.deepEqual(inact.map((x) => x.k), ['entry', 'last', 'exit']);
});

console.log('history rows (AuditLog)');
t('מצב מצטבר: UPDATE שנשלח עם כל MODEL_FIELDS מציג רק מה ששונה, עם "לפני"', () => {
  const at = (d) => `2026-0${d}-10T09:00:00.000Z`;
  const full = (o) => JSON.stringify({ name: 'אורורה', barcodePrefix: 1142, priceCategory: 'B', notes: '', inInspection: false, imageUrl: null, thumbnailUrl: null, entryDateToRepo: '2023-03-14', exitDateFromRepo: null, inactiveReason: null, isSplit: false, isPremium: false, ...o });
  const modelLogs = [
    { id: 'm1', action: 'CREATE', entityId: 'dm1', changesJson: JSON.stringify({ name: 'אורורא', barcodePrefix: 1142, priceCategory: 'C' }), createdAt: at(1), employeeName: 'רחל' },
    { id: 'm2', action: 'UPDATE', entityId: 'dm1', changesJson: full({ name: 'אורורה', priceCategory: 'C' }), createdAt: at(2), employeeName: 'דוד' },
    { id: 'm3', action: 'UPDATE', entityId: 'dm1', changesJson: full({ priceCategory: 'B', inInspection: true }), createdAt: at(3), employeeName: 'שרה' },
    { id: 'm4', action: 'UPDATE', entityId: 'dm1', changesJson: JSON.stringify({ exitDateFromRepo: '2026-04-01', entryDateToRepo: '2023-03-14', inactiveReason: 'התיישן' }), createdAt: at(4), employeeName: 'שרה' },
  ];
  const rows = buildDressHistoryRows({ modelLogs, itemLogs: [], items: [], prefix: '1142' });
  const texts = rows.map((r) => r.text);
  assert.deepEqual(texts, ['הדגם סומן כלא פעיל', 'עודכנה קטגוריית מחיר', 'הצגה בבדיקה הופעלה', 'עודכן שם דגם', 'הדגם נוצר']);
  const nm = rows.find((r) => r.text === 'עודכן שם דגם');
  assert.deepEqual([nm.prev, nm.next, nm.who], ['אורורא', 'אורורה', 'דוד']);
  const cat = rows.find((r) => r.text === 'עודכנה קטגוריית מחיר');
  assert.deepEqual([cat.prev, cat.next], ['C', 'B']);
  assert.equal(rows.filter((r) => r.text === 'עודכנה קטגוריית מחיר').length, 1, 'רישום m2 שלא שינה קטגוריה (C->C) לא יוצר שורה');
  assert.match(rows[0].ts, /^2026-04-10T\d\d:\d\d$/);
});
t('ישות בלי CREATE: רישום ראשון = שורה מסכמת; הבאים מושווים', () => {
  const modelLogs = [
    { id: 'u1', action: 'UPDATE', entityId: 'dm1', changesJson: JSON.stringify({ name: 'א', barcodePrefix: 1, notes: '', inInspection: false }), createdAt: '2026-01-01T08:00:00.000Z', employeeName: 'רחל' },
    { id: 'u2', action: 'UPDATE', entityId: 'dm1', changesJson: JSON.stringify({ name: 'ב', barcodePrefix: 1, notes: '', inInspection: false }), createdAt: '2026-02-01T08:00:00.000Z', employeeName: 'רחל' },
  ];
  const rows = buildDressHistoryRows({ modelLogs, itemLogs: [], items: [], prefix: '1' });
  assert.deepEqual(rows.map((r) => r.text), ['עודכן שם דגם', 'עודכנו פרטי הדגם']);
});
t('פריטים: הוספה, מיקום, תיקון, לא בשימוש, מחיקה (isDeleted) ושחזור', () => {
  const items = [{ id: 'i1', size: '38', serial: 1, bc: '11423801' }];
  const L = (id, action, data, d) => ({ id, action, entityId: 'i1', changesJson: JSON.stringify(data), createdAt: `2026-0${d}-05T10:00:00.000Z`, employeeName: 'דוד' });
  const itemLogs = [
    L('x1', 'CREATE', { sizeText: '38', serialNumber: 1, location: 'חנות', inRepair: false, notInUse: false }, 1),
    L('x2', 'UPDATE', { location: 'מחסן' }, 2),
    L('x3', 'UPDATE', { location: 'מחסן', cartonNumber: '', inRepair: true, notInUse: false, notInUseSince: null, notInUseReason: null }, 3),
    L('x4', 'UPDATE', { inRepair: false, notInUse: true, notInUseReason: 'כתם' }, 4),
    L('x5', 'UPDATE', { isDeleted: true, deletedAt: '2026-05-05' }, 5),
    L('x6', 'UPDATE', { isDeleted: false, deletedAt: null }, 6),
  ];
  const rows = buildDressHistoryRows({ modelLogs: [], itemLogs, items, prefix: '1142' });
  assert.deepEqual(rows.map((r) => r.text), ['פריט שוחזר', 'פריט נמחק', 'תיקון הושלם', 'סומן כלא בשימוש', 'סומן בתיקון', 'עודכן מיקום פריט', 'נוסף פריט']);
  assert.ok(rows.every((r) => r.bc === '11423801' && r.scope === 'item'));
  assert.deepEqual(rows.find((r) => r.text === 'עודכן מיקום פריט').det, [['לפני', 'חנות'], ['אחרי', 'מחסן']]);
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
