const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.systemSetting.findMany().then(res => console.log(res)).catch(console.error).finally(() => prisma.$disconnect());
