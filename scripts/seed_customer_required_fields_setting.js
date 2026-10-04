// מוסיף את customer_required_fields (כרטיס הלקוח החדש, תשובת הבעלים 4.10.2026: "מקום בהגדרות לקבוע איזה שדות הם חובה").
// בלי השורה ב-DB ההגדרה פשוט לא מוצגת במסך ההגדרות - הקוד משתמש בברירת המחדל (שם פרטי, שם משפחה, טלפון = מה שחובה היום),
// כך שאין שינוי התנהגות. הערך שנזרע זהה לברירת המחדל בשני הגמחים.
//
// כלל הבטיחות של הריפו (memory: org1/org2 settings cross-contamination) - לא הורץ:
//   * --org=1|2 חובה (אין ברירת מחדל לגמח הראשי);
//   * ברירת המחדל היא DRY-RUN: מדפיס את ה-host של ה-DB ומה היה נכתב, בלי לכתוב;
//   * כתיבה רק עם --apply וגם --expect-host=<תחילית ה-host שהודפסה ב-dry-run> שתואמת.
//   node scripts/seed_customer_required_fields_setting.js --org=2
//   node scripts/seed_customer_required_fields_setting.js --org=2 --apply --expect-host=ep-xxxx
// אידמפוטנטי (לא דורס ערך קיים).
'use strict';

const KEY = 'customer_required_fields';
const ROW = {
  key: KEY,
  value: 'firstName,lastName,phone1',
  name: 'שדות חובה בכרטיס לקוח',
  category: 'הזמנות',
  type: 'text',
  notes: 'השדות שחייבים להיות מלאים בכרטיס הלקוח החדש - נבדק בכל שמירה (עריכה ולקוח חדש), במסך ובשרת.',
};

/** פענוח דגלים בלי גישה ל-DB. זורק על --org חסר/לא תקין. */
function parseArgs(argv) {
  let org = null;
  let apply = false;
  let expectHost = null;
  for (const a of argv) {
    const m = /^--org=(.*)$/.exec(a);
    if (m) org = m[1];
    else if (a === '--apply') apply = true;
    else if (a.startsWith('--expect-host=')) expectHost = a.slice('--expect-host='.length).trim() || null;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (org === null) throw new Error('--org=1|2 is required (no default org)');
  if (org !== '1' && org !== '2') throw new Error(`--org must be 1 or 2, got ${org}`);
  if (apply && !expectHost) throw new Error('--apply requires --expect-host=<host prefix printed by the dry run>');
  return { org: Number(org), apply, expectHost };
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return '(unparsable url)'; }
}

/** האם מותר לכתוב ל-host הזה. */
function hostMatches(host, expectHost) {
  return !!expectHost && typeof host === 'string' && host.startsWith(expectHost);
}

async function main() {
  const { org, apply, expectHost } = parseArgs(process.argv.slice(2));
  const { resolveDbUrl } = require('./lib/db-env');
  const url = resolveDbUrl(org);
  const host = hostOf(url);
  console.log(`org${org}: target DB host = ${host}`);
  if (apply && !hostMatches(host, expectHost)) {
    throw new Error(`SAFETY ABORT: host ${host} does not start with --expect-host=${expectHost}`);
  }
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const exists = await prisma.systemSetting.findUnique({ where: { key: KEY } });
    if (exists) {
      console.log(`org${org}: already exists, nothing to do: ${KEY} = ${exists.value}`);
      return;
    }
    if (!apply) {
      console.log(`org${org}: DRY RUN - would create ${KEY} = ${ROW.value}. Re-run with --apply --expect-host=${host.split('.')[0]}`);
      return;
    }
    await prisma.systemSetting.create({ data: ROW });
    console.log(`org${org}: added setting ${KEY}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
}

module.exports = { parseArgs, hostMatches, hostOf, ROW };
