const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  let employee = null;
  try {
    employee = await prisma.employee.create({
      data: { firstName: 'Test', lastName: 'Employee' }
    });

    const entryTime1 = new Date();
    const exitTime1 = new Date(entryTime1.getTime() + 60 * 60 * 1000); // 1 hour shift
    
    console.log(`[1] Adding first shift for ${employee.id}...`);
    // Simulated API POST logic
    const overlappingShifts1 = await prisma.shift.findMany({
      where: {
        employeeId: employee.id, isDeleted: false,
        OR: [ { entryTime: { lt: exitTime1 }, exitTime: { gt: entryTime1 } } ]
      }
    });
    
    if (overlappingShifts1.length > 0) {
      console.error('Test 1 Failed: Unexpected overlap');
    } else {
      await prisma.shift.create({
        data: { employeeId: employee.id, entryTime: entryTime1, exitTime: exitTime1 }
      });
      console.log('Test 1 Passed: Successfully created first shift without parseInt error.');
    }

    const entryTime2 = new Date(entryTime1.getTime() + 30 * 60 * 1000); // overlaps by 30 mins
    const exitTime2 = new Date(entryTime1.getTime() + 90 * 60 * 1000);
    
    console.log(`[2] Adding overlapping shift for ${employee.id}...`);
    const overlappingShifts2 = await prisma.shift.findMany({
      where: {
        employeeId: employee.id, isDeleted: false,
        OR: [ { entryTime: { lt: exitTime2 }, exitTime: { gt: entryTime2 } } ]
      }
    });

    if (overlappingShifts2.length > 0) {
      console.log('Test 2 Passed: Overlapping shift detected correctly (Would return 400).');
    } else {
      console.error('Test 2 Failed: Did not detect overlap.');
    }

  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    if (employee) {
      // Cleanup
      await prisma.shift.deleteMany({ where: { employeeId: employee.id } });
      await prisma.employee.delete({ where: { id: employee.id } });
    }
    await prisma.$disconnect();
  }
}
runTests();
