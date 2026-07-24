 
import prisma from '@/app/lib/prisma'; 

async function main() { 
  const total = await prisma.dressModel.count();
  const nullPrefixes = await prisma.dressModel.count({ where: { barcodePrefix: null } });
  
  console.log(`Total models: ${total}`);
  console.log(`Models with null barcodePrefix: ${nullPrefixes}`);
} 

main().catch(console.error).finally(()=>prisma.$disconnect());
