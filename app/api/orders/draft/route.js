import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { recalculateOrderObligations } from '@/lib/pricingEngine';
import { validateOrderItemsAvailability } from '@/lib/inventory';
import { checkAuth } from '@/lib/auth';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { cookies } from 'next/headers';
import { DRAFT_ORDER_STATUS, isOrderShell } from '@/lib/orderReservation';

// The items a draft holds. 'pending' is what makes `inventory_hold_minutes` release them back
// into the pool once the hold expires, so an abandoned cart does not sit on a dress forever.
const draftItemFields = (item) => ({
  dressItemId: item.sampleItemId,
  cartStatus: 'pending',
  sizeText: item.sizeText,
  quantity: item.quantity || 1,
  basePrice: item.basePrice ? parseFloat(item.basePrice) : 0,
  finalPrice: item.finalPrice ? parseFloat(item.finalPrice) : 0,
  repairs: item.repairs || '',
  neckAlteration: item.neckAlteration ? 1 : 0,
  sleeveAlteration: item.sleeveAlteration ? 1 : 0,
  lengthAlteration: item.lengthAlteration ? String(item.lengthAlteration) : '',
  alterationDetails: item.repairs || ''
});

// Autosave for the new-order screen: the cart is written to disk as soon as it has items, so
// closing the screen leaves a 'טיוטה' order in the list with its hold counting down, instead
// of losing everything. POST /api/orders turns this row into the real order on the final save.
export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  try {
    const data = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    const loggedInEmployeeId = token?.value || null;

    let orderId = data.orderId ? parseInt(data.orderId, 10) : null;

    // The row this draft may write into: one it created earlier, or the placeholder
    // POST /api/orders/reserve left behind for a card charge. Anything else - a real order, or
    // a draft that has since been paid - is left alone and the draft starts a new row, so a
    // stale id in a forgotten browser tab can never overwrite a live order.
    if (orderId) {
      const existing = await prisma.order.findUnique({
        where: { orderId },
        select: {
          orderId: true,
          status: true,
          isDeleted: true,
          items: { select: { id: true }, take: 1 },
          payments: { select: { id: true }, take: 1 }
        }
      });
      if (!isOrderShell(existing)) orderId = null;
    }

    // Validate inventory availability
    if (data.items && data.items.length > 0) {
      const validationResult = await validateOrderItemsAvailability(
        data.items,
        data.eventDate,
        data.isAbroad || data.isWeekdayEvent,
        data.fromDate,
        data.toDate,
        orderId || null,
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

    const orderFields = {
      customerId: data.customerId || null,
      totalAmount: data.totalAmount ? parseFloat(data.totalAmount) : null,
      eventDate: data.isAbroad && data.fromDate ? new Date(data.fromDate) : (data.eventDate ? new Date(data.eventDate) : null),
      eventDateHebrew: data.eventDateHebrew || (data.eventDate ? getHebrewDateString(data.eventDate) : null),
      returnDate: data.returnDate ? new Date(data.returnDate) : null,
      employeeId: data.employeeId || loggedInEmployeeId || null,
      isAbroad: data.isAbroad ?? false,
      isWeekdayEvent: data.isWeekdayEvent ?? false,
      fromDate: data.fromDate ? new Date(data.fromDate) : null,
      toDate: data.toDate ? new Date(data.toDate) : null,
      customSpacing: data.customSpacing !== undefined && data.customSpacing !== null && data.customSpacing !== '' ? parseInt(data.customSpacing, 10) : null,
      notes: data.notes || '',
      status: DRAFT_ORDER_STATUS
    };

    if (!orderId) {
      // `orderId` is a plain unique Int with no sequence behind it, so the next number has to
      // be read and claimed by hand - and two screens drafting at the same moment would both
      // read the same maximum. Re-read and retry, same as POST /api/orders.
      for (let attempt = 0; ; attempt += 1) {
        const maxOrder = await prisma.order.findFirst({
          orderBy: { orderId: 'desc' },
          select: { orderId: true }
        });
        const nextOrderId = maxOrder ? maxOrder.orderId + 1 : 1;

        try {
          const created = await prisma.order.create({
            data: {
              orderId: nextOrderId,
              orderDate: new Date(),
              ...orderFields,
              items: {
                create: data.items?.map(draftItemFields) || []
              }
            },
            select: { orderId: true }
          });
          orderId = created.orderId;
          break;
        } catch (error) {
          const target = error?.meta?.target;
          const hitOrderId = Array.isArray(target)
            ? target.some(t => String(t).includes('orderId'))
            : String(target || '').includes('orderId');

          if (error?.code !== 'P2002' || !hitOrderId || attempt >= 4) throw error;
        }
      }
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { orderId: orderId },
          // A reservation placeholder is flagged isDeleted so it stays out of every order list
          // until an order lands on it; the draft is that order arriving, so clear the flag.
          data: { ...orderFields, isDeleted: false, deletedAt: null }
        });

        // Replace the cart wholesale. A draft has no rental history to lose, and its
        // obligations are rebuilt by the pricing engine below.
        await tx.orderItem.deleteMany({ where: { orderId: orderId } });

        if (data.items && data.items.length > 0) {
          await tx.orderItem.createMany({
            data: data.items.map(item => ({ orderId: orderId, ...draftItemFields(item) }))
          });
        }
      });
    }

    // Run pricing engine
    await recalculateOrderObligations(orderId);

    const updatedOrder = await prisma.order.findUnique({
      where: { orderId: orderId }
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Error saving draft:', error);
    return NextResponse.json(
      { error: 'Failed to save draft', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
