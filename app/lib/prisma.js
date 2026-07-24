import { PrismaClient as CloudClient } from '@prisma/client';

let PrismaClient = CloudClient;
if (process.env.IS_OFFLINE_MODE === 'true') {
  try {
    const local = require(/* webpackIgnore: true */ '@prisma/local-client');
    if (local && local.PrismaClient) PrismaClient = local.PrismaClient;
  } catch (e) {
    console.warn("Could not load local prisma client");
  }
}
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const createPrismaClient = (url) => {
  const baseClient = (url && process.env.IS_OFFLINE_MODE !== 'true') 
    ? new PrismaClient({ datasources: { db: { url } } }) 
    : new PrismaClient();
  
  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model === 'AuditLog' || model === 'PageVisitLog' || model === 'Shift') {
            return query(args);
          }
          
          let employeeId = null;
          try {
            const cookieStore = await cookies();
            const token = cookieStore.get('auth_token')?.value;
            if (token) {
              if (token.includes('.')) {
                try {
                  const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                  employeeId = decoded.id || decoded.employeeId || null;
                } catch (e) {}
              } else {
                employeeId = token;
              }
            }
          } catch (e) {}
          
          if (['create', 'update', 'delete'].includes(operation)) {
             const result = await query(args);
             if (!result) return result;
             
             const entityId = String(result.id || result.orderId || "");
             let changesJson = '{}';
             if (operation === 'update') {
               changesJson = JSON.stringify(args.data || {});
             } else if (operation === 'create') {
               changesJson = JSON.stringify(result || {});
             } else if (operation === 'delete') {
               changesJson = JSON.stringify({ deleted: true });
             }
             
             try {
               await baseClient.auditLog.create({
                 data: {
                   entityType: model,
                   entityId: entityId,
                   action: operation.toUpperCase(),
                   changesJson: changesJson,
                   employeeId: employeeId || null,
                 }
               });
             } catch (err) {
               console.error("Audit log error:", err);
             }
             return result;
          }
          
          return query(args);
        }
      }
    }
  });
};

const globalForPrisma = globalThis;

if (!globalForPrisma.prismaProd) {
  globalForPrisma.prismaProd = createPrismaClient(process.env.PROD_DATABASE_URL || process.env.DATABASE_URL);
}
if (!globalForPrisma.prismaTest && process.env.TEST_DATABASE_URL) {
  globalForPrisma.prismaTest = createPrismaClient(process.env.TEST_DATABASE_URL);
}

if (!globalForPrisma.activeDbMode) {
  let initialMode = 'prod';
  try {
    const dbFile = path.join(process.cwd(), '.active-db');
    if (fs.existsSync(dbFile)) {
      initialMode = fs.readFileSync(dbFile, 'utf8').trim();
    }
  } catch(e) {}
  globalForPrisma.activeDbMode = initialMode;
}

const prismaProxy = new Proxy({}, {
  get(target, prop) {
    const isTest = globalForPrisma.activeDbMode === 'test' && globalForPrisma.prismaTest;
    const activeClient = isTest ? globalForPrisma.prismaTest : globalForPrisma.prismaProd;
    
    const value = activeClient[prop];
    if (typeof value === 'function') {
      return value.bind(activeClient);
    }
    return value;
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaProxy;
}

export default prismaProxy;
