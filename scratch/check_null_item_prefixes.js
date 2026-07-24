 
import prisma from '@/app/lib/prisma'; 

async function main() { 
  const totalItems = await prisma.dressItem.count();
  const nullPrefixesItems = await prisma.dressItem.count({ where: { barcodePrefix: null } });
  
  console.log(`Total dress items: ${totalItems}`);
  console.log(`Dress items with null barcodePrefix: ${nullPrefixesItems}`);
} 

main().catch(console.error).finally(()=>prisma.$disconnect());
