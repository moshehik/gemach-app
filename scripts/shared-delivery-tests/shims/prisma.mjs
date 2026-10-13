// In-memory Prisma stand-in for the shared-delivery tests (no database connection at all).
//   globalThis.__MOCK_DB = { order: [], customer: [], paymentObligation: [], payment: [], refund: [], systemSetting: [], deliveryJoin: [] }
//   Relations are resolved by key: order.customer (customerId -> customer.id), order.obligations / order.payments (orderId).
//   A model that is NOT a key of __MOCK_DB throws P2021 (missing table) - used for DeliveryJoin-missing tests.
//   globalThis.__MOCK_CALLS records every call; writes are applied in memory with Prisma-like semantics (P2002 on duplicate PK,
//   P2025 on missing row). `__audit` from auditAs() is stripped and recorded. $transaction(fn) runs fn with the same client.
//   globalThis.__MOCK_FAIL_ON = (model, method, args) => bool   - make a call throw (failure-injection tests)

const db = () => globalThis.__MOCK_DB || {};
const calls = () => (globalThis.__MOCK_CALLS ||= []);
const PK = { order: 'orderId', deliveryJoin: 'orderId' };

function cmp(a, b) {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  return av < bv ? -1 : av > bv ? 1 : 0;
}
function matchField(value, cond) {
  if (cond === null) return value === null || value === undefined;
  if (cond instanceof Date || typeof cond !== 'object') return value === cond || (value instanceof Date && cond instanceof Date && value.getTime() === cond.getTime());
  for (const [op, expected] of Object.entries(cond)) {
    if (op === 'not') { if (matchField(value, expected)) return false; continue; }
    if (op === 'in') { if (!expected.some((x) => matchField(value, x))) return false; continue; }
    if (op === 'notIn') { if (value === null || value === undefined) return false; if (expected.some((x) => matchField(value, x))) return false; continue; }
    if (value === null || value === undefined) return false;
    if (op === 'contains' && !String(value).includes(String(expected))) return false;
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

function prismaError(code, message) { const e = new Error(message); e.code = code; return e; }
function table(model) {
  const d = db();
  if (!(model in d)) throw prismaError('P2021', `The table \`public.${model[0].toUpperCase()}${model.slice(1)}\` does not exist in the current database.`);
  return d[model];
}

// relation resolvers: parent model -> relation name -> (row) => related rows
const REL = {
  order: {
    customer: (r) => (db().customer || []).find((c) => c.id === r.customerId) || null,
    obligations: (r) => (db().paymentObligation || []).filter((o) => o.orderId === r.orderId),
    payments: (r) => (db().payment || []).filter((p) => p.orderId === r.orderId),
  },
};
function project(model, row, args) {
  const sel = args && (args.select || args.include);
  if (!args || !sel) return { ...row };
  const out = args.select ? {} : { ...row };
  for (const [k, v] of Object.entries(sel)) {
    if (REL[model] && REL[model][k]) {
      let rel = REL[model][k](row);
      const sub = v && typeof v === 'object' ? v : null;
      if (Array.isArray(rel)) {
        if (sub?.where) rel = rel.filter((x) => matchWhere(x, sub.where));
        out[k] = rel.map((x) => (sub && (sub.select || sub.include) ? project(k === 'obligations' ? 'paymentObligation' : k.replace(/s$/, ''), x, sub) : { ...x }));
      } else {
        out[k] = rel ? (sub && (sub.select || sub.include) ? project(k, rel, sub) : { ...rel }) : null;
      }
    } else if (v === true) out[k] = row[k];
  }
  return out;
}
function applyOrderBy(rows, orderBy) {
  const specs = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).map((o) => { const [f, d] = Object.entries(o)[0]; return { f, desc: d === 'desc' }; });
  if (!specs.length) return rows;
  return [...rows].sort((a, b) => { for (const { f, desc } of specs) { const c = cmp(a[f] ?? null, b[f] ?? null); if (c) return desc ? -c : c; } return 0; });
}
function flattenUnique(model, where) {
  const out = {};
  for (const [k, v] of Object.entries(where || {})) out[k] = v;
  return out;
}
let idSeq = 0;
const newId = (model) => `${model}-${++idSeq}`;

const READS = {
  findMany: (model, args = {}) => {
    let rows = table(model).filter((r) => matchWhere(r, args.where));
    rows = applyOrderBy(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    return rows.map((r) => project(model, r, args));
  },
  findFirst: (model, args = {}) => READS.findMany(model, { ...args, take: 1 })[0] || null,
  findUnique: (model, args = {}) => {
    const row = table(model).find((r) => matchWhere(r, flattenUnique(model, args.where)));
    return row ? project(model, row, args) : null;
  },
  count: (model, args = {}) => table(model).filter((r) => matchWhere(r, args.where)).length,
};
const WRITES = {
  create: (model, args = {}) => {
    const rows = table(model);
    const data = { ...(args.data || {}) };
    const pk = PK[model];
    if (pk && rows.some((r) => r[pk] === data[pk])) throw prismaError('P2002', `Unique constraint failed on the fields: (${pk})`);
    const now = new Date();
    const row = { ...(pk ? {} : { id: newId(model) }), createdAt: now, updatedAt: now, ...data };
    if (model === 'paymentObligation') { row.isDeleted = row.isDeleted ?? false; row.isManual = row.isManual ?? false; }
    if (model === 'refund') { row.isDeleted = row.isDeleted ?? false; row.isExecuted = row.isExecuted ?? false; }
    if (model === 'deliveryJoin') { row.isPrimary = row.isPrimary ?? false; row.joinedToOrderId = row.joinedToOrderId ?? null; }
    rows.push(row);
    return { ...row };
  },
  update: (model, args = {}) => {
    const row = table(model).find((r) => matchWhere(r, flattenUnique(model, args.where)));
    if (!row) throw prismaError('P2025', 'Record to update not found.');
    Object.assign(row, args.data || {});
    row.updatedAt = new Date();
    return { ...row };
  },
  delete: (model, args = {}) => {
    const rows = table(model);
    const i = rows.findIndex((r) => matchWhere(r, flattenUnique(model, args.where)));
    if (i < 0) throw prismaError('P2025', 'Record to delete does not exist.');
    return rows.splice(i, 1)[0];
  },
};

const modelProxy = (model) => new Proxy({}, {
  get(_, method) {
    const impl = READS[method] || WRITES[method];
    if (!impl) return async () => { throw new Error(`UNSUPPORTED ${model}.${String(method)} in shared-delivery tests`); };
    return async (rawArgs) => {
      let args = rawArgs;
      let audit = null;
      if (args && args.__audit) { audit = args.__audit; args = { ...args }; delete args.__audit; }
      calls().push({ model, method, args, audit });
      if (typeof globalThis.__MOCK_FAIL_ON === 'function' && globalThis.__MOCK_FAIL_ON(model, method, args)) throw new Error(`injected failure ${model}.${method}`);
      return impl(model, args);
    };
  },
});

const proxy = new Proxy({}, {
  get(_, prop) {
    if (prop === 'then') return undefined;
    if (Array.isArray(globalThis.__MOCK_NO_MODEL) && globalThis.__MOCK_NO_MODEL.includes(prop)) return undefined;
    if (prop === '$transaction') return async (fn) => (typeof fn === 'function' ? fn(proxy) : Promise.all(fn));
    if (typeof prop === 'string' && prop.startsWith('$')) return async () => { throw new Error(`UNSUPPORTED ${prop}`); };
    return modelProxy(prop);
  },
});

export default proxy;
export const prisma = proxy;
export function auditAs(action, args, changes) {
  if (!action) return args;
  return { ...args, __audit: { action, changes } };
}
export async function getActingEmployeeId() { return null; }
export function runAsActor(employeeId, fn) { return fn(); }
