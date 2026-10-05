// בדיקות הלוגיקה הטהורה של תוצאות החיפוש הראשי בדף הבית (app/components/home/homeLogic.js + searchPdf.js) אחרי שינויי 5.10.2026:
//   הזמנות לפני לקוחות (ובתוך 8 השורות הראשונות), מס' הזמנה מדויק תמיד ראשון, צורת שורת פריט (שתי שורות: כותרת = ברקוד + מצב; שורה קטנה = הזמנה / לקוחה / תאריך),
//   שורת "מלאי" (נרמול, בלי קישור כשאין הרשאה), צ'יפים של הלו"ז, סטטוס מחושב, הדגשת התאמה, סינון קטגוריה, טבלה/ייצוא.
// הרצה: node scripts/test_home_search_ui_logic.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeSearch, unifiedRows, resultsCount, applyScope, orderStatus, tableRecords, exportRecordsForRows, highlightParts, highlightQuery, inventorySizesText, TABLE_COLUMNS,
} from '../app/components/home/homeLogic.js';
import { sectionsFromGeneral } from '../app/components/home/searchPdf.js';

let passed = 0;
let failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const cust = (i) => ({ id: 'c' + i, firstName: 'לקוחה', lastName: 'מס' + i, phone1: '050-123' + (4000 + i), city: 'ירושלים' });
const ord = (id, extra) => ({ id: 'u' + id, orderId: id, firstName: 'רחל', lastName: 'כהן', eventDateHebrew: 'כז תשרי תשפז', status: '', computedStatus: 'בקרוב', itemCount: 1, ...extra });
const rent = (orderId, extra) => ({ id: 'i' + orderId, orderId, barcode: '6323401', sizeText: '34', catalogName: 'שמלת ורד', isTaken: true, isReturned: false, firstName: 'שרה', lastName: 'לוי', eventDateHebrew: 'ט״ו תשרי תשפ״ז', ...extra });
const invRow = (extra) => ({ type: 'barcode', modelName: 'שמלת ורד', modelCode: 632, barcode: '6323401', size: '34', status: 'מושכר', itemMissing: false, date: '2026-10-05', dateLabel: 'היום', sizes: [{ size: '34', total: 1, booked: 1, available: 0, own: true }, { size: '36', total: 2, booked: 0, available: 2, own: false }], ...extra });

