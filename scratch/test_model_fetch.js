const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const t0 = Date.now();
  const dbModels = await prisma.dressModel.findMany({
    where: { id: { in: [483] } }
  });
  console.log(`Models took: ${Date.now() - t0}ms`);
}
run();
