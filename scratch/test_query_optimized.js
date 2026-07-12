const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const t0 = Date.now();
  const dressModelId = 483;
  
  const items = await prisma.dressItem.findMany({
    where: { dressModelId: parseInt(dressModelId) },
    select: { id: true }
  });
  
  const itemIds = items.map(i => i.id);
  
  const bookings = await prisma.orderItem.findMany({
    where: {
      dressItemId: { in: itemIds },
      isDeleted: false,
      isReturned: false, 
    },
    include: { order: true, dressItem: true }
  });
  
  console.log(`Time taken: ${Date.now() - t0}ms, found ${bookings.length}`);
}
run();
