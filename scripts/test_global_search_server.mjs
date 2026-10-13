// בדיקות השרת של החיפוש הראשי (app/api/global-search + lib/globalSearch.js + lib/homeSearchPlan.js) - בלי DB ובלי Next:
//   סדר ומדויק-קודם (מס' הזמנה), טלפון לפי ספרות (+972, phone2), הברחת LIKE, תאריך עברי/לועזי בהתאמה מדויקת (לא תת-מחרוזת),
//   סטטוס הזמנה מחושב, שורות "מלאי" לברקוד (כל המידות, קריאה אחת, בלי N+1), הרשאה (קישור ושדות מוסתרים), מילות מפתח עם מידה מדויקת ('02' = '2'),
//   צ'יפים של הלו"ז (שער page:schedule בשרת, מטמון), וגבולות המטען (LIMIT, מינימום תווים).
// הרצה: node scripts/test_global_search_server.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// המנגנון: אותו hook כמו test_search_leak_gate.mjs / test_home_adv_foci_server.mjs (כינוי '@/', מוקים ל-prisma / auth / permissions / settingsCache / inventory / schedule).
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const hooks = `
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT = ${JSON.stringify(root)};
const MOCKS = [
  [/[\\\\/]app[\\\\/]lib[\\\\/]prisma\\.js$/, 'prisma'],
  [/[\\\\/]lib[\\\\/]auth\\.js$/, 'auth'],
  [/[\\\\/]lib[\\\\/]permissions\\.js$/, 'permissions'],
  [/[\\\\/]lib[\\\\/]settingsCache\\.js$/, 'settings'],
  [/[\\\\/]lib[\\\\/]inventory\\.js$/, 'inventory'],
  [/[\\\\/]lib[\\\\/]schedule[\\\\/]index\\.js$/, 'schedule'],
];
function withExt(p) {
  for (const c of [p, p + '.js', p + '.mjs', path.join(p, 'index.js')]) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}
export async function resolve(spec, ctx, next) {
  if (spec === 'next/server') return { url: 'mock:next-server', shortCircuit: true };
  if (spec === 'next/headers') return { url: 'mock:next-headers', shortCircuit: true };
  let file = null;
  if (spec.startsWith('@/')) file = withExt(path.join(ROOT, spec.slice(2)));
  else if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL && ctx.parentURL.startsWith('file:')) {
    file = withExt(path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec));
  }
  if (file) {
    for (const [re, name] of MOCKS) if (re.test(file)) return { url: 'mock:' + name, shortCircuit: true };
    return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  const mod = (source) => ({ format: 'module', shortCircuit: true, source });
  if (url === 'mock:prisma') return mod('export default globalThis.__T.prisma;');
  if (url === 'mock:auth') return mod('const T=globalThis.__T; export const checkAuth=async()=>T.authed;');
  if (url === 'mock:permissions') return mod('const T=globalThis.__T; export const canOpenPage=async(k)=>{T.asked.push(k);return T.pages.has(k);};');
  if (url === 'mock:settings') return mod('const T=globalThis.__T; export const getCachedSetting=async(k)=>T.settings[k]!==undefined?{key:k,value:T.settings[k]}:null;');
  if (url === 'mock:inventory') return mod('const T=globalThis.__T; export const getBulkAvailableInventory=async(d,ids)=>{T.bulkCalls.push({d,ids});return T.bulk(d,ids);};');
  if (url === 'mock:schedule') return mod('const T=globalThis.__T; export const getScheduleDay=async(a)=>{T.dayCalls.push(a);return T.day;};');
  if (url === 'mock:next-server') return mod('export class NextResponse { static json(body, init){ return new Response(JSON.stringify(body), { status:(init&&init.status)||200, headers:{"content-type":"application/json"} }); } }');
  if (url === 'mock:next-headers') return mod('export const cookies=async()=>({get(){return undefined}});');
  return next(url, ctx);
}
`;
register('data:text/javascript;base64,' + Buffer.from(hooks).toString('base64'), pathToFileURL(root + path.sep));

// ---------------------------------------------------------------- מצב ומוק prisma
const T = (globalThis.__T = {
  authed: true, pages: new Set(), asked: [], settings: {}, sql: [], calls: [], bulkCalls: [], dayCalls: [],
  customers: [], orders: [], rentals: [], dressItem: null, models: [], sizeTexts: [], modelIdsBySize: [],
  bulk: () => ({}), day: null,
});
T.prisma = {
  $queryRawUnsafe: async (sql, ...params) => {
    T.sql.push({ sql, params });
    if (/FROM "Customer"/.test(sql)) return T.customers;
    if (/FROM "Order" o/.test(sql)) return T.orders;
    if (/FROM "OrderItem" oi/.test(sql)) return T.rentals;
    return [];
  },
  dressItem: {
    findFirst: async (args) => { T.calls.push(['dressItem.findFirst', args]); return T.dressItem; },
    groupBy: async (args) => {
      T.calls.push(['dressItem.groupBy', args]);
      return args.by[0] === 'sizeText' ? T.sizeTexts.map((sizeText) => ({ sizeText })) : T.modelIdsBySize.map((dressModelId) => ({ dressModelId }));
    },
  },
  dressModel: {
    findMany: async (args) => { T.calls.push(['dressModel.findMany', args]); return T.models; },
  },
};

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const reset = (pages = []) => {
  T.authed = true; T.pages = new Set(pages); T.asked = []; T.settings = {}; T.sql = []; T.calls = []; T.bulkCalls = []; T.dayCalls = [];
  T.customers = []; T.orders = []; T.rentals = []; T.dressItem = null; T.models = []; T.sizeTexts = []; T.modelIdsBySize = []; T.bulk = () => ({}); T.day = null;
  gs.__resetGlobalSearchCache();
};
const NOW = new Date('2026-10-05T09:00:00Z'); // 5.10.2026, כ"ד תשרי תשפ"ז
const run = (q, opts = {}) => gs.runGlobalSearch(q, { now: NOW, ...opts });
const sqlOf = (re) => T.sql.find((x) => re.test(x.sql));
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const RENTALS_SQL = /FROM "OrderItem" oi\s+LEFT JOIN "DressItem"/;

