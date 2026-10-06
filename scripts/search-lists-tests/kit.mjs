// ערכת בדיקות לנתיבי חיפוש הרשימות (app/api/orders, customers, dresses, a5/adv, inventory/*) - בלי DB, בלי Next ובלי רשת.
// אותו מנגנון כמו scripts/test_home_adv_foci_server.mjs: hook שמוק את next/*, prisma, auth, permissions, settingsCache, ו-prisma "בזיכרון"
// עם מעריך where קטן (AND/OR/NOT, שוויון, in/not/gt/gte/lt/lte/contains/startsWith/endsWith, יחסים, some/none/every) כך שהתנאים שהנתיב בונה
// נבדקים באמת (מה שהם מחזירים), ולא רק "נקראים". SQL גולמי ($queryRawUnsafe) מדומה ב-emulateRaw: טלפון (regexp_replace) ושם דומה (pg_trgm).
// שימוש: import { T, resetT, load, t, req, summary } from './kit.mjs';   ואז   const route = await load('app/api/orders/route.js');
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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
  [/[\\\\/]api[\\\\/]inventory[\\\\/]capacity[\\\\/]route\\.js$/, 'capacityMock'],
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
    // המוק של capacity פעיל רק כשהבדיקה מבקשת (globalThis.__T.mockCapacity), כדי שבדיקת הנתיב עצמו תטען את הקוד האמיתי
    for (const [re, name] of MOCKS) if (re.test(file) && (name !== 'capacityMock' || globalThis.__T.mockCapacity)) return { url: 'mock:' + name, shortCircuit: true };
    return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  const mod = (source) => ({ format: 'module', shortCircuit: true, source });
  if (url === 'mock:prisma') return mod('const P=globalThis.__T.prisma; export default P; export const auditAs=async(_a,fn)=>fn(); export const getActingEmployeeId=()=>null; export const withAuditContext=async(_c,fn)=>fn();');
  if (url === 'mock:auth') return mod('const T=globalThis.__T; export const HEAD_MANAGEMENT_ROLES=[0,2]; export const checkAuth=async()=>T.authed; export const checkPageAccess=async()=>true; export const getSessionEmployee=async()=>({roleId:0});');
  if (url === 'mock:permissions') return mod('const T=globalThis.__T; export const canOpenPage=async(k)=>{T.asked.push(k);return T.pages.has(k);}; export const canOpenAnyPage=async(ks)=>ks.some((k)=>T.pages.has(k));');
  if (url === 'mock:settings') return mod('const T=globalThis.__T; export const getAllCachedSettings=async()=>Object.entries(T.settings).map(([key,value])=>({key,value})); export const getCachedSetting=async(k)=>T.settings[k]!==undefined?{key:k,value:T.settings[k]}:null;');
  if (url === 'mock:capacityMock') return mod('export const GET=async()=>new Response(JSON.stringify({inStock:0,occupiedCount:0,reserve:0,occupiedOrders:[]}),{status:200});');
  if (url === 'mock:next-server') return mod('export class NextResponse extends Response { static json(body, init){ return new Response(JSON.stringify(body), { status:(init&&init.status)||200, headers:{"content-type":"application/json"} }); } }');
  if (url === 'mock:next-headers') return mod('export const cookies=async()=>({get(){return undefined}});');
  return next(url, ctx);
}
`;
export const T = (globalThis.__T = { mockCapacity: false });
register('data:text/javascript;base64,' + Buffer.from(hooks).toString('base64'), pathToFileURL(root + path.sep));

// ---------------------------------------------------------------- מעריך where
const OPS = new Set(['equals', 'not', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'endsWith', 'mode', 'some', 'none', 'every']);
const ms = (v) => (v instanceof Date ? v.getTime() : v);
const isOpObj = (o) => o && typeof o === 'object' && !(o instanceof Date) && !Array.isArray(o) && Object.keys(o).some((k) => OPS.has(k));
function evalCond(val, cond) {
  if (cond === undefined) return true; // Prisma מתעלם מ-undefined
  if (cond === null) return val === null || val === undefined;
  if (!isOpObj(cond)) {
    if (cond instanceof Date || typeof cond !== 'object') return ms(val) === ms(cond);
    if (Array.isArray(val)) return val.some((x) => evalWhere(x, cond));
    return val != null && evalWhere(val, cond); // יחס (customer: {...})
  }
  const insensitive = cond.mode === 'insensitive';
  const norm = (x) => (insensitive ? String(x).toLowerCase() : String(x));
  for (const [op, arg] of Object.entries(cond)) {
    if (op === 'mode') continue;
    if (op === 'equals' && ms(val) !== ms(arg)) return false;
    if (op === 'not') {
      if (arg === null ? val == null : (val == null || ms(val) === ms(arg))) return false;
    }
    if (op === 'in' && !arg.includes(val)) return false;
    if (op === 'notIn' && (val == null || arg.includes(val))) return false;
    if (op === 'gt' && !(val != null && ms(val) > ms(arg))) return false;
    if (op === 'gte' && !(val != null && ms(val) >= ms(arg))) return false;
    if (op === 'lt' && !(val != null && ms(val) < ms(arg))) return false;
    if (op === 'lte' && !(val != null && ms(val) <= ms(arg))) return false;
    if (op === 'contains' && !(val != null && norm(val).includes(norm(arg)))) return false;
    if (op === 'startsWith' && !(val != null && norm(val).startsWith(norm(arg)))) return false;
    if (op === 'endsWith' && !(val != null && norm(val).endsWith(norm(arg)))) return false;
    if (op === 'some' && !(Array.isArray(val) && val.some((x) => evalWhere(x, arg)))) return false;
    if (op === 'none' && (Array.isArray(val) && val.some((x) => evalWhere(x, arg)))) return false;
    if (op === 'every' && !(Array.isArray(val) && val.every((x) => evalWhere(x, arg)))) return false;
  }
  return true;
}
export function evalWhere(row, where) {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (k === 'AND') { if (!(Array.isArray(v) ? v : [v]).every((w) => evalWhere(row, w))) return false; }
    // איבר ריק ב-OR (למשל { orderId: undefined } של הקוד הישן) אינו מתאים לכלום - כך עובד האתר בפועל (חיפוש שם לא מחזיר את כל ההזמנות)
    else if (k === 'OR') { if (!v.some((w) => Object.values(w).some((x) => x !== undefined) && evalWhere(row, w))) return false; }
    else if (k === 'NOT') { if ((Array.isArray(v) ? v : [v]).some((w) => evalWhere(row, w))) return false; }
    else if (!evalCond(row ? row[k] : undefined, v)) return false;
  }
  return true;
}
const cmpNullsLast = (a, b) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : (ms(a) > ms(b) ? 1 : ms(a) < ms(b) ? -1 : 0));
export function runFind(rows, args = {}) {
  let out = rows.filter((r) => evalWhere(r, args.where));
  const ob = args.orderBy && (Array.isArray(args.orderBy) ? args.orderBy[0] : args.orderBy);
  if (ob) {
    const [k, dir] = Object.entries(ob)[0];
    if (typeof dir !== 'object' || (dir && dir.sort)) {
      const d = typeof dir === 'object' ? dir.sort : dir;
      out = out.slice().sort((a, b) => (d === 'desc' ? -1 : 1) * cmpNullsLast(a[k], b[k]));
    }
  }
  if (args.skip) out = out.slice(args.skip);
  if (args.take != null) out = out.slice(0, args.take);
  return out;
}

// ---------------------------------------------------------------- SQL גולמי מדומה
const digitsOf = (s) => String(s || '').replace(/\D/g, '');
export function emulateRaw(sql, params) {
  T.raw.push({ sql, params });
  if (T.rawFail) throw new Error('raw down');
  if (/regexp_replace/.test(sql) && /FROM "Customer"/.test(sql)) {
    // מחקה: regexp_replace(phone,'\D','','g') IN (...) / LIKE ...  על phone1/phone2
    const isLike = / LIKE \$/.test(sql);
    const hit = (ph) => {
      const d = digitsOf(ph);
      if (!d) return false;
      return params.some((p) => (isLike ? d.includes(String(p).replace(/%/g, '')) : d === String(p)));
    };
    let rows = T.customers.filter((c) => hit(c.phone1) || hit(c.phone2)).map((c) => ({ id: c.id }));
    if (/ORDER BY "id"/.test(sql)) rows = rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); // מדמה ORDER BY "id"
    const lim = /LIMIT (\d+)/.exec(sql);
    return lim ? rows.slice(0, Number(lim[1])) : rows;
  }
  if (/similarity\(/.test(sql) && /FROM "Customer"/.test(sql)) {
    // מועמדי pg_trgm: מדמה DB רופף - מחזיר את כל הלקוחות הלא-מחוקים; האימות המדויק נעשה ב-JS (lib/searchFuzzy.js)
    return T.customers.filter((c) => !c.isDeleted).map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }));
  }
  return [];
}

// ---------------------------------------------------------------- prisma בזיכרון
export function resetT(extra = {}) {
  Object.assign(T, {
    authed: true, pages: new Set(), asked: [], settings: {}, calls: [], raw: [], rawFail: false,
    orders: [], customers: [], dressModels: [], dressItems: [], orderItems: [],
    ...extra,
  });
}
const rec = (name, args) => T.calls.push({ name, args });
const model = (name, key) => ({
  findMany: async (args) => { rec(`${name}.findMany`, args); return runFind(T[key], args).map((r) => ({ ...r })); },
  count: async (args) => { rec(`${name}.count`, args); return runFind(T[key], { where: args && args.where }).length; },
  findFirst: async (args) => { rec(`${name}.findFirst`, args); return runFind(T[key], args)[0] || null; },
  // groupBy מינימלי: by=[עמודה], _count._all, מיון לפי הספירה (יורד), take
  groupBy: async (args) => {
    rec(`${name}.groupBy`, args);
    const col = args.by[0];
    const groups = new Map();
    for (const r of runFind(T[key], { where: args.where })) groups.set(r[col], (groups.get(r[col]) || 0) + 1);
    let out = [...groups.entries()].map(([v, n]) => ({ [col]: v, _count: { _all: n, [col]: n } }));
    out.sort((a, b) => b._count._all - a._count._all);
    if (args.take != null) out = out.slice(0, args.take);
    return out;
  },
});
T.prisma = {
  order: model('order', 'orders'),
  customer: model('customer', 'customers'),
  dressModel: model('dressModel', 'dressModels'),
  dressItem: model('dressItem', 'dressItems'),
  orderItem: model('orderItem', 'orderItems'),
  $queryRawUnsafe: async (sql, ...params) => { rec('$queryRawUnsafe', { sql, params }); return emulateRaw(sql, params); },
  $queryRaw: async (strings, ...values) => { rec('$queryRaw', { sql: strings.join('?'), values }); return []; },
};
resetT();

export const req = (url) => new Request('http://localhost' + url);
export const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);

let passed = 0;
let failed = 0;
export async function t(name, fn) {
  try { resetT(); await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.stack || e.message); process.exitCode = 1; }
}
export function summary(label) {
  console.log(`\n${label}: ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}
