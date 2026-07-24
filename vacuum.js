
import prisma from '@/app/lib/prisma';
async function run() {
  await prisma.$executeRawUnsafe('VACUUM');
  console.log('Vacuum complete');
}
run().finally(() => prisma.$disconnect());
