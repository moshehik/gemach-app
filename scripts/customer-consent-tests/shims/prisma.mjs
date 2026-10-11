// In-memory stand-in for app/lib/prisma.js - only what the customer routes, the consent library, the public terms/consent-info routes and the
// terms-file admin route touch:
//   customer.findUnique / findFirst / create / update   -> globalThis.__CUSTOMERS
//   customerConsent.createMany / findMany                -> globalThis.__CONSENTS   (globalThis.__CONSENT_FAIL = 'table-missing' | 'error' makes createMany throw)
//   systemSetting.findMany / findUnique / upsert         -> globalThis.__SETTINGS
//   attachment.create / findUnique                       -> globalThis.__ATTACHMENTS
//   auditLog.create                                      -> globalThis.__MANUAL_AUDIT   (the real extension writes automatic rows; this counts HAND-written ones)
// auditAs is the REAL contract: it tags the args with __audit; customer.create/update then records one AuditLog-like entry per write in globalThis.__AUDIT.
globalThis.__CUSTOMERS = globalThis.__CUSTOMERS || [];
globalThis.__SETTINGS = globalThis.__SETTINGS || [];
globalThis.__AUDIT = globalThis.__AUDIT || [];
globalThis.__CALLS = globalThis.__CALLS || [];
globalThis.__CONSENTS = globalThis.__CONSENTS || [];
globalThis.__ATTACHMENTS = globalThis.__ATTACHMENTS || [];
globalThis.__MANUAL_AUDIT = globalThis.__MANUAL_AUDIT || [];

export function auditAs(action, args, changes) {
  if (!action) return args;
  return { ...args, __audit: { action, changes } };
}
export async function getActingEmployeeId() { return globalThis.__ACTOR === undefined ? 'emp-1' : globalThis.__ACTOR; }

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

let seq = 0;
const customerConsent = {
  createMany: async ({ data }) => {
    globalThis.__CALLS.push({ op: 'customerConsent.createMany', data });
    if (globalThis.__CONSENT_FAIL === 'table-missing') { const e = new Error('The table `public.CustomerConsent` does not exist in the current database.'); e.code = 'P2021'; throw e; }
    if (globalThis.__CONSENT_FAIL === 'error') throw new Error('boom');
    const base = Date.now();
    for (const d of data) globalThis.__CONSENTS.push({ id: `cc-${++seq}`, createdAt: new Date(base + seq), ...d });
    return { count: data.length };
  },
  findMany: async ({ where, orderBy, take } = {}) => {
    globalThis.__CALLS.push({ op: 'customerConsent.findMany', where });
    if (globalThis.__CONSENT_FAIL === 'table-missing') { const e = new Error('The table `public.CustomerConsent` does not exist'); e.code = 'P2021'; throw e; }
    let rows = globalThis.__CONSENTS.filter((r) => matches(r, where));
    if (orderBy && orderBy.createdAt === 'desc') rows = rows.slice().sort((a, b) => b.createdAt - a.createdAt);
    return rows.slice(0, take || 100).map((r) => ({ ...r }));
  },
};

const systemSetting = {
  findMany: async () => globalThis.__SETTINGS.map((s) => ({ updatedAt: new Date('2026-10-01T00:00:00Z'), ...s })),
  findUnique: async (a) => globalThis.__SETTINGS.find((s) => s.key === a.where.key) || null,
  upsert: async ({ where, update, create }) => {
    const row = globalThis.__SETTINGS.find((s) => s.key === where.key);
    if (row) { Object.assign(row, update, { updatedAt: new Date() }); return { ...row }; }
    const made = { ...create, updatedAt: new Date() };
    globalThis.__SETTINGS.push(made);
    return { ...made };
  },
};

const attachment = {
  create: async ({ data }) => { const row = { id: `att-${globalThis.__ATTACHMENTS.length + 1}`, data: data.data, contentType: data.contentType }; globalThis.__ATTACHMENTS.push(row); return { id: row.id }; },
  findUnique: async ({ where }) => { const r = globalThis.__ATTACHMENTS.find((a) => a.id === where.id); return r ? { data: r.data, contentType: r.contentType } : null; },
};

const auditLog = { create: async ({ data }) => { globalThis.__MANUAL_AUDIT.push(data); return data; } };

const prisma = { customer, customerConsent, systemSetting, attachment, auditLog };
export default prisma;
