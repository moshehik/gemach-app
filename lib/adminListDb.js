// lib/adminListDb.js - הרצת שאילתות רשימות הניהול עם תקציב: כל שאילתה בטרנזקציית-מערך עם SET LOCAL statement_timeout (Postgres מבטל אותה בעצמו
// ולא משאיר עבודה רצה ב-Neon), ומגבלת מקביליות לאינסטנס. הלוגיקה הטהורה (קבועים / שגיאות / limiter) ב-lib/adminListGuards.js.
// טרנזקציית מערך ($transaction([...])) ולא אינטראקטיבית: לא תופסת חיבור בזמן חישוב ב-JS, ומאפשרת להריץ כמה ספירות במקביל (כל אחת בחיבור משלה).
import prisma from '@/app/lib/prisma';
import { BudgetError, MAX_CONCURRENT, STATEMENT_TIMEOUT_MS, createLimiter, isStatementTimeout, statementTimeoutSql, MSG_NARROWER } from '@/lib/adminListGuards';

const limiter = createLimiter(MAX_CONCURRENT);

/** מריץ בקשה כבדה (כל מה שבתוך fn) תחת מגבלת המקביליות. */
export const runLimited = (fn) => limiter.run(fn);

/** op = PrismaPromise עצל (prisma.x.findMany(...) / count(...) / $queryRawUnsafe(...)) - מורץ אחרי SET LOCAL statement_timeout באותה טרנזקציה. */
export async function guarded(op, ms = STATEMENT_TIMEOUT_MS) {
  try {
    const res = await prisma.$transaction([prisma.$executeRawUnsafe(statementTimeoutSql(ms)), op]);
    return res[1];
  } catch (e) {
    if (isStatementTimeout(e)) throw new BudgetError('timeout', MSG_NARROWER);
    throw e;
  }
}
