#!/usr/bin/env node
/**
 * קורא/מכבה את דגל "סוכן תיקון אוטומטי" (SystemSetting key=agent_fix_loop_enabled) -
 * אותו דגל שהאייקון ב-app/components/ErrorReportButton.js קובע דרך PATCH
 * /api/agent/fix-loop. משמש ל-2 מקומות:
 *   1. .github/workflows/claude-fix-reports.yml - "שלב 0" הזול, בודק לכל גמח (--org)
 *      אם בכלל צריך להפעיל את קלוד. פלט: "true"/"false" בשורה אחת (וגם exit code).
 *   2. .claude/commands/fix-reports.md - קלוד עצמו מריץ `--disable` רק כשמזהה
 *      הוראת-עצירה מפורשת בתוך דיווח. המתג נשאר דלוק ללא הגבלת זמן אחרת - אין יותר
 *      כיבוי-אוטומטי-משקט (בוטל 2026-09-14, ר' הערה ב-claude-fix-reports.yml).
 *
 * דגל שני, עצמאי (2026-09-23): --flag=deploy קורא/מכבה את agent_fix_loop_deploy_enabled
 * במקום agent_fix_loop_enabled - קובע האם מותר לסוכן לפתוח ענף+PR (=Vercel Preview
 * Deployment אוטומטי) בלי להשפיע על אם הוא רץ בכלל. ברירת המחדל (שורה לא קיימת)
 * שונה בין השניים: enabled חסר = false (כבוי), deploy חסר = true (כדי לשמר התנהגות
 * קודמת) - ר' אותה לוגיקה ב-app/api/agent/fix-loop/route.js. `--disable` לא נתמך
 * עם --flag=deploy (המתג הזה משתנה רק דרך האייקון ב-UI, לא ע"י הסוכן עצמו).
 *
 * Usage:
 *   node scripts/agent-loop-status.js [--org=2]                  # true/false, exit code תואם
 *   node scripts/agent-loop-status.js [--org=2] --disable         # מכבה את הדגל
 *   node scripts/agent-loop-status.js [--org=2] --flag=deploy     # true/false, ברירת מחדל true
 *
 * טעינת env/בחירת DB: ר' scripts/lib/db-env.js (--org בוחר בין 2 ה-DB-ים הנפרדים -
 * ברירת מחדל 1 = הגמח הראשי, זהה לדפוס הקודם).
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const SETTING_KEY = 'agent_fix_loop_enabled';
const DEPLOY_KEY = 'agent_fix_loop_deploy_enabled';

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const disable = rest.includes('--disable');
  const flagArg = rest.find((a) => a.startsWith('--flag='));
  const isDeployFlag = flagArg === '--flag=deploy';
  const key = isDeployFlag ? DEPLOY_KEY : SETTING_KEY;

  const prisma = new PrismaClient({ datasourceUrl: resolveDbUrl(org) });
  try {
    if (disable) {
      if (isDeployFlag) {
        console.error('ERROR: --disable אינו נתמך עם --flag=deploy - הדגל הזה משתנה רק מהאייקון ב-UI');
        process.exit(2);
      }
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: 'false' },
        create: {
          key,
          value: 'false',
          name: 'סוכן תיקון דיווחים אוטומטי (GitHub Actions)',
          category: 'מערכת',
          type: 'boolean',
        },
      });
      console.log('false');
      process.exit(1);
    }

    const row = await prisma.systemSetting.findUnique({ where: { key } });
    // enabled חסר = כבוי (false); deploy חסר = מותר (true) - תואם ל-route.js
    const enabled = isDeployFlag ? row?.value !== 'false' : row?.value === 'true';
    console.log(enabled ? 'true' : 'false');
    process.exit(enabled ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(2);
});
