// lib/deliveryJoin.js (פורט נווה יעקב, R49) מול prisma בזיכרון (scripts/order-card-tests/neve-shims). נבדק: זוגיות התנהגות מול lib/deliveryJoin.js של נווה
// (הצילום ב-neve-oracle/deliveryJoin.js.txt: כל הודעות השגיאה, כללי המועמדים, שורש/מצטרפים/ראשי), הסרת ה-DDL בזמן ריצה, ו"הטבלה חסרה = כבוי"
// (P2021 / 42P01 / מודל חסר בקליינט) עם בדיקה חוזרת מוזכרת. בלי DB ובלי כתיבה לשום מקום מחוץ לזיכרון.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const ORACLE = fs.readFileSync(path.join(PROJ, 'scripts/order-card-tests/neve-oracle/deliveryJoin.js.txt'), 'utf8').split('\r\n').join('\n');

function resetFake() {
  globalThis.__neveFake = { db: { deliveryJoin: [], order: [] }, audits: [], queries: [], failWith: null, noModel: false, settings: { enable_delivery_join: 'true', delivery_join_price: '20' } };
  return globalThis.__neveFake;
}
resetFake();
register(pathToFileURL(path.join(PROJ, 'scripts/order-card-tests/neve-shims/hooks.mjs')).href);
const J = await import(pathToFileURL(path.join(PROJ, 'lib/deliveryJoin.js')).href);

const cust = (first, over = {}) => ({ firstName: first, lastName: 'כהן', phone1: '050', phone2: null, city: 'בני ברק', street: 'רבי עקיבא', houseNum: '5', ...over });
let seq = 0;
const ord = (orderId, over = {}) => ({
  orderId, isDeleted: false, isDelivery: true, eventDate: '2026-10-07T09:00:00.000Z', deliveryDirection: 'הלוך-חזור', deliveryOneDayBefore: false,
  deliveryAddress: 'עמוס 3', deliveryCity: 'ירושלים', customer: cust(`לקוח${orderId + seq}`), ...over,
});
const seed = (orders, joins = []) => { const f = globalThis.__neveFake; f.db.order.push(...orders); f.db.deliveryJoin.push(...joins); return f; };
const row = (orderId, over = {}) => ({ orderId, joinedToOrderId: null, isPrimary: false, direction: null, ...over });

beforeEach(() => { resetFake(); J.resetDeliveryJoinTableState(); });

