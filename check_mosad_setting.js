const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: { contains: 'mosad', mode: 'insensitive' }
    }
  });
  console.log(settings);
}

main().finally(() => prisma.$disconnect());
