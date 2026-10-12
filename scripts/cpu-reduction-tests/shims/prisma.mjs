// In-memory stand-in for app/lib/prisma.js - ONLY the SystemSetting surface used by app/api/settings/route.js, app/api/settings/labels/route.js
// and lib/settingsCache.js. findMany honours the exact where/orderBy the real route uses (key notIn, category asc nulls last, id asc), so the
// "old vs new" comparison in settings-get.test.mjs exercises the same query semantics. Every query is recorded in globalThis.__MOCK_CALLS.
globalThis.__SETTINGS = globalThis.__SETTINGS || [];
globalThis.__MOCK_CALLS = globalThis.__MOCK_CALLS || [];
globalThis.__FIND_MANY_DELAY = 0; // ms - lets a test make a read slow to interleave a write
globalThis.__FIND_MANY_FAIL = false;

const cmp = (a, b) => (a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : a < b ? -1 : 1); // Postgres ASC: NULLS LAST

const prisma = {
  systemSetting: {
    findMany: async (args = {}) => {
      globalThis.__MOCK_CALLS.push({ model: 'systemSetting', op: 'findMany', args });
      if (globalThis.__FIND_MANY_DELAY) await new Promise((r) => setTimeout(r, globalThis.__FIND_MANY_DELAY));
      if (globalThis.__FIND_MANY_FAIL) throw new Error('db down');
      let rows = globalThis.__SETTINGS.map((r) => ({ ...r })); // a real DB hands out fresh objects
      const notIn = args.where && args.where.key && args.where.key.notIn;
      if (notIn) rows = rows.filter((r) => !notIn.includes(r.key));
      for (const o of [...(args.orderBy || [])].reverse()) {
        const [[field, dir]] = Object.entries(o);
        rows.sort((a, b) => (dir === 'desc' ? -1 : 1) * cmp(a[field] ?? null, b[field] ?? null));
      }
      return rows;
    },
    findUnique: async (args) => {
      globalThis.__MOCK_CALLS.push({ model: 'systemSetting', op: 'findUnique', args });
      const r = globalThis.__SETTINGS.find((s) => s.key === args.where.key);
      return r ? { ...r } : null;
    },
    // phase0: hasBrandLogo() = findFirst({ where: { key, value: { not: '' } }, select: { id: true } })
    findFirst: async (args = {}) => {
      globalThis.__MOCK_CALLS.push({ model: 'systemSetting', op: 'findFirst', args });
      if (globalThis.__FIND_MANY_FAIL) throw new Error('db down');
      const w = args.where || {};
      const r = globalThis.__SETTINGS.find((s) => (w.key === undefined || s.key === w.key)
        && (!w.value || w.value.not === undefined || s.value !== w.value.not));
      if (!r) return null;
      return args.select ? Object.fromEntries(Object.keys(args.select).map((k) => [k, r[k]])) : { ...r };
    },
    upsert: async (args) => {
      globalThis.__MOCK_CALLS.push({ model: 'systemSetting', op: 'upsert', args });
      const row = globalThis.__SETTINGS.find((s) => s.key === args.where.key);
      if (row) { Object.assign(row, args.update); return row; }
      const created = { id: `id-${globalThis.__SETTINGS.length + 1}`, ...args.create };
      globalThis.__SETTINGS.push(created);
      return created;
    },
  },
  employee: { findUnique: async () => null },
};

export default prisma;

// lib/permissions.js imports auditAs (audit-log helper) - in the shim it just returns the args untouched
export function auditAs(action, args) { return args; }
