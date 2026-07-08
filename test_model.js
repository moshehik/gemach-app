const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const m = await prisma.dressModel.findUnique({ where: { id: 366 } });
  console.log(JSON.stringify(m, null, 2));
}

main();
