const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.employee.findMany().then(e => console.log(e.map(x=>x.id))).catch(console.error).finally(()=>prisma.$disconnect());
