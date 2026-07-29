const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.systemSetting.findMany().then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error).finally(()=>prisma.$disconnect());
