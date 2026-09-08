#!/usr/bin/env node
/**
 * קורא/מכבה/מודד-שקט את דגל "סוכן תיקון אוטומטי" (SystemSetting key=agent_fix_loop_enabled,
 * ותאריך-פעילות אחרון ב-agent_fix_loop_last_activity) - אותו דגל שהאייקון ב-
 * app/components/ErrorReportButton.js קובע דרך PATCH /api/agent/fix-loop (שם גם
 * מתעדכן agent_fix_loop_last_activity בכל הפעלה מהאייקון). משמש ל-3 מקומות:
 *   1. .github/workflows/claude-fix-reports.yml - "שלב 0" הזול, בודק לכל גמח (--org)
 *      אם בכלל צריך להפעיל את קלוד. פלט: "true"/"false" בשורה אחת (וגם exit code).
 *   2. .claude/commands/fix-reports.md - קלוד עצמו מריץ:
 *      - `--disable` כשמזהה הוראת-עצירה בתוך דיווח, או אחרי 20 דק' שקט (ר' --idle-minutes).
 *      - `--touch` בכל פעם שבאמת טיפל במשהו (מאפס את שעון ה"שקט").
 *      - `--idle-minutes` כדי לבדוק כמה זמן עבר מאז הפעילות האחרונה (למעבר למצב שינה).
 *
 * Usage:
 *   node scripts/agent-loop-status.js [--org=2]                  # true/false, exit code תואם
 *   node scripts/agent-loop-status.js [--org=2] --disable         # מכבה את הדגל
 *   node scripts/agent-loop-status.js [--org=2] --touch           # מאפס שעון שקט ל"עכשיו"
 *   node scripts/agent-loop-status.js [--org=2] --idle-minutes    # מדפיס מספר דקות שקט (או -1 אם לא ידוע)
 *
 * טעינת env/בחירת DB: ר' scripts/lib/db-env.js (--org בוחר בין 2 ה-DB-ים הנפרדים -
 * ברירת מחדל 1 = הגמח הראשי, זהה לדפוס הקודם).
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const SETTING_KEY = 'agent_fix_loop_enabled';
const ACTIVITY_KEY = 'agent_fix_loop_last_activity';

async function touchActivity(prisma) {
  await prisma.systemSetting.upsert({
    where: { key: ACTIVITY_KEY },
    update: { value: new Date().toISOString() },
    create: {
      key: ACTIVITY_KEY,
      value: new Date().toISOString(),
      name: 'זמן פעילות אחרונה של הסוכן האוטומטי',
      category: 'מערכת',
      type: 'text',
    },
  });
}

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const disable = rest.includes('--disable');
  const touch = rest.includes('--touch');
  const idleMinutes = rest.includes('--idle-minutes');

  const prisma = new PrismaClient({ datasourceUrl: resolveDbUrl(org) });
  try {
    if (disable) {
      await prisma.systemSetting.upsert({
        where: { key: SETTING_KEY },
        update: { value: 'false' },
        create: {
          key: SETTING_KEY,
          value: 'false',
          name: 'סוכן תיקון דיווחים אוטומטי (GitHub Actions)',
          category: 'מערכת',
          type: 'boolean',
        },
      });
      console.log('false');
      process.exit(1);
    }

    if (touch) {
      await touchActivity(prisma);
      console.log('touched');
      process.exit(0);
    }

    if (idleMinutes) {
      const row = await prisma.systemSetting.findUnique({ where: { key: ACTIVITY_KEY } });
      if (!row?.value) {
        console.log('-1'); // אין תיעוד פעילות בכלל - לא לגזור "שקט" מזה
        process.exit(0);
      }
      const minutes = Math.floor((Date.now() - new Date(row.value).getTime()) / 60000);
      console.log(String(minutes));
      process.exit(0);
    }

    const row = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    const enabled = row?.value === 'true';
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
