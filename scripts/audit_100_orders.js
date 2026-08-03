const { PrismaClient } = require('@prisma/client');
const { calculateOrderStatus } = require('../lib/orderStatus');
const prisma = new PrismaClient();

async function audit100Orders() {
  console.log("=== STARTING COMPREHENSIVE AUDIT OF 100+ ORDERS ===");

  // Fetch 150 actual orders from DB across different ID ranges
  const ordersOld = await prisma.order.findMany({
    where: { isDeleted: false, orderId: { lte: 10000 } },
    include: { items: true, customer: true },
    take: 50
  });

  const ordersMid = await prisma.order.findMany({
    where: { isDeleted: false, orderId: { gte: 10001, lte: 20000 } },
    include: { items: true, customer: true },
    take: 50
  });

  const ordersRecent = await prisma.order.findMany({
    where: { isDeleted: false, orderId: { gte: 20001 } },
    include: { items: true, customer: true },
    take: 50
  });

  const order25652 = await prisma.order.findUnique({
    where: { orderId: 25652 },
    include: { items: true, customer: true }
  });

  const allSampled = [...ordersOld, ...ordersMid, ...ordersRecent];
  if (!allSampled.some(o => o.orderId === 25652) && order25652) {
    allSampled.push(order25652);
  }

  console.log(`Auditing ${allSampled.length} actual sampled orders...`);

  let totalItemsAudited = 0;
  let itemsMissingTakenDate = 0;
  let itemsMissingReturnDate = 0;
  let itemsBarcodeNotTaken = 0;
  let invalidStatusesCount = 0;

  const auditDetails = [];

  for (const order of allSampled) {
    const calculatedStatus = calculateOrderStatus(order);
    const validItems = order.items ? order.items.filter(i => !i.isDeleted) : [];

    let orderIssues = [];

    for (const item of validItems) {
      totalItemsAudited++;

      // Check barcode vs taken
      if (item.barcode !== null && !item.isTaken) {
        itemsBarcodeNotTaken++;
        orderIssues.push(`Item ID ${item.id} has barcode ${item.barcode} but isTaken=false`);
      }

      // Check taken vs takenDate
      if ((item.isTaken || item.barcode !== null) && !item.takenDate) {
        itemsMissingTakenDate++;
        orderIssues.push(`Item ID ${item.id} (barcode ${item.barcode}) is taken but takenDate=null`);
      }

      // Check returned vs returnDate
      if ((item.isReturned || (order.eventDate && new Date(order.eventDate) < new Date())) && !item.returnDate) {
        itemsMissingReturnDate++;
        orderIssues.push(`Item ID ${item.id} is returned/past event but returnDate=null`);
      }
    }

    if (orderIssues.length > 0) {
      invalidStatusesCount++;
    }

    auditDetails.push({
      orderId: order.orderId,
      customerName: order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : 'Unknown',
      eventDate: order.eventDate ? new Date(order.eventDate).toISOString().split('T')[0] : 'N/A',
      returnDate: order.returnDate ? new Date(order.returnDate).toISOString().split('T')[0] : 'N/A',
      itemCount: validItems.length,
      calculatedStatus,
      issuesCount: orderIssues.length,
      issues: orderIssues
    });
  }

  console.log("\n=================== AUDIT REPORT SUMMARY ===================");
  console.log(`Total Orders Audited: ${allSampled.length}`);
  console.log(`Total Items Audited: ${totalItemsAudited}`);
  console.log(`Items with barcode but isTaken=false: ${itemsBarcodeNotTaken}`);
  console.log(`Taken items missing takenDate: ${itemsMissingTakenDate}`);
  console.log(`Returned/past items missing returnDate: ${itemsMissingReturnDate}`);
  console.log(`Orders with any date/rental issue: ${invalidStatusesCount}`);
  console.log("============================================================\n");

  console.log("=== SPECIFIC AUDIT FOR ORDER 25652 ===");
  const audit25652 = auditDetails.find(a => a.orderId === 25652);
  console.log(JSON.stringify(audit25652 || order25652, null, 2));

  return {
    totalOrders: allSampled.length,
    totalItems: totalItemsAudited,
    itemsBarcodeNotTaken,
    itemsMissingTakenDate,
    itemsMissingReturnDate,
    invalidStatusesCount,
    audit25652
  };
}

audit100Orders().catch(console.error).finally(() => prisma.$disconnect());
