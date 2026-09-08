#!/usr/bin/env node
/**
 * מפרסם תגובה בשרשור דיווח תקלה (ErrorReportReply) בתור "תמיכה" (isProgrammer: true) -
 * הכלי שקלוד משתמש בו ב-.claude/commands/fix-reports.md כדי לדווח על כל שלב
 * (ראיתי/מטפל -> שאלות אם צריך -> סיכום) ישירות בשרשור הדיווח באתר. עובד גם על
 * שרשור "יומן הסוכן" הקבוע (ר' scripts/agent-log-report.js) - זה עדיין ErrorReport רגיל.
 *
 * Usage:
 *   node scripts/error-report-reply.js <reportId> "<טקסט>" [--status=ARCHIVED] [--org=2]
 *
 * status אופציונלי: OPEN|ARCHIVED. הוסיפו --status=ARCHIVED רק כשהתיקון אומת בפועל -
 * אחרת השאירו את הדיווח פתוח כדי שמשה יסגור בעצמו אחרי שהוא מאשר (ר' fix-reports.md).
 * --org=2 כותב לדיווח בגמח "נווה יעקב" (ברירת מחדל: 1, הגמח הראשי) - ר' scripts/lib/db-env.js.
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const statusArg = rest.find((a) => a.startsWith('--status='));
  const positional = rest.filter((a) => !a.startsWith('--'));
  const [reportId, text] = positional;
  const status = statusArg ? statusArg.slice('--status='.length) : null;

  if (!reportId || !text) {
    console.error('Usage: node scripts/error-report-reply.js <reportId> "<text>" [--status=ARCHIVED] [--org=2]');
    process.exit(1);
  }
  if (status && !['OPEN', 'ARCHIVED'].includes(status)) {
    console.error('--status must be OPEN or ARCHIVED');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasourceUrl: resolveDbUrl(org) });
  try {
    const existing = await prisma.errorReport.findUnique({ where: { id: reportId } });
    if (!existing) {
      console.error(`ERROR: report ${reportId} not found`);
      process.exit(1);
    }

    const reply = await prisma.errorReportReply.create({
      data: { errorReportId: reportId, isProgrammer: true, text },
    });

    const updateData = { isReadByUser: false, isReadByProgrammer: true, updatedAt: new Date() };
    if (status) updateData.status = status;
    await prisma.errorReport.update({ where: { id: reportId }, data: updateData });

    console.log(`OK: reply ${reply.id} posted to report ${reportId}${status ? ` (status -> ${status})` : ''}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
