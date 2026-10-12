#!/usr/bin/env node
/**
 * irregular_sizes_fix_proposal.js - DRY-RUN ONLY proposal for the irregular DressItem.sizeText values (נושא 12, 12.10.2026).
 *
 * Owner's rule (12.10.2026): "לא לעגל". So this script NEVER proposes rounding a decimal size ("06.1" -> "06"/"6") and never
 * deletes anything. It only proposes the two lossless-in-meaning clean-ups, and only if the owner approves them:
 *   - SPACED   " 36", "  36"     -> "36"   (a leading space typed in Access; same size, same barcode)
 *   - LETTERED "36א", "  40א"    -> "36", "40"  (Access's own numeric field `מידה` holds the clean number for these rows;
 *                                   the letter is an extra tag - the barcode serial already tells the dresses apart)
 * Decimals ("00.5", "01.2", "06.1"...) are listed as KEEP: they are real, separate size codes of the old system, 14 of the 20
 * decimal rows share their barcode with the whole-size dress, and rounding would merge them into the whole size.
 *
 * THIS FILE HAS NO WRITE PATH. It runs SELECTs inside BEGIN READ ONLY and (optionally) writes a review JSON and a SQL file to
 * --out. The SQL file is meant to be reviewed by a human and applied only after the owner says yes. Caveats for whoever applies it:
 *   * raw SQL bypasses the Prisma audit extension -> no AuditLog row is written for the change (the SQL header says so);
 *   * every UPDATE is guarded by `id = ... AND "sizeText" = <old value>` so a row edited in the meantime is skipped;
 *   * OrderItem.sizeText history (150 lines with a leading space, 175 with decimals) is intentionally NOT touched.
 * Refuses to run without --expect-host. Not run as part of this audit (the audit used size_values_access_audit.js).
 *
 * Usage: node scripts/irregular_sizes_fix_proposal.js --env scratch/new_gemach_db.env --var PROD_DATABASE_URL --expect-host ep-young-math [--out <dir>]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const envFile = opt('--env', '.env'), varName = opt('--var', 'DATABASE_URL'), expectHost = opt('--expect-host'), outDir = opt('--out');

function readVar(file, name) {
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.trim().match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

/** Returns { kind, proposed } for a stored sizeText, or null when the value is already a plain whole number. */
function propose(v) {
  if (v == null) return null;
  if (/^\d{1,3}$/.test(v)) return null; // plain (padded or not) whole size: out of scope here, see normalizeSizeKey
  if (/^\s*\d{1,3}\s*$/.test(v)) return { kind: 'SPACED', proposed: v.trim() };
  const lettered = /^\s*(\d{1,3})\s*[א-ת]+\s*$/.exec(v);
  if (lettered) return { kind: 'LETTERED', proposed: lettered[1] };
  if (/^\s*\d+[.,]\d+\s*$/.test(v)) return { kind: 'DECIMAL-KEEP', proposed: null }; // never rounded
  return { kind: 'OTHER-KEEP', proposed: null };
}

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
  const rows = (await client.query(`
    SELECT i.id, i."dressBarcode" barcode, i."sizeText" size, i."serialNumber" serial, i."notInUse", m."name" model,
           to_char(m."exitDateFromRepo" AT TIME ZONE 'Asia/Jerusalem','YYYY-MM-DD') model_exit
    FROM "DressItem" i LEFT JOIN "DressModel" m ON m.id = i."dressModelId"
    WHERE i."isDeleted" = false AND i."sizeText" !~ '^[0-9]{1,3}$'
    ORDER BY m."name", i."dressBarcode", i."sizeText"`)).rows;
  await client.query('ROLLBACK');
  await client.end();

  const plan = [];
  for (const r of rows) {
    const p = propose(r.size);
    if (!p) continue;
    // a proposal that would make two rows of one model identical in (barcode,size) is fine (barcode+serial already differ), but flag shared barcodes
    plan.push({ id: r.id, model: r.model, modelExit: r.model_exit, barcode: r.barcode, serial: r.serial, current: r.size, proposed: p.proposed, kind: p.kind, notInUse: r.notInUse });
  }
  const summary = {};
  for (const x of plan) summary[x.kind] = (summary[x.kind] || 0) + 1;
  console.log(`Host: ${host}  (READ ONLY - nothing was written)`);
  console.log('Proposal summary:', JSON.stringify(summary));
  for (const x of plan) console.log(`${x.kind.padEnd(13)} model ${x.model} (exit ${x.modelExit || 'ACTIVE'}) barcode ${x.barcode} ${JSON.stringify(x.current)} -> ${x.proposed == null ? 'KEEP' : JSON.stringify(x.proposed)}`);

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'irregular_sizes_proposal.json'), JSON.stringify({ host, generatedAt: new Date().toISOString(), summary, plan }, null, 2));
    const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
    const sql = [
      `-- PROPOSAL ONLY - generated ${new Date().toISOString()} for host ${host}. NOT applied. Needs the owner's approval first.`,
      '-- Raw SQL: no AuditLog row will be written (the Prisma audit extension is bypassed). Each UPDATE is guarded by the old value.',
      'BEGIN;',
      ...plan.filter((x) => x.proposed != null).map((x) => `UPDATE "DressItem" SET "sizeText" = ${q(x.proposed)}, "updatedAt" = now() WHERE id = ${q(x.id)} AND "sizeText" = ${q(x.current)}; -- model ${x.model} barcode ${x.barcode}`),
      '-- check the row counts above, then COMMIT; (or ROLLBACK;)',
    ].join('\n');
    fs.writeFileSync(path.join(outDir, 'irregular_sizes_proposal.sql'), sql + '\n');
    console.log(`Wrote review files to ${outDir}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