console.log('סדר השורות');
t('הזמנות לפני לקוחות; הלקוחות אחרי ההזמנות גם כשיש יותר מ-8 הזמנות (לקוחות לא דוחפים הזמנות מאחורי "עוד N")', () => {
  const res = normalizeSearch({ customers: [cust(1), cust(2), cust(3)], orders: Array.from({ length: 10 }, (_, i) => ord(100 + i)), rentals: [rent(1)] });
  const rows = unifiedRows(res, 'כהן');
  assert.deepEqual(rows.map((r) => r.kind).slice(0, 8), Array(8).fill('הזמנה'), '8 השורות שמוצגות לפני "עוד N" = הזמנות');
  const firstCustomer = rows.findIndex((r) => r.kind === 'לקוח');
  const lastOrder = rows.map((r) => r.kind).lastIndexOf('הזמנה');
  assert.ok(lastOrder < firstCustomer, 'כל ההזמנות לפני כל הלקוחות');
  assert.deepEqual([...new Set(rows.map((r) => r.kind))], ['הזמנה', 'לקוח', 'פריט']);
});
t('מס\' הזמנה מדויק תמיד ראשון (גם כשהשרת החזיר אותו באמצע): 1-4 ספרות', () => {
  const res = normalizeSearch({ orders: [ord(1111), ord(2573, { firstName: 'דנה' }), ord(3333)], customers: [cust(1)] });
  const rows = unifiedRows(res, '2573');
  assert.equal(rows[0].orderId, 2573);
  assert.deepEqual(rows.slice(1).map((r) => r.orderId), [1111, 3333, undefined]);
});
t('5-6 ספרות: הזמנה מדויקת ראשונה, אחריה מלאי ופריטי הברקוד, ורק אחר כך שאר ההזמנות והלקוחות', () => {
  const res = normalizeSearch({ orders: [ord(11111), ord(25734)], customers: [cust(1)], rentals: [rent(52001, { barcode: '25734' })], inventory: [invRow({ barcode: '25734' })] });
  const rows = unifiedRows(res, '25734');
  assert.deepEqual(rows.map((r) => r.kind), ['הזמנה', 'מלאי', 'פריט', 'הזמנה', 'לקוח']);
  assert.equal(rows[0].orderId, 25734);
});
t('7 ספרות = ברקוד: מלאי, פריטי הברקוד, ואז הזמנות ולקוחות; אין "הזמנה מדויקת" (7 ספרות אינן מס\' הזמנה)', () => {
  const res = normalizeSearch({ orders: [ord(6323401)], customers: [cust(1)], rentals: [rent(52001), rent(52002)], inventory: [invRow()] });
  const rows = unifiedRows(res, '6323401');
  assert.deepEqual(rows.map((r) => r.kind), ['מלאי', 'פריט', 'פריט', 'הזמנה', 'לקוח']);
});
t('טקסט רגיל: מלאי (אם יש) ראשון, ואז הזמנות, לקוחות, פריטים; בלי query - אותו סדר בסיסי', () => {
  const res = normalizeSearch({ orders: [ord(1)], customers: [cust(1)], rentals: [rent(9)], inventory: [invRow({ type: 'model' })] });
  assert.deepEqual(unifiedRows(res, 'מידה 34').map((r) => r.kind), ['מלאי', 'הזמנה', 'לקוח', 'פריט']);
  assert.deepEqual(unifiedRows(res).map((r) => r.kind), ['מלאי', 'הזמנה', 'לקוח', 'פריט']);
});

