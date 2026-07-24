import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testApi(id) {
  const parsedId = parseInt(id);
  const order = await prisma.order.findUnique({
    where: { orderId: parsedId },
    include: {
      customer: true
    }
  });

  const items = await prisma.orderItem.findMany({
    where: { orderId: parsedId },
    include: {
      dressItem: {
        include: {
          dress: true
        }
      }
    }
  });

  const payments = await prisma.payment.findMany({
    where: { orderId: parsedId }
  });

  const priceList = await prisma.priceList.findMany();
  let obligations = await prisma.paymentObligation.findMany({
    where: { orderId: parsedId }
  });

  const uniquePrefixes = new Set();
  items.forEach(i => {
    const dressName = i.dressItem?.dress?.name;
    const prefix = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
    if (!dressName && prefix) {
      uniquePrefixes.add(prefix);
    }
  });

  let dressModels = [];
  if (uniquePrefixes.size > 0) {
    dressModels = await prisma.dressModel.findMany({
      where: { barcodePrefix: { in: Array.from(uniquePrefixes) } },
      select: { barcodePrefix: true, name: true }
    });
  }
  const dressModelMap = new Map(dressModels.filter(m => m.barcodePrefix).map(m => [m.barcodePrefix, m.name]));

  const itemsWithLogs = items.map(item => {
    let dressName = item.dressItem?.dress?.name;
    const prefix = item.dressItem?.dress?.barcodePrefix || item.dressItem?.barcodePrefix || item.barcodePrefix;
    
    if (!dressName && prefix) {
      dressName = dressModelMap.get(prefix);
    }
    
    let finalDescription = item.description || 'פריט כללי';
    if (dressName) {
      finalDescription = `${dressName} (קוד: ${prefix || ''})`;
    } else if (item.description) {
      finalDescription = item.description;
    }
    
    return {
      ...item,
      description: finalDescription
    };
  });

  obligations = obligations.map(ob => {
    if (ob.isManual === false || ob.productId) {
       ob.isManual = false;
       if (ob.productId) {
           const prod = priceList.find(p => p.id === ob.productId || String(p.legacyId) === String(ob.productId));
           if (!ob.description) {
               const matchedItem = itemsWithLogs.find(i => {
                   const cat = i.dressItem?.dress?.priceCategory || '';
                   return prod && (cat === prod.category || cat.replace('כלול ב', '').trim() === prod.category);
               });
               ob.description = matchedItem ? `${matchedItem.dressItem?.dress?.name || 'פריט'} ${matchedItem.sizeText ? `מידה ${matchedItem.sizeText}` : ''} (פריט #${matchedItem.id})` : (prod ? prod.description : 'חיוב מחירון');
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

  return { ...order, items: itemsWithLogs, payments, obligations };
}

testApi(26101)
  .then(res => console.log('Success:', res.orderId))
  .catch(err => console.error('Error:', err))
  .finally(() => prisma.$disconnect());
