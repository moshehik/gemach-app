// PrismaClient for scripts/shared_delivery_reprice.mjs: plain client on SD_DATABASE_URL (no Next, no cookies). auditAs() markers are
// honoured the way app/lib/prisma.js does it: the marker is stripped before the query and one AuditLog row (employee null) is written
// after the write, so the script's changes show in the order history like any other.
import { PrismaClient } from '@prisma/client';

const url = process.env.SD_DATABASE_URL;
if (!url) throw new Error('SD_DATABASE_URL is required');
const raw = new PrismaClient({ datasourceUrl: url });

const WRITES = new Set(['create', 'update', 'delete']);
const entityIdOf = (model, result, args) => String(result?.id ?? result?.orderId ?? args?.where?.id ?? args?.where?.orderId ?? '');

function wrapDelegate(client, model, delegate) {
  return new Proxy(delegate, {
    get(target, method) {
      const fn = target[method];
      if (typeof fn !== 'function') return fn;
      if (!WRITES.has(method)) return fn.bind(target);
      return async (rawArgs) => {
        let args = rawArgs;
        let audit = null;
        if (args && args.__audit) { audit = args.__audit; args = { ...args }; delete args.__audit; }
        const result = await fn.call(target, args);
        if (audit) {
          await client.auditLog.create({
            data: {
              entityType: model.charAt(0).toUpperCase() + model.slice(1),
              entityId: entityIdOf(model, result, args),
              action: audit.action || method.toUpperCase(),
              changesJson: JSON.stringify(audit.changes || {}),
              employeeId: null,
            },
          });
        }
        return result;
      };
    },
  });
}

function wrapClient(client) {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === '$transaction') return (fnOrArr, opts) => (typeof fnOrArr === 'function' ? target.$transaction((tx) => fnOrArr(wrapClient(tx)), opts) : target.$transaction(fnOrArr, opts));
      const v = target[prop];
      if (typeof prop === 'string' && !prop.startsWith('$') && v && typeof v === 'object') return wrapDelegate(target, prop, v);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

const prisma = wrapClient(raw);
export default prisma;
export { prisma };
export function auditAs(action, args, changes) {
  if (!action) return args;
  return { ...args, __audit: { action, changes } };
}
export async function getActingEmployeeId() { return null; }
export function runAsActor(employeeId, fn) { return fn(); }
export async function disconnect() { await raw.$disconnect(); }
