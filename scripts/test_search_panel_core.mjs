// בדיקות הלוגיקה הטהורה של פאנל התפוסה / הפריט (lib/searchPanelCore.js + lib/capacityRules.js) - מקרי קצה סינתטיים, בלי DB ובלי Next.
// הרצה: node scripts/test_search_panel_core.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import {
  eventDayKey, sizeKeySet, rowMatches, rowSizeKeys, stockAndReserve, busyOn, perSize, requiredFor, outRows, returnedRows, pendingRows,
  buildModelPanel, buildItemPanel, itemStatus, itemFlags, redactPerson, LIST_CAPS, buildWhere, placeText, whereState, redactWhere, WHERE_CAP,
} from '../lib/searchPanelCore.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.stack || e.message); process.exitCode = 1; }
}

const P = 551;
const TODAY = '2026-10-12';
// שורות הזמנה: eventDate נשמר בצורה "חדשה" (חצות ישראל = 21:00/22:00 UTC של היום הקודם) כדי שהבדיקות יהיו קריאות; הצורה הישנה נבדקת בנפרד
const atIsrael = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 3 * 3600 * 1000); }; // חצות ישראל (קיץ, UTC+3)
let nextId = 1;
const row = (extra) => ({
  id: 'r' + nextId++, orderId: 1000 + nextId, barcode: null, size: null, sizeText: '04', oiPrefix: P, diPrefix: null, diSize: null, quantity: 1,
  isTaken: false, isReturned: false, takenDate: null, oiReturn: null, eventDate: atIsrael('2026-10-20'), orderReturn: null, eventDateHebrew: 'ט׳ חשוון',
  status: 'פעיל', firstName: 'שרה', lastName: 'כהן', phone1: '0501234567', phone2: null, ...extra,
});
const item = (extra) => ({ dressBarcode: '5510401', sizeText: '04', location: 'חנות', quantity: 1, inRepair: false, notInUse: false, isDeleted: false, serialNumber: 1, ...extra });
const on = (start, end) => ({ eventDate: atIsrael(start), orderReturn: end ? atIsrael(end) : null });

console.log('יום האירוע');
t('שלוש צורות האחסון ממופות ליום הנכון (ישן 20:00 / 18:00 UTC, חצות ישראל, חצות UTC)', () => {
  assert.equal(eventDayKey(new Date('2026-11-03T20:00:00Z')), '2026-11-04'); // יבוא Access, חורף: "כד חשוון" = 4.11
  assert.equal(eventDayKey(new Date('2026-06-28T18:00:00Z')), '2026-06-29'); // יבוא Access, קיץ: "יד תמוז" = 29.6
  assert.equal(eventDayKey(new Date('2026-09-30T21:00:00Z')), '2026-10-01'); // חצות ישראל בקיץ
  assert.equal(eventDayKey(new Date('2026-11-04T22:00:00Z')), '2026-11-05'); // חצות ישראל בחורף
  assert.equal(eventDayKey(new Date('2026-10-03T00:00:00Z')), '2026-10-03'); // חצות UTC
  assert.equal(eventDayKey(null), null);
  assert.equal(eventDayKey('garbage'), null);
});

console.log('מלאי / רזרבה (אותם כללים כמו /api/inventory/capacity)');
t('מיקום: ריק/חנות = מלאי; רזרבה = רזרבה; מחסן = לא זה ולא זה; Reserve באות גדולה = מלאי (contains רגיש לרישיות, כמו Prisma)', () => {
  const items = [item({ location: null }), item({ location: 'חנות' }), item({ location: 'רזרבה' }), item({ location: 'מחסן' }), item({ location: 'reserve' }), item({ location: 'Reserve' }), item({ location: 'warehouse' })];
  assert.deepEqual(stockAndReserve(items, null), { stock: 3, reserve: 2 });
});
t('לא נספרים: מחוק, בתיקון, לא בשימוש; כמות ריקה = 1; כמות 2 = 2', () => {
  const items = [item({ isDeleted: true }), item({ inRepair: true }), item({ notInUse: true }), item({ quantity: null }), item({ quantity: 2 })];
  assert.deepEqual(stockAndReserve(items, null), { stock: 3, reserve: 0 });
});
t('מידה שקולה בכל כתיב: 4 = 04 = " 04"; לא 14', () => {
  const items = [item({ sizeText: '04' }), item({ sizeText: '4' }), item({ sizeText: ' 04' }), item({ sizeText: '14' }), item({ sizeText: '40' })];
  assert.equal(stockAndReserve(items, sizeKeySet(['4'])).stock, 3);
  assert.equal(stockAndReserve(items, sizeKeySet(['04', '14'])).stock, 4);
  assert.equal(stockAndReserve(items, null).stock, 5);
});

