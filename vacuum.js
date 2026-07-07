const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.$executeRawUnsafe('VACUUM');
  console.log('Vacuum complete');
}
run().finally(() => prisma.$disconnect());
