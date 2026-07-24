
import prisma from '@/app/lib/prisma';

async function main() {
  const m = await prisma.dressModel.findUnique({ where: { id: 366 } });
  console.log(JSON.stringify(m, null, 2));
}

main();
