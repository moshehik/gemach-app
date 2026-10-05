// בדיקות שרת לשאר נתיבי החיפוש: /api/customers, /api/dresses, /api/a5/adv, /api/inventory/models, /api/inventory/capacity, /api/a5/options (size).
//   node scripts/search-lists-tests/routes.test.mjs     (יוצא עם קוד 1 אם משהו נכשל)
// מודל prisma בזיכרון + מעריך where (scripts/search-lists-tests/kit.mjs); בלי DB.
import assert from 'node:assert/strict';
import { T, load, t, req, summary } from './kit.mjs';

const customersRoute = await load('app/api/customers/route.js');
const dressesRoute = await load('app/api/dresses/route.js');
const advRoute = await load('app/api/a5/adv/route.js');
const modelsRoute = await load('app/api/inventory/models/route.js');
const capacityRoute = await load('app/api/inventory/capacity/route.js');
const optionsRoute = await load('app/api/a5/options/route.js');

const get = async (route, url) => { const res = await route.GET(req(url)); return { status: res.status, body: await res.json() }; };
const nums = (rows) => rows.map((r) => r.id).sort();

// ---------------------------------------------------------------- לקוחות
const C = (id, firstName, lastName, phone1, phone2 = null, extra = {}) => ({ id, legacyId: Number(id.slice(1)), firstName, lastName, phone1, phone2, city: null, street: null, houseNum: null, email: null, emailSuffix: null, isBlocked: false, blockedReason: null, zeout: null, marketingConsent: false, isDeleted: false, ...extra });
const customersFixture = () => {
  T.customers = [
    C('c1', 'רחל', 'כהן', '050-1234567', null, { city: 'ירושלים' }),
    C('c2', 'משה', 'לוי', '0529876543', '+972-54-7654321'),
    C('c3', 'דנה', 'אברהם', '0501112222', '03 555 6666'),
    C('c4', 'David', 'Cohen', '0500000000', null, { email: 'David@Mail.com' }),
    C('c5', 'מחוק', 'לקוח', '0501234567', null, { isDeleted: true }),
  ];
};

console.log('לקוחות: תאימות לאחור');
await t('שם פרטי / משפחה / שם מלא / עיר / מייל - כמו קודם', async () => {
  customersFixture();
  assert.deepEqual(nums((await get(customersRoute, '/api/customers?search=' + encodeURIComponent('רחל'))).body.data), ['c1']);
  assert.deepEqual(nums((await get(customersRoute, '/api/customers?search=' + encodeURIComponent('כהן רחל'))).body.data), ['c1']);
  assert.deepEqual(nums((await get(customersRoute, '/api/customers?search=' + encodeURIComponent('ירושלים'))).body.data), ['c1']);
  assert.deepEqual(nums((await get(customersRoute, '/api/customers?search=David@Mail')).body.data), ['c4']);
  const all = await get(customersRoute, '/api/customers');
  assert.equal(all.body.total, 4, 'לקוח מחוק לא מוצג');
  assert.equal(all.body.notices, undefined);
});
await t('טלפון כפי ששמור (חלקי עם מקף) עדיין נמצא כמו קודם', async () => {
  customersFixture();
  assert.deepEqual(nums((await get(customersRoute, '/api/customers?search=050-123')).body.data), ['c1']);
});

console.log('לקוחות: טלפון בכל צורת כתיבה, גם טלפון 2');
await t('0501234567 / 050-123-4567 / +972501234567 / 501234567 מוצאים "050-1234567"', async () => {
  customersFixture();
  for (const q of ['0501234567', '050-123-4567', '+972501234567', '501234567', '050 123 4567']) {
    const r = await get(customersRoute, '/api/customers?search=' + encodeURIComponent(q));
    assert.deepEqual(nums(r.body.data), ['c1'], q);
  }
});
await t('טלפון 2 (+972-54-7654321 ו-03 555 6666) נמצא', async () => {
  customersFixture();
  assert.deepEqual(nums((await get(customersRoute, '/api/customers?search=0547654321')).body.data), ['c2']);
  assert.deepEqual(nums((await get(customersRoute, '/api/customers?search=035556666')).body.data), ['c3']);
});
await t('פרמטר phone (בדיקת טלפון בהזמנה חדשה) מוצא לפי ספרות', async () => {
  customersFixture();
  assert.deepEqual(nums((await get(customersRoute, '/api/customers?phone=' + encodeURIComponent('050-123-4567') + '&limit=20')).body.data), ['c1']);
});
await t('טלפון חלקי 4+ ספרות לפי ספרות; קצר מ-4 לא מפעיל שאילתת טלפון', async () => {
  customersFixture();
  assert.deepEqual(nums((await get(customersRoute, '/api/customers?search=0501234')).body.data), ['c1']);
  T.raw.length = 0;
  await get(customersRoute, '/api/customers?search=050');
  assert.equal(T.raw.length, 0);
});

