import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { recalculateOrderObligations } from '../../../../../lib/pricingEngine';
import { getAvailableInventory } from '../../../../../lib/inventory';

export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const parsedId = parseInt(id);
    
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const itemData = await request.json();

    if (!itemData.dressModelId || !itemData.sizeText) {
      return NextResponse.json({ error: 'יש לבחור דגם ומידה' }, { status: 400 });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { orderId: parsedId } });
      if (!order) throw new Error('הזמנה לא נמצאה');

      const settingsRaw = await tx.systemSetting.findMany();
      let bufferDays = 3;
      let skipWeekends = true;
      const bufferSetting = settingsRaw.find(s => s.key === 'inventory_buffer_days');
      if (bufferSetting) bufferDays = parseInt(bufferSetting.value, 10);
      const weekendSetting = settingsRaw.find(s => s.key === 'inventory_skip_weekends');
      if (weekendSetting) skipWeekends = weekendSetting.value === 'true';

      const newOrderIsAbroad = order.isAbroad;
      let targetMinDate, targetMaxDate;
      if (newOrderIsAbroad) {
         if (!order.fromDate || !order.toDate) throw new Error('חסרים תאריכים להזמנת חו"ל');
         targetMinDate = order.fromDate;
         targetMaxDate = order.toDate;
      } else {
         if (!order.eventDate) throw new Error('חסר תאריך אירוע להזמנה');
         targetMinDate = order.eventDate;
         targetMaxDate = order.eventDate;
      }

      const availability = await getAvailableInventory(
        itemData.dressModelId,
        targetMinDate,
        bufferDays,
        skipWeekends,
        newOrderIsAbroad,
        targetMaxDate,
        parsedId
      );

      const sizeAvail = availability.find(a => (a.sizeText || a.size || 'כללי') === itemData.sizeText);

      if (!sizeAvail || sizeAvail.availableQuantity <= 0 || !sizeAvail.itemIds || sizeAvail.itemIds.length === 0) {
        throw new Error(`אין פריט פנוי במלאי עבור דגם זה במידה ${itemData.sizeText} בתאריך המבוקש`);
      }

      const dressItemIdToUse = sizeAvail.itemIds[0];

      // Create the item
      const newItem = await tx.orderItem.create({
        data: {
          orderId: parsedId,
          dressItemId: dressItemIdToUse,
          sizeText: itemData.sizeText,
          quantity: 1,
          neckAlteration: itemData.neckAlteration ? parseInt(itemData.neckAlteration) : null,
          sleeveAlteration: itemData.sleeveAlteration ? parseInt(itemData.sleeveAlteration) : null,
          lengthAlteration: itemData.lengthAlteration || null,
          alterationDetails: itemData.alterationDetails || null,
          alterationDone: false,
          isDeleted: false,
          finalPrice: 0 // Will be calculated by pricing engine
        }
      });

      return newItem;
    });

    // Recalculate obligations asynchronously after adding item
    await recalculateOrderObligations(parsedId);

    // Fetch the fully updated order data to return
    let finalOrder = await prisma.order.findUnique({
      where: { orderId: parsedId },
      include: { customer: true }
    });
    
    const items = await prisma.orderItem.findMany({
      where: { orderId: parsedId },
      include: { dressItem: { include: { dress: true } } }
    });
    
    const itemIds = items.map(i => i.id);
    const uniquePrefixes = new Set();
    items.forEach(i => {
      const dressName = i.dressItem?.dress?.name;
      const prefix = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
      if (!dressName && prefix) {
        uniquePrefixes.add(prefix);
      }
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'OrderItem',
        entityId: { in: itemIds }
      },
      orderBy: { createdAt: 'desc' }
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
        description: finalDescription,
        auditLogs: auditLogs.filter(log => log.entityId === item.id)
      };
    });

    const payments = await prisma.payment.findMany({ where: { orderId: parsedId } });
    let obligations = await prisma.paymentObligation.findMany({ where: { orderId: parsedId } });
    const priceList = await prisma.priceList.findMany();
    
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
    
    finalOrder = { ...finalOrder, items: itemsWithLogs, payments, obligations };

    return NextResponse.json(finalOrder);

  } catch (error) {
    console.error('Error adding order item:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה בשמירת הפריט' },
      { status: 400 }
    );
  }
}
