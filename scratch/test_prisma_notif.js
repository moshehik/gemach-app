
import prisma from '@/app/lib/prisma';

async function run() {
  try {
    const employeeId = 1;
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { receiverId: employeeId },
          { receiverId: null }
        ]
      },
      include: {
        sender: {
          select: { firstName: true, lastName: true }
        },
        tags: {
          where: { employeeId: employeeId }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    console.log("Query success. Count:", notifications.length);
    
    // Map to add an isRead and isArchived computed property for global messages
    const mapped = notifications.map(notif => {
      let isArchived = notif.isArchived;
      if (notif.receiverId === null) {
        isArchived = notif.archivedBy.includes(employeeId);
      }
      return {
        ...notif,
        isRead: notif.receiverId === null ? notif.readBy.includes(employeeId) : notif.isRead,
        isArchived,
        personalTags: notif.tags.map(t => t.tag)
      };
    });
    console.log("Map success.");
  } catch (error) {
    console.error("Prisma error:", error);
  } finally {
    await prisma.$disconnect();
  }
}
run();
