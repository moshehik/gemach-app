const { PrismaClient: PostgresClient } = require('@prisma/client');
const { PrismaClient: SqliteClient } = require('./prisma/generated/sqlite');

const pg = new PostgresClient();
const sq = new SqliteClient();

async function main() {
  console.log('Cross-Checking Customers...');
  const customers = await sq.customer.findMany({ take: 3, orderBy: { id: 'desc' } });
  for (const c of customers) {
    const pgC = await pg.customer.findUnique({ where: { legacyId: c.id } });
    console.log(`\n--- Customer legacyId: ${c.id} ---`);
    console.log('SQ:', { firstName: c.firstName, lastName: c.lastName, phone1: c.phone1, id: c.id });
    console.log('PG:', { firstName: pgC?.firstName, lastName: pgC?.lastName, phone1: pgC?.phone1, id: pgC?.id });
    console.log('Match?', c.firstName === pgC?.firstName && pgC !== null);
  }

  console.log('\nCross-Checking Orders...');
  const orders = await sq.order.findMany({ take: 3, orderBy: { id: 'desc' }, include: { items: true } });
  for (const o of orders) {
    // In PG, orderId is unique, so we can also check by legacyId
    const pgO = await pg.order.findUnique({ where: { legacyId: o.id }, include: { items: true } });
    console.log(`\n--- Order legacyId: ${o.id}, orderId: ${o.orderId} ---`);
    console.log('SQ eventDate:', o.eventDate, 'notes:', o.notes, 'customerId:', o.customerId);
    console.log('PG eventDate:', pgO?.eventDate, 'notes:', pgO?.notes, 'customerId (PG ID vs legacy):', pgO?.customerId);
    console.log('Items Count SQ vs PG:', o.items.length, pgO?.items?.length);
  }

  console.log('\nCross-Checking Items...');
  const items = await sq.dressItem.findMany({ take: 3, orderBy: { id: 'desc' }, include: { dress: true } });
  for (const i of items) {
    const pgI = await pg.dressItem.findUnique({ where: { legacyId: i.id }, include: { dress: true } });
    console.log(`\n--- DressItem legacyId: ${i.id} ---`);
    console.log('SQ barcode:', i.dressBarcode, 'sizeText:', i.sizeText, 'dressId:', i.dressModelId, 'dressName:', i.dress?.name);
    console.log('PG barcode:', pgI?.dressBarcode, 'sizeText:', pgI?.sizeText, 'dressName:', pgI?.dress?.name);
    console.log('Match UUID created?', pgI?.id !== null);
  }

  console.log('\nCross-Checking OrderItems (Relation test)...');
  const orderItems = await sq.orderItem.findMany({ 
    where: { dressItemId: { not: null } },
    take: 3, 
    orderBy: { id: 'desc' } 
  });
  for (const oi of orderItems) {
    const pgOi = await pg.orderItem.findUnique({ where: { legacyId: oi.id } });
    console.log(`\n--- OrderItem legacyId: ${oi.id} ---`);
    console.log('SQ:', { id: oi.id, orderId: oi.orderId, dressItemId: oi.dressItemId });
    console.log('PG:', { id: pgOi?.id, orderId: pgOi?.orderId, dressItemId: pgOi?.dressItemId });
    
    if (oi.dressItemId && pgOi?.dressItemId) {
        const sqDressItem = await sq.dressItem.findUnique({ where: { id: oi.dressItemId } });
        const pgDressItem = await pg.dressItem.findUnique({ where: { id: pgOi.dressItemId } });
        console.log('Link matches?', sqDressItem?.id === pgDressItem?.legacyId);
    }
  }

  await pg.$disconnect();
  await sq.$disconnect();
}

main().catch(console.error);
