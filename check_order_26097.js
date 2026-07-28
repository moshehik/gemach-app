const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orderId = 26097;
  console.log(`Checking order ${orderId}...`);
  
  const order = await prisma.order.findUnique({
    where: { orderId: orderId },
    include: {
      items: {
        include: {
          dressItem: true
        }
      }
    }
  });

  if (!order) {
    console.log("Order not found!");
    return;
  }

  console.log("Order Details:", JSON.stringify(order, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
