const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.systemSetting.findMany().then(res => {
  fs.writeFileSync('db_settings.json', JSON.stringify(res, null, 2), 'utf8');
}).catch(console.error).finally(()=>prisma.$disconnect());
