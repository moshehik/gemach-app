// @prisma/client מדומה לבדיקות item-actors.routes.test.mjs: מחלקת PrismaClient שמריצה את התוסף האמיתי של app/lib/prisma.js ($extends → query.$allModels.$allOperations)
// מעל מסד בזיכרון (scripts/schedule-tests/shims/prisma.mjs). כך שורות היומן (AuditLog) נכתבות בדיוק כמו בייצור: create / update / delete דרך התוסף עם employeeId
// מהעוגייה (globalThis.__AUTH_TOKEN), ו-updateMany / createMany / upsert בלי התוסף (כמו Prisma האמיתי).
import mem from './actor-mem.mjs';

const cap = (m) => m[0].toUpperCase() + m.slice(1);
export class PrismaClient {
  constructor() { this.auditLog = mem.auditLog; }
  $extends(ext) {
    const all = ext.query.$allModels.$allOperations;
    const model = (name) => new Proxy({}, {
      get(_, op) {
        if (typeof op !== 'string') return undefined;
        return (args) => all({ model: cap(name), operation: op, args, query: (a) => mem[name][op](a) });
      },
    });
    const self = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') return undefined;
        if (prop === '$transaction') return (arg) => (typeof arg === 'function' ? arg(self) : Promise.all(arg));
        if (prop === '$disconnect') return async () => {};
        return model(prop);
      },
    });
    return self;
  }
  async $disconnect() {}
}
