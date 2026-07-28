const {PrismaClient} = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
prisma.systemSetting.findMany().then(s => fs.writeFileSync('settings_dump.json', JSON.stringify(s, null, 2))).finally(() => prisma.$disconnect());
