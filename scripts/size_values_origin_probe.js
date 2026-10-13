#!/usr/bin/env node
/**
 * size_values_origin_probe.js - READ-ONLY follow-up to size_values_access_audit.js (נושא 12, 12.10.2026).
 * Answers "where do the irregular sizes come from and are they connected to anything?" with counts only:
 *   1. Were irregular DressItem sizes ever edited in the app (AuditLog entries that touch sizeText on those rows)?
 *   2. Barcode collisions: non-deleted DressItems sharing one dressBarcode (barcode = prefix + 2-digit size + 2-digit serial;
 *      it carries NO decimal / letter, so a decimal item always shares its barcode with the whole-size item).
 *   3. How the exits of dress models are distributed by date (one mass-exit day?).
 *   4. DressItem rows with no legacyId (= created in the app, not imported from Access) among the irregular ones.
 * Safety: SELECT only, inside BEGIN READ ONLY, refuses to run without --expect-host. No customer / order identifiers printed.
 *
 * Usage: node scripts/size_values_origin_probe.js --env scratch/new_gemach_db.env --var PROD_DATABASE_URL --expect-host ep-young-math
 */
'use strict';
const fs = require('fs');
const { Client } = require('pg');
const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const envFile = opt('--env', '.env'), varName = opt('--var', 'DATABASE_URL'), expectHost = opt('--expect-host');
function readVar(file, name) {
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.trim().match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}
// irregular = anything that is not a plain 1-3 digit number without spaces and without a leading zero issue
const IRREGULAR = `("sizeText" ~ '[.,]' OR "sizeText" ~ '[^0-9]' )`;

(async () => {
  const url = readVar(envFile, varName);
  if (!url) { console.error(`No ${varName} in ${envFile}`); process.exit(2); }
  const host = new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname;
  if (!expectHost) { console.error(`Refusing to run without --expect-host. The URL points at: ${host}`); process.exit(2); }
  if (!host.includes(expectHost)) { console.error(`Host mismatch: expected "${expectHost}" in "${host}". Aborting.`); process.exit(2); }
  let client = null;
  for (let i = 0; i < 12 && !client; i++) {
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });
    try { await c.connect(); client = c; } catch (e) { console.error(`connect retry ${i + 1}: ${e.code || e.message}`); await new Promise((r) => setTimeout(r, 8000)); }
  }
  if (!client) process.exit(1);
  await client.query('BEGIN READ ONLY');
  const q = async (sql, params) => (await client.query(sql, params)).rows;
  console.log(`Host: ${host}  (READ ONLY)`);

  const irr = await q(`SELECT id, "legacyId", "dressBarcode" bc, "sizeText" sz FROM "DressItem" WHERE "isDeleted" = false AND ${IRREGULAR}`);
  console.log(`\n1) irregular DressItems (non-whole sizeText): ${irr.length}; without legacyId (created in the app): ${irr.filter((r) => r.legacyId == null).length}`);

  const ids = irr.map((r) => r.id);
  const audit = ids.length ? await q(`SELECT action, count(*)::int n, count(*) FILTER (WHERE "changesJson" LIKE '%sizeText%')::int touching_size FROM "AuditLog" WHERE "entityType" = 'DressItem' AND "entityId" = ANY($1) GROUP BY 1`, [ids]) : [];
  console.log('   AuditLog entries on those rows (by action; touching_size = mentions sizeText):', JSON.stringify(audit));

  const dup = await q(`SELECT "dressBarcode" bc, count(*)::int n, array_agg("sizeText" ORDER BY "sizeText") sizes
                       FROM "DressItem" WHERE "isDeleted" = false AND "dressBarcode" IS NOT NULL GROUP BY 1 HAVING count(*) > 1`);
  const dupIrr = dup.filter((d) => d.sizes.some((s) => s != null && /[^0-9]/.test(s)));
  console.log(`\n2) barcodes shared by 2+ non-deleted items: ${dup.length}; of them involving an irregular size: ${dupIrr.length}`);
  for (const d of dupIrr) console.log(`   ${d.bc}: ${JSON.stringify(d.sizes)}`);
  const dupByPrefix = {};
  for (const d of dup) { const p = String(d.bc).slice(0, 3); dupByPrefix[p] = (dupByPrefix[p] || 0) + 1; }
  console.log('   shared barcodes by model prefix:', JSON.stringify(dupByPrefix));

  const exits = await q(`SELECT to_char("exitDateFromRepo" AT TIME ZONE 'Asia/Jerusalem','YYYY-MM-DD') d, count(*)::int n FROM "DressModel" WHERE "isDeleted" = false AND "exitDateFromRepo" IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 6`);
  const tot = await q(`SELECT count(*)::int total, count(*) FILTER (WHERE "exitDateFromRepo" IS NOT NULL)::int exited FROM "DressModel" WHERE "isDeleted" = false`);
  console.log(`\n3) models: ${JSON.stringify(tot[0])}; top exit days (Israel date):`, JSON.stringify(exits));

  const irrModels = await q(`SELECT m."name" model, to_char(m."exitDateFromRepo" AT TIME ZONE 'Asia/Jerusalem','YYYY-MM-DD') exit_il, m."inactiveReason" reason, count(*)::int items
                             FROM "DressItem" i JOIN "DressModel" m ON m.id = i."dressModelId"
                             WHERE i."isDeleted" = false AND i."sizeText" ~ '[^0-9]' GROUP BY 1,2,3 ORDER BY 1`);
  console.log('\n4) models that own irregular sizes (exit date in Israel time):');
  for (const r of irrModels) console.log(`   ${r.model}: exit ${r.exit_il} reason ${JSON.stringify(r.reason)} irregular items ${r.items}`);

  await client.query('ROLLBACK');
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
