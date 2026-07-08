const { PrismaClient: PostgresClient } = require('@prisma/client');
const { PrismaClient: SqliteClient } = require('./prisma/generated/sqlite');

const pg = new PostgresClient();
const sq = new SqliteClient();

async function migrateData() {
  console.log('Starting migration from SQLite to Postgres...');
  
  // Order matters due to foreign key constraints!
  // Dependencies:
  // DressItem -> DressModel
  // Order -> Customer
  // Shift -> Employee
  // Payment -> Customer, Order
  // PaymentObligation -> Order
  // OrderItem -> Order, DressItem
  // PageVisitLog -> Employee
  // EmailLog -> Customer, Employee

  const tables = [
    { name: 'Customer', model: sq.customer, target: pg.customer },
    { name: 'Employee', model: sq.employee, target: pg.employee },
    { name: 'DressModel', model: sq.dressModel, target: pg.dressModel },
    { name: 'SystemSetting', model: sq.systemSetting, target: pg.systemSetting },
    { name: 'PriceList', model: sq.priceList, target: pg.priceList },
    { name: 'PriceRule', model: sq.priceRule, target: pg.priceRule },
    { name: 'DressItem', model: sq.dressItem, target: pg.dressItem },
    { name: 'Order', model: sq.order, target: pg.order },
    { name: 'Shift', model: sq.shift, target: pg.shift },
    { name: 'Payment', model: sq.payment, target: pg.payment },
    { name: 'PaymentObligation', model: sq.paymentObligation, target: pg.paymentObligation },
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
      console.log(`Found ${records.length} records. Inserting...`);
      
      

      // We use createMany for bulk insert
      // Note: SQLite might have returned bigints or weird types, but Prisma normally handles the JS conversion gracefully.
      const result = await table.target.createMany({
        data: records,
        skipDuplicates: true
      });
      console.log(`Inserted ${result.count} records into ${table.name}.`);
    } catch (err) {
      console.error(`Error migrating ${table.name}:`, err.message);
    }
  }

  // Update Postgres sequence counters since we inserted explicit IDs
  console.log('\nUpdating sequence sequences (autoincrement counters)...');
  for (const table of tables) {
    try {
      const maxRecord = await table.model.aggregate({
        _max: { id: true }
      });
      
      if (maxRecord._max.id) {
        const nextId = maxRecord._max.id + 1;
        // In Postgres with Prisma, sequence name is usually table_id_seq
        await pg.$executeRawUnsafe(`SELECT setval('"${table.name}_id_seq"', ${nextId}, false)`);
        console.log(`Updated sequence for ${table.name} to ${nextId}`);
      }
    } catch (err) {
      // Ignore errors if sequence update fails (e.g. if sequence is named differently or table has no id)
      // Actually, Prisma uses SERIAL which automatically creates sequences named TableName_id_seq
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
