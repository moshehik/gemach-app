 
import prisma from '@/app/lib/prisma'; 

async function main() { 
  const models = await prisma.dressModel.findMany({
    where: { barcodePrefix: 333 }
  }); 
  console.dir(models, {depth: null}); 

  const itemsWith333 = await prisma.orderItem.findMany({
    where: { barcodePrefix: 333 },
    take: 5
  });
  console.dir(itemsWith333, {depth: null});
} 

main().catch(console.error).finally(()=>prisma.$disconnect());
