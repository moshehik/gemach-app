import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const o = await prisma.order.findFirst({orderBy: {updatedAt: 'desc'}});
  console.log(o.orderId);
}
main().catch(console.error).finally(() => prisma.$disconnect());
