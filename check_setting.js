const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.systemSetting.findUnique({where: {key: 'enable_ai_specific_employees'}}).then(res => console.log(res)).catch(console.error).finally(() => prisma.$disconnect());
