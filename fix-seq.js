const { PrismaClient } = require('@prisma/client');
const target = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function updateSequence(tableName, seqName = 'id') {
  try {
    const maxRecord = await target[tableName].findFirst({
      orderBy: { [seqName]: 'desc' },
      select: { [seqName]: true }
    });
    
    if (maxRecord && maxRecord[seqName]) {
      const maxId = maxRecord[seqName];
      const seqString = `"${tableName}_${seqName}_seq"`;
      await target.$executeRawUnsafe(`SELECT setval('${seqString}', ${maxId})`);
      console.log(`Updated sequence for ${tableName} to ${maxId}`);
    }
  } catch (e) {
    console.log(`Could not update sequence for ${tableName}:`, e.message);
  }
}

async function main() {
  await updateSequence('Customer');
  await updateSequence('Employee');
  await updateSequence('DressModel');
  await updateSequence('SystemSetting');
  await updateSequence('PriceList');
  await updateSequence('DressItem');
  await updateSequence('Order');
  await updateSequence('Shift');
  await updateSequence('Payment');
  await updateSequence('PaymentObligation');
  await updateSequence('OrderItem');
  await updateSequence('PageVisitLog');
  await updateSequence('AuditLog');
}

main().finally(() => target.$disconnect());