console.log('בתפוסה (חלון ±12 שעות)');
t('הזמנה ביום D נספרת ל-D ולא ל-D-1 / D+1', () => {
  const rows = [row({ ...on('2026-10-20') })];
  assert.equal(busyOn(rows, P, null, '2026-10-20'), 1);
  assert.equal(busyOn(rows, P, null, '2026-10-19'), 0);
  assert.equal(busyOn(rows, P, null, '2026-10-21'), 0);
});
t('הזמנה בכמה ימים (returnDate) תופסת את כל הטווח, כולל הקצוות', () => {
  const rows = [row({ ...on('2026-10-20', '2026-10-22') })];
  for (const [d, n] of [['2026-10-19', 0], ['2026-10-20', 1], ['2026-10-21', 1], ['2026-10-22', 1], ['2026-10-23', 0]]) assert.equal(busyOn(rows, P, null, d), n, d);
});
t('צורת האחסון הישנה (20:00 UTC של היום הקודם) נספרת ליום האירוע האמיתי', () => {
  const rows = [row({ eventDate: new Date('2026-11-03T20:00:00Z') })]; // "כד חשוון" = 4.11
  assert.equal(busyOn(rows, P, null, '2026-11-04'), 1);
  assert.equal(busyOn(rows, P, null, '2026-11-03'), 0);
});
t('הוחזר עדיין נספר בתפוסה (החלטה היסטורית של הטופס); כמויות מצטברות; מידה אחרת / דגם אחר לא', () => {
  const rows = [
    row({ ...on('2026-10-20'), isTaken: true, isReturned: true }),
    row({ ...on('2026-10-20'), quantity: 2 }),
    row({ ...on('2026-10-20'), sizeText: '06' }),
    row({ ...on('2026-10-20'), oiPrefix: 552 }),
  ];
  assert.equal(busyOn(rows, P, sizeKeySet(['4']), '2026-10-20'), 3);
  assert.equal(busyOn(rows, P, null, '2026-10-20'), 4);
});
t('התאמת שורה: דרך השמלה המקושרת כשלפריט ההזמנה אין קידומת; size ו-sizeText; בלי קידומת בכלל - לא שייך', () => {
  const viaDress = row({ oiPrefix: null, diPrefix: P, diSize: '04', sizeText: null });
  assert.equal(rowMatches(viaDress, P, sizeKeySet(['4'])), true);
  assert.equal(rowMatches(viaDress, P, sizeKeySet(['6'])), false);
  assert.equal(rowMatches(row({ oiPrefix: null, diPrefix: null }), P, null), false);
  assert.deepEqual(rowSizeKeys(row({ size: '06', sizeText: '6' }), P), ['6']);
  assert.equal(rowMatches(row({ sizeText: null, size: null }), P, null), true, 'דגם בלי מידה רשומה שייך כשלא סוננה מידה');
  assert.equal(rowMatches(row({ sizeText: null, size: null }), P, sizeKeySet(['4'])), false);
});

