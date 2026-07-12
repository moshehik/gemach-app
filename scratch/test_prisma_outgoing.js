const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const employeeId = 1;
    const outgoing = await prisma.notification.findMany({
      where: { senderId: employeeId },
      include: {
        receiver: {
          select: { firstName: true, lastName: true }
        },
        tags: {
          where: { employeeId: employeeId }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    console.log("Outgoing success. Count:", outgoing.length);
  } catch (error) {
    console.error("Prisma error:", error);
  } finally {
    await prisma.$disconnect();
  }
}
run();
