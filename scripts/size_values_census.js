#!/usr/bin/env node
/**
 * size_values_census.js - READ-ONLY census of the size values stored in the DB (נושא 12, 12.10.2026).
 *
 * Why: the "בדיקת מלאי" size menu used to offer every distinct DressItem.sizeText, so Neve Yaakov's menu was full of
 * decimals ("06.1", "00.5", "01.8"), lettered sizes ("36א") and padded/spaced spellings (" 36", "8" next to "08").
 * The menu now offers whole sizes only (lib/sizeSort.js pickSizeMenu); the DATA is untouched. This script shows what is
 * stored, and which raw values a (hypothetical) cleanup would rewrite - it never writes anything.
 *
 * Safety: this file has NO write path at all. Every query is a SELECT inside "BEGIN READ ONLY". It refuses to run unless
 * you name the host you expect (--expect-host), so it can't be pointed at the wrong org by mistake.
 *
 * Usage:
 *   node scripts/size_values_census.js --env .env --var PROD_DATABASE_URL --expect-host ep-weathered-tree      # main gemach
 *   node scripts/size_values_census.js --env scratch/new_gemach_db.env --var PROD_DATABASE_URL --expect-host ep-young-math   # Neve Yaakov
 *   add --json for machine-readable output
 *
 * Output: for DressItem (active + all) and OrderItem - distinct count and rows per class (whole / padded-or-spaced whole /
 * zero-fraction "38.0" / true decimal / digits+letters / range / latin / other / blank), the exceptional values with counts, and a
 * "would normalize" list (raw -> whole size) = exactly the rows a cleanup script would touch if the owner ever wants one.
 * Needs `pg` (already a dependency). Retries on Neon cold start.
 */
'use strict';

const fs = require('fs');
const { Client } = require('pg');

const args = process.argv.slice(2);
const opt = (name, def = null) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const asJson = args.includes('--json');
const envFile = opt('--env', '.env');
const varName = opt('--var', 'DATABASE_URL');
const expectHost = opt('--expect-host');

function readVar(file, name) {
  if (process.env[name] && !opt('--env')) return process.env[name];
  const txt = fs.readFileSync(file, 'utf8');
  for (const raw of txt.split(/\r?\n/)) {
    const m = raw.trim().match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

// Same rule as lib/sizeSort.js normalizeSizeKey (kept inline: this CLI is CommonJS, the lib is ESM).
function normalizeSizeKey(raw) {
  const t = String(raw == null ? '' : raw).trim();
  if (!t) return 'כללי';
  if (/^\d{1,3}$/.test(t)) return String(parseInt(t, 10));
  const z = /^(\d{1,3})[.,]0+$/.exec(t);
  if (z) return String(parseInt(z[1], 10));
  const d = /^(\d{1,3})[.,](\d+)$/.exec(t); // "06.1" == "6.1" (spelling only, no rounding)
  if (d) return `${parseInt(d[1], 10)}.${d[2]}`;
  return t;
}

function classify(v) {
  if (v == null) return 'blank';
  if (v === '') return 'blank';
  if (/^\d{1,3}$/.test(v)) return 'whole';
  if (/^\s*\d{1,3}\s*$/.test(v)) return 'whole-with-spaces';
  if (/^\s*\d{1,3}[.,]0+\s*$/.test(v)) return 'zero-fraction';
  if (/^\s*\d+[.,]\d+\s*$/.test(v)) return 'DECIMAL';
  if (/^\s*\d+\s*[-/]\s*\d+\s*$/.test(v)) return 'range';
  if (/^\s*\d+\s*\S+\s*$/.test(v)) return 'digits+text';
  if (/^[A-Za-z]+$/.test(v.trim())) return 'latin';
  return 'other';
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

  const sets = {
    'DressItem (active: not deleted, in use)': 'SELECT "sizeText" v, count(*)::int n FROM "DressItem" WHERE "isDeleted" = false AND "notInUse" = false GROUP BY 1',
    'DressItem (all not deleted)': 'SELECT "sizeText" v, count(*)::int n FROM "DressItem" WHERE "isDeleted" = false GROUP BY 1',
    'OrderItem (all not deleted)': 'SELECT "sizeText" v, count(*)::int n FROM "OrderItem" WHERE "isDeleted" = false GROUP BY 1',
  };
  const report = { host, sets: {} };
  for (const [name, sql] of Object.entries(sets)) {
    const rows = (await client.query(sql)).rows;
    const classes = {};
    const wouldNormalize = [];
    for (const r of rows) {
      const k = classify(r.v);
      const c = (classes[k] = classes[k] || { distinct: 0, rows: 0, values: [] });
      c.distinct++; c.rows += r.n;
      if (k !== 'whole') c.values.push({ value: r.v, rows: r.n });
      const key = normalizeSizeKey(r.v);
      if (/^\d{1,3}$/.test(key) && r.v !== key && (k === 'zero-fraction' || k === 'whole-with-spaces')) wouldNormalize.push({ from: r.v, to: key, rows: r.n });
    }
    report.sets[name] = { distinct: rows.length, rows: rows.reduce((a, r) => a + r.n, 0), classes, wouldNormalize: wouldNormalize.sort((a, b) => b.rows - a.rows) };
  }
  await client.query('ROLLBACK');
  await client.end();

  if (asJson) { console.log(JSON.stringify(report, null, 2)); return; }
  console.log(`Host: ${host}  (READ ONLY - nothing was written)`);
  for (const [name, s] of Object.entries(report.sets)) {
    console.log(`\n== ${name}: ${s.distinct} distinct values, ${s.rows} rows`);
    for (const [k, c] of Object.entries(s.classes)) {
      console.log(`  ${k.padEnd(18)} distinct ${String(c.distinct).padStart(3)}  rows ${String(c.rows).padStart(6)}`);
      if (c.values.length) console.log('      ' + c.values.map((v) => `${JSON.stringify(v.value)}:${v.rows}`).join('  '));
    }
    if (s.wouldNormalize.length) console.log('  would normalize to a whole size (NOT executed): ' + s.wouldNormalize.map((w) => `${JSON.stringify(w.from)}->${w.to} (${w.rows})`).join('  '));
  }
})().catch((e) => { console.error(e); process.exit(1); });
