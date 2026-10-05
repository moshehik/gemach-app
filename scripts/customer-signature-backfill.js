// מילוי חתימת התקנון ברמת הלקוח מההזמנות החתומות, לגמח אחד. ברירת מחדל = DRY-RUN (קריאה בלבד); כתיבה רק עם --write.
//   node scripts/customer-signature-backfill.js --org=1            (dry-run: זהות DB + עמודות + מספרים + דגימה מוצפנת)
//   node scripts/customer-signature-backfill.js --org=2
//   node scripts/customer-signature-backfill.js --org=1 --write    (מריץ את ה-UPDATE בטרנזקציה אחת; מתבטל אם מספר השורות שונה מה-DRY-RUN)
// ה-SQL עצמו נקרא מהקבצים שב-prisma/migrations-pending (2026-10-05-customer-signature-backfill*.sql) - מקור אמת יחיד, כך שמה שנבדק
// כ-dry-run הוא בדיוק מה שמורץ. ה-host נבדק (לא ריק ושונה מה-host של הגמח השני) לפני כל פעולה, ומודפס.
// לא מריץ שום DDL, לא נוגע ב-AuditLog, לא נוגע ב-Customer.updatedAt. סדר הפעולות המלא: docs/customer-signature-rollout-2026-10-05.md.
'use strict';

const fs = require('fs');
const path = require('path');
const { parseOrgArg } = require('./lib/db-env');
const { connectOrg } = require('./lib/seed-bool-setting');

const DIR = path.join(__dirname, '..', 'prisma', 'migrations-pending');
const DRYRUN_FILE = path.join(DIR, '2026-10-05-customer-signature-backfill-dryrun.sql');
const BACKFILL_FILE = path.join(DIR, '2026-10-05-customer-signature-backfill.sql');

/** מפצל קובץ SQL לפקודות: מסיר שורות הערה שלמות (--) ומפצל לפי ';' (בקבצים האלה אין ';' בתוך מחרוזות). */
function statementsOf(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  return text.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').split(';').map((s) => s.trim()).filter(Boolean);
}

// BigInt (count(*)) -> Number כדי ש-console/JSON יציגו
const plain = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])));

async function main() {
  const { org, rest } = parseOrgArg(process.argv.slice(2));
  const write = rest.includes('--write');
  const { prisma, host } = connectOrg(org, write);
  try {
    const cols = plain(await prisma.$queryRawUnsafe(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'Customer' AND column_name IN ('hasSignedRegulations','regulationsSignedAt') ORDER BY column_name`));
    console.log(`org${org} (${host}) Customer signature columns:`, JSON.stringify(cols));
    if (cols.length !== 2) throw new Error('ABORT: both signature columns must exist on "Customer" before the backfill (run 2026-10-04-customer-signed-regulations.sql first)');

    const [counts, sample] = statementsOf(DRYRUN_FILE);
    const c = plain(await prisma.$queryRawUnsafe(counts))[0];
    console.log('counts:', JSON.stringify(c));
    console.log('sample (anonymised):', JSON.stringify(plain(await prisma.$queryRawUnsafe(sample))));
    if (!write) { console.log('dry-run - pass --write to apply'); return; }

    const stmts = statementsOf(BACKFILL_FILE);
    if (stmts.length !== 1) throw new Error('ABORT: backfill file must contain exactly one statement');
    const expected = c.would_change;
    const updated = await prisma.$transaction(async (tx) => {
      const n = await tx.$executeRawUnsafe(stmts[0]);
      if (n !== expected) throw new Error(`ABORT (rolled back): updated ${n} rows but the dry-run said ${expected}`);
      return n;
    }, { timeout: 120000 });
    console.log(`org${org}: backfill updated ${updated} customers`);
    const after = plain(await prisma.$queryRawUnsafe(counts))[0];
    console.log('counts after (would_change must be 0):', JSON.stringify(after));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
