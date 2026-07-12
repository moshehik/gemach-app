const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const t0 = Date.now();
  const dressModelId = 483;
  
  const bookings = await prisma.orderItem.findMany({
    where: {
      dressItem: { dressModelId: parseInt(dressModelId) },
      isDeleted: false,
      isReturned: false, 
    },
    include: { order: true, dressItem: true }
  });
  
  console.log(`Time taken: ${Date.now() - t0}ms, found ${bookings.length}`);
}
run();
