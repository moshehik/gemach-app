// In-memory Prisma stand-in for the schedule tests. No database connection at all.
//   globalThis.__MOCK_DB  = { order: [...], shift: [...], systemSetting: [...], dressModel: [...], employee: [...], departmentPermission: [...], employeePermissionOverride: [...] }
//   globalThis.__MOCK_CALLS = every call ({ model, method, args, audit }) - tests assert the `where` windows and the audit action names.
// A small evaluator applies the common Prisma `where` shapes the schedule layer uses (equality, null,
// not, in, gte/lte/gt/lt, AND/OR/NOT); relation filters are treated as "match" (superset is fine - the
// loaders re-check day keys in JS). Nested `items: { where: { isDeleted } }` selects are applied.
//
// Writes: the READ-ONLY data layer must never write - any write throws unless the test opted in with
//   globalThis.__MOCK_WRITABLE = ['scheduleStageMark', 'orderItem']   (models the marks tests write)
// Writes are then applied in memory (create / update / updateMany / delete) with Prisma-like semantics:
// a compound unique (orderId, stageKey, dayKey) on scheduleStageMark raises P2002, update by id/unique,
// `__audit` from auditAs() is stripped and recorded on the call. No audit rows are written (the real
// extension is not under test here).
// Missing table: a model that is NOT a key of __MOCK_DB throws P2021 ("does not exist") - the same shape
// Prisma raises when the SQL for a new table has not been applied yet (the schedule marks must degrade).
// $transaction / raw queries always throw.

const db = () => globalThis.__MOCK_DB || {};
const calls = () => (globalThis.__MOCK_CALLS ||= []);
const writable = () => globalThis.__MOCK_WRITABLE || [];

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

function prismaError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// Prisma raises P2021 ("The table `public.X` does not exist in the current database.") for a missing table
function table(model) {
  const d = db();
  // OrderItem rows live nested inside each mock order (order.items) - the same objects, so an
  // orderItem.update from the marks layer is visible through the order loaders in the same test
  if (model === 'orderItem' && !(model in d) && Array.isArray(d.order)) return d.order.flatMap((o) => o.items || []);
  if (!(model in d)) throw prismaError('P2021', `The table \`public.${model[0].toUpperCase()}${model.slice(1)}\` does not exist in the current database.`);
  return d[model];
}

const READS = {
  findMany: (model, args = {}) => {
    let rows = table(model).filter((r) => matchWhere(r, args.where)).map((r) => project(r, args));
    rows = applyOrderBy(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    return rows;
  },
  findFirst: (model, args = {}) => READS.findMany(model, { ...args, take: 1 })[0] || null,
  findUnique: (model, args = {}) => {
    const where = flattenUnique(args.where);
    return table(model).find((r) => matchWhere(r, where)) || null;
  },
  count: (model, args = {}) => READS.findMany(model, { ...args, take: undefined }).length,
};

// compound uniques the marks tests rely on (model -> field lists)
const UNIQUES = { scheduleStageMark: [['orderId', 'stageKey', 'dayKey']] };
let idSeq = 0;
const newId = (model) => `${model}-${++idSeq}`;
const unset = (v) => (v && typeof v === 'object' && !(v instanceof Date) && 'set' in v ? v.set : v);

const WRITES = {
  create: (model, args = {}) => {
    const rows = table(model);
    const data = Object.fromEntries(Object.entries(args.data || {}).map(([k, v]) => [k, unset(v)]));
    for (const fields of UNIQUES[model] || []) {
      if (rows.some((r) => fields.every((f) => r[f] === data[f]))) throw prismaError('P2002', `Unique constraint failed on the fields: (${fields.join(',')})`);
    }
    const now = new Date();
    const row = { id: newId(model), createdAt: now, updatedAt: now, ...(model === 'scheduleStageMark' ? { done: true, markedAt: now } : {}), ...data };
    rows.push(row);
    return { ...row };
  },
  update: (model, args = {}) => {
    const rows = table(model);
    const where = flattenUnique(args.where);
    const row = rows.find((r) => matchWhere(r, where));
    if (!row) throw prismaError('P2025', 'Record to update not found.');
    for (const [k, v] of Object.entries(args.data || {})) row[k] = unset(v);
    row.updatedAt = new Date();
    return { ...row };
  },
  updateMany: (model, args = {}) => {
    let n = 0;
    for (const row of table(model)) {
      if (!matchWhere(row, args.where)) continue;
      for (const [k, v] of Object.entries(args.data || {})) row[k] = unset(v);
      n++;
    }
    return { count: n };
  },
  delete: (model, args = {}) => {
    const rows = table(model);
    const where = flattenUnique(args.where);
    const i = rows.findIndex((r) => matchWhere(r, where));
    if (i < 0) throw prismaError('P2025', 'Record to delete does not exist.');
    return rows.splice(i, 1)[0];
  },
};

const modelProxy = (model) => new Proxy({}, {
  get(_, method) {
    if (READS[method]) {
      return async (args) => { calls().push({ model, method, args }); return READS[method](model, args); };
    }
    if (WRITES[method]) {
      return async (rawArgs) => {
        let args = rawArgs;
        let audit = null;
        if (args && args.__audit) { audit = args.__audit; args = { ...args }; delete args.__audit; }
        calls().push({ model, method, args, audit });
        if (!writable().includes(model)) throw new Error(`BLOCKED write in schedule tests: ${model}.${String(method)}`);
        // test hook: runs right before the write is applied (e.g. to simulate a competing writer -> P2002)
        if (typeof globalThis.__MOCK_BEFORE_WRITE === 'function') globalThis.__MOCK_BEFORE_WRITE(model, method, args);
        return WRITES[method](model, args);
      };
    }
    return async () => { throw new Error(`BLOCKED write in schedule tests: ${model}.${String(method)}`); };
  },
});

const proxy = new Proxy({}, {
  get(_, prop) {
    if (prop === 'then') return undefined;
    // stale generated client: a model that is not in the Prisma client at all (prisma.x === undefined)
    if (Array.isArray(globalThis.__MOCK_NO_MODEL) && globalThis.__MOCK_NO_MODEL.includes(prop)) return undefined;
    if (typeof prop === 'string' && prop.startsWith('$')) return async () => { throw new Error(`BLOCKED ${prop} in schedule tests`); };
    return modelProxy(prop);
  },
});

export default proxy;
export const prisma = proxy;
// same contract as app/lib/prisma.js: the write args carry __audit (stripped and recorded by the shim above)
export function auditAs(action, args, changes) {
  if (!action) return args;
  return { ...args, __audit: { action, changes } };
}
export async function getActingEmployeeId() { return null; }
