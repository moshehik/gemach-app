const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.priceList.findMany().then(res => console.log('PriceList count:', res.length)).finally(() => prisma.$disconnect());