console.log('רשימות: בחוץ / הוחזרו / ממתינות');
t('בחוץ: נלקח ולא הוחזר, החדש ראשון; מאוחר (סוף ההזמנה לפני היום) מסומן late', () => {
  const rows = [
    row({ id: 'a', isTaken: true, takenDate: new Date('2026-10-01T10:00:00Z'), ...on('2026-10-02') }),
    row({ id: 'b', isTaken: true, takenDate: new Date('2026-10-10T10:00:00Z'), ...on('2026-10-13') }),
    row({ id: 'c', isTaken: true, isReturned: true }),
    row({ id: 'd', isTaken: false }),
  ];
  const out = outRows(rows, (r) => rowMatches(r, P, null), TODAY);
  assert.deepEqual(out.map((r) => r.rowId), ['b', 'a']);
  assert.equal(out[0].late, false);
  assert.equal(out[1].late, true);
});
t('הוחזרו: מהחדש לישן לפי תאריך ההחזרה, ובלעדיו לפי הלקיחה / האירוע', () => {
  const rows = [
    row({ id: 'a', isTaken: true, isReturned: true, oiReturn: new Date('2026-09-01T10:00:00Z') }),
    row({ id: 'b', isTaken: true, isReturned: true, oiReturn: new Date('2026-09-20T10:00:00Z') }),
    row({ id: 'c', isTaken: true, isReturned: true, oiReturn: null, takenDate: new Date('2026-09-10T10:00:00Z') }),
    row({ id: 'd', isTaken: true, isReturned: true, oiReturn: null, takenDate: null, eventDate: atIsrael('2026-01-05') }),
  ];
  assert.deepEqual(returnedRows(rows, () => true, TODAY).map((r) => r.rowId), ['b', 'c', 'a', 'd']);
});
t('ממתינות: רק שלא נלקחו ושהסוף שלהן מהיום והלאה; הקרובה ראשונה; טיוטה מסומנת; ברקוד לא מוצג לפני לקיחה', () => {
  const rows = [
    row({ id: 'late', ...on('2026-10-30') }),
    row({ id: 'soon', ...on('2026-10-14'), status: 'טיוטה', barcode: '5510401' }),
    row({ id: 'past', ...on('2026-10-01') }),
    row({ id: 'today', ...on('2026-10-12') }),
    row({ id: 'multi', ...on('2026-10-08', '2026-10-13') }), // התחילה בעבר וממשיכה להיום+
    row({ id: 'taken', isTaken: true, ...on('2026-10-15') }),
  ];
  const p = pendingRows(rows, () => true, TODAY);
  assert.deepEqual(p.map((r) => r.rowId), ['multi', 'today', 'soon', 'late']);
  assert.equal(p.find((r) => r.rowId === 'soon').draft, true);
  assert.equal(p.find((r) => r.rowId === 'soon').barcode, '');
});

