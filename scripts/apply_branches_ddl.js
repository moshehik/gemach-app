#!/usr/bin/env node
/**
 * מחיל את scripts/branches-ddl.sql על מסד אחד. ברירת מחדל: dry-run (מדפיס מה היה קורה, בלי לכתוב).
 *
 *   node scripts/apply_branches_ddl.js --target=test                      # dry-run על TEST_DATABASE_URL
 *   node scripts/apply_branches_ddl.js --target=test --write --expect-host=ep-fancy-pine
 *   node scripts/apply_branches_ddl.js --target=prod --org=1 --write --expect-host=ep-weathered-tree   # רק באישור הבעלים!
 *
 * --expect-host חובה עם --write: קידומת שם ה-host של המסד המיועד (כמו הכלל ב-CLAUDE.md, "אף סקריפט כתיבה לא סומך על ה-.env הפעיל").
 * org 1 = PROD_DATABASE_URL / DATABASE_URL, org 2 = scratch/new_gemach_db.env או PROD_DATABASE_URL_ORG2 (ר' scripts/lib/db-env.js).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { resolveDbUrl, parseOrgArg } = require('./lib/db-env');

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const arg = (name) => { const a = rest.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
  const write = rest.includes('--write');
  const target = arg('target') || 'test';
  const expectHost = arg('expect-host');
  let url;
  if (target === 'test') {
    // לוקח את TEST_DATABASE_URL מאותם קבצי env
    resolveDbUrl(1); // טוען את קבצי ה-env לתוך process.env
    url = process.env.TEST_DATABASE_URL;
  } else {
    url = resolveDbUrl(org);
  }
  if (!url) throw new Error('לא נמצא connection string ליעד');
  const host = new URL(url).host;
  console.log(`יעד: ${target}${target === 'prod' ? ' org' + org : ''}  host=${host}`);
  if (write && (!expectHost || !host.startsWith(expectHost))) throw new Error(`--expect-host חובה ותואם ל-host (${host})`);
  const sql = fs.readFileSync(path.join(__dirname, 'branches-ddl.sql'), 'utf8');
  const statements = sql.split(/\r?\n/).filter((l) => !l.trim().startsWith('--')).join('\n').split(';').map((s) => s.trim()).filter(Boolean);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const before = await client.query(`select column_name from information_schema.columns where table_name='DressItem' and column_name='branch'`);
    console.log(`העמודה DressItem.branch ${before.rowCount ? 'כבר קיימת' : 'חסרה'}`);
    for (const st of statements) {
      console.log(`${write ? 'מריץ' : '[dry-run]'}: ${st}`);
      if (write) await client.query(st);
    }
    if (write) {
      const after = await client.query(`select column_name from information_schema.columns where table_name='DressItem' and column_name='branch'`);
      console.log(`אחרי: העמודה ${after.rowCount ? 'קיימת' : 'עדיין חסרה!'}`);
    }
  } finally {
    await client.end();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
