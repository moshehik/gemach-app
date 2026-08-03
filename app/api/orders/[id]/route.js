import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export const dynamic = 'force-dynamic';
import { recalculateOrderObligations, computeOrderObligations } from '../../../../lib/pricingEngine';
import { getHebrewDateString } from '../../../../lib/hebrewDate';
import { validateOrderItemsAvailability } from '../../../../lib/inventory';

const RECALC_SETTING_KEYS = [
  'REFUND_DAYS_FROM_ORDER',
  'NO_REFUND_DAYS_BEFORE_EVENT',
  'REFUND_PERCENTAGE',
  'REFUND_REPAIRS',
  'ENABLE_SET_DISCOUNTS'
];

export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    let parsedOrderId;
    let order;

    if (id.includes('-')) {
      order = await prisma.order.findUnique({
        where: { id },
        include: { customer: true, employee: true }
      });
      if (order) parsedOrderId = order.orderId;
    } else {
      parsedOrderId = parseInt(id);
      if (!isNaN(parsedOrderId)) {
        order = await prisma.order.findUnique({
          where: { orderId: parsedOrderId },
          include: { customer: true, employee: true }
        });
      }
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Workaround for schema relation pointing to Order.id instead of Order.orderId
    // These queries are independent of each other - fetch them concurrently instead of one at a time.
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
      prisma.priceList.findMany(),
      prisma.paymentObligation.findMany({ where: { orderId: parsedOrderId } }),
      prisma.systemSetting.findMany({ where: { key: { in: RECALC_SETTING_KEYS } } })
    ]);

    let obligations = obligationsRaw;

    // Add draft obligations for pending items - computed in-memory from data already
    // fetched above, instead of triggering a second full order+items+priceList fetch.
    try {
      const { newObligations } = computeOrderObligations({
        order,
        items: items.filter(i => !i.isDeleted),
        deletedItems: items.filter(i => i.isDeleted),
        priceList,
        settings
      });
      const drafts = newObligations.filter(o => o.isDraft);
      obligations = [...obligations, ...drafts];
    } catch (e) {
      console.error("Error generating draft obligations:", e);
    }

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

    const eventDate = order.eventDate;
    const fallbackReturn = order.returnDate || (eventDate ? new Date(new Date(eventDate).getTime() + 2 * 24 * 3600 * 1000) : null);
    const fallbackTaken = eventDate || order.orderDate;

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

      const isTaken = item.isTaken || item.barcode !== null || item.takenDate !== null;
      const isReturned = item.isReturned || item.returnDate !== null;
      const takenDate = item.takenDate || (isTaken ? fallbackTaken : null);
      const returnDate = item.returnDate || (isReturned ? fallbackReturn : null);
      
      return {
        ...item,
        description: finalDescription,
        isTaken,
        isReturned,
        takenDate,
        returnDate
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

    order = {
      ...order,
      items: itemsWithLogs,
      payments,
      obligations,
      refunds
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

function parseSafeDate(val) {
  if (val === undefined) return undefined;
  if (!val || val === 'null' || val === 'undefined') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Keep this in sync with app/api/orders/route.js and app/api/orders/draft/route.js,
    // which parse date-only strings ("YYYY-MM-DD") as UTC midnight via `new Date(str)`.
    // Appending a local "T00:00:00" here previously shifted saved dates back by the
    // server's UTC offset (Asia/Jerusalem), storing the wrong calendar day for edited orders.
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
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

    // Validate inventory availability
    if (data.items && Array.isArray(data.items)) {
      const activeItems = data.items.filter(i => !i.isDeleted);
      if (activeItems.length > 0) {
        const idsNeedingLookup = activeItems
          .filter(item => !item.dressModelId && !item.isNew && item.id)
          .map(item => item.id);

        if (idsNeedingLookup.length > 0) {
          const currentItems = await prisma.orderItem.findMany({
            where: { id: { in: idsNeedingLookup } },
            include: { dressItem: true }
          });
          const currentItemById = new Map(currentItems.map(ci => [ci.id, ci]));

          for (const item of activeItems) {
            if (!item.dressModelId && !item.isNew && item.id) {
              const currentItem = currentItemById.get(item.id);
              if (currentItem && currentItem.dressItem) {
                item.dressModelId = currentItem.dressItem.dressModelId;
                item.sizeText = item.sizeText || currentItem.sizeText || currentItem.dressItem.sizeText;
              }
            }
          }
        }

        const isAbroadVal = data.isAbroad !== undefined ? data.isAbroad : existingOrder.isAbroad;
        const isWeekdayVal = data.isWeekdayEvent !== undefined ? data.isWeekdayEvent : existingOrder.isWeekdayEvent;
        const isCustomDuration = isAbroadVal || isWeekdayVal;
        const eventDateVal = data.eventDate !== undefined ? parseSafeDate(data.eventDate) : existingOrder.eventDate;
        const fromDateVal = data.fromDate !== undefined ? parseSafeDate(data.fromDate) : existingOrder.fromDate;
        const toDateVal = data.toDate !== undefined ? parseSafeDate(data.toDate) : existingOrder.toDate;

        const hasDatesVal = isCustomDuration ? (fromDateVal && toDateVal) : !!eventDateVal;

        if (hasDatesVal) {
          const validationResult = await validateOrderItemsAvailability(
            activeItems,
            eventDateVal,
            isCustomDuration,
            fromDateVal,
            toDateVal,
            parsedOrderId
          );

          if (validationResult.error) {
            return NextResponse.json({ error: validationResult.error }, { status: 400 });
          }
          
          if (!validationResult.valid) {
            return NextResponse.json({
              error: 'אחד או יותר מהפריטים שניסית לעדכן אינם זמינים במלאי בתאריכים החדשים.',
              validationErrors: validationResult.errors
            }, { status: 409 });
          }
        }
      }
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const parsedEventDate = parseSafeDate(data.eventDate);
      const parsedFromDate = parseSafeDate(data.fromDate);
      const parsedToDate = parseSafeDate(data.toDate);
      const parsedReturnDate = parseSafeDate(data.returnDate);

      // 1. Update general order details
      const order = await tx.order.update({
        where: { orderId: parsedOrderId },
        data: {
          totalAmount: data.totalAmount !== undefined && data.totalAmount !== null ? (parseFloat(data.totalAmount) || 0) : undefined,
          eventDate: parsedEventDate,
          eventDateHebrew: data.eventDateHebrew !== undefined ? data.eventDateHebrew : (parsedEventDate ? getHebrewDateString(parsedEventDate) : undefined),
          returnDate: parsedReturnDate,
          isAbroad: data.isAbroad !== undefined ? data.isAbroad : undefined,
          isWeekdayEvent: data.isWeekdayEvent !== undefined ? data.isWeekdayEvent : undefined,
          fromDate: parsedFromDate,
          toDate: parsedToDate,
          notes: data.notes !== undefined ? data.notes : undefined,
          status: data.status !== undefined ? data.status : undefined,
          hasSignedRegulations: data.hasSignedRegulations !== undefined ? data.hasSignedRegulations : undefined,
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
                isDeleted: item.isDeleted,
                isTaken: item.isTaken,
                isReturned: item.isReturned,
                takenDate: item.takenDate ? new Date(item.takenDate) : null,
                returnDate: item.returnDate ? new Date(item.returnDate) : null,
                barcode: item.barcode || item.dressItem?.barcode || undefined,
                cartStatus: 'confirmed'
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
                  cartStatus: 'confirmed',
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

    // Fetch the fully updated order to return to the client.
    // These queries are independent of each other - fetch them concurrently.
    const [finalOrderRaw, items, payments, refunds, obligationsRaw, priceList] = await Promise.all([
      prisma.order.findUnique({
        where: { orderId: parsedOrderId },
        include: {
          customer: true,
          employee: true
        }
      }),
      prisma.orderItem.findMany({
        where: { orderId: parsedOrderId },
        include: { dressItem: { include: { dress: true } } }
      }),
      prisma.payment.findMany({ where: { orderId: parsedOrderId } }),
      prisma.refund.findMany({ where: { orderId: parsedOrderId } }),
      prisma.paymentObligation.findMany({ where: { orderId: parsedOrderId } }),
      prisma.priceList.findMany()
    ]);

    let finalOrder = finalOrderRaw;
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
    
    const eventDatePUT = finalOrder.eventDate;
    const fallbackReturnPUT = finalOrder.returnDate || (eventDatePUT ? new Date(new Date(eventDatePUT).getTime() + 2 * 24 * 3600 * 1000) : null);
    const fallbackTakenPUT = eventDatePUT || finalOrder.orderDate;

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

      const isTaken = item.isTaken || item.barcode !== null || item.takenDate !== null;
      const isReturned = item.isReturned || item.returnDate !== null;
      const takenDate = item.takenDate || (isTaken ? fallbackTakenPUT : null);
      const returnDate = item.returnDate || (isReturned ? fallbackReturnPUT : null);
      
      return {
        ...item,
        description: finalDescription,
        isTaken,
        isReturned,
        takenDate,
        returnDate
      };
    });

    const payments = await prisma.payment.findMany({ where: { orderId: parsedOrderId } });
    const refunds = await prisma.refund.findMany({ where: { orderId: parsedOrderId } });
    let obligations = await prisma.paymentObligation.findMany({ where: { orderId: parsedOrderId } });
    
    const priceList = await prisma.priceList.findMany();
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
    
    finalOrder = { ...finalOrder, items: itemsWithLogs, payments, obligations, refunds };

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
