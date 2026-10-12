#!/usr/bin/env node
/**
 * יוצר את שורת ההגדרה branch_transfer_horizon_days (טווח התראת ההעברה בין סניפים, בימים קדימה) כדי שתופיע במסך ההגדרות
 * (סעיף "לו״ז - התראת העברה בין סניפים"). רק יוצר שורה חסרה, לעולם לא דורס. ערך ברירת המחדל 14 = בדיוק מה שהקוד עושה בלי שורה,
 * ולכן בשני הגמ"חים הערך זהה והתנהגות לא משתנה (גם כך הכל מאחורי multi_branch_enabled שכבוי).
 * הרצה: node scripts/seed_branch_horizon_setting.js --org=1|2            # dry-run
 *       node scripts/seed_branch_horizon_setting.js --org=2 --write --expect-host=<קידומת ה-host>
 * כללי CLAUDE.md: host נבדק לפני כתיבה; org 1 = PROD_DATABASE_URL, org 2 = scratch/new_gemach_db.env / PROD_DATABASE_URL_ORG2.
 * לא הורץ על פרודקשן - רק אחרי אישור.
 */
'use strict';
const { Client } = require('pg');
const { resolveDbUrl, parseOrgArg } = require('./lib/db-env');

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  const eh = rest.find((a) => a.startsWith('--expect-host='));
  const expectHost = eh ? eh.slice('--expect-host='.length) : null;
  const url = resolveDbUrl(org);
  if (!url) throw new Error('לא נמצא connection string');
  const host = new URL(url).host;
  console.log(`org ${org} host=${host}`);
  if (write && (!expectHost || !host.startsWith(expectHost))) throw new Error('--expect-host חובה ותואם ל-host');
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    const ex = await c.query(`select value from "SystemSetting" where key='branch_transfer_horizon_days'`);
    if (ex.rowCount) { console.log(`השורה כבר קיימת (ערך: ${ex.rows[0].value})`); return; }
    console.log(`${write ? 'יוצר' : '[dry-run] היה יוצר'}: branch_transfer_horizon_days = 14`);
    if (write) {
      await c.query(
        `insert into "SystemSetting" (id, key, value, name, category, type, "updatedAt") values (gen_random_uuid()::text, 'branch_transfer_horizon_days', '14', 'התראת העברה בין סניפים - טווח ימים קדימה', 'סניפים', 'number', now())`,
      );
      console.log('נוצר');
    }
  } finally {
    await c.end();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
