import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { recalculateOrderObligations } from '@/lib/pricingEngine';
import { validateOrderItemsAvailability } from '@/lib/inventory';
import { checkAuth } from '@/lib/auth';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { cookies } from 'next/headers';

export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  
  try {
    const data = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    const loggedInEmployeeId = token?.value || null;

    let orderId = data.orderId;

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

    if (!orderId) {
      // Create new draft order
      const maxOrder = await prisma.order.findFirst({
        orderBy: { orderId: 'desc' }
      });
      const nextOrderId = maxOrder ? maxOrder.orderId + 1 : 1;
      orderId = nextOrderId;

      await prisma.order.create({
        data: {
          orderId: orderId,
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
          status: 'טיוטה',
          items: {
            create: data.items?.map(item => ({
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
            })) || []
          }
        }
      });
    } else {
      // Update existing draft order
      await prisma.$transaction(async (tx) => {
        // Update order fields
        await tx.order.update({
          where: { orderId: orderId },
          data: {
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
            notes: data.notes || '',
            status: 'טיוטה'
          }
        });

        // Delete old items and obligations, and create new ones
        await tx.orderItem.deleteMany({ where: { orderId: orderId } });
        
        if (data.items && data.items.length > 0) {
          await tx.orderItem.createMany({
            data: data.items.map(item => ({
              orderId: orderId,
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
            }))
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
