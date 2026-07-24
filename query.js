
import prisma from '@/app/lib/prisma';
prisma.priceList.findMany().then(res => console.log('PriceList count:', res.length)).finally(() => prisma.$disconnect());
