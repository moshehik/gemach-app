#!/usr/bin/env node
/**
 * מוצא (או יוצר אם אין) את שרשור "יומן הסוכן האוטומטי" - ErrorReport קבוע לכל גמח,
 * נפרד מדיווחי התקלות הרגילים, ששם /fix-reports מתכתב עם משה על העבודה עצמה
 * (סיכומי הרצה, שאלות כלליות שלא קשורות לדיווח ספציפי) - לא רק בתגובות בתוך כל
 * דיווח בודד. עדיין ErrorReport/ErrorReportReply רגילים בסכימה (בלי migration) -
 * מזוהה לפי כותרת קבועה (LOG_TITLE), לא לפי שדה ייעודי.
 *
 * Usage:
 *   node scripts/agent-log-report.js [--org=2]
 * פלט: ה-id של השרשור (שורה יחידה), לשימוש עם error-report-reply.js/read-error-reports.js.
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const LOG_TITLE = '🤖 יומן הסוכן האוטומטי (נא לא למחוק)';
const LOG_INTRO = [
  'זהו שרשור קבוע - כאן הסוכן האוטומטי (/fix-reports) מדווח לך על העבודה שלו',
  'ברמת-על (מה טופל בסבב האחרון, כמה דיווחים פתוחים, מתי נכנס למצב שינה וכו\'),',
  'בנפרד מהתגובות שהוא כותב בתוך כל דיווח-תקלה בודד.',
  '',
  'אפשר לכתוב כאן שאלות/הוראות כלליות לסוכן (למשל "תעדכן אותי כל פעם ש...") -',
  'הוא קורא את השרשור הזה בכל הרצה וממשיך את השיחה.',
].join('\n');

async function main() {
  const { org } = parseOrgArg(process.argv.slice(2));
  const prisma = new PrismaClient({ datasourceUrl: resolveDbUrl(org) });
  try {
    let report = await prisma.errorReport.findFirst({ where: { title: LOG_TITLE } });
    if (!report) {
      report = await prisma.errorReport.create({
        data: {
          title: LOG_TITLE,
          userText: LOG_INTRO,
          status: 'OPEN',
          isReadByUser: true,
          isReadByProgrammer: true,
        },
      });
    }
    console.log(report.id);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
