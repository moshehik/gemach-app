import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { recalculateOrderObligations } from '../../../lib/pricingEngine';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'orderId';
    const order = searchParams.get('order') || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const skip = (page - 1) * limit;

    // Advanced search parameters
    const advCustomerName = searchParams.get('customerName') || '';
    const advCustomerPhone = searchParams.get('customerPhone') || '';
    const advCustomerCity = searchParams.get('customerCity') || '';
    const advOrderId = searchParams.get('advOrderId') || '';
    const advItemDetails = searchParams.get('itemDetails') || '';
    const advEventDateFrom = searchParams.get('eventDateFrom') || '';
    const advEventDateTo = searchParams.get('eventDateTo') || '';

    const activeOnly = searchParams.get('activeOnly') === 'true';
    const returnedOnly = searchParams.get('returnedOnly') === 'true';
    const pendingOnly = searchParams.get('pendingOnly') === 'true';

    const excludeArchiveAndPast = searchParams.get('excludeArchiveAndPast') === 'true';
    const archiveAndPastOnly = searchParams.get('archiveAndPastOnly') === 'true';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where = {
      ...(excludeArchiveAndPast ? {
        OR: [
          { eventDate: null },
          { eventDate: { gte: today } }
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
      } : {})
    };

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        payments: true,
        obligations: true,
        items: {
          include: {
            dressItem: {
              include: {
                dress: true
              }
            }
          }
        }
      },
      orderBy: { [sort]: order },
      skip,
      take: limit
    });
    
    const totalCount = await prisma.order.count({ where });

    const formattedOrders = orders.map(order => {
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
      items: order.items.map(i => ({
        id: i.id,
        dressId: i.dressItem?.dress?.id,
        itemId: i.dressItemId,
        description: i.dressItem?.dress?.name ? `${i.dressItem.dress.name} (קוד: ${i.dressItem.dress.barcodePrefix || i.dressItem.barcodePrefix || ''}, מידה: ${i.sizeText || i.dressItem.sizeText || ''})` : (i.description || 'פריט כללי'),
        price: i.price,
        isTaken: i.isTaken,
        isReturned: i.isReturned,
        isDeleted: i.isDeleted
      })),
      customerName: order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : 'לא ידוע'
    };
    });

    return NextResponse.json({
      data: formattedOrders,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();

    // Generate next orderId
    const maxOrder = await prisma.order.findFirst({
      orderBy: { orderId: 'desc' }
    });
    const nextOrderId = maxOrder ? maxOrder.orderId + 1 : 1;

    const order = await prisma.order.create({
      data: {
        orderId: data.orderId || nextOrderId,
        customerId: data.customerId ? parseInt(data.customerId) : null,
        totalAmount: data.totalAmount ? parseFloat(data.totalAmount) : null,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        eventDateHebrew: data.eventDateHebrew || null,
        returnDate: data.returnDate ? new Date(data.returnDate) : null,
        isWeekdayEvent: data.isWeekdayEvent ?? true,
        isAbroad: data.isAbroad ?? false,
        fromDate: data.fromDate ? new Date(data.fromDate) : null,
        toDate: data.toDate ? new Date(data.toDate) : null,
        notes: data.notes || '',
        status: data.payment?.amount >= data.totalAmount ? 'שולם' : (data.payment?.amount > 0 ? 'שולם חלקי' : (data.status || 'חדש')),
        items: {
          create: data.items?.map(item => ({
            dressItemId: parseInt(item.sampleItemId),
            sizeText: item.sizeText,
            quantity: item.quantity || 1,
            basePrice: item.basePrice ? parseFloat(item.basePrice) : 0,
            finalPrice: item.finalPrice ? parseFloat(item.finalPrice) : 0,
            repairs: item.repairs || '',
            neckAlteration: item.neckAlteration ? 1 : 0,
            sleeveAlteration: item.sleeveAlteration ? 1 : 0,
            lengthAlteration: item.lengthAlteration || '',
            alterationDetails: item.repairs || ''
          })) || []
        },
        // Note: Obligations will be generated by the pricing engine
        ...(data.payment && data.payment.amount > 0 ? {
          payments: {
            create: [{
              amount: parseFloat(data.payment.amount),
              paymentMethod: data.payment.method,
              notes: data.payment.notes || '',
              customerId: data.customerId ? parseInt(data.customerId) : null
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
