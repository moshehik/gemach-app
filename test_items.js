const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const m = await prisma.dressModel.findFirst({ include: { items: true } });
  console.log(JSON.stringify(m.items[0], null, 2));
}

main();