console.log('"חייבות אותו"');
const req = (p) => requiredFor({ prefix: P, sizeKey: '4', excludeBarcode: '5510401', todayKey: TODAY, ...p });
const two = [item({ dressBarcode: '5510401' }), item({ dressBarcode: '5510402' })];
t('שני פריטים, הזמנה אחת: יש תחליף -> אף אחת לא חייבת', () => {
  assert.equal(req({ items: two, rows: [row({ ...on('2026-10-20') })] }).count, 0);
});
t('שני פריטים, שתי הזמנות חופפות: שתיהן חייבות (בלי הפריט אין מספיק)', () => {
  const r = req({ items: two, rows: [row({ id: 'x', ...on('2026-10-20') }), row({ id: 'y', ...on('2026-10-20') })] });
  assert.equal(r.count, 2); assert.deepEqual([...r.ids].sort(), ['x', 'y']); assert.equal(r.n0, 1);
});
t('שתי הזמנות שאינן חופפות: אף אחת לא חייבת', () => {
  assert.equal(req({ items: two, rows: [row({ ...on('2026-10-20') }), row({ ...on('2026-10-21') })] }).count, 0);
});
t('גבול: שיא העומס שווה להיצע בלעדיו -> לא חייבת; גדול ב-1 -> חייבת', () => {
  const three = [...two, item({ dressBarcode: '5510403' })]; // n0 = 2
  const twoOverlap = [row({ ...on('2026-10-20') }), row({ ...on('2026-10-20') })];
  assert.equal(req({ items: three, rows: twoOverlap }).count, 0);
  assert.equal(req({ items: three, rows: [...twoOverlap, row({ ...on('2026-10-20') })] }).count, 3);
});
t('פריט יחיד במידה: כל הזמנה עתידית חייבת אותו', () => {
  assert.equal(req({ items: [item({ dressBarcode: '5510401' })], rows: [row({ ...on('2026-10-20') }), row({ ...on('2026-11-20') })] }).count, 2);
});
t('הזמנה ארוכה שחופפת שתי קצרות שאינן חופפות זו לזו: כולן חייבות; הקצרות לא סופרות את עצמן פעמיים', () => {
  const rows = [row({ id: 'A', ...on('2026-10-20', '2026-10-30') }), row({ id: 'B', ...on('2026-10-25') }), row({ id: 'C', ...on('2026-10-27') })];
  const r = req({ items: two, rows });
  assert.deepEqual([...r.ids].sort(), ['A', 'B', 'C']);
});
t('פריט שנלקח ולא הוחזר ועבר מועדו עדיין תופס מקום עד היום (לא מעבר: לא יודעים מתי יחזור); הוחזר - לא', () => {
  const late = row({ isTaken: true, ...on('2026-10-01', '2026-10-05') });
  const pendToday = row({ id: 'p', ...on('2026-10-12') });
  const pendTomorrow = row({ id: 'q', ...on('2026-10-13') });
  assert.equal(req({ items: two, rows: [late, pendToday] }).count, 1);
  assert.equal(req({ items: two, rows: [late, pendTomorrow] }).count, 0, 'מאחר שהוא מחוץ לימי העבר - לא חוסם את מחר');
  assert.equal(req({ items: two, rows: [{ ...late, isReturned: true }, pendToday] }).count, 0);
});
t('הזמנה שלא נלקחה ועברה: אינה ביקוש', () => {
  assert.equal(req({ items: two, rows: [row({ ...on('2026-10-01') }), row({ id: 'p', ...on('2026-10-13') })] }).count, 0);
});
t('פריט בתיקון / לא בשימוש / רזרבה / מחסן אינם היצע', () => {
  const items = [item({ dressBarcode: '5510401' }), item({ dressBarcode: '5510402', inRepair: true }), item({ dressBarcode: '5510403', location: 'רזרבה' }), item({ dressBarcode: '5510404', location: 'מחסן' }), item({ dressBarcode: '5510405', notInUse: true })];
  assert.equal(req({ items, rows: [row({ ...on('2026-10-20') })] }).n0, 0);
  assert.equal(req({ items, rows: [row({ ...on('2026-10-20') })] }).count, 1);
});
t('כשהפריט עצמו בתיקון - ההיצע הוא כל מה שנשאר, והספירה היא כמה הזמנות היו נחלצות אם יחזור', () => {
  const items = [item({ dressBarcode: '5510401', inRepair: true }), item({ dressBarcode: '5510402' })]; // n0 = 1
  const r = req({ items, rows: [row({ ...on('2026-10-20') }), row({ ...on('2026-10-20') })] });
  assert.equal(r.n0, 1); assert.equal(r.count, 2);
});
t('מידה אחרת ודגם אחר לא משפיעים; כתיב מידה אחר (4 / 04) כן', () => {
  const rows = [row({ ...on('2026-10-20'), sizeText: '06' }), row({ ...on('2026-10-20'), oiPrefix: 999 }), row({ ...on('2026-10-20'), sizeText: '4' }), row({ ...on('2026-10-20'), sizeText: '04' })];
  assert.equal(req({ items: two, rows }).count, 2);
});
t('בלי הזמנות ממתינות: 0, בלי קריסה על רשימות ריקות', () => {
  assert.equal(req({ items: two, rows: [] }).count, 0);
  assert.equal(req({ items: [], rows: [row({ ...on('2026-10-20') })] }).count, 1);
});

console.log('פירוט לפי מידה');
t('perSize: ממוין מספרית (4 לפני 10), מדלג על מידות בלי שום נתון, מחשב פנוי', () => {
  const items = [item({ sizeText: '10' }), item({ sizeText: '04' }), item({ sizeText: '04' }), item({ sizeText: '06', location: 'מחסן' })];
  const rows = [row({ ...on('2026-10-20'), sizeText: '04' })];
  const ps = perSize(items, rows, P, '2026-10-20');
  assert.deepEqual(ps.map((s) => s.key), ['4', '10']);
  assert.deepEqual(ps[0], { key: '4', size: '04', stock: 2, reserve: 0, busy: 1, free: 1 });
});

