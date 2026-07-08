import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { recalculateOrderObligations } from '@/lib/pricingEngine';

export async function POST(request) {
  try {
    const data = await request.json();
    
    if (!data.orderId || !data.amount) {
      return NextResponse.json({ error: 'חסרים נתונים חובה: מס׳ הזמנה וסכום' }, { status: 400 });
    }

    const parsedOrderId = parseInt(data.orderId);
    if (isNaN(parsedOrderId)) {
      return NextResponse.json({ error: 'מספר הזמנה לא חוקי' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderId: parsedOrderId }
    });

    if (!order) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });
    }

    // Create new payment
    const payment = await prisma.payment.create({
      data: {
        orderId: parsedOrderId,
        customerId: data.customerId ? parseInt(data.customerId) : order.customerId,
        amount: parseFloat(data.amount),
        paymentMethod: data.paymentMethod || 'מזומן',
        notes: data.notes || '',
        paymentDate: new Date()
      }
    });

    // We can also trigger recalculation or update if needed
    // await recalculateOrderObligations(parsedOrderId);

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error adding payment:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת התשלום' }, { status: 500 });
  }
}
