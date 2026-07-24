
import prisma from '@/app/lib/prisma';

async function main() {
  try {
    const dressModels = await prisma.dressModel.findMany({
      where: {
        isDeleted: false
      },
      include: {
        items: {
          where: {
            isDeleted: false
          }
        }
      }
    });
    console.log("Success! Count:", dressModels.length);
  } catch (e) {
    console.error("Prisma error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
