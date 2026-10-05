// prisma בזיכרון: deliveryJoin + order, מספיק ל-lib/deliveryJoin.js. מתעד שאילתות / כתיבות / שורות audit (כמו התוסף האמיתי: רק create/update/delete).
const F = () => globalThis.__neveFake;

function match(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === 'OR') return cond.some(w => match(row, w));
    if (k === 'AND') return cond.every(w => match(row, w));
    const v = row[k];
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return cond.in.includes(v);
      if ('not' in cond) return v !== cond.not;
      if ('gte' in cond || 'lte' in cond) { const t = new Date(v).getTime(); return (!('gte' in cond) || t >= new Date(cond.gte).getTime()) && (!('lte' in cond) || t <= new Date(cond.lte).getTime()); }
      return false;
    }
    return v === cond;
  });
}
const pick = (row, select) => {
  if (!row) return null;
  if (!select) return { ...row };
  const o = {};
  for (const k of Object.keys(select)) if (select[k]) o[k] = row[k];
  return o;
};

function delegate(table, pk) {
  const touch = (op) => {
    const f = F();
    f.queries.push(`${table}.${op}`);
    if (f.failWith && table === 'deliveryJoin') throw f.failWith;
  };
  const audit = (op, args, result) => {
    // כמו תוסף ה-audit: רק create/update/delete נרשמים; entityId מ-result.id || result.orderId
    const a = args.__audit;
    F().audits.push({ entityType: table, entityId: String(result[pk] ?? ''), action: a ? a.action : op.toUpperCase(), changes: a ? a.changes : null });
  };
  return {
    async findUnique({ where, select }) { touch('findUnique'); return pick(F().db[table].find(r => r[pk] === where[pk]) || null, select); },
    async findFirst({ where, select } = {}) { touch('findFirst'); return pick(F().db[table].find(r => match(r, where)) || null, select); },
    async findMany({ where, select, orderBy } = {}) {
      touch('findMany');
      let rows = F().db[table].filter(r => match(r, where));
      if (orderBy && orderBy.orderId === 'asc') rows = [...rows].sort((a, b) => a.orderId - b.orderId);
      return rows.map(r => pick(r, select));
    },
    async create(args) {
      touch('create');
      const exists = F().db[table].find(r => r[pk] === args.data[pk]);
      if (exists) { const e = new Error('Unique constraint failed'); e.code = 'P2002'; throw e; }
      const row = { isPrimary: false, joinedToOrderId: null, direction: null, ...args.data };
      F().db[table].push(row);
      audit('create', args, row);
      return { ...row };
    },
    async update(args) {
      touch('update');
      const row = F().db[table].find(r => r[pk] === args.where[pk]);
      if (!row) { const e = new Error('Record not found'); e.code = 'P2025'; throw e; }
      Object.assign(row, args.data);
      audit('update', args, row);
      return { ...row };
    },
    async delete(args) {
      touch('delete');
      const i = F().db[table].findIndex(r => r[pk] === args.where[pk]);
      if (i < 0) { const e = new Error('Record not found'); e.code = 'P2025'; throw e; }
      const [row] = F().db[table].splice(i, 1);
      audit('delete', args, row);
      return row;
    },
  };
}
// מיון/join של customer: ההזמנות בדמה נושאות customer מוטבע
const order = delegate('order', 'orderId');
// paymentObligation: רק create (applyDeliveryCharge) - נרשם ב-db.paymentObligation
const paymentObligation = { async create(args) { (F().db.paymentObligation ||= []).push({ ...args.data }); return { ...args.data }; } };
const prisma = {
  order,
  paymentObligation,
  get deliveryJoin() { return F().noModel ? undefined : delegate('deliveryJoin', 'orderId'); },
};
export default prisma;
export function auditAs(action, args, changes) { return action ? { ...args, __audit: { action, changes } } : args; }
