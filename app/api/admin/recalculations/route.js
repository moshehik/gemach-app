import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { recalculateOrderObligations } from '../../../../lib/pricingEngine';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'חסרים תאריכי התחלה וסיום' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    // End date should cover the whole day
    end.setHours(23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: {
        eventDate: {
          gte: start,
          lte: end
        },
        isDeleted: false
      },
      include: {
        customer: true
      }
    });

    const results = [];

    for (const order of orders) {
      try {
        const result = await recalculateOrderObligations(order.orderId, { dryRun: true });
        if (result.diff !== 0) {
          results.push({
            orderId: order.orderId,
            customerName: order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : 'לא ידוע',
            eventDateHebrew: order.eventDateHebrew,
            oldAmount: result.oldTotalAmount || 0,
            newAmount: result.totalRequired,
            diff: result.diff
          });
        }
      } catch (err) {
        console.error(`Error calculating order ${order.orderId}:`, err);
      }
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Error fetching recalculations:', error);
    return NextResponse.json({ error: 'שגיאה בחישוב ההזמנות' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { orderIds, customNote } = data;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'לא נבחרו הזמנות' }, { status: 400 });
    }

    const successIds = [];
    const errors = [];

    for (const orderId of orderIds) {
      try {
        await recalculateOrderObligations(orderId, { dryRun: false, customNote });
        successIds.push(orderId);
      } catch (err) {
        console.error(`Error applying calculation for order ${orderId}:`, err);
        errors.push({ orderId, error: err.message });
      }
    }

    return NextResponse.json({ 
      success: true, 
      appliedCount: successIds.length,
      successIds,
      errors 
    });
  } catch (error) {
    console.error('Error applying recalculations:', error);
    return NextResponse.json({ error: 'שגיאה בהחלת השינויים' }, { status: 500 });
  }
}
