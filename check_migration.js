const { PrismaClient: PostgresClient } = require('@prisma/client');
const { PrismaClient: SqliteClient } = require('./prisma/generated/sqlite');

const pg = new PostgresClient();
const sq = new SqliteClient();

async function main() {
  const sqOrders = await sq.order.findMany({ orderBy: { orderId: 'desc' }, take: 2 });
  
  for (const sqOrder of sqOrders) {
    const pgOrder = await pg.order.findFirst({ where: { orderId: sqOrder.orderId } });
    console.log("SQLite Order:", sqOrder.orderId);
    console.log(sqOrder);
    console.log("Postgres Order:", pgOrder.orderId);
    console.log(pgOrder);
  }
  
  await sq.$disconnect();
  await pg.$disconnect();
}
main();
