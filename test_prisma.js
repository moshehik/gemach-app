const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
