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
 * Usage:
 *   node scripts/agent-loop-status.js [--org=2]                  # true/false, exit code תואם
 *   node scripts/agent-loop-status.js [--org=2] --disable         # מכבה את הדגל
 *
 * טעינת env/בחירת DB: ר' scripts/lib/db-env.js (--org בוחר בין 2 ה-DB-ים הנפרדים -
 * ברירת מחדל 1 = הגמח הראשי, זהה לדפוס הקודם).
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const SETTING_KEY = 'agent_fix_loop_enabled';

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const disable = rest.includes('--disable');

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
