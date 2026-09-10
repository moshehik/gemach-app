#!/usr/bin/env node
/**
 * רשימת דיווחי תקלות (ErrorReport) עם כל שרשור התגובות שלהם - הכלי הראשון שקלוד מריץ
 * בכל סבב של .claude/commands/fix-reports.md (פורט של הפקודה המקבילה ב-print-center,
 * ר' docs). ברירת מחדל: רק status=OPEN. `ALL` מציג גם ARCHIVED.
 *
 * Usage:
 *   node scripts/read-error-reports.js               # רק OPEN, גמח 1 (ראשי)
 *   node scripts/read-error-reports.js ALL            # גם ARCHIVED
 *   node scripts/read-error-reports.js --org=2         # גמח 2 (נווה יעקב)
 *   node scripts/read-error-reports.js --org=2 ALL
 *
 * פלט: JSON למערך דיווחים ל-stdout, כדי שיהיה קל לקלוד לפרסר. כל דיווח כולל
 * employee (שם המדווח), ואת replies המלא (isProgrammer מסמן תגובת "תמיכה").
 *
 * טעינת env/בחירת DB: ר' scripts/lib/db-env.js (--org בוחר בין 2 ה-DB-ים הנפרדים).
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const all = rest.includes('ALL');
  const prisma = new PrismaClient({ datasourceUrl: resolveDbUrl(org) });
  try {
    const reports = await prisma.errorReport.findMany({
      where: all ? {} : { status: 'OPEN' },
      orderBy: { updatedAt: 'asc' },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { employee: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    const shaped = reports.map((r) => ({
      id: r.id,
      status: r.status,
      isHandled: r.isHandled,
      reporter: r.employee ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim() : 'לא ידוע',
      time: r.time,
      url: r.url,
      title: r.title,
      queryParams: r.queryParams,
      lastButtons: r.lastButtons ? (() => { try { return JSON.parse(r.lastButtons); } catch { return r.lastButtons; } })() : [],
      userText: r.userText,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      replies: r.replies.map((rep) => ({
        id: rep.id,
        isProgrammer: rep.isProgrammer,
        author: rep.employee ? `${rep.employee.firstName || ''} ${rep.employee.lastName || ''}`.trim() : (rep.isProgrammer ? 'תמיכה' : 'משתמש'),
        text: rep.text,
        isQuestion: rep.isQuestion,
        createdAt: rep.createdAt,
      })),
    }));

    console.log(JSON.stringify(shaped, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
