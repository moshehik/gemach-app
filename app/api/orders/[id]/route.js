import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export const dynamic = 'force-dynamic';
import { recalculateOrderObligations } from '../../../../lib/pricingEngine';

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    let parsedOrderId;
    let order;

    if (id.includes('-')) {
      order = await prisma.order.findUnique({
        where: { id },
        include: { customer: true }
      });
      if (order) parsedOrderId = order.orderId;
    } else {
      parsedOrderId = parseInt(id);
      if (!isNaN(parsedOrderId)) {
        order = await prisma.order.findUnique({
          where: { orderId: parsedOrderId },
          include: { customer: true }
        });
      }
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Workaround for schema relation pointing to Order.id instead of Order.orderId
    const items = await prisma.orderItem.findMany({
      where: { orderId: parsedOrderId },
      include: {
        dressItem: {
          include: {
            dress: true
          }
        }
      }
    });

    const payments = await prisma.payment.findMany({
      where: { orderId: parsedOrderId }
    });

    const priceList = await prisma.priceList.findMany();
    let obligations = await prisma.paymentObligation.findMany({
      where: { orderId: parsedOrderId }
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

    order = {
      ...order,
      items: itemsWithLogs,
      payments,
      obligations
    };

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order details' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    let parsedOrderId;
    let existingOrder;

    if (id.includes('-')) {
      existingOrder = await prisma.order.findUnique({
        where: { id }
      });
      if (existingOrder) parsedOrderId = existingOrder.orderId;
    } else {
      parsedOrderId = parseInt(id);
      if (!isNaN(parsedOrderId)) {
        existingOrder = await prisma.order.findUnique({
          where: { orderId: parsedOrderId }
        });
      }
    }

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const data = await request.json();

    // Offline data collision check
    if (data.updatedAt && existingOrder.updatedAt) {
      const clientUpdate = new Date(data.updatedAt).getTime();
      const serverUpdate = new Date(existingOrder.updatedAt).getTime();
      
      // If server is strictly newer by more than 1 second
      if (serverUpdate > clientUpdate + 1000) {
        return NextResponse.json({ 
          error: 'Data Collision', 
          message: 'הזמנה זו עודכנה בשרת לאחר הסנכרון האחרון שלך. כדי למנוע דריסת נתונים, אנא רענן את העמוד ושלב את השינויים שלך.',
        }, { status: 409 });
      }
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update general order details
      const order = await tx.order.update({
        where: { orderId: parsedOrderId },
        data: {
          totalAmount: data.totalAmount !== undefined && data.totalAmount !== null ? (parseFloat(data.totalAmount) || 0) : undefined,
          eventDate: data.eventDate ? new Date(data.eventDate) : null,
          eventDateHebrew: data.eventDateHebrew !== undefined ? data.eventDateHebrew : undefined,
          returnDate: data.returnDate ? new Date(data.returnDate) : null,
          isAbroad: data.isAbroad,
          fromDate: data.fromDate ? new Date(data.fromDate) : null,
          toDate: data.toDate ? new Date(data.toDate) : null,
          notes: data.notes,
          status: data.status,
        }
      });

      // 2. Update order items (alterations, size, deletions) and create new items
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.id) {
            await tx.orderItem.update({
              where: { id: item.id },
              data: {
                sizeText: item.sizeText,
                neckAlteration: (item.neckAlteration === true || item.neckAlteration === 1 || item.neckAlteration === '1') ? 1 : (item.neckAlteration === null ? null : 0),
                sleeveAlteration: (item.sleeveAlteration === true || item.sleeveAlteration === 1 || item.sleeveAlteration === '1') ? 1 : (item.sleeveAlteration === null ? null : 0),
                lengthAlteration: (item.lengthAlteration !== undefined && item.lengthAlteration !== null && item.lengthAlteration !== '') ? String(item.lengthAlteration) : null,
                alterationDetails: item.alterationDetails,
                alterationDone: item.alterationDone,
                isDeleted: item.isDeleted
              }
            });
          } else if (item.isNew && item.dressModelId && item.sizeText) {
            // Need to find an available dressItem for this model and size
            const availableItem = await tx.dressItem.findFirst({
              where: {
                dressModelId: item.dressModelId,
                sizeText: item.sizeText,
                notInUse: false,
                inRepair: false
              }
            });
            
            if (availableItem) {
              await tx.orderItem.create({
                data: {
                  orderId: parsedOrderId,
                  dressItemId: availableItem.id,
                  sizeText: item.sizeText,
                  quantity: 1,
                  neckAlteration: (item.neckAlteration === true || item.neckAlteration === 1 || item.neckAlteration === '1') ? 1 : (item.neckAlteration === null ? null : 0),
                  sleeveAlteration: (item.sleeveAlteration === true || item.sleeveAlteration === 1 || item.sleeveAlteration === '1') ? 1 : (item.sleeveAlteration === null ? null : 0),
                  lengthAlteration: (item.lengthAlteration !== undefined && item.lengthAlteration !== null && item.lengthAlteration !== '') ? String(item.lengthAlteration) : null,
                  alterationDetails: item.alterationDetails,
                  alterationDone: false,
                  isDeleted: false,
                  finalPrice: 0 // Will be calculated by pricing engine
                }
              });
            } else {
              throw new Error(`אין פריט פנוי במלאי עבור דגם זה במידה ${item.sizeText}`);
            }
          }
        }
      }

      // 3. Process manual obligations
      if (data.obligations && Array.isArray(data.obligations)) {
        for (const obs of data.obligations) {
          if (obs.id) {
            await tx.paymentObligation.update({
              where: { id: obs.id },
              data: {
                isDeleted: obs.isDeleted,
                description: obs.description,
                amount: parseFloat(obs.amount) || 0
              }
            });
          } else if (obs.isNew) {
            await tx.paymentObligation.create({
              data: {
                orderId: parsedOrderId,
                description: obs.description,
                amount: parseFloat(obs.amount) || 0,
                isManual: true,
                createdAt: new Date(obs.createdAt)
              }
            });
          }
        }
      }

      // 4. Process payments
      if (data.payments && Array.isArray(data.payments)) {
        for (const p of data.payments) {
          if (p.id) {
            await tx.payment.update({
              where: { id: p.id },
              data: {
                isDeleted: p.isDeleted,
                paymentMethod: p.paymentMethod,
                notes: p.notes,
                amount: parseFloat(p.amount) || 0
              }
            });
          } else if (p.isNew) {
            await tx.payment.create({
              data: {
                orderId: parsedOrderId,
                paymentMethod: p.paymentMethod,
                notes: p.notes,
                amount: parseFloat(p.amount) || 0,
                paymentDate: new Date(p.paymentDate)
              }
            });
          }
        }
      }

      // 5. Record debt approval if provided
      if (data.debtApprovedBy) {
        const currentTotalPaid = data.payments ? data.payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) : 0;
        const currentTotalRequired = data.totalAmount || 0;
        const currentDebt = currentTotalRequired - currentTotalPaid;
        
        await tx.auditLog.create({
          data: {
            entityType: 'Order',
            entityId: parsedOrderId.toString(),
            action: 'DEBT_APPROVED',
            changesJson: JSON.stringify({ approvedDebtAmount: currentDebt }),
            employeeId: data.debtApprovedBy
          }
        });
      }

      return order;
    }, { timeout: 15000 });

    // Recalculate obligations asynchronously after updating order details
    await recalculateOrderObligations(parsedOrderId);
    
    // Fetch the fully updated order to return to the client
    let finalOrder = await prisma.order.findUnique({
      where: { orderId: parsedOrderId },
      include: {
        customer: true
      }
    });
    
    const items = await prisma.orderItem.findMany({
      where: { orderId: parsedOrderId },
      include: { dressItem: { include: { dress: true } } }
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

    const payments = await prisma.payment.findMany({ where: { orderId: parsedOrderId } });
    let obligations = await prisma.paymentObligation.findMany({ where: { orderId: parsedOrderId } });
    
    const priceList = await prisma.priceList.findMany();
    obligations = obligations.map(ob => {
      if (ob.isManual === false || ob.productId) {
         ob.isManual = false;
         if (ob.productId) {
             const prod = priceList.find(p => p.id === ob.productId);
             if (!ob.description) {
                 const matchedItem = itemsWithLogs.find(i => {
                     const cat = i.dressItem?.dress?.priceCategory || '';
                     return prod && (cat === prod.category || cat.replace('כלול ב', '').trim() === prod.category);
                 });
                 ob.description = matchedItem ? matchedItem.description : (prod ? prod.description : 'חיוב מחירון');
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
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order details', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    let parsedOrderId;
    let order;

    if (id.includes('-')) {
      order = await prisma.order.findUnique({
        where: { id }
      });
      if (order) parsedOrderId = order.orderId;
    } else {
      parsedOrderId = parseInt(id);
      if (!isNaN(parsedOrderId)) {
        order = await prisma.order.findUnique({
          where: { orderId: parsedOrderId }
        });
      }
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Check if order can be deleted
    const items = await prisma.orderItem.findMany({
      where: { orderId: parsedOrderId, isDeleted: false }
    });

    const hasRental = items.some(item => item.isTaken || item.isReturned);
    if (hasRental) {
      return NextResponse.json({ error: 'Cannot delete order with rental history' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { orderId: parsedOrderId },
        data: { isDeleted: true }
      });
      await tx.orderItem.updateMany({
        where: { orderId: parsedOrderId },
        data: { isDeleted: true }
      });
      await tx.paymentObligation.updateMany({
        where: { orderId: parsedOrderId },
        data: { isDeleted: true }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}
