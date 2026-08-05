const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: 'hide_error_reporting' }
  });
  console.log('Settings:', settings);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