console.log('לקוחות: מקלדת אנגלית ושמות דומים');
await t('"nav" (משה שהוקלד במקלדת אנגלית) -> מומר לעברית + הודעה', async () => {
  customersFixture();
  const r = await get(customersRoute, '/api/customers?search=nav');
  assert.deepEqual(nums(r.body.data), ['c2']);
  assert.equal(r.body.notices[0].kind, 'layout');
  assert.match(r.body.notices[0].text, /nav/);
});
await t('לטינית שמצאה (David) לא מומרת', async () => {
  customersFixture();
  const r = await get(customersRoute, '/api/customers?search=David');
  assert.deepEqual(nums(r.body.data), ['c4']);
  assert.equal(r.body.notices, undefined);
});
await t('שמות דומים: "רחלל", "כהנ", "אברהמ"', async () => {
  customersFixture();
  for (const [q, id] of [['רחלל', 'c1'], ['רחל כהנ', 'c1'], ['אברהמ', 'c3'], ['משא', 'c2']]) {
    const r = await get(customersRoute, '/api/customers?search=' + encodeURIComponent(q));
    assert.ok(nums(r.body.data).includes(id), q + ' -> ' + JSON.stringify(r.body));
  }
  const r = await get(customersRoute, '/api/customers?search=' + encodeURIComponent('רחלל'));
  assert.equal(r.body.notices[0].kind, 'fuzzy');
  const none = await get(customersRoute, '/api/customers?search=' + encodeURIComponent('זבולון'));
  assert.equal(none.body.total, 0);
});
await t('תקרת limit; כשל בעזר לא מפיל', async () => {
  customersFixture();
  assert.equal((await get(customersRoute, '/api/customers?limit=99999999')).body.limit, 5000);
  assert.equal((await get(customersRoute, '/api/customers?limit=x')).body.limit, 50);
  T.rawFail = true;
  const r = await get(customersRoute, '/api/customers?search=' + encodeURIComponent('זבולון'));
  assert.equal(r.status, 200);
});
await t('401 כשלא מחובר', async () => { T.authed = false; assert.equal((await get(customersRoute, '/api/customers?search=x')).status, 401); });

// ---------------------------------------------------------------- דגמים
const item = (id, sizeText, over = {}) => ({ id, sizeText, quantity: 1, location: null, inRepair: false, notInUse: false, isDeleted: false, serialNumber: 1, dressBarcode: null, _count: { orderItems: 0 }, ...over });
const model = (id, name, barcodePrefix, items, extra = {}) => ({ id, name, barcodePrefix, priceCategory: null, notes: null, inInspection: false, imageUrl: null, thumbnailUrl: null, entryDateToRepo: null, exitDateFromRepo: null, inactiveReason: null, isDeleted: false, items, ...extra });
const dressFixture = () => {
  T.dressModels = [
    model('m1', 'שמלת ורד', 551, [item('i1', '02'), item('i2', '04')]),
    model('m2', 'שמלת תכלת', 640, [item('i3', '12'), item('i4', '20')]),
    model('m3', 'שמלת כלה', 12, [item('i5', '32')]),
    model('m4', 'חליפה', 700, [item('i6', 'XL'), item('i7', 'M')]),
    model('m5', 'אחרת', 811, [item('i8', ' 2')]),
  ];
};
const dressIds = (r) => r.body.data.map((m) => m.id).sort();
const dget = (qs) => get(dressesRoute, '/api/dresses?' + qs);

