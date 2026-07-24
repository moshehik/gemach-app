const { PrismaClient: RemoteClient } = require('@prisma/client');
const { PrismaClient: LocalClient } = require('@prisma/local-client');

async function main() {
  const remoteClient = new RemoteClient();
  const localClient = new LocalClient();

  try {
    const remoteCount = await remoteClient.payment.count();
    const localCount = await localClient.payment.count();

    console.log(`Remote payment count: ${remoteCount}`);
    console.log(`Local payment count: ${localCount}`);

    let matchStatus = 'SUCCESS';
    if (remoteCount !== localCount) {
       console.log(`Count mismatch! Remote: ${remoteCount}, Local: ${localCount}`);
       matchStatus = 'FAILED (Count mismatch)';
    }

    // Get 3 random payments from remote
    const remoteItems = await remoteClient.payment.findMany({
      take: 3,
      orderBy: { id: 'desc' }
    });

    for (let i = 0; i < remoteItems.length; i++) {
       const remoteItem = remoteItems[i];
       const localItem = await localClient.payment.findUnique({
          where: { id: remoteItem.id }
       });
       
       if (!localItem) {
          console.log(`Mismatch on payment ID ${remoteItem.id}: Missing in local db.`);
          if (matchStatus === 'SUCCESS') matchStatus = 'FAILED (Missing item)';
          continue;
       }
       
       const remoteKeys = Object.keys(remoteItem);
       let itemMatch = true;
       for (const key of remoteKeys) {
         let rVal = remoteItem[key];
         let lVal = localItem[key];
         
         // Date comparison
         if (rVal instanceof Date) {
            rVal = rVal.getTime();
         }
         if (lVal instanceof Date) {
            lVal = lVal.getTime();
         }
         
         // Decimal string comparison (Prisma Decimal might come back differently)
         if (typeof rVal === 'object' && rVal !== null && rVal.constructor.name === 'Decimal') {
             rVal = rVal.toNumber();
         }
         if (typeof lVal === 'object' && lVal !== null && lVal.constructor.name === 'Decimal') {
             lVal = lVal.toNumber();
         }
         
         if (rVal !== lVal) {
            console.log(`Mismatch on payment ID ${remoteItem.id}, field ${key}: Remote='${rVal}', Local='${lVal}'`);
            itemMatch = false;
         }
       }
       if (!itemMatch) {
         if (matchStatus === 'SUCCESS') matchStatus = 'FAILED (Data mismatch)';
       }
    }
    
    console.log(`Overall Result: ${matchStatus}`);
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await remoteClient.$disconnect();
    await localClient.$disconnect();
  }
}

main();
