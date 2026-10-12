#!/usr/bin/env node
/**
 * size_values_access_audit.js - READ-ONLY audit of "irregular" size values (decimals "06.1", lettered "36א",
 * padded/spaced " 36") in DressItem.sizeText and OrderItem.sizeText, with ACTIVITY numbers (נושא 12, 12.10.2026).
 *
 * Question it answers: "are the irregular sizes on active models / items that are actually rented, or on dead stock?"
 * Active here is measured four ways: item not deleted + not notInUse; its MODEL has no exitDateFromRepo (= "פעיל" in the
 * model card, lib/dressCardLogic.js); order lines on non-deleted orders in the last 12 months; order lines on future events.
 *
 * Safety: NO write path. Every query is a SELECT inside "BEGIN READ ONLY". Refuses to run without --expect-host.
 * Counts and barcodes only - no customer / order identifiers are printed (barcodes and sizes are not personal data).
 *
 * Usage:
 *   node scripts/size_values_access_audit.js --env scratch/new_gemach_db.env --var PROD_DATABASE_URL --expect-host ep-young-math   # Neve Yaakov
 *   node scripts/size_values_access_audit.js --env .env --var PROD_DATABASE_URL --expect-host ep-weathered-tree                    # main gemach
 *   add --json for machine-readable output, --items to also list every irregular DressItem (barcode, size, flags).
 * Needs `pg` (already a dependency). Retries on Neon cold start.
 */
'use strict';

const fs = require('fs');
const { Client } = require('pg');

const args = process.argv.slice(2);
const opt = (name, def = null) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const asJson = args.includes('--json');
const listItems = args.includes('--items');
const envFile = opt('--env', '.env');
const varName = opt('--var', 'DATABASE_URL');
const expectHost = opt('--expect-host');

