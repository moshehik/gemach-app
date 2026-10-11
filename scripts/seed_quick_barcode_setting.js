#!/usr/bin/env node
/**
 * scripts/seed_quick_barcode_setting.js
 * ============================================================================
 * יוצר את שורת ההגדרה quick_search_barcode_opens_rental (קטגוריה "ברקודים", boolean) בערך 'false' - כדי שהמתג יופיע במסך
 * ההגדרות. הקוד מתייחס לשורה חסרה כ"כבוי" (lib/barcodeFlow.js), לכן אין חובה להריץ את זה כדי שהפיצ'ר יתנהג נכון -
 * זה רק כדי לראות/להפעיל אותו ב-/admin/settings. לא דורס ערך קיים (אם השורה קיימת - לא נוגע בה).
 *
 * USAGE:
 *   node scripts/seed_quick_barcode_setting.js --org=1                          # dry-run (ברירת מחדל): רק מדפיס
 *   node scripts/seed_quick_barcode_setting.js --org=1 --write --expect-host=ep-xxxx
 *   node scripts/seed_quick_barcode_setting.js --org=2 --write --expect-host=ep-yyyy
 * ההגדרה זהה בשני הגמחים (כבוי) - עקרון "אותם מפתחות, ערכים לפי הצורך" (CLAUDE.md, Settings & the two orgs).
 * --write דורש --expect-host (תחילית ה-host של ה-DB המיועד) ומסרב אם ה-host אחר. לא מדפיס connection string.
 */
'use strict';

const { Client } = require('pg');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const KEY = 'quick_search_barcode_opens_rental';
const ROW = { key: KEY, value: 'false', name: 'הקשת ברקוד בחיפוש המהיר פותחת השכרה מהירה', category: 'ברקודים', type: 'boolean' };

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
    const existing = await client.query('SELECT "key", "value", "category" FROM "SystemSetting" WHERE "key" = $1', [KEY]);
    if (existing.rows.length) {
      console.log('already exists:', JSON.stringify(existing.rows[0]), '- nothing to do');
      return;
    }
    console.log('would create:', JSON.stringify(ROW));
    if (!write) return;
    await client.query(
      'INSERT INTO "SystemSetting" ("id", "key", "value", "name", "category", "type", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, now())',
      [ROW.key, ROW.value, ROW.name, ROW.category, ROW.type]
    );
    console.log('created');
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
