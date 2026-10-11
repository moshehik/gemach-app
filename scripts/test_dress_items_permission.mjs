// בדיקות: הרשאת "ניהול פריטי דגם" (feature:dress_items_manage, החלטת הבעלים 11.10.2026 - D1) ושם דגם כפול (400 ברור במקום 500).
// בלי DB ובלי Next: מודולי השרת האמיתיים (נתיבי ה-API, lib/dressItemAccess.js, lib/permissions.js, lib/dressNameConflict.js) רצים מול prisma בזיכרון.
//   1) הקטלוג: הפריט קיים, סגור כברירת מחדל לכל תפקיד (גם מנהל סניף), הנהלה ראשית ומתכנת תמיד, משויך לקטגוריה בכרטיס העובד.
//   2) ההכרעה (lib/permissions.js האמיתי): ברירת מחדל סגורה; חריגה אישית; שורת מחלקה; חריגה גוברת על מחלקה; הנהלה/מתכנת תמיד; עובד מושבת.
//   3) המטריצה בנתיבים האמיתיים: אורח 401, מושבת 401, בלי הרשאה 403 (וה-DB לא נכתב), עם הרשאה 200, הנהלה/מתכנת 200; עריכת הדגם עצמו לא מושפעת.
//   4) מניפסט סטטי: כל מי שכותב DressItem בקוד - מסומן ומוגן או ברשימה המותרת (זרימות הזמנה); הלקוחות (כרטיס חדש / ישן) מסתירים את הבקרות.
//   5) שם דגם כפול: POST /api/dresses ו-PUT /api/dresses/[id] מחזירים 400 {error, field:'name'} (פעיל / מחוק / רישיות ורווחים / שם אוטומטי / P2002),
//      בלי דליפה לקוראים לא מורשים; האשף החדש והכרטיס החדש מציגים את ההודעה ליד השדה.
// הרצה: node scripts/test_dress_items_permission.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  [/[\\\\/]lib[\\\\/]authTokens\\.js$/, 'authTokens'],
  [/[\\\\/]lib[\\\\/]dbMode\\.js$/, 'dbMode'],
  [/[\\\\/]lib[\\\\/]settingsCache\\.js$/, 'settingsCache'],
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
  if (url === 'mock:prisma') return { format: 'module', shortCircuit: true, source: 'export default globalThis.__T.prisma; export const auditAs = (a, d, c) => d;' };
  if (url === 'mock:auth') return { format: 'module', shortCircuit: true, source: 'const T=globalThis.__T; export const checkAuth=(r)=>T.checkAuth(r); export const getSessionEmployee=async()=>T.sessionEmployee(); export const readVerifiedSession=()=>null;' };
  if (url === 'mock:authTokens') return { format: 'module', shortCircuit: true, source: 'export const getVerifiedAuthCookie=()=>null;' };
  if (url === 'mock:dbMode') return { format: 'module', shortCircuit: true, source: 'export const currentDbModeTag=()=>"test"; export const isDeviceBackupRequest=()=>false;' };
  if (url === 'mock:settingsCache') return { format: 'module', shortCircuit: true, source: 'export const getCachedSetting=async()=>null; export const getAllCachedSettings=async()=>[];' };
  if (url === 'mock:next-server') return { format: 'module', shortCircuit: true, source: 'export class NextResponse { static json(body, init){ return new Response(JSON.stringify(body), { status:(init&&init.status)||200, headers:{"Content-Type":"application/json"} }); } }' };
  if (url === 'mock:next-headers') return { format: 'module', shortCircuit: true, source: 'export const cookies=async()=>({get(){return undefined}});' };
  return next(url, ctx);
}
`;
register('data:text/javascript;base64,' + Buffer.from(hooks).toString('base64'), pathToFileURL(root + path.sep));

// ---------------------------------------------------------------- prisma בזיכרון
const ROLE_LEVELS = { 'מנהל': [1, 2], 'מתכנת': [2], 'הנהלה ראשית': [0, 2] };
const T = (globalThis.__T = {
  session: null, // { id, roleId, isActive } | null (אורח)
  failUpdateWith: null,
  openMode: false,
  db: {},
  writes: [],
  failCreateWith: null,
  checkAuth: async (role) => {
    const s = T.session;
    if (!s) return T.openMode && !role;
    if (s.isActive === false) return false;
    if (!role) return true;
    return (ROLE_LEVELS[role] || []).includes(s.roleId);
  },
  sessionEmployee: async () => (T.session && T.session.isActive !== false ? { id: T.session.id, roleId: T.session.roleId, isActive: true } : null),
});

const lower = (s) => String(s == null ? '' : s).toLowerCase();
function matchField(v, c) {
  if (c === null) return v == null;
  if (c instanceof Date || typeof c !== 'object') return v === c;
  for (const [op, e] of Object.entries(c)) {
    if (op === 'not') { if (matchField(v, e)) return false; }
    else if (op === 'equals') { if (c.mode === 'insensitive' ? lower(v) !== lower(e) : v !== e) return false; }
    else if (op === 'mode') { /* handled with equals */ }
    else if (op === 'in') { if (!e.includes(v)) return false; }
    else throw new Error('mock: unsupported operator ' + op);
  }
  return true;
}
function match(row, where) {
  if (!where) return true;
  for (const [k, c] of Object.entries(where)) {
    if (k === 'OR') { if (!c.some((w) => match(row, w))) return false; }
    else if (k === 'dress') { if (row.dressModelId !== c.id) return false; }
    else if (!matchField(row[k], c)) return false;
  }
  return true;
}
const tbl = (n) => (T.db[n] = T.db[n] || []);
function crud(name, { onWrite } = {}) {
  return {
    findMany: async (a = {}) => tbl(name).filter((r) => match(r, a.where)).map((r) => ({ ...r })),
    findFirst: async (a = {}) => {
      let rows = tbl(name).filter((r) => match(r, a.where));
      if (a.orderBy) { const [[f, d]] = Object.entries(Array.isArray(a.orderBy) ? a.orderBy[0] : a.orderBy); rows = rows.slice().sort((x, y) => (x[f] === y[f] ? 0 : (x[f] > y[f] ? 1 : -1) * (d === 'desc' ? -1 : 1))); }
      return rows[0] ? { ...rows[0] } : null;
    },
    findUnique: async (a) => {
      const w = a.where;
      const key = w.roleId_key || w.employeeId_key;
      const rows = tbl(name).filter((r) => (key ? Object.entries(key).every(([k, v]) => r[k] === v) : match(r, w)));
      return rows[0] ? { ...rows[0] } : null;
    },
    count: async (a = {}) => tbl(name).filter((r) => match(r, a.where)).length,
    create: async (a) => {
      if (T.failCreateWith && name === 'dressModel') throw T.failCreateWith;
      const row = { id: `${name}-${tbl(name).length + 1}`, ...a.data };
      tbl(name).push(row); T.writes.push({ model: name, op: 'create', data: a.data }); return { ...row };
    },
    update: async (a) => {
      if (T.failUpdateWith && name === 'dressModel') throw T.failUpdateWith;
      const row = tbl(name).find((r) => match(r, a.where));
      if (!row) throw new Error('P2025');
      Object.assign(row, Object.fromEntries(Object.entries(a.data).filter(([, v]) => v !== undefined)));
      T.writes.push({ model: name, op: 'update', where: a.where, data: a.data }); return { ...row };
    },
  };
}
T.prisma = new Proxy({}, {
  get: (_t, p) => {
    if (p === 'then') return undefined;
    if (['departmentPermission', 'employeePermissionOverride', 'dressItem', 'dressModel'].includes(p)) return crud(p);
    if (p === 'priceList') return { findMany: async () => (T.db.priceList || []).map((r) => ({ category: r.category })) }; // POST /api/dresses validates the category against the price list (empty list = no check)
    if (p === '$transaction') return async (fn) => fn(T.prisma); // the merged POST routes create inside a transaction
    if (p === '$executeRaw') return async () => 0; // pg_advisory_xact_lock
    throw new Error('mock: unexpected prisma model ' + String(p));
  },
});

let passed = 0;
async function t(name, fn) {
  const ce = console.error; // quiet() mutes the expected 500 logs of the routes; restore before reporting
  try { await fn(); console.error = ce; passed++; console.log('  ok   -', name); } catch (e) { console.error = ce; console.error('  FAIL -', name, '\n        ', e.stack || e.message); process.exitCode = 1; }
}
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

const KEY = 'feature:dress_items_manage';
const access = await import('../lib/dressItemAccess.js');
const perms = await import('../lib/permissions.js');
const meta = await import('../lib/permissionsMetadata.js');
const groups = await import('../lib/employeeCardPermGroups.js');
const nameLib = await import('../lib/dressNameConflict.js');
const itemsRoute = await import('../app/api/dresses/[id]/items/route.js');
const itemRoute = await import('../app/api/dresses/items/[itemId]/route.js');
const dressesRoute = await import('../app/api/dresses/route.js');
const dressRoute = await import('../app/api/dresses/[id]/route.js');
const wizLogic = await import('../app/components/dress-new/modelNewLogic.js');

// ================================================================ 1. הקטלוג
console.log('1. הקטלוג');
await t('feature:dress_items_manage: פריט בוליאני, enforced, בקבוצת features, סגור כברירת מחדל לכל תפקיד (גם מנהל סניף)', () => {
  const item = meta.getCatalogItem(KEY);
  assert.ok(item, 'חסר בקטלוג');
  assert.equal(access.DRESS_ITEMS_MANAGE_KEY, KEY);
  assert.equal(item.group, 'features'); assert.equal(item.type, 'boolean'); assert.equal(item.enforced, true);
  assert.equal(item.approver, undefined); assert.equal(item.notConfigurable, undefined, 'ניתן להגדרה בחלון שורת ההרשאה');
  assert.match(item.label, /ניהול פריטי דגם/);
  for (const roleId of [0, 1, 2, 3, 4, 5, 90, null, undefined]) assert.equal(meta.defaultValueForRoleId(item, roleId), false, `ברירת מחדל לתפקיד ${roleId} חייבת להיות סגורה`);
  assert.deepEqual(meta.ALWAYS_ALLOWED_ROLE_IDS, [0, 2]);
  assert.ok(item.note && item.userNote && item.description);
  assert.ok(!/[a-zA-Z]/.test(item.userNote), 'userNote בעברית פשוטה, בלי מונחי קוד');
  assert.match(item.note, /requireDressItemManager/); assert.match(item.note, /rentals\/confirm/, 'ההערה מונה את הזרימות שנשארו פתוחות');
  assert.equal(meta.PERMISSION_CATALOG.filter((i) => i.key === KEY).length, 1);
  assert.equal(new Set(meta.PERMISSION_CATALOG.map((i) => i.key)).size, meta.PERMISSION_CATALOG.length);
});
await t('כרטיס העובד: הפריט בקטגוריה "קטלוג ותיקונים" (לא ב"אחר")', () => {
  assert.equal(groups.categoryOfKey(KEY), 'catalog');
});

// ================================================================ 2. הכרעת ההרשאה (lib/permissions.js האמיתי)
console.log('2. הכרעה: ברירת מחדל, חריגה אישית, מחלקה, הנהלה, מתכנת, מושבת');
const emp = (id, roleId) => ({ id, roleId });
function reset() {
  T.session = null; T.openMode = false; T.writes = []; T.failCreateWith = null; T.failUpdateWith = null;
  T.db = { departmentPermission: [], employeePermissionOverride: [], dressItem: [], dressModel: [] };
  perms.invalidatePermissionCache();
}
const grantEmp = (employeeId, value) => tbl('employeePermissionOverride').push({ employeeId, key: KEY, value: String(value) });
const grantDept = (roleId, value) => tbl('departmentPermission').push({ roleId, key: KEY, value: String(value) });

await t('ברירת מחדל: עובדת (4), תופרת (3), מנהל סניף (1) - סגור', async () => {
  reset();
  for (const roleId of [4, 3, 1, 5]) assert.equal(await perms.hasPermission(emp('e' + roleId, roleId), KEY), false, `roleId ${roleId}`);
});
await t('הנהלה ראשית (0) ומתכנת (2) - תמיד, גם מול שורת מחלקה "false" וחריגה "false"', async () => {
  reset(); grantDept(0, false); grantDept(2, false); grantEmp('h1', false); grantEmp('p1', false);
  assert.equal(await perms.hasPermission(emp('h1', 0), KEY), true);
  assert.equal(await perms.hasPermission(emp('p1', 2), KEY), true);
  assert.equal(await perms.hasPermission(emp('h2', 0), KEY), true);
});
await t('חריגה אישית "true" פותחת לעובדת אחת בלבד', async () => {
  reset(); grantEmp('s1', true);
  assert.equal(await perms.hasPermission(emp('s1', 4), KEY), true);
  assert.equal(await perms.hasPermission(emp('s2', 4), KEY), false, 'עובדת אחרת באותו תפקיד');
});
await t('שורת מחלקה "true" פותחת לכל התפקיד, לא לתפקידים אחרים; חריגה אישית "false" גוברת על המחלקה', async () => {
  reset(); grantDept(4, true); grantEmp('s9', false);
  assert.equal(await perms.hasPermission(emp('s1', 4), KEY), true);
  assert.equal(await perms.hasPermission(emp('s2', 3), KEY), false);
  assert.equal(await perms.hasPermission(emp('s9', 4), KEY), false, 'חריגה אישית שוללת');
});
await t('resolvePageAccess (מה ש-/api/me מחזיר ללקוח) מסכים עם hasPermission בכל המקרים', async () => {
  reset(); grantDept(4, true); grantEmp('s9', false); grantEmp('s5', true);
  const cases = [['s1', 4], ['s9', 4], ['s5', 3], ['x', 1], ['h', 0], ['p', 2]];
  for (const [id, roleId] of cases) {
    perms.invalidatePermissionCache();
    const viaAccess = (await perms.resolvePageAccess(roleId, id, [KEY]))[KEY];
    assert.equal(viaAccess, await perms.hasPermission(emp(id, roleId), KEY), `${id}/${roleId}`);
  }
});
await t('decideDressItemAccess (טהור): אורח 401, בלי עובד 401, בלי הרשאה 403, מורשה ok', () => {
  assert.equal(access.decideDressItemAccess({ authed: false, employee: null, allowed: false }).status, 401);
  assert.equal(access.decideDressItemAccess({ authed: true, employee: null, allowed: false }).status, 401);
  const no = access.decideDressItemAccess({ authed: true, employee: { id: 'x' }, allowed: false });
  assert.equal(no.status, 403); assert.match(no.error, /ניהול פריטי דגם/);
  assert.deepEqual(access.decideDressItemAccess({ authed: true, employee: { id: 'x' }, allowed: true }), { ok: true });
});

// ================================================================ 3. המטריצה בנתיבים האמיתיים
console.log('3. מטריצת הנתיבים: POST/PUT/DELETE של פריט');
const params = (o) => ({ params: Promise.resolve(o) });
const jreq = (url, method, body) => new Request('http://x' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const DM1 = '00000000-0000-4000-8000-000000000001'; // the merged item route requires a uuid model id
function seedItems() {
  tbl('dressModel').push({ id: DM1, name: 'ורד', barcodePrefix: 100, isDeleted: false });
  tbl('dressItem').push({ id: 'it1', dressModelId: DM1, dressBarcode: '100', location: 'חנות', isDeleted: false });
}
let bcSeq = 0;
const nextItemBody = () => { const n = ++bcSeq; return { sizeText: '38', serialNumber: n, dressBarcode: `10038${String(n).padStart(2, '0')}`, location: 'חנות' }; };
const CALLS = {
  create: () => itemsRoute.POST(jreq(`/api/dresses/${DM1}/items`, 'POST', nextItemBody()), params({ id: DM1 })),
  edit: () => itemRoute.PUT(jreq('/api/dresses/items/it1', 'PUT', { location: 'רזרבה', cartonNumber: '7', inRepair: true }), params({ itemId: 'it1' })),
  quickLocation: () => itemRoute.PUT(jreq('/api/dresses/items/it1', 'PUT', { location: 'מחסן' }), params({ itemId: 'it1' })),
  restore: () => itemRoute.PUT(jreq('/api/dresses/items/it1', 'PUT', { isDeleted: false }), params({ itemId: 'it1' })),
  remove: () => itemRoute.DELETE(jreq('/api/dresses/items/it1', 'DELETE'), params({ itemId: 'it1' })),
};
const writesToItems = () => T.writes.filter((w) => w.model === 'dressItem');
async function run(name) { const r = await CALLS[name](); return { status: r.status, body: await r.json().catch(() => ({})) }; }

await t('אורח: 401 בכל פעולת פריט, ובלי כתיבה', async () => {
  reset(); seedItems(); T.session = null;
  for (const n of Object.keys(CALLS)) assert.equal((await run(n)).status, 401, n);
  assert.equal(writesToItems().length, 0);
});
await t('מצב פתוח (require_login כבוי), אורח: 401 - ניהול פריטים דורש עובדת מזוהה', async () => {
  reset(); seedItems(); T.openMode = true; T.session = null;
  for (const n of Object.keys(CALLS)) assert.equal((await run(n)).status, 401, n);
  assert.equal(writesToItems().length, 0);
});
await t('עובדת מושבתת (גם עם חריגה "true" והנהלה): 401, ובלי כתיבה', async () => {
  reset(); seedItems(); grantEmp('d1', true);
  for (const s of [{ id: 'd1', roleId: 4, isActive: false }, { id: 'dh', roleId: 0, isActive: false }]) {
    T.session = s;
    for (const n of Object.keys(CALLS)) assert.equal((await run(n)).status, 401, `${s.id}/${n}`);
  }
  assert.equal(writesToItems().length, 0);
});
await t('עובדת (4), תופרת (3) ומנהל סניף (1) בלי הרשאה: 403 עם הודעה ברורה בכל פעולה, ובלי כתיבה', async () => {
  reset(); seedItems();
  for (const roleId of [4, 3, 1]) {
    T.session = { id: 'low' + roleId, roleId, isActive: true };
    for (const n of Object.keys(CALLS)) {
      const r = await run(n);
      assert.equal(r.status, 403, `${roleId}/${n}`);
      assert.match(r.body.error, /ניהול פריטי דגם/);
    }
  }
  assert.equal(writesToItems().length, 0, 'ה-DB לא נכתב');
  assert.equal(tbl('dressItem')[0].location, 'חנות');
});
await t('עובדת עם חריגה אישית "true": כל הפעולות 200 והכתיבה בוצעה; עובדת אחרת באותו תפקיד - 403', async () => {
  reset(); seedItems(); grantEmp('ok1', true);
  T.session = { id: 'ok1', roleId: 4, isActive: true };
  assert.equal((await run('create')).status, 200);
  assert.equal((await run('edit')).status, 200);
  assert.equal(tbl('dressItem').find((i) => i.id === 'it1').location, 'רזרבה');
  assert.equal((await run('quickLocation')).status, 200);
  assert.equal((await run('remove')).status, 200);
  assert.equal(tbl('dressItem').find((i) => i.id === 'it1').isDeleted, true);
  assert.equal((await run('restore')).status, 200);
  T.session = { id: 'other', roleId: 4, isActive: true };
  assert.equal((await run('edit')).status, 403);
});
await t('שורת מחלקה "true" (תפקיד 4): עובדת 4 - 200, תפקיד 3 - 403', async () => {
  reset(); seedItems(); grantDept(4, true);
  T.session = { id: 'a', roleId: 4, isActive: true }; assert.equal((await run('edit')).status, 200);
  T.session = { id: 'b', roleId: 3, isActive: true }; assert.equal((await run('edit')).status, 403);
});
await t('הנהלה ראשית ומתכנת: 200 בכל פעולה (גם מול שורת מחלקה "false")', async () => {
  reset(); seedItems(); grantDept(0, false); grantDept(2, false);
  for (const roleId of [0, 2]) {
    T.session = { id: 'hp' + roleId, roleId, isActive: true };
    for (const n of Object.keys(CALLS)) assert.equal((await run(n)).status, 200, `${roleId}/${n}`);
  }
});
await t('הרשאת הפריטים לא פותחת עריכת דגם: עובדת 4 עם ההרשאה - PUT/DELETE/POST של הדגם נשארים 403; סימון "לא פעיל" פתוח כמו קודם', async () => {
  reset(); seedItems(); grantEmp('ok1', true);
  T.session = { id: 'ok1', roleId: 4, isActive: true };
  const put = (body) => dressRoute.PUT(jreq(`/api/dresses/${DM1}`, 'PUT', body), params({ id: DM1 }));
  assert.equal((await put({ notes: 'x' })).status, 403);
  assert.equal((await put({ isDeleted: true })).status, 403);
  assert.equal((await put({ name: 'חדש' })).status, 403);
  assert.equal((await dressRoute.DELETE(jreq(`/api/dresses/${DM1}`, 'DELETE'), params({ id: DM1 }))).status, 403);
  assert.equal((await dressesRoute.POST(jreq('/api/dresses', 'POST', { name: 'שם חדש', barcodePrefix: 555 }))).status, 403);
  assert.equal((await put({ inactiveReason: 'פג' })).status, 200, 'החריג של סימון לא-פעיל לא השתנה');
});
await t('שער ההוספה/העריכה מוחלף בלי להשאיר checkAuth() ריק: הטיפול ב-body קורה רק אחרי ההרשאה (אין כתיבה כשמסרבים גם עם body תקין)', async () => {
  reset(); seedItems(); T.session = { id: 'low', roleId: 4, isActive: true };
  await CALLS.create(); await CALLS.edit();
  assert.deepEqual(T.writes, []);
});

// ================================================================ 4. מניפסט סטטי
console.log('4. מניפסט סטטי: כל כותב DressItem מוגן או מוצהר כזרימת הזמנה');
const walk = (d, out = []) => {
  for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
    const rel = path.posix.join(d.replace(/\\/g, '/'), e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') walk(rel, out); } else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(rel);
  }
  return out;
};
const GATED = ['app/api/dresses/[id]/items/route.js', 'app/api/dresses/items/[itemId]/route.js'];
// זרימות הזמנה שמעדכנות מיקום של DressItem כתוצאה מפעולה בהזמנה - נשארות פתוחות בכוונה (לא ניהול קטלוג)
const ORDER_FLOW_ALLOW = {
  'app/api/rentals/confirm/route.js': 'אישור השכרה: location = "מושכר"',
  'app/api/rentals/scan/route.js': 'החזרה מהשכרה קודמת בסריקת השכרה חדשה: location = "חנות"',
  'app/api/returns/scan/route.js': 'החזרה / ביטול החזרה / ביטול כל ההחזרות: location חנות / מושכר',
  'lib/schedule/marks.js': 'סימוני הלו"ז היומי (החזרה): location (מאחורי מתג)',
};
const WRITE_RE = /\bdressItem\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;
await t('כל קובץ בשרת (app/api, lib, app שאינו סקריפט) שכותב dressItem: אחד משני נתיבי הניהול (עם השער) או זרימת הזמנה מוצהרת', () => {
  const writers = [...walk('app'), ...walk('lib'), ...walk('components')].filter((f) => WRITE_RE.test(code(read(f))));
  const unexpected = writers.filter((f) => !GATED.includes(f) && !ORDER_FLOW_ALLOW[f]);
  assert.deepEqual(unexpected, [], 'כותב DressItem חדש: להוסיף requireDressItemManager() או להצהיר עליו ב-ORDER_FLOW_ALLOW (רק אם זו תוצאה של פעולה בהזמנה)');
  for (const f of GATED) assert.ok(writers.includes(f), f);
});
await t('כל מטפל כותב בשני נתיבי הניהול מתחיל ב-requireDressItemManager() לפני כל גישה ל-prisma ולפני קריאת ה-body', () => {
  const must = [['app/api/dresses/[id]/items/route.js', 'POST'], ['app/api/dresses/items/[itemId]/route.js', 'PUT'], ['app/api/dresses/items/[itemId]/route.js', 'DELETE']];
  for (const [file, method] of must) {
    const src = code(read(file));
    const m = new RegExp(`export async function ${method}\\b[\\s\\S]*?\\n\\}(?:\\n|$)`).exec(src);
    assert.ok(m, `${method} ${file}`);
    const body = m[0];
    const gate = body.indexOf('requireDressItemManager()');
    assert.ok(gate > 0, `${method} ${file}: חסר שער`);
    assert.ok(/if \(denied\) return denied;/.test(body), `${method} ${file}: התשובה של השער חייבת לחזור`);
    for (const later of ['prisma.', 'request.json()']) { const at = body.indexOf(later); assert.ok(at === -1 || at > gate, `${method} ${file}: ${later} לפני השער`); }
  }
});
await t('הזרימות המוצהרות כפתוחות באמת אינן מושפעות מההרשאה (לא מייבאות את השער) - השכרה / החזרה / לו"ז ממשיכות לעבוד לכל עובדת מורשית', () => {
  for (const f of Object.keys(ORDER_FLOW_ALLOW)) assert.ok(!/requireDressItemManager|dress_items_manage/.test(read(f)), `${f} נשאר פתוח`);
});
await t('שום נתיב אחר ב-app/api לא מקבל יצירת פריטים בתוך עדכון דגם (nested items write) ולא נוסף כותב דרך SQL גולמי', () => {
  for (const f of walk('app/api')) {
    const s = code(read(f));
    const writesModel = /\bdressModel\s*\.\s*(update|create|upsert|updateMany)\s*\(/.test(s);
    assert.ok(!writesModel || !/items:\s*\{\s*(create|createMany|update|updateMany|upsert|delete|deleteMany|set|connectOrCreate)\b/.test(s), `${f}: nested write ל-items בכתיבת דגם`);
    assert.ok(!/(INSERT INTO|UPDATE|DELETE FROM)\s+"?DressItem/i.test(s), `${f}: SQL גולמי על DressItem`);
  }
});
await t('שאר הנתיבים של הדגמים לא השתנו: GET פתוח לעובד מחובר, POST/PUT/DELETE של דגם נשארו הנהלה ראשית', () => {
  const list = code(read('app/api/dresses/route.js'));
  assert.match(list, /export async function POST[\s\S]*?checkAuth\('הנהלה ראשית'\)/);
  const one = code(read('app/api/dresses/[id]/route.js'));
  assert.match(one, /checkAuth\(isActivityToggleOnly \? undefined : 'הנהלה ראשית'\)/);
  assert.match(one, /export async function DELETE[\s\S]*?checkAuth\('הנהלה ראשית'\)/);
  assert.match(code(read('app/api/dresses/items/[itemId]/history/route.js')), /checkAuth\(\)/, 'קריאת היסטוריית פריט פתוחה');
});
await t('/api/me מחזיר employee.canManageDressItems (resolvePageAccess על אותו מפתח)', () => {
  const s = code(read('app/api/me/route.js'));
  assert.match(s, /resolvePageAccess\(employee\.roleId, employee\.id, \[DRESS_ITEMS_MANAGE_KEY\]\)/);
  assert.match(s, /employee\.canManageDressItems = !!\(itemsAccess && itemsAccess\[DRESS_ITEMS_MANAGE_KEY\]\)/);
  assert.match(s, /\.catch\(\(\) => null\)/, 'כשל = סגור');
});

console.log('   ... הלקוחות');
await t('הכרטיס החדש: useDressCard טוען canManageItems מ-/api/me (סגור כברירת מחדל); DcItemsTab מסתיר הוספה / עריכה / שחזור ופותח פרטים בלבד', () => {
  const hook = code(read('app/components/dress-card/useDressCard.js'));
  assert.match(hook, /useState\(false\)/); assert.match(hook, /fetchSharedJson\('\/api\/me'/); assert.match(hook, /me\.employee\.canManageDressItems/);
  assert.match(hook, /canManageItems, nameError/);
  const tab = code(read('app/components/dress-card/tabs/DcItemsTab.js'));
  assert.match(tab, /const canManage = !!dc\.canManageItems;/);
  assert.match(tab, /\{canManage\s*\?\s*<button type="button" className="btn navy" id="dcAddBtn"/);
  assert.match(tab, /if \(!canManage\) \{ openInfo\(it\.id\); return; \}/);
  assert.match(tab, /if \(!canManage\) return;/);
  assert.match(tab, /\(canManage \? <div className="hv-r hv-act"><small>פעולות<\/small>/, 'שחזור פריט מחוק רק עם הרשאה');
  assert.match(tab, /\{canManage \? <button type="button" className="ibtn" aria-label="עריכת פריט"/);
  assert.match(tab, /onOpen=\{canManage \? editItem : undefined\}/);
  assert.match(tab, /ניהול פריטי דגם/, 'הסבר בטולטיפ למה אין כפתורים');
});
await t('הכרטיס הישן: ModernDressItemsTab טוען את אותה הרשאה; ההוספה, העריכה, המיקום המהיר, הקרטון, המחיקה והשחזור מוסתרים / מנוטרלים', () => {
  const s = code(read('components/dresses/modern/ModernDressItemsTab.js'));
  assert.match(s, /fetchSharedJson\('\/api\/me'/); assert.match(s, /canManageDressItems/);
  assert.match(s, /\{canManage && \(\s*<button\s+type="button"\s+className=\{`btn btn-sm \$\{showAddBar/);
  assert.match(s, /\{showAddBar && canManage && \(/);
  assert.match(s, /disabled=\{!canManage \|\| quickMovingId === item\.id \|\| item\.isDeleted\}/);
  assert.match(s, /disabled=\{!canManage \|\| quickCartonSavingId === item\.id \|\| item\.isDeleted\}/);
  assert.match(s, /\{canManage && \(\s*<button\s+type="button"\s+className="btn btn-ghost btn-icon-only btn-sm"\s+title="עריכת הפריט"/);
  assert.match(s, /\{!canManage \? null : item\.isDeleted \? \(/);
  assert.match(s, /\{canManage && size !== 'ללא מידה' && \(/);
  assert.match(s, /title="פרטי פריט והיסטוריית השכרות"/, 'פרטים והיסטוריה נשארים');
});
await t('הקובץ הישן LegacyDressCardPage.js נשאר קפוא (ההרשאה נטענת בתוך הטאב המשותף)', () => {
  assert.ok(!/canManage|dress_items_manage/.test(read('app/dashboard/dresses/[id]/LegacyDressCardPage.js')));
});
await t('האשף (חדש וישן): יצירת דגם היא הנהלה ראשית בלבד (POST /api/dresses) ולכן שלב הפריטים שלו תמיד של מי שיש לו את ההרשאה - אין בקרה להסתיר', () => {
  assert.match(code(read('app/components/dress-new/useModelNewController.js')), /if \(head === false\) \{ say\('warn', 'אין הרשאה'/);
  assert.match(code(read('app/api/dresses/route.js')), /export async function POST[\s\S]*?checkAuth\('הנהלה ראשית'\)/);
});

// ================================================================ 5. שם דגם כפול
console.log('5. שם דגם כפול: 400 ברור');
await t('lib/dressNameConflict: הודעות (פעיל / מחוק / בלי קוד), normalize, זיהוי P2002 על name', () => {
  assert.equal(nameLib.buildDuplicateNameMessage('רומנטיקה', { barcodePrefix: 623, isDeleted: false }), 'דגם בשם «רומנטיקה» כבר קיים (קוד 623)');
  assert.equal(nameLib.buildDuplicateNameMessage('  רומנטיקה ', { barcodePrefix: 623, isDeleted: true }), 'דגם בשם «רומנטיקה» קיים ברשימת המחוקים (קוד 623) — אפשר לשחזר אותו');
  assert.equal(nameLib.buildDuplicateNameMessage('X', { barcodePrefix: null, isDeleted: false }), 'דגם בשם «X» כבר קיים');
  assert.equal(nameLib.buildDuplicateNameMessage('X', null), 'דגם בשם «X» כבר קיים');
  assert.deepEqual(nameLib.duplicateNameBody('X', { barcodePrefix: 5, isDeleted: false }), { error: 'דגם בשם «X» כבר קיים (קוד 5)', field: 'name' });
  assert.equal(nameLib.normalizeModelName('  AbC '), 'abc');
  assert.equal(nameLib.isNameUniqueViolation({ code: 'P2002', meta: { target: ['name'] } }), true);
  assert.equal(nameLib.isNameUniqueViolation({ code: 'P2002', meta: { target: 'DressModel_name_key' } }), true);
  assert.equal(nameLib.isNameUniqueViolation({ code: 'P2002', meta: { target: ['legacyId'] } }), false);
  assert.equal(nameLib.isNameUniqueViolation({ code: 'P2025' }), false);
  assert.equal(nameLib.isNameUniqueViolation(new Error('boom')), false);
  assert.equal(nameLib.isNameUniqueViolation(null), false);
});
await t('findNameConflict: מדויק, בלי רווחי קצוות, בלי רישיות, מחוק נכלל, פעיל קודם, מוציא את הדגם הנערך, שם ריק / לא-מחרוזת = null', async () => {
  reset();
  tbl('dressModel').push({ id: 'a', name: 'Rose', barcodePrefix: 1, isDeleted: true }, { id: 'b', name: 'rose', barcodePrefix: 2, isDeleted: false }, { id: 'c', name: 'רומנטיקה', barcodePrefix: 3, isDeleted: false }, { id: 'd', name: 'ישן', barcodePrefix: 4, isDeleted: true });
  assert.equal((await nameLib.findNameConflict(T.prisma, 'רומנטיקה')).id, 'c');
  assert.equal((await nameLib.findNameConflict(T.prisma, '  רומנטיקה  ')).id, 'c');
  assert.equal((await nameLib.findNameConflict(T.prisma, 'ROSE')).id, 'b', 'פעיל קודם למחוק');
  assert.equal((await nameLib.findNameConflict(T.prisma, 'ישן')).isDeleted, true);
  assert.equal(await nameLib.findNameConflict(T.prisma, 'רומנטיקה', 'c'), null, 'הדגם הנערך אינו מתנגש עם עצמו');
  assert.equal(await nameLib.findNameConflict(T.prisma, 'חדש'), null);
  for (const bad of ['', '   ', null, undefined, 5, {}]) assert.equal(await nameLib.findNameConflict(T.prisma, bad), null);
});

const quiet = () => { console.error = () => {}; }; // הנתיבים מדפיסים שגיאות 500 צפויות לקונסולה
const post = (body) => dressesRoute.POST(jreq('/api/dresses', 'POST', body));
const putModel = (id, body) => dressRoute.PUT(jreq('/api/dresses/' + id, 'PUT', body), params({ id }));
const asHead = () => { T.session = { id: 'head1', roleId: 0, isActive: true }; };
const J = async (r) => ({ status: r.status, body: await r.json() });

await t('POST /api/dresses: שם קיים -> 400 {error, field:"name"} בלי יצירה (פעיל)', async () => {
  reset(); asHead(); tbl('dressModel').push({ id: 'dm1', name: 'רומנטיקה', barcodePrefix: 623, isDeleted: false });
  const r = await J(await post({ name: 'רומנטיקה', barcodePrefix: 700, priceCategory: 'A' }));
  assert.equal(r.status, 400);
  assert.deepEqual(r.body, { error: 'דגם בשם «רומנטיקה» כבר קיים (קוד 623)', field: 'name' });
  assert.equal(T.writes.length, 0);
});
await t('POST: שם קיים ברשימת המחוקים -> הודעת "קיים ברשימת המחוקים ... אפשר לשחזר אותו"', async () => {
  reset(); asHead(); tbl('dressModel').push({ id: 'dm1', name: 'רומנטיקה', barcodePrefix: 623, isDeleted: true });
  const r = await J(await post({ name: 'רומנטיקה', barcodePrefix: 700 }));
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'דגם בשם «רומנטיקה» קיים ברשימת המחוקים (קוד 623) — אפשר לשחזר אותו');
  assert.equal(r.body.field, 'name');
});
await t('POST: רווחי קצוות ורישיות נחשבים אותו שם; שם ייחודי נוצר (200)', async () => {
  reset(); asHead(); tbl('dressModel').push({ id: 'dm1', name: 'Rose', barcodePrefix: 110, isDeleted: false });
  assert.equal((await post({ name: ' rose ', barcodePrefix: 111 })).status, 400);
  assert.equal((await post({ name: 'Rose', barcodePrefix: 111 })).status, 400);
  const ok = await J(await post({ name: 'ורד', barcodePrefix: 111 }));
  assert.equal(ok.status, 200); assert.equal(ok.body.name, 'ורד');
  assert.equal(T.writes.filter((w) => w.op === 'create').length, 1);
});
await t('POST: השם האוטומטי "דגם <קוד>" (אשף בלי שמות דגמים) מתנגש עם דגם מחוק קיים -> 400, לא 500', async () => {
  reset(); asHead(); tbl('dressModel').push({ id: 'dm1', name: 'דגם 623', barcodePrefix: 623, isDeleted: true });
  const r = await J(await post({ barcodePrefix: 623 }));
  assert.equal(r.status, 400); assert.match(r.body.error, /«דגם 623» קיים ברשימת המחוקים \(קוד 623\)/);
});
await t('POST: P2002 על name מהמסד (מרוץ) -> 400 עם אותה הודעה; שגיאה אחרת נשארת 500 כללי בלי פרטים', async () => {
  reset(); asHead(); quiet(); T.failCreateWith = Object.assign(new Error('Unique constraint failed on the fields: (`name`)'), { code: 'P2002', meta: { target: ['name'] } });
  const r = await J(await post({ name: 'חדש', barcodePrefix: 101 }));
  assert.equal(r.status, 400); assert.equal(r.body.field, 'name'); assert.match(r.body.error, /«חדש» כבר קיים/);
  T.failCreateWith = new Error('connection reset');
  const e = await J(await post({ name: 'חדש', barcodePrefix: 101 }));
  assert.equal(e.status, 500); assert.deepEqual(e.body, { error: 'שגיאה ביצירת הדגם' });
});
await t('POST: התנגשות קוד (barcodePrefix) נשארת 400 "הקוד כבר בשימוש!" והאשף עדיין מזהה אותה', async () => {
  reset(); asHead(); tbl('dressModel').push({ id: 'dm1', name: 'אחר', barcodePrefix: 623, isDeleted: false });
  const r = await J(await post({ name: 'שם חדש', barcodePrefix: 623 }));
  assert.equal(r.status, 400); assert.equal(r.body.error, 'הקוד כבר בשימוש!');
  assert.equal(wizLogic.describeCreateError(400, r.body).duplicate, true);
  assert.equal(wizLogic.describeCreateError(400, r.body).nameDuplicate, false);
});
await t('POST: קורא לא מורשה (עובדת 4 / אורח) מקבל 403 / 401 ללא שם או קוד של דגם קיים (אין דליפה)', async () => {
  reset(); tbl('dressModel').push({ id: 'dm1', name: 'סודי', barcodePrefix: 623, isDeleted: false });
  T.session = { id: 'low', roleId: 4, isActive: true };
  const r = await J(await post({ name: 'סודי', barcodePrefix: 700 }));
  assert.equal(r.status, 403); assert.ok(!/סודי|623/.test(JSON.stringify(r.body)));
  T.session = null;
  const g = await dressesRoute.POST(jreq('/api/dresses', 'POST', { name: 'סודי' }));
  assert.equal(g.status, 403); assert.ok(!/סודי|623/.test(await g.text()));
});
await t('ולידציית הקלט של ההתאמה הצדדית נשארת בתוקף לצד שם כפול: קוד לא בן 3 ספרות / שם ריק / קטגוריה לא קיימת = 400 עם field; הברקוד של פריט חייב להתאים; השער של הרשאת הפריטים קודם לכל ולידציה', async () => {
  reset(); asHead(); quiet(); tbl('priceList').push({ category: 'A' }); seedItems();
  const bad = async (body, field) => { const r = await J(await post(body)); assert.equal(r.status, 400, JSON.stringify(body)); assert.equal(r.body.field, field, JSON.stringify(r.body)); };
  await bad({ name: 'x', barcodePrefix: 12 }, 'barcodePrefix');
  await bad({ name: '   ', barcodePrefix: 120 }, 'name');
  await bad({ name: 'x', barcodePrefix: 120, priceCategory: 'ZZ' }, 'priceCategory');
  assert.equal(T.writes.filter((w) => w.model === 'dressModel').length, 0, 'נדחה לפני כתיבה');
  assert.equal((await post({ name: 'תקין', barcodePrefix: 120, priceCategory: 'A' })).status, 200);
  const itemBad = await J(await itemsRoute.POST(jreq(`/api/dresses/${DM1}/items`, 'POST', { sizeText: '38', serialNumber: 1, dressBarcode: '9999999' }), params({ id: DM1 })));
  assert.equal(itemBad.status, 400); assert.equal(itemBad.body.field, 'dressBarcode');
  assert.equal((await itemsRoute.POST(jreq('/api/dresses/dm1/items', 'POST', nextItemBody()), params({ id: 'dm1' }))).status, 404, 'מזהה דגם שאינו uuid');
  // השער קודם: עובדת בלי הרשאה מקבלת 403 גם עם גוף לא תקין, ולא מגלה את הוולידציה
  T.session = { id: 'low', roleId: 4, isActive: true };
  const gated = await J(await itemsRoute.POST(jreq(`/api/dresses/${DM1}/items`, 'POST', { dressBarcode: 'x' }), params({ id: DM1 })));
  assert.equal(gated.status, 403);
});
await t('PUT /api/dresses/[id]: שינוי שם לשם קיים -> 400 (פעיל / מחוק); אותו שם / שינוי רישיות של השם של עצמו / שם חדש -> 200', async () => {
  reset(); asHead();
  tbl('dressModel').push({ id: 'dm1', name: 'Rose', barcodePrefix: 1, isDeleted: false }, { id: 'dm2', name: 'ורד', barcodePrefix: 2, isDeleted: false }, { id: 'dm3', name: 'ישן', barcodePrefix: 3, isDeleted: true });
  const a = await J(await putModel('dm2', { name: 'rose' }));
  assert.equal(a.status, 400); assert.deepEqual(a.body, { error: 'דגם בשם «rose» כבר קיים (קוד 1)', field: 'name' });
  const b = await J(await putModel('dm2', { name: 'ישן' }));
  assert.equal(b.status, 400); assert.equal(b.body.error, 'דגם בשם «ישן» קיים ברשימת המחוקים (קוד 3) — אפשר לשחזר אותו');
  assert.equal(T.writes.length, 0);
  assert.equal((await putModel('dm2', { name: 'ורד', notes: 'n' })).status, 200, 'אותו שם');
  assert.equal((await putModel('dm1', { name: 'ROSE' })).status, 200, 'שינוי רישיות לשם של עצמו');
  assert.equal((await putModel('dm2', { name: 'ורד חדש' })).status, 200);
  assert.equal(tbl('dressModel').find((m) => m.id === 'dm2').name, 'ורד חדש');
});
await t('PUT: P2002 מהמסד -> 400 עם field; בקשה בלי שם לא בודקת שם; עובדת 4 עם שם קיים - 403 בלי דליפה', async () => {
  reset(); asHead(); quiet(); tbl('dressModel').push({ id: 'dm1', name: 'A', barcodePrefix: 1, isDeleted: false }, { id: 'dm2', name: 'B', barcodePrefix: 2, isDeleted: false });
  assert.equal((await putModel('dm1', { notes: 'x' })).status, 200);
  T.failUpdateWith = Object.assign(new Error('x'), { code: 'P2002', meta: { target: ['name'] } }); // מרוץ: השם נתפס בין הבדיקה לכתיבה
  const race = await J(await putModel('dm1', { name: 'Z' }));
  assert.equal(race.status, 400); assert.equal(race.body.field, 'name'); assert.match(race.body.error, /«Z» כבר קיים/);
  T.failUpdateWith = new Error('connection reset');
  const other = await J(await putModel('dm1', { name: 'Y' }));
  assert.equal(other.status, 500); assert.deepEqual(other.body, { error: 'שגיאה בעדכון השמלה' });
  T.failUpdateWith = null;
  T.session = { id: 'low', roleId: 4, isActive: true };
  const r = await J(await putModel('dm1', { name: 'B' }));
  assert.equal(r.status, 403); assert.ok(!/B|קוד 2/.test(JSON.stringify(r.body)));
});
await t('לקוחות: האשף החדש מציג את ההודעה ליד שדה השם (S.nameErr, mnNameE), הכרטיס החדש ליד dcName; האשף הישן והכרטיס הישן מציגים data.error הקיים; אין alert חדש', () => {
  assert.equal(wizLogic.describeCreateError(400, { error: 'דגם בשם «X» כבר קיים (קוד 1)', field: 'name' }).nameDuplicate, true);
  assert.equal(wizLogic.describeCreateError(500, { error: 'שגיאה ביצירת הדגם' }).nameDuplicate, false);
  assert.equal(wizLogic.describeCreateError(403, { error: 'x', field: 'name' }).nameDuplicate, false);
  const ctl = code(read('app/components/dress-new/useModelNewController.js'));
  assert.match(ctl, /nameErr: ''/); assert.match(ctl, /nameErr: e\.msg/); assert.match(ctl, /getElementById\(e\.nameDuplicate && useModelNames \? 'mnName' : 'mnCode'\)/); // focus on the name field (merged with the other session's code-conflict focus)
  assert.match(ctl, /p\.name !== undefined && prev\.nameErr \? \{ nameErr: '' \}/, 'ההודעה נמחקת כשהשם משתנה');
  const steps = code(read('app/components/dress-new/MnSteps.js'));
  assert.match(steps, /<Bad>\{S\.nameErr \|\| 'חובה להזין שם דגם'\}<\/Bad>/);
  assert.match(steps, /autoNameErr/);
  const hook = code(read('app/components/dress-card/useDressCard.js'));
  assert.match(hook, /f\.step\.kind === 'model' && f\.field === 'name'/); assert.match(hook, /nameConflict\.name === cur\.model\.name/);
  assert.match(code(read('app/components/dress-card/tabs/DcDetailsTab.js')), /error=\{dc\.nameError\}/);
  assert.match(code(read('app/components/dress-card/DcParts.js')), /role="alert"[^>]*>\s*<OcIcon name="alert" size="sm" \/>\{error\}/);
  assert.match(code(read('components/dresses/modern/ModernNewDressWizard.js')), /flash\(`שגיאה: \$\{created\.error \|\| 'יצירת הדגם נכשלה'\}`/);
  assert.match(code(read('app/dashboard/dresses/[id]/LegacyDressCardPage.js')), /flashMessage\(`שגיאה: \$\{data\.error \|\| 'שמירת הדגם נכשלה'\}`/);
  for (const f of ['app/components/dress-card/useDressCard.js', 'app/components/dress-card/tabs/DcItemsTab.js', 'app/components/dress-new/useModelNewController.js', 'app/components/dress-new/MnSteps.js']) {
    assert.ok(!/(?:^|[^\w.])(?:window\.)?(?:alert|confirm|prompt)\(/m.test(code(read(f))), `${f}: חלון דפדפן`);
  }
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
