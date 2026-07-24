
import prisma from '@/app/lib/prisma';
async function run() {
  const result = await prisma.$queryRaw`SELECT COUNT(*) FROM "PaymentObligation" WHERE "orderItemId" IS NOT NULL`;
  console.log('Direct SQL count:', result);
  process.exit(0);
}
run();
