const { PrismaClient: PostgresClient } = require('@prisma/client');
const { PrismaClient: SqliteClient } = require('./prisma/generated/sqlite');

const pg = new PostgresClient();
const sq = new SqliteClient();

async function migrateData() {
  console.log('Starting part 2 of migration...');
  
  const tables = [
    { name: 'OrderItem', model: sq.orderItem, target: pg.orderItem },
    { name: 'PageVisitLog', model: sq.pageVisitLog, target: pg.pageVisitLog },
    { name: 'EmailLog', model: sq.emailLog, target: pg.emailLog },
    { name: 'AuditLog', model: sq.auditLog, target: pg.auditLog }
  ];

  for (const table of tables) {
    console.log(`\nMigrating ${table.name}...`);
    try {
      const records = await table.model.findMany();
      if (records.length === 0) {
        console.log(`No records found in ${table.name}.`);
        continue;
      }
      console.log(`Found ${records.length} records. Inserting in chunks...`);
      
      const chunkSize = 5000;
      let inserted = 0;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        const result = await table.target.createMany({
          data: chunk,
          skipDuplicates: true
        });
        inserted += result.count;
        console.log(`Inserted chunk of ${result.count} records. Total so far: ${inserted}`);
      }
      console.log(`Finished inserting ${inserted} records into ${table.name}.`);
    } catch (err) {
      console.error(`Error migrating ${table.name}:`, err.message);
    }
  }

  const allTables = ['Customer', 'Employee', 'DressModel', 'SystemSetting', 'PriceList', 'PriceRule', 'DressItem', 'Order', 'Shift', 'Payment', 'PaymentObligation', 'OrderItem', 'PageVisitLog', 'EmailLog', 'AuditLog'];
  
  console.log('\nUpdating sequence sequences (autoincrement counters)...');
  for (const tableName of allTables) {
    try {
      const modelName = tableName.charAt(0).toLowerCase() + tableName.slice(1);
      const tableModel = pg[modelName];
      if (!tableModel) continue;
      
      const maxRecord = await tableModel.aggregate({
        _max: { id: true }
      });
      
      if (maxRecord._max.id) {
        const nextId = maxRecord._max.id + 1;
        await pg.$executeRawUnsafe(`SELECT setval('"${tableName}_id_seq"', ${nextId}, false)`);
        console.log(`Updated sequence for ${tableName} to ${nextId}`);
      }
    } catch (err) {
      // Ignore
    }
  }

  console.log('\nMigration complete!');
  await pg.$disconnect();
  await sq.$disconnect();
}

migrateData().catch(e => {
  console.error(e);
  process.exit(1);
});
