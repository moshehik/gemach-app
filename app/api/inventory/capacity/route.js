import { NextResponse } from 'next/server';
import prisma from '../../../../app/lib/prisma';
import { checkAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const barcodePrefixParam = searchParams.get('barcodePrefix');
    const size = searchParams.get('size');
    const fromDateParam = searchParams.get('fromDate');
    const toDateParam = searchParams.get('toDate');

    if (!barcodePrefixParam || !size || !fromDateParam || !toDateParam) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const barcodePrefix = parseInt(barcodePrefixParam, 10);
    // Adjust boundaries by 12 hours to safely cover timezone differences (Israel time is UTC+2 or UTC+3)
    const fromDateLimit = new Date(new Date(fromDateParam).getTime() - 12 * 60 * 60 * 1000);
    const toDateLimit = new Date(new Date(toDateParam).getTime() + 12 * 60 * 60 * 1000);

    // 1. In Stock (במלאי)
    // "ללא רזרבה ורק בשימוש" = location != 'רזרבה', notInUse == false, inRepair == false
    const inStockItems = await prisma.dressItem.findMany({
      where: {
        barcodePrefix,
        sizeText: size,
        isDeleted: false,
        notInUse: false,
        inRepair: false,
        OR: [
          { location: null },
          {
            AND: [
              { location: { not: { contains: 'מחסן' } } },
              { location: { not: { contains: 'רזרבה' } } },
              { location: { not: { contains: 'warehouse' } } },
              { location: { not: { contains: 'reserve' } } }
            ]
          }
        ]
      },
      select: { quantity: true }
    });
    const inStock = inStockItems.reduce((acc, item) => acc + (item.quantity || 1), 0);

    // 2. Reserve (רזרבה)
    const reserveItems = await prisma.dressItem.findMany({
      where: {
        barcodePrefix,
        sizeText: size,
        isDeleted: false,
        notInUse: false,
        inRepair: false,
        OR: [
          { location: { contains: 'רזרבה' } },
          { location: { contains: 'reserve' } }
        ]
      },
      select: { quantity: true }
    });
    const reserve = reserveItems.reduce((acc, item) => acc + (item.quantity || 1), 0);

    // 3. Occupied (בתפוסה)
    // Find all OrderItems for this barcode + size where Order date overlaps with requested range
    const occupiedOrdersList = await prisma.orderItem.findMany({
      where: {
        OR: [
          {
            barcodePrefix: barcodePrefix,
            size: size
          },
          {
            barcodePrefix: barcodePrefix,
            sizeText: size
          },
          {
            dressItem: {
              barcodePrefix: barcodePrefix,
              sizeText: size
            }
          }
        ],
        isDeleted: false,
        order: {
          isDeleted: false,
          eventDate: {
            lte: toDateLimit, // StartA <= EndB
          },
        }
      },
      select: {
        quantity: true,
        order: {
          select: {
            id: true,
            orderId: true,
            eventDate: true,
            returnDate: true,
            eventDateHebrew: true,
            customer: { select: { firstName: true, lastName: true } }
          }
        }
      }
    });

    // We must manually filter the OR condition for returnDate/eventDate because of the null coalesce logic
    // StartA <= EndB (eventDate <= toDate) is handled by Prisma.
    // EndA >= StartB (returnDate || eventDate) >= fromDate:
    const validOccupiedOrders = occupiedOrdersList.filter(item => {
      const order = item.order;
      if (!order) return false;
      const endDate = order.returnDate || order.eventDate;
      if (!endDate) return false;
      return endDate >= fromDateLimit;
    });

    const occupiedCount = validOccupiedOrders.reduce((acc, item) => acc + (item.quantity || 1), 0);

    // Prepare data for UI (grouped by orderId to sum quantity of identical items in same order)
    const groupedOrdersMap = new Map();
    validOccupiedOrders.forEach(item => {
      const orderId = item.order.orderId;
      const quantity = item.quantity || 1;
      
      if (groupedOrdersMap.has(orderId)) {
        groupedOrdersMap.get(orderId).quantity += quantity;
      } else {
        groupedOrdersMap.set(orderId, {
          id: orderId,
          orderId: orderId,
          internalOrderId: item.order.id,
          customerName: item.order.customer ? `${item.order.customer.firstName || ''} ${item.order.customer.lastName || ''}`.trim() : 'לא ידוע',
          eventDate: item.order.eventDate,
          returnDate: item.order.returnDate,
          eventDateHebrew: item.order.eventDateHebrew,
          quantity: quantity
        });
      }
    });
    
    const occupiedOrders = Array.from(groupedOrdersMap.values());

    return NextResponse.json({
      inStock,
      reserve,
      occupiedCount,
      occupiedOrders
    });

  } catch (error) {
    console.error('Error fetching capacity:', error);
    return NextResponse.json({ error: 'Failed to fetch capacity' }, { status: 500 });
  }
}
