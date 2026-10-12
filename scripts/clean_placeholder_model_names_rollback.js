#!/usr/bin/env node
/**
 * שחזור של scripts/clean_placeholder_model_names.js מקובץ הגיבוי שלו (--backup-file). הפוך מדויק: כל שורה חוזרת לערך "לפני" רק אם היא עדיין מחזיקה את ערך "אחרי"
 * (compare-and-swap) - שורה ששונתה מאז לא נוגעים בה ומדווחים. dry-run כברירת מחדל; כתיבה רק עם --apply, בטרנזקציה אחת.
 *
 *   node scripts/clean_placeholder_model_names_rollback.js <backup.json> --confirm-host <ep-xxxx> --org=2 --i-know-this-is-prod            # dry-run
 *   node scripts/clean_placeholder_model_names_rollback.js <backup.json> --confirm-host <ep-xxxx> --org=2 --i-know-this-is-prod --apply
 *
 * אותה בדיקת host כמו בסקריפט הניקוי (checkHost מ-scripts/set-ui-variant.js: --confirm-host חובה, ייצור דורש --i-know-this-is-prod). לא נוגע ב-OrderItem / AuditLog.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { checkHost, collectKnownDbs, describeDbTarget } = require('./set-ui-variant.js');
const { parseOrgArg, resolveDbUrl, loadEnvFiles } = require('./lib/db-env');

const TABLES = [
  { key: 'models', table: 'DressModel', col: 'name', touch: ', "updatedAt" = now()' },
  { key: 'items', table: 'DressItem', col: '"dressName"', touch: '' },
  { key: 'obligations', table: 'PaymentObligation', col: 'description', touch: '' },
];

function parseArgs(argv) {
  const { org, rest } = parseOrgArg(argv);
  const opts = { org, file: null, apply: false, prod: false, confirmHost: null };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--apply') opts.apply = true;
    else if (a === '--i-know-this-is-prod') opts.prod = true;
    else if (a === '--confirm-host') opts.confirmHost = rest[++i];
    else if (a.startsWith('--confirm-host=')) opts.confirmHost = a.slice('--confirm-host='.length);
    else if (!a.startsWith('--') && !opts.file) opts.file = a;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!opts.file) throw new Error('usage: clean_placeholder_model_names_rollback.js <backup.json> --confirm-host <ep-xxxx> --org=1|2 [--i-know-this-is-prod] [--apply]');
  if (!opts.confirmHost) throw new Error('--confirm-host <full DB host or ep-xxxx endpoint id> is required');
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const backup = JSON.parse(fs.readFileSync(path.resolve(opts.file), 'utf8'));
  if (!backup || backup.version !== 1) throw new Error('not a clean_placeholder_model_names backup file (version 1)');
  loadEnvFiles();
  const url = resolveDbUrl(opts.org);
  const target = describeDbTarget(url);
  const check = checkHost(target.host, opts.confirmHost, collectKnownDbs(), { allowProd: opts.prod, notProd: false });
  if (!check.ok) throw new Error(check.reason);
  console.log(`DB: ${target.host} / ${target.database} (${check.prod ? 'PRODUCTION' : check.label || 'non-prod'}) | mode: ${opts.apply ? 'APPLY' : 'DRY RUN'} | backup from ${backup.at}`);
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('BEGIN');
    let restored = 0; let conflicts = 0; let already = 0;
    for (const t of TABLES) {
      for (const r of backup[t.key] || []) {
        const cur = (await client.query(`SELECT ${t.col} AS v FROM "${t.table}" WHERE id = $1`, [r.id])).rows[0];
        if (cur && cur.v === r.to) {
          if (opts.apply) {
            const res = await client.query(`UPDATE "${t.table}" SET ${t.col} = $1${t.touch} WHERE id = $2 AND ${t.col} IS NOT DISTINCT FROM $3`, [r.from, r.id, r.to]);
            restored += res.rowCount;
          } else restored++;
        } else if (cur && cur.v === r.from) already++;
        else { conflicts++; console.log(`  CONFLICT ${t.table} ${r.id}: now ${JSON.stringify(cur ? cur.v : null)} (expected ${JSON.stringify(r.to)}) - not touched`); }
      }
    }
    if (opts.apply) await client.query('COMMIT'); else await client.query('ROLLBACK');
    console.log(`${opts.apply ? 'RESTORED' : 'WOULD RESTORE'} ${restored}, already restored ${already}, conflicts ${conflicts}`);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* closed */ }
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
