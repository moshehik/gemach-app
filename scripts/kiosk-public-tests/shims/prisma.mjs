// In-memory stand-in for app/lib/prisma.js - only what the public-kiosk code, /api/customers and lib/inventory touch.
globalThis.__CUSTOMERS = globalThis.__CUSTOMERS || [];
globalThis.__SETTINGS = globalThis.__SETTINGS || [];
globalThis.__AUDIT = globalThis.__AUDIT || [];
globalThis.__CONSENTS = globalThis.__CONSENTS || []; // CustomerConsent journal rows (lib/customerConsent.js via lib/customerConsentServer.js)
globalThis.__MODELS = globalThis.__MODELS || [];
globalThis.__ITEMS = globalThis.__ITEMS || [];

export function auditAs(action, args, changes) { return action ? { ...args, __audit: { action, changes } } : args; }
export async function getActingEmployeeId() { return null; }

const matchVal = (rv, v) => {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('in' in v) return v.in.includes(rv);
    if ('not' in v) return rv !== v.not && !(v.not === null && rv == null);
    if ('contains' in v) return String(rv || '').includes(v.contains);
    return true;
  }
  return rv === v;
};
const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => {
  if (k === 'OR') return v.some((w) => matches(row, w));
  if (k === 'AND') return v.every((w) => matches(row, w));
  return matchVal(row[k], v);
});
const strip = (args) => { const { __audit, ...rest } = args || {}; return { audit: __audit, args: rest }; };
const sel = (row, select) => { if (!select) return { ...row }; const o = {}; for (const k of Object.keys(select)) if (select[k]) o[k] = row[k]; return o; };

const customer = {
  findFirst: async (args) => {
    let rows = globalThis.__CUSTOMERS.filter((c) => matches(c, args.where));
    if (args.orderBy && args.orderBy.legacyId === 'desc') rows = [...rows].sort((a, b) => (b.legacyId || 0) - (a.legacyId || 0));
    return rows[0] ? sel(rows[0], args.select) : null;
  },
  findMany: async (args) => globalThis.__CUSTOMERS.filter((c) => matches(c, args.where)).map((r) => sel(r, args.select)),
  findUnique: async (args) => { const r = globalThis.__CUSTOMERS.find((c) => matches(c, args.where)); return r ? sel(r, args.select) : null; },
  create: async (raw) => {
    const { args } = strip(raw);
    if (args.data.legacyId != null && globalThis.__CUSTOMERS.some((c) => c.legacyId === args.data.legacyId)) { const e = new Error('Unique constraint'); e.code = 'P2002'; throw e; }
    const row = { id: `new-${globalThis.__CUSTOMERS.length + 1}`, isDeleted: false, hasSignedRegulations: false, regulationsSignedAt: null, ...args.data, updatedAt: new Date() };
    globalThis.__CUSTOMERS.push(row);
    globalThis.__AUDIT.push({ entityType: 'Customer', entityId: row.id, action: 'CREATE' });
    return sel(row, args.select);
  },
  update: async (raw) => {
    const { audit, args } = strip(raw);
    const row = globalThis.__CUSTOMERS.find((c) => matches(c, args.where));
    if (!row) throw new Error('record not found');
    for (const [k, v] of Object.entries(args.data)) if (v !== undefined) row[k] = v;
    globalThis.__AUDIT.push({ entityType: 'Customer', entityId: row.id, action: audit ? audit.action : 'UPDATE', data: args.data });
    return { ...row };
  },
};

let consentSeq = 0;
const customerConsent = {
  createMany: async ({ data }) => { for (const d of data) globalThis.__CONSENTS.push({ id: `cc-${++consentSeq}`, createdAt: new Date(), ...d }); return { count: data.length }; },
  findMany: async () => [...globalThis.__CONSENTS],
};

const prisma = {
  customer,
  customerConsent,
  systemSetting: { findMany: async () => [...globalThis.__SETTINGS], findUnique: async (a) => globalThis.__SETTINGS.find((s) => s.key === a.where.key) || null, findFirst: async () => null },
  dressModel: {
    findMany: async (args = {}) => {
      const w = args.where || {};
      const active = (i) => !i.notInUse && !i.isDeleted;
      let rows = globalThis.__MODELS;
      if (w.id && w.id.in) rows = rows.filter((m) => w.id.in.includes(m.id));
      if ('isDeleted' in w) rows = rows.filter((m) => m.isDeleted === w.isDeleted);
      if ('exitDateFromRepo' in w) rows = rows.filter((m) => (m.exitDateFromRepo ?? null) === w.exitDateFromRepo);
      if (w.items && w.items.some) rows = rows.filter((m) => (m.items || []).some(active));
      const s = args.select;
      return rows.map((m) => {
        if (!s) return { ...m };
        const o = {};
        for (const k of Object.keys(s)) if (s[k] && k !== 'items') o[k] = m[k];
        if (s.items) o.items = (m.items || []).filter(active).map((i) => ({ sizeText: i.sizeText }));
        return o;
      });
    },
  },
  dressItem: { findMany: async () => globalThis.__ITEMS.filter((i) => !i.notInUse && !i.isDeleted && !i.inRepair) },
  orderItem: { findMany: async () => [] },
  // lib/searchDb.js findCustomerIdsByPhone: params = exact phone keys (digits) / '%partial%'
  $queryRawUnsafe: async (sql, ...params) => {
    const exact = new Set(params.filter((p) => typeof p === 'string' && !p.startsWith('%')));
    const digits = (s) => String(s || '').replace(/\D/g, '');
    return globalThis.__CUSTOMERS.filter((c) => exact.has(digits(c.phone1)) || exact.has(digits(c.phone2))).map((c) => ({ id: c.id }));
  },
};
export default prisma;
