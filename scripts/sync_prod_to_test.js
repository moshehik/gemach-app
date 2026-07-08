const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prodUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
const testUrl = process.env.TEST_DATABASE_URL;

if (!prodUrl || !testUrl) {
  console.error("Missing PROD_DATABASE_URL or TEST_DATABASE_URL in .env");
  process.exit(1);
}

const prod = new PrismaClient({ datasourceUrl: prodUrl });
const test = new PrismaClient({ datasourceUrl: testUrl });

async function syncTable(tableName, orderByField = 'id') {
  console.log(`Syncing ${tableName}...`);
  try {
    const totalCount = await prod[tableName].count();
    if (totalCount === 0) return;

    let skip = 0;
    const take = 5000;
    
    while (skip < totalCount) {
      const records = await prod[tableName].findMany({
        orderBy: { [orderByField]: 'asc' },
        skip,
        take
      });
      
      if (records.length === 0) break;
      
      await test[tableName].createMany({
        data: records,
        skipDuplicates: true
      });
      
      skip += records.length;
    }
    console.log(`✅ ${tableName} (${totalCount} records)`);
  } catch (error) {
    console.error(`❌ Error migrating ${tableName}:`, error.message);
  }
}

async function updateSequence(tableName, seqName = 'id') {
  try {
    const maxRecord = await test[tableName].findFirst({
      orderBy: { [seqName]: 'desc' },
      select: { [seqName]: true }
    });
    
    if (maxRecord && maxRecord[seqName]) {
      const maxId = maxRecord[seqName];
      await test.$executeRawUnsafe(`SELECT setval('"${tableName}_${seqName}_seq"', ${maxId})`);
    }
  } catch (e) {}
}

async function main() {
  console.log("Starting FAST sync from PROD to TEST...");

  // 1. Truncate test database completely
  console.log("Wiping test database...");
  const tables = [
    'Customer', 'Employee', 'DressModel', 'SystemSetting', 'PriceList', 
    'DressItem', 'Order', 'Shift', 'Payment', 'PaymentObligation', 
    'OrderItem', 'PageVisitLog', 'EmailLog', 'AuditLog', 'PriceRule'
  ];
  
  const truncateQuery = `TRUNCATE TABLE ${tables.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
  await test.$executeRawUnsafe(truncateQuery);
  console.log("✅ Test database wiped.");

  // 2. Sync tables in order
  await syncTable('customer');
  await syncTable('employee');
  await syncTable('dressModel');
  await syncTable('systemSetting');
  await syncTable('priceList');
  await syncTable('priceRule');
  await syncTable('dressItem');
  
  await syncTable('order', 'orderId');
  await syncTable('shift');
  await syncTable('payment');
  await syncTable('paymentObligation');
  await syncTable('orderItem');
  await syncTable('pageVisitLog');
  await syncTable('emailLog');
  await syncTable('auditLog');

  // 3. Update sequences
  console.log("Updating sequences...");
  for (const table of tables) {
    if (table === 'Order') {
        await updateSequence('Order', 'id');
        await updateSequence('Order', 'orderId');
    } else {
        await updateSequence(table);
    }
  }

  console.log("🎉 Sync complete! Test database is now an exact copy of Prod.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prod.$disconnect();
    await test.$disconnect();
  });
