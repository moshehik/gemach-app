const { PrismaClient: PostgresClient } = require('@prisma/client');
const { PrismaClient: SqliteClient } = require('./prisma/generated/sqlite');

const pg = new PostgresClient();
const sq = new SqliteClient();

async function validateMigration() {
  console.log('Validating Migration...');
  const tables = [
    'customer', 'employee', 'dressModel', 'systemSetting', 'priceList',
    'priceRule', 'dressItem', 'order', 'shift', 'payment', 
    'paymentObligation', 'orderItem', 'pageVisitLog', 'emailLog', 'auditLog'
  ];

  let hasErrors = false;

  for (const table of tables) {
    try {
      const sqCount = await sq[table].count();
      const pgCount = await pg[table].count();
      
      if (sqCount !== pgCount) {
        console.error(`❌ Mismatch in ${table}: SQLite has ${sqCount}, PG has ${pgCount}`);
        hasErrors = true;
      } else {
        console.log(`✅ ${table} matches: ${sqCount} rows`);
      }
    } catch (err) {
      console.error(`Error checking ${table}:`, err.message);
    }
  }

  if (!hasErrors) {
    console.log('\nAll tables match exactly in row counts!');
  }
  
  await pg.$disconnect();
  await sq.$disconnect();
}

validateMigration().catch(console.error);
