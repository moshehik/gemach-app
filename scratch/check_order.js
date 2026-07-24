 
import prisma from '@/app/lib/prisma'; 

async function main() { 
  const items = await prisma.orderItem.findMany({
    take: 5, 
    include: {
      dressItem: {
        include: {
          dress: true
        }
      }
    }
  }); 
  console.dir(items, {depth: null}); 
} 

main().catch(console.error).finally(()=>prisma.$disconnect());