console.log('דגמים: חיפוש חופשי');
await t('שם / הערות כמו קודם; 3 ספרות = קידומת דגם בלבד', async () => {
  dressFixture();
  assert.deepEqual(dressIds(await dget('search=' + encodeURIComponent('ורד'))), ['m1']);
  assert.deepEqual(dressIds(await dget('search=640')), ['m2']);
  assert.deepEqual(dressIds(await dget('search=')), ['m1', 'm2', 'm3', 'm4', 'm5']);
});
await t('המקום-מחזיק "שם, מקט, מידה": "2" = קידומת 2 / מידה 2 או 02 (גם " 2"), לא 12/20/32', async () => {
  dressFixture();
  assert.deepEqual(dressIds(await dget('search=2')), ['m1', 'm5']);
  assert.deepEqual(dressIds(await dget('search=02')), ['m1', 'm5']);
  assert.deepEqual(dressIds(await dget('search=12')), ['m2', 'm3'], '12 = מידה 12 או קידומת דגם 12');
  assert.deepEqual(dressIds(await dget('search=xl')), ['m4']);
  assert.deepEqual(dressIds(await dget('search=' + encodeURIComponent('מידה 2'))), ['m1', 'm5']);
});
await t('מילות מפתח: "דגם 551 מידה 4" ; "12 דגם" אינו קידומת 12', async () => {
  dressFixture();
  assert.deepEqual(dressIds(await dget('search=' + encodeURIComponent('דגם 551 מידה 4'))), ['m1']);
  assert.deepEqual(dressIds(await dget('search=' + encodeURIComponent('דגם 551 מידה 12'))), []);
  assert.deepEqual(dressIds(await dget('search=' + encodeURIComponent('12 דגם'))), []);
});
await t('ברקוד של 7 ספרות מוצא את הדגם לפי הקידומת', async () => {
  dressFixture();
  assert.deepEqual(dressIds(await dget('search=5510201')), ['m1']);
});
await t('הצלת מקלדת: "ank," (שמלת) מוצא הכל + הודעה', async () => {
  dressFixture();
  const r = await dget('search=' + encodeURIComponent('ank,'));
  assert.deepEqual(dressIds(r), ['m1', 'm2', 'm3']);
  assert.equal(r.body.notices[0].kind, 'layout');
});
await t('חיפוש מתקדם advSize מדויק', async () => {
  dressFixture();
  assert.deepEqual(dressIds(await dget('advSize=2')), ['m1', 'm5']);
  assert.deepEqual(dressIds(await dget('advSize=20')), ['m2']);
});
await t('תקרת limit: 10000 לטעינת הקטלוג של הקיוסק; מעבר לזה נחתך', async () => {
  dressFixture();
  assert.equal((await dget('limit=10000')).body.limit, 10000);
  assert.equal((await dget('limit=99999999')).body.limit, 10000);
  assert.equal((await dget('limit=zzz')).body.limit, 50);
});

// ---------------------------------------------------------------- inventory/models (בוחר דגם)
console.log('בוחר דגם: /api/inventory/models');
const mget = async (q) => (await get(modelsRoute, '/api/inventory/models' + (q === undefined ? '' : '?q=' + encodeURIComponent(q)))).body.models.map((m) => m.id).sort();
const pickerModels = () => {
  T.dressModels = [model('m1', 'שמלת ורד', 551, []), model('m2', 'שמלת תכלת', 640, []), model('m3', 'שמלה 12', 12, []), model('m4', 'ללא שם - 700', 700, [])];
};
await t('שם / קידומת ספרות / בלי q', async () => {
  pickerModels();
  assert.deepEqual(await mget('ורד'), ['m1']);
  assert.deepEqual(await mget('640'), ['m2']);
  assert.deepEqual(await mget('700'), ['m4']);
  assert.deepEqual(await mget(undefined), ['m1', 'm2', 'm3', 'm4']);
});
await t('"12 דגם" אינו קידומת 12; "12" כן; ברקוד של 7 ספרות לפי הקידומת; סימוני RTL נוקים', async () => {
  pickerModels();
  assert.deepEqual(await mget('12 דגם'), []);
  assert.deepEqual(await mget('12'), ['m3']);
  assert.deepEqual(await mget('6400203'), ['m2']);
  assert.deepEqual(await mget('‏640‎'), ['m2']);
});

// ---------------------------------------------------------------- inventory/capacity (מידה שקולה)
console.log('תפוסה: /api/inventory/capacity');
await t('size=2 מחשב מלאי גם לפריטים השמורים "02" / " 2" ולא "12"', async () => {
  const di = (id, sizeText, over = {}) => ({ id, barcodePrefix: 551, sizeText, isDeleted: false, notInUse: false, inRepair: false, location: null, quantity: 1, ...over });
  T.dressItems = [di('a', '02'), di('b', '2'), di('c', ' 2'), di('d', '12'), di('e', '20'), di('f', '02', { barcodePrefix: 640 })];
  const r = await get(capacityRoute, '/api/inventory/capacity?barcodePrefix=551&size=2&fromDate=2026-10-10&toDate=2026-10-10');
  assert.equal(r.body.inStock, 3);
  const r12 = await get(capacityRoute, '/api/inventory/capacity?barcodePrefix=551&size=12&fromDate=2026-10-10&toDate=2026-10-10');
  assert.equal(r12.body.inStock, 1);
});
await t('הזמנות תפוסות: מידה שקולה בפריט ההזמנה', async () => {
  T.dressItems = [];
  const order = (orderId) => ({ id: 'o' + orderId, orderId, eventDate: new Date('2026-10-10T00:00:00Z'), returnDate: null, eventDateHebrew: 'כ תשרי', customer: { firstName: 'רחל', lastName: 'כהן' } });
  T.orderItems = [
    { barcodePrefix: 551, size: null, sizeText: '02', dressItem: null, isDeleted: false, quantity: 1, order: { ...order(1), isDeleted: false } },
    { barcodePrefix: 551, size: null, sizeText: '12', dressItem: null, isDeleted: false, quantity: 1, order: { ...order(2), isDeleted: false } },
  ];
  const r = await get(capacityRoute, '/api/inventory/capacity?barcodePrefix=551&size=2&fromDate=2026-10-10&toDate=2026-10-10');
  assert.deepEqual(r.body.occupiedOrders.map((o) => o.orderId), [1]);
});

