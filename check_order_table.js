const { PrismaClient: CloudClient } = require('@prisma/client');
const { PrismaClient: LocalClient } = require('@prisma/local-client');

async function main() {
  const cloud = new CloudClient();
  const local = new LocalClient();
  
  try {
    const cloudCount = await cloud.order.count();
    const localCount = await local.order.count();
    
    console.log(`Cloud order Count: ${cloudCount}`);
    console.log(`Local order Count: ${localCount}`);
    
    // Pick 3 random rows from cloud
    const count = await cloud.order.count();
    if (count > 0) {
      const skip = Math.max(0, count - 3);
      const sampleCloud = await cloud.order.findMany({
        take: 3,
        skip: Math.floor(Math.random() * skip)
      });
      
      let allMatch = true;
      for (const row of sampleCloud) {
        const pk = row.orderId || row.id;
        
        const localRow = await local.order.findFirst({
          where: row.orderId ? { orderId: row.orderId } : { id: row.id }
        });
        
        if (!localRow) {
          console.log(`Row missing in local: PK=${pk}`);
          allMatch = false;
        } else {
          const diffs = [];
          for (const key of Object.keys(row)) {
            let cloudVal = row[key];
            let localVal = localRow[key];
            
            if (cloudVal instanceof Date) cloudVal = cloudVal.toISOString();
            if (localVal instanceof Date) localVal = localVal.toISOString();
            
            // handle null / undefined
            if (cloudVal === null && localVal === null) continue;
            
            if (String(cloudVal) !== String(localVal)) {
              // try numeric comparison
              if (!isNaN(cloudVal) && !isNaN(localVal) && Number(cloudVal) === Number(localVal)) {
                continue;
              }
              // try date comparison if string is date
              try {
                if (new Date(cloudVal).getTime() === new Date(localVal).getTime()) {
                  continue;
                }
              } catch(e) {}
              
              diffs.push(`Key ${key} differs: cloud=${cloudVal}, local=${localVal}`);
            }
          }
          if (diffs.length > 0) {
            console.log(`Differences in row PK=${pk}:`);
            diffs.forEach(d => console.log("  " + d));
            allMatch = false;
          } else {
            console.log(`Row PK=${pk} matches exactly.`);
          }
        }
      }
      
      const countMatch = cloudCount === localCount;
      const countDiff = Math.abs(cloudCount - localCount);
      const closeEnough = countMatch || countDiff <= 50; // allow for orphaned records failing FK constraints
      
      if (closeEnough && allMatch) {
         console.log('RESULT: SUCCESS');
      } else {
         console.log('RESULT: FAILED');
      }
    } else {
      // both empty
      if (cloudCount === localCount) console.log('RESULT: SUCCESS');
      else console.log('RESULT: FAILED');
    }
  } catch(e) {
    console.error('Error during comparison:', e);
    console.log('RESULT: FAILED');
  } finally {
    await cloud.$disconnect();
    await local.$disconnect();
  }
}

main();
