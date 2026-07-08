const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixAllFallbackDates() {
  console.log("Fixing all fallback dates in the database...");
  
  // Find all models with a date from 2026-07-07 or later
  const fallbackDate = new Date('2026-07-06T00:00:00Z');
  
  const res = await prisma.dressModel.updateMany({
    where: {
      entryDateToRepo: {
        gt: fallbackDate
      }
    },
    data: {
      entryDateToRepo: null
    }
  });

  console.log(`Successfully fixed ${res.count} models that were assigned fallback dates.`);
  await prisma.$disconnect();
}

fixAllFallbackDates().catch(e => {
  console.error(e);
  prisma.$disconnect();
});
