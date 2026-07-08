const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const o = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Order'`);
  console.log(o);
}
main().catch(console.error).finally(() => prisma.$disconnect());