const gs = await import('../lib/globalSearch.js');
const route = await import('../app/api/global-search/route.js');
const { planGlobalSearch, rowLimit } = await import('../lib/homeSearchPlan.js');

// ---------------------------------------------------------------- תכנית החיפוש
console.log('תכנית חיפוש (סיווג לפי כללי הספרות)');
await t('1-4 ספרות = מס\' הזמנה; 5-6 = הזמנה קודם וברקוד שני; 7 = ברקוד; הברקוד מפורק לדגם / מידה / סידורי', () => {
  const p4 = planGlobalSearch('1234', { now: NOW });
  assert.deepEqual([p4.orderNumber, p4.barcode], [1234, null]);
  const p5 = planGlobalSearch('25734', { now: NOW });
  assert.deepEqual(p5.kinds, ['orderNumber', 'barcode']);
  assert.equal(p5.orderNumber, 25734);
  assert.equal(p5.barcode.digits, '25734');
  const p7 = planGlobalSearch('6323401', { now: NOW });
  assert.equal(p7.orderNumber, null);
  assert.deepEqual([p7.barcode.prefix, p7.barcode.size, p7.barcode.serial, p7.barcode.complete], ['632', '34', '01', true]);
  assert.ok(p7.wantsInventory);
});
await t('טלפון: מפתחות ספרות שקולים (050-123-4567 / +972) ; חלקי מזוהה', () => {
  const full = planGlobalSearch('050-123-4567', { now: NOW });
  assert.deepEqual(full.phone.equivalents, ['0501234567', '972501234567']);
  assert.equal(full.phone.partial, false);
  assert.deepEqual(planGlobalSearch('+972 50 123 4567', { now: NOW }).phone.equivalents, ['0501234567', '972501234567']);
  assert.equal(planGlobalSearch('0501', { now: NOW }).phone.partial, true);
  assert.equal(planGlobalSearch('כהן', { now: NOW }).phone, null);
});
await t('הברחת LIKE: % ו-_ בטקסט לא הופכים לתו כללי; ריק / תו בודד לא רצים', () => {
  assert.equal(planGlobalSearch('100%_א', { now: NOW }).likePattern, '%100\\%\\_א%');
  const one = planGlobalSearch('כ', { now: NOW });
  assert.ok(one.tooShort);
  assert.deepEqual(one.run, { customers: false, orders: false, rentals: false });
  assert.equal(planGlobalSearch('   ', { now: NOW }).kind, 'empty');
});
await t('תאריך עברי: "ב חשוון" (יום 2) לא תואם "כב חשוון" - regex לפי אסימונים שלמים, גרשיים וכל איותי החודש', () => {
  const p = planGlobalSearch('ב חשוון', { now: NOW });
  assert.equal(p.date.calendar, 'hebrew');
  const re = new RegExp(p.date.regex);
  const strip = (s) => s.replace(/["'׳״]/g, '');
  for (const ok of ['ב חשוון', 'ב חשון תשפ"ז', 'ב\' מרחשוון תשפז', '2 חשוון']) assert.ok(re.test(strip(ok)), ok);
  for (const bad of ['כב חשוון', 'יב חשוון', 'ב אדר', 'ב חשוונים']) assert.ok(!re.test(strip(bad)), bad);
  const full = new RegExp(planGlobalSearch('כ"ז תשרי תשפ"ז', { now: NOW }).date.regex);
  assert.ok(full.test('כז תשרי תשפז') && full.test(strip('כ"ז תשרי תשפ"ז')));
  assert.ok(!full.test('כז תשרי תשפח'));
  assert.ok(!full.test('כז תשרי'), 'שנה שהוקלדה = חובה');
});
await t('תאריך לועזי: 5/10 = 5 באוקטובר בכל שנה (לא 15/10 / 25/10); עם שנה = יום אחד', () => {
  const p = planGlobalSearch('5/10', { now: NOW });
  assert.equal(p.date.calendar, 'gregorian');
  assert.deepEqual(p.date.keys, ['2025-10-05', '2026-10-05', '2027-10-05', '2028-10-05']);
  assert.equal(p.date.key, '2026-10-05');
  assert.ok(!p.date.keys.some((k) => k.endsWith('-15') || k.endsWith('-25')));
  assert.deepEqual(planGlobalSearch('05/10/2026', { now: NOW }).date.keys, ['2026-10-05']);
  assert.equal(p.run.customers, false, 'תאריך שאינו עמום לא מחפש שמות');
  assert.equal(p.run.orders, true);
});
await t('תאריך עברי: מועמדים גרגוריאניים לפי השנה העברית; יום קרוב להיום; אדר בשנה מעוברת = שני החודשים', () => {
  const p = planGlobalSearch('כז תשרי', { now: NOW });
  assert.equal(p.date.key, '2026-10-08');
  assert.ok(p.date.keys.includes('2027-09-30') || p.date.keys.length >= 3);
  const adar = planGlobalSearch('י"ד אדר', { now: NOW });
  assert.ok(adar.date.keys.length >= 4, 'שנה מעוברת (תשפ"ח) תורמת שני תאריכים');
  assert.equal(planGlobalSearch('ניסן', { now: NOW }).date.key, null, 'חודש בלבד = אין יום ללו"ז');
});
await t('מילות מפתח: "מידה 2 דגם 3" - מידה מדויקת (02 = 2), דגם = קידומת; מה שנשאר והוא תאריך = תאריך הזמינות', () => {
  const p = planGlobalSearch('מידה 02 דגם 3', { now: NOW });
  assert.deepEqual(p.keywords.sizeSpellings, ['2', '02', '002']);
  assert.equal(p.keywords.sizeKey, '2');
  assert.equal(p.keywords.model, '3');
  assert.deepEqual(p.run, { customers: false, orders: false, rentals: false }, 'בלי טקסט חופשי לא רצות שאילתות שמות');
  const d = planGlobalSearch('דגם 3 מידה 2 כז תשרי', { now: NOW });
  assert.equal(d.date.key, '2026-10-08');
  assert.equal(d.text, '');
  const withName = planGlobalSearch('מידה 36 שרה', { now: NOW });
  assert.equal(withName.text, 'שרה');
  assert.equal(withName.run.customers, true);
});
await t('גבול שורות: 50; שאילתת טקסט של 2 תווים = 20 (מטען קטן)', () => {
  assert.equal(rowLimit(planGlobalSearch('כהן', { now: NOW })), 50);
  assert.equal(rowLimit(planGlobalSearch('כה', { now: NOW })), 20);
  assert.equal(rowLimit(planGlobalSearch('12', { now: NOW })), 50);
});

// ---------------------------------------------------------------- שאילתות SQL
console.log('שאילתות SQL: מדויק-קודם, טלפון, הברחה, תאריך');
await t('מס\' הזמנה מדויק: ORDER BY שם אותו ראשון, והפרמטר $2 הוא המספר; ברקוד בן 7 ספרות לא מחפש הזמנה', async () => {
  reset();
  await run('25734');
  const o = norm(sqlOf(/FROM "Order" o/).sql);
  assert.ok(o.includes('ORDER BY CASE WHEN o."orderId" = $2 THEN 0 ELSE 1 END, "isExactMatch" DESC'), o);
  assert.equal(sqlOf(/FROM "Order" o/).params[1], 25734);
  reset();
  await run('6323401');
  assert.equal(sqlOf(/FROM "Order" o/).params[1], -1, '7 ספרות = ברקוד, לא מס\' הזמנה');
  assert.ok(!/CASE WHEN o\."orderId" = \$2/.test(sqlOf(/FROM "Order" o/).sql));
});
await t('טלפון בכל צורה: מזהי לקוחות בשאילתה קטנה אחת (regexp רק על Customer, ORDER BY id, LIMIT 300+1), והשאילתות הראשיות מסננות לפי customerId = ANY - בלי regexp_replace על שורות ההזמנה', async () => {
  reset();
  T.customers = [{ id: 'cx1' }, { id: 'cx2' }];
  await run('050-123-4567');
  const ids = T.sql[0];
  const s0 = norm(ids.sql);
  assert.ok(s0.startsWith('SELECT "id" FROM "Customer" WHERE (regexp_replace(') && s0.includes('IN ($1, $2)') && s0.includes('"phone2"'), s0);
  assert.ok(s0.endsWith('ORDER BY "id" LIMIT 301'), s0);
  assert.deepEqual(ids.params, ['0501234567', '972501234567']);
  for (const re of [/FROM "Customer" WHERE "isDeleted"/, /FROM "Order" o/]) {
    const q = T.sql.find((x) => re.test(norm(x.sql)));
    const s = norm(q.sql);
    assert.ok(!/regexp_replace\(COALESCE\((c\.)?phone/.test(s), 'אין regexp_replace על טלפון בשאילתה הראשית: ' + s.slice(0, 200));
    assert.ok(s.includes(re.source.includes('Customer') ? '"id" = ANY($' : 'o."customerId" = ANY($'), s);
    assert.ok(q.params.some((p) => Array.isArray(p) && p.join() === 'cx1,cx2'), 'מזהי הלקוחות כפרמטר מערך');
  }
  assert.ok(norm(sqlOf(/FROM "Order" o/).sql).includes('c.phone2 LIKE $1'), 'phone2 גם בהתאמה הרגילה של הזמנות');
});
await t('טלפון חלקי: מ-5 ספרות בלבד מחפשים לפי ספרות; 4 ספרות - רק ה-LIKE הרגיל (בלי שאילתת מזהים)', async () => {
  reset();
  await run('0501');
  assert.ok(!T.sql.some((x) => /regexp_replace/.test(x.sql)), '4 ספרות: אין סריקת טלפונים');
  reset();
  await run('05012');
  const ids = T.sql[0];
  assert.ok(/regexp_replace/.test(ids.sql) && ids.params.includes('%05012%') && ids.params.includes('%9725012%'), '5 ספרות: חלקי + צורה בינלאומית');
});
await t('איחוד עם הרשימות: 9 ספרות בלי 0 מוביל = טלפון; טלפון חלקי מתאים גם לצורה הבינלאומית (972)', async () => {
  reset();
  await run('501234567');
  const q = T.sql[0];
  assert.ok(q.params.includes('0501234567') && q.params.includes('972501234567'), '9 ספרות בלי 0 = 0501234567');
  reset();
  await run('050123');
  const p = T.sql[0].params;
  assert.ok(p.includes('%050123%') && p.includes('%97250123%'), 'חלקי: גם %972...%');
});
await t('הטקסט שהוקלד לא נכנס ל-SQL (פרמטרים בלבד) והברחת % / _', async () => {
  reset();
  await run('100%_x');
  for (const q of T.sql) assert.ok(!q.sql.includes('100%_x'));
  assert.equal(T.sql[0].params[0], '%100\\%\\_x%');
});
await t('תאריך עברי להזמנות: regex על eventDateHebrew בלי גרשיים + טווחי יום ישראלי; לא LIKE תת-מחרוזת; לא נשאלים לקוחות / פריטים', async () => {
  reset();
  await run('ב חשוון');
  assert.equal(T.sql.length, 1, 'רק שאילתת הזמנות');
  const q = T.sql[0];
  const s = norm(q.sql);
  assert.ok(s.includes(`regexp_replace(COALESCE(o."eventDateHebrew", ''), '["״׳'']', '', 'g') ~ $`), s);
  assert.ok(!/o\."eventDateHebrew" LIKE/.test(s), 'אין LIKE תת-מחרוזת לתאריך');
  assert.ok(q.params.some((p) => typeof p === 'string' && p.startsWith('^(?:ב|2) (?:חשוון')));
  const dates = q.params.filter((p) => p instanceof Date);
  assert.ok(dates.length >= 6 && dates.length % 2 === 0, 'טווחי יום (start,end) לכל שנה מועמדת');
  assert.ok(dates.every((d, i) => (i % 2 ? d > dates[i - 1] : true)));
});
await t('תאריך לועזי 5/10: טווחי היום הישראלי של 11 שנים (אותו חלון כמו רשימת ההזמנות), בלי TO_CHAR LIKE', async () => {
  reset();
  await run('5/10');
  const q = T.sql[0];
  assert.equal(T.sql.length, 1);
  assert.ok(!/TO_CHAR/.test(q.sql));
  const dates = q.params.filter((p) => p instanceof Date);
  assert.equal(dates.length, 22, 'השנה-8 עד השנה+2 (lib/listSearch.js gregorianDateOrderAlternatives)');
  // יום 5.10.2026 בישראל מתחיל ב-4.10 21:00 UTC (שעון קיץ UTC+3)
  const i26 = dates.findIndex((d) => d.toISOString() === '2026-10-04T21:00:00.000Z');
  assert.ok(i26 >= 0 && i26 % 2 === 0);
  assert.equal(dates[i26 + 1].toISOString(), '2026-10-05T20:59:59.999Z');
});
await t('גבולות: LIMIT 50 רגיל, 20 לשאילתה של 2 תווים; תו בודד = בלי שאילתות', async () => {
  reset();
  await run('כהן');
  for (const q of T.sql) assert.match(norm(q.sql), /LIMIT 50$/);
  reset();
  await run('כה');
  for (const q of T.sql) assert.match(norm(q.sql), /LIMIT 20$/);
  reset();
  const r = await run('כ');
  assert.equal(T.sql.length, 0);
  assert.deepEqual(r, { customers: [], orders: [], rentals: [] });
});
await t('ברקוד ב-7 ספרות: פריטים שמושכרים עכשיו קודם; לא ברקוד = לפי תאריך יצירה', async () => {
  reset();
  await run('6323401');
  assert.ok(norm(sqlOf(RENTALS_SQL).sql).includes('ORDER BY CASE WHEN oi."isTaken" AND NOT oi."isReturned" THEN 0 ELSE 1 END'));
  reset();
  await run('כהן');
  assert.ok(norm(sqlOf(RENTALS_SQL).sql).includes('ORDER BY oi."createdAt" DESC'));
});

// ---------------------------------------------------------------- סטטוס מחושב
console.log('סטטוס הזמנה מחושב');
const future = new Date('2026-12-01T00:00:00Z');
const past = new Date('2026-09-01T00:00:00Z');
const order = (extra) => ({ id: 'u', orderId: 1, customerId: 'c', status: '', totalAmount: 0, eventDate: future, eventDateHebrew: 'x', firstName: 'א', lastName: 'ב', itemCount: '2', isExactMatch: true, fuzzyScore: 0, ...extra });
await t('הושכר / הוחזר / הוחזר חלקי / הושכר חלקי / בקרוב / עבר - כמו calculateOrderStatus; itemStats לא דולף; status השמור נשאר', async () => {
  reset();
  T.orders = [
    order({ orderId: 1, status: 'מושכר', itemStats: { n: 2, all: 2, taken: 2, returned: 0 } }),
    order({ orderId: 2, itemStats: { n: 2, all: 2, taken: 2, returned: 2 } }),
    order({ orderId: 3, itemStats: { n: 2, all: 2, taken: 2, returned: 1 } }),
    order({ orderId: 4, itemStats: { n: 2, all: 2, taken: 1, returned: 0 } }),
    order({ orderId: 5, itemStats: { n: 2, all: 2, taken: 0, returned: 0 } }),
    order({ orderId: 6, eventDate: past, itemStats: { n: 2, all: 2, taken: 0, returned: 0 } }),
    order({ orderId: 7, itemStats: { n: 0, all: 2, taken: 0, returned: 0 } }),
    order({ orderId: 8, itemStats: null }),
  ];
  const r = await run('כהן');
  assert.deepEqual(r.orders.map((o) => o.computedStatus), ['הושכר', 'הוחזר', 'הוחזר חלקי', 'הושכר חלקי', 'בקרוב', 'עבר', 'מחוק', 'בקרוב']);
  assert.equal(r.orders[0].status, 'מושכר', 'השדה השמור נשמר לצרכנים ישנים');
  assert.ok(r.orders.every((o) => !('itemStats' in o)));
  assert.equal(r.orders[0].itemCount, 2);
});
await t('טיוטה: מוצגת "מחוק" כשההגדרה draft_orders_show_as_deleted פעילה (ברירת מחדל), אחרת "טיוטה"', async () => {
  reset();
  T.orders = [order({ orderId: 9, status: 'טיוטה', itemStats: { n: 1, all: 1, taken: 0, returned: 0 } })];
  assert.equal((await run('כהן')).orders[0].computedStatus, 'מחוק');
  reset();
  T.settings.draft_orders_show_as_deleted = 'false';
  T.orders = [order({ orderId: 9, status: 'טיוטה', itemStats: { n: 1, all: 1, taken: 0, returned: 0 } })];
  assert.equal((await run('כהן')).orders[0].computedStatus, 'טיוטה');
});

// ---------------------------------------------------------------- extras: שורות "מלאי" הוסרו (12.10.2026)
console.log('שורות "מלאי" הוסרו (הוחלפו בפאנל התפוסה / הפריט: lib/searchPanel.js)');
const MODEL = { id: 'm-632', name: 'שמלת ורד', barcodePrefix: 632, isDeleted: false };
const ITEM = { id: 'di1', dressBarcode: '6323401', sizeText: '34', serialNumber: 1, location: 'מדף 7', inRepair: false, notInUse: false, dress: MODEL };
const BULK = (d, ids) => ({ 'm-632': { '30': { available: 1, total: 2, booked: 1 }, '34': { available: 0, total: 1, booked: 1 }, '6': { available: 1, total: 1, booked: 0 }, '06': { available: 2, total: 2, booked: 0 }, '12': { available: 1, total: 1, booked: 0 } } });
await t('extras: אין inventory / inventoryTruncated, ולא נקרא מנוע המלאי - לא לברקוד, לא למילות מפתח; ההשכרות והפריטים של הברקוד עדיין חוזרים', async () => {
  reset(['page:dresses_catalog']);
  T.dressItem = ITEM; T.bulk = BULK;
  T.rentals = [{ id: 'oi1', orderId: 500, barcode: '6323401', sizeText: '34', isTaken: true, isReturned: false }];
  for (const q of ['6323401', 'מידה 02 דגם 3', 'דגם 511,455 מידה 4', 'ברקוד 6323401']) {
    const r = await run(q, { extras: true });
    assert.ok(!('inventory' in r), q);
    assert.ok(!('inventoryTruncated' in r), q);
    assert.equal(T.bulkCalls.length, 0, q + ': לא נקרא getBulkAvailableInventory');
    assert.deepEqual(Object.keys(r).sort(), ['customers', 'dateChips', 'notices', 'orders', 'rentals'], q);
  }
  const r = await run('6323401', { extras: true });
  assert.equal(r.rentals.length, 1);
  assert.equal(r.rentals[0].isTaken, true);
});
await t('בלי extras: אותו מבנה כמו תמיד (customers / orders / rentals), בלי הלו"ז ובלי מלאי', async () => {
  reset(['page:dresses_catalog', 'page:schedule']);
  T.dressItem = ITEM; T.bulk = BULK;
  const r = await run('6323401');
  assert.deepEqual(Object.keys(r).sort(), ['customers', 'orders', 'rentals']);
  assert.equal(T.bulkCalls.length, 0);
  assert.equal(T.calls.length, 0);
});

// ---------------------------------------------------------------- extras: צ'יפים של הלו"ז
console.log('מילות מפתח: תאריך עברי = המופע הקרוב מהיום, כמה דגמים / מידות, תווית עברית');
const { HDate } = await import('@hebcal/core');
const greg = (d, m, y) => { const g = new HDate(d, m, y).greg(); return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`; };
const at = (iso) => new Date(iso + 'T09:00:00Z');
await t('תאריך הזמינות = המופע הקרוב מהיום והלאה (היום נחשב); עם / בלי המילה "תאריך"; כל הכתיבים', () => {
  // היום 6.10.2026 = כ"ה תשרי תשפ"ז (5787, שנה מעוברת)
  const d = (q, today = '2026-10-06') => planGlobalSearch(q, { now: at(today) }).date;
  const wantCheshvan20 = greg(20, 8, 5787); // 2026-10-31
  assert.equal(wantCheshvan20, '2026-10-31');
  for (const q of ['מידה 4 תאריך כ חשוון', 'מידה 4 כ חשוון', 'מידה 4 תאריך כ׳ חשוון', "מידה 4 כ' חשוון", 'דגם 3 מידה 4 תאריך כ חשון']) assert.equal(d(q).key, wantCheshvan20, q);
  assert.equal(d('מידה 4 ב חשוון').key, greg(2, 8, 5787), 'ב חשוון = היום השני');
  assert.equal(d('מידה 4 כ״ב חשוון').key, greg(22, 8, 5787));
  assert.equal(d('מידה 4 ט״ו בשבט').key, greg(15, 11, 5787));
  assert.equal(d('מידה 4 תאריך ט"ו בשבט').key, greg(15, 11, 5787));
  // תאריך שכבר עבר השנה -> השנה הבאה (לא הקרוב-ביותר שבעבר): כ תשרי ב-6.10.2026 = כ תשרי תשפ"ח
  assert.equal(d('מידה 4 כ תשרי').key, greg(20, 7, 5788));
  assert.equal(greg(20, 7, 5788) > '2026-10-06', true);
  // היום עצמו נחשב (כ חשוון, ב-31.10.2026); יום אחרי = השנה הבאה
  assert.equal(d('מידה 4 כ חשוון', '2026-10-31').key, '2026-10-31');
  assert.equal(d('מידה 4 כ חשוון', '2026-11-01').key, greg(20, 8, 5788));
  // שנה מפורשת: אותה שנה בלבד (גם אם עברה)
  assert.equal(d('מידה 4 כ חשוון תשפ״ז').key, wantCheshvan20);
  assert.equal(d('מידה 4 כ חשוון תשפ״ו').key, greg(20, 8, 5786), 'שנה מפורשת שעברה: אין מופע עתידי - התאריך עצמו');
});
await t('אדר בשנה מעוברת / פשוטה: המופע הקרוב', () => {
  const d = (q, today) => planGlobalSearch(q, { now: at(today) }).date;
  // 5787 מעוברת: אדר א' ואדר ב'. "יד אדר" = הקרוב מביניהם
  assert.equal(d('מידה 4 יד אדר', '2027-01-15').key, greg(14, 12, 5787), "לפני אדר א': אדר א'");
  assert.equal(d('מידה 4 יד אדר', '2027-03-01').key, greg(14, 13, 5787), "אחרי אדר א': אדר ב'");
  assert.equal(d('מידה 4 יד אדר ב', '2027-03-01').key, greg(14, 13, 5787));
  assert.equal(d('מידה 4 יד אדר א', '2027-01-15').key, greg(14, 12, 5787));
  // 5788 פשוטה: אדר אחד; "אדר ב" רק בשנה מעוברת הבאה (5790)
  assert.equal(d('מידה 4 יד אדר', '2028-01-10').key, greg(14, 12, 5788));
  assert.equal(d('מידה 4 יד אדר ב', '2028-01-10').key, greg(14, 13, 5790));
});
await t('התאריך נפתר לפי היום הישראלי של now (לא אזור הזמן של התהליך)', () => {
  // 23:30 UTC ב-5.10.2026 = 02:30 ב-6.10 בישראל: "כה תשרי" = היום (6.10), לא שנה הבאה
  const now = new Date('2026-10-05T23:30:00Z');
  assert.equal(planGlobalSearch('מידה 4 כה תשרי', { now }).date.key, '2026-10-06');
  assert.equal(planGlobalSearch('מידה 4 כ חשוון', { now }).date.key, '2026-10-31');
});
await t('תווית עברית לכותרת הזמינות: "יום ד׳ י״ז חשוון תשפ״ז" / "שבת כ׳ חשוון תשפ״ז"; בלי ספרות לועזיות', () => {
  assert.equal(gs.hebrewDateLabel('2026-10-28'), 'יום ד׳ י״ז חשוון תשפ״ז');
  assert.equal(gs.hebrewDateLabel('2026-10-31'), 'שבת כ׳ חשוון תשפ״ז');
  assert.equal(gs.hebrewDateLabel('2027-03-12'), 'יום ו׳ ג׳ אדר ב׳ תשפ״ז');
  assert.equal(gs.hebrewDateLabel('2026-10-06'), 'יום ג׳ כ״ה תשרי תשפ״ז');
  for (const k of ['2026-10-28', '2026-10-31', '2027-03-12']) assert.ok(!/\d/.test(gs.hebrewDateLabel(k)), 'אין ספרות לועזיות בתווית');
});
await t('שמות ו"ו": "ורד כהן" / "ויקי" / "ו455" לא מחפשים מילת מפתח', async () => {
  for (const q of ['ורד כהן', 'ויקי', 'ו455', 'דבורה ושרה']) {
    reset([]);
    const p = planGlobalSearch(q, { now: NOW });
    assert.equal(p.keywords, null, q); assert.equal(p.wantsInventory, false, q);
    const r = await run(q, { extras: true });
    assert.ok(!('inventory' in r), q); assert.equal(T.bulkCalls.length, 0, q);
  }
});

await t('אדר א׳ / ב׳ מפורש שאין לו מופע בחלון הרגיל: החלון מורחב עד 4 שנים קדימה', () => {
  const d = (q, today) => planGlobalSearch(q, { now: at(today) }).date;
  // 10.4.2027 (5787, אחרי אדר ב׳): אדר ב׳ הבא הוא 5790 (14 אדר ב׳ תשץ = 19.3.2030)
  assert.equal(d('מידה 4 יד אדר ב', '2027-04-10').key, greg(14, 13, 5790));
  assert.equal(d('מידה 4 יד אדר ב', '2027-04-10').key, '2030-03-19');
  assert.equal(d('מידה 4 יד אדר א', '2027-04-10').key, greg(14, 12, 5790));
  assert.equal(d('מידה 4 יד אדר ב', '2030-04-01').key, greg(14, 13, 5793), 'אחרי אדר ב׳ 5790 - 5793');
  assert.equal(planGlobalSearch('מידה 4 יד אדר ב', { now: at('2027-04-10') }).dateInvalid, false);
});
await t('יום שלא קיים בחודש (שנה מפורשת / אדר בלי א׳ ב׳): dateInvalid + הודעה "התאריך לא קיים בחודש הזה", בלי מלאי להיום', async () => {
  for (const q of ['מידה 4 ל חשוון תשפו', 'מידה 4 תאריך ל חשוון תשפ״ו', 'מידה 4 ל אדר', 'דגם 3 ל אייר']) {
    reset([]);
    T.models = [{ id: 'm-5', name: 'חמש', barcodePrefix: 5 }]; T.sizeTexts = ['04']; T.modelIdsBySize = ['m-5']; T.bulk = () => ({ 'm-5': { '04': { available: 1, total: 1, booked: 0 } } });
    const p = planGlobalSearch(q, { now: NOW });
    assert.equal(p.dateInvalid, true, q);
    const r = await run(q, { extras: true });
    assert.ok(!('inventory' in r), q); assert.equal(T.bulkCalls.length, 0, q);
    assert.deepEqual(r.notices, [{ kind: 'dateInvalid', text: 'התאריך לא קיים בחודש הזה' }], q);
  }
  // תקף: אין הודעה
  reset([]);
  assert.equal(planGlobalSearch('מידה 4 ל חשוון', { now: NOW }).dateInvalid, false, 'בלי שנה: 30 חשוון קיים בחלק מהשנים');
  assert.equal(planGlobalSearch('מידה 4 ל אדר א', { now: NOW }).dateInvalid, false, 'אדר א׳ = 30 יום');
  // בלי מילות מפתח: "ל חשוון תשפו" - הודעה; חיפוש הזמנות לא מחזיר "הכול"
  reset([]);
  const r2 = await run('ל חשוון תשפו', { extras: true });
  assert.deepEqual(r2.notices.map((n) => n.kind), ['dateInvalid']);
  assert.deepEqual(r2.orders, []);
});
await t('הודעות: רק "תאריך לא קיים" נשארה (נחתך / ערכים נזרקו שייכים לשורות המלאי שהוסרו); בלי notices בלי extras', async () => {
  reset([]);
  T.models = Array.from({ length: 25 }, (_, i) => ({ id: 'm' + i, name: 'ד' + i, barcodePrefix: 100 + i }));
  const r = await run('דגם ד', { extras: true });
  assert.deepEqual(r.notices, []);
  assert.equal('notices' in (await run('דגם ד')), false, 'בלי extras אין notices (תאימות לצרכנים ישנים)');
  const many = 'מידה 34 דגם ' + Array.from({ length: 12 }, (_, i) => i + 1).join(',');
  assert.deepEqual((await run(many, { extras: true })).notices, []);
});

console.log('צ\'יפים של הלו"ז');
const DAY = {
  date: '2026-10-08', dateHebrew: 'כ״ז תשרי תשפ״ז', weekday: 'יום חמישי', nonWorkingDay: false, dayStatus: { titles: [] },
  stages: [
    { key: 'prep', label: 'הכנה', plural: 'הכנות', enabled: true, infoOnly: false, counts: { total: 4, pending: 3, alerts: 1 } },
    { key: 'dout', label: 'משלוח הלוך', plural: 'משלוחי הלוך', enabled: true, infoOnly: false, counts: { total: 0, pending: 0, alerts: 0 } },
    { key: 'pick', label: 'איסוף מקומי', plural: 'איסופים מקומיים', enabled: false, infoOnly: false, counts: { total: 5, pending: 5, alerts: 0 } },
    { key: 'event', label: 'אירוע', plural: 'אירועים', enabled: true, infoOnly: true, counts: { total: 7, pending: 0, alerts: 0 } },
  ],
};
await t('בלי page:schedule: לא נטען לו"ז ולא נשלחים מונים (dateChips = null)', async () => {
  reset([]);
  T.day = DAY;
  const r = await run('כז תשרי', { extras: true });
  assert.equal(r.dateChips, null);
  assert.equal(T.dayCalls.length, 0);
  assert.ok(T.asked.includes('page:schedule'));
  assert.ok(!JSON.stringify(r).includes('הכנות'));
});
await t('עם page:schedule: צ\'יפ לכל שלב פעיל עם פריטים (לא כבוי / ריק), קישור /schedule?date=, יום לועזי אחד, בלי "מי במשמרת"', async () => {
  reset(['page:schedule']);
  T.day = DAY;
  const r = await run('כז תשרי', { extras: true });
  assert.equal(T.dayCalls.length, 1);
  assert.deepEqual([T.dayCalls[0].date, T.dayCalls[0].skipStaff, T.dayCalls[0].user], ['2026-10-08', true, null]);
  assert.deepEqual(r.dateChips.chips.map((c) => [c.key, c.label, c.total, c.alerts, c.infoOnly]), [['prep', 'הכנות', 4, 1, false], ['event', 'אירועים', 7, 0, true]]);
  assert.equal(r.dateChips.link, '/schedule?date=2026-10-08');
  assert.equal(r.dateChips.dateHebrew, 'כ״ז תשרי תשפ״ז');
  // ההזמנות של אותו יום מגיעות גם הן (שאילתת הזמנות רצה)
  assert.ok(sqlOf(/FROM "Order" o/));
});
await t('מטמון קצר: אותו יום פעמיים = חישוב אחד; יום אחר = חישוב נוסף', async () => {
  reset(['page:schedule']);
  T.day = DAY;
  await run('כז תשרי', { extras: true });
  await run('כ"ז תשרי', { extras: true });
  assert.equal(T.dayCalls.length, 1);
  await run('5/10', { extras: true });
  assert.equal(T.dayCalls.length, 2);
});
await t('לו"ז נופל / תאריך מחוץ לטווח: התוצאות הרגילות חוזרות (לא 500)', async () => {
  reset(['page:schedule']);
  T.orders = [order({ orderId: 3, itemStats: { n: 1, all: 1, taken: 0, returned: 0 } })];
  const mod = await import('../lib/globalSearch.js');
  const r = await mod.runGlobalSearch('כז תשרי', { extras: true, now: NOW, deps: { getDay: async () => async () => { throw new Error('boom'); } } });
  assert.equal(r.dateChips, null);
  assert.equal(r.orders.length, 1);
});
await t('חודש בלבד ("תשרי"): אין יום -> אין צ\'יפים (ההזמנות של החודש נשארות)', async () => {
  reset(['page:schedule']);
  T.day = DAY;
  const r = await run('חודש תשרי', { extras: true });
  assert.equal(r.dateChips, null);
  assert.equal(T.dayCalls.length, 0);
});

// ---------------------------------------------------------------- ה-route
console.log('route');
const req = (qs) => new Request('http://localhost/api/global-search?' + qs);
await t('route: 401 בלי התחברות; q ריק = שלוש רשימות ריקות; extras רק עם extras=1', async () => {
  reset([]); T.authed = false;
  assert.equal((await route.GET(req('q=x'))).status, 401);
  T.authed = true;
  assert.deepEqual(await (await route.GET(req(''))).json(), { customers: [], orders: [], rentals: [] });
  T.dressItem = ITEM; T.bulk = BULK;
  const plain = await (await route.GET(req('q=' + encodeURIComponent('6323401')))).json();
  assert.ok(!('inventory' in plain));
  const ex = await (await route.GET(req('q=' + encodeURIComponent('6323401') + '&extras=1'))).json();
  assert.ok(!('inventory' in ex));
  assert.ok('dateChips' in ex);
});
await t('route: שגיאת DB = 500 עם הודעה כללית (בלי פרטי שגיאה)', async () => {
  reset([]);
  const orig = T.prisma.$queryRawUnsafe;
  T.prisma.$queryRawUnsafe = async () => { throw new Error('secret db detail'); };
  const res = await route.GET(req('q=' + encodeURIComponent('כהן')));
  T.prisma.$queryRawUnsafe = orig;
  assert.equal(res.status, 500);
  assert.ok(!(await res.text()).includes('secret'));
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', FAILURES' : ''));
