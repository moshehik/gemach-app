// In-memory, READ-ONLY Prisma stand-in for the schedule tests. No database connection at all.
//   globalThis.__MOCK_DB  = { order: [...], shift: [...], systemSetting: [...], dressModel: [...], employee: [...], departmentPermission: [...], employeePermissionOverride: [...] }
//   globalThis.__MOCK_CALLS = every findMany/findUnique/findFirst call ({ model, method, args }) - tests assert the `where` windows.
// A small evaluator applies the common Prisma `where` shapes the schedule layer uses (equality, null,
// not, in, gte/lte/gt/lt, AND/OR/NOT); relation filters are treated as "match" (superset is fine - the
// loaders re-check day keys in JS). Nested `items: { where: { isDeleted } }` selects are applied.
// Any write, $transaction or raw query throws - the data layer under test must never write.

const db = () => globalThis.__MOCK_DB || {};
const calls = () => (globalThis.__MOCK_CALLS ||= []);

function cmp(a, b) {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function matchField(value, cond) {
  if (cond === null) return value === null || value === undefined;
  if (cond instanceof Date || typeof cond !== 'object') return value === cond || (value instanceof Date && cond instanceof Date && value.getTime() === cond.getTime());
  if ('some' in cond || 'every' in cond || 'none' in cond || 'is' in cond || 'isNot' in cond) return true; // relation filter - not evaluated
  for (const [op, expected] of Object.entries(cond)) {
    if (op === 'not') { if (matchField(value, expected)) return false; continue; }
    if (op === 'in') { if (!expected.some((x) => matchField(value, x))) return false; continue; }
    if (op === 'notIn') { if (expected.some((x) => matchField(value, x))) return false; continue; }
    if (value === null || value === undefined) return false;
    if (op === 'gte' && cmp(value, expected) < 0) return false;
    if (op === 'lte' && cmp(value, expected) > 0) return false;
    if (op === 'gt' && cmp(value, expected) <= 0) return false;
    if (op === 'lt' && cmp(value, expected) >= 0) return false;
  }
  return true;
}

export function matchWhere(row, where) {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'AND') { if (!(Array.isArray(cond) ? cond : [cond]).every((w) => matchWhere(row, w))) return false; continue; }
    if (key === 'OR') { if (!(Array.isArray(cond) ? cond : [cond]).some((w) => matchWhere(row, w))) return false; continue; }
    if (key === 'NOT') { if ((Array.isArray(cond) ? cond : [cond]).some((w) => matchWhere(row, w))) return false; continue; }
    if (!matchField(row[key], cond)) return false;
  }
  return true;
}

function project(row, args) {
  const sel = (args && (args.select || args.include)) || null;
  const out = { ...row };
  if (sel && sel.items && Array.isArray(row.items)) {
    const w = sel.items.where;
    out.items = w ? row.items.filter((i) => matchWhere(i, w)) : row.items;
  }
  return out;
}

function flattenUnique(where) {
  const out = {};
  for (const [k, v] of Object.entries(where || {})) {
    if (v && typeof v === 'object' && !(v instanceof Date) && k.includes('_')) Object.assign(out, v);
    else out[k] = v;
  }
  return out;
}

function applyOrderBy(rows, orderBy) {
  const specs = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).map((o) => {
    const [field, dir] = Object.entries(o)[0];
    return { field, desc: (typeof dir === 'string' ? dir : dir?.sort) === 'desc' };
  });
  if (!specs.length) return rows;
  return [...rows].sort((a, b) => {
    for (const { field, desc } of specs) {
      const c = cmp(a[field] ?? null, b[field] ?? null);
      if (c) return desc ? -c : c;
    }
    return 0;
  });
}

const READS = {
  findMany: (model, args = {}) => {
    let rows = (db()[model] || []).filter((r) => matchWhere(r, args.where)).map((r) => project(r, args));
    rows = applyOrderBy(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    return rows;
  },
  findFirst: (model, args = {}) => READS.findMany(model, { ...args, take: 1 })[0] || null,
  findUnique: (model, args = {}) => {
    const where = flattenUnique(args.where);
    return (db()[model] || []).find((r) => matchWhere(r, where)) || null;
  },
  count: (model, args = {}) => READS.findMany(model, { ...args, take: undefined }).length,
};

const modelProxy = (model) => new Proxy({}, {
  get(_, method) {
    if (READS[method]) {
      return async (args) => { calls().push({ model, method, args }); return READS[method](model, args); };
    }
    return async () => { throw new Error(`BLOCKED write in schedule tests: ${model}.${String(method)}`); };
  },
});

const proxy = new Proxy({}, {
  get(_, prop) {
    if (prop === 'then') return undefined;
    if (typeof prop === 'string' && prop.startsWith('$')) return async () => { throw new Error(`BLOCKED ${prop} in schedule tests`); };
    return modelProxy(prop);
  },
});

export default proxy;
export const prisma = proxy;
export function auditAs(action, args) { return args; }
export async function getActingEmployeeId() { return null; }
