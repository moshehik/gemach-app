const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const m = await prisma.dressModel.findMany();
  const prefixes = m.map(x => x.barcodePrefix);
  console.log("Total:", prefixes.length, "Unique:", new Set(prefixes).size);
}

main();
