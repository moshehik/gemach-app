
import prisma from '@/app/lib/prisma';

async function run() {
  const t0 = Date.now();
  const dbModels = await prisma.dressModel.findMany({
    where: { id: { in: [483] } }
  });
  console.log(`Models took: ${Date.now() - t0}ms`);
}
run();
