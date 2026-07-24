const { PrismaClient: CloudClient } = require('@prisma/client');
const { PrismaClient: LocalClient } = require('@prisma/local-client');

async function check() {
  const cloud = new CloudClient();
  const local = new LocalClient();

  try {
    const cloudCount = await cloud.orderItem.count();
    const localCount = await local.orderItem.count();

    console.log(`Cloud count: ${cloudCount}`);
    console.log(`Local count: ${localCount}`);

    const tolerance = 50; 

    let countStatus = "FAILED";
    if (cloudCount === localCount) {
        countStatus = "SUCCESS (Exact Match)";
    } else if (Math.abs(cloudCount - localCount) <= tolerance) {
        countStatus = "SUCCESS (Within tolerance)";
    } else {
        console.log(`Counts differ by more than ${tolerance}`);
    }

    const cloudRows = await cloud.orderItem.findMany({ take: 3, orderBy: { id: 'desc' } });
    
    let matchCount = 0;
    for (const cloudRow of cloudRows) {
      const localRow = await local.orderItem.findUnique({
        where: { id: cloudRow.id }
      });
      
      if (!localRow) {
        console.log(`Row with id ${cloudRow.id} missing in local database.`);
        continue;
      }
      
      let allMatch = true;
      for (const key of Object.keys(cloudRow)) {
        let cloudVal = cloudRow[key];
        let localVal = localRow[key];
        
        if (cloudVal instanceof Date && localVal instanceof Date) {
            if (cloudVal.getTime() !== localVal.getTime()) {
                console.log(`Mismatch on ${key}: ${cloudVal} !== ${localVal}`);
                allMatch = false;
            }
        } else if (typeof cloudVal === 'number' && typeof localVal === 'number') {
            if (Math.abs(cloudVal - localVal) > 0.0001) {
                console.log(`Mismatch on ${key}: ${cloudVal} !== ${localVal}`);
                allMatch = false;
            }
        } else if (cloudVal !== localVal) {
            console.log(`Mismatch on ${key}: ${cloudVal} !== ${localVal}`);
            allMatch = false;
        }
      }
      
      if (allMatch) {
          matchCount++;
      } else {
          console.log(`Row ${cloudRow.id} failed match`);
      }
    }

    console.log(`Data matched for ${matchCount}/3 rows.`);

    if (countStatus.startsWith("SUCCESS") && (matchCount === 3 || cloudCount === 0)) {
      console.log("FINAL_RESULT: SUCCESS");
    } else {
      console.log("FINAL_RESULT: FAILED");
    }
  } catch (error) {
    console.error("Error running script:", error);
    console.log("FINAL_RESULT: FAILED");
  } finally {
    await cloud.$disconnect();
    await local.$disconnect();
  }
}

check();
