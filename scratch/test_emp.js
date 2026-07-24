
import prisma from '@/app/lib/prisma';
prisma.employee.findMany().then(e => console.log(e.map(x=>x.id))).catch(console.error).finally(()=>prisma.$disconnect());
