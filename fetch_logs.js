 
import prisma from '@/app/lib/prisma'; 

async function main() { 
  const logs = await prisma.auditLog.findMany({ 
    orderBy: { id: 'desc' }, 
    take: 5 
  }); 
  console.log(JSON.stringify(logs, null, 2)); 
} 

main().catch(console.error).finally(() => prisma.$disconnect());
