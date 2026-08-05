const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RECALC_SETTING_KEYS = [
  'REFUND_DAYS_FROM_ORDER',
  'NO_REFUND_DAYS_BEFORE_EVENT',
  'REFUND_PERCENTAGE',
  'REFUND_REPAIRS',
  'ENABLE_SET_DISCOUNTS',
  'CANCELLATION_CREDIT_MINUTES'
];

async function main() {
  const parsedOrderId = 25734;
  const order = await prisma.order.findUnique({
    where: { orderId: parsedOrderId },
    include: { customer: true, employee: true }
  });

  const [items, payments, refunds, priceList, obligationsRaw, settings] = await Promise.all([
    prisma.orderItem.findMany({
      where: { orderId: parsedOrderId },
      include: {
        dressItem: {
          include: {
            dress: true
          }
        }
      }
    }),
    prisma.payment.findMany({ where: { orderId: parsedOrderId } }),
    prisma.refund.findMany({ where: { orderId: parsedOrderId } }),
    prisma.priceList.findMany({ select: { id: true, legacyId: true, category: true, description: true, fromSize: true, toSize: true, price: true } }),
    prisma.paymentObligation.findMany({ where: { orderId: parsedOrderId } }),
    prisma.systemSetting.findMany({ where: { key: { in: RECALC_SETTING_KEYS } } })
  ]);

  let obligations = obligationsRaw;

  const uniquePrefixes = new Set();
  items.forEach(i => {
    const dressName = i.dressItem?.dress?.name;
    const prefix = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
    if (!dressName && prefix !== null && prefix !== undefined) {
      const numPfx = parseInt(prefix, 10);
      if (!isNaN(numPfx)) uniquePrefixes.add(numPfx);
    }
  });

  let dressModels = [];
  if (uniquePrefixes.size > 0) {
    dressModels = await prisma.dressModel.findMany({
      where: { barcodePrefix: { in: Array.from(uniquePrefixes) } },
      select: { barcodePrefix: true, name: true }
    });
  }
  const dressModelMap = new Map();
  dressModels.forEach(m => {
    if (m.barcodePrefix !== null && m.barcodePrefix !== undefined) {
      dressModelMap.set(Number(m.barcodePrefix), m.name);
      dressModelMap.set(String(m.barcodePrefix), m.name);
    }
  });

  const itemsWithLogs = items.map(item => {
    let dressName = item.dressItem?.dress?.name;
    const prefix = item.dressItem?.dress?.barcodePrefix || item.dressItem?.barcodePrefix || item.barcodePrefix;
    
    if (!dressName && prefix !== null && prefix !== undefined) {
      dressName = dressModelMap.get(Number(prefix)) || dressModelMap.get(String(prefix));
    }
    
    let finalDescription = item.description;
    if (!finalDescription || finalDescription === 'פריט כללי') {
      if (dressName) {
        finalDescription = `${dressName}${prefix ? ` (קוד: ${prefix})` : ''}`;
      } else if (item.dressItem?.dressName) {
        finalDescription = item.dressItem.dressName;
      } else {
        finalDescription = 'פריט כללי';
      }
    } else if (dressName && !finalDescription.includes(dressName)) {
      finalDescription = `${dressName}${prefix ? ` (קוד: ${prefix})` : ''} - ${item.description}`;
    }

    const isTaken = item.isTaken || item.takenDate !== null;
    const isReturned = item.isReturned || item.returnDate !== null;

    return {
      ...item,
      description: finalDescription,
      isTaken,
      isReturned
    };
  });

  obligations = obligations.map(ob => {
    if (ob.isManual === false || ob.productId) {
       ob.isManual = false;
       if (ob.productId) {
           const prod = priceList.find(p => String(p.id) === String(ob.productId) || String(p.legacyId) === String(ob.productId));
           if (!ob.description) {
               const matchedItem = itemsWithLogs.find(i => {
                   const cat = i.dressItem?.dress?.priceCategory || '';
                   return prod && (cat === prod.category || cat.replace('כלול ב', '').trim() === prod.category);
               });
               ob.description = matchedItem ? `${matchedItem.dressItem?.dress?.name || matchedItem.description || 'פריט'} ${matchedItem.sizeText ? `מידה ${matchedItem.sizeText}` : ''} (פריט #${matchedItem.id})` : (prod ? (prod.description || prod.category || 'חיוב מחירון') : `חיוב מוצר #${ob.productId}`);
           }
           ob.productName = ob.description;
           if (prod) {
               ob.priceCategory = prod.category;
               ob.priceDescription = prod.description;
           }
       } else if (ob.description) {
           ob.productName = ob.description;
       } else {
           ob.productName = 'חיוב אוטומטי';
       }
    } else {
       ob.productName = ob.description ? ob.description : 'חיוב ידני';
    }
    return ob;
  });

  console.log("Success! No error thrown.");
}

main().catch(e => {
  console.error("ERROR CAUGHT:");
  console.error(e);
}).finally(() => prisma.$disconnect());
