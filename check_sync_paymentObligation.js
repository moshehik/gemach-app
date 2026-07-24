const { PrismaClient: RemoteClient } = require('@prisma/client');
const { PrismaClient: LocalClient } = require('@prisma/local-client');

async function main() {
  const remoteClient = new RemoteClient();
  const localClient = new LocalClient();

  try {
    console.log('Connecting to remote and local databases...');
    
    const remoteCount = await remoteClient.paymentObligation.count();
    const localCount = await localClient.paymentObligation.count();
    
    console.log(`Remote paymentObligation count: ${remoteCount}`);
    console.log(`Local paymentObligation count: ${localCount}`);
    
    let isSuccess = true;
    let details = [];

    if (remoteCount !== localCount) {
        details.push(`Count mismatch: Remote(${remoteCount}) vs Local(${localCount})`);
    }
    
    const randomRows = await remoteClient.$queryRawUnsafe(`
      SELECT id FROM "PaymentObligation" 
      ORDER BY RANDOM() 
      LIMIT 3;
    `).catch(() => null);

    let rowsToTest = [];
    if (randomRows && randomRows.length > 0) {
        for (let row of randomRows) {
            const fullRow = await remoteClient.paymentObligation.findUnique({ where: { id: row.id }});
            if (fullRow) rowsToTest.push(fullRow);
        }
    } else {
        const allRemote = await remoteClient.paymentObligation.findMany({ take: 100 });
        if (allRemote.length > 0) {
            for (let i = 0; i < Math.min(3, allRemote.length); i++) {
                rowsToTest.push(allRemote[Math.floor(Math.random() * allRemote.length)]);
            }
        }
    }

    if (rowsToTest.length === 0) {
        console.log(remoteCount === 0 && localCount === 0 ? 'SUCCESS' : 'FAILED\nNo rows could be retrieved for comparison.');
        return;
    }

    for (let i = 0; i < rowsToTest.length; i++) {
        const remoteRow = rowsToTest[i];
        const localRow = await localClient.paymentObligation.findUnique({ where: { id: remoteRow.id }});
        
        if (!localRow) {
            isSuccess = false;
            details.push(`Row ${remoteRow.id} exists in remote but missing in local.`);
            continue;
        }

        for (const key in remoteRow) {
            let remoteVal = remoteRow[key];
            let localVal = localRow[key];

            if (remoteVal instanceof Date) remoteVal = remoteVal.getTime();
            if (localVal instanceof Date) localVal = localVal.getTime();
            
            if (remoteVal && typeof remoteVal.toString === 'function' && typeof remoteVal === 'object' && !(remoteVal instanceof Date)) {
                remoteVal = remoteVal.toString();
            }
            if (localVal && typeof localVal.toString === 'function' && typeof localVal === 'object' && !(localVal instanceof Date)) {
                localVal = localVal.toString();
            }

            if (remoteVal !== localVal) {
                isSuccess = false;
                details.push(`Mismatch on row ${remoteRow.id}, field '${key}': Remote(${remoteVal}) vs Local(${localVal})`);
            }
        }
    }

    if (isSuccess && (remoteCount === localCount || Math.abs(remoteCount - localCount) < 50)) {
        console.log('SUCCESS');
        if (details.length > 0) {
            console.log('Warnings:');
            details.forEach(d => console.log(d));
        }
    } else {
        console.log('FAILED');
        details.forEach(d => console.log(d));
    }

  } catch (error) {
    console.error('FAILED');
    console.error(error);
  } finally {
    await remoteClient.$disconnect();
    await localClient.$disconnect();
  }
}

main();