console.log('צורת שורת פריט');
t('פריט: כותרת = הברקוד (לא שם הדגם), מצב הפריט כתגית; שורה קטנה = הזמנה, שם מלא, תאריך עברי - בדיוק שני רכיבי טקסט', () => {
  const [r] = unifiedRows(normalizeSearch({ rentals: [rent(52001)] }));
  assert.equal(r.kind, 'פריט');
  assert.equal(r.title, '6323401');
  assert.equal(r.name, 'שמלת ורד', 'שם הדגם נשמר לטבלה / ייצוא, לא לכותרת');
  assert.deepEqual(r.status, { cls: '', icon: 'bag', label: 'מושכר עכשיו' });
  assert.deepEqual([r.orderId, r.customer, r.eventHeb], [52001, 'שרה לוי', 'ט״ו תשרי תשפ״ז']);
  assert.equal(r.url, '/orders/52001');
});
t('פריט בלי ברקוד (נתונים ישנים): הכותרת נופלת לשם; בטבלה ובייצוא עדיין שם הדגם והברקוד', () => {
  const [r] = unifiedRows(normalizeSearch({ rentals: [{ orderId: 5, description: 'שמלה ישנה', sizeText: '40' }] }));
  assert.equal(r.title, 'שמלה ישנה');
  const rec = tableRecords([unifiedRows(normalizeSearch({ rentals: [rent(7)] }))[0]])[0];
  assert.deepEqual(rec.cells, ['פריט', 'שמלת ורד', '', '', '6323401', '#7', 'שרה לוי', 'ט״ו תשרי תשפ״ז', 'מושכר עכשיו · מידה 34']);
});
t('המקור של HomeResults: שורת פריט = <b> + שורה אחת (Parts) - לא שלוש שורות; השורה הראשונה אינה "שם דגם"', () => {
  const src = readFileSync(new URL('../app/components/home/HomeResults.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('// פריט: בדיוק שתי שורות'), src.indexOf('// הלו"ז ליום שהוקלד'));
  assert.equal((body.match(/<b\b/g) || []).length, 1, 'כותרת אחת');
  assert.equal((body.match(/<Parts\b/g) || []).length, 1, 'שורה קטנה אחת');
  assert.ok(!/ברקוד <bdi/.test(body) && !/מידה <bdi/.test(body), 'ברקוד ומידה לא בשורה נפרדת');
});

console.log('שורת מלאי');
t('נרמול: רק שדות תצוגה; קישור רק נתיב פנימי; בלי קישור = שורה בלי url (לא קישור)', () => {
  const res = normalizeSearch({ inventory: [
    { ...invRow(), link: '/dashboard/dresses/m1', serial: 3, location: 'מדף 7', price: 999, modelId: 'secret' },
    invRow({ link: 'https://evil.example/x' }),
    invRow(),
  ] });
  assert.equal(res.inventory[0].link, '/dashboard/dresses/m1');
  assert.equal(res.inventory[0].serial, '3');
  assert.equal(res.inventory[1].link, '', 'כתובת חיצונית נזרקת');
  assert.equal(res.inventory[2].link, '');
  const json = JSON.stringify(res);
  assert.ok(!json.includes('999') && !json.includes('secret'), 'שדות לא מוכרים לא עוברים');
  const rows = unifiedRows(res, '6323401').filter((r) => r.kind === 'מלאי');
  assert.deepEqual(rows.map((r) => !!r.url), [true, false, false]);
  assert.ok(rows.every((r) => r.icon === 'box'));
});
t('מידות: סה"כ / מוזמנות / פנויות לכל מידה נשמרים; סיכום טקסט לטבלה / ייצוא', () => {
  const [r] = normalizeSearch({ inventory: [invRow()] }).inventory;
  assert.deepEqual(r.sizes[0], { size: '34', total: 1, booked: 1, available: 0, own: true });
  assert.equal(inventorySizesText(r), '34: 0/1 · 36: 2/2');
  const rec = tableRecords(unifiedRows(normalizeSearch({ inventory: [invRow()] })))[0];
  assert.deepEqual(rec.cells, ['מלאי', 'שמלת ורד', '', '', '6323401', '', '', 'היום', 'מושכר · 34: 0/1 · 36: 2/2']);
  assert.equal(rec.cells.length, TABLE_COLUMNS.length);
  const ex = exportRecordsForRows(unifiedRows(normalizeSearch({ inventory: [invRow()] })));
  assert.equal(ex[0]['סוג'], 'מלאי');
});
t('שורת מלאי נספרת כתוצאה; מסונן קטגוריה: "פריטים" משאירה מלאי, "הזמנות" / "לקוחות" לא', () => {
  const res = normalizeSearch({ orders: [ord(1)], inventory: [invRow()], dateChips: { date: '2026-10-08', chips: [] } });
  assert.equal(resultsCount(res), 3);
  assert.equal(applyScope(res, 'rentals').inventory.length, 1);
  assert.equal(applyScope(res, 'orders').inventory.length, 0);
  assert.equal(applyScope(res, 'orders').dateChips, null);
  assert.equal(resultsCount(normalizeSearch({ dateChips: { date: 'x', chips: [] } })), 1, 'צ\'יפים בלבד = לא "אין תוצאות"');
});
t('תשובה ישנה ששוחזרה מהדפדפן (בלי inventory / dateChips) לא שוברת את הרשימה', () => {
  const saved = { customers: [], orders: [], rentals: [] };
  assert.deepEqual(unifiedRows(saved, 'כהן'), []);
  assert.equal(resultsCount(saved), 0);
});

console.log('צ\'יפים של הלו"ז');
t('נרמול: מונים, קישור פנימי בלבד, יום לא עובד; כתובת חיצונית נזרקת', () => {
  const r = normalizeSearch({ dateChips: { date: '2026-10-08', dateHebrew: 'כ״ז תשרי תשפ״ז', weekday: 'יום חמישי', nonWorkingDay: true, nonWorkingTitles: ['חג'], link: '/schedule?date=2026-10-08', chips: [{ key: 'prep', label: 'הכנות', total: 4, pending: 3, alerts: 1 }, { key: 'x', label: 'ללא מונה' }] } }).dateChips;
  assert.equal(r.link, '/schedule?date=2026-10-08');
  assert.deepEqual(r.chips.map((c) => [c.label, c.total, c.alerts]), [['הכנות', 4, 1], ['ללא מונה', 0, 0]]);
  assert.equal(r.nonWorkingDay, true);
  assert.equal(normalizeSearch({ dateChips: { date: 'x', link: '//evil.example' } }).dateChips.link, '');
  assert.equal(normalizeSearch({ dateChips: 'garbage' }).dateChips, null);
});

console.log('סטטוס מחושב');
t('כל ערכי calculateOrderStatus (הושכר, הוחזר, הוחזר חלקי, הושכר חלקי, בקרוב, עבר, מחוק, טיוטה) מקבלים תגית; "הושכר" עם אייקון תיק', () => {
  for (const s of ['הושכר', 'הוחזר', 'הוחזר חלקי', 'הושכר חלקי', 'בקרוב', 'עבר', 'מחוק', 'טיוטה']) {
    const st = orderStatus(s);
    assert.equal(st.label, s);
    assert.ok(st.icon, 'אייקון ל-' + s);
  }
  assert.equal(orderStatus('הושכר').icon, 'bag');
  assert.equal(orderStatus('הוחזר').cls, 'ok');
});
t('הסטטוס המחושב גובר על השמור; בלי מחושב נשאר השמור (תאימות)', () => {
  const [a, b] = unifiedRows(normalizeSearch({ orders: [ord(1, { status: 'מושכר', computedStatus: 'הוחזר' }), ord(2, { status: 'בוטל', computedStatus: undefined })] }));
  assert.equal(a.status.label, 'הוחזר');
  assert.equal(b.status.label, 'בוטל');
});

console.log('הדגשה');
t('highlightParts: התאמה אחת / כמה מילים / אותיות סופיות / אין התאמה; הטקסט נשמר בשלמותו', () => {
  const join = (p) => p.map(([s]) => s).join('');
  assert.deepEqual(highlightParts('רחל כהן', 'כהן'), [['רחל ', false], ['כהן', true]]);
  assert.deepEqual(highlightParts('אברהם', 'אברהמ'), [['אברהם', true]], 'מ / ם זהים');
  assert.deepEqual(highlightParts('רחל כהן', 'כהן רחל').filter(([, m]) => m).map(([s]) => s), ['רחל', 'כהן'], 'מילים בכל סדר');
  assert.deepEqual(highlightParts('שרה', 'xyz'), [['שרה', false]]);
  assert.deepEqual(highlightParts('', 'א'), [['', false]]);
  for (const [txt, q] of [['תשפ"ז כ"ז', 'כ"ז'], ['abc DEF', 'def'], ['x', '']]) assert.equal(join(highlightParts(txt, q)), txt);
});
t('highlightQuery: שם / ספרות כן; תאריך ומילות מפתח לא', () => {
  assert.equal(highlightQuery('כהן'), 'כהן');
  assert.equal(highlightQuery('6323401'), '6323401');
  assert.equal(highlightQuery('הזמנה 25734'), '25734');
  assert.equal(highlightQuery('כז תשרי'), '');
  assert.equal(highlightQuery('מידה 2 דגם 3'), '');
  assert.equal(highlightQuery('   '), '');
});

console.log('הדפסה / ייצוא');
t('PDF: מקטעים לפי הסדר מלאי, הזמנות, לקוחות, פריטים; שורת פריט עם שם הדגם', () => {
  const res = normalizeSearch({ orders: [ord(1)], customers: [cust(1)], rentals: [rent(9)], inventory: [invRow()] });
  const s = sectionsFromGeneral(res, 'כהן');
  assert.deepEqual(s.map((x) => x.label), ['מלאי', 'הזמנות', 'לקוחות', 'פריטים']);
  assert.deepEqual(s[0].rows[0], ['שמלת ורד', '6323401', 'מושכר', 'היום', '34: 0/1 · 36: 2/2']);
  assert.equal(s[3].rows[0][0], 'שמלת ורד');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed) process.exit(1);
