// בדיקות שרת ל-GET /api/orders (חיפוש הרשימה): מודל prisma בזיכרון, בלי DB.
//   node scripts/search-lists-tests/orders.test.mjs     (יוצא עם קוד 1 אם משהו נכשל)
// מכסה: תאימות לאחור (שם / מספר הזמנה / דגם), הרחבת טווח כשאין תוצאות ב"בקרוב" + הודעה, תאריך עברי וגם לועזי (התאמה מדויקת),
// טלפון בכל צורת כתיבה (גם טלפון 2), "050-123" לא מוצא הזמנה #50, ברקוד (7 ספרות; 5-6 ספרות הזמנה קודם), הצלת מקלדת, שמות דומים, מידה מדויקת
// בחיפוש המתקדם, תקרת limit.
import assert from 'node:assert/strict';
import { HDate } from '@hebcal/core';
import { T, resetT, load, t, req, summary } from './kit.mjs';

const route = await load('app/api/orders/route.js');
const hd = await load('lib/hebrewDate.js');

const todayKey = hd.getIsraelDateKey(new Date());
const dayStart = (offset) => hd.getIsraelDayRange(hd.addDaysToDateKey(todayKey, offset)).start;
// תאריך אירוע בצורת האחסון של האתר: חצות ישראל
const dateOf = (key) => hd.getIsraelDayRange(key).start;

