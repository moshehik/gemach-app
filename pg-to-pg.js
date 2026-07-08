
const { PrismaClient } = require('@prisma/client');

// Connect to the OLD Prisma Postgres DB
const src = new PrismaClient({
  datasourceUrl: process.env.OLD_PRISMA_URL
});

// Connect to the NEW Neon DB
const target = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function migrateTable(tableName, orderByField = 'id') {
  console.log(`\nMigrating ${tableName}...`);
  try {
    const totalCount = await src[tableName].count();
    console.log(`Found ${totalCount} records in ${tableName}.`);
    
    if (totalCount === 0) return;

    let skip = 0;
    const take = 5000;
    
    while (skip < totalCount) {
      const records = await src[tableName].findMany({
        orderBy: { [orderByField]: 'asc' },
        skip,
        take
      });
      
      if (records.length === 0) break;
      
      await target[tableName].createMany({
        data: records,
        skipDuplicates: true
      });
      
      skip += records.length;
      console.log(`Inserted ${skip} / ${totalCount} into ${tableName}...`);
    }
  } catch (error) {
    console.error(`Error migrating ${tableName}:`, error);
  }
}

async function updateSequence(tableName, seqName = 'id') {
  try {
    const maxRecord = await target[tableName].findFirst({
      orderBy: { [seqName]: 'desc' },
      select: { [seqName]: true }
    });
    
    if (maxRecord && maxRecord[seqName]) {
      const maxId = maxRecord[seqName];
      const seqString = `"${tableName}_${seqName}_seq"`;
      await target.$executeRawUnsafe(`SELECT setval('${tableName}_${seqName}_seq', ${maxId})`);
      console.log(`Updated sequence for ${tableName} to ${maxId}`);
    }
  } catch (e) {
    console.log(`Could not update sequence for ${tableName}:`, e.message);
  }
}

async function main() {
  console.log("Starting Postgres to Neon Postgres migration...");

  // Note: We don't deleteMany to avoid foreign key cascading drops, since the new DB is empty.

  await migrateTable('customer');
  await migrateTable('employee');
  await migrateTable('dressModel');
  await migrateTable('systemSetting');
  await migrateTable('priceList');
  await migrateTable('dressItem');
  
  // Order relies on Customer/Employee. OrderId is not necessarily 'id' for sorting but it has 'id' PK.
  await migrateTable('order', 'orderId');
  await migrateTable('shift');
  await migrateTable('payment');
  await migrateTable('paymentObligation');
  await migrateTable('orderItem');
  await migrateTable('pageVisitLog');
  await migrateTable('emailLog');
  await migrateTable('auditLog');

  console.log("\nUpdating sequence sequences (autoincrement counters)...");
  await updateSequence('Customer');
  await updateSequence('Employee');
  await updateSequence('DressModel');
  await updateSequence('SystemSetting');
  await updateSequence('PriceList');
  await updateSequence('DressItem');
  await updateSequence('Order');
  await updateSequence('Shift');
  await updateSequence('Payment');
  await updateSequence('PaymentObligation');
  await updateSequence('OrderItem');
  await updateSequence('PageVisitLog');
  await updateSequence('AuditLog');

  console.log("\nMigration complete!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await src.$disconnect();
    await target.$disconnect();
  });
