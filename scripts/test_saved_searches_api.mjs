// בדיקות נתיבי "חיפושים שמורים" ו"היסטוריית חיפוש" (app/api/saved-searches, app/api/search-history), בלי DB ובלי Next:
//   בעלות (מחיקה של חיפוש של אחרת = 403, רשימה רק של העובדת עצמה), תקרת 50, אורך תווית, נתונים לא תקינים,
//   אין זהות מאומתת = 401, והטבלה חסרה במסד (P2021 / 42P01) = רשימה ריקה + unavailable (בלי 500) ובלי לקרוס ב-POST / DELETE.
// הרצה: node scripts/test_saved_searches_api.mjs   (יוצא עם קוד 1 אם משהו נכשל)
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
  [/[\\\\/]lib[\\\\/]authTokens\\.js$/, 'authtokens'],
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
  if (url === 'mock:auth') return { format: 'module', shortCircuit: true, source: 'const T=globalThis.__T; export const checkAuth=async()=>T.authed;' };
  if (url === 'mock:authtokens') return { format: 'module', shortCircuit: true, source: 'const T=globalThis.__T; export const getVerifiedAuthCookie=()=>T.me?{value:T.me}:null;' };
  if (url === 'mock:next-server') return { format: 'module', shortCircuit: true, source: 'export class NextResponse { static json(body, init){ return new Response(JSON.stringify(body), { status:(init&&init.status)||200, headers:{"content-type":"application/json"} }); } }' };
  if (url === 'mock:next-headers') return { format: 'module', shortCircuit: true, source: 'export const cookies=async()=>({get(){return undefined}});' };
  return next(url, ctx);
}
`;
register('data:text/javascript;base64,' + Buffer.from(hooks).toString('base64'), pathToFileURL(root + path.sep));

// ---------------------------------------------------------------- prisma בזיכרון
const T = (globalThis.__T = { authed: true, me: 'emp-me', db: { savedSearch: [], searchHistory: [] }, missing: false, fail: false, calls: [], seq: 0 });
const missingErr = (table) => Object.assign(new Error('The table `public.' + table + '` does not exist in the current database.'), { code: 'P2021', meta: { table } });
const pgErr = () => Object.assign(new Error('relation "SavedSearch" does not exist'), { meta: { code: '42P01' } });
const guard = (name) => { T.calls.push(name); if (T.missing) throw (T.missing === 'pg' ? pgErr() : missingErr(name)); if (T.fail) throw new Error('db down'); };
const matchWhere = (r, w) => !w || Object.entries(w).every(([k, c]) => (c && typeof c === 'object' && 'notIn' in c ? !c.notIn.includes(r[k]) : r[k] === c));
const orderRows = (rows, orderBy) => {
  const ob = orderBy == null ? [{ createdAt: 'desc' }] : Array.isArray(orderBy) ? orderBy : [orderBy];
  return rows.sort((x, y) => { for (const o of ob) { const [k, dir] = Object.entries(o)[0]; if (x[k] === y[k]) continue; return (x[k] < y[k] ? -1 : 1) * (dir === 'asc' ? 1 : -1); } return 0; });
};
const table = (name) => ({
  findMany: async (a = {}) => { guard(name + '.findMany'); let rows = orderRows(T.db[name].filter((r) => matchWhere(r, a.where)), a.orderBy); if (a.take != null) rows = rows.slice(0, a.take); return rows.map((r) => ({ ...r })); },
  findFirst: async (a = {}) => { guard(name + '.findFirst'); const rows = orderRows(T.db[name].filter((r) => matchWhere(r, a.where)), a.orderBy); return rows[0] ? { ...rows[0] } : null; },
  count: async (a = {}) => { guard(name + '.count'); return T.db[name].filter((r) => matchWhere(r, a.where)).length; },
  findUnique: async (a) => { guard(name + '.findUnique'); const r = T.db[name].find((x) => x.id === a.where.id); return r ? { ...r } : null; },
  create: async (a) => { guard(name + '.create'); const r = { id: 'id' + ++T.seq, createdAt: ++T.seq, ...a.data }; T.db[name].push(r); return { ...r }; },
  delete: async (a) => { guard(name + '.delete'); if (!T.db[name].some((x) => x.id === a.where.id)) throw Object.assign(new Error('not found'), { code: 'P2025' }); T.db[name] = T.db[name].filter((x) => x.id !== a.where.id); return {}; },
  deleteMany: async (a) => { guard(name + '.deleteMany'); T.db[name] = T.db[name].filter((r) => !matchWhere(r, a.where)); return {}; },
});
T.prisma = new Proxy({}, { get: (_t, p) => { if (p === 'then') return undefined; if (p === 'savedSearch' || p === 'searchHistory') return table(p); throw new Error('mock: model לא צפוי ' + String(p)); } });

let passed = 0;
async function t(name, fn) {
  try { reset(); await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.stack || e.message); process.exitCode = 1; }
}
function reset() { T.authed = true; T.me = 'emp-me'; T.db = { savedSearch: [], searchHistory: [] }; T.missing = false; T.fail = false; T.calls = []; }

const saved = await import('../app/api/saved-searches/route.js');
const hist = await import('../app/api/search-history/route.js');
const { isMissingTableError } = await import('../lib/prismaMissingTable.js');
const req = (url, body, method = 'POST') => new Request('http://x' + url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
const json = async (res) => ({ status: res.status, body: await res.json() });
const rows = (n, emp = 'emp-me') => Array.from({ length: n }, (_, i) => ({ id: emp + '-' + i, employeeId: emp, label: 'l' + i, query: 'q' + i, domain: null, createdAt: i + 1 }));

console.log('isMissingTableError');
await t('P2021 / P2022 / 42P01 / הודעת "does not exist" = טבלה חסרה; שגיאות אחרות לא', () => {
  assert.equal(isMissingTableError({ code: 'P2021' }), true);
  assert.equal(isMissingTableError({ code: 'P2022' }), true);
  assert.equal(isMissingTableError({ meta: { code: '42P01' } }), true);
  assert.equal(isMissingTableError(new Error('relation "SavedSearch" does not exist')), true);
  assert.equal(isMissingTableError(new Error('The table `public.SavedSearch` does not exist in the current database.')), true);
  for (const no of [null, undefined, 'x', 5, new Error('db down'), { code: 'P2002' }, { code: 'P1001' }]) assert.equal(isMissingTableError(no), false, String(no));
});

console.log('saved-searches: GET');
await t('רק החיפושים של העובדת המחוברת, החדש ראשון', async () => {
  T.db.savedSearch = [...rows(2, 'emp-me'), ...rows(3, 'emp-other')];
  const r = await json(await saved.GET());
  assert.equal(r.status, 200); assert.equal(r.body.savedSearches.length, 2);
  assert.ok(r.body.savedSearches.every((s) => s.employeeId === 'emp-me'));
  assert.equal(r.body.savedSearches[0].label, 'l1');
});
await t('לא מחובר = 401; זהות לא מאומתת (אין auth_token חתום) = 401 ובלי שאילתה', async () => {
  T.authed = false; assert.equal((await saved.GET()).status, 401);
  T.authed = true; T.me = null; assert.equal((await saved.GET()).status, 401); assert.equal(T.calls.length, 0);
});
await t('הטבלה חסרה (P2021 ו-42P01): 200 עם רשימה ריקה ו-unavailable, לא 500', async () => {
  T.missing = true;
  let r = await json(await saved.GET());
  assert.equal(r.status, 200); assert.deepEqual(r.body, { savedSearches: [], unavailable: true });
  T.missing = 'pg';
  r = await json(await saved.GET());
  assert.equal(r.status, 200); assert.equal(r.body.unavailable, true);
});
await t('כשל מסד אחר (db down) = 500, ולא מוסתר כ"לא זמין"', async () => {
  T.fail = true;
  const orig = console.error; console.error = () => {};
  try { const r = await json(await saved.GET()); assert.equal(r.status, 500); assert.equal(r.body.unavailable, undefined); } finally { console.error = orig; }
});

console.log('saved-searches: POST');
await t('שמירה: label + query נחתכים, נשמר על העובדת המחוברת (גם אם הגוף שולח employeeId של אחרת)', async () => {
  const r = await json(await saved.POST(req('/api/saved-searches', { label: '  כהן ירושלים  ', query: ' כהן ירושלים ', domain: ' orders ', employeeId: 'emp-other' })));
  assert.equal(r.status, 200); assert.equal(r.body.success, true);
  assert.equal(T.db.savedSearch.length, 1);
  assert.deepEqual([T.db.savedSearch[0].employeeId, T.db.savedSearch[0].label, T.db.savedSearch[0].query, T.db.savedSearch[0].domain], ['emp-me', 'כהן ירושלים', 'כהן ירושלים', 'orders']);
});
await t('תווית עד 80 תווים ושאילתה עד 300 (נחתכות בשרת)', async () => {
  const r = await json(await saved.POST(req('/api/saved-searches', { label: 'א'.repeat(200), query: 'ב'.repeat(500) })));
  assert.equal(r.status, 200);
  assert.equal(T.db.savedSearch[0].label.length, 80); assert.equal(T.db.savedSearch[0].query.length, 300); assert.equal(T.db.savedSearch[0].domain, null);
});
await t('בלי תווית / בלי שאילתה / JSON פגום = 400', async () => {
  assert.equal((await saved.POST(req('/api/saved-searches', { label: '', query: 'x' }))).status, 400);
  assert.equal((await saved.POST(req('/api/saved-searches', { label: 'x', query: '   ' }))).status, 400);
  assert.equal((await saved.POST(req('/api/saved-searches', '{oops'))).status, 400);
  assert.equal((await saved.POST(req('/api/saved-searches', { label: 5, query: {} }))).status, 400);
  assert.equal(T.db.savedSearch.length, 0);
});
await t('תקרת 50: החמישים ואחד נדחה 409 (ולא נשמר); חיפושים של אחרות לא נספרים', async () => {
  T.db.savedSearch = [...rows(49, 'emp-me'), ...rows(60, 'emp-other')];
  let r = await json(await saved.POST(req('/api/saved-searches', { label: 'a', query: 'a' })));
  assert.equal(r.status, 200, 'ה-50 עדיין נכנס');
  r = await json(await saved.POST(req('/api/saved-searches', { label: 'b', query: 'b' })));
  assert.equal(r.status, 409); assert.equal(r.body.limit, 50);
  assert.equal(T.db.savedSearch.filter((s) => s.employeeId === 'emp-me').length, 50);
});
await t('אותה שאילתה פעמיים (לחיצה כפולה) = שורה אחת: השנייה מחזירה את הקיימת', async () => {
  const a = await json(await saved.POST(req('/api/saved-searches', { label: 'כהן', query: 'כהן' })));
  const b = await json(await saved.POST(req('/api/saved-searches', { label: 'כהן 2', query: ' כהן ' })));
  assert.equal(T.db.savedSearch.length, 1); assert.equal(b.status, 200); assert.equal(b.body.existing, true); assert.equal(b.body.savedSearch.id, a.body.savedSearch.id);
  T.db.savedSearch.push({ id: 'o', employeeId: 'emp-other', label: 'x', query: 'חדש', domain: null, createdAt: 99 });
  assert.equal((await json(await saved.POST(req('/api/saved-searches', { label: 'חדש', query: 'חדש' })))).body.existing, undefined, 'אותה שאילתה אצל אחרת לא נחשבת כפילות');
});
await t('שתי בקשות במקביל לאותה שאילתה (מירוץ): נשארת שורה אחת ושתי התשובות מצביעות עליה', async () => {
  const [a, b] = await Promise.all([1, 2].map((i) => saved.POST(req('/api/saved-searches', { label: 'ל' + i, query: 'כהן' })).then(json)));
  assert.equal(T.db.savedSearch.length, 1, 'שורה אחת');
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal(a.body.savedSearch.id, T.db.savedSearch[0].id); assert.equal(b.body.savedSearch.id, T.db.savedSearch[0].id);
});
await t('מירוץ על התקרה (49 + שתי שאילתות שונות במקביל): לעולם לא יותר מ-50 שורות', async () => {
  T.db.savedSearch = rows(49, 'emp-me');
  const rs = await Promise.all([1, 2].map((i) => saved.POST(req('/api/saved-searches', { label: 'n' + i, query: 'new' + i })).then(json)));
  assert.ok(T.db.savedSearch.filter((s) => s.employeeId === 'emp-me').length <= 50);
  assert.ok(rs.every((r) => r.status === 200 || r.status === 409));
});
await t('תחום (domain): רק customers / orders / items, כל ערך אחר נשמר כ-null', async () => {
  for (const [d, want] of [['customers', 'customers'], ['items', 'items'], ['__proto__', null], ['constructor', null], ['hacker<script>', null], [5, null], [undefined, null]]) {
    T.db.savedSearch = [];
    const r = await json(await saved.POST(req('/api/saved-searches', { label: 'a', query: 'q', domain: d })));
    assert.equal(r.status, 200); assert.equal(T.db.savedSearch[0].domain, want, String(d));
  }
});
await t('לא מחובר / זהות לא מאומתת = 401 ובלי כתיבה', async () => {
  T.authed = false; assert.equal((await saved.POST(req('/api/saved-searches', { label: 'a', query: 'a' }))).status, 401);
  T.authed = true; T.me = null; assert.equal((await saved.POST(req('/api/saved-searches', { label: 'a', query: 'a' }))).status, 401);
  assert.equal(T.db.savedSearch.length, 0);
});
await t('הטבלה חסרה: 503 עם unavailable (לא 500, לא קורס)', async () => {
  T.missing = true;
  const r = await json(await saved.POST(req('/api/saved-searches', { label: 'a', query: 'a' })));
  assert.equal(r.status, 503); assert.equal(r.body.unavailable, true);
});

console.log('saved-searches: DELETE');
await t('מחיקה של חיפוש שלי: 200 ונמחק', async () => {
  T.db.savedSearch = rows(2, 'emp-me');
  const r = await json(await saved.DELETE(req('/api/saved-searches?id=emp-me-0', undefined, 'DELETE')));
  assert.equal(r.status, 200); assert.deepEqual(T.db.savedSearch.map((s) => s.id), ['emp-me-1']);
});
await t('מחיקה של חיפוש של אחרת = 403 ולא נמחק; לא קיים = 404; בלי id = 400', async () => {
  T.db.savedSearch = rows(2, 'emp-other');
  assert.equal((await saved.DELETE(req('/api/saved-searches?id=emp-other-0', undefined, 'DELETE'))).status, 403);
  assert.equal(T.db.savedSearch.length, 2);
  assert.equal((await saved.DELETE(req('/api/saved-searches?id=nope', undefined, 'DELETE'))).status, 404);
  assert.equal((await saved.DELETE(req('/api/saved-searches', undefined, 'DELETE'))).status, 400);
});
await t('לא מחובר / זהות לא מאומתת = 401', async () => {
  T.db.savedSearch = rows(1, 'emp-me');
  T.me = null; assert.equal((await saved.DELETE(req('/api/saved-searches?id=emp-me-0', undefined, 'DELETE'))).status, 401);
  T.me = 'emp-me'; T.authed = false; assert.equal((await saved.DELETE(req('/api/saved-searches?id=emp-me-0', undefined, 'DELETE'))).status, 401);
  assert.equal(T.db.savedSearch.length, 1);
});
await t('הטבלה חסרה: 503 עם unavailable', async () => {
  T.missing = true;
  const r = await json(await saved.DELETE(req('/api/saved-searches?id=x', undefined, 'DELETE')));
  assert.equal(r.status, 503); assert.equal(r.body.unavailable, true);
});

console.log('search-history');
await t('GET: רק של העובדת, בלי כפילויות, עד 20', async () => {
  T.db.searchHistory = [
    ...Array.from({ length: 30 }, (_, i) => ({ id: 'h' + i, employeeId: 'emp-me', query: 'q' + (i % 25), createdAt: i + 1 })),
    { id: 'o1', employeeId: 'emp-other', query: 'secret', createdAt: 99 },
  ];
  const r = await json(await hist.GET());
  assert.equal(r.status, 200); assert.ok(r.body.history.length <= 20);
  assert.ok(r.body.history.every((h) => h.employeeId === 'emp-me'));
  assert.equal(new Set(r.body.history.map((h) => h.query)).size, r.body.history.length);
});
await t('POST: רושם על העובדת המחוברת בלבד; שאילתה ריקה = 400; לא מחובר = 401', async () => {
  let r = await json(await hist.POST(req('/api/search-history', { query: ' כהן ', employeeId: 'emp-other' })));
  assert.equal(r.status, 200); assert.equal(T.db.searchHistory[0].employeeId, 'emp-me'); assert.equal(T.db.searchHistory[0].query, 'כהן');
  assert.equal((await hist.POST(req('/api/search-history', { query: '  ' }))).status, 400);
  T.me = null; assert.equal((await hist.POST(req('/api/search-history', { query: 'x' }))).status, 401);
  assert.equal(T.db.searchHistory.length, 1);
});
await t('POST מנקה שורות יתומות (employeeId null אחרי מחיקת עובדת) ולא נוגע בשורות של אחרות', async () => {
  T.db.searchHistory = [{ id: 'orph', employeeId: null, query: 'שם לקוחה', domain: null, createdAt: 1 }, { id: 'oth', employeeId: 'emp-other', query: 'x', domain: null, createdAt: 2 }];
  assert.equal((await hist.POST(req('/api/search-history', { query: 'חדש' }))).status, 200);
  assert.deepEqual(T.db.searchHistory.map((r) => r.id).filter((id) => id === 'orph' || id === 'oth'), ['oth']);
});
await t('הטבלה חסרה: GET = רשימה ריקה + unavailable; POST = 200 { success:false, unavailable } (בלי 500)', async () => {
  T.missing = true;
  let r = await json(await hist.GET()); assert.equal(r.status, 200); assert.deepEqual(r.body, { history: [], unavailable: true });
  r = await json(await hist.POST(req('/api/search-history', { query: 'x' }))); assert.equal(r.status, 200); assert.equal(r.body.success, false); assert.equal(r.body.unavailable, true);
});

console.log(String.fromCharCode(10) + passed + ' passed');
if (process.exitCode) process.exit(1);
