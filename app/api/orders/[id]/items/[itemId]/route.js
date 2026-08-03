import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { recalculateOrderObligations } from '../../../../../../lib/pricingEngine';
import { getAvailableInventory } from '../../../../../../lib/inventory';

// Rules the caller can actually do something about (missing dates, nothing free in stock).
// Everything else is a fault on our side: reporting those as 400 too made a server crash
// look like a bad request, which is how "Maximum call stack size exceeded" spent a while
// disguised as a validation failure.
const ruleError = (message) => Object.assign(new Error(message), { isRuleViolation: true });

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id, itemId } = resolvedParams;
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
      if (!order) throw ruleError('הזמנה לא נמצאה');
      
      const currentItem = await tx.orderItem.findUnique({ 
        where: { id: itemId },
        include: { dressItem: true }
      });
      if (!currentItem) throw ruleError('פריט בהזמנה לא נמצא');

      const settingsRaw = await tx.systemSetting.findMany();
      let bufferDays = 3;
      let skipWeekends = true;
      const bufferSetting = settingsRaw.find(s => s.key === 'inventory_buffer_days');
      if (bufferSetting) bufferDays = parseInt(bufferSetting.value, 10);
      const weekendSetting = settingsRaw.find(s => s.key === 'inventory_skip_weekends');
      if (weekendSetting) skipWeekends = weekendSetting.value === 'true';

      const newOrderIsAbroad = order.isAbroad || order.isWeekdayEvent;
      let targetMinDate, targetMaxDate;
      if (newOrderIsAbroad) {
         if (!order.fromDate || !order.toDate) throw ruleError('חסרים תאריכים להזמנת חו"ל');
         targetMinDate = order.fromDate;
         targetMaxDate = order.toDate;
      } else {
         if (!order.eventDate) throw ruleError('חסר תאריך אירוע להזמנה');
         targetMinDate = order.eventDate;
         targetMaxDate = order.eventDate;
      }

      let dressItemIdToUse = currentItem.dressItemId;

      // If model or size changed, we need a new inventory check
      if (currentItem.dressItem.dressModelId !== itemData.dressModelId || currentItem.sizeText !== itemData.sizeText) {
        if (currentItem.isTaken) {
            throw ruleError('לא ניתן לשנות דגם/מידה לפריט שכבר נלקח. יש להחזירו תחילה.');
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
            throw ruleError(`אין פריט פנוי במלאי עבור דגם זה במידה ${itemData.sizeText} בתאריך המבוקש`);
        }
        
        dressItemIdToUse = sizeAvail.itemIds[0];
      }

      const updateData = {
        dressItemId: dressItemIdToUse,
        sizeText: itemData.sizeText,
        neckAlteration: itemData.neckAlteration !== undefined && itemData.neckAlteration !== null && itemData.neckAlteration !== '' ? parseInt(itemData.neckAlteration) : null,
        sleeveAlteration: itemData.sleeveAlteration !== undefined && itemData.sleeveAlteration !== null && itemData.sleeveAlteration !== '' ? parseInt(itemData.sleeveAlteration) : null,
        lengthAlteration: itemData.lengthAlteration !== undefined && itemData.lengthAlteration !== null && itemData.lengthAlteration !== '' ? String(itemData.lengthAlteration) : null,
        alterationDetails: itemData.alterationDetails || null,
        alterationDone: itemData.alterationDone || false
      };

      const changes = {};
      const fieldsToCheck = ['dressItemId', 'sizeText', 'neckAlteration', 'sleeveAlteration', 'lengthAlteration', 'alterationDetails', 'alterationDone'];
      const formatVal = (val) => val === undefined || val === null ? '' : String(val);

      fieldsToCheck.forEach(field => {
         const oldVal = currentItem[field];
         const newVal = updateData[field];
         if (formatVal(oldVal) !== formatVal(newVal)) {
             changes[field] = { from: oldVal, to: newVal };
         }
      });

      // Update the item
      const updatedItem = await tx.orderItem.update({
        where: { id: itemId },
        data: updateData
      });

      if (Object.keys(changes).length > 0) {
          await tx.auditLog.create({
              data: {
                  entityType: 'OrderItem',
                  entityId: itemId,
                  action: 'UPDATE',
                  changesJson: JSON.stringify(changes)
              }
          });
      }

      return updatedItem;
    });

    // Recalculate obligations asynchronously after updating item
    await recalculateOrderObligations(parsedId);

    // Fetch the fully updated order data to return (like in POST).
    // finalOrder/items/payments/obligations/priceList are independent - fetch concurrently.
    const [finalOrderRaw, items, payments, obligationsRaw, priceList] = await Promise.all([
      prisma.order.findUnique({ where: { orderId: parsedId }, include: { customer: true } }),
      prisma.orderItem.findMany({
        where: { orderId: parsedId },
        include: { dressItem: { include: { dress: true } } }
      }),
      prisma.payment.findMany({ where: { orderId: parsedId } }),
      prisma.paymentObligation.findMany({ where: { orderId: parsedId } }),
      prisma.priceList.findMany()
    ]);

    let finalOrder = finalOrderRaw;

    const itemIds = items.map(i => i.id);
    const uniquePrefixes = new Set();
    items.forEach(i => {
      const dressName = i.dressItem?.dress?.name;
      const prefix = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
      if (!dressName && prefix) {
        uniquePrefixes.add(prefix);
      }
    });

    // auditLogs and dressModels both depend on the items fetched above - fetch concurrently.
    const [auditLogs, dressModels] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          entityType: 'OrderItem',
          entityId: { in: itemIds }
        },
        orderBy: { createdAt: 'desc' }
      }),
      uniquePrefixes.size > 0
        ? prisma.dressModel.findMany({
            where: { barcodePrefix: { in: Array.from(uniquePrefixes) } },
            select: { barcodePrefix: true, name: true }
          })
        : Promise.resolve([])
    ]);
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

    let obligations = obligationsRaw.map(ob => {
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
    console.error('Error updating order item:', error);
    return NextResponse.json(
      { error: error.isRuleViolation ? error.message : `שגיאת מערכת בעדכון הפריט: ${error.message}` },
      { status: error.isRuleViolation ? 400 : 500 }
    );
  }
}
