// בדיקת אבטחה ל-/api/global-search, /api/a5/adv ו-/api/a5/options (בלי DB, בלי Next, בלי תלויות):
//   1) global-search: ה-SQL של שלוש השאילתות הוא רשימת עמודות מפורשת (אין SELECT * / o.* / oi.*),
//      אף עמודה רגישה (zeout, bank*, hok*, email, הערות פנימיות...) לא מופיעה בבחירה, והעמודות שהצרכנים
//      באמת קוראים (app/page.js, TopbarSearch, public/a5/adapters) כן קיימות.
//   2) adv + options: בלי הרשאת העמוד המתאים -> 403 (ובלי שאילתה ל-DB); עם הרשאה -> לא 403.
// הרצה: node scripts/test_search_leak_gate.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// המנגנון: hook של טעינת מודולים ממפה את הכינוי '@/' לשורש הריפו ומחליף את prisma / lib/auth /
// lib/permissions / next/server במוקים שהבדיקה שולטת בהם (globalThis.__T).
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
  if (url === 'mock:prisma') return { format: 'module', shortCircuit: true, source: 'export default globalThis.__T.prisma;' };
  if (url === 'mock:auth') return { format: 'module', shortCircuit: true, source: 'const T=globalThis.__T; export const HEAD_MANAGEMENT_ROLES=[0,2]; export const checkAuth=async()=>T.authed; export const checkPageAccess=async()=>T.head; export const getSessionEmployee=async()=>T.head?{roleId:0}:{roleId:3};' };
  if (url === 'mock:permissions') return { format: 'module', shortCircuit: true, source: 'const T=globalThis.__T; export const canOpenPage=async(k)=>{T.asked.push(k);return T.pages.has(k);}; export const canOpenAnyPage=async(ks)=>{T.asked.push(ks.join("|"));return ks.some((k)=>T.pages.has(k));};' };
  if (url === 'mock:next-server') return { format: 'module', shortCircuit: true, source: 'export class NextResponse { static json(body, init){ return new Response(JSON.stringify(body), { status:(init&&init.status)||200, headers:{"content-type":"application/json"} }); } }' };
  if (url === 'mock:next-headers') return { format: 'module', shortCircuit: true, source: 'export const cookies=async()=>({get(){return undefined}});' };
  return next(url, ctx);
}
`;
register('data:text/javascript;base64,' + Buffer.from(hooks).toString('base64'), pathToFileURL(root + path.sep));

// ---- מוק prisma: כל מתודה מחזירה [] ; $queryRawUnsafe מתעד SQL ופרמטרים ----
const T = (globalThis.__T = { authed: true, head: false, pages: new Set(), asked: [], sql: [], dbCalls: 0 });
const deep = () => new Proxy(function () {}, {
  get: (_t, p) => (p === 'then' ? undefined : deep()),
  apply: async () => { T.dbCalls++; return []; },
});
T.prisma = new Proxy({}, {
  get: (_t, p) => {
    if (p === '$queryRawUnsafe') return async (sql, ...params) => { T.sql.push({ sql, params }); T.dbCalls++; return []; };
    if (p === 'then') return undefined;
    return deep();
  },
});

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const req = (url) => new Request('http://localhost' + url);
const reset = (pages = [], opts = {}) => { T.authed = opts.authed ?? true; T.head = !!opts.head; T.pages = new Set(pages); T.asked = []; T.sql = []; T.dbCalls = 0; };

const gs = await import('../app/api/global-search/route.js');
const adv = await import('../app/api/a5/adv/route.js');
const opt = await import('../app/api/a5/options/route.js');

// ---------------------------------------------------------------- global-search
console.log('global-search: רשימת עמודות מפורשת');
const SENSITIVE = ['zeout', 'bankName', 'bankBranch', 'bankAccount', 'bankAccountName', 'hokBankName', 'hokBankBranch', 'hokBankAccount',
  'hokDetails', 'internalNotes', 'officeNotes', 'blockedReason', 'email', 'notes', 'orderNotes', 'street', 'houseNum', 'address'];
// הבחירה = הטקסט שבין SELECT לבין FROM הראשון ברמה העליונה (תתי-שאילתות בסוגריים מוחלפות)
function selectList(sql) {
  let depth = 0; let out = ''; let i = sql.search(/SELECT/i) + 6;
  for (; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && /^\s+FROM\s/i.test(sql.slice(i))) break;
    if (depth === 0) out += ch;
  }
  return out;
}
let captured;
await t('GET מחזיר 3 שאילתות ו-200', async () => {
  reset(['page:customers']);
  const res = await gs.GET(req('/api/global-search?q=' + encodeURIComponent('כהן')));
  assert.equal(res.status, 200);
  captured = T.sql.slice();
  assert.equal(captured.length, 3);
});
const kinds = ['customers', 'orders', 'rentals'];
const REQUIRED = {
  customers: ['"id"', '"firstName"', '"lastName"', '"phone1"', '"city"'],
  orders: ['o."id"', 'o."orderId"', 'o."status"', 'o."totalAmount"', 'o."eventDateHebrew"', 'c."firstName"', 'c."lastName"', '"itemCount"'],
  // o.eventDate/eventDateHebrew + c.firstName/lastName (4.10.2026): ברקוד חוזר בהשכרות רבות — השורה בדף הבית מציגה גם לקוחה ותאריך אירוע
  rentals: ['oi."id"', 'oi."orderId"', 'oi."barcode"', 'oi."sizeText"', 'oi."description"', 'oi."isTaken"', 'oi."isReturned"', '"catalogName"', '"catalogBarcode"',
    'o."eventDate"', 'o."eventDateHebrew"', 'c."firstName"', 'c."lastName"'],
};
for (let k = 0; k < 3; k++) {
  await t(`${kinds[k]}: אין * בבחירה`, () => {
    const sel = selectList(captured[k].sql);
    assert.ok(!/\*/.test(sel.replace(/COUNT\(\*\)/gi, '')), 'נמצא * בבחירה: ' + sel);
  });
  await t(`${kinds[k]}: אף עמודה רגישה לא נבחרת`, () => {
    const sel = selectList(captured[k].sql);
    for (const col of SENSITIVE) assert.ok(!new RegExp('["\\.\\s,]' + col + '["\\s,]', 'i').test(' ' + sel + ' '), 'עמודה רגישה בבחירה: ' + col);
  });
  await t(`${kinds[k]}: כל העמודות שהצרכנים קוראים קיימות`, () => {
    const sel = selectList(captured[k].sql);
    for (const col of REQUIRED[kinds[k]]) assert.ok(sel.includes(col), 'חסרה עמודה: ' + col);
  });
  await t(`${kinds[k]}: השאילתה נשארת פרמטרית (הטקסט שהוקלד לא בתוך ה-SQL)`, () => {
    assert.ok(!captured[k].sql.includes('כהן'));
    assert.ok(captured[k].params.includes('%כהן%'));
  });
}
await t('לקוחות: הבחירה היא בדיוק id/שם/טלפונים/עיר + שני שדות הדירוג', () => {
  const cols = selectList(captured[0].sql).split(/COALESCE/)[0].split(',').map((x) => x.trim()).filter(Boolean);
  assert.deepEqual(cols, ['"id"', '"firstName"', '"lastName"', '"phone1"', '"phone2"', '"city"']);
});
await t('השכרות: הבחירה היא בדיוק העמודות המוכרות (לא נוספה עמודה בלי צרכן)', () => {
  const cols = selectList(captured[2].sql).split(',').map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
  assert.deepEqual(cols, ['oi."id"', 'oi."orderId"', 'oi."barcode"', 'oi."sizeText"', 'oi."description"', 'oi."isTaken"', 'oi."isReturned"',
    'COALESCE) as "catalogName"', 'COALESCE) as "catalogBarcode"', // selectList מסיר את תוכן הסוגריים
    'o."eventDate"', 'o."eventDateHebrew"', 'c."firstName"', 'c."lastName"']);
  // ותוכן ה-COALESCE: רק שם הדגם והקידומת שלו
  assert.ok(/COALESCE\(d\."dressName", dm\."name"\) as "catalogName",\s*COALESCE\(d\."barcodePrefix", dm\."barcodePrefix"\) as "catalogBarcode"/.test(captured[2].sql));
});
await t('השכרות: JOIN ל-Order לפי orderId ול-Customer לפי customerId (LEFT — לא מוסיף/מוריד שורות), LIMIT 50 נשאר', () => {
  const sql = captured[2].sql.replace(/\s+/g, ' ');
  assert.ok(sql.includes('LEFT JOIN "Order" o ON o."orderId" = oi."orderId"'), sql);
  assert.ok(sql.includes('LEFT JOIN "Customer" c ON o."customerId" = c.id'), sql);
  assert.equal((sql.match(/ JOIN /g) || []).length, (sql.match(/ LEFT JOIN /g) || []).length, 'רק LEFT JOIN');
  assert.match(sql, /LIMIT 50\s*$/);
  // שום תנאי WHERE על הטבלאות החדשות (התוצאות עצמן לא משתנות)
  const where = sql.slice(sql.indexOf('WHERE'), sql.indexOf('ORDER BY'));
  assert.ok(!/\bo\.|\bc\./.test(where), where);
});
console.log('global-search: מיון "מושכר עכשיו קודם" בחיפוש ברקוד');
const rentalsSql = async (q) => {
  reset([]);
  await gs.GET(req('/api/global-search?q=' + encodeURIComponent(q)));
  return T.sql[2].sql.replace(/\s+/g, ' ');
};
const RENTED_FIRST = 'ORDER BY CASE WHEN oi."isTaken" AND NOT oi."isReturned" THEN 0 ELSE 1 END, oi."createdAt" DESC';
await t('ברקוד (ספרות בלבד, 5+) -> המושכר עכשיו קודם (היה באג: /^d{5,}$/ בלי הלוכסן, אף פעם לא הופעל)', async () => {
  for (const q of ['5511205', '12345', ' 5511205 ']) assert.ok((await rentalsSql(q)).includes(RENTED_FIRST), q);
});
await t('לא ברקוד -> מיון רגיל לפי תאריך יצירה (כולל "ddddd" שהביטוי השבור התאים לו)', async () => {
  for (const q of ['כהן', '1234', 'ddddd', '551a205']) {
    const sql = await rentalsSql(q);
    assert.ok(!sql.includes('CASE WHEN oi."isTaken"'), q);
    assert.ok(sql.includes('ORDER BY oi."createdAt" DESC'), q);
  }
});

await t('הרשאת כניסה נשארת: ללא התחברות -> 401', async () => {
  reset([], { authed: false });
  const res = await gs.GET(req('/api/global-search?q=x'));
  assert.equal(res.status, 401);
  assert.equal(T.dbCalls, 0);
});

// ---------------------------------------------------------------- /api/a5/adv
console.log('/api/a5/adv: שער הרשאת עמוד');
const FOCUS_PAGE = { customers: 'page:customers', orders: 'page:orders', rentals: 'page:rentals', returns: 'page:rentals' };
for (const [focus, page] of Object.entries(FOCUS_PAGE)) {
  await t(`${focus}: בלי ${page} -> 403 ובלי שאילתה`, async () => {
    reset([]);
    const res = await adv.GET(req(`/api/a5/adv?focus=${focus}&adv=%7B%7D`));
    assert.equal(res.status, 403);
    assert.match((await res.json()).error, /הרשאה/);
    assert.deepEqual(T.asked, [page]);
    assert.equal(T.dbCalls, 0);
  });
  await t(`${focus}: עם ${page} -> לא נחסם`, async () => {
    reset([page]);
    const res = await adv.GET(req(`/api/a5/adv?focus=${focus}&adv=%7B%7D`));
    assert.notEqual(res.status, 403);
    assert.notEqual(res.status, 400);
  });
}
await t('הרשאה לעמוד אחר לא מספיקה (page:orders לא פותח לקוחות)', async () => {
  reset(['page:orders']);
  assert.equal((await adv.GET(req('/api/a5/adv?focus=customers&adv=%7B%7D'))).status, 403);
});
await t('תחום לא מוכר -> 400; לא מחובר -> 401', async () => {
  reset(['page:customers']);
  assert.equal((await adv.GET(req('/api/a5/adv?focus=zzz'))).status, 400);
  reset([], { authed: false });
  assert.equal((await adv.GET(req('/api/a5/adv?focus=customers'))).status, 401);
});

// ---------------------------------------------------------------- /api/a5/options
console.log('/api/a5/options: שער הרשאת עמוד');
await t('הצעות שמות לקוחות בתחום לקוחות בלי הרשאה -> 403 ובלי שאילתה', async () => {
  reset([]);
  const res = await opt.GET(req('/api/a5/options?key=name&focus=customers&typed='));
  assert.equal(res.status, 403);
  assert.equal(T.dbCalls, 0);
});
for (const [focus, page] of Object.entries({ customers: 'page:customers', orders: 'page:orders', rentals: 'page:rentals', returns: 'page:rentals', deliveries: 'page:deliveries', alterations: 'page:alterations', finance: 'page:refunds', alerts: 'page:orders', capacity: 'page:orders', models: 'page:dresses_catalog' })) {
  await t(`${focus}: בלי ${page} -> 403; עם ${page} -> 200`, async () => {
    reset([]);
    assert.equal((await opt.GET(req(`/api/a5/options?key=q&focus=${focus}&typed=`))).status, 403);
    reset([page]);
    assert.equal((await opt.GET(req(`/api/a5/options?key=q&focus=${focus}&typed=`))).status, 200);
  });
}
await t('סוג מידע: שם/טלפון/עיר של לקוח דורש עמוד שמשתמש בלקוחות, גם בתחום דגמים', async () => {
  reset(['page:dresses_catalog']);
  for (const key of ['first', 'last', 'name', 'phone', 'city']) {
    const res = await opt.GET(req(`/api/a5/options?key=${key}&focus=models&typed=`));
    assert.equal(res.status, 403, key);
  }
  assert.equal(T.dbCalls, 0);
});
await t('מספרי הזמנה (oid) בתחום לקוחות בלי page:orders/rentals/... -> 403', async () => {
  reset(['page:customers']);
  assert.equal((await opt.GET(req('/api/a5/options?key=oid&focus=customers&typed='))).status, 403);
  reset(['page:customers', 'page:orders']);
  assert.equal((await opt.GET(req('/api/a5/options?key=oid&focus=orders&typed='))).status, 200);
});
await t('עובדים: רק הנהלה ראשית/מתכנת', async () => {
  reset([], { head: false });
  assert.equal((await opt.GET(req('/api/a5/options?key=q&focus=employees&typed='))).status, 403);
  reset([], { head: true });
  assert.equal((await opt.GET(req('/api/a5/options?key=q&focus=employees&typed='))).status, 200);
});
await t('רשימת עובדים (emp / cemp) בלי תחום: בלי אף עמוד חיפוש -> 403 ובלי שאילתה; עם page:refunds -> 200', async () => {
  for (const key of ['emp', 'cemp']) {
    reset([]);
    assert.equal((await opt.GET(req(`/api/a5/options?key=${key}&typed=`))).status, 403, key);
    assert.equal(T.dbCalls, 0, key);
    reset(['page:dresses_catalog']);
    assert.equal((await opt.GET(req(`/api/a5/options?key=${key}&focus=&typed=`))).status, 200, key + ' (עמוד דגמים הוא עמוד חיפוש)');
  }
});
await t('תחום לא מוכר נכשל סגור; לא מחובר -> 401', async () => {
  reset(['page:customers']);
  assert.equal((await opt.GET(req('/api/a5/options?key=q&focus=bogus&typed='))).status, 403);
  reset([], { authed: false });
  assert.equal((await opt.GET(req('/api/a5/options?key=name&focus=customers'))).status, 401);
});

console.log(`\n${passed} passed${process.exitCode ? ', WITH FAILURES' : ''}`);
