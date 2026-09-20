// READ-ONLY prisma facade over the real client: reads pass through; any write is recorded and swallowed.
import { createRequire } from 'node:module';
const req = createRequire(process.env.PROJ + '/package.json');
const { PrismaClient } = req('@prisma/client');
const real = new PrismaClient({ datasourceUrl: process.env.EXPERIMENT_DB_URL });
globalThis.__BLOCKED_WRITES = [];
const READS = new Set(['findMany', 'findUnique', 'findFirst', 'count', 'groupBy', 'aggregate', 'findUniqueOrThrow', 'findFirstOrThrow']);
const modelProxy = (name) => new Proxy({}, {
  get(_, method) {
    if (READS.has(method)) return (...a) => real[name][method](...a);
    return async (...a) => { globalThis.__BLOCKED_WRITES.push(`${name}.${String(method)}`); return {}; };
  },
});
const proxy = new Proxy({}, {
  get(_, prop) {
    if (prop === 'then') return undefined;
    if (prop === '$queryRawUnsafe' || prop === '$queryRaw') {
      return async (q, ...rest) => {
        const s = typeof q === 'string' ? q : (q?.strings?.join('?') || '');
        (globalThis.__SQLS ||= []).push(s);
        if (!/^\s*(SELECT|WITH)\b/i.test(s)) throw new Error('BLOCKED non-SELECT raw query in experiment harness');
        return real[prop](q, ...rest);
      };
    }
    if (typeof prop === 'string' && prop.startsWith('$')) {
      return async () => { throw new Error('BLOCKED ' + prop + ' in experiment harness'); };
    }
    return modelProxy(prop);
  },
});
export default proxy;
export const prisma = proxy;
