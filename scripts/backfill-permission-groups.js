// One-time backfill for the /admin/permissions redesign that removed the implicit
// "auto" row (see prisma/schema.prisma's PermissionPageGroup doc comment and
// app/api/admin/permissions/route.js's buildPermissionGroups): every
// PERMISSION_CATALOG item that isn't already covered by an existing
// PermissionPageGroup row gets a new real single-key row, named after that item's
// label, so nothing disappears from the pages table on launch day.
//
// Only the 'pages' group is backfilled. The 'features' table is deliberately left
// empty — it shows only rows an admin adds manually via "שורת הרשאה חדשה".
//
// Idempotent — safe to re-run; only creates rows for keys not already covered by
// SOME existing row (regardless of that row's catalogGroup, though in practice
// 'pages'/'features' keys never collide since they're namespaced page:/feature:).
//
// Requires the prisma/schema.prisma PermissionPageGroup.catalogGroup column to
// already exist on the target DB (run `npx prisma db push` first). Run once per
// database by pointing DATABASE_URL at each connection string in turn — see
// scripts/seed_courier_settings.js for the established per-org run pattern
// (TEST, then org1 PROD_DATABASE_URL, then org2's DB from scratch/new_gemach_db.env
// — re-verify that host is current before running, it drifts after Neon cutovers).
const { PrismaClient } = require('@prisma/client');
const { PERMISSION_CATALOG } = require('../lib/permissionsMetadata');

const prisma = new PrismaClient();

async function backfillPermissionGroups() {
  const existingRows = await prisma.permissionPageGroup.findMany();
  const coveredKeys = new Set(existingRows.flatMap((row) => JSON.parse(row.keys || '[]')));

  const maxOrderByGroup = {};
  for (const row of existingRows) {
    maxOrderByGroup[row.catalogGroup] = Math.max(maxOrderByGroup[row.catalogGroup] ?? -1, row.order);
  }

  let created = 0;
  for (const item of PERMISSION_CATALOG) {
    if (item.group !== 'pages') continue;
    if (coveredKeys.has(item.key)) {
      console.log(`Already covered, skipped: ${item.key}`);
      continue;
    }
    const order = (maxOrderByGroup[item.group] ?? -1) + 1;
    maxOrderByGroup[item.group] = order;
    await prisma.permissionPageGroup.create({
      data: { name: item.label, catalogGroup: item.group, keys: JSON.stringify([item.key]), order },
    });
    created++;
    console.log(`Created row for: ${item.key} (${item.group})`);
  }
  console.log(`Done. Created ${created} new row(s), ${coveredKeys.size} key(s) already covered.`);
}

backfillPermissionGroups()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
