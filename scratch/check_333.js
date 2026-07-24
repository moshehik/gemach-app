 
import prisma from '@/app/lib/prisma'; 

async function main() { 
  const models = await prisma.dressModel.findMany(); 
  const model333 = models.find(m => m.barcodePrefix === 333 || m.name?.includes('333'));
  console.dir({ model333 }, { depth: null });
  
  const dressItems = await prisma.dressItem.findMany({
    where: { barcodePrefix: 333 }
  });
  console.dir({ dressItemsCount: dressItems.length, firstFew: dressItems.slice(0,2) }, { depth: null });
} 

main().catch(console.error).finally(()=>prisma.$disconnect());
