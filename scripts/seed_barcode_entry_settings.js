#!/usr/bin/env node
/**
 * scripts/seed_barcode_entry_settings.js
 * ============================================================================
 * יוצר את שתי שורות ההגדרה של ברקוד בלו״ז (docs/schedule-barcode-plan.md ב'.1), קטגוריה "ברקודים", בערך 'off' (= ההתנהגות של היום):
 *   barcode_entry_when_delivery      מתי מזינים ברקוד בהזמנות עם משלוח הלוך: off | prep | pickup
 *   barcode_entry_when_local_pickup  מתי מזינים ברקוד באיסוף מקומי:           off | prep | pickup
 * הקוד מתייחס לשורה חסרה כ-'off', לכן אין חובה להריץ את זה כדי שהמערכת תתנהג נכון - זה רק כדי שההגדרות יופיעו ב-/admin/settings.
 * לא דורס ערך קיים. אותם מפתחות בשני הגמ"חים (נוהל "אותם מפתחות, ערכים לפי הצורך" - CLAUDE.md, Settings & the two orgs); הערך 'off' בשניהם
 * עד שנווה יענה על שאלות הברקוד (C:\Users\moshe\Desktop\גמח שמלות חדש\שאלות-נווה-ברקוד-2026-10-12.md).
 *
 * USAGE:
 *   node scripts/seed_barcode_entry_settings.js --org=1                          # dry-run (ברירת מחדל): רק מדפיס
 *   node scripts/seed_barcode_entry_settings.js --org=1 --write --expect-host=ep-xxxx
 *   node scripts/seed_barcode_entry_settings.js --org=2 --write --expect-host=ep-yyyy
 * --write דורש --expect-host (תחילית ה-host של ה-DB המיועד) ומסרב אם ה-host אחר. לא מדפיס connection string.
 * **לא הורץ על אף DB** (שלב 2 של העבודה בוצע מול DB בזיכרון בלבד).
 */
'use strict';

const { Client } = require('pg');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const ROWS = [
  { key: 'barcode_entry_when_delivery', value: 'off', name: 'הזנת ברקוד בלו״ז – משלוחים', category: 'ברקודים', type: 'select' },
  { key: 'barcode_entry_when_local_pickup', value: 'off', name: 'הזנת ברקוד בלו״ז – איסוף מקומי', category: 'ברקודים', type: 'select' },
];

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  const expect = (rest.find((a) => a.startsWith('--expect-host=')) || '').slice('--expect-host='.length);
  const url = resolveDbUrl(org);
  const host = new URL(url).hostname;
  console.log(`org ${org}, host ${host}, ${write ? 'WRITE' : 'dry-run'}`);
  if (write && (!expect || !host.startsWith(expect))) {
    throw new Error(`refusing to write: host ${host} does not start with --expect-host=${expect || '(missing)'}`);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const row of ROWS) {
      const existing = await client.query('SELECT "key", "value", "category" FROM "SystemSetting" WHERE "key" = $1', [row.key]);
      if (existing.rows.length) {
        console.log('already exists:', JSON.stringify(existing.rows[0]), '- nothing to do');
        continue;
      }
      console.log('would create:', JSON.stringify(row));
      if (!write) continue;
      await client.query(
        'INSERT INTO "SystemSetting" ("id", "key", "value", "name", "category", "type", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, now())',
        [row.key, row.value, row.name, row.category, row.type],
      );
      console.log('created', row.key);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