// ---------------------------------------------------------------- a5/options sizes
console.log('הצעות: /api/a5/options?key=size');
await t('"2" מציע גם "02" (מאוחדים לכתיב הנפוץ), ולא מכפיל; סדר מספרי', async () => {
  T.pages = new Set(['page:orders', 'page:rentals', 'page:customers']);
  T.dressItems = [
    { sizeText: '02', isDeleted: false }, { sizeText: '02', isDeleted: false }, { sizeText: '2', isDeleted: false }, { sizeText: '12', isDeleted: false },
    { sizeText: '20', isDeleted: false }, { sizeText: '22', isDeleted: false }, { sizeText: 'XL', isDeleted: false },
  ];
  const r = await get(optionsRoute, '/api/a5/options?key=size&typed=2');
  assert.deepEqual(r.body.options, ['02', '20', '22'], JSON.stringify(r.body));
  const r2 = await get(optionsRoute, '/api/a5/options?key=size&typed=02');
  assert.deepEqual(r2.body.options, ['02', '20', '22']);
});

// ---------------------------------------------------------------- a5/adv (מתקדם)
console.log('חיפוש מתקדם A5');
T.prisma.payment = { groupBy: async () => [] };
const aorder = (orderId, c, items, extra = {}) => ({ orderId, status: null, isDeleted: false, eventDate: new Date('2026-10-20T00:00:00Z'), eventDateHebrew: 'ה חשוון', fromDate: null, toDate: null, returnDate: null, totalAmount: 0, customSpacing: null, isDelivery: false, customerId: c.id, customer: c, items, ...extra });
const aitem = (sizeText, dsize = null) => ({ isDeleted: false, isTaken: false, isReturned: false, sizeText, dressItem: dsize ? { sizeText: dsize, dress: { name: 'x', barcodePrefix: 1 } } : null, barcode: null, description: null, barcodePrefix: null });
const advFixture = () => {
  customersFixture();
  const [c1, c2] = T.customers;
  T.orders = [aorder(101, c1, [aitem('02')]), aorder(102, c2, [aitem('12')]), aorder(103, c2, [aitem(null, '2')])];
};
const adv = (focus, obj) => get(advRoute, `/api/a5/adv?focus=${focus}&adv=${encodeURIComponent(JSON.stringify(obj))}`);
const links = (r) => r.body.links.map((l) => l.split('/').pop()).sort();
await t('הזמנות: size=2 מוצא "02" ו-"2" (גם בפריט הקטלוג) ולא "12"', async () => {
  advFixture(); T.pages = new Set(['page:orders']);
  assert.deepEqual(links(await adv('orders', { size: '2', ost: ['soon'] })), ['101', '103']);
  assert.deepEqual(links(await adv('orders', { size: '02', ost: ['soon'] })), ['101', '103']);
  assert.deepEqual(links(await adv('orders', { size: '12', ost: ['soon'] })), ['102']);
});
await t('הזמנות: טלפון בכל צורה (050-123-4567 / +972) מוצא את הלקוח ששמור "050-1234567"', async () => {
  advFixture(); T.pages = new Set(['page:orders']);
  for (const phone of ['0501234567', '050-123-4567', '+972501234567']) assert.deepEqual(links(await adv('orders', { phone, ost: ['soon'] })), ['101'], phone);
});
await t('לקוחות: טלפון בכל צורה + פרטי לקוח (cinfo); הזרקת מזהים מהלקוח לא עובדת', async () => {
  advFixture(); T.pages = new Set(['page:customers']);
  assert.deepEqual(links(await adv('customers', { phone: '050 123 4567' })), ['c1']);
  assert.deepEqual(links(await adv('customers', { cinfo: '0547654321' })), ['c2']);
  const r = await get(advRoute, '/api/a5/adv?focus=customers&adv=' + encodeURIComponent(JSON.stringify({ phone: '0599999999', phoneIds: { phone: ['c1'] } })));
  assert.deepEqual(r.body.links, []);
});
await t('הרשאה: בלי page:orders -> 403; adv לא-אובייקט לא מפיל', async () => {
  advFixture(); T.pages = new Set();
  assert.equal((await adv('orders', { size: '2' })).status, 403);
  T.pages = new Set(['page:orders']);
  const res = await advRoute.GET(req('/api/a5/adv?focus=orders&adv=' + encodeURIComponent('5')));
  assert.equal(res.status, 200);
});

summary('routes');
