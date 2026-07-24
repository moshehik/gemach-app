 
import prisma from '@/app/lib/prisma'; 

async function main() { 
  const models = await prisma.dressModel.findMany({
    where: { name: 'ורוד גוונים' }
  });
  console.dir(models, { depth: null });
  
  // also get total count of models
  const total = await prisma.dressModel.count();
  console.log("Total models in DB:", total);
} 

main().catch(console.error).finally(()=>prisma.$disconnect());