function readVar(file, name) {
  const txt = fs.readFileSync(file, 'utf8');
  for (const raw of txt.split(/\r?\n/)) {
    const m = raw.trim().match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

// Irregular = not a plain 1-3 digit whole number written without spaces.
//   padded-or-spaced whole : "08", " 36", "36 "         (same size, different spelling)
//   zero-fraction          : "38.0"
//   DECIMAL                : "06.1", "00.5", "1.8"      (a different, intentional-looking size code in the old system)
//   LETTERED               : "36א", "  40א"            (digits + Hebrew letter suffix)
//   other                  : anything else
function classify(v) {
  if (v == null || String(v).trim() === '') return 'blank';
  if (/^\d{1,3}$/.test(v)) return v.length > 1 && v.startsWith('0') ? 'padded-whole' : 'whole';
  if (/^\s*\d{1,3}\s*$/.test(v)) return 'spaced-whole';
  if (/^\s*\d{1,3}[.,]0+\s*$/.test(v)) return 'zero-fraction';
  if (/^\s*\d+[.,]\d+\s*$/.test(v)) return 'DECIMAL';
  if (/^\s*\d+\s*[א-ת]+\s*$/.test(v)) return 'LETTERED';
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

  // 1) DressItem: every row not deleted, with model info
  const items = (await client.query(`
    SELECT i."legacyId", i."dressBarcode" bc, i."barcodePrefix" pre, i."sizeText" sz, i."serialNumber" ser,
           i."notInUse", i."inRepair", i."location" loc, m."name" model, m."exitDateFromRepo" mexit, m."isDeleted" mdel, m."inactiveReason" mreason
    FROM "DressItem" i LEFT JOIN "DressModel" m ON m.id = i."dressModelId"
    WHERE i."isDeleted" = false`)).rows;

  // 2) OrderItem: group by (prefix, sizeText) with activity, only non-deleted lines on non-deleted orders
  const lines = (await client.query(`
    SELECT oi."barcodePrefix" pre, oi."sizeText" sz,
           count(*)::int n,
           count(*) FILTER (WHERE o."eventDate" >= now() - interval '12 months')::int last12,
           count(*) FILTER (WHERE o."eventDate" >= now())::int future,
           min(o."eventDate") first_event, max(o."eventDate") last_event
    FROM "OrderItem" oi JOIN "Order" o ON o."orderId" = oi."orderId"
    WHERE oi."isDeleted" = false AND o."isDeleted" = false
    GROUP BY 1, 2`)).rows;

  // 3) per-model total activity (all sizes) in the last 12 months, for the models that own irregular values
  const modelAct = (await client.query(`
    SELECT oi."barcodePrefix" pre, count(*)::int n,
           count(*) FILTER (WHERE o."eventDate" >= now() - interval '12 months')::int last12,
           count(*) FILTER (WHERE o."eventDate" >= now())::int future,
           max(o."eventDate") last_event
    FROM "OrderItem" oi JOIN "Order" o ON o."orderId" = oi."orderId"
    WHERE oi."isDeleted" = false AND o."isDeleted" = false AND oi."barcodePrefix" IS NOT NULL
    GROUP BY 1`)).rows;
  await client.query('ROLLBACK');
  await client.end();

  const modelActByPre = new Map(modelAct.map((r) => [r.pre, r]));
  const irregularClasses = new Set(['spaced-whole', 'zero-fraction', 'DECIMAL', 'LETTERED', 'other', 'padded-whole']);
  const report = { host, generatedAt: new Date().toISOString(), classes: {}, items: [] };

  for (const it of items) {
    const k = classify(it.sz);
    if (!irregularClasses.has(k)) continue;
    const modelActive = !it.mexit && !it.mdel;
    const usable = !it.notInUse; // "active item" per the census/stock check also ignores inRepair=false? we report it separately
    const c = (report.classes[k] = report.classes[k] || { items: 0, itemsUsable: 0, itemsUsableOnActiveModel: 0, itemsOnExitedModel: 0, values: {}, models: {} });
    c.items++; if (usable) c.itemsUsable++; if (usable && modelActive) c.itemsUsableOnActiveModel++; if (!modelActive) c.itemsOnExitedModel++;
    const v = (c.values[it.sz] = c.values[it.sz] || { items: 0, usable: 0, usableOnActiveModel: 0 });
    v.items++; if (usable) v.usable++; if (usable && modelActive) v.usableOnActiveModel++;
    const m = (c.models[it.model || String(it.pre)] = c.models[it.model || String(it.pre)] || { exit: it.mexit ? it.mexit.toISOString().slice(0, 10) : null, deleted: !!it.mdel, reason: it.mreason || null, items: 0 });
    m.items++;
    if (listItems) report.items.push({ cls: k, model: it.model, barcode: it.bc, size: it.sz, serial: it.ser, notInUse: it.notInUse, inRepair: it.inRepair, location: it.loc, modelExit: it.mexit ? it.mexit.toISOString().slice(0, 10) : null });
  }

  // order-line activity by irregular value
  report.orderLines = {};
  for (const r of lines) {
    const k = classify(r.sz);
    if (!irregularClasses.has(k)) continue;
    const o = (report.orderLines[k] = report.orderLines[k] || { lines: 0, last12: 0, future: 0, lastEvent: null, values: {} });
    o.lines += r.n; o.last12 += r.last12; o.future += r.future;
    const le = r.last_event ? r.last_event.toISOString().slice(0, 10) : null;
    if (le && (!o.lastEvent || le > o.lastEvent)) o.lastEvent = le;
    const key = `${r.pre}|${r.sz}`;
    o.values[key] = { lines: r.n, last12: r.last12, future: r.future, firstEvent: r.first_event ? r.first_event.toISOString().slice(0, 10) : null, lastEvent: le };
  }
  report.modelActivity = {};
  const prefixes = new Set();
  for (const k of Object.keys(report.classes)) for (const mName of Object.keys(report.classes[k].models)) prefixes.add(mName);
  for (const p of prefixes) { const a = modelActByPre.get(Number(p)); if (a) report.modelActivity[p] = { lines: a.n, last12: a.last12, future: a.future, lastEvent: a.last_event ? a.last_event.toISOString().slice(0, 10) : null }; }

  if (asJson) { console.log(JSON.stringify(report, null, 2)); return; }
  console.log(`Host: ${host}  (READ ONLY - nothing was written)`);
  for (const [k, c] of Object.entries(report.classes)) {
    console.log(`\n== DressItem class ${k}: ${c.items} items | not-notInUse ${c.itemsUsable} | not-notInUse AND model not exited ${c.itemsUsableOnActiveModel} | on exited/deleted model ${c.itemsOnExitedModel}`);
    console.log('   values: ' + Object.entries(c.values).map(([v, x]) => `${JSON.stringify(v)}:${x.items}(${x.usableOnActiveModel})`).join('  '));
    console.log('   models: ' + Object.entries(c.models).map(([n, m]) => `${n}[${m.exit ? 'exit ' + m.exit : 'ACTIVE'}${m.deleted ? ',deleted' : ''}]:${m.items}`).join('  '));
  }
  for (const [k, o] of Object.entries(report.orderLines)) {
    console.log(`\n== OrderItem class ${k}: ${o.lines} lines | last 12m ${o.last12} | future events ${o.future} | last event ${o.lastEvent}`);
  }
  console.log('\n== model activity (all sizes, non-deleted lines):');
  for (const [p, a] of Object.entries(report.modelActivity)) console.log(`   ${p}: lines ${a.lines}, last12m ${a.last12}, future ${a.future}, last event ${a.lastEvent}`);
  if (listItems) { console.log('\n== items'); for (const i of report.items) console.log(JSON.stringify(i)); }
})().catch((e) => { console.error(e); process.exit(1); });
