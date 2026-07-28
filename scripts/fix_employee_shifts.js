const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration to fix totalMinutes and totalCalculated...');
  const shifts = await prisma.shift.findMany({
    include: { employee: true }
  });

  let fixedCount = 0;

  for (const shift of shifts) {
    if (shift.entryTime && shift.exitTime) {
      const entry = new Date(shift.entryTime);
      let exit = new Date(shift.exitTime);

      if (exit < entry) {
        exit = new Date(exit.getTime() + 24 * 60 * 60 * 1000); // add 24 hours if exit is after midnight
      }

      const diffMs = exit.getTime() - entry.getTime();
      const diffMins = Math.round(diffMs / 60000);
      
      const hourlyWage = shift.hourlyWageSnapshot || shift.employee?.hourlyWage || 0;
      const totalCalculated = parseFloat(((diffMins / 60) * hourlyWage).toFixed(2));

      if (shift.totalMinutes !== diffMins || shift.totalCalculated !== totalCalculated) {
        await prisma.shift.update({
          where: { id: shift.id },
          data: {
            totalMinutes: diffMins,
            totalCalculated: totalCalculated,
          }
        });
        fixedCount++;
      }
    }
  }

  console.log(`Finished fixing. Updated ${fixedCount} shifts.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
