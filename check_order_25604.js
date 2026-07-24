
import prisma from '@/app/lib/prisma';

async function main() {
  const orderIdNum = 25604;
  const order = await prisma.order.findUnique({
    where: { orderId: orderIdNum },
    include: {
      items: {
        include: {
          dressItem: {
            include: {
              dress: true
            }
          }
        }
      }
    }
  });
  
  console.log(JSON.stringify(order, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