console.log('פאנל דגם / פאנל פריט');
t('buildModelPanel: שלושת הריבועים + סדר הרשימות + תקרות', () => {
  const rows = [row({ id: 'o1', isTaken: true, ...on('2026-10-10') }), row({ id: 'p1', ...on('2026-10-20') })];
  const returned = [row({ id: 'r1', isTaken: true, isReturned: true, oiReturn: new Date('2026-09-20T10:00:00Z'), ...on('2026-09-18') })];
  const m = buildModelPanel({ model: { id: 'm1', name: 'ורוד', prefix: P }, items: [item(), item({ location: 'רזרבה' })], rows, returned, sizes: ['04'], dateKey: '2026-10-20', todayKey: TODAY });
  assert.deepEqual(m.tiles, { stock: 1, busy: 1, reserve: 1, free: 0 });
  assert.deepEqual(m.sections.out.rows.map((r) => r.rowId), ['o1']);
  assert.deepEqual(m.sections.returned.rows.map((r) => r.rowId), ['r1']);
  assert.deepEqual(m.sections.pending.rows.map((r) => r.rowId), ['p1']);
  assert.deepEqual(m.perSize, [], 'עם מידה נבחרת אין פירוט');
  const many = Array.from({ length: 60 }, (_, i) => row({ id: 'q' + i, ...on('2026-10-20') }));
  const big = buildModelPanel({ model: { id: 'm1', name: 'x', prefix: P }, items: [], rows: many, returned: [], sizes: [], dateKey: TODAY, todayKey: TODAY });
  assert.equal(big.sections.pending.total, 60);
  assert.equal(big.sections.pending.rows.length, LIST_CAPS.pending);
});
t('itemStatus: בחוץ > הוחזר > תיקון > לא בשימוש > פנוי; בחוץ מציג שם משפחה + טלפון', () => {
  const out = row({ isTaken: true, lastName: 'לוי', firstName: 'דנה', phone1: '', phone2: '0521112222' });
  assert.deepEqual(itemStatus({ item: item(), rentals: [out] }), { kind: 'out', name: 'לוי', phone: '0521112222', orderId: out.orderId, openCount: 1 });
  const back = row({ isTaken: true, isReturned: true, oiReturn: new Date('2026-09-01T00:00:00Z') });
  assert.equal(itemStatus({ item: item({ inRepair: true }), rentals: [back] }).kind, 'returned');
  assert.equal(itemStatus({ item: item({ inRepair: true }), rentals: [] }).kind, 'repair');
  assert.equal(itemStatus({ item: item({ notInUse: true }), rentals: [] }).kind, 'notInUse');
  assert.equal(itemStatus({ item: item(), rentals: [] }).kind, 'free');
  assert.equal(itemStatus({ item: null, rentals: [] }).kind, 'free');
  assert.equal(itemStatus({ item: item(), rentals: [out, { ...out, id: 'older', takenDate: new Date('2020-01-01T00:00:00Z'), lastName: 'ישן' }] }).openCount, 2);
});
t('itemFlags: מחוק / תיקון / לא בשימוש / רזרבה / מחסן', () => {
  assert.deepEqual(itemFlags(item({ inRepair: true, location: 'רזרבה' })), ['בתיקון', 'רזרבה']);
  assert.deepEqual(itemFlags(item({ location: 'מחסן', isDeleted: true })), ['נמחק', 'מחסן']);
  assert.deepEqual(itemFlags(item()), []);
  assert.deepEqual(itemFlags(null), []);
});
t('buildItemPanel: ריבוע ימין סטטוס, אמצע פעמים שהושכר, שמאל חייבות; השורות הממתינות מסומנות requires; היסטוריית הברקוד לא מסוננת לפי קידומת', () => {
  const rented = [
    row({ id: 'h1', barcode: '5510401', oiPrefix: null, isTaken: true, isReturned: true, oiReturn: new Date('2026-08-01T00:00:00Z') }), // בלי קידומת בפריט ההזמנה - עדיין שייך לברקוד
    row({ id: 'h2', barcode: '5510401', isTaken: true, takenDate: new Date('2026-10-05T00:00:00Z'), lastName: 'גולד' }),
  ];
  const demand = [row({ id: 'x', ...on('2026-10-20') }), row({ id: 'y', ...on('2026-10-20') })];
  const m = buildItemPanel({ model: { id: 'm1', name: 'ורוד', prefix: P }, item: item(), barcode: '5510401', sizeText: '04', rentals: rented, rentCount: 7, items: two, rows: demand, dateKey: TODAY, todayKey: TODAY });
  assert.equal(m.tiles.status.kind, 'out'); assert.equal(m.tiles.status.name, 'גולד');
  assert.equal(m.tiles.rentCount, 7);
  assert.equal(m.tiles.required, 2);
  assert.equal(m.sections.out.rows.length, 1); assert.equal(m.sections.returned.rows.length, 1);
  assert.deepEqual(m.sections.pending.rows.map((r) => [r.rowId, r.requires]), [['x', true], ['y', true]]);
  assert.equal(m.itemMissing, false);
  const missing = buildItemPanel({ model: { id: 'm1', name: 'ורוד', prefix: P }, item: null, barcode: '5519999', sizeText: '99', rentals: [], rentCount: 0, items: two, rows: [], dateKey: TODAY, todayKey: TODAY });
  assert.equal(missing.itemMissing, true); assert.equal(missing.tiles.status.kind, 'free');
});

