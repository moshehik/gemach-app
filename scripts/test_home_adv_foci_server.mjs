// בדיקות השרת של שני התחומים החדשים בחיפוש המתקדם של דף הבית — "כספים" (app/api/a5/adv-b, focus=finance) ו"התראות"
// (app/api/a5/adv-alerts + lib/advAlerts.js) — בלי DB ובלי Next: הרשאה (401 / 403 בלי שאילתה), תקרות (take / LIMIT / 200 שורות),
// מצב ריק, סיווג איחור / לא חזר, טיוטות ומחוקות לא נכללות, מיזוג סיבות להזמנה אחת, פרטי לקוח חסרים, שינויים שלא נשמרו,
// סינון קוד הזמנה / שם / תאריך, ורכות-כשל (סוג אחד נופל = השאר חוזרים; כולם נופלים = 500).
// הרצה: node scripts/test_home_adv_foci_server.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// המנגנון: אותו hook כמו test_search_leak_gate.mjs (כינוי '@/', מוקים ל-prisma / auth / permissions / settingsCache), ו-prisma בזיכרון
// עם מעריך where קטן (AND/OR/NOT, שוויון, in/not/gt/lt/contains, יחסים, some) כדי שהסינון בשאילתות ייבדק באמת ולא רק "נקרא".
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
  [/[\\\\/]lib[\\\\/]deliveries\\.js$/, 'deliveries'],
  [/[\\\\/]api[\\\\/]inventory[\\\\/]capacity[\\\\/]route\\.js$/, 'capacity'],
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
  if (url === 'mock:auth') return mod('const T=globalThis.__T; export const HEAD_MANAGEMENT_ROLES=[0,2]; export const checkAuth=async()=>T.authed; export const checkPageAccess=async()=>T.head; export const getSessionEmployee=async()=>T.head?{roleId:0}:{roleId:3};');
  if (url === 'mock:permissions') return mod('const T=globalThis.__T; export const canOpenPage=async(k)=>{T.asked.push(k);return T.pages.has(k);}; export const canOpenAnyPage=async(ks)=>{T.asked.push(ks.join("|"));return ks.some((k)=>T.pages.has(k));};');
  if (url === 'mock:settings') return mod('const T=globalThis.__T; export const getAllCachedSettings=async()=>{ if (T.settingsFail) throw new Error("settings down"); return Object.entries(T.settings).map(([key,value])=>({key,value})); }; export const getCachedSetting=async(k)=>T.settings[k]!==undefined?{key:k,value:T.settings[k]}:null;');
  if (url === 'mock:deliveries') return mod('export const getDeliveriesForDate=async()=>({data:[]});');
  if (url === 'mock:capacity') return mod('export const GET=async()=>new Response(JSON.stringify({inStock:0,occupiedCount:0,reserve:0,occupiedOrders:[]}),{status:200});');
  if (url === 'mock:next-server') return mod('export class NextResponse { static json(body, init){ return new Response(JSON.stringify(body), { status:(init&&init.status)||200, headers:{"content-type":"application/json"} }); } }');
  if (url === 'mock:next-headers') return mod('export const cookies=async()=>({get(){return undefined}});');
  return next(url, ctx);
}
`;
register('data:text/javascript;base64,' + Buffer.from(hooks).toString('base64'), pathToFileURL(root + path.sep));

// ---------------------------------------------------------------- prisma בזיכרון + מעריך where
const OPS = new Set(['equals', 'not', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'mode', 'some', 'none', 'every']);
const ms = (v) => (v instanceof Date ? v.getTime() : v);
const isOpObj = (o) => o && typeof o === 'object' && !(o instanceof Date) && !Array.isArray(o) && Object.keys(o).some((k) => OPS.has(k));
function evalCond(val, cond) {
  if (cond === null) return val === null || val === undefined;
  if (!isOpObj(cond)) {
    if (cond instanceof Date || typeof cond !== 'object') return ms(val) === ms(cond);
    return val != null && evalWhere(val, cond); // יחס (customer: {...})
  }
  for (const [op, arg] of Object.entries(cond)) {
    if (op === 'mode') continue;
    if (op === 'equals' && ms(val) !== ms(arg)) return false;
    if (op === 'not') {
      if (arg === null ? val == null : (val == null || ms(val) === ms(arg))) return false; // סמנטיקת SQL: NULL <> x אינו אמת
    }
    if (op === 'in' && !arg.includes(val)) return false;
    if (op === 'notIn' && (val == null || arg.includes(val))) return false;
    if (op === 'gt' && !(val != null && ms(val) > ms(arg))) return false;
    if (op === 'gte' && !(val != null && ms(val) >= ms(arg))) return false;
    if (op === 'lt' && !(val != null && ms(val) < ms(arg))) return false;
    if (op === 'lte' && !(val != null && ms(val) <= ms(arg))) return false;
    if (op === 'contains' && !(val != null && String(val).toLowerCase().includes(String(arg).toLowerCase()))) return false;
    if (op === 'startsWith' && !(val != null && String(val).startsWith(String(arg)))) return false;
    if (op === 'some' && !(Array.isArray(val) && val.some((x) => evalWhere(x, arg)))) return false;
    if (op === 'none' && (Array.isArray(val) && val.some((x) => evalWhere(x, arg)))) return false;
    if (op === 'every' && !(Array.isArray(val) && val.every((x) => evalWhere(x, arg)))) return false;
  }
  return true;
}
function evalWhere(row, where) {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (k === 'AND') { if (!(Array.isArray(v) ? v : [v]).every((w) => evalWhere(row, w))) return false; }
    else if (k === 'OR') { if (!v.some((w) => evalWhere(row, w))) return false; }
    else if (k === 'NOT') { if ((Array.isArray(v) ? v : [v]).some((w) => evalWhere(row, w))) return false; }
    else if (!evalCond(row ? row[k] : undefined, v)) return false;
  }
  return true;
}
const cmpNullsLast = (a, b) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : ms(a) - ms(b));
function runFind(rows, args = {}) {
  let out = rows.filter((r) => evalWhere(r, args.where));
  const ob = args.orderBy && (Array.isArray(args.orderBy) ? args.orderBy[0] : args.orderBy);
  if (ob) {
    const [k, dir] = Object.entries(ob)[0];
    const d = typeof dir === 'object' ? dir.sort : dir;
    out = out.slice().sort((a, b) => (d === 'desc' ? -1 : 1) * cmpNullsLast(a[k], b[k]));
  }
  if (args.take != null) out = out.slice(0, args.take);
  // relation include/select של items עם where (items: { where: {isDeleted:false}, select }) — כמו Prisma
  return out.map((r) => {
    const c = { ...r };
    const itemsSel = args.select && args.select.items;
    if (itemsSel && itemsSel.where && Array.isArray(r.items)) c.items = r.items.filter((i) => evalWhere(i, itemsSel.where));
    return c;
  });
}

const T = (globalThis.__T = {});
function resetT() {
  Object.assign(T, {
    authed: true, head: false, pages: new Set(), asked: [], settings: {}, settingsFail: false,
    orders: [], refunds: [], employees: [], rawRows: [], rawFail: false, calls: [], raw: [], orderFail: null,
  });
}
resetT();
const count = (name, args) => T.calls.push({ name, args });
T.prisma = {
  order: {
    findMany: async (args) => { count('order.findMany', args); if (T.orderFail && T.orderFail(args)) throw new Error('db down'); return runFind(T.orders, args); },
  },
  refund: { findMany: async (args) => { count('refund.findMany', args); return runFind(T.refunds, args); } },
  employee: { findMany: async (args) => { count('employee.findMany', args); return runFind(T.employees, args); } },
  $queryRaw: async (strings, ...values) => {
    count('$queryRaw', { sql: strings.join('?'), values });
    T.raw.push({ sql: strings.join('?'), values });
    if (T.rawFail) throw new Error('raw down');
    return typeof T.rawRows === 'function' ? T.rawRows(strings, values) : T.rawRows;
  },
};

let passed = 0;
async function t(name, fn) {
  try { resetT(); await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.stack || e.message); process.exitCode = 1; }
}
const req = (url) => new Request('http://localhost' + url);
const allow = (...pages) => { T.pages = new Set(pages); };

const alerts = await import('../app/api/a5/adv-alerts/route.js');
const advb = await import('../app/api/a5/adv-b/route.js');
const lib = await import('../lib/advAlerts.js');
const hd = await import('../lib/hebrewDate.js');

// ---------------------------------------------------------------- בנאי נתונים (תאריכים יחסיים להיום הישראלי, בצורת האחסון של האתר: חצות ישראל)
const todayKey = hd.getIsraelDateKey(new Date());
const dayStart = (offset) => hd.getIsraelDayRange(hd.addDaysToDateKey(todayKey, offset)).start;
const item = (o = {}) => ({ isDeleted: false, isTaken: false, isReturned: false, ...o });
const cust = (o = {}) => ({ firstName: 'רחל', lastName: 'כהן', phone1: '0524418210', phone2: null, email: 'r@x.co', city: 'ירושלים', street: 'הרצל', houseNum: '3', ...o });
let seq = 1000;
const order = (o = {}) => ({
  orderId: ++seq, eventDate: dayStart(-40), eventDateHebrew: 'ט״ו תשרי תשפ״ז', toDate: null, returnDate: null, totalAmount: 0,
  status: 'חדש', isDeleted: false, customer: cust(), items: [item({ isTaken: true })], ...o,
});
const call = async (url) => { const res = await alerts.GET(req(url)); return { status: res.status, body: await res.json() }; };

console.log('adv-alerts: הרשאה');
await t('לא מחובר -> 401 ובלי שאילתה', async () => {
  T.authed = false;
  assert.equal((await call('/api/a5/adv-alerts?focus=alerts')).status, 401);
  assert.equal(T.calls.length, 0);
});
await t('בלי page:orders -> 403 ובלי שאילתה (גם לא הגדרות)', async () => {
  allow('page:refunds', 'page:rentals', 'page:customers');
  const r = await call('/api/a5/adv-alerts?focus=alerts');
  assert.equal(r.status, 403);
  assert.deepEqual(T.asked, ['page:orders']);
  assert.equal(T.calls.length, 0);
});
await t('עם page:orders -> 200', async () => {
  allow('page:orders');
  assert.equal((await call('/api/a5/adv-alerts?focus=alerts')).status, 200);
});

console.log('adv-alerts: מצב ריק וצורת התשובה');
await t('בלי נתונים: שורות ריקות, עמודות קבועות, בלי truncated / gaps', async () => {
  allow('page:orders');
  const { status, body } = await call('/api/a5/adv-alerts?focus=alerts');
  assert.equal(status, 200);
  assert.deepEqual(body.cols, ['שם', 'הזמנה', 'תאריך אירוע', 'התראה', 'טלפון']);
  assert.deepEqual([body.rows, body.links, body.namesRev, body.tags, body.al, body.gaps, body.failed], [[], [], [], [], [], [], []]);
  assert.equal(body.truncated, false);
});

console.log('adv-alerts: איחור / שמלה שלא חזרה');
await t('איחור: אירוע לפני 40 יום ופריט שלא הוחזר -> צ׳יפ אדום, תג "החזרה", ימי איחור בטקסט', async () => {
  allow('page:orders');
  const o = order({ customer: cust({ firstName: 'רחל', lastName: 'כהן' }) });
  T.orders = [o];
  const { body } = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_late');
  assert.equal(body.rows.length, 1);
  const [name, ord, date, chip, phone] = body.rows[0];
  assert.equal(name, 'רחל כהן');
  assert.equal(ord, 'הזמנה ' + o.orderId);
  assert.equal(date, 'ט״ו תשרי'); // השנה נחתכת, כמו שאר שורות החיפוש המתקדם
  assert.match(chip[0], /^איחור בהחזרה \(\d+ ימים\)$/);
  assert.equal(chip[1], 'red');
  assert.equal(phone, '052-4418210');
  assert.deepEqual(body.tags, ['return']);
  assert.deepEqual(body.links, ['/orders/' + o.orderId]);
  assert.deepEqual(body.namesRev, ['כהן רחל']);
});
await t('שמלה שלא חזרה: אירוע אתמול (לפני סף האיחור) -> צ׳יפ ענבר', async () => {
  allow('page:orders');
  T.orders = [order({ eventDate: dayStart(-1) })];
  const { body } = await call('/api/a5/adv-alerts?focus=alerts');
  assert.equal(body.rows.length, 1);
  assert.deepEqual(body.rows[0][3], ['שמלה שלא חזרה', 'amber']);
  assert.deepEqual(body.tags, ['return']);
});
await t('הסוגים נבחרים: ar_late בלבד לא מחזיר "שמלה שלא חזרה" ולהפך', async () => {
  allow('page:orders');
  T.orders = [order({ eventDate: dayStart(-40) }), order({ eventDate: dayStart(-1) })];
  const late = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_late');
  assert.equal(late.body.rows.length, 1);
  assert.match(late.body.rows[0][3][0], /^איחור/);
  const unret = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_unret');
  assert.equal(unret.body.rows.length, 1);
  assert.equal(unret.body.rows[0][3][0], 'שמלה שלא חזרה');
});
await t('לא נכללים: אירוע עתידי, הכל הוחזר, פריט מחוק בלבד, הזמנה מחוקה, טיוטת שרת, תאריך החזרה מפורש שעוד לא הגיע', async () => {
  allow('page:orders');
  T.orders = [
    order({ eventDate: dayStart(3) }), // האירוע עוד לא עבר
    order({ items: [item({ isTaken: true, isReturned: true })] }), // חזרה
    order({ items: [item({ isTaken: true, isDeleted: true })] }), // פריט מחוק
    order({ isDeleted: true }),
    order({ status: 'טיוטה' }),
    order({ eventDate: dayStart(-2), toDate: dayStart(5) }), // אירוע רב-יומי: ההחזרה עוד לא "צריכה" לקרות
  ];
  const { body } = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_late,ar_unret');
  assert.deepEqual(body.rows, []);
});
await t('סף האיחור נקרא מההגדרות (late_return_threshold_days)', async () => {
  allow('page:orders');
  T.orders = [order({ eventDate: dayStart(-12) })];
  T.settings = { late_return_threshold_days: '7' };
  const a = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_late');
  T.settings = { late_return_threshold_days: '60' };
  const b = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_late');
  const c = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_unret');
  assert.equal(a.body.rows.length, 1);
  assert.equal(b.body.rows.length, 0);
  assert.equal(c.body.rows.length, 1, 'עם סף גבוה אותה הזמנה היא "לא חזרה" ולא "איחור"');
});

console.log('adv-alerts: חוב פתוח');
await t('חוב: ה-SQL חסום (LIMIT, חלון תאריכים לשנה אחורה, בלי טיוטות / מחוקות) והשורה מציגה את החוב', async () => {
  allow('page:orders');
  const o = order({ eventDate: dayStart(-10), totalAmount: 900, items: [item({ isTaken: true, isReturned: true })] });
  T.orders = [o];
  T.rawRows = [{ orderId: o.orderId, total: 900, paid: 450 }];
  const { body } = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_debt');
  assert.equal(body.rows.length, 1);
  assert.equal(body.rows[0][3][0], 'חוב פתוח ₪450');
  assert.equal(body.rows[0][3][1], 'gold');
  assert.deepEqual(body.tags, ['order']);
  const q = T.raw[0];
  assert.match(q.sql, /"isDeleted" = false/);
  assert.match(q.sql, /HAVING COALESCE\(SUM\(pm\."amount"\), 0\) < o\."totalAmount"/);
  assert.match(q.sql, /LEFT JOIN "Payment" pm ON pm\."orderId" = o\."orderId" AND pm\."isDeleted" = false/);
  assert.ok(/LIMIT \?\s*$/.test(q.sql));
  assert.equal(q.values[q.values.length - 1], lib.ALERT_LIMITS.DEBT_IDS + 1);
  assert.ok(q.values.includes('טיוטה'), 'טיוטות לא נכללות');
  const dates = q.values.filter((v) => v instanceof Date).map((d) => d.getTime()).sort((a, b) => a - b);
  assert.equal(dates.length, 2);
  assert.equal(dates[1], dayStart(0).getTime(), 'האירוע לפני היום (שעון ישראל)');
  assert.equal(dates[0], dayStart(-lib.ALERT_LIMITS.DEBT_LOOKBACK_DAYS).getTime(), 'חלון של שנה');
});
await t('חוב: בלי מועמדות מה-SQL אין שאילתת הזמנות בכלל', async () => {
  allow('page:orders');
  T.rawRows = [];
  await call('/api/a5/adv-alerts?focus=alerts&flags=ar_debt');
  assert.equal(T.calls.filter((c) => c.name === 'order.findMany').length, 0);
});
await t('חוב: הזמנה מחוקה / טיוטה / ללא מועמדות ב-SQL לא מופיעה גם אם היא בטבלה', async () => {
  allow('page:orders');
  const ok = order({ eventDate: dayStart(-5), totalAmount: 100 });
  const del = order({ eventDate: dayStart(-5), totalAmount: 100, isDeleted: true });
  const draft = order({ eventDate: dayStart(-5), totalAmount: 100, status: 'טיוטה' });
  const noCand = order({ eventDate: dayStart(-5), totalAmount: 100 });
  T.orders = [ok, del, draft, noCand];
  T.rawRows = [ok, del, draft].map((o) => ({ orderId: o.orderId, total: 100, paid: 0 }));
  const { body } = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_debt');
  assert.deepEqual(body.links, ['/orders/' + ok.orderId]);
});

console.log('adv-alerts: מיזוג סיבות, מיון');
await t('הזמנה עם איחור וגם חוב = שורה אחת: הצ׳יפ של הסיבה החשובה, שני הטקסטים, תג "החזרה"', async () => {
  allow('page:orders');
  const o = order({ eventDate: dayStart(-40), totalAmount: 500 });
  T.orders = [o];
  T.rawRows = [{ orderId: o.orderId, total: 500, paid: 100 }];
  const { body } = await call('/api/a5/adv-alerts?focus=alerts');
  assert.equal(body.rows.length, 1);
  assert.match(body.rows[0][3][0], /^איחור בהחזרה \(\d+ ימים\) · חוב פתוח ₪400$/);
  assert.equal(body.rows[0][3][1], 'red');
  assert.deepEqual(body.tags, ['return']);
});
await t('מיון: איחור לפני לא-חזר לפני חוב לפני חסר; באותה עדיפות האירוע הישן קודם', async () => {
  allow('page:orders');
  const debtOnly = order({ eventDate: dayStart(-20), totalAmount: 100, items: [item({ isTaken: true, isReturned: true })] });
  const lateNew = order({ eventDate: dayStart(-30), customer: cust({ firstName: 'שרה' }) });
  const lateOld = order({ eventDate: dayStart(-90), customer: cust({ firstName: 'מרים' }) });
  const unret = order({ eventDate: dayStart(-1), customer: cust({ firstName: 'לאה' }) });
  const missing = order({ eventDate: dayStart(4), items: [item()], customer: cust({ firstName: 'חנה', phone1: '' }) });
  T.orders = [debtOnly, lateNew, lateOld, unret, missing];
  T.rawRows = [{ orderId: debtOnly.orderId, total: 100, paid: 0 }];
  const { body } = await call('/api/a5/adv-alerts?focus=alerts');
  assert.deepEqual(body.links, [lateOld, lateNew, unret, debtOnly, missing].map((o) => '/orders/' + o.orderId));
  assert.deepEqual(body.tags, ['return', 'return', 'return', 'order', 'order']);
});

console.log('adv-alerts: פרטי לקוח חסרים');
await t('חסר טלפון בהזמנה עתידית -> מופיע; לקוחה מלאה / אירוע שעבר -> לא', async () => {
  allow('page:orders');
  const miss = order({ eventDate: dayStart(5), items: [item()], customer: cust({ phone1: '' }) });
  const full = order({ eventDate: dayStart(5), items: [item()] });
  const past = order({ eventDate: dayStart(-3), items: [item({ isTaken: true, isReturned: true })], customer: cust({ phone1: '' }) });
  const draft = order({ eventDate: dayStart(5), status: 'טיוטה', items: [item()], customer: cust({ phone1: '' }) });
  T.orders = [miss, full, past, draft];
  const { body } = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_missing');
  assert.deepEqual(body.links, ['/orders/' + miss.orderId]);
  assert.deepEqual(body.rows[0][3], ['פרטי לקוח חסרים', 'rose']);
  assert.deepEqual(body.tags, ['order']);
});
await t('שדות חובה מההגדרות (mandatory_fields: email) נספרים', async () => {
  allow('page:orders');
  T.settings = { mandatory_fields: 'email' };
  const noMail = order({ eventDate: dayStart(5), items: [item()], customer: cust({ email: '' }) });
  T.orders = [noMail, order({ eventDate: dayStart(5), items: [item()] })];
  const { body } = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_missing');
  assert.deepEqual(body.links, ['/orders/' + noMail.orderId]);
});

console.log('adv-alerts: שינויים שלא נשמרו');
await t('מספרים שהדפדפן שלח: רק הזמנות קיימות ולא מחוקות; זבל נזרק', async () => {
  allow('page:orders');
  const a = order({ items: [item()], eventDate: dayStart(8) });
  const b = order({ items: [item()], eventDate: dayStart(9), isDeleted: true });
  const c = order({ items: [item()], eventDate: dayStart(10) });
  T.orders = [a, b, c];
  const { body } = await call(`/api/a5/adv-alerts?focus=alerts&flags=ar_unsaved&unsaved=${a.orderId},${b.orderId},abc,-5,0,1e3,${a.orderId}`);
  assert.deepEqual(body.links, ['/orders/' + a.orderId]);
  assert.deepEqual(body.rows[0][3], ['שינויים שלא נשמרו', 'blue']);
});
await t('בלי מספרים = אין שאילתה על "שלא נשמר"', async () => {
  allow('page:orders');
  await call('/api/a5/adv-alerts?focus=alerts&flags=ar_unsaved');
  assert.equal(T.calls.length, 0);
});
await t('פרסור: עד 500 מספרים, בלי כפילויות', () => {
  const many = Array.from({ length: 800 }, (_, i) => i + 1).join(',');
  assert.equal(lib.parseUnsavedIds(many).length, lib.ALERT_LIMITS.UNSAVED_IDS);
  assert.deepEqual(lib.parseUnsavedIds('5,5,6, 7 ,x,,-1,0,12345678901'), [5, 6, 7]);
  assert.deepEqual(lib.parseUnsavedIds(undefined), []);
});

console.log('adv-alerts: סינון');
await t('קוד הזמנה / שם / תאריך אירוע מצמצמים את כל הסוגים', async () => {
  allow('page:orders');
  const a = order({ eventDate: dayStart(-40), customer: cust({ firstName: 'שרה', lastName: 'לוי' }) });
  const b = order({ eventDate: dayStart(-41), customer: cust({ firstName: 'מרים', lastName: 'כהן' }) });
  T.orders = [a, b];
  assert.equal((await call(`/api/a5/adv-alerts?focus=alerts&oid=${a.orderId}`)).body.rows.length, 1);
  assert.equal((await call('/api/a5/adv-alerts?focus=alerts&oid=abc')).body.rows.length, 0, 'קוד לא מספרי = אין תוצאות, לא כל ההזמנות');
  assert.deepEqual((await call('/api/a5/adv-alerts?focus=alerts&name=' + encodeURIComponent('שרה'))).body.links, ['/orders/' + a.orderId]);
  assert.equal((await call('/api/a5/adv-alerts?focus=alerts&name=' + encodeURIComponent('מרים כהן'))).body.rows.length, 1);
  assert.equal((await call('/api/a5/adv-alerts?focus=alerts&name=' + encodeURIComponent('כהן לוי'))).body.rows.length, 0);
  const day = hd.getIsraelDateKey(a.eventDate);
  assert.deepEqual((await call('/api/a5/adv-alerts?focus=alerts&from=' + day)).body.links, ['/orders/' + a.orderId], 'תאריך בודד = אותו יום');
  assert.equal((await call('/api/a5/adv-alerts?focus=alerts&from=garbage')).body.rows.length, 2, 'תאריך לא תקין מתעלמים');
});
await t('דגלים לא מוכרים מתעלמים (= כל הסוגים), לא נכשלים', async () => {
  allow('page:orders');
  T.orders = [order()];
  const { status, body } = await call('/api/a5/adv-alerts?focus=alerts&flags=bogus,al_len,rc_debt');
  assert.equal(status, 200);
  assert.equal(body.rows.length, 1);
});

console.log('adv-alerts: תקרות');
await t('שאילתות חסומות: take לכל אחת, והתשובה עד 200 שורות עם truncated', async () => {
  allow('page:orders');
  const L = lib.ALERT_LIMITS;
  T.orders = Array.from({ length: 260 }, (_, i) => order({ eventDate: dayStart(-40 - i) }));
  const { body } = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_late');
  assert.equal(body.rows.length, L.ROWS);
  assert.equal(body.truncated, true);
  const f = T.calls.find((c) => c.name === 'order.findMany');
  assert.equal(f.args.take, L.OUT_SCAN + 1);
  assert.equal(body.cap, L.ROWS);
  assert.equal(body.total, 260);
  assert.equal(body.counts.late, 260);
});
await t('כל סוגי השאילתות נושאות take ויש רק מספר קבוע של שאילתות', async () => {
  allow('page:orders');
  T.rawRows = [{ orderId: 1, total: 10, paid: 0 }];
  T.orders = [order({ eventDate: dayStart(-5), totalAmount: 10 })];
  await call('/api/a5/adv-alerts?focus=alerts&unsaved=1,2,3');
  const finds = T.calls.filter((c) => c.name === 'order.findMany');
  assert.ok(finds.length <= 4, 'לא יותר מ-4 שאילתות הזמנות (איחורים / חוב / חסר / לא נשמר): ' + finds.length);
  for (const f of finds) assert.ok(Number.isInteger(f.args.take) && f.args.take <= lib.ALERT_LIMITS.OUT_SCAN + 1, 'חסר take: ' + JSON.stringify(f.args.take));
  assert.equal(T.calls.filter((c) => c.name === '$queryRaw').length, 1);
});
await t('חוב: מעל 2000 מועמדות מה-SQL -> truncated', async () => {
  allow('page:orders');
  T.rawRows = Array.from({ length: lib.ALERT_LIMITS.DEBT_IDS + 1 }, (_, i) => ({ orderId: 5000 + i, total: 10, paid: 0 }));
  const { body } = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_debt');
  assert.equal(body.truncated, true);
});

console.log('adv-alerts: מכסה הוגנת לפי סוג, ספירות, סדר איחורים');
await t('419 איחורים + 205 חובות + 30 חסרים + 5 טיוטות: כל סוג שומר שורות, הספירות מלאות, סך הכל נכון', async () => {
  allow('page:orders');
  const L = lib.ALERT_LIMITS;
  const late = Array.from({ length: 419 }, (_, i) => order({ eventDate: dayStart(-40 - i) }));
  const debt = Array.from({ length: 205 }, (_, i) => order({ eventDate: dayStart(-10 - (i % 300)), totalAmount: 100, items: [item({ isTaken: true, isReturned: true })] }));
  const miss = Array.from({ length: 30 }, (_, i) => order({ eventDate: dayStart(5 + i), items: [item()], customer: cust({ phone1: '' }) }));
  const drafts = Array.from({ length: 5 }, (_, i) => order({ eventDate: dayStart(8 + i), items: [item()] }));
  T.orders = [...late, ...debt, ...miss, ...drafts];
  T.rawRows = debt.map((o) => ({ orderId: o.orderId, total: 100, paid: 0 }));
  const { body } = await call('/api/a5/adv-alerts?focus=alerts&unsaved=' + drafts.map((o) => o.orderId).join(','));
  assert.equal(body.rows.length, L.ROWS);
  assert.equal(body.truncated, true);
  assert.equal(body.cap, 200);
  assert.equal(body.total, 419 + 205 + 30 + 5);
  assert.deepEqual(body.counts, { late: 419, notReturned: 0, debt: 205, missing: 30, unsaved: 5 });
  const byLink = new Map([...late.map((o) => [o.orderId, 'late']), ...debt.map((o) => [o.orderId, 'debt']), ...miss.map((o) => [o.orderId, 'missing']), ...drafts.map((o) => [o.orderId, 'unsaved'])]);
  const got = { late: 0, debt: 0, missing: 0, unsaved: 0 };
  for (const l of body.links) got[byLink.get(Number(l.split('/').pop()))]++;
  // 200 / 4 סוגים = 50; הטיוטות (5) ו"חסרים" (30) נשמרים במלואם, והשאר מתחלקים בין איחורים לחובות
  assert.equal(got.unsaved, 5);
  assert.equal(got.missing, 30);
  assert.equal(got.late + got.debt, 165);
  assert.ok(got.late >= 80 && got.debt >= 80, JSON.stringify(got));
  assert.ok(body.links.length === new Set(body.links).size);
});
await t('סוג אחד נבחר: כל 200 השורות שלו, והספירה והסך נכונים', async () => {
  allow('page:orders');
  T.orders = Array.from({ length: 300 }, (_, i) => order({ eventDate: dayStart(-40 - i) }));
  const { body } = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_late');
  assert.equal(body.rows.length, 200);
  assert.equal(body.total, 300);
  assert.equal(body.counts.late, 300);
});
await t('איחורים ממוינים מהכי מאחרת: הזמנה בת 400 יום לפני בת 41', async () => {
  allow('page:orders');
  const a = order({ eventDate: dayStart(-41) });
  const b = order({ eventDate: dayStart(-400) });
  const c = order({ eventDate: dayStart(-120) });
  T.orders = [a, b, c];
  const { body } = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_late');
  assert.deepEqual(body.links, [b, c, a].map((o) => '/orders/' + o.orderId));
});
await t('סריקה: מעל OUT_SCAN מועמדות — האיחורים הישנים ביותר לא נופלים, וגם ה"לא חזרו" החדשים נשארים; scanTruncated', async () => {
  allow('page:orders');
  const L = lib.ALERT_LIMITS;
  const lates = Array.from({ length: L.OUT_SCAN + 50 }, (_, i) => order({ eventDate: dayStart(-30 - i) }));
  const oldest = lates[lates.length - 1];
  const unret = order({ eventDate: dayStart(-1) });
  T.orders = [unret, ...lates];
  const late = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_late');
  assert.equal(late.body.links[0], '/orders/' + oldest.orderId, 'הכי מאחרת ראשונה');
  assert.equal(late.body.scanTruncated, true);
  const both = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_late,ar_unret');
  assert.ok(both.body.links.includes('/orders/' + unret.orderId), 'שמלה שלא חזרה (חדשה) נשארת');
  assert.equal(both.body.counts.notReturned, 1);
});
await t('lib: capAlertEntries — מכסה הוגנת, השארית עוברת לסוגים הגדולים, סדר נשמר', () => {
  const mk = (flag, i) => ({ order: { orderId: i, eventDate: new Date(2026, 0, 1 + (i % 300)) }, reasons: [{ flag, daysLate: 1000 - i }] });
  const es = [];
  let id = 1;
  for (const [f, n] of [['ar_late', 419], ['ar_debt', 205], ['ar_missing', 30], ['ar_unsaved', 5]]) for (let k = 0; k < n; k++) es.push(mk(f, id++));
  const { kept, capped } = lib.capAlertEntries(es, 200);
  assert.equal(capped, true);
  assert.equal(kept.length, 200);
  const n = (f) => kept.filter((e) => e.reasons[0].flag === f).length;
  assert.deepEqual([n('ar_unsaved'), n('ar_missing'), n('ar_late'), n('ar_debt')], [5, 30, 83, 82]);
  assert.deepEqual(lib.capAlertEntries(es.slice(0, 10), 200).capped, false);
  assert.deepEqual(lib.countAlertTypes(es), { late: 419, notReturned: 0, debt: 205, missing: 30, unsaved: 5 });
});

console.log('adv-alerts: רכות-כשל');
await t('שאילתת החוב נופלת: האיחורים חוזרים ו-failed אומר מה חסר', async () => {
  allow('page:orders');
  T.orders = [order()];
  T.rawFail = true;
  const { status, body } = await call('/api/a5/adv-alerts?focus=alerts');
  assert.equal(status, 200);
  assert.equal(body.rows.length, 1);
  assert.deepEqual(body.failed, ['חובות']);
  assert.deepEqual(body.gaps, []);
});
await t('כל הסוגים נכשלים -> 500 עם הודעה בעברית (בלי פרטי השגיאה)', async () => {
  allow('page:orders');
  T.rawFail = true;
  T.orderFail = () => true;
  const { status, body } = await call('/api/a5/adv-alerts?focus=alerts');
  assert.equal(status, 500);
  assert.equal(body.error, 'שגיאה בחיפוש ההתראות');
});
await t('הגדרות לא זמינות -> ברירות מחדל (סף 7), לא קורס', async () => {
  allow('page:orders');
  T.settingsFail = true;
  T.orders = [order()];
  const { status, body } = await call('/api/a5/adv-alerts?focus=alerts&flags=ar_late');
  assert.equal(status, 200);
  assert.equal(body.rows.length, 1);
});

console.log('lib/advAlerts: סיווג');
await t('classifyOutOrder: אירוע שנשמר כ-21:00Z (חצות ישראל) נספר ליום הישראלי הנכון', () => {
  const ctx = { threshold: 7, nonWorkingDays: null, now: new Date() };
  // אירוע "אתמול" בישראל בצורת האחסון 21:00Z של היום שלפניו
  const y = hd.addDaysToDateKey(todayKey, -1);
  const stored = new Date(hd.getIsraelDayRange(y).start); // = 21:00Z או 22:00Z של היום שלפניו
  const r = lib.classifyOutOrder({ eventDate: stored, items: [item({ isTaken: true })] }, ctx);
  assert.equal(r.flag, 'ar_unret');
  assert.equal(r.daysSinceEvent, 1);
});
await t('classifyOutOrder: אין eventDate / אין פריט בחוץ -> null', () => {
  const ctx = { threshold: 7, nonWorkingDays: null, now: new Date() };
  assert.equal(lib.classifyOutOrder({ eventDate: null, items: [item({ isTaken: true })] }, ctx), null);
  assert.equal(lib.classifyOutOrder({ eventDate: dayStart(-9), items: [item()] }, ctx), null);
  assert.equal(lib.classifyOutOrder({ eventDate: dayStart(-9), items: [] }, ctx), null);
});

// ---------------------------------------------------------------- כספים (adv-b, focus=finance)
console.log('adv-b finance: הרשאה');
const fin = async (qs) => { const res = await advb.GET(req('/api/a5/adv-b?focus=finance' + (qs ? '&' + qs : ''))); return { status: res.status, body: await res.json() }; };
await t('בלי page:refunds -> 403 ובלי שאילתה; הרשאה לדף אחר (orders) לא מספיקה', async () => {
  allow('page:orders', 'page:rentals');
  const r = await fin('');
  assert.equal(r.status, 403);
  assert.deepEqual(T.asked, ['page:refunds']);
  assert.equal(T.calls.length, 0);
});
await t('לא מחובר -> 401', async () => {
  T.authed = false;
  assert.equal((await fin('')).status, 401);
});
await t('עם page:refunds: מצב ריק = 200, עמודות העיצוב, בלי שורות', async () => {
  allow('page:refunds');
  const { status, body } = await fin('');
  assert.equal(status, 200);
  assert.deepEqual(body.cols, ['שם', 'סכום', 'תאריך אירוע', 'טלפון']);
  assert.deepEqual(body.rows, []);
});

console.log('adv-b finance: חובות וזיכויים');
const fOrder = (o = {}) => order({ eventDate: dayStart(-3), items: [item({ isTaken: true, isReturned: true })], payments: [], ...o });
await t('חובות: מועמדות SQL חסומות (LIMIT 5000), הזמנות נטענות עם take 5000, שורה = "חוב ₪..." עם צ׳יפ amtd', async () => {
  allow('page:refunds');
  const o = fOrder({ totalAmount: 900, payments: [{ amount: 450, isDeleted: false }] });
  T.orders = [o];
  T.rawRows = [{ orderId: o.orderId }];
  const { body } = await fin('flags=fn_debt');
  assert.equal(body.rows.length, 1);
  assert.deepEqual(body.rows[0][1], ['חוב ₪450', 'amtd']);
  assert.equal(T.raw.length, 1);
  assert.match(T.raw[0].sql, /LIMIT \?\s*$/);
  assert.equal(T.raw[0].values[T.raw[0].values.length - 1], 5000);
  assert.equal(T.calls.filter((c) => c.name === 'order.findMany')[0].args.take, 5000);
  assert.equal(T.calls.filter((c) => c.name === 'refund.findMany').length, 0, 'רק חובות = בלי שאילתת זיכויים');
});
await t('זיכויים בלבד (fn_credit): בלי SQL של חובות; take 5000; צ׳יפ amtc', async () => {
  allow('page:refunds');
  const ord = fOrder();
  T.refunds = [{ id: 1, isDeleted: false, amount: 120, createdAt: dayStart(-1), orderId: ord.orderId, customerId: 'c1', customer: cust({ firstName: 'לאה', lastName: 'פרידמן' }), order: ord, isExecuted: false }];
  const { body } = await fin('flags=fn_credit');
  assert.equal(T.raw.length, 0);
  assert.equal(body.rows.length, 1);
  assert.deepEqual(body.rows[0][1], ['זיכוי ₪120', 'amtc']);
  assert.equal(T.calls.find((c) => c.name === 'refund.findMany').args.take, 5000);
});
await t('סינוני זיכוי (בוצע / עובד מבצע / תאריך זיכוי / חסר בנק) מוציאים את החובות', async () => {
  allow('page:refunds');
  for (const qs of ['flags=fc_done', 'flags=fc_nobank', 'cemp=' + encodeURIComponent('דנה'), 'cdate=' + todayKey]) {
    T.raw = [];
    await fin(qs);
    assert.equal(T.raw.length, 0, qs + ' לא אמור להריץ את שאילתת החובות');
  }
});
await t('בלי דגלים: חובות וגם זיכויים; מיון חכם; amount ±30', async () => {
  allow('page:refunds');
  const o1 = fOrder({ totalAmount: 500, payments: [] });
  const o2 = fOrder({ totalAmount: 900, payments: [] });
  T.orders = [o1, o2];
  T.rawRows = [{ orderId: o1.orderId }, { orderId: o2.orderId }];
  const all = await fin('');
  assert.equal(all.body.rows.length, 2);
  const near = await fin('amount=' + encodeURIComponent('₪510'));
  assert.equal(near.body.rows.length, 1);
  assert.deepEqual(near.body.rows[0][1], ['חוב ₪500', 'amtd']);
});
await t('נתוני לקוח בלבד בשורה: שם / סכום / תאריך עברי / טלפון (בלי מייל / כתובת / הערות)', async () => {
  allow('page:refunds');
  const o = fOrder({ totalAmount: 100, payments: [] });
  T.orders = [o];
  T.rawRows = [{ orderId: o.orderId }];
  const { body } = await fin('flags=fn_debt');
  assert.equal(body.rows[0].length, 4);
  assert.ok(!JSON.stringify(body).includes('r@x.co'));
});
await t('מעל 200 שורות -> truncated והתשובה 200 בלבד', async () => {
  allow('page:refunds');
  T.orders = Array.from({ length: 230 }, (_, i) => fOrder({ totalAmount: 100 + i, payments: [], eventDate: dayStart(-3 - i) }));
  T.rawRows = T.orders.map((o) => ({ orderId: o.orderId }));
  const { body } = await fin('flags=fn_debt');
  assert.equal(body.rows.length, 200);
  assert.equal(body.truncated, true);
});
await t('שגיאת DB -> 500 עם הודעה כללית בעברית', async () => {
  allow('page:refunds');
  T.rawFail = true;
  const { status, body } = await fin('flags=fn_debt');
  assert.equal(status, 500);
  assert.equal(body.error, 'שגיאה בחיפוש המתקדם');
});

console.log(`\n${passed} passed${process.exitCode ? ', WITH FAILURES' : ''}`);
