
import prisma from '@/app/lib/prisma';

async function test() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const filterStatus = 'all';

    const where = {
      ...(filterStatus === 'deleted' ? { isDeleted: true } : { isDeleted: false }),
      ...(filterStatus === 'archive' ? { eventDate: { lt: today } } : {}),
      ...(filterStatus === 'soon' ? { OR: [{ eventDate: null }, { eventDate: { gte: today } }] } : {}),
    };

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        payments: true,
        obligations: true,
        items: {
          include: {
            dressItem: {
              include: {
                dress: true
              }
            }
          }
        }
      },
      orderBy: { eventDate: 'desc' },
      skip: 0,
      take: 50
    });

    console.log('Success! Found orders:', orders.length);
  } catch (err) {
    console.error('Error in query:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
