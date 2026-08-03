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

    const itemStatuses = [];
    if (pendingOnly) {
      itemStatuses.push({ isTaken: false, isDeleted: false });
    }
    if (activeOnly) {
      itemStatuses.push({ isTaken: true, isReturned: false, isDeleted: false });
    }
    if (returnedOnly) {
      itemStatuses.push({ isReturned: true, isDeleted: false });
    }

    const where = {
      ...(filterStatus === 'deleted' ? { isDeleted: true } : { isDeleted: false }),
      ...(filterStatus === 'archive' ? { eventDate: { lt: today } } : {}),
      ...(filterStatus === 'soon' ? { OR: [{ eventDate: null }, { eventDate: { gte: today } }] } : {}),
      ...(filterStatus === 'all' && !forRentals && !search && !advOrderId && !advCustomerName && !advCustomerPhone && !advCustomerCity && !advEventDateFrom && !advEventDateTo ? {
        OR: [
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
          { customer: { lastName: { contains: search } } },
          { items: { some: { isDeleted: false, dressItem: { dress: { name: { contains: search } } } } } }
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
      ...(itemStatuses.length > 0 || advItemDetails || advModelName ? {
        items: {
          some: {
            AND: [
              ...(itemStatuses.length > 0 ? [{ OR: itemStatuses }] : []),
              ...(advItemDetails ? [{
                isDeleted: false,
                OR: [
                  { barcode: { contains: advItemDetails } },
                  { description: { contains: advItemDetails } },
                  { dressItem: { dress: { name: { contains: advItemDetails } } } }
                ]
              }] : []),
              ...(advModelName ? [{
                isDeleted: false,
                dressItem: { dress: { name: { contains: advModelName } } }
              }] : [])
            ]
          }
        }
      } : {})
    };

    let finalTotalCount = 0;
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
        orderBy: { eventDate: { sort: 'desc', nulls: 'last' } },
        take: 500
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

    // Fetch orders and (for non-unpaid path) count in parallel instead of sequentially
    let orders, totalCountNonUnpaid;
    if (filterStatus === 'unpaid' || filterStatus === 'unpaid_all') {
      orders = await prisma.order.findMany({
        where: fullOrdersWhere,
        select: {
          orderId: true,
          legacyId: true,
          customerId: true,
          totalAmount: true,
          paymentDate: true,
          paymentMethod: true,
          status: true,
          notes: true,
          eventDate: true,
          eventDateHebrew: true,
          returnDate: true,
          isAbroad: true,
          fromDate: true,
          toDate: true,
          customSpacing: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
              phone1: true,
              phone2: true
            }
          },
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
              barcode: true,
              cartStatus: true,
              cartStatusDate: true,
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
        orderBy: undefined
      });
    } else {
      [orders, totalCountNonUnpaid] = await Promise.all([
        prisma.order.findMany({
      where: fullOrdersWhere,
      select: {
        orderId: true,
        legacyId: true,
        customerId: true,
        totalAmount: true,
        paymentDate: true,
        paymentMethod: true,
        status: true,
        notes: true,
        eventDate: true,
        eventDateHebrew: true,
        returnDate: true,
        isAbroad: true,
        fromDate: true,
        toDate: true,
        customSpacing: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phone1: true,
            phone2: true
          }
        },
        payments: forRentals ? false : { select: { amount: true, isDeleted: true } },
        obligations: forRentals ? false : { select: { amount: true, isDeleted: true } },
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
            barcode: true,
            cartStatus: true,
            cartStatusDate: true,
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
        orderBy: (sort === 'eventDate' ? { eventDate: { sort: order, nulls: 'last' } } :
          (sort === 'customerName' ? { customer: { firstName: order } } : { [sort]: order })),
        skip, take: limit
        }),
        prisma.order.count({ where: fullOrdersWhere })
      ]);
      finalTotalCount = totalCountNonUnpaid;
    }

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
        if (!dressName && prefix !== null && prefix !== undefined) {
          const numPfx = parseInt(prefix, 10);
          if (!isNaN(numPfx)) uniquePrefixes.add(numPfx);
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
    
    const dressModelMap = new Map();
    dressModels.forEach(m => {
      if (m.barcodePrefix !== null && m.barcodePrefix !== undefined) {
        dressModelMap.set(Number(m.barcodePrefix), m.name);
        dressModelMap.set(String(m.barcodePrefix), m.name);
      }
    });

    const formattedOrders = sortedOrders.map(order => {
      const obligationsSum = order.obligations?.reduce((sum, o) => sum + (o.isDeleted ? 0 : o.amount), 0) || 0;
      const paymentsSum = order.payments?.reduce((sum, p) => sum + (p.isDeleted ? 0 : p.amount), 0) || 0;
      const calculatedTotalAmount = (order.totalAmount && order.totalAmount > 0) 
        ? order.totalAmount 
        : (obligationsSum > 0 ? obligationsSum : paymentsSum);

      return {
        orderId: order.orderId,
        legacyId: order.legacyId,
        customerId: order.customerId,
        totalAmount: calculatedTotalAmount,
        totalPaid: paymentsSum,
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
          if (!dressName && prefix !== null && prefix !== undefined) {
            dressName = dressModelMap.get(Number(prefix)) || dressModelMap.get(String(prefix));
          }
          
          let itemDesc = i.description;
          if (!itemDesc || itemDesc === 'פריט כללי') {
            if (dressName) {
              itemDesc = `${dressName}${prefix ? ` (קוד: ${prefix})` : ''}${i.sizeText ? `, מידה: ${i.sizeText}` : ''}`;
            } else {
              itemDesc = 'פריט כללי';
            }
          } else if (dressName && !itemDesc.includes(dressName)) {
            itemDesc = `${dressName}${prefix ? ` (קוד: ${prefix})` : ''} - ${itemDesc}`;
          }

          return {
            id: i.id,
            dressId: i.dressItem?.dress?.id,
            itemId: i.dressItemId,
            description: itemDesc,
            price: i.price,
            isTaken: i.isTaken,
            isReturned: i.isReturned,
            isDeleted: i.isDeleted,
            barcode: i.barcode,
            cartStatus: i.cartStatus,
            cartStatusDate: i.cartStatusDate,
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

    // This route creates orders; editing one goes through PUT /api/orders/[id], which
    // updates items in place. Letting a caller aim a create at an existing order meant
    // wiping and re-inserting its items, which threw away their rental history. The order
    // number is always allocated here too - honouring a client-supplied one is how orders
    // ended up numbered far outside the real sequence, dragging every later number with them.
    if (data.orderId) {
      const alreadyExists = await prisma.order.findUnique({
        where: { orderId: parseInt(data.orderId, 10) },
        select: { orderId: true }
      });
      if (alreadyExists) {
        return NextResponse.json(
          { error: `הזמנה #${alreadyExists.orderId} כבר קיימת. לעדכון הזמנה קיימת יש להשתמש במסך עריכת ההזמנה.` },
          { status: 409 }
        );
      }
    }

    const activeItems = data.items && Array.isArray(data.items) ? data.items.filter(i => !i.isDeleted) : [];
    const isCustomDuration = data.isAbroad || data.isWeekdayEvent;
    const hasDates = isCustomDuration ? (data.fromDate && data.toDate) : !!data.eventDate;

    // The client sends the collected payments as `paymentsList`; older callers sent a single
    // `payment` object. Derive status/cartStatus from whichever arrived - reading only
    // `data.payment` left every fully-paid order as 'חדש' with 'pending' items, which the
    // inventory hold window (inventory_hold_minutes) then released back to the pool.
    const submittedPayments = (data.paymentsList && data.paymentsList.length > 0)
      ? data.paymentsList
      : (data.payment ? [data.payment] : []);
    const totalPaidAmount = submittedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const hasManagerApproval = submittedPayments.some(p => (p.method || p.paymentMethod) === 'יציאה באישור מנהל');
    const orderTotalAmount = data.totalAmount ? parseFloat(data.totalAmount) : 0;
    const isOrderConfirmed = totalPaidAmount > 0 || hasManagerApproval || orderTotalAmount === 0;
    const derivedCartStatus = isOrderConfirmed ? 'confirmed' : 'pending';
    const derivedStatus = (orderTotalAmount > 0 && totalPaidAmount >= orderTotalAmount)
      ? 'שולם'
      : (totalPaidAmount > 0 ? 'שולם חלקי' : (data.status || 'חדש'));

    if (activeItems.length > 0 && hasDates) {
      const validationResult = await validateOrderItemsAvailability(
        activeItems,
        data.eventDate,
        isCustomDuration,
        data.fromDate,
        data.toDate,
        data.orderId || null,
        data.customSpacing ?? null
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

    const createOrderWithId = (orderIdToUse) =>
      prisma.order.create({
        data: {
          orderId: orderIdToUse,
          customerId: data.customerId || null,
          totalAmount: data.totalAmount ? parseFloat(data.totalAmount) : null,
          orderDate: new Date(),
          eventDate: data.isAbroad && data.fromDate ? new Date(data.fromDate) : (data.eventDate ? new Date(data.eventDate) : null),
          eventDateHebrew: data.eventDateHebrew || (data.eventDate ? getHebrewDateString(data.eventDate) : null),
          returnDate: data.returnDate ? new Date(data.returnDate) : null,
          employeeId: data.employeeId || loggedInEmployeeId || null,
          isAbroad: data.isAbroad ?? false,
          isWeekdayEvent: data.isWeekdayEvent ?? false,
          fromDate: data.fromDate ? new Date(data.fromDate) : null,
          toDate: data.toDate ? new Date(data.toDate) : null,
          notes: data.notes || '',
          status: derivedStatus,
          items: {
            create: data.items?.map(item => ({
              dressItemId: item.sampleItemId,
              cartStatus: derivedCartStatus,
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
          ...(data.paymentsList && data.paymentsList.length > 0 ? {
            payments: {
              create: data.paymentsList.map(p => ({
                amount: parseFloat(p.amount),
                paymentMethod: p.method || p.paymentMethod,
                notes: p.notes || '',
                customerId: data.customerId ? data.customerId : null
              }))
            }
          } : (data.payment && (data.payment.amount > 0 || data.payment.method === 'יציאה באישור מנהל') ? {
            payments: {
              create: [{
                amount: parseFloat(data.payment.amount),
                paymentMethod: data.payment.method,
                notes: data.payment.notes || '',
                customerId: data.customerId ? data.customerId : null
              }]
            }
          } : {}))
        }
      });

    // `orderId` is a plain unique Int with no database sequence behind it, so the next
    // number has to be read and assigned by hand. Two employees saving at the same moment
    // would both read the same maximum, and the second insert would die on the unique
    // constraint - which reached the user as a generic "failed to save" message. Re-read
    // the number and try again instead.
    let order;
    for (let attempt = 0; ; attempt += 1) {
      const maxOrder = await prisma.order.findFirst({
        orderBy: { orderId: 'desc' },
        select: { orderId: true }
      });
      const nextOrderId = maxOrder ? maxOrder.orderId + 1 : 1;

      try {
        order = await createOrderWithId(nextOrderId);
        break;
      } catch (error) {
        const target = error?.meta?.target;
        const hitOrderId = Array.isArray(target)
          ? target.some(t => String(t).includes('orderId'))
          : String(target || '').includes('orderId');

        if (error?.code !== 'P2002' || !hitOrderId || attempt >= 4) throw error;
      }
    }

    // The order, its items and its payments are already committed at this point - the pricing
    // engine runs in its own transaction afterwards. Letting a failure here bubble up as a 500
    // told the user the save had failed while the order was in fact sitting in the database,
    // so they saved again, and again; that is how a single order turned into eleven duplicates.
    // Report the order as saved and surface the pricing problem as a warning instead.
    let pricingWarning = null;
    try {
      await recalculateOrderObligations(order.orderId);
    } catch (pricingError) {
      console.error(`Order ${order.orderId} saved, but obligations could not be calculated:`, pricingError);
      pricingWarning = `ההזמנה נשמרה (#${order.orderId}), אך חישוב החיובים נכשל: ${pricingError.message}. יש לפתוח את ההזמנה ולחשב מחדש.`;
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { orderId: order.orderId },
      include: {
        items: true,
        obligations: true,
        payments: true
      }
    });

    return NextResponse.json(pricingWarning ? { ...updatedOrder, warning: pricingWarning } : updatedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
