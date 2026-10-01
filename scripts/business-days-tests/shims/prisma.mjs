// In-memory stand-in for app/lib/prisma.js. Only what lib/deliveries.js + lib/settingsCache.js touch:
//   systemSetting.findMany / findUnique   -> globalThis.__SETTINGS (array of {key, value})
//   order.findMany({ where: { isDeleted, isDelivery, OR: [{eventDate:{gte,lte}}...] } })
//                                          -> globalThis.__ORDERS filtered the way Postgres would
// Every query is recorded in globalThis.__MOCK_CALLS so a test can assert the exact where clause.
globalThis.__SETTINGS = globalThis.__SETTINGS || [];
globalThis.__ORDERS = globalThis.__ORDERS || [];
globalThis.__MOCK_CALLS = globalThis.__MOCK_CALLS || [];

function inRange(value, cond) {
  if (!cond) return true;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (cond.gte !== undefined && !(t >= new Date(cond.gte).getTime())) return false;
  if (cond.lte !== undefined && !(t <= new Date(cond.lte).getTime())) return false;
  if (cond.gt !== undefined && !(t > new Date(cond.gt).getTime())) return false;
  if (cond.lt !== undefined && !(t < new Date(cond.lt).getTime())) return false;
  return true;
}

function matchOrder(o, where) {
  if (where.isDeleted !== undefined && !!o.isDeleted !== where.isDeleted) return false;
  if (where.isDelivery !== undefined && !!o.isDelivery !== where.isDelivery) return false;
  if (where.eventDate) {
    if (!o.eventDate || !inRange(o.eventDate, where.eventDate)) return false;
  }
  if (where.OR) {
    const any = where.OR.some((c) => {
      if (c.eventDate) return o.eventDate ? inRange(o.eventDate, c.eventDate) : false;
      return true;
    });
    if (!any) return false;
  }
  return true;
}

const prisma = {
  systemSetting: {
    findMany: async (args) => { globalThis.__MOCK_CALLS.push({ model: 'systemSetting', op: 'findMany', args }); return [...globalThis.__SETTINGS]; },
    findUnique: async (args) => { globalThis.__MOCK_CALLS.push({ model: 'systemSetting', op: 'findUnique', args }); return globalThis.__SETTINGS.find((s) => s.key === args.where.key) || null; },
  },
  // lib/inventory.js checkMissingDressForItem (return-dates.test.mjs): stock units + units currently out
  dressItem: { findMany: async (args) => { globalThis.__MOCK_CALLS.push({ model: 'dressItem', op: 'findMany', args }); return [...(globalThis.__DRESS_ITEMS || [])]; } },
  orderItem: { findMany: async (args) => { globalThis.__MOCK_CALLS.push({ model: 'orderItem', op: 'findMany', args }); return [...(globalThis.__ORDER_ITEMS || [])]; } },
  order: {
    findMany: async (args) => {
      globalThis.__MOCK_CALLS.push({ model: 'order', op: 'findMany', args });
      const rows = globalThis.__ORDERS.filter((o) => matchOrder(o, args.where || {}));
      rows.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate) || a.orderId - b.orderId);
      // include: customer / items / obligations are already embedded on the fixture rows
      return rows.map((o) => ({ ...o, items: (o.items || []).filter((i) => !i.isDeleted), obligations: (o.obligations || []).filter((i) => !i.isDeleted) }));
    },
  },
};

export default prisma;
