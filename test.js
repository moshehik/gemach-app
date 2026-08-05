const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  try {
    const res = await prisma.orderItem.findMany({
      where: {
        AND: [
            { OR: [{ neckAlteration: 0 }, { neckAlteration: null }] },
            { OR: [{ lengthAlteration: null }, { lengthAlteration: { in: ['', 'null', '0'] } }] },
            { OR: [{ sleeveAlteration: 0 }, { sleeveAlteration: null }] }
        ]
      },
      take: 1
    });
    console.log('Success:', res.length);
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
