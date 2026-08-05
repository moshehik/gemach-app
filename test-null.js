const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.orderItem.count({ where: { createdAt: null } });
  console.log('Null createdAt count:', count);
}
main().finally(() => prisma.$disconnect());
