// סקריפט עוטף: מריץ את ארבעת ה-seed של סבב נווה יעקב 2026-10-05 בהרצה אחת, עם אותם דגלים כמו הסקריפטים הבודדים,
// ומדפיס טבלת לפני/אחרי של ארבעת המפתחות לכל גמח:
//   hide_order_payment_note               org2 = true | org1 = נוצר false אם חסר
//   print_order_clean_layout              org2 = true | org1 = נוצר false אם חסר
//   allow_abroad_long_stay_orders         org1 = true (נוצר אם חסר, לא נדרס) | org2 = false (נקבע/מתעדכן)
//   unpaid_action_approval_once_per_visit org2 = true | org1 = נוצר false אם חסר
// ערך קיים של org1 לעולם לא נדרס (רק org2 מקבל עדכון ערך). dry-run כברירת מחדל; כתיבה רק עם --write.
// כל גמח עובר בדיקת host נפרדת (ה-host לא ריק ושונה מה-host של הגמח השני) לפני כל כתיבה.
//
//   node scripts/seed_neve_2026_10_05_all_settings.js --org=2           (dry-run, נווה יעקב)
//   node scripts/seed_neve_2026_10_05_all_settings.js --org=2 --write
//   node scripts/seed_neve_2026_10_05_all_settings.js --org=1           (dry-run, הראשי)
//   node scripts/seed_neve_2026_10_05_all_settings.js --org=1 --write
//   node scripts/seed_neve_2026_10_05_all_settings.js --org=all [--write]   (שני הגמחים ברצף, org2 קודם)
'use strict';

const { parseOrgArg } = require('./lib/db-env');
const { applySetting, connectOrg } = require('./lib/seed-bool-setting');
const { ALL_DEFS } = require('./lib/neve-2026-10-05-setting-defs');

function printTable(org, results) {
  const rows = results.map((r) => ({
    key: r.key,
    before: r.before === null ? '(missing)' : r.before,
    after: r.after,
    action: r.action === 'none' ? (r.kept ? 'kept (differs from target)' : 'no change') : r.action,
  }));
  const cols = ['key', 'before', 'after', 'action'];
  const width = Object.fromEntries(cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => String(r[c]).length))]));
  const line = (r) => cols.map((c) => String(r[c]).padEnd(width[c])).join(' | ');
  console.log(`\norg${org} summary:`);
  console.log(line(Object.fromEntries(cols.map((c) => [c, c]))));
  console.log(cols.map((c) => '-'.repeat(width[c])).join('-+-'));
  for (const r of rows) console.log(line(r));
}

async function runOrg(org, write) {
  const { prisma } = connectOrg(org, write);
  try {
    const results = [];
    for (const def of ALL_DEFS) results.push(await applySetting(prisma, org, def, write));
    printTable(org, results);
    const changes = results.filter((r) => r.action !== 'none').length;
    console.log(write
      ? `org${org}: ${changes} change(s) written`
      : `org${org}: dry-run - ${changes} change(s) would be written; pass --write to apply`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const all = argv.includes('--org=all');
  if (!all && !argv.some((a) => /^--org=/.test(a))) throw new Error('--org=1|2|all is required');
  const { org, rest } = parseOrgArg(argv.filter((a) => a !== '--org=all'));
  const write = rest.includes('--write');
  const orgs = all ? [2, 1] : [org];
  for (const o of orgs) await runOrg(o, write);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
