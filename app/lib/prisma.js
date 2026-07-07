import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prismaClientSingleton = () => {
  const baseClient = new PrismaClient();
  
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
              const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
              employeeId = decoded.id || decoded.employeeId || null;
            }
          } catch (e) {
            // Error when called outside request context
          }
          
          if (['create', 'update', 'delete'].includes(operation)) {
             const result = await query(args);
             if (!result) return result;
             
             const entityId = result.id || result.orderId || 0;
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
                   employeeId: employeeId ? parseInt(employeeId) : null,
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
const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
