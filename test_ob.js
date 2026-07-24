
import prisma from '@/app/lib/prisma';

async function main() {
  const obs = await prisma.paymentObligation.findMany({ take: 5 });
  console.log(obs);
}
main().finally(() => prisma.$disconnect());
