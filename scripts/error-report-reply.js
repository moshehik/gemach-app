#!/usr/bin/env node
/**
 * מפרסם תגובה בשרשור דיווח תקלה (ErrorReportReply) בתור "תמיכה" (isProgrammer: true) -
 * הכלי שקלוד משתמש בו ב-.claude/commands/fix-reports.md כדי לדווח על כל שלב
 * (ראיתי/מטפל -> שאלות אם צריך -> סיכום) ישירות בשרשור הדיווח באתר. עובד גם על
 * שרשור "יומן הסוכן" הקבוע (ר' scripts/agent-log-report.js) - זה עדיין ErrorReport רגיל.
 *
 * Usage:
 *   node scripts/error-report-reply.js <reportId> "<טקסט>" [--status=ARCHIVED] [--org=2] [--preview-url=<url>] [--question] [--sketch=<file.html>]
 *
 * status אופציונלי: OPEN|ARCHIVED. הוסיפו --status=ARCHIVED רק כשהתיקון אומת בפועל -
 * אחרת השאירו את הדיווח פתוח כדי שמשה יסגור בעצמו אחרי שהוא מאשר (ר' fix-reports.md).
 * --org=2 כותב לדיווח בגמח "נווה יעקב" (ברירת מחדל: 1, הגמח הראשי) - ר' scripts/lib/db-env.js.
 * --preview-url=<url> - קישור Preview Deployment זמני (ר' scripts/get-preview-deployment-url.js),
 * מוצג בלקוח כפתור מעוצב ולא כטקסט/URL גולמי בתוך text - ר' fix-reports.md לכללי מתי מותר לצרף.
 * --sketch=<file.html> - מצרף סקיצת HTML עצמאית (בלי JS/משאבים חיצוניים, עד 300KB) לתגובה. מסמן
 *   אוטומטית isQuestion=true ו-sketchStatus=PENDING - המדווח/ת רואה כפתור "צפה בסקיצה" + אשר/דחה.
 *   רק אחרי APPROVED מותר לפתוח ענף (ר' fix-reports.md, "סקיצה לפני ענף").
 * --question - סמנו את התגובה הזו כ"שאלה פתוחה" (isQuestion=true), רק כשהתגובה בפועל
 * מחכה לתשובה מהמדווח/ת כדי להמשיך (למשל: "איזה ערך אתם רוצים?"). בלי הדגל הזה התגובה
 * נחשבת "תגובה סתם" (עדכון סטטוס/סיכום/"ראיתי, בודק") - גם אם היא מנוסחת כמשפט שאלה
 * רטורי. הדגל הזה קובע את הגוון החזותי "ממתין לתשובה" ברשימת הדיווחים ב-UI (ר'
 * ErrorReportButton.js), ואת ההבחנה בפרוטוקול (fix-protocol-error-reports.md סעיף 2) -
 * לא לנחש לפי ניסוח, לסמן במפורש.
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const statusArg = rest.find((a) => a.startsWith('--status='));
  const previewUrlArg = rest.find((a) => a.startsWith('--preview-url='));
  const isQuestion = rest.includes('--question');
  const positional = rest.filter((a) => !a.startsWith('--'));
  const [reportId, text] = positional;
  const status = statusArg ? statusArg.slice('--status='.length) : null;
  const sketchArg = rest.find((a) => a.startsWith('--sketch='));
  let sketchHtml = null;
  if (sketchArg) {
    const file = sketchArg.slice('--sketch='.length);
    const fs = require('fs');
    if (!fs.existsSync(file)) { console.error(`--sketch file not found: ${file}`); process.exit(1); }
    sketchHtml = fs.readFileSync(file, 'utf8');
    const forCheck = sketchHtml.replace(/xmlns(:\w+)?="http:\/\/www\.w3\.org\/[^"]*"/g, '');
    if (Buffer.byteLength(sketchHtml) > 300 * 1024) { console.error('--sketch file too large (max 300KB)'); process.exit(1); }
    if (/<script|<iframe|<object|<embed|https?:\/\//i.test(forCheck)) {
      console.error('--sketch must be self-contained: no <script>/<iframe>/<object>/<embed> and no external http(s) URLs');
      process.exit(1);
    }
  }
  const previewUrl = previewUrlArg ? previewUrlArg.slice('--preview-url='.length) : null;

  if (!reportId || !text) {
    console.error('Usage: node scripts/error-report-reply.js <reportId> "<text>" [--status=ARCHIVED] [--org=2] [--preview-url=<url>] [--question] [--sketch=<file.html>]');
    process.exit(1);
  }
  if (status && !['OPEN', 'ARCHIVED'].includes(status)) {
    console.error('--status must be OPEN or ARCHIVED');
    process.exit(1);
  }
  if (previewUrl && !/^https:\/\//.test(previewUrl)) {
    console.error('--preview-url must be an https:// URL');
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasourceUrl: resolveDbUrl(org) });
  try {
    const existing = await prisma.errorReport.findUnique({ where: { id: reportId } });
    if (!existing) {
      console.error(`ERROR: report ${reportId} not found`);
      process.exit(1);
    }
    // מגן קשיח נגד race condition: מדווח/ת שלוחצ/ת "אוף! אני צריך מענה אנושי!"
    // (needsHuman=true, ר' ErrorReportButton.js) תוך כדי שהרצת הסוכן כבר רצה -
    // fix-reports.md מנחה לדלג לגמרי על דיווח כזה, אבל אותה הנחיה נקראת פעם אחת
    // בתחילת ההרצה (שלב 0) ולא מתעדכנת תוך כדי. הבדיקה כאן קוראת את המצב הכי
    // עדכני *ממש לפני* הכתיבה בפועל, אז גם אם ה-flag עלה אחרי שההרצה כבר התחילה -
    // הפרסום נחסם.
    if (existing.needsHuman) {
      console.error(`SKIPPED: report ${reportId} has needsHuman=true (reporter asked for a human reply) - refusing to post an automated reply`);
      process.exit(1);
    }

    const reply = await prisma.errorReportReply.create({
      data: { errorReportId: reportId, isProgrammer: true, text, previewUrl: previewUrl || null, isQuestion: isQuestion || !!sketchHtml, ...(sketchHtml ? { sketchHtml, sketchStatus: 'PENDING' } : {}) },
    });

    const updateData = { isReadByUser: false, isReadByProgrammer: true, updatedAt: new Date() };
    if (status) updateData.status = status;
    await prisma.errorReport.update({ where: { id: reportId }, data: updateData });

    console.log(`OK: reply ${reply.id} posted to report ${reportId}${status ? ` (status -> ${status})` : ''}${isQuestion || sketchHtml ? ' [question - awaiting reporter]' : ''}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
