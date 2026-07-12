import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export const dynamic = 'force-dynamic';
import { recalculateOrderObligations } from '../../../../lib/pricingEngine';

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }
    
    let order = await prisma.order.findUnique({
      where: { orderId: parsedId },
      include: {
        customer: true
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Workaround for schema relation pointing to Order.id instead of Order.orderId
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

    obligations = obligations.map(ob => {
      if (ob.isManual === false || ob.productId) {
         ob.isManual = false;
         if (ob.productId) {
             const prod = priceList.find(p => p.id === ob.productId);
             if (!ob.description) ob.description = prod ? prod.description : 'חיוב מחירון';
             ob.productName = prod ? (prod.description || prod.category || 'חיוב מחירון') : 'חיוב אוטומטי';
             if (prod) {
                 ob.priceCategory = prod.category;
                 ob.priceDescription = prod.description;
             }
         } else if (ob.description && ob.description.includes('תיקון')) {
             ob.productName = 'תיקון';
         } else if (ob.description && ob.description.includes('דמי ביטול')) {
             ob.productName = 'דמי ביטול';
         } else if (ob.description && ob.description.includes('זיכוי')) {
             ob.productName = 'זיכוי';
         } else {
             ob.productName = 'חיוב אוטומטי';
         }
      } else {
         ob.productName = ob.description ? ob.description : 'חיוב ידני';
      }
      return ob;
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
      
      if (!dressName && prefix && item.dressItemId) {
        dressName = dressModelMap.get(prefix);
      }
      
      let finalDescription = item.description || 'פריט כללי';
      if (dressName) {
        finalDescription = `${dressName} (קוד: ${prefix || ''})`;
      } else if (item.dressItemId && item.description) {
        finalDescription = item.description;
      } else if (item.description) {
        finalDescription = item.description;
      }
      
      return {
        ...item,
        description: finalDescription
      };
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
    
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }
    
    const data = await request.json();

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update general order details
      const order = await tx.order.update({
        where: { orderId: parsedId },
        data: {
          totalAmount: data.totalAmount,
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
                neckAlteration: item.neckAlteration !== undefined && item.neckAlteration !== null ? parseInt(item.neckAlteration) : null,
                sleeveAlteration: item.sleeveAlteration !== undefined && item.sleeveAlteration !== null ? parseInt(item.sleeveAlteration) : null,
                lengthAlteration: item.lengthAlteration !== undefined ? String(item.lengthAlteration) : null,
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
                  orderId: parsedId,
                  dressItemId: availableItem.id,
                  sizeText: item.sizeText,
                  quantity: 1,
                  neckAlteration: item.neckAlteration ? parseInt(item.neckAlteration) : null,
                  sleeveAlteration: item.sleeveAlteration ? parseInt(item.sleeveAlteration) : null,
                  lengthAlteration: item.lengthAlteration,
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
                amount: parseFloat(obs.amount)
              }
            });
          } else if (obs.isNew) {
            await tx.paymentObligation.create({
              data: {
                orderId: parsedId,
                description: obs.description,
                amount: parseFloat(obs.amount),
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
                amount: parseFloat(p.amount)
              }
            });
          } else if (p.isNew) {
            await tx.payment.create({
              data: {
                orderId: parsedId,
                paymentMethod: p.paymentMethod,
                notes: p.notes,
                amount: parseFloat(p.amount),
                paymentDate: new Date(p.paymentDate)
              }
            });
          }
        }
      }

      return order;
    });

    // Recalculate obligations asynchronously after updating order details
    await recalculateOrderObligations(parsedId);
    
    // Fetch the fully updated order to return to the client
    let finalOrder = await prisma.order.findUnique({
      where: { orderId: parsedId },
      include: {
        customer: true
      }
    });
    
    const items = await prisma.orderItem.findMany({
      where: { orderId: parsedId },
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
      
      if (!dressName && prefix && item.dressItemId) {
        dressName = dressModelMap.get(prefix);
      }
      
      let finalDescription = item.description || 'פריט כללי';
      if (dressName) {
        finalDescription = `${dressName} (קוד: ${prefix || ''})`;
      } else if (item.dressItemId && item.description) {
        finalDescription = item.description;
      } else if (item.description) {
        finalDescription = item.description;
      }
      
      return {
        ...item,
        description: finalDescription
      };
    });

    const payments = await prisma.payment.findMany({ where: { orderId: parsedId } });
    let obligations = await prisma.paymentObligation.findMany({ where: { orderId: parsedId } });
    
    const priceList = await prisma.priceList.findMany();
    obligations = obligations.map(ob => {
      if (ob.isManual === false || ob.productId) {
         ob.isManual = false;
         if (ob.productId) {
             const prod = priceList.find(p => p.id === ob.productId);
             if (!ob.description) ob.description = prod ? prod.description : 'חיוב מחירון';
             ob.productName = prod ? (prod.description || prod.category || 'חיוב מחירון') : 'חיוב אוטומטי';
             if (prod) {
                 ob.priceCategory = prod.category;
                 ob.priceDescription = prod.description;
             }
         } else if (ob.description && ob.description.includes('תיקון')) {
             ob.productName = 'תיקון';
         } else if (ob.description && ob.description.includes('דמי ביטול')) {
             ob.productName = 'דמי ביטול';
         } else if (ob.description && ob.description.includes('זיכוי')) {
             ob.productName = 'זיכוי';
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
      { error: 'Failed to update order details' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }
    
    // Check if order can be deleted
    const items = await prisma.orderItem.findMany({
      where: { orderId: parsedId, isDeleted: false }
    });

    const hasRental = items.some(item => item.isTaken || item.isReturned);
    if (hasRental) {
      return NextResponse.json({ error: 'Cannot delete order with rental history' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { orderId: parsedId },
        data: { isDeleted: true }
      });
      await tx.orderItem.updateMany({
        where: { orderId: parsedId },
        data: { isDeleted: true }
      });
      await tx.paymentObligation.updateMany({
        where: { orderId: parsedId },
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