test('אין DDL בזמן ריצה: ensureDeliveryJoinTable / CREATE TABLE / SQL גולמי לא בקוד (אבל הם באורקל של נווה)', () => {
  const src = fs.readFileSync(path.join(PROJ, 'lib/deliveryJoin.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(ORACLE.includes('ensureDeliveryJoinTable') && ORACLE.includes('CREATE TABLE IF NOT EXISTS'), 'האורקל הוא המקור של נווה');
  assert.ok(!/ensureDeliveryJoinTable|CREATE TABLE|CREATE INDEX|\$executeRaw|\$queryRaw|\$transaction|auditLog\.create/.test(code));
  assert.ok(/prisma\.deliveryJoin\./.test(code));
});

test('כל הודעות השגיאה של נווה קיימות בפורט (מילולית)', () => {
  const src = fs.readFileSync(path.join(PROJ, 'lib/deliveryJoin.js'), 'utf8');
  const errs = [...ORACLE.matchAll(/error: '([^']+)'/g)].map(m => m[1]);
  assert.ok(errs.length >= 5);
  for (const e of errs) assert.ok(src.includes(e), `חסרה הודעה: ${e}`);
});

test('הצטרפות: הזמנה מצטרפת לשורש, דורסת כתובת/עיר, נרשמת שורה + audit (create)', async () => {
  const f = seed([ord(1, { deliveryAddress: 'עמוס 3', deliveryCity: 'ירושלים' }), ord(2, { deliveryAddress: 'אחר 1', deliveryCity: 'בית שמש' })]);
  const r = await J.saveDeliveryJoin(2, { joinedToOrderId: 1 });
  assert.deepEqual(r, { ok: true, rootOrderId: 1, address: 'עמוס 3', city: 'ירושלים' });
  const o2 = f.db.order.find(o => o.orderId === 2);
  assert.equal(o2.deliveryAddress, 'עמוס 3'); assert.equal(o2.deliveryCity, 'ירושלים');
  assert.deepEqual(f.db.deliveryJoin, [row(2, { joinedToOrderId: 1, direction: 'הלוך-חזור' })]);
  const a = f.audits.find(x => x.entityType === 'deliveryJoin');
  assert.equal(a.action, 'DELIVERY_JOINED'); assert.equal(a.entityId, '2');
  assert.deepEqual(a.changes.joinedToOrderId, { from: null, to: 1 });
});

test('הצטרפות למצטרף מתורגמת לשורש; כתובת השורש בלי כתובת מפורשת = רחוב הלקוח', async () => {
  const f = seed([ord(1, { deliveryAddress: null, deliveryCity: null, customer: cust('ש', { street: 'הנביאים', houseNum: '7', city: 'ירושלים' }) }), ord(2), ord(3)], [row(2, { joinedToOrderId: 1 })]);
  const r = await J.saveDeliveryJoin(3, { joinedToOrderId: 2 });
  assert.equal(r.rootOrderId, 1);
  assert.equal(r.address, 'הנביאים 7'); assert.equal(r.city, 'ירושלים');
  assert.equal(f.db.deliveryJoin.find(x => x.orderId === 3).joinedToOrderId, 1);
});

test('שגיאות הצטרפות כמו נווה: לא משלוח / אותה הזמנה / יש לה מצטרפים / השורש נמחק או לא משלוח / הזמנה לא נמצאה', async () => {
  seed([ord(1), ord(2, { isDelivery: false }), ord(3), ord(4), ord(5, { isDeleted: true }), ord(6, { isDelivery: false })], [row(4, { joinedToOrderId: 3 })]);
  assert.deepEqual(await J.saveDeliveryJoin(2, { joinedToOrderId: 1 }), { ok: false, error: 'ההזמנה אינה מסומנת כהזמנת משלוח' });
  assert.deepEqual(await J.saveDeliveryJoin(1, { joinedToOrderId: 1 }), { ok: false, error: 'לא ניתן להצטרף למשלוח של אותה הזמנה' });
  assert.deepEqual(await J.saveDeliveryJoin(3, { joinedToOrderId: 1 }), { ok: false, error: 'הזמנות אחרות כבר הצטרפו למשלוח של הזמנה זו - לא ניתן לצרף אותה למשלוח אחר' });
  assert.deepEqual(await J.saveDeliveryJoin(1, { joinedToOrderId: 5 }), { ok: false, error: 'המשלוח שנבחר כבר אינו קיים' });
  assert.deepEqual(await J.saveDeliveryJoin(1, { joinedToOrderId: 6 }), { ok: false, error: 'המשלוח שנבחר כבר אינו קיים' });
  assert.deepEqual(await J.saveDeliveryJoin(999, { joinedToOrderId: 1 }), { ok: false, error: 'הזמנה לא נמצאה' });
});

test('ביטול הצטרפות: השורה נמחקת (audit), שורת "ראשי" של שורש נשארת; joinedToOrderId חסר = ההצטרפות לא משתנה', async () => {
  const f = seed([ord(1), ord(2)], [row(1, { isPrimary: true }), row(2, { joinedToOrderId: 1 })]);
  await J.saveDeliveryJoin(2, {});
  assert.equal(f.db.deliveryJoin.length, 2, 'ללא joinedToOrderId בגוף = לא נוגעים בהצטרפות');
  const r = await J.saveDeliveryJoin(2, { joinedToOrderId: null });
  assert.equal(r.ok, true);
  assert.deepEqual(f.db.deliveryJoin, [row(1, { isPrimary: true })]);
  assert.equal(f.audits.at(-1).action, 'DELIVERY_JOIN_CANCELLED');
  await J.saveDeliveryJoin(1, { joinedToOrderId: null });
  assert.equal(f.db.deliveryJoin.length, 1, 'שורש בלי הצטרפות: שורת ה"ראשי" נשארת');
});

test('"ראשי": לכל היותר אחד בקבוצה; self; חבר שאינו בקבוצה = שגיאה כמו נווה', async () => {
  const f = seed([ord(1), ord(2), ord(3), ord(9)], [row(2, { joinedToOrderId: 1, isPrimary: true }), row(3, { joinedToOrderId: 1 })]);
  assert.equal((await J.saveDeliveryJoin(3, { joinedToOrderId: 1, primaryOrderId: 'self' })).ok, true);
  assert.deepEqual(f.db.deliveryJoin.filter(r => r.isPrimary).map(r => r.orderId), [3]);
  assert.equal((await J.saveDeliveryJoin(3, { primaryOrderId: 1 })).ok, true, 'ראשי = השורש (שורת שורש חדשה)');
  assert.deepEqual(f.db.deliveryJoin.filter(r => r.isPrimary).map(r => r.orderId), [1]);
  assert.deepEqual(f.db.deliveryJoin.find(r => r.orderId === 1), row(1, { isPrimary: true }));
  assert.deepEqual(await J.saveDeliveryJoin(3, { primaryOrderId: 9 }), { ok: false, error: 'ההזמנה שסומנה כ"ראשי" אינה חלק מקבוצת המשלוח' });
  const acts = f.audits.map(a => a.action);
  assert.ok(acts.includes('DELIVERY_PRIMARY_SET') && acts.includes('DELIVERY_PRIMARY_CLEARED'));
});

test('רק create/update/delete (כמו תוסף ה-audit): אין upsert / updateMany / SQL', async () => {
  const f = seed([ord(1), ord(2)]);
  await J.saveDeliveryJoin(2, { joinedToOrderId: 1, primaryOrderId: 'self' });
  await J.saveDeliveryJoin(2, { joinedToOrderId: null });
  const used = new Set(f.queries.map(q => q.split('.')[1]));
  for (const q of used) assert.ok(['findUnique', 'findFirst', 'findMany', 'create', 'update', 'delete'].includes(q), q);
  assert.ok(f.audits.every(a => /^DELIVERY_|^UPDATE$|^CREATE$|^DELETE$/.test(a.action) || a.entityType === 'order'));
});

test('מועמדים להצטרפות: אותו יום+כיוון, שורשים בלבד, בלי עצמי / בלי כתובת / יום-לפני זהה, joinedCount (כללי נווה)', async () => {
  seed([
    ord(1), // הלוך-חזור, שורש
    ord(2, { deliveryDirection: 'הלוך' }),
    ord(3, { deliveryDirection: 'חזור' }),
    ord(4), // מצטרף ל-1 -> לא שורש
    ord(5, { eventDate: '2026-10-08T09:00:00.000Z' }), // יום אחר
    ord(6, { deliveryAddress: null, deliveryCity: null, customer: cust('x', { street: '', houseNum: '', city: '' }) }), // בלי כתובת
    ord(7, { deliveryOneDayBefore: true }),
    ord(8, { isDelivery: false }),
    ord(9, { isDeleted: true }),
  ], [row(4, { joinedToOrderId: 1 })]);
  const ids = async (q) => (await J.listJoinCandidates({ eventDateIso: '2026-10-07', oneDayBefore: false, excludeOrderId: null, ...q })).map(c => c.orderId);
  assert.deepEqual(await ids({ direction: 'הלוך-חזור' }), [1], 'הלוך-חזור מצטרף רק למשלוח שכולל את שני הכיוונים');
  assert.deepEqual(await ids({ direction: 'הלוך' }), [1, 2]);
  assert.deepEqual(await ids({ direction: 'חזור' }), [1, 3, 7], 'ל"חזור" לא חל כלל יום-לפני (רק כשהכיוון כולל הלוך)');
  assert.deepEqual(await ids({ direction: 'הלוך', oneDayBefore: true }), [7]);
  assert.deepEqual(await ids({ direction: 'הלוך', excludeOrderId: 1 }), [2]);
  const c1 = (await J.listJoinCandidates({ eventDateIso: '2026-10-07', direction: 'הלוך', oneDayBefore: false })).find(c => c.orderId === 1);
  assert.equal(c1.joinedCount, 1); assert.equal(c1.address, 'עמוס 3, ירושלים'); assert.equal(c1.direction, 'הלוך-חזור');
  assert.ok(ORACLE.includes("if (wanted.includes('הלוך') && !!o.deliveryOneDayBefore !== !!oneDayBefore) continue;"), 'אותו כלל במקור של נווה');
});

test('getJoinGroup / getJoinInfo: שורש + מצטרפים, ראשי, הזמנות מחוקות לא מופיעות', async () => {
  seed([ord(1), ord(2), ord(3, { isDeleted: true })], [row(1, { isPrimary: true }), row(2, { joinedToOrderId: 1 }), row(3, { joinedToOrderId: 1 })]);
  const g = await J.getJoinGroup(1);
  assert.deepEqual(g.map(x => [x.orderId, x.isPrimary, x.isRoot]), [[1, true, true], [2, false, false]]);
  const i2 = await J.getJoinInfo(2);
  assert.equal(i2.joinedToOrderId, 1); assert.equal(i2.rootOrderId, 1); assert.equal(i2.group.length, 2);
  const i1 = await J.getJoinInfo(1);
  assert.equal(i1.isPrimary, true); assert.equal(i1.group.length, 2, 'שורש עם מצטרפים מציג את הקבוצה');
  seed([ord(20)]);
  assert.deepEqual(await J.getJoinInfo(20), { orderId: 20, joinedToOrderId: null, rootOrderId: 20, isPrimary: false, group: [] });
});

test('isOrderJoined / getJoinRows / clearOrderJoin / getDeliveryJoinPrice', async () => {
  const f = seed([ord(1), ord(2)], [row(1, { isPrimary: true }), row(2, { joinedToOrderId: 1 })]);
  assert.equal(await J.isOrderJoined(2), true);
  assert.equal(await J.isOrderJoined(1), false, 'שורת ראשי של שורש אינה הצטרפות');
  assert.equal(await J.isOrderJoined(77), false);
  const m = await J.getJoinRows([1, 2]);
  assert.equal(m.size, 2); assert.equal(m.get(2).joinedToOrderId, 1);
  await J.clearOrderJoin(1);
  assert.equal(f.db.deliveryJoin.length, 2, 'שורש לא נמחק');
  await J.clearOrderJoin(2);
  assert.deepEqual(f.db.deliveryJoin.map(r => r.orderId), [1]);
  assert.equal(await J.getDeliveryJoinPrice(), 20);
  f.settings.delivery_join_price = '0'; assert.equal(await J.getDeliveryJoinPrice(), null);
  f.settings.delivery_join_price = 'abc'; assert.equal(await J.getDeliveryJoinPrice(), null);
  f.settings.delivery_join_price = '20'; f.settings.enable_delivery_join = 'false'; assert.equal(await J.getDeliveryJoinPrice(), null, 'כבוי = המחיר הרגיל');
  delete f.settings.enable_delivery_join; assert.equal(await J.getDeliveryJoinPrice(), null, 'חסר = כבוי');
});

// ---------------- הטבלה חסרה = כבוי ----------------
const missing = () => Object.assign(new Error('Invalid `prisma.deliveryJoin.findMany()` invocation: The table `public.DeliveryJoin` does not exist in the current database.'), { code: 'P2021' });

test('P2021: כל הפונקציות מתנהגות כ"כבוי" בלי לזרוק (getJoinRows ריק, isOrderJoined false, info ריק, group ריק, save unavailable, clear no-op)', async () => {
  const f = seed([ord(1), ord(2)]);
  f.failWith = missing();
  assert.equal((await J.getJoinRows([1, 2])).size, 0);
  assert.equal(await J.isOrderJoined(2), false);
  assert.deepEqual(await J.getJoinInfo(2), { orderId: 2, joinedToOrderId: null, rootOrderId: 2, isPrimary: false, group: [] });
  assert.deepEqual(await J.getJoinGroup(1), []);
  const r = await J.saveDeliveryJoin(2, { joinedToOrderId: 1 });
  assert.equal(r.ok, false); assert.equal(r.unavailable, true);
  await J.clearOrderJoin(2);
  assert.equal(await J.isDeliveryJoinAvailable(), false);
  assert.deepEqual(await J.listJoinCandidates({ eventDateIso: '2026-10-07', direction: 'הלוך', oneDayBefore: false }).then(a => a.map(c => c.orderId)), [1, 2], 'מועמדים: ההזמנות עצמן קיימות; כל אחת שורש (אין שורות הצטרפות)');
});

test('42P01 בהודעה (בלי קוד Prisma) מזוהה כטבלה חסרה', async () => {
  const f = seed([ord(1)]);
  f.failWith = new Error('relation "DeliveryJoin" does not exist (42P01)');
  assert.equal(await J.isOrderJoined(1), false);
  assert.equal(J.isMissingTableError(f.failWith), true);
  assert.equal(J.isMissingTableError(new Error('connection reset')), false);
  assert.equal(J.isMissingTableError(null), false);
});

test('בדיקה חוזרת מוזכרת: אחרי "חסרה" לא שואלים שוב עד TABLE_RECHECK_MS; אחריו שואלים (והטבלה שנוצרה מזוהה)', async () => {
  const f = seed([ord(1)]);
  f.failWith = missing();
  assert.equal(await J.isDeliveryJoinAvailable(), false);
  const q1 = f.queries.length;
  assert.ok(q1 >= 1);
  f.failWith = null; // הטבלה נוצרה בינתיים
  assert.equal(await J.isDeliveryJoinAvailable(), false, 'עדיין מוזכר כחסר');
  assert.equal(await J.isOrderJoined(1), false);
  assert.equal(f.queries.length, q1, 'אפס שאילתות נוספות בזמן ההמתנה');
  assert.equal(J.isDeliveryJoinTableMarkedMissing(), true);
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + J.TABLE_RECHECK_MS + 1000;
    assert.equal(J.isDeliveryJoinTableMarkedMissing(), false);
    assert.equal(await J.isDeliveryJoinAvailable(), true, 'אחרי חלון ההמתנה נשאלת שוב והטבלה זמינה');
  } finally { Date.now = realNow; }
});

test('מודל חסר בקליינט (prisma לא נוצר מחדש) = כבוי, בלי TypeError', async () => {
  const f = seed([ord(1), ord(2)]);
  f.noModel = true;
  assert.equal(J.isJoinModelAvailable(), false);
  assert.equal(await J.isDeliveryJoinAvailable(), false);
  assert.equal((await J.getJoinRows([1])).size, 0);
  assert.equal(await J.isOrderJoined(1), false);
  assert.equal((await J.saveDeliveryJoin(2, { joinedToOrderId: 1 })).unavailable, true);
  await J.clearOrderJoin(1);
});

test('שגיאה אחרת (לא "טבלה חסרה") בכתיבה נזרקת הלאה ולא מסמנת את הטבלה כחסרה', async () => {
  const f = seed([ord(1), ord(2)]);
  f.failWith = new Error('connection reset');
  await assert.rejects(() => J.saveDeliveryJoin(2, { joinedToOrderId: 1 }), /connection reset/);
  assert.equal(J.isDeliveryJoinTableMarkedMissing(), false);
});

test('הגדרה כבויה = לא זמין, בלי שאילתה לטבלה', async () => {
  const f = seed([ord(1)]);
  f.settings.enable_delivery_join = 'false';
  assert.equal(await J.isDeliveryJoinAvailable(), false);
  assert.equal(f.queries.length, 0);
  f.settings.enable_delivery_join = 'true';
  assert.equal(await J.isDeliveryJoinAvailable(), true);
});


// ---------------- סקירה בלתי תלויה של עבודת ההצטרפות (סעיפים 2, 4, 5, 6) ----------------
const joinErr = async (id, root) => { const r = await J.saveDeliveryJoin(id, { joinedToOrderId: root }); return r.ok ? null : r.error; };

test('סקירה 2: השרת מאמת יום אירוע ישראלי (גם סביב חצות) / fromDate / כתובת מול היעד - ok:false בעברית, בלי כתיבה', async () => {
  const f = seed([
    ord(1), // יעד: הלוך-חזור, 07/10, בלי יום-לפני
    ord(2), // תואם
    ord(3, { eventDate: '2026-10-08T09:00:00.000Z' }), // יום אחר
    ord(7, { eventDate: '2026-10-07T21:30:00.000Z' }), // 08/10 00:30 בישראל (UTC+3) = יום אחר מ-07/10
    ord(8, { eventDate: '2026-10-06T21:30:00.000Z' }), // 07/10 00:30 בישראל = אותו יום כמו 1 (למרות ש-UTC הוא 06/10)
    ord(9, { eventDate: null, fromDate: '2026-10-07T09:00:00.000Z' }), // חו"ל/אמצע שבוע: fromDate
    ord(6, { deliveryAddress: null, deliveryCity: null, customer: cust('x', { street: '', houseNum: '', city: '' }) }), // יעד בלי כתובת
    ord(10),
  ]);
  const before = JSON.stringify(f.db.deliveryJoin);
  assert.match(await joinErr(3, 1), /ביום אירוע אחר/);
  assert.match(await joinErr(7, 1), /ביום אירוע אחר/, 'חצות ישראל: 21:30Z = למחרת בישראל');
  assert.match(await joinErr(10, 6), /אין כתובת/);
  assert.equal(JSON.stringify(f.db.deliveryJoin), before, 'שגיאה = אין שורה ואין audit');
  assert.equal(f.audits.length, 0);
  assert.equal(await joinErr(8, 1), null, '21:30Z של אתמול = אותו יום בישראל');
  assert.equal(await joinErr(9, 1), null, 'fromDate מחליף eventDate');
  assert.equal(await joinErr(2, 1), null);
  assert.deepEqual(f.db.deliveryJoin.map(r => r.orderId).sort(), [2, 8, 9]);
});

test('סקירה 2: כיוון ו"יוצא יום לפני" - אותו כלל כמו listJoinCandidates (הלוך-חזור לא מצטרף לכיוון אחד; הלוך כן להלוך-חזור)', async () => {
  seed([
    ord(1), // הלוך-חזור
    ord(4, { deliveryDirection: 'הלוך' }), // יעד של כיוון אחד
    ord(5, { deliveryOneDayBefore: true }), // יעד הלוך-חזור עם יום-לפני
    ord(11), ord(12, { deliveryDirection: 'הלוך' }), ord(13, { deliveryDirection: 'חזור' }), ord(14, { deliveryDirection: 'חזור', deliveryOneDayBefore: true }),
    ord(15, { deliveryDirection: 'חזור', deliveryOneDayBefore: true }),
  ]);
  assert.match(await joinErr(11, 4), /כיוון המשלוח/, 'הלוך-חזור מול משלוח של הלוך בלבד');
  assert.match(await joinErr(12, 13), /כיוון המשלוח/, 'הלוך מול חזור');
  assert.equal(await joinErr(12, 1), null, 'הלוך מצטרף להלוך-חזור');
  assert.equal(await joinErr(12, 4), null, 'הלוך מצטרף להלוך');
  assert.match(await joinErr(11, 5), /מועד אחר/, 'הלוך-חזור (כולל הלוך): יום-לפני חייב להיות זהה');
  assert.equal(await joinErr(13, 14), null, '"חזור" - כלל יום-לפני לא חל');
  assert.equal(await joinErr(15, 1), null, 'חזור (יום-לפני) מצטרף להלוך-חזור');
  // עקביות עם הרשימה: מה שהשרת דוחה (4 = כיוון אחד, 5 = יום-לפני) לא מוצע להלוך-חזור בלי יום-לפני
  const cands = await J.listJoinCandidates({ eventDateIso: '2026-10-07', direction: 'הלוך-חזור', oneDayBefore: false, excludeOrderId: 99 });
  for (const c of cands) assert.ok(c.orderId !== 4 && c.orderId !== 5, 'הרשימה לא מציעה את מה שהשרת דוחה');
});

test('סקירה 4: מצטרף שנמחק לא חוסם הצטרפות של השורש למשלוח אחר, ומצטרף חי עדיין חוסם', async () => {
  const f = seed([ord(1), ord(2, { isDeleted: true }), ord(3)], [row(2, { joinedToOrderId: 3 })]);
  assert.equal(await joinErr(3, 1), null, 'המצטרף היחיד נמחק - 3 חופשי להצטרף');
  assert.equal(f.db.deliveryJoin.find(r => r.orderId === 3).joinedToOrderId, 1);
  seed([ord(20), ord(21)], [row(21, { joinedToOrderId: 20 })]);
  assert.match(await joinErr(20, 1), /כבר הצטרפו/);
});

test('סקירה 4: releaseOrderJoins - הזמנה שנמחקה/כובה בה משלוח: מצטרפת מוסרת משורת ההצטרפות; שורש משחרר את מצטרפיו (audit, בלי AuditLog ידני)', async () => {
  const f = seed([ord(1), ord(2), ord(3), ord(4)], [row(1, { isPrimary: true }), row(2, { joinedToOrderId: 1 }), row(3, { joinedToOrderId: 1 })]);
  assert.deepEqual(await J.releaseOrderJoins(2), [], 'מצטרפת בלבד: אין מי ששוחרר');
  assert.deepEqual(f.db.deliveryJoin.map(r => r.orderId).sort(), [1, 3]);
  assert.equal(f.audits.at(-1).action, 'DELIVERY_JOIN_CANCELLED');
  assert.deepEqual(await J.releaseOrderJoins(1), [3], 'שורש: מצטרפיו משוחררים ומוחזרים לחישוב מחדש');
  assert.deepEqual(f.db.deliveryJoin.map(r => r.orderId), [1], 'נשארת רק שורת ה"ראשי" של השורש');
  assert.deepEqual(await J.releaseOrderJoins(4), [], 'הזמנה בלי שורות = no-op');
  assert.ok(f.audits.every(a => a.entityType === 'deliveryJoin' && /^DELIVERY_/.test(a.action)));
  assert.ok(!f.queries.some(q => /auditLog|updateMany|deleteMany/.test(q)));
  f.failWith = missing(); // טבלה חסרה = no-op בלי זריקה
  assert.deepEqual(await J.releaseOrderJoins(1), []);
});

test('סקירה 5: מירוץ - אחרי הכתיבה נבדק שהיעד עדיין שורש ושלהזמנה אין מצטרפים; אחרת הכתיבה מבוטלת ו-ok:false', async () => {
  const hookCreate = (f, inject) => {
    let done = false;
    const push = f.queries.push.bind(f.queries);
    f.queries.push = (q) => { if (q === 'deliveryJoin.create' && !done) { done = true; inject(); } return push(q); };
  };
  // א. בזמן הכתיבה היעד (1) עצמו הצטרף ל-9
  let f = seed([ord(1), ord(2), ord(9)]);
  hookCreate(f, () => f.db.deliveryJoin.push(row(1, { joinedToOrderId: 9, direction: 'הלוך-חזור' })));
  let r = await J.saveDeliveryJoin(2, { joinedToOrderId: 1 });
  assert.equal(r.ok, false); assert.match(r.error, /הצטרף בינתיים/);
  assert.equal(f.db.deliveryJoin.find(x => x.orderId === 2), undefined, 'השורה שנכתבה בוטלה');
  assert.equal(f.db.order.find(o => o.orderId === 2).deliveryAddress, 'עמוס 3', 'הכתובת לא נדרסה');
  // ב. בזמן הכתיבה מישהי (7) הצטרפה להזמנה שמצטרפת (2)
  resetFake(); f = seed([ord(1), ord(2), ord(7)]);
  hookCreate(f, () => f.db.deliveryJoin.push(row(7, { joinedToOrderId: 2, direction: 'הלוך-חזור' })));
  r = await J.saveDeliveryJoin(2, { joinedToOrderId: 1 });
  assert.equal(r.ok, false); assert.match(r.error, /הצטרפו בינתיים/);
  assert.deepEqual(f.db.deliveryJoin.map(x => x.orderId), [7], 'רק השורה של המצטרפת האחרת נשארה');
  assert.equal(f.audits.some(a => a.action === 'DELIVERY_JOIN_CANCELLED' && a.entityId === '2'), true, 'הביטול נרשם ב-audit');
});

test('סקירה 6: שורש לשעבר שהיה "ראשי" ומצטרף לאחר - isPrimary מתאפס (ולא נשאר ראשי כפול)', async () => {
  const f = seed([ord(1), ord(2)], [row(2, { isPrimary: true }), row(1)]);
  assert.equal(await joinErr(2, 1), null);
  const r2 = f.db.deliveryJoin.find(r => r.orderId === 2);
  assert.equal(r2.joinedToOrderId, 1); assert.equal(r2.isPrimary, false);
  const a = f.audits.find(x => x.action === 'DELIVERY_JOIN_UPDATED');
  assert.deepEqual(a.changes.isPrimary, { from: true, to: false });
  const n = f.audits.length; // אידמפוטנטי: שמירה חוזרת בלי שינוי לא כותבת
  assert.equal(await joinErr(2, 1), null);
  assert.equal(f.audits.length, n);
  seed([ord(5)]); // שורה חדשה (create) נוצרת עם isPrimary:false
  await J.saveDeliveryJoin(5, { joinedToOrderId: 1 });
  assert.equal(f.db.deliveryJoin.find(r => r.orderId === 5).isPrimary, false);
});
