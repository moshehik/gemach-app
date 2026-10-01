// לקוח Prisma בזיכרון לבדיקות בדיקת המלאי: אין חיבור לשום מסד. תומך רק במה ש-
// lib/stockCheck.js, lib/inventory.js (getBulkAvailableInventory) ו-lib/settingsCache.js
// באמת קוראים: findMany / findUnique / findFirst עם where (AND/OR/NOT, in/notIn/not/contains/
// lt/lte/gt/gte/equals, יחסים מקוננים), select (מוחזרת השורה המלאה - על-קבוצה), distinct, take.
// כל כתיבה זורקת שגיאה - הבדיקות חייבות להישאר קריאה בלבד.
globalThis.__DB = globalThis.__DB || { dressModel: [], dressItem: [], orderItem: [], order: [], systemSetting: [] };

const isPlain = (v) => v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v);
const OPS = new Set(['in', 'notIn', 'not', 'contains', 'startsWith', 'endsWith', 'lt', 'lte', 'gt', 'gte', 'equals', 'mode', 'some', 'none', 'every']);
const num = (v) => (v instanceof Date ? v.getTime() : v);
const eq = (a, b) => {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a instanceof Date || b instanceof Date) return num(a) === num(b);
  return a === b;
};

function matchField(val, cond) {
  if (!isPlain(cond)) return eq(val, cond);
  const keys = Object.keys(cond);
  if (!keys.some((k) => OPS.has(k))) {
    // יחס מקונן (למשל order: { isDeleted: false })
    if (val === null || val === undefined) return false;
    return match(val, cond);
  }
  const insensitive = cond.mode === 'insensitive';
  const str = (v) => (insensitive ? String(v).toLowerCase() : String(v));
  for (const [op, arg] of Object.entries(cond)) {
    switch (op) {
      case 'mode': break;
      case 'equals': if (!eq(val, arg)) return false; break;
      case 'in': if (!arg.some((a) => eq(val, a))) return false; break;
      case 'notIn': if (val === null || val === undefined || arg.some((a) => eq(val, a))) return false; break;
      case 'not':
        if (arg === null) { if (val === null || val === undefined) return false; }
        else if (isPlain(arg)) { if (matchField(val, arg)) return false; }
        else if (eq(val, arg)) return false;
        break;
      case 'contains': if (val === null || val === undefined || !str(val).includes(str(arg))) return false; break;
      case 'startsWith': if (val === null || val === undefined || !str(val).startsWith(str(arg))) return false; break;
      case 'endsWith': if (val === null || val === undefined || !str(val).endsWith(str(arg))) return false; break;
      case 'lt': if (val === null || val === undefined || !(num(val) < num(arg))) return false; break;
      case 'lte': if (val === null || val === undefined || !(num(val) <= num(arg))) return false; break;
      case 'gt': if (val === null || val === undefined || !(num(val) > num(arg))) return false; break;
      case 'gte': if (val === null || val === undefined || !(num(val) >= num(arg))) return false; break;
      case 'some': if (!Array.isArray(val) || !val.some((r) => match(r, arg))) return false; break;
      case 'none': if (Array.isArray(val) && val.some((r) => match(r, arg))) return false; break;
      case 'every': if (Array.isArray(val) && !val.every((r) => match(r, arg))) return false; break;
      default: throw new Error('prisma shim: unsupported operator ' + op);
    }
  }
  return true;
}

function match(row, where) {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (k === 'AND') { if (!(Array.isArray(v) ? v : [v]).every((w) => match(row, w))) return false; continue; }
    if (k === 'OR') { if (!(Array.isArray(v) ? v : [v]).some((w) => match(row, w))) return false; continue; }
    if (k === 'NOT') { if ((Array.isArray(v) ? v : [v]).some((w) => match(row, w))) return false; continue; }
    if (!matchField(row ? row[k] : undefined, v)) return false;
  }
  return true;
}

// Prisma האמיתי זורק על ערך מחוץ לטווח Int (32 ביט) בשדה barcodePrefix - כאן מחקים את זה
// כדי שבדיקה עם מספר ענק תיתפס גם בלי DB.
const INT32_MAX = 2147483647;
function assertInt32(where) {
  if (!isPlain(where) && !Array.isArray(where)) return;
  for (const [k, v] of Object.entries(where)) {
    if (k === 'barcodePrefix') {
      const nums = isPlain(v) ? Object.values(v).flat() : [v];
      for (const n of nums) if (typeof n === 'number' && (n > INT32_MAX || n < -INT32_MAX - 1)) throw new Error(`prisma shim: Int out of range (barcodePrefix=${n})`);
    } else if (isPlain(v) || Array.isArray(v)) assertInt32(v);
  }
}

function model(name) {
  const rows = () => globalThis.__DB[name] || [];
  const all = (args = {}) => {
    assertInt32(args.where);
    let out = rows().filter((r) => match(r, args.where));
    if (args.distinct) {
      const seen = new Set();
      out = out.filter((r) => { const key = args.distinct.map((f) => JSON.stringify(r[f] ?? null)).join('|'); if (seen.has(key)) return false; seen.add(key); return true; });
    }
    if (args.skip) out = out.slice(args.skip);
    if (typeof args.take === 'number') out = out.slice(0, args.take);
    (globalThis.__QUERIES ||= []).push(`${name}.findMany`);
    return out.map((r) => ({ ...r }));
  };
  const blocked = (m) => async () => { throw new Error(`prisma shim: write blocked (${name}.${m})`); };
  return {
    findMany: async (args) => all(args),
    findFirst: async (args) => all({ ...args, take: 1 })[0] || null,
    findUnique: async (args) => { (globalThis.__QUERIES ||= []).push(`${name}.findUnique`); return rows().find((r) => match(r, args.where)) || null; },
    count: async (args) => all(args).length,
    create: blocked('create'), createMany: blocked('createMany'), update: blocked('update'), updateMany: blocked('updateMany'),
    upsert: blocked('upsert'), delete: blocked('delete'), deleteMany: blocked('deleteMany'),
  };
}

const proxy = new Proxy({}, {
  get(_, prop) {
    if (prop === 'then') return undefined;
    if (typeof prop === 'string' && prop.startsWith('$')) return async () => { throw new Error('prisma shim: ' + prop + ' blocked'); };
    return model(prop);
  },
});
export default proxy;
export const prisma = proxy;