console.log('פרטיות');
t('redactPerson מוחק שם וטלפון מכל הרשימות ומסטטוס "בחוץ", ושומר מספרי הזמנה / תאריכים / כמויות', () => {
  const rented = [row({ isTaken: true, lastName: 'גולד', phone1: '0501112222' })];
  const m = buildItemPanel({ model: { id: 'm1', name: 'x', prefix: P }, item: item(), barcode: '5510401', sizeText: '04', rentals: rented, rentCount: 1, items: two, rows: [row({ ...on('2026-10-20') })], dateKey: TODAY, todayKey: TODAY });
  const red = redactPerson(m);
  const text = JSON.stringify(red);
  assert.ok(!text.includes('גולד') && !text.includes('0501112222') && !text.includes('כהן') && !text.includes('0501234567'), 'לא נשאר שם או טלפון');
  assert.equal(red.tiles.status.kind, 'out');
  assert.ok(red.sections.out.rows[0].orderId > 0);
  assert.equal(red.sections.pending.rows.length, 1);
  assert.ok(JSON.stringify(m).includes('גולד'), 'המקור לא שונה');
});

console.log('איפה אני? / איפה המידה שלי?');
const wItem = (bc, extra) => item({ id: 'i' + bc, dressBarcode: bc, serialNumber: Number(bc.slice(-2)), ...extra });
const W = (p) => buildWhere({ model: { id: 'm1', name: 'ורוד', prefix: P }, lastReturns: new Map(), sizes: [], todayKey: TODAY, rows: [], items: [], ...p });
t('placeText: סניף · מיקום · מס׳ מיקום · קרטון; בלי שום שדה = לא ידוע', () => {
  assert.deepEqual(placeText({ location: 'מחסן', locationNum: 19401 }), { text: 'מחסן · מיקום 19401', known: true });
  assert.deepEqual(placeText({ branch: 'בית שמש', location: 'חנות', cartonNumber: '12' }), { text: 'בית שמש · חנות · קרטון 12', known: true });
  assert.deepEqual(placeText({ location: null, locationNum: null }), { text: '', known: false });
  assert.deepEqual(placeText({ location: '  ' }), { text: '', known: false });
});
t('whereState: סדר העדיפויות בחוץ > תיקון > לא בשימוש > רזרבה > מחסן > מקום > לא מוגדר', () => {
  assert.equal(whereState(item({ inRepair: true }), { id: 'r' }), 'out');
  assert.equal(whereState(item({ inRepair: true, notInUse: true }), null), 'repair');
  assert.equal(whereState(item({ notInUse: true, location: 'רזרבה' }), null), 'notInUse');
  assert.equal(whereState(item({ location: 'רזרבה' }), null), 'reserve');
  assert.equal(whereState(item({ location: 'מחסן' }), null), 'warehouse');
  assert.equal(whereState(item({ location: 'warehouse' }), null), 'warehouse');
  assert.equal(whereState(item({ location: 'חנות' }), null), 'place');
  assert.equal(whereState(item({ location: null }), null), 'unknown');
  assert.equal(whereState(item({ location: null, cartonNumber: '3' }), null), 'place');
});
t('buildWhere: מושכרים קודם (החדש ראשון), אחר כך תיקון/רזרבה/מחסן/מקום/לא מוגדר, בתוך קבוצה לפי מידה ואז סידורי', () => {
  const items = [wItem('5510602', { location: 'חנות', sizeText: '06' }), wItem('5510401', { location: 'מחסן', locationNum: 5 }), wItem('5510402', { location: null }), wItem('5510403', { inRepair: true }),
    wItem('5510404', {}), wItem('5510405', { location: 'רזרבה' }), wItem('5510406', { location: 'חנות' })];
  const rows = [row({ id: 'a', barcode: '5510404', isTaken: true, takenDate: new Date('2026-10-01T00:00:00Z'), lastName: 'לוי' }), row({ id: 'b', barcode: '5510406', isTaken: true, takenDate: new Date('2026-10-09T00:00:00Z'), lastName: 'כץ' })];
  const w = W({ items, rows });
  assert.deepEqual(w.rows.map((r) => r.barcode), ['5510406', '5510404', '5510403', '5510405', '5510401', '5510602', '5510402']);
  assert.deepEqual(w.rows.map((r) => r.state), ['out', 'out', 'repair', 'reserve', 'warehouse', 'place', 'unknown']);
  assert.ok(w.rows[0].name.startsWith('כץ')); assert.equal(w.rows[0].orderId, rows[1].orderId);
  assert.deepEqual(w.counts, { out: 2, repair: 1, notInUse: 0, reserve: 1, warehouse: 1, place: 1, unknown: 1 });
  assert.equal(w.rows.find((r) => r.barcode === '5510401').place, 'מחסן · מיקום 5');
});
t('buildWhere: מסנן מידה (4 = 04); השכרה פתוחה בברקוד שאינו פריט במלאי נכנסת כ-orphan; הוחזרה לאחרונה עם תאריך', () => {
  const items = [wItem('5510401', {}), wItem('5510601', { sizeText: '06' })];
  const rows = [row({ id: 'o', barcode: '5519999', isTaken: true, sizeText: '04' }), row({ id: 'o2', barcode: '5519998', isTaken: true, sizeText: '06' })];
  const last = new Map([['5510401', { at: new Date('2026-09-20T10:00:00Z'), orderId: 77 }]]);
  const w = W({ items, rows, sizes: ['4'], lastReturns: last });
  assert.deepEqual(w.rows.map((r) => [r.barcode, r.orphan]), [['5519999', true], ['5510401', false]]);
  const mine = w.rows.find((r) => r.barcode === '5510401');
  assert.equal(mine.returnedOrderId, 77); assert.ok(mine.returnedAt);
});
t('buildWhere: פריטים מחוקים לא מופיעים; השכרה שהוחזרה אינה "בחוץ"; כמה השכרות פתוחות לאותו ברקוד = האחרונה', () => {
  const items = [wItem('5510401', { isDeleted: true }), wItem('5510402', {})];
  const rows = [row({ id: 'x', barcode: '5510402', isTaken: true, isReturned: true }), row({ id: 'y', barcode: '5510402', isTaken: true, takenDate: new Date('2026-01-01T00:00:00Z'), lastName: 'ישן' }), row({ id: 'z', barcode: '5510402', isTaken: true, takenDate: new Date('2026-10-01T00:00:00Z'), lastName: 'חדש' })];
  const w = W({ items, rows });
  assert.equal(w.rows.length, 1); assert.ok(w.rows[0].name.startsWith('חדש'));
});
t('buildWhere: תקרה, ו-redactWhere מוחק שם וטלפון בלבד', () => {
  const items = Array.from({ length: WHERE_CAP + 5 }, (_, i) => wItem(String(5510000 + i), { serialNumber: i }));
  const w = W({ items });
  assert.equal(w.rows.length, WHERE_CAP); assert.equal(w.truncated, true); assert.equal(w.total, WHERE_CAP + 5);
  const out = W({ items: [wItem('5510401', {})], rows: [row({ barcode: '5510401', isTaken: true, lastName: 'גולד', phone1: '0501112222' })] });
  const red = redactWhere(out);
  assert.ok(!JSON.stringify(red).includes('גולד') && !JSON.stringify(red).includes('0501112222'));
  assert.equal(red.rows[0].state, 'out'); assert.ok(red.rows[0].orderId > 0);
});

console.log(`\n${passed} passed`);
