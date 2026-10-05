// In-memory stand-in for app/lib/prisma.js - only what app/api/customers/** + lib/settingsCache.js touch.
//   customer.findUnique / findFirst / create / update -> globalThis.__CUSTOMERS (array of rows)
//   systemSetting.findMany                          -> globalThis.__SETTINGS
// auditAs is the REAL contract: it tags the args with __audit; the shim's customer.update/create then records one
// AuditLog-like entry per write in globalThis.__AUDIT (the real extension does this; a route must never write its own row).
globalThis.__CUSTOMERS = globalThis.__CUSTOMERS || [];
globalThis.__SETTINGS = globalThis.__SETTINGS || [];
globalThis.__AUDIT = globalThis.__AUDIT || [];
globalThis.__CALLS = globalThis.__CALLS || [];

export function auditAs(action, args, changes) {
  if (!action) return args;
  return { ...args, __audit: { action, changes } };
}
export async function getActingEmployeeId() { return 'emp-1'; }

const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => {
  if (k === 'NOT') return !matches(row, v);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('not' in v) return row[k] !== v.not;
    return true;
  }
  return row[k] === v;
});

function strip(args) { const { __audit, ...rest } = args || {}; return { audit: __audit, args: rest }; }

const customer = {
  findUnique: async (args) => { globalThis.__CALLS.push({ op: 'customer.findUnique', args }); const r = globalThis.__CUSTOMERS.find((c) => matches(c, args.where)); return r ? { ...r } : null; },
  findFirst: async (args) => {
    globalThis.__CALLS.push({ op: 'customer.findFirst', args });
    const rows = globalThis.__CUSTOMERS.filter((c) => matches(c, args.where));
    return rows[0] ? { ...rows[0] } : null;
  },
  update: async (raw) => {
    const { audit, args } = strip(raw);
    globalThis.__CALLS.push({ op: 'customer.update', args, audit });
    const row = globalThis.__CUSTOMERS.find((c) => matches(c, args.where));
    if (!row) throw new Error('record not found');
    const before = { ...row };
    for (const [k, v] of Object.entries(args.data)) if (v !== undefined) row[k] = v;
    row.updatedAt = new Date(Math.max(Date.now(), new Date(before.updatedAt || 0).getTime() + 1));
    const changes = audit ? audit.changes : args.data;
    if (!audit || Object.keys(changes || {}).length) globalThis.__AUDIT.push({ entityType: 'Customer', entityId: row.id, action: audit ? audit.action : 'UPDATE', changes });
    return { ...row };
  },
  create: async (raw) => {
    const { audit, args } = strip(raw);
    globalThis.__CALLS.push({ op: 'customer.create', args, audit });
    const row = { id: `new-${globalThis.__CUSTOMERS.length + 1}`, hasSignedRegulations: false, regulationsSignedAt: null, ...args.data, updatedAt: new Date() };
    globalThis.__CUSTOMERS.push(row);
    globalThis.__AUDIT.push({ entityType: 'Customer', entityId: row.id, action: 'CREATE', changes: { ...row } });
    return { ...row };
  },
};

const prisma = {
  customer,
  systemSetting: { findMany: async () => [...globalThis.__SETTINGS], findUnique: async (a) => globalThis.__SETTINGS.find((s) => s.key === a.where.key) || null },
};
export default prisma;
