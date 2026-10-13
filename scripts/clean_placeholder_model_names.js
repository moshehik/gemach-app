#!/usr/bin/env node
/**
 * ניקוי שמות דגמים "ללא שם - N" מהנתונים (נושא 11 "ניהול דגמים", 12.10.2026; בקשת הבעלים: בנווה יעקב אין שמות לדגמים, רק מספר).
 * ההצגה כבר תוקנה בקוד (lib/modelDisplay.js) - הסקריפט רק מסיר את הטקסט מהנתונים, כדי שגם ייצוא / דוחות SQL / סוכן ה-AI לא יראו אותו.
 * ברירת מחדל = DRY RUN: לא נכתב כלום. לא להריץ --apply על ייצור בלי אישור הבעלים.
 *
 *   מה משתנה (לוגיקה ב-lib/modelNameCleanup.js, נבדקת ב-scripts/test_model_name_cleanup.mjs):
 *   (א) DressModel.name שמתחיל ב"ללא שם" (או "אין שם" וכד') -> מספר הדגם (barcodePrefix) כמחרוזת; בלי מספר -> NULL. בגמ"ח בלי שמות (useModelNames=false) גם "דגם <קוד>" -> "<קוד>".
 *       התנגשות (שם יעד שכבר תפוס, כולל דגמים מחוקים) -> מדלגים ומדווחים. updatedAt של הדגם מתעדכן.
 *   (ב) DressItem.dressName (שדה ישן) שמתחיל ב"ללא שם" -> מספר הדגם של הפריט (או NULL).
 *   (ג) [רק עם --include-obligations] PaymentObligation.description עם "ללא שם - N" -> "<מספר הדגם>" (לפי מפת השמות שלפני הניקוי). זה הטקסט שנשלח לסליקה ולקבלות.
 *   לא נוגעים: Payment.notes (תשובת סליקה גולמית), EmailLog.body, AuditLog, ErrorReport - אלה תיעוד היסטורי של מה שקרה.
 *
 * שימוש:
 *   node scripts/clean_placeholder_model_names.js --confirm-host <host מלא | ep-xxxx> [--org=1|2] [--i-know-this-is-prod | --not-prod] [--include-obligations]          # dry-run
 *   node scripts/clean_placeholder_model_names.js --confirm-host <...> [--org=...] [--i-know-this-is-prod] [--include-obligations] --apply                             # כותב (טרנזקציה אחת)
 *
 *   ה-DB: --org=1|2 (scripts/lib/db-env.js: PROD_DATABASE_URL / PROD_DATABASE_URL_ORG2), אחרת DATABASE_URL מהסביבה. הסקריפט מדפיס host / database / gmach_name / useModelNames
 *   ומסרב אם --confirm-host לא תואם בדיוק (אותה בדיקה כמו scripts/set-ui-variant.js: checkHost, סגור-בכישלון - כל DB שלא זוהה כ-TEST הוא ייצור ודורש --i-know-this-is-prod).
 *   נווה יעקב: org 2, host ep-young-math-b1veujp3 (ר' זיכרון neve-neon-new-org-migration). הראשי: ep-weathered-tree-avpypjjr.
 *   אידמפוטנטי: הרצה שנייה = 0 שינויים. כתיבה מבוססת compare-and-swap (השורה חייבת עדיין להחזיק את הערך שנקרא). כתיבה ב-SQL ישיר: לא נוצרות שורות AuditLog (כמו שאר סקריפטי התחזוקה).
 *   הערה: scripts/import_from_access.js תוקן כך שדגם בלי שם באקסס מקבל את מספרו ולא "ללא שם - N"; בלי התיקון ההוא ייבוא חוזר היה מחזיר את הטקסט.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { Client } = require('pg');
const { checkHost, collectKnownDbs, describeDbTarget } = require('./set-ui-variant.js');
const { parseOrgArg, resolveDbUrl, loadEnvFiles } = require('./lib/db-env');

const ROOT = path.join(__dirname, '..');
const BOOLEAN_FLAGS = new Set(['apply', 'dry-run', 'i-know-this-is-prod', 'not-prod', 'include-obligations', 'help']);
const VALUE_FLAGS = new Set(['confirm-host', 'backup-file']);
const USAGE = 'Usage: node scripts/clean_placeholder_model_names.js --confirm-host <full DB host | ep-xxxx> [--org=1|2] [--i-know-this-is-prod | --not-prod] [--include-obligations] [--apply --backup-file=<new file.json>]\nDRY RUN by default (nothing is written without --apply).';

function parseArgs(argv) {
  const { org, rest } = parseOrgArg(argv);
  const opts = { org };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    let name = arg.slice(2);
    let value;
    const eq = name.indexOf('=');
    if (eq !== -1) { value = name.slice(eq + 1); name = name.slice(0, eq); }
    if (BOOLEAN_FLAGS.has(name)) { opts[name] = true; continue; }
    if (!VALUE_FLAGS.has(name)) throw new Error(`Unknown flag: --${name}`);
    if (value === undefined) value = rest[++i];
    if (value === undefined || String(value).startsWith('--')) throw new Error(`Flag --${name} needs a value`);
    opts[name] = value;
  }
  if (opts.help) return opts;
  if (!opts['confirm-host']) throw new Error('--confirm-host <full DB host or ep-xxxx endpoint id> is required');
  if (opts['not-prod'] && opts['i-know-this-is-prod']) throw new Error('--not-prod and --i-know-this-is-prod are mutually exclusive');
  if (opts.apply && opts['dry-run']) throw new Error('--apply and --dry-run are mutually exclusive');
  if (opts.apply && !opts['backup-file']) throw new Error('--apply requires --backup-file=<path of a NEW .json file> (the full before/after list; restore with scripts/clean_placeholder_model_names_rollback.js)');
  return opts;
}

function connectionUrl(opts) {
  loadEnvFiles();
  if (process.env.DATABASE_URL && !process.argv.some((a) => /^--org=/.test(a))) return process.env.DATABASE_URL;
  return resolveDbUrl(opts.org);
}

async function connect(url) {
  const host = new URL(url).hostname;
  const client = new Client({ connectionString: url, ssl: /^(localhost|127\.0\.0\.1)$/.test(host) ? false : { rejectUnauthorized: false } });
  let last;
  for (let i = 0; i < 12; i++) { // Neon (org 2) מתעורר לאט: ניסיונות חוזרים
    try { await client.connect(); return client; } catch (e) { last = e; await new Promise((r) => setTimeout(r, 8000)); }
  }
  throw last;
}

function writeBackup(file, body) {
  const fd = fs.openSync(path.resolve(file), 'wx'); // wx: נכשל אם הקובץ כבר קיים
  try { fs.writeSync(fd, JSON.stringify({ version: 1, ...body }, null, 1)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  console.log(`backup written: ${path.resolve(file)} (${body.models.length} models, ${body.items.length} items, ${body.obligations.length} obligations)`);
}

async function run(client, opts, lib, log = console.log) {
  const { planModelRenames, planItemDressNames, planObligationTexts } = lib;
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  try {
    const setRows = (await client.query(`SELECT key, value FROM "SystemSetting" WHERE key IN ('gmach_name','useModelNames')`)).rows;
    const setting = Object.fromEntries(setRows.map((r) => [r.key, r.value]));
    const useModelNames = String(setting.useModelNames == null ? 'true' : setting.useModelNames).trim().toLowerCase() !== 'false';
    log(`gmach_name: ${setting.gmach_name || '(none)'} | useModelNames: ${useModelNames}`);

    const models = (await client.query(`SELECT id, name, "barcodePrefix", "isDeleted" FROM "DressModel"`)).rows;
    const mp = planModelRenames(models, { useModelNames });
    log(`\n(א) DressModel: ${mp.renames.length} to rename, ${mp.collisions.length} collisions (skipped), ${mp.unchanged} untouched`);
    for (const r of mp.renames.slice(0, 40)) log(`    ${JSON.stringify(r.from)} -> ${r.to === null ? 'NULL' : JSON.stringify(r.to)}  [${r.reason}]`);
    if (mp.renames.length > 40) log(`    ... +${mp.renames.length - 40} more`);
    for (const c of mp.collisions) log(`    COLLISION ${JSON.stringify(c.from)} wanted ${JSON.stringify(c.wanted)} (held by ${c.heldBy}) - skipped`);

    const itemRows = (await client.query(`SELECT i.id, i."dressName", m."barcodePrefix" FROM "DressItem" i LEFT JOIN "DressModel" m ON m.id = i."dressModelId" WHERE i."dressName" IS NOT NULL AND i."dressName" ~* '^\\s*(ללא[\\s_-]*שם|אין[\\s_-]*שם)'`)).rows;
    const ip = planItemDressNames(itemRows);
    log(`(ב) DressItem.dressName: ${ip.length} to update`);

    let op = { updates: [], unresolved: 0 };
    if (opts['include-obligations']) {
      const nameToCode = new Map();
      for (const m of models) if (m.name && /^\s*(ללא[\s_-]*שם|אין[\s_-]*שם)/.test(m.name) && m.barcodePrefix != null) nameToCode.set(m.name, String(m.barcodePrefix));
      const obRows = (await client.query(`SELECT id, description FROM "PaymentObligation" WHERE description ~* '(ללא[\\s_-]*שם|אין[\\s_-]*שם)'`)).rows;
      op = planObligationTexts(obRows, nameToCode);
      log(`(ג) PaymentObligation.description: ${op.updates.length} to update, ${op.unresolved} left as-is (placeholder with no known model number)`);
      for (const u of op.updates.slice(0, 5)) log(`    ${JSON.stringify(u.from.replace(/\(פריט #[^)]*\)/, '(פריט #…)'))} -> ${JSON.stringify(u.to.replace(/\(פריט #[^)]*\)/, '(פריט #…)'))}`);
    } else {
      log('(ג) PaymentObligation.description: not included (add --include-obligations)');
    }
    await client.query('ROLLBACK'); // תכנון בלבד

    const total = mp.renames.length + ip.length + op.updates.length;
    if (!opts.apply) { log(`\nDRY RUN - nothing written. ${total} change(s) would be applied with --apply.`); return { total, applied: 0 }; }
    if (total === 0) { log('\nNothing to do.'); return { total, applied: 0 }; }

    // גיבוי לפני הכתיבה: הרשימה המלאה (id / לפני / אחרי) של כל שורה שתשתנה - קובץ חדש בלבד (לא דורס), נכתב ונסגר לפני ה-UPDATE הראשון. שחזור: clean_placeholder_model_names_rollback.js
    writeBackup(opts['backup-file'], { at: new Date().toISOString(), models: mp.renames.map((r) => ({ id: r.id, from: r.from, to: r.to })), items: ip.map((u) => ({ id: u.id, from: u.from, to: u.to })), obligations: op.updates.map((u) => ({ id: u.id, from: u.from, to: u.to })) });
    await client.query('BEGIN');
    let applied = 0;
    for (const r of mp.renames) {
      const res = await client.query(`UPDATE "DressModel" SET name = $1, "updatedAt" = now() WHERE id = $2 AND name = $3`, [r.to, r.id, r.from]);
      applied += res.rowCount;
    }
    for (const u of ip) {
      const res = await client.query(`UPDATE "DressItem" SET "dressName" = $1 WHERE id = $2 AND "dressName" = $3`, [u.to, u.id, u.from]);
      applied += res.rowCount;
    }
    for (const u of op.updates) {
      const res = await client.query(`UPDATE "PaymentObligation" SET description = $1 WHERE id = $2 AND description = $3`, [u.to, u.id, u.from]);
      applied += res.rowCount;
    }
    await client.query('COMMIT');
    log(`\nAPPLIED ${applied} of ${total} planned change(s) (the rest changed meanwhile - re-run to pick them up).`);
    return { total, applied };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* already closed */ }
    throw e;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(USAGE); return; }
  const url = connectionUrl(opts);
  const target = describeDbTarget(url);
  const check = checkHost(target.host, opts['confirm-host'], collectKnownDbs(), { allowProd: !!opts['i-know-this-is-prod'], notProd: !!opts['not-prod'] });
  if (!check.ok) throw new Error(check.reason);
  console.log(`DB: ${target.host} / ${target.database} (${check.prod ? 'PRODUCTION' : check.label || 'non-prod'}) | mode: ${opts.apply ? 'APPLY' : 'DRY RUN'}`);
  const lib = await import(pathToFileURL(path.join(ROOT, 'lib', 'modelNameCleanup.js')).href);
  const client = await connect(url);
  try { await run(client, opts, lib); } finally { await client.end(); }
}

module.exports = { parseArgs, run };

if (require.main === module) {
  main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
}
