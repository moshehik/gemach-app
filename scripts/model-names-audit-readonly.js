#!/usr/bin/env node
/**
 * ביקורת שמות דגמים - קריאה בלבד (נושא 11, "ניהול דגמים", 12.10.2026).
 * סופר כמה דגמים (DressModel) ושורות הזמנה/פריט נושאים שם ריק / "ללא שם..." / שם = מספר הדגם / "דגם <קוד>" / שם תיאורי אמיתי.
 * לא כותב כלום: כל השאילתות SELECT בתוך טרנזקציה READ ONLY. מדפיס רק ספירות (ועד 8 דוגמאות שם דגם - נתוני קטלוג, לא מידע אישי).
 *
 * שימוש:  node scripts/model-names-audit-readonly.js --org=1|2          (ה-DB מ-scripts/lib/db-env.js: PROD_DATABASE_URL / _ORG2)
 *         DB_URL=<connection string> node scripts/model-names-audit-readonly.js --label=TEST   (DB מפורש, למשל TEST)
 */
'use strict';
const { Client } = require('pg');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const PLACEHOLDER = 'ללא שם';

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const label = (rest.find((a) => a.startsWith('--label=')) || '').slice(8) || `org${org}`;
  const url = process.env.DB_URL || resolveDbUrl(org);
  const host = new URL(url).host;
  const client = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(host) ? false : { rejectUnauthorized: false } });
  let lastErr;
  for (let i = 0; i < 12; i++) {
    try { await client.connect(); lastErr = null; break; } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 10000)); }
  }
  if (lastErr) throw lastErr;
  const out = { label, host: host.replace(/^([^.]{0,12}).*$/, '$1...') };
  try {
    await client.query('BEGIN READ ONLY');
    const gm = await client.query(`SELECT value FROM "SystemSetting" WHERE key IN ('gmach_name')`);
    out.gmach_name = gm.rows[0] ? gm.rows[0].value : null;
    const sets = await client.query(`SELECT key, value FROM "SystemSetting" WHERE key IN ('useModelNames','hide_dress_images','barcode_length','barcodePrefixLength','kiosk_model_search')`);
    out.settings = Object.fromEntries(sets.rows.map((r) => [r.key, r.value]));

    const cls = (alias) => `CASE
      WHEN ${alias}.name IS NULL OR btrim(${alias}.name) = '' THEN 'empty'
      WHEN btrim(${alias}.name) LIKE '${PLACEHOLDER}%' THEN 'placeholder'
      WHEN ${alias}."barcodePrefix" IS NOT NULL AND btrim(${alias}.name) = ${alias}."barcodePrefix"::text THEN 'equals_code'
      WHEN ${alias}."barcodePrefix" IS NOT NULL AND btrim(${alias}.name) = 'דגם ' || ${alias}."barcodePrefix"::text THEN 'auto_dgam_code'
      WHEN btrim(${alias}.name) ~ '^[0-9]+$' THEN 'numeric_other'
      ELSE 'descriptive' END`;
    const models = await client.query(`SELECT "isDeleted", ${cls('m')} AS cls, count(*)::int AS n FROM "DressModel" m GROUP BY 1,2 ORDER BY 1,2`);
    out.dressModel = models.rows;
    const ex = await client.query(`SELECT cls, string_agg(name, ' | ') AS sample FROM (
        SELECT ${cls('m')} AS cls, m.name, row_number() OVER (PARTITION BY ${cls('m')} ORDER BY m."updatedAt" DESC) rn FROM "DressModel" m WHERE m."isDeleted" = false) t
        WHERE rn <= 8 AND cls IN ('placeholder','numeric_other','auto_dgam_code','descriptive') GROUP BY cls`);
    out.samples = ex.rows;
    // שמות כפולים/שמות שמתחילים ב"ללא שם" - רק ספירה
    const items = await client.query(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE "dressName" IS NOT NULL AND btrim("dressName") LIKE '${PLACEHOLDER}%')::int AS dressname_placeholder,
        count(*) FILTER (WHERE "dressModelId" IS NULL)::int AS no_model FROM "DressItem" WHERE "isDeleted" = false`);
    out.dressItem = items.rows[0];
    const oi = await client.query(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE description LIKE '${PLACEHOLDER}%')::int AS desc_starts_placeholder,
        count(*) FILTER (WHERE description LIKE '%${PLACEHOLDER}%')::int AS desc_contains_placeholder,
        count(*) FILTER (WHERE description IS NULL OR btrim(description) = '')::int AS desc_empty,
        count(*) FILTER (WHERE "dressItemId" IS NULL)::int AS no_dress_item FROM "OrderItem" WHERE "isDeleted" = false`);
    out.orderItem = oi.rows[0];
    const oiS = await client.query(`SELECT description AS d, count(*)::int AS n FROM "OrderItem" WHERE "isDeleted" = false AND description LIKE '%${PLACEHOLDER}%' GROUP BY 1 ORDER BY 2 DESC LIMIT 6`);
    out.orderItemPlaceholderSamples = oiS.rows;
    const oiFmt = await client.query(`SELECT
        count(*) FILTER (WHERE description ~ '\(קוד: ?[0-9]+\)')::int AS desc_has_code_paren,
        count(*) FILTER (WHERE description ~ '^[0-9]+$')::int AS desc_digits_only FROM "OrderItem" WHERE "isDeleted" = false`);
    out.orderItemFormats = oiFmt.rows[0];
    // התראות / הודעות שמכילות "ללא שם" (טקסט שנשמר) - מניחים טבלאות אפשריות רק אם קיימות
    const tbl = await client.query(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('message','body','title','text') AND table_name IN ('Notification','InternalMessage','EmailLog','InventoryAlert') GROUP BY 1`);
    out.textTables = tbl.rows.map((r) => r.table_name);
    await client.query('ROLLBACK');
  } finally { await client.end(); }
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
