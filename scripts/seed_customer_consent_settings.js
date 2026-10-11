// יוצר את שורות ההגדרה של ההסכמות המפורשות בארגון אחד (לפי נוהל CLAUDE.md: אותם מפתחות בשני הגמ"חים, ערך ששומר על ההתנהגות הקיימת):
//   explicit_consent_enabled = 'false'     require_privacy_acceptance = 'true'     privacy_policy_text = ''
// *** לא הורץ. dry-run כברירת מחדל; כתיבה רק עם --apply וגם --expect-host=<תחילית ה-host שהודפסה>. לא דורס שורה קיימת. ***
// ההדלקה בפועל (explicit_consent_enabled=true) נעשית בנפרד לכל ארגון, אחרי אישור הבעלים והרצת ה-DDL (scripts/apply_customer_consent_table.js).
//   node scripts/seed_customer_consent_settings.js --org=1
//   node scripts/seed_customer_consent_settings.js --org=2 --apply --expect-host=ep-xxxx
'use strict';
const { PrismaClient } = require('@prisma/client');
const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const ROWS = [
  { key: 'explicit_consent_enabled', value: 'false', name: 'הסכמות מפורשות בלקוח (תקנון, דיוורים, פרטיות)', category: 'הזמנות', type: 'boolean' },
  { key: 'require_privacy_acceptance', value: 'true', name: 'חובה לאשר מדיניות פרטיות בלקוח חדש', category: 'הזמנות', type: 'boolean' },
  { key: 'privacy_policy_text', value: '', name: 'נוסח מדיניות הפרטיות', category: 'הזמנות', type: 'text' },
];

function parse(argv) {
  const { org, rest } = parseOrgArg(argv);
  let apply = false; let expectHost = null;
  for (const a of rest) {
    if (a === '--apply') apply = true;
    else if (a.startsWith('--expect-host=')) expectHost = a.slice('--expect-host='.length).trim() || null;
    else throw new Error(`unknown argument ${a}`);
  }
  if (apply && !expectHost) throw new Error('--apply requires --expect-host=<host prefix printed by the dry run>');
  return { org, apply, expectHost };
}

async function main() {
  const { org, apply, expectHost } = parse(process.argv.slice(2));
  const url = resolveDbUrl(org);
  const host = new URL(url).hostname;
  console.log(`org${org}: target host ${host}`);
  if (apply && !host.startsWith(expectHost)) throw new Error(`SAFETY ABORT: host ${host} does not start with --expect-host=${expectHost}`);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    for (const row of ROWS) {
      const exists = await prisma.systemSetting.findUnique({ where: { key: row.key } });
      if (exists) { console.log(`org${org}: exists, skipped: ${row.key} = ${JSON.stringify(exists.value)}`); continue; }
      if (!apply) { console.log(`org${org}: DRY RUN - would create ${row.key} = ${JSON.stringify(row.value)}`); continue; }
      await prisma.systemSetting.create({ data: row });
      console.log(`org${org}: created ${row.key} = ${JSON.stringify(row.value)}`);
    }
    if (!apply) console.log(`Owner approval needed, then re-run with --apply --expect-host=${host.split('.')[0]}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
