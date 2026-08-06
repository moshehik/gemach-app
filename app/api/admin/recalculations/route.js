import { NextResponse } from 'next/server';

import { recalculateOrderObligations } from '../../../../lib/pricingEngine';

import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
export const dynamic = 'force-dynamic';

// Safety cap for the GET dry-run: a date range wide enough to pull in more orders than this is
// almost certainly a mistake (normal usage is a month/quarter at a time), and scanning it
// unbounded risks exceeding Vercel's serverless execution time limit with nothing to show for
// it. Ask the caller to narrow the range instead of silently chewing through it.
const RECALC_DRY_RUN_MAX_ORDERS = 500;

// recalculateOrderObligations does its own internal parallel queries (and, for writes, its own
// $transaction), so running many of them fully in parallel risks exhausting the Postgres
// connection pool against remote Neon. Process in small concurrent batches instead of one order
// at a time (too slow) or all-at-once (too many concurrent connections).
const RECALC_CHUNK_SIZE = 8;

async function processInChunks(items, chunkSize, worker) {
  const results = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(worker));
    results.push(...chunkResults);
  }
  return results;
}

export async function GET(request) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }
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

    const orderWhere = {
      eventDate: {
        gte: start,
        lte: end
      },
      isDeleted: false
    };

    const orderCount = await prisma.order.count({ where: orderWhere });
    if (orderCount > RECALC_DRY_RUN_MAX_ORDERS) {
      return NextResponse.json({
        error: `הטווח שנבחר כולל ${orderCount} הזמנות - יותר מדי לחישוב בבת אחת (מקסימום ${RECALC_DRY_RUN_MAX_ORDERS}). יש לצמצם את טווח התאריכים.`
      }, { status: 400 });
    }

    const orders = await prisma.order.findMany({
      where: orderWhere,
      include: {
        customer: true
      }
    });

    const perOrderResults = await processInChunks(orders, RECALC_CHUNK_SIZE, async (order) => {
      try {
        const result = await recalculateOrderObligations(order.orderId, { dryRun: true });
        if (result.diff !== 0) {
          return {
            orderId: order.orderId,
            customerName: order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : 'לא ידוע',
            eventDateHebrew: order.eventDateHebrew,
            oldAmount: result.oldTotalAmount || 0,
            newAmount: result.totalRequired,
            diff: result.diff
          };
        }
        return null;
      } catch (err) {
        console.error(`Error calculating order ${order.orderId}:`, err);
        return null;
      }
    });

    const results = perOrderResults.filter(Boolean);

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Error fetching recalculations:', error);
    return NextResponse.json({ error: 'שגיאה בחישוב ההזמנות' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }
  try {
    const data = await request.json();
    const { orderIds, customNote } = data;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'לא נבחרו הזמנות' }, { status: 400 });
    }

    const successIds = [];
    const errors = [];

    const perOrderResults = await processInChunks(orderIds, RECALC_CHUNK_SIZE, async (orderId) => {
      try {
        await recalculateOrderObligations(orderId, { dryRun: false, customNote });
        return { orderId, success: true };
      } catch (err) {
        console.error(`Error applying calculation for order ${orderId}:`, err);
        return { orderId, success: false, error: err.message };
      }
    });

    for (const r of perOrderResults) {
      if (r.success) {
        successIds.push(r.orderId);
      } else {
        errors.push({ orderId: r.orderId, error: r.error });
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
