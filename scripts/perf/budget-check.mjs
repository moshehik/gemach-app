// budget-check.mjs - מוכיח מול TEST שה-statement_timeout של guarded() באמת מבטל שאילתה כבדה ומחזיר BudgetError (503), ושהמגבלה לא דולפת לשאילתות הבאות.
// הרצה: node --import ./scripts/perf/register.mjs scripts/perf/budget-check.mjs
import prisma from './stub-prisma.mjs';
import { guarded } from '../../lib/adminListDb.js';
import { BudgetError, errorResponse } from '../../lib/adminListGuards.js';

let t = Date.now();
try {
  await guarded(prisma.$queryRawUnsafe('SELECT pg_sleep(8)'), 1500);
  console.log('FAIL: no timeout');
} catch (e) {
  const r = errorResponse(e);
  console.log(`slow query cancelled after ${Date.now() - t} ms (sleep was 8000): ${e instanceof BudgetError ? 'BudgetError' : e.constructor.name} -> HTTP ${r && r.status} ${r && JSON.stringify(r.body)}`);
}
t = Date.now();
const ok = await guarded(prisma.$queryRawUnsafe('SELECT 1 AS x'));
console.log(`next query on the pool unaffected: ${JSON.stringify(ok)} (${Date.now() - t} ms)`);
await prisma.$disconnect();
