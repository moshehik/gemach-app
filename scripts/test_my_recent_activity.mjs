// בדיקות "השינויים שלי" (GET /api/me/recent-activity + lib/myRecentActivity.js), בלי DB ובלי Next:
//   1) הלוגיקה הטהורה: חלון היצירה, הזמנה אחת פעם אחת, חלון הימים לפי שעון ישראל (לא תלוי באזור הזמן של התהליך).
//   2) הנתיב מול prisma בזיכרון: self-only (employeeId של אחרת = 403), הרשאה page:orders, מצב פתוח, כשל DB = degraded,
//      הזמנה שבוטלה / טיוטה לא מופיעות, נוצרה לא נכנסת ל"שינויים", הנוסח העברי ממיפוי ההיסטוריה, תקרות, בלי כתיבות ובלי $transaction.
// הרצה: node scripts/test_my_recent_activity.mjs   (יוצא עם קוד 1 אם משהו נכשל). מומלץ גם עם TZ=America/New_York.
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
  if (url === 'mock:prisma') return { format: 'module', shortCircuit: true, source: 'export default globalThis.__T.prisma; export const getActingEmployeeId = async () => globalThis.__T.me;' };
  if (url === 'mock:auth') return { format: 'module', shortCircuit: true, source: 'const T=globalThis.__T; export const checkAuth=async()=>T.authed; export const getSessionEmployee=async()=>T.session;' };
  if (url === 'mock:permissions') return { format: 'module', shortCircuit: true, source: 'const T=globalThis.__T; export const canOpenPage=async(k)=>{T.asked.push(k);return T.pages.has(k);}; export const hasPermission=async(e,k)=>{T.asked.push(k);return !!e&&(([0,2].includes(e.roleId))||T.grants.has(e.id+"|"+k));};' };
  if (url === 'mock:next-server') return { format: 'module', shortCircuit: true, source: 'export class NextResponse { static json(body, init){ return new Response(JSON.stringify(body), { status:(init&&init.status)||200, headers:{"content-type":"application/json"} }); } }' };
  if (url === 'mock:next-headers') return { format: 'module', shortCircuit: true, source: 'export const cookies=async()=>({get(){return undefined}});' };
  return next(url, ctx);
}
`;
register('data:text/javascript;base64,' + Buffer.from(hooks).toString('base64'), pathToFileURL(root + path.sep));

// ---------------------------------------------------------------- prisma בזיכרון
const T = (globalThis.__T = { authed: true, me: 'emp-me', session: { id: 'emp-me', roleId: 3, isActive: true }, grants: new Set(), pages: new Set(['page:orders']), asked: [], calls: [], db: {}, fail: false });
const cmp = (a, b) => { const x = a instanceof Date ? a.getTime() : a; const y = b instanceof Date ? b.getTime() : b; return x < y ? -1 : x > y ? 1 : 0; };
function matchField(v, c) {
  if (c === null) return v == null;
  if (c instanceof Date || typeof c !== 'object') return cmp(v, c) === 0;
  for (const [op, e] of Object.entries(c)) {
    if (op === 'in') { if (!e.some((x) => cmp(v, x) === 0)) return false; } else if (op === 'not') { if (matchField(v, e)) return false; } else if (op === 'gte') { if (v == null || cmp(v, e) < 0) return false; } else if (op === 'lte') { if (v == null || cmp(v, e) > 0) return false; } else throw new Error('mock: unsupported op ' + op);
  }
  return true;
}
function match(row, where) {
  if (!where) return true;
  for (const [k, c] of Object.entries(where)) {
    if (k === 'OR') { if (!c.some((w) => match(row, w))) return false; } else if (k === 'AND') { if (!c.every((w) => match(row, w))) return false; } else if (!matchField(row[k], c)) return false;
  }
  return true;
}
function model(name) {
  return {
    findMany: async (args = {}) => {
      T.calls.push({ model: name, method: 'findMany', where: args.where, take: args.take });
      if (T.fail) throw new Error('db down');
      let rows = (T.db[name] || []).filter((r) => match(r, args.where));
      if (args.orderBy) {
        const ob = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
        rows = rows.slice().sort((a, b) => { for (const o of ob) { const [f, d] = Object.entries(o)[0]; const c = cmp(a[f], b[f]); if (c) return d === 'desc' ? -c : c; } return 0; });
      }
      if (args.take != null) rows = rows.slice(0, args.take);
      return rows.map((r) => {
        const out = args.select ? Object.fromEntries(Object.entries(r).filter(([k]) => !!args.select[k])) : { ...r }; // select כמו Prisma: שדה שלא נבחר לא חוזר
        if (args.select && args.select.order && r.orderId != null) { const o = (T.db.order || []).find((x) => x.orderId === r.orderId); out.order = o ? { id: o.id } : null; }
        return out;
      });
    },
  };
}
T.prisma = new Proxy({}, {
  get: (_t, p) => {
    if (p === 'then') return undefined;
    if (['auditLog', 'order', 'orderItem', 'payment'].includes(p)) return model(p);
    if (p === 'employee') return {
      findUnique: async (args) => { T.calls.push({ model: 'employee', method: 'findUnique', where: args.where }); if (T.fail) throw new Error('db down'); const e = (T.db.employee || []).find((x) => x.id === args.where.id); return e ? { ...e } : null; },
      findMany: async (args) => { T.calls.push({ model: 'employee', method: 'findMany', where: args.where, take: args.take, select: args.select }); if (!T.db.employee) throw new Error('db down'); const rows = T.db.employee.filter((e) => match(e, args.where)).slice(0, args.take); return rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !!args.select[k]))); },
    };
    throw new Error('mock: אסור לגשת ל-' + String(p) + ' (כתיבה / טרנזקציה / מודל לא צפוי)');
  },
});

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.stack || e.message); process.exitCode = 1; }
}
const lib = await import('../lib/myRecentActivity.js');
const route = await import('../app/api/me/recent-activity/route.js');
const empRoute = await import('../app/api/me/recent-activity/employees/route.js');
const { PERMISSION_CATALOG, defaultValueForRoleId } = await import('../lib/permissionsMetadata.js');

// ---------------------------------------------------------------- נתונים
const NOW = new Date();
const ago = (min) => new Date(NOW.getTime() - min * 60000);
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let aid = 0;
const A = (employeeId, entityType, entityId, action, changes, at) => ({ id: 'a' + ++aid, employeeId, entityType, entityId, action, changesJson: JSON.stringify(changes), createdAt: at });
const orderRow = (n, extra = {}) => ({ id: uid(n), orderId: n, orderDate: ago(60 * 24 * 20), status: 'שולם', isDeleted: false, customer: { firstName: 'רחל', lastName: 'כהן' + n }, ...extra });
const baseOrder = (n) => ({ orderId: n, eventDate: '2026-10-20T00:00:00.000Z', isDelivery: false, notes: null, totalAmount: 900 });

function seed() {
  aid = 0;
  const orders = []; const audit = []; const items = []; const pays = [];
  // 1001: נוצרה על ידי (לפני 30 דק'), ואז בתוך החלון: פריט, תשלום, עדכון סכום - לא "שינוי"
  orders.push(orderRow(1001));
  audit.push(A('emp-me', 'Order', uid(1001), 'CREATE', baseOrder(1001), ago(30)));
  items.push({ id: 'it-1001', orderId: 1001, sizeText: '38', description: null, barcodePrefix: 549, isDeleted: false, dressItem: { barcodePrefix: 549, dress: { name: 'ורד', barcodePrefix: 549 } } });
  audit.push(A('emp-me', 'OrderItem', 'it-1001', 'CREATE', { sizeText: '38' }, ago(30 - 0.5)));
  pays.push({ id: 'pay-1001', orderId: 1001, amount: 450, paymentMethod: 'מזומן', notes: null, paymentDate: ago(29), isDeleted: false, isRefund: false });
  audit.push(A('emp-me', 'Payment', 'pay-1001', 'CREATE', { amount: 450, paymentMethod: 'מזומן' }, ago(29.5)));
  audit.push(A('emp-me', 'Order', uid(1001), 'UPDATE', { totalAmount: 900 }, ago(29.4)));
  // 1002: של אחרת; אני שיניתי את תאריך האירוע (לפני שעה)
  orders.push(orderRow(1002));
  audit.push(A('emp-other', 'Order', uid(1002), 'CREATE', baseOrder(1002), ago(60 * 24 * 10)));
  audit.push(A('emp-me', 'Order', uid(1002), 'UPDATE', { eventDate: '2026-11-02T00:00:00.000Z' }, ago(60)));
  // 1003: בוטלה; 1004: טיוטה - לא מופיעות
  orders.push(orderRow(1003, { isDeleted: true }));
  audit.push(A('emp-me', 'Order', uid(1003), 'CREATE', baseOrder(1003), ago(500)));
  audit.push(A('emp-me', 'Order', uid(1003), 'UPDATE', { eventDate: '2026-11-09T00:00:00.000Z' }, ago(400)));
  orders.push(orderRow(1004, { status: 'טיוטה' }));
  audit.push(A('emp-me', 'Order', uid(1004), 'CREATE', baseOrder(1004), ago(520)));
  // 1005: יצרתי לפני יומיים וערכתי שוב היום -> בשתי הרשימות
  orders.push(orderRow(1005));
  audit.push(A('emp-me', 'Order', uid(1005), 'CREATE', baseOrder(1005), ago(60 * 48)));
  audit.push(A('emp-me', 'Order', uid(1005), 'UPDATE', { isDelivery: true, deliveryCity: 'ירושלים' }, ago(120)));
  // 1006: הוספתי פריט להזמנה של אחרת
  orders.push(orderRow(1006));
  audit.push(A('emp-other', 'Order', uid(1006), 'CREATE', baseOrder(1006), ago(60 * 24 * 5)));
  items.push({ id: 'it-1006', orderId: 1006, sizeText: '40', description: null, barcodePrefix: 551, isDeleted: false, dressItem: { barcodePrefix: 551, dress: { name: 'אלמוג', barcodePrefix: 551 } } });
  audit.push(A('emp-me', 'OrderItem', 'it-1006', 'CREATE', { sizeText: '40' }, ago(200)));
  // 1007: של אחרת, רק אחרת שינתה - לא מופיעה אצלי
  orders.push(orderRow(1007));
  audit.push(A('emp-other', 'Order', uid(1007), 'CREATE', baseOrder(1007), ago(60 * 24 * 3)));
  audit.push(A('emp-other', 'Order', uid(1007), 'UPDATE', { eventDate: '2026-11-11T00:00:00.000Z' }, ago(10)));
  // 1008: ישנה מחוץ לחלון (90 ימים)
  orders.push(orderRow(1008));
  audit.push(A('emp-me', 'Order', uid(1008), 'CREATE', baseOrder(1008), ago(60 * 24 * 90)));
  T.db = { order: orders, auditLog: audit, orderItem: items, payment: pays };
}
const call = async (url = '/api/me/recent-activity') => { T.calls = []; T.asked = []; const res = await route.GET(new Request('http://localhost' + url)); return { status: res.status, body: await res.json() }; };
const reset = () => { T.authed = true; T.me = 'emp-me'; T.session = { id: 'emp-me', roleId: 3, isActive: true }; T.grants = new Set(); T.pages = new Set(['page:orders']); T.fail = false; seed(); T.db.employee = [{ id: 'emp-other', firstName: 'שרה', lastName: 'לוי', fullName: 'שרה לוי', isActive: true, legacyId: 12, wage: 55, pinHash: 'x' }, { id: 'emp-me', firstName: 'דנה', lastName: 'כהן', fullName: 'דנה כהן', isActive: true, legacyId: 11 }, { id: 'emp-gone', firstName: 'נטשה', lastName: 'ישנה', fullName: 'נטשה ישנה', isActive: false, legacyId: 13 }, { id: 'emp-svc', firstName: 'מפתח', lastName: 'API', fullName: 'מפתח API', isActive: true, legacyId: 900001 }]; };
// מנהלת סניף / הנהלה ראשית כמחוברת (העוגייה החתומה): me = המזהה, session = העובדת מהעוגייה
const as = (id, roleId) => { T.me = id; T.session = { id, roleId, isActive: true }; };
const callEmp = async () => { T.calls = []; T.asked = []; const res = await empRoute.GET(); return { status: res.status, body: await res.json() }; };

// ---------------------------------------------------------------- 1) הלוגיקה הטהורה
console.log('lib/myRecentActivity.js');
await t('activitySince: תחילת היום הישראלי לפני 60 יום (לא תלוי באזור הזמן של התהליך)', () => {
  const s = lib.activitySince(new Date('2026-10-04T10:00:00Z'));
  assert.equal(s.toISOString(), '2026-08-04T21:00:00.000Z'); // 5.8 00:00 שעון ישראל (קיץ, UTC+3)... 60 יום אחורה מ-4.10 = 5.8
  assert.equal(lib.activitySince(new Date('2026-10-04T22:30:00Z')).toISOString(), '2026-08-05T21:00:00.000Z'); // 5.10 בבוקר שעון ישראל -> היום הישראלי הבא
});
await t('pickCandidates: שורה בתוך חלון היצירה (דקה) היא לא שינוי, מחוץ לחלון כן; הזמנה אחת פעם אחת', () => {
  const at = (m) => new Date(1e12 + m * 60000).toISOString();
  const rows = [
    { entityType: 'Order', action: 'CREATE', createdAt: at(0), orderNumber: 1 },
    { entityType: 'OrderItem', action: 'CREATE', createdAt: at(0.2), orderNumber: 1 },
    { entityType: 'Order', action: 'UPDATE', createdAt: at(0.9), orderNumber: 1 },
    { entityType: 'Order', action: 'UPDATE', createdAt: at(11), orderNumber: 1 },
    { entityType: 'Order', action: 'UPDATE', createdAt: at(50), orderNumber: 1 },
    { entityType: 'Order', action: 'UPDATE', createdAt: at(5), orderNumber: 2 },
  ];
  const c = lib.pickCandidates(rows);
  assert.deepEqual(c.created.map((x) => x.orderNumber), [1]);
  assert.deepEqual(c.changed.map((x) => x.orderNumber), [1, 2]);
  assert.equal(c.changed[0].at, 1e12 + 50 * 60000, 'הרגע האחרון של העריכה');
});
await t('pickCandidates (טיוטה): CREATE 10:00, שמירה סופית (טיוטה->פעילה) 10:25, פריט + תשלום 10:25:01 -> created=[הזמנה] ברגע 10:25, changed=[]', () => {
  const at = (m, sec = 0) => new Date(Date.UTC(2026, 9, 4, 7, 0 + m, sec)).toISOString(); // 10:00 שעון ישראל = 07:00Z
  const rows = [
    { id: 'r1', entityType: 'Order', action: 'CREATE', createdAt: at(0), orderNumber: 7, changesJson: JSON.stringify({ status: 'טיוטה' }) },
    { id: 'r2', entityType: 'Order', action: 'UPDATE', createdAt: at(25), orderNumber: 7, changesJson: JSON.stringify({ status: { from: 'טיוטה', to: 'פעילה' } }) },
    { id: 'r3', entityType: 'OrderItem', action: 'CREATE', createdAt: at(25, 1), orderNumber: 7 },
    { id: 'r4', entityType: 'Payment', action: 'CREATE', createdAt: at(25, 1), orderNumber: 7 },
  ];
  const c = lib.pickCandidates(rows);
  assert.deepEqual(c.created.map((x) => x.orderNumber), [7]);
  assert.equal(c.created[0].at, Date.parse(at(25)), 'רגע היצירה = השמירה הסופית, לא תחילת הטיוטה');
  assert.deepEqual(c.changed, []);
});
await t('pickCandidates (טיוטה): שמירות טיוטה באמצע הן חלק מהיצירה; ערך סטטוס פשוט (בלי from) מזוהה לפי ה-CREATE; עריכה אחרי השמירה הסופית היא שינוי', () => {
  const at = (m, sec = 0) => new Date(Date.UTC(2026, 9, 4, 7, 0 + m, sec)).toISOString();
  const rows = [
    { id: 'r1', entityType: 'Order', action: 'CREATE', createdAt: at(0), orderNumber: 8, changesJson: JSON.stringify({ status: 'טיוטה', orderId: 8 }) },
    { id: 'r2', entityType: 'Order', action: 'UPDATE', createdAt: at(10), orderNumber: 8, changesJson: JSON.stringify({ status: 'טיוטה' }) },
    { id: 'r3', entityType: 'Order', action: 'UPDATE', createdAt: at(30), orderNumber: 8, changesJson: JSON.stringify({ status: 'פעילה', isDeleted: false }) },
    { id: 'r4', entityType: 'OrderItem', action: 'CREATE', createdAt: at(30, 2), orderNumber: 8 },
    { id: 'r5', entityType: 'Order', action: 'UPDATE', createdAt: at(90), orderNumber: 8, changesJson: JSON.stringify({ notes: { from: '', to: 'x' } }) },
  ];
  const c = lib.pickCandidates(rows);
  assert.equal(c.created[0].at, Date.parse(at(30)));
  assert.deepEqual(c.changed.map((x) => [x.orderNumber, x.at]), [[8, Date.parse(at(90))]]);
});
await t('pickCandidates: הזמנה שנוצרה לא כטיוטה - שינוי סטטוס רגיל אחרי היצירה לא נחשב שמירה סופית', () => {
  const at = (m) => new Date(Date.UTC(2026, 9, 4, 7, m, 0)).toISOString();
  const rows = [
    { id: 'r1', entityType: 'Order', action: 'CREATE', createdAt: at(0), orderNumber: 9, changesJson: JSON.stringify({ status: 'פעילה' }) },
    { id: 'r2', entityType: 'Order', action: 'UPDATE', createdAt: at(25), orderNumber: 9, changesJson: JSON.stringify({ status: { from: 'פעילה', to: 'שולם' } }) },
  ];
  const c = lib.pickCandidates(rows);
  assert.equal(c.created[0].at, Date.parse(at(0)));
  assert.deepEqual(c.changed.map((x) => x.orderNumber), [9]);
});
await t('pickCandidates: בלי שורות -> רשימות ריקות', () => {
  const c = lib.pickCandidates([]);
  assert.equal(c.created.length + c.changed.length, 0);
});
await t('collectRefs / attachOrderNumbers: שורה שאי אפשר לשייך להזמנה נזרקת', () => {
  const rows = [{ entityType: 'Order', entityId: uid(1) }, { entityType: 'Order', entityId: '77' }, { entityType: 'OrderItem', entityId: 'i1' }, { entityType: 'Payment', entityId: 'p1' }, { entityType: 'OrderItem', entityId: 'zzz' }];
  const refs = lib.collectRefs(rows);
  assert.deepEqual(refs.orderNumbers, [77]); assert.deepEqual(refs.orderUuids, [uid(1)]);
  const out = lib.attachOrderNumbers(rows, { uuidToNumber: new Map([[uid(1), 1]]), itemToOrder: new Map([['i1', 5]]), paymentToOrder: new Map() });
  assert.deepEqual(out.map((r) => r.orderNumber), [1, 77, 5]);
});

// ---------------------------------------------------------------- 2) הנתיב
console.log('GET /api/me/recent-activity');
await t('לא מחוברת: 401, בלי שאילתות', async () => { reset(); T.authed = false; const r = await call(); assert.equal(r.status, 401); assert.equal(T.calls.length, 0); });
await t('בלי page:orders: 403, בלי שאילתות; ההרשאה שנבדקת היא page:orders', async () => { reset(); T.pages = new Set(); const r = await call(); assert.equal(r.status, 403); assert.equal(T.calls.length, 0); assert.deepEqual(T.asked, ['page:orders']); });
await t('מצב פתוח (אין זהות): 200, רשימות ריקות, anonymous, בלי שאילתות', async () => { reset(); T.me = null; const r = await call(); assert.equal(r.status, 200); assert.deepEqual(r.body, { created: [], changed: [], anonymous: true }); assert.equal(T.calls.length, 0); });
await t('?employeeId של עובדת אחרת: עובדת רגילה 403 (בלי שאילתות); ?employeeId של עצמי: 200', async () => {
  reset(); assert.equal((await call('/api/me/recent-activity?employeeId=emp-other')).status, 403); assert.equal(T.calls.length, 0);
  assert.equal((await call('/api/me/recent-activity?employeeId=emp-me')).status, 200);
});
console.log('MY-04: הנהלה עוברת לעובדת אחרת');
await t('המפתח הוא feature:view_others_recent_activity: enforced, ברירת מחדל הנהלה ראשית ומתכנת בלבד', () => {
  const item = PERMISSION_CATALOG.find((i) => i.key === 'feature:view_others_recent_activity');
  assert.ok(item && item.group === 'features' && item.type === 'boolean' && item.enforced === true);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((r) => defaultValueForRoleId(item, r)), [true, false, true, false, false, false, false]);
});
await t('מנהלת סניף (roleId 1) -> עובדת אחרת: 403, בלי שאילתות', async () => {
  reset(); as('emp-me', 1); const r = await call('/api/me/recent-activity?employeeId=emp-other'); assert.equal(r.status, 403); assert.equal(T.calls.length, 0);
});
await t('עובדת רגילה -> עובדת אחרת: 403 גם כשהיא שולחת מזהה קיים', async () => {
  reset(); as('emp-me', 3); const r = await call('/api/me/recent-activity?employeeId=emp-other'); assert.equal(r.status, 403); assert.equal(T.calls.length, 0);
});
await t('הרשאה שניתנה במפורש (שורת הרשאה) למנהלת סניף: 200 - הנאכף הוא המפתח, לא התפקיד', async () => {
  reset(); as('emp-me', 1); T.grants.add('emp-me|feature:view_others_recent_activity'); const r = await call('/api/me/recent-activity?employeeId=emp-other'); assert.equal(r.status, 200);
});
await t('הנהלה ראשית (0) ומתכנת (2) -> עובדת אחרת: 200 עם הרשימות של האחרת, לא שלי', async () => {
  for (const role of [0, 2]) {
    reset(); as('emp-me', role);
    const r = await call('/api/me/recent-activity?employeeId=emp-other');
    assert.equal(r.status, 200, 'role ' + role);
    assert.deepEqual(r.body.created.map((x) => x.orderNumber), [1007, 1006, 1002]);
    assert.deepEqual(r.body.changed.map((x) => x.orderNumber), [1007]);
    assert.ok(!JSON.stringify(r.body).includes('emp-'), 'אין מזהי עובדות בתשובה');
  }
});
await t('הנהלה: כל שאילתות היומן מסוננות לפי העובדת שנבחרה (לא לפי הנהלה), ורק קריאות', async () => {
  reset(); as('emp-me', 0); await call('/api/me/recent-activity?employeeId=emp-other');
  const audit = T.calls.filter((c) => c.model === 'auditLog' && c.where && c.where.employeeId);
  assert.ok(audit.length >= 1); for (const c of audit) assert.equal(c.where.employeeId, 'emp-other');
  for (const c of T.calls) assert.ok(c.method === 'findMany' || (c.model === 'employee' && c.method === 'findUnique'));
  assert.ok(T.asked.includes('page:orders') && T.asked.includes('feature:view_others_recent_activity'));
});
await t('הנהלה בלי page:orders: 403 עוד לפני ההרשאה לצפות באחרות', async () => {
  reset(); as('emp-me', 0); T.pages = new Set(); const r = await call('/api/me/recent-activity?employeeId=emp-other'); assert.equal(r.status, 403); assert.equal(T.calls.length, 0);
});
await t('הנהלה: מזהה לא מוכר / עובדת לא פעילה / עובד שירות: 404', async () => {
  for (const id of ['emp-nobody', 'emp-gone', 'emp-svc']) { reset(); as('emp-me', 0); const r = await call('/api/me/recent-activity?employeeId=' + id); assert.equal(r.status, 404, id); }
});
await t('הנהלה: ?employeeId של עצמה = הרשימה שלה (בלי בדיקת עובדת אחרת)', async () => {
  reset(); as('emp-me', 0); const r = await call('/api/me/recent-activity?employeeId=emp-me'); assert.equal(r.status, 200); assert.ok(!T.calls.some((c) => c.model === 'employee'));
  assert.deepEqual(r.body.created.map((x) => x.orderNumber), [1001, 1005]);
});
await t('עוגייה מזויפת (getActingEmployeeId = null): תשובת anonymous גם עם ?employeeId, בלי שאילתות', async () => {
  reset(); T.me = null; T.session = null; const r = await call('/api/me/recent-activity?employeeId=emp-other'); assert.equal(r.status, 200); assert.deepEqual(r.body, { created: [], changed: [], anonymous: true }); assert.equal(T.calls.length, 0);
});
await t('העוגייה החתומה לא של אותה זהות (session אחר מ-me): נסגר ל-403, גם אם ה-session הנהלה', async () => {
  reset(); T.me = 'emp-me'; T.session = { id: 'emp-boss', roleId: 0, isActive: true }; const r = await call('/api/me/recent-activity?employeeId=emp-other'); assert.equal(r.status, 403);
});
await t('אין session (getSessionEmployee = null) עם זהות: 403 לעובדת אחרת', async () => {
  reset(); T.session = null; const r = await call('/api/me/recent-activity?employeeId=emp-other'); assert.equal(r.status, 403);
});
console.log('GET /api/me/recent-activity/employees');
await t('הנהלה: שמות ומזהים בלבד, פעילות בלבד, בלי עובדי שירות, בלי שכר / קוד', async () => {
  reset(); as('emp-me', 0); const r = await callEmp();
  assert.equal(r.status, 200);
  assert.equal(r.body.meId, 'emp-me');
  assert.deepEqual(r.body.employees.map((e) => e.id).sort(), ['emp-me', 'emp-other']);
  for (const e of r.body.employees) assert.deepEqual(Object.keys(e).sort(), ['id', 'name']);
  const text = JSON.stringify(r.body); assert.ok(!/wage|pin|55|900001|API/.test(text));
  const q = T.calls.find((c) => c.model === 'employee'); assert.ok(q.take > 0 && q.where.isActive === true);
  assert.ok(!('wage' in q.select) && !('pinHash' in q.select) && !('password' in q.select));
});
await t('מנהלת סניף / עובדת רגילה: 403 בלי שאילתת עובדים; לא מחוברת 401; בלי זהות (עוגייה מזויפת) 403', async () => {
  reset(); as('emp-me', 1); let r = await callEmp(); assert.equal(r.status, 403); assert.ok(!T.calls.some((c) => c.model === 'employee'));
  reset(); as('emp-me', 3); r = await callEmp(); assert.equal(r.status, 403);
  reset(); T.authed = false; r = await callEmp(); assert.equal(r.status, 401);
  reset(); T.me = null; T.session = null; r = await callEmp(); assert.equal(r.status, 403);
  reset(); as('emp-me', 0); T.pages = new Set(); r = await callEmp(); assert.equal(r.status, 403);
});
await t('כשל DB ברשימת העובדות: 200 עם רשימה ריקה ו-degraded', async () => {
  reset(); as('emp-me', 0); T.db.employee = null;
  const r = await callEmp(); assert.equal(r.status, 200); assert.deepEqual(r.body, { employees: [], meId: 'emp-me', degraded: true });
});
await t('created: רק מה שיצרתי, החדש ראשון; בוטלה / טיוטה / מחוץ לחלון לא מופיעות', async () => {
  reset(); const r = await call();
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.created.map((x) => x.orderNumber), [1001, 1005]);
  assert.deepEqual(Object.keys(r.body.created[0]).sort(), ['createdAt', 'customerName', 'id', 'orderNumber']);
  assert.equal(r.body.created[0].customerName, 'רחל כהן1001');
  assert.equal(r.body.created[0].id, uid(1001));
  assert.equal(r.body.created[0].orderNumber, 1001);
});
await t('changed: הזמנה שיצרתי לא נכנסת בגלל מה שנכתב בזמן היצירה; כן אם ערכתי אחרי; הזמנה של אחרת שערכתי כן', async () => {
  reset(); const r = await call();
  assert.deepEqual(r.body.changed.map((x) => x.orderNumber), [1002, 1005, 1006]);
  assert.ok(!r.body.changed.some((x) => [1001, 1003, 1004, 1007, 1008].includes(x.orderNumber)));
  assert.deepEqual(Object.keys(r.body.changed[0]).sort(), ['customerName', 'id', 'lastChangeAt', 'lastChangeLabelHe', 'orderNumber']);
});
await t('הנוסח העברי הוא של מיפוי ההיסטוריה (תאריך האירוע / משלוח / פריט) ובלי מזהים גולמיים', async () => {
  reset(); const r = await call();
  const by = Object.fromEntries(r.body.changed.map((x) => [x.orderNumber, x.lastChangeLabelHe]));
  assert.match(by[1002], /תאריך האירוע/);
  assert.match(by[1005], /משלוח/);
  assert.match(by[1006], /נוסף פריט/);
  assert.match(by[1006], /דגם 551/);
  const text = JSON.stringify(r.body);
  assert.ok(!/emp-me|emp-other/.test(text), 'מזהה עובדת לא יוצא החוצה');
  for (const x of r.body.changed) assert.ok(!Number.isNaN(Date.parse(x.lastChangeAt)));
});
await t('הרשימה של אחרת לא דולפת: שורות של emp-other לא נכנסות כשינוי שלי', async () => {
  reset(); T.me = 'emp-other'; const r = await call();
  assert.deepEqual(r.body.created.map((x) => x.orderNumber), [1007, 1006, 1002]);
  assert.deepEqual(r.body.changed.map((x) => x.orderNumber), [1007]);
  assert.match(r.body.changed[0].lastChangeLabelHe, /תאריך האירוע/);
});
await t('כל שאילתת יומן מסוננת לפי ה-employeeId שלי ויש לה חלון זמן; לכל שאילתה take; רק קריאות (אין כתיבה / $transaction)', async () => {
  reset(); await call();
  const first = T.calls.filter((c) => c.model === 'auditLog' && c.where && c.where.employeeId);
  assert.equal(first.length, 2, 'שאילתת סבב 1 (אחת) + שורות Order של העובדת לפי entityId');
  for (const c of first) { assert.equal(c.where.employeeId, 'emp-me'); assert.ok(c.where.createdAt && c.where.createdAt.gte instanceof Date); }
  assert.equal(first.filter((c) => !c.where.entityId).length, 1, 'סבב 1 הוא שאילתה אחת');
  for (const c of T.calls) { assert.equal(c.method, 'findMany'); assert.ok(Number.isFinite(c.take) && c.take > 0, 'חסר take: ' + c.model); }
  assert.ok(T.calls.length <= 10, 'כמות השאילתות ממוקדת, לא N+1: ' + T.calls.length);
});
await t('בלי N+1: כמות השאילתות לא תלויה בכמות ההזמנות', async () => {
  reset();
  for (let n = 2000; n < 2040; n++) { T.db.order.push(orderRow(n)); T.db.auditLog.push(A('emp-other', 'Order', uid(n), 'CREATE', baseOrder(n), ago(60 * 24 * 8))); T.db.auditLog.push(A('emp-me', 'Order', uid(n), 'UPDATE', { eventDate: '2026-11-0' + (1 + (n % 9)) + 'T00:00:00.000Z' }, ago(1000 + n))); }
  const small = (reset(), await call()); const smallCalls = T.calls.length;
  reset();
  for (let n = 2000; n < 2040; n++) { T.db.order.push(orderRow(n)); T.db.auditLog.push(A('emp-other', 'Order', uid(n), 'CREATE', baseOrder(n), ago(60 * 24 * 8))); T.db.auditLog.push(A('emp-me', 'Order', uid(n), 'UPDATE', { eventDate: '2026-11-0' + (1 + (n % 9)) + 'T00:00:00.000Z' }, ago(1000 + n))); }
  const big = await call();
  assert.equal(T.calls.length, smallCalls);
  assert.ok(small.body.changed.length <= 20 && big.body.changed.length === 20, 'תקרת 20 בכל רשימה: ' + big.body.changed.length);
  const ts = big.body.changed.map((x) => Date.parse(x.lastChangeAt)); assert.deepEqual(ts.slice().sort((a, b) => b - a), ts, 'החדש ראשון');
});
await t('הזמנה חדשה דרך טיוטה (CREATE, שמירה סופית 25 דק׳ אחר כך, פריט + תשלום אחריה) מופיעה רק ב"נוצרו" ברגע השמירה הסופית, ולא ב"שינויים"', async () => {
  reset();
  const D = new Date(Date.now() - 6 * 3600000); const at = (m, sec = 0) => new Date(D.getTime() + m * 60000 + sec * 1000);
  T.db.order.push(orderRow(3001));
  T.db.orderItem.push({ id: 'it-3001', orderId: 3001, sizeText: '38', description: null, barcodePrefix: 549, isDeleted: false, dressItem: { barcodePrefix: 549, dress: { name: 'ורד', barcodePrefix: 549 } } });
  T.db.payment.push({ id: 'pay-3001', orderId: 3001, amount: 100, paymentMethod: 'מזומן', notes: null, paymentDate: at(25), isDeleted: false, isRefund: false });
  T.db.auditLog.push(
    A('emp-me', 'Order', uid(3001), 'CREATE', { ...baseOrder(3001), status: 'טיוטה' }, at(0)),
    A('emp-me', 'Order', uid(3001), 'UPDATE', { status: 'טיוטה', notes: 'a' }, at(12)),
    A('emp-me', 'Order', uid(3001), 'UPDATE', { status: 'שולם', isDeleted: false }, at(25)),
    A('emp-me', 'OrderItem', 'it-3001', 'CREATE', { sizeText: '38' }, at(25, 1)),
    A('emp-me', 'Payment', 'pay-3001', 'CREATE', { amount: 100 }, at(25, 1)),
  );
  const r = await call();
  const c = r.body.created.find((x) => x.orderNumber === 3001);
  assert.ok(c, 'ב"נוצרו"');
  assert.equal(c.createdAt, at(25).toISOString(), 'createdAt = השמירה הסופית');
  assert.ok(!r.body.changed.some((x) => x.orderNumber === 3001), 'לא ב"שינויים"');
  // עריכה אמיתית אחר כך -> גם ב"שינויים"
  T.db.auditLog.push(A('emp-me', 'Order', uid(3001), 'UPDATE', { eventDate: '2026-11-09T00:00:00.000Z' }, at(120)));
  const r2 = await call();
  assert.ok(r2.body.created.some((x) => x.orderNumber === 3001) && r2.body.changed.some((x) => x.orderNumber === 3001));
});
await t('הזמנה שנוצרה לפני שורות רבות (CREATE מחוץ לתקרת השאילתה הראשונה, "נוסף פריט" בפנים): לא נחשב שינוי והיא ב"נוצרו"', async () => {
  reset();
  const base = Date.now() - 3 * 86400000;
  T.db.order.push(orderRow(4001));
  T.db.orderItem.push({ id: 'it-4001', orderId: 4001, sizeText: '38', description: null, barcodePrefix: 549, isDeleted: false, dressItem: { barcodePrefix: 549, dress: { name: 'ורד', barcodePrefix: 549 } } });
  T.db.auditLog.push(A('emp-me', 'Order', uid(4001), 'CREATE', baseOrder(4001), new Date(base)), A('emp-me', 'OrderItem', 'it-4001', 'CREATE', { sizeText: '38' }, new Date(base + 30000)));
  const mineNow = T.db.auditLog.filter((x) => x.employeeId === 'emp-me' && x.createdAt.getTime() > Date.now() - 30 * 86400000).length; // כולל שורות הנתונים הקבועים (חדשות יותר מהמילוי)
  for (let i = 0; i < lib.MY_ACTIVITY_LIMITS.auditRows - mineNow + 1; i++) T.db.auditLog.push(A('emp-me', 'Payment', 'filler-' + i, 'UPDATE', { amount: 1 }, new Date(base + 60000 + i * 1000)));
  const r = await call();
  assert.ok(r.body.created.some((x) => x.orderNumber === 4001), 'נטענה שורת ה-CREATE לפי entityId');
  assert.ok(!r.body.changed.some((x) => x.orderNumber === 4001), 'אין "נוסף פריט" שקרי');
  assert.ok(lib.MY_ACTIVITY_LIMITS.createAuditRows >= lib.MY_ACTIVITY_LIMITS.auditRows);
});
await t('שורות הסבב הראשון: שאילתה אחת לכל סוגי השורות; שורות ה-Order הנוספות לפי entityId (uuid) בלבד', async () => {
  reset(); await call();
  const audit = T.calls.filter((c) => c.model === 'auditLog' && c.where && c.where.employeeId);
  const round1 = audit.filter((c) => !c.where.entityId);
  assert.equal(round1.length, 1);
  assert.deepEqual([...round1[0].where.entityType.in].sort(), ['Order', 'OrderItem', 'Payment']);
  const extra = audit.find((c) => c.where.entityId);
  assert.ok(extra && Array.isArray(extra.where.entityId.in) && extra.where.entityId.in.length > 0 && extra.where.entityType === 'Order');
});
await t('הקישור לפי מספר הזמנה: orderNumber בתשובה, id הוא uuid', async () => {
  reset(); const r = await call();
  for (const x of [...r.body.created, ...r.body.changed]) { assert.equal(typeof x.orderNumber, 'number'); assert.match(x.id, /^0000/); assert.ok(!('orderId' in x)); }
});
await t('כשל DB: 200 עם רשימות ריקות ו-degraded (לא 500)', async () => {
  reset(); T.fail = true; const r = await call(); assert.equal(r.status, 200); assert.deepEqual(r.body, { created: [], changed: [], degraded: true });
});
await t('עובדת בלי פעולות: רשימות ריקות', async () => { reset(); T.me = 'emp-nobody'; const r = await call(); assert.deepEqual(r.body, { created: [], changed: [] }); });
await t('מקור הנתונים: הנתיב לא כותב ל-AuditLog ולא משתמש ב-$transaction', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(path.join(root, 'app/api/me/recent-activity/route.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/\$transaction|auditLog\.(create|update|delete|upsert)|\.createMany|\.updateMany|\.deleteMany/.test(src));
});

console.log(`\n${passed} passed`);
