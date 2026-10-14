// דיווח 13888b96 (הגמח הראשי, בקשת רחלי 5.10.2026: "להוריד מכל העובדות התראות למייל"): מכבה את Employee.receiveEmailAlerts ("קבלת התראות
// מערכת למייל") לכל העובדים בגמח הראשי. זה שינוי נתונים בהרבה שורות - לכן סקריפט עם dry-run, לא קוד.
//
// מה זה משפיע (נבדק בקוד): receiveEmailAlerts נקרא רק ב-POST /api/notifications (app/api/notifications/route.js) - שליחת מייל "הודעה פנימית"
// למי שסימן את התיבה. אין אף מייל מערכת אחר שתלוי בו (איפוס סיסמה, דוחות יומיים, מיילים ללקוחות, התראות למנהלים - כולם לא תלויים בשדה).
//
// הגמח הראשי בלבד (org 1): הסקריפט מסרב לרוץ על org אחר ועל host שאינו של הגמח הראשי.
// dry-run כברירת מחדל (רק SELECT, מדפיס את רשימת העובדים שיושפעו וספירות לפני/אחרי); כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה.
// כתיבה מסקריפט עצמאי לא נרשמת ביומן (הרחבת ה-AuditLog פועלת רק בתוך Next) - לכן הסקריפט מדפיס את הרשימה לפני ואחרי; אין כתיבה ידנית ל-AuditLog.
//   node scripts/seed_clear_employee_email_alerts.js --org=1          (dry-run)
//   node scripts/seed_clear_employee_email_alerts.js --org=1 --write
'use strict';

const { parseOrgArg } = require('./lib/db-env');
const { connectOrg } = require('./lib/seed-bool-setting');

const ORG1_HOST_PREFIX = 'ep-weathered-tree-avpypjjr'; // הגמח הראשי (docs/fix-protocol-error-reports.md סעיף 1)

async function counts(prisma) {
  const [total, active, alertsOn, alertsOnActive] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { receiveEmailAlerts: true } }),
    prisma.employee.count({ where: { receiveEmailAlerts: true, isActive: true } }),
  ]);
  return { total, active, alertsOn, alertsOnActive };
}

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  if (org !== 1) throw new Error('SAFETY ABORT: this script is for org 1 (the main gemach) only');
  const { prisma, host } = connectOrg(org, write);
  try {
    if (!host.startsWith(ORG1_HOST_PREFIX)) throw new Error(`SAFETY ABORT: org1 host "${host}" is not the main gemach host (${ORG1_HOST_PREFIX}...)`);

    const before = await counts(prisma);
    console.log(`BEFORE: employees total ${before.total}, active ${before.active}; receiveEmailAlerts ON: ${before.alertsOn} (active: ${before.alertsOnActive})`);
    const affected = await prisma.employee.findMany({
      where: { receiveEmailAlerts: true },
      select: { id: true, firstName: true, lastName: true, isActive: true, roleId: true, email: true },
      orderBy: { id: 'asc' },
    });
    for (const e of affected) {
      console.log(`  - ${e.id.slice(0, 8)} ${`${e.firstName || ''} ${e.lastName || ''}`.trim()} | active=${e.isActive} roleId=${e.roleId} hasEmail=${!!e.email} | receiveEmailAlerts true -> false`);
    }
    if (!affected.length) { console.log('Nothing to do: no employee has receiveEmailAlerts on.'); return; }
    if (!write) { console.log(`dry-run - would turn it off for ${affected.length} employee(s); pass --write to apply`); return; }

    for (const e of affected) {
      await prisma.employee.update({ where: { id: e.id }, data: { receiveEmailAlerts: false } });
    }
    const after = await counts(prisma);
    console.log(`AFTER: employees total ${after.total}, active ${after.active}; receiveEmailAlerts ON: ${after.alertsOn} (active: ${after.alertsOnActive}) - expected 0`);
    if (after.alertsOn !== 0) { console.log('WARNING: some rows are still on (someone turned it on again meanwhile?)'); process.exitCode = 1; }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
