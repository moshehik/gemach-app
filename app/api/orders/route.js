import { NextResponse } from 'next/server';

import prisma from '@/app/lib/prisma';
import { recalculateOrderObligations } from '../../../lib/pricingEngine';
import { checkAuth } from '../../../lib/auth';
import { cookies } from 'next/headers';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { validateOrderItemsAvailability } from '../../../lib/inventory';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'eventDate';
    const order = searchParams.get('order') || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const skip = (page - 1) * limit;
    const forRentals = searchParams.get('forRentals') === 'true';

    // Advanced search parameters
    const advCustomerName = searchParams.get('customerName') || '';
    const advCustomerPhone = searchParams.get('customerPhone') || '';
    const advCustomerCity = searchParams.get('customerCity') || '';
    const advOrderId = searchParams.get('advOrderId') || '';
    const advItemDetails = searchParams.get('itemDetails') || '';
    const advModelName = searchParams.get('advModelName') || '';
    const advEventDateFrom = searchParams.get('eventDateFrom') || '';
    const advEventDateTo = searchParams.get('eventDateTo') || '';

    const activeOnly = searchParams.get('activeOnly') === 'true';
    const returnedOnly = searchParams.get('returnedOnly') === 'true';
    const pendingOnly = searchParams.get('pendingOnly') === 'true';

    const excludeArchiveAndPast = searchParams.get('excludeArchiveAndPast') === 'true';
    const archiveAndPastOnly = searchParams.get('archiveAndPastOnly') === 'true';
    const filterStatus = searchParams.get('filterStatus') || 'all';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const where = {
      ...(filterStatus === 'deleted' ? { isDeleted: true } : { isDeleted: false }),
      ...(filterStatus === 'archive' ? { eventDate: { lt: today } } : {}),
      ...(filterStatus === 'soon' ? { OR: [{ eventDate: null }, { eventDate: { gte: today } }] } : {}),
      ...(filterStatus === 'all' && !forRentals && !search && !advOrderId && !advCustomerName && !advCustomerPhone && !advCustomerCity && !advEventDateFrom && !advEventDateTo ? {
        OR: [
          { orderDate: { gte: threeMonthsAgo } },
          { eventDate: { gte: threeMonthsAgo } },
          { eventDate: null }
        ]
      } : {}),
      ...(excludeArchiveAndPast ? {
        OR: [
          { eventDate: null },
          { eventDate: { gte: today } }
        ]
      } : {}),
      ...(filterStatus === 'unpaid' ? {
        OR: [
          { eventDate: null },
          { eventDate: { gte: threeMonthsAgo } }
        ]
      } : {}),
      ...(archiveAndPastOnly ? {
        eventDate: { lt: today }
      } : {}),
      ...(search ? {
        OR: [
          { orderId: isNaN(parseInt(search)) ? undefined : parseInt(search) },
          { customer: { firstName: { contains: search } } },
          { customer: { lastName: { contains: search } } }
        ]
      } : {}),
      ...(advOrderId ? { orderId: parseInt(advOrderId) } : {}),
      ...(advCustomerName ? {
        OR: [
          { customer: { firstName: { contains: advCustomerName } } },
          { customer: { lastName: { contains: advCustomerName } } }
        ]
      } : {}),
      ...(advCustomerPhone ? {
        customer: {
          OR: [
            { phone1: { contains: advCustomerPhone } },
            { phone2: { contains: advCustomerPhone } }
          ]
        }
      } : {}),
      ...(advCustomerCity ? { customer: { city: { contains: advCustomerCity } } } : {}),
      ...(advEventDateFrom || advEventDateTo ? {
        eventDate: {
          ...(advEventDateFrom ? { gte: new Date(advEventDateFrom) } : {}),
          ...(advEventDateTo ? { lte: new Date(advEventDateTo) } : {})
        }
      } : {}),
      ...(pendingOnly ? {
        items: {
          some: {
            isTaken: false,
            isDeleted: false
          }
        }
      } : {}),
      ...(activeOnly ? {
        items: {
          some: {
            isTaken: true,
            isReturned: false,
            isDeleted: false
          }
        }
      } : {}),
      ...(returnedOnly ? {
        items: {
          some: {
            isReturned: true,
            isDeleted: false
          }
        }
      } : {}),
      ...(advItemDetails ? {
        items: {
          some: {
            isDeleted: false,
            OR: [
              { barcode: { contains: advItemDetails } },
              { description: { contains: advItemDetails } },
              { dressItem: { dress: { name: { contains: advItemDetails } } } }
            ]
          }
        }
      } : {}),
      ...(advModelName ? {
        items: {
          some: {
            isDeleted: false,
            dressItem: { dress: { name: { contains: advModelName } } }
          }
        }
      } : {})
    };

    let finalTotalCount = await prisma.order.count({ where });
    let finalOrderIds = [];
    
    // Only use JS memory filtering for 'unpaid' status since it requires complex calculated fields
    // Default sorting (eventDate) and other filters now use native database pagination and indexing
    if (filterStatus === 'unpaid' || filterStatus === 'unpaid_all') {
      const minimalSelect = {
        orderId: true,
        eventDate: true,
        totalAmount: true,
        payments: { select: { amount: true, isDeleted: true } }
      };

      const minimalOrders = await prisma.order.findMany({
        where,
        select: minimalSelect,
        orderBy: { eventDate: { sort: 'desc', nulls: 'last' } }
      });

      let minimalFormatted = minimalOrders.map(o => {
        const calculatedTotalAmount = o.totalAmount || 0;
        const totalPaid = o.payments?.reduce((sum, p) => sum + (p.isDeleted ? 0 : p.amount), 0) || 0;
        return {
          orderId: o.orderId,
          eventDate: o.eventDate,
          totalAmount: calculatedTotalAmount,
          totalPaid
        };
      });

      if (filterStatus === 'unpaid' || filterStatus === 'unpaid_all') {
        minimalFormatted = minimalFormatted.filter(o => o.totalPaid < o.totalAmount && o.totalAmount > 0);
      }

      finalTotalCount = minimalFormatted.length;
      finalOrderIds = minimalFormatted.slice(skip, skip + limit).map(o => o.orderId);
    }

    const fullOrdersWhere = (filterStatus === 'unpaid' || filterStatus === 'unpaid_all') 
      ? { orderId: { in: finalOrderIds } } 
      : where;

    const orders = await prisma.order.findMany({
      where: fullOrdersWhere,
      include: {
        customer: true,
        payments: !forRentals,
        obligations: !forRentals,
        items: {
          select: {
            id: true,
            barcodePrefix: true,
            sizeText: true,
            description: true,
            price: true,
            isTaken: true,
            isReturned: true,
            isDeleted: true,
            neckAlteration: true,
            sleeveAlteration: true,
            lengthAlteration: true,
            alterationDetails: true,
            dressItemId: true,
            dressItem: {
              select: {
                barcodePrefix: true,
                sizeText: true,
                dress: {
                  select: { id: true, name: true, barcodePrefix: true }
                }
              }
            }
          }
        }
      },
      orderBy: (filterStatus === 'unpaid' || filterStatus === 'unpaid_all') ? undefined : 
        (sort === 'eventDate' ? { eventDate: { sort: order, nulls: 'last' } } : 
        (sort === 'customerName' ? { customer: { firstName: order } } : { [sort]: order })),
      ...((filterStatus === 'unpaid' || filterStatus === 'unpaid_all') ? {} : { skip, take: limit })
    });

    // Restore the correct sort order for unpaid since the IN clause doesn't guarantee order
    let sortedOrders = orders;
    if (filterStatus === 'unpaid' || filterStatus === 'unpaid_all') {
      const orderIdIndexMap = new Map(finalOrderIds.map((id, index) => [id, index]));
      sortedOrders = orders.sort((a, b) => orderIdIndexMap.get(a.orderId) - orderIdIndexMap.get(b.orderId));
    }

    // Optimize: Only fetch dress models for prefixes that are missing names in the current page
    const uniquePrefixes = new Set();
    sortedOrders.forEach(order => {
      order.items.forEach(i => {
        const dressName = i.dressItem?.dress?.name;
        const prefix = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
        if (!dressName && prefix) {
          uniquePrefixes.add(parseInt(prefix, 10));
        }
      });
    });

    let dressModels = [];
    if (uniquePrefixes.size > 0) {
      dressModels = await prisma.dressModel.findMany({
        where: { barcodePrefix: { in: Array.from(uniquePrefixes) } },
        select: { barcodePrefix: true, name: true }
      });
    }
    
    const dressModelMap = new Map(dressModels.filter(m => m.barcodePrefix).map(m => [m.barcodePrefix, m.name]));

    const formattedOrders = sortedOrders.map(order => {
      const calculatedTotalAmount = order.obligations?.length > 0 
        ? order.obligations.reduce((sum, o) => sum + (o.isDeleted ? 0 : o.amount), 0) 
        : (order.totalAmount || 0);

      return {
        orderId: order.orderId,
        customerId: order.customerId,
        totalAmount: calculatedTotalAmount,
        totalPaid: order.payments?.reduce((sum, p) => sum + (p.isDeleted ? 0 : p.amount), 0) || 0,
        paymentDate: order.paymentDate,
        paymentMethod: order.paymentMethod,
        status: order.status || (order.paymentDate ? 'שולם' : 'ממתין לתשלום'),
        notes: order.notes,
        eventDate: order.eventDate,
        eventDateHebrew: order.eventDateHebrew,
        returnDate: order.returnDate,
        isAbroad: order.isAbroad,
        fromDate: order.fromDate,
        toDate: order.toDate,
        items: order.items.map(i => {
          let dressName = i.dressItem?.dress?.name;
          const prefix = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
          if (!dressName && prefix) {
            dressName = dressModelMap.get(parseInt(prefix, 10));
          }
          
          return {
            id: i.id,
            dressId: i.dressItem?.dress?.id,
            itemId: i.dressItemId,
            description: dressName ? `${dressName} (קוד: ${prefix || ''}, מידה: ${i.sizeText || i.dressItem?.sizeText || ''})` : (i.description || 'פריט כללי'),
            price: i.price,
            isTaken: i.isTaken,
            isReturned: i.isReturned,
            isDeleted: i.isDeleted,
            neckAlteration: i.neckAlteration,
            sleeveAlteration: i.sleeveAlteration,
            lengthAlteration: i.lengthAlteration,
            alterationDetails: i.alterationDetails
          };
        }),
        customerName: order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : 'לא ידוע',
        customerPhone: order.customer ? (order.customer.phone1 || order.customer.phone2 || '') : ''
      };
    });

    let finalFormatted = formattedOrders;

    return NextResponse.json({
      data: finalFormatted,
      total: finalTotalCount,
      page,
      limit,
      totalPages: Math.ceil(finalTotalCount / limit)
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const data = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    const loggedInEmployeeId = token?.value || null;

    // Generate next orderId
    const maxOrder = await prisma.order.findFirst({
      orderBy: { orderId: 'desc' }
    });
    const nextOrderId = maxOrder ? maxOrder.orderId + 1 : 1;

    // Validate inventory availability
    if (data.items && data.items.length > 0) {
      const validationResult = await validateOrderItemsAvailability(
        data.items,
        data.eventDate,
        data.isAbroad,
        data.fromDate,
        data.toDate,
        null // orderId
      );

      if (validationResult.error) {
        return NextResponse.json({ error: validationResult.error }, { status: 400 });
      }
      
      if (!validationResult.valid) {
        return NextResponse.json({
          error: 'אחד או יותר מהפריטים שניסית להזמין כבר נתפסו לאחרונה על ידי הזמנה אחרת בתאריכים אלו.',
          validationErrors: validationResult.errors
        }, { status: 409 });
      }
    }

    const order = await prisma.order.create({
      data: {
        orderId: data.orderId || nextOrderId,
        customerId: data.customerId || null,
        totalAmount: data.totalAmount ? parseFloat(data.totalAmount) : null,
        orderDate: new Date(),
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        eventDateHebrew: data.eventDateHebrew || (data.eventDate ? getHebrewDateString(data.eventDate) : null),
        returnDate: data.returnDate ? new Date(data.returnDate) : null,
        employeeId: data.employeeId || loggedInEmployeeId || null,
        isAbroad: data.isAbroad ?? false,
        isWeekdayEvent: data.isWeekdayEvent ?? false,
        fromDate: data.fromDate ? new Date(data.fromDate) : null,
        toDate: data.toDate ? new Date(data.toDate) : null,
        notes: data.notes || '',
        status: data.payment?.amount >= data.totalAmount ? 'שולם' : (data.payment?.amount > 0 ? 'שולם חלקי' : (data.status || 'חדש')),
        items: {
          create: data.items?.map(item => ({
            dressItemId: item.sampleItemId,
            sizeText: item.sizeText,
            quantity: item.quantity || 1,
            basePrice: item.basePrice ? parseFloat(item.basePrice) : 0,
            finalPrice: item.finalPrice ? parseFloat(item.finalPrice) : 0,
            repairs: item.repairs || '',
            neckAlteration: item.neckAlteration ? 1 : 0,
            sleeveAlteration: item.sleeveAlteration ? 1 : 0,
            lengthAlteration: item.lengthAlteration ? String(item.lengthAlteration) : '',
            alterationDetails: item.repairs || ''
          })) || []
        },
        // Note: Obligations will be generated by the pricing engine
        ...(data.payment && (data.payment.amount > 0 || data.payment.method === 'יציאה באישור מנהל') ? {
          payments: {
            create: [{
              amount: parseFloat(data.payment.amount),
              paymentMethod: data.payment.method,
              notes: data.payment.notes || '',
              customerId: data.customerId ? data.customerId : null
            }]
          }
        } : {})
      }
    });

    // Run pricing engine to generate obligations
    await recalculateOrderObligations(order.orderId);

    const updatedOrder = await prisma.order.findUnique({
      where: { orderId: order.orderId },
      include: {
        items: true,
        obligations: true,
        payments: true
      }
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order', details: error.message },
      { status: 500 }
    );
  }
}
