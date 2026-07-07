import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { recalculateOrderObligations } from '../../../../../lib/pricingEngine';

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
      // Find an available dressItem for this model and size
      // We check notInUse and inRepair
      const availableItem = await tx.dressItem.findFirst({
        where: {
          dressModelId: itemData.dressModelId,
          sizeText: itemData.sizeText,
          notInUse: false,
          inRepair: false,
        },
        include: {
          orderItems: {
            where: { isDeleted: false, isReturned: false },
            include: { order: true }
          }
        }
      });

      if (!availableItem) {
        throw new Error(`אין פריט פנוי במלאי עבור דגם זה במידה ${itemData.sizeText}`);
      }
      
      // Basic overlap check based on event date if we had the order event date
      const order = await tx.order.findUnique({ where: { orderId: parsedId } });
      if (order && order.eventDate) {
        const orderEventDate = new Date(order.eventDate).setHours(0,0,0,0);
        for (const oi of availableItem.orderItems) {
            if (oi.order && oi.order.eventDate) {
                const existingDate = new Date(oi.order.eventDate).setHours(0,0,0,0);
                if (existingDate === orderEventDate && oi.orderId !== parsedId) {
                    throw new Error(`הפריט נמצא בשימוש בהזמנה אחרת (${oi.orderId}) בתאריך זה`);
                }
            }
        }
      }

      // Create the item
      const newItem = await tx.orderItem.create({
        data: {
          orderId: parsedId,
          dressItemId: availableItem.id,
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
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'OrderItem',
        entityId: { in: itemIds }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const itemsWithLogs = items.map(item => ({
      ...item,
      auditLogs: auditLogs.filter(log => log.entityId === item.id)
    }));

    const payments = await prisma.payment.findMany({ where: { orderId: parsedId } });
    const obligations = await prisma.paymentObligation.findMany({ where: { orderId: parsedId } });
    
    finalOrder = { ...finalOrder, items: itemsWithLogs, payments, obligations };

    return NextResponse.json(finalOrder);

  } catch (error) {
    console.error('Error adding order item:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה בשמירת הפריט' },
      { status: 500 }
    );
  }
}