// תאריך עברי -> מפתח יום לועזי (כך שהבדיקות עקביות: eventDate ו-eventDateHebrew של אותה הזמנה מתארים אותו יום)
const hebKey = (d, m, y) => { const g = new HDate(d, m, y).greg(); return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`; };
const cust = (id, first, last, phone1, phone2 = null) => ({ id, firstName: first, lastName: last, phone1, phone2, email: null, city: null, zeout: null, isDeleted: false });
const item = (o = {}) => ({ id: Math.random().toString(36).slice(2), isDeleted: false, isTaken: false, isReturned: false, barcodePrefix: null, sizeText: null, description: null, price: 0, barcode: null, dressItemId: null, dressItem: null, ...o });
let seq = 30000;
const order = (c, o = {}) => ({
  orderId: ++seq, legacyId: null, customerId: c.id, customer: c, totalAmount: 0, status: null, notes: null, eventDate: dayStart(10), eventDateHebrew: null,
  orderDate: null, returnDate: null, isAbroad: false, fromDate: null, toDate: null, customSpacing: null, isDeleted: false, items: [], payments: [], obligations: [], ...o,
});
const call = async (qs) => { const res = await route.GET(req('/api/orders?' + qs)); return { status: res.status, body: await res.json() }; };
const ids = (r) => r.body.data.map((o) => o.orderId).sort((a, b) => a - b); // ממוין מספרית, כדי שההשוואות לא יהיו תלויות בסדר

const rachel = cust('c1', 'רחל', 'כהן', '050-1234567');
const moshe = cust('c2', 'משה', 'לוי', '0529876543', '+972-54-7654321');
const dana = cust('c3', 'דנה', 'אברהם', '0501112222');

function fixture() {
  const upcoming = order(rachel, { orderId: 30001, eventDate: dayStart(5), eventDateHebrew: 'כז תשרי תשפ"ז', items: [item({ barcode: '5511205', sizeText: '02', barcodePrefix: 551, dressItem: { sizeText: '02', barcodePrefix: 551, dress: { id: 'd1', name: 'שמלת ורד', barcodePrefix: 551 } } })] });
  const past = order(moshe, { orderId: 30002, eventDate: dateOf('2026-03-15'), eventDateHebrew: 'כב אדר תשפ"ו', items: [item({ sizeText: '12', barcodePrefix: 640, dressItem: { sizeText: '12', barcodePrefix: 640, dress: { id: 'd2', name: 'שמלת תכלת', barcodePrefix: 640 } } })] });
  const past2 = order(dana, { orderId: 30050, eventDate: dateOf('2025-10-15'), eventDateHebrew: 'כג תשרי תשפ"ו', items: [item({ sizeText: '2', barcodePrefix: 640, dressItem: { sizeText: '2', barcodePrefix: 640, dress: { id: 'd2', name: 'שמלת תכלת', barcodePrefix: 640 } } })] });
  const b2 = order(dana, { orderId: 30060, eventDate: dateOf('2025-10-05'), eventDateHebrew: 'יג תשרי תשפ"ו', items: [item({ barcode: '6401203' })] });
  const b22 = order(rachel, { orderId: 30061, eventDate: dateOf(hebKey(22, 8, 5786)), eventDateHebrew: 'כב חשוון תשפ"ו' });
  const b2h = order(dana, { orderId: 30062, eventDate: dateOf(hebKey(2, 8, 5786)), eventDateHebrew: 'ב חשוון תשפ"ו' });
  const hug = order(moshe, { orderId: 50, eventDate: dayStart(40) }); // הזמנה #50 - לא אמורה להימצא בחיפוש "050-123"
  T.customers = [rachel, moshe, dana];
  T.orders = [upcoming, past, past2, b2, b22, b2h, hug];
  T.dressModels = [{ barcodePrefix: 551, name: 'שמלת ורד' }, { barcodePrefix: 640, name: 'שמלת תכלת' }];
}

console.log('תאימות לאחור (חיפוש שם / מספר הזמנה / דגם)');
await t('שם פרטי / משפחה / שם מלא בסדר כלשהו - כמו קודם', async () => {
  fixture();
  assert.deepEqual(ids(await call('search=רחל&filterStatus=all')), [30001, 30061]);
  assert.deepEqual(ids(await call('search=לוי&filterStatus=all')), [50, 30002]);
  assert.deepEqual(ids(await call('search=' + encodeURIComponent('כהן רחל') + '&filterStatus=all')), [30001, 30061]);
});
await t('מספר הזמנה: ספרות בלבד מוצא את ההזמנה; קלט ריק מחזיר את כולן; תשובה ללא notices', async () => {
  fixture();
  const r = await call('search=30001&filterStatus=all');
  assert.deepEqual(ids(r), [30001]);
  assert.equal(r.body.notices, undefined);
  assert.equal((await call('search=&filterStatus=all')).body.total, 2, 'בלי חיפוש: "הכל" מציג רק 3 חודשים אחרונים (התנהגות קיימת)');
});
await t('דגם: חיפוש לפי שם דגם ולפי קידומת (placeholder / ספרות)', async () => {
  fixture();
  assert.deepEqual(ids(await call('search=' + encodeURIComponent('ורד') + '&filterStatus=all')), [30001]);
  assert.deepEqual(ids(await call('search=640&filterStatus=all')), [30002, 30050]);
});

console.log('"050-123" לא מוצא הזמנה #50 (parseInt על טקסט חופשי)');
await t('טקסט עם ספרות ומקף אינו מספר הזמנה', async () => {
  fixture();
  const r = await call('search=' + encodeURIComponent('050-123') + '&filterStatus=all');
  assert.ok(!ids(r).includes(50), 'הזמנה #50 לא אמורה להימצא');
});
await t('"12 דגם" לא מוצא הזמנה #12 ולא דגם 12', async () => {
  fixture();
  T.orders.push(order(rachel, { orderId: 12 }));
  const r = await call('search=' + encodeURIComponent('12 דגם') + '&filterStatus=all');
  assert.ok(!ids(r).includes(12));
});
await t('ספרות בלבד בלי אפס מוביל עדיין מספר הזמנה (50 -> הזמנה 50)', async () => {
  fixture();
  assert.deepEqual(ids(await call('search=50&filterStatus=all')), [50]);
});

console.log('טווח: "בקרוב" שלא מצא כלום מורחב לכל התאריכים + הודעה');
await t('הזמנה בעבר: ב"בקרוב" ריק -> מורחב לכל התאריכים עם הודעת scope', async () => {
  fixture();
  const r = await call('search=' + encodeURIComponent('דנה') + '&filterStatus=soon');
  assert.deepEqual(ids(r), [30050, 30060, 30062]);
  assert.equal(r.body.notices.length, 1);
  assert.equal(r.body.notices[0].kind, 'scope');
  assert.match(r.body.notices[0].text, /מכל התאריכים/);
});
await t('חיפוש שמוצא ב"בקרוב" לא מורחב ולא מקבל הודעה', async () => {
  fixture();
  const r = await call('search=' + encodeURIComponent('רחל') + '&filterStatus=soon');
  assert.deepEqual(ids(r), [30001]);
  assert.equal(r.body.notices, undefined);
});
await t('בלי חיפוש טקסט אין הרחבה (רשימה ריקה נשארת ריקה); לשונית ארכיון/השכרות לא מורחבות', async () => {
  fixture();
  T.orders = T.orders.filter((o) => o.orderId !== 30001 && o.orderId !== 50);
  const r = await call('search=&filterStatus=soon');
  assert.equal(r.body.total, 0);
  assert.equal(r.body.notices, undefined);
  const arch = await call('search=' + encodeURIComponent('לא קיים') + '&filterStatus=archive');
  assert.equal(arch.body.total, 0);
  assert.equal(arch.body.notices, undefined);
  const rent = await call('search=' + encodeURIComponent('דנה') + '&forRentals=true&filterStatus=soon');
  assert.equal(rent.body.notices, undefined, 'טאבי ההשכרות לא מורחבים');
});

console.log('נסיונות חוזרים: מתי לא, ושימוש חוזר בחיפושי עזר');
await t('טקסט קצר מ-3 תווים שלא מצא כלום: בלי נסיונות חוזרים ובלי הודעה (קודם: הרחבת טווח)', async () => {
  fixture();
  const r = await call('search=' + encodeURIComponent('דנ') + '&filterStatus=soon');
  assert.equal(r.body.total, 0); assert.equal(r.body.notices, undefined);
  assert.equal(T.calls.filter((c) => c.name === 'order.findMany').length, 1, 'שאילתה אחת בלבד');
});
await t('לשונית חובות (unpaid*): בלי נסיונות חוזרים', async () => {
  fixture();
  T.calls = [];
  const r = await call('search=' + encodeURIComponent('שם שלא קיים') + '&filterStatus=unpaid_all');
  assert.equal(r.body.notices, undefined);
  assert.equal(T.calls.filter((c) => c.name === 'dressModel.findMany').length, 1, 'חיפוש הדגמים רץ פעם אחת בלבד');
  assert.equal(T.calls.filter((c) => c.name === '$queryRawUnsafe').length, 0, 'ולא רץ מעבר שמות דומים');
});
await t('חיפוש שלא מצא כלום (3+ תווים): נסיונות חוזרים משתמשים שוב בחיפוש הדגמים / שמות דומים - לא קריאה חוזרת ל-DB', async () => {
  fixture();
  T.calls = [];
  const r = await call('search=' + encodeURIComponent('שם שלא קיים') + '&filterStatus=soon');
  assert.equal(r.body.total, 0);
  const orderQueries = T.calls.filter((c) => c.name === 'order.findMany').length;
  assert.ok(orderQueries >= 3, 'היו נסיונות חוזרים (הרחבת טווח + שמות דומים): ' + orderQueries);
  assert.equal(T.calls.filter((c) => c.name === 'dressModel.findMany').length, 1, 'חיפוש הדגמים פעם אחת לכל הנסיונות');
});

console.log('תאריך עברי (התאמת אסימון שלם)');
await t('"כז תשרי" מוצא את ההזמנה (עם ובלי שנה בטקסט השמור)', async () => {
  fixture();
  assert.deepEqual(ids(await call('search=' + encodeURIComponent('כז תשרי') + '&filterStatus=all')), [30001]);
  assert.deepEqual(ids(await call('search=' + encodeURIComponent('כ״ז תשרי תשפ״ז') + '&filterStatus=all')), [30001]);
});
await t('"ב חשוון" = יום 2: לא מוצא "כב חשוון"', async () => {
  fixture();
  const r = ids(await call('search=' + encodeURIComponent('ב חשוון') + '&filterStatus=all'));
  assert.ok(r.includes(30062), 'יום 2');
  assert.ok(!r.includes(30061), 'כב חשוון אסור');
});
await t('איותי חודש שונים ("חשון" / "חשוון") נמצאים', async () => {
  fixture();
  const a = ids(await call('search=' + encodeURIComponent('כב חשון') + '&filterStatus=all'));
  assert.deepEqual(a, [30061]);
});
await t('הזמנה בלי טקסט עברי שמור נמצאת לפי eventDate (המרה לועזי)', async () => {
  fixture();
  const hDate = hd.getHebrewDateString(dateOf('2025-10-15')); // כך האתר כותב; כאן מוחקים את הטקסט השמור
  assert.ok(hDate.length > 0);
  T.orders.find((o) => o.orderId === 30050).eventDateHebrew = null;
  const r = ids(await call('search=' + encodeURIComponent('כג תשרי') + '&filterStatus=all'));
  assert.ok(r.includes(30050), 'נמצא לפי טווח eventDate: ' + JSON.stringify(r) + ' ' + hDate);
});

await t('חודש לבדו: "תשרי" = כל ההזמנות בתשרי; "ניסן" קודם כשם ורק אחר כך כתאריך', async () => {
  fixture();
  const r = ids(await call('search=' + encodeURIComponent('תשרי') + '&filterStatus=all'));
  assert.deepEqual(r, [30001, 30050, 30060]);
  const nisan = cust('c8', 'ניסן', 'ברק', '0501212121');
  T.customers.push(nisan);
  T.orders.push(order(nisan, { orderId: 77001, eventDate: dayStart(3) }));
  // שם לקוח "ניסן" נמצא כשם - בלי להציף בהזמנות ניסן
  T.orders.push(order(rachel, { orderId: 77002, eventDate: dateOf('2026-04-10'), eventDateHebrew: 'כב ניסן תשפ"ו' }));
  assert.deepEqual(ids(await call('search=' + encodeURIComponent('ניסן') + '&filterStatus=all')), [77001]);
  // אין לקוח בשם הזה -> נסיון חוזר כתאריך
  T.customers = T.customers.filter((c) => c.id !== 'c8'); T.orders = T.orders.filter((o) => o.orderId !== 77001);
  assert.deepEqual(ids(await call('search=' + encodeURIComponent('ניסן') + '&filterStatus=all')), [77002]);
});

console.log('תאריך לועזי (התאמה מדויקת ליום)');
await t('"5/10" מוצא 5 באוקטובר ולא 15/10 או 25/10', async () => {
  fixture();
  const r = ids(await call('search=' + encodeURIComponent('5/10') + '&filterStatus=all'));
  assert.deepEqual(r, [30060]);
  const r2 = ids(await call('search=' + encodeURIComponent('15/10') + '&filterStatus=all'));
  assert.deepEqual(r2, [30050]);
});
await t('עם שנה: 05/10/2025 מוצא, 05/10/2024 לא', async () => {
  fixture();
  assert.deepEqual(ids(await call('search=' + encodeURIComponent('05/10/2025') + '&filterStatus=all')), [30060]);
  assert.deepEqual(ids(await call('search=' + encodeURIComponent('05/10/2024') + '&filterStatus=all')), []);
  assert.deepEqual(ids(await call('search=2025-10-05&filterStatus=all')), [30060]);
});

console.log('טלפון בכל צורת כתיבה');
await t('0501234567 מוצא לקוח ששמור 050-1234567; גם +972 ובלי 0 מוביל', async () => {
  fixture();
  for (const q of ['0501234567', '050-123-4567', '+972501234567', '501234567', '972501234567']) {
    const r = ids(await call('search=' + encodeURIComponent(q) + '&filterStatus=all'));
    assert.deepEqual(r, [30001, 30061], q);
  }
});
await t('טלפון 2 נבדק (שמור +972-54-7654321)', async () => {
  fixture();
  const r = ids(await call('search=0547654321&filterStatus=all'));
  assert.deepEqual(r, [50, 30002]);
});
await t('טלפון חלקי (4+ ספרות) = תת-מחרוזת ספרות; פחות מ-4 לא סורק טלפונים', async () => {
  fixture();
  assert.deepEqual(ids(await call('search=05012345&filterStatus=all')), [30001, 30061]);
  const rawBefore = T.raw.length;
  await call('search=050&filterStatus=all');
  assert.equal(T.raw.length, rawBefore, '050 אינו מפעיל שאילתת טלפון');
});
await t('שאילתת הטלפון מקבלת את שני הכתיבים השקולים (0.. ו-972..)', async () => {
  fixture();
  await call('search=0501234567&filterStatus=all');
  const phoneQ = T.raw.find((r) => /regexp_replace/.test(r.sql));
  assert.deepEqual(phoneQ.params, ['0501234567', '972501234567']);
});
await t('חיפוש מתקדם customerPhone: גם לפי ספרות', async () => {
  fixture();
  const r = ids(await call('customerPhone=050-123-4567&filterStatus=all'));
  assert.deepEqual(r, [30001, 30061]);
});

console.log('ברקוד / מספר הזמנה');
await t('ברקוד של 7 ספרות מוצא את ההזמנה לפי הפריט', async () => {
  fixture();
  assert.deepEqual(ids(await call('search=5511205&filterStatus=all')), [30001]);
});
await t('5-6 ספרות: הזמנה קודם; אם אין הזמנה כזאת - ברקוד כגיבוי עם הודעה', async () => {
  fixture();
  T.orders.find((o) => o.orderId === 30060).items = [item({ barcode: '64012' })]; // ברקוד ישן של 5 ספרות
  const r = await call('search=64012&filterStatus=all');
  assert.deepEqual(ids(r), [30060]);
  assert.equal(r.body.notices[0].kind, 'barcode');
  // כשיש הזמנה במספר הזה - היא מוחזרת בלבד, בלי הברקוד
  T.orders.push(order(rachel, { orderId: 64012 }));
  const r2 = await call('search=64012&filterStatus=all');
  assert.deepEqual(ids(r2), [64012]);
  assert.equal(r2.body.notices, undefined);
});

console.log('מקלדת אנגלית');
await t('"ank," (שמלת) לא מוצא כלום כלטינית -> מומר לעברית, מוצא לפי דגם + הודעה', async () => {
  fixture();
  const r = await call('search=' + encodeURIComponent('ank,') + '&filterStatus=all');
  assert.deepEqual(ids(r), [30001, 30002, 30050]);
  assert.equal(r.body.notices.at(-1).kind, 'layout');
  assert.match(r.body.notices.at(-1).text, /ank,/);
  assert.match(r.body.notices.at(-1).text, /שמלת/);
});
await t('טקסט לטיני שמוצא תוצאות לא מומר', async () => {
  fixture();
  T.customers.push(cust('c9', 'David', 'Cohen', '0500000000'));
  T.orders.push(order(T.customers.at(-1), { orderId: 99001 }));
  const r = await call('search=David&filterStatus=all');
  assert.deepEqual(ids(r), [99001]);
  assert.equal(r.body.notices, undefined);
});
await t('הצלת מקלדת בלשונית "בקרוב": גם הרחבת טווח וגם הודעת המרה', async () => {
  fixture();
  T.orders = T.orders.filter((o) => o.orderId !== 30001); // בלי ההזמנה העתידית
  const r = await call('search=' + encodeURIComponent('ank,') + '&filterStatus=soon');
  assert.deepEqual(ids(r), [30002, 30050]);
  assert.deepEqual(r.body.notices.map((n) => n.kind), ['scope', 'layout']);
});

console.log('שמות דומים (מרחק עריכה 1-2)');
await t('"רחלל" / "כהנ" / "ראחל" נמצאים כשאין התאמה מדויקת + הודעה', async () => {
  fixture();
  for (const q of ['רחלל', 'ראחל', 'רחל כהנ', 'אברהמ']) {
    const r = await call('search=' + encodeURIComponent(q) + '&filterStatus=all');
    assert.ok(r.body.total > 0, q);
    assert.equal(r.body.notices.at(-1).kind, 'fuzzy', q);
  }
  const abr = ids(await call('search=' + encodeURIComponent('אברהמ') + '&filterStatus=all'));
  assert.deepEqual(abr, [30050, 30060, 30062]);
});
await t('שם שונה לגמרי לא נמצא; שאילתת המועמדים חסומה (LIMIT) ורצה רק אחרי חיפוש ריק', async () => {
  fixture();
  const r = await call('search=' + encodeURIComponent('זבולון') + '&filterStatus=all');
  assert.equal(r.body.total, 0);
  const fuzzyQ = T.raw.filter((x) => /similarity\(/.test(x.sql));
  assert.equal(fuzzyQ.length, 1);
  assert.match(fuzzyQ[0].sql, /LIMIT 120/);
  // חיפוש שמצא: בלי שאילתת מטושטש בכלל
  T.raw.length = 0;
  await call('search=' + encodeURIComponent('רחל') + '&filterStatus=all');
  assert.equal(T.raw.filter((x) => /similarity\(/.test(x.sql)).length, 0);
});
await t('כשל בשאילתת העזר לא מפיל את החיפוש (מחזיר תוצאה ריקה)', async () => {
  fixture();
  T.rawFail = true;
  const r = await call('search=' + encodeURIComponent('זבולון') + '&filterStatus=all');
  assert.equal(r.status, 200);
  assert.equal(r.body.total, 0);
});

console.log('מידה מדויקת בחיפוש המתקדם');
await t('advSize=2 מוצא "2" ו"02" ולא "12"', async () => {
  fixture();
  const r = ids(await call('advSize=2&eventDateFrom=2020-01-01&filterStatus=all'));
  assert.deepEqual(r, [30001, 30050]);
  assert.deepEqual(ids(await call('advSize=02&eventDateFrom=2020-01-01&filterStatus=all')), [30001, 30050]);
  assert.deepEqual(ids(await call('advSize=12&eventDateFrom=2020-01-01&filterStatus=all')), [30002]);
});
await t('מידה עם רווח מוביל שמורה (" 06") נתפסת', async () => {
  fixture();
  T.orders.push(order(rachel, { orderId: 40001, items: [item({ sizeText: ' 06' })] }));
  assert.deepEqual(ids(await call('advSize=6&eventDateFrom=2020-01-01&filterStatus=all')), [40001]);
});

console.log('תקרות');
await t('limit מוגבל ל-EXPORT_MAX_ROWS (100000) ולא נשלף "כל הטבלה"; ייצוא של 6000 לא נחתך; מעבר לתקרה limitCapped; ערך לא תקין -> 50', async () => {
  fixture();
  const huge = (await call('limit=100000000&filterStatus=all')).body;
  assert.equal(huge.limit, 100000); assert.equal(huge.limitCapped, true, 'חיתוך מדווח');
  const six = (await call('limit=6000&filterStatus=all')).body;
  assert.equal(six.limit, 6000); assert.ok(!('limitCapped' in six), 'ייצוא מעל 5000 לא נחתך');
  assert.equal((await call('limit=abc&filterStatus=all')).body.limit, 50);
  assert.equal((await call('limit=-3&filterStatus=all')).body.limit, 50);
  assert.equal((await call('limit=2000&filterStatus=all')).body.limit, 2000);
  assert.equal((await call('page=-4&filterStatus=all')).body.page, 1);
});
await t('לא מחובר -> 401', async () => {
  T.authed = false;
  assert.equal((await call('search=x')).status, 401);
});

resetT();
summary('orders');
