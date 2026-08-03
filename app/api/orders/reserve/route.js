import { NextResponse } from 'next/server';

import prisma from '@/app/lib/prisma';
import { checkAuth } from '../../../../lib/auth';
import { cookies } from 'next/headers';
import { RESERVED_ORDER_STATUS } from '../../../../lib/orderReservation';

export const dynamic = 'force-dynamic';

// Nedarim Plus keeps the order number inside the transaction comment, and that comment is
// written at the moment the card is charged. On the new-order screen the charge happens
// before the order is saved, so there was no number to write and the comment said
// "מס הזמנה: חדשה" - useless when reconciling a charge against an order.
//
// This route hands out the real number up front. `orderId` is a plain unique Int allocated
// by hand (see POST /api/orders), so the only atomic way to claim one is to insert the row;
// the placeholder is therefore written as isDeleted so it stays out of every order list
// until the save fills it in. A charge that is abandoned afterwards leaves the placeholder
// behind as a cancelled order - which is exactly where you want to look for it.
export async function POST(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  try {
    const data = await request.json().catch(() => ({}));
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    const loggedInEmployeeId = token?.value || null;

    // Same read-max-and-retry dance as the create path: two employees reserving at the same
    // moment would both read the same maximum and the second insert would hit the unique
    // constraint, so re-read the number and try again.
    for (let attempt = 0; ; attempt += 1) {
      const maxOrder = await prisma.order.findFirst({
        orderBy: { orderId: 'desc' },
        select: { orderId: true }
      });
      const nextOrderId = maxOrder ? maxOrder.orderId + 1 : 1;

      try {
        const reserved = await prisma.order.create({
          data: {
            orderId: nextOrderId,
            customerId: data.customerId || null,
            employeeId: data.employeeId || loggedInEmployeeId || null,
            orderDate: new Date(),
            status: RESERVED_ORDER_STATUS,
            isDeleted: true,
            notes: 'מספר הזמנה שמור לחיוב אשראי - טרם נשמרה הזמנה'
          },
          select: { orderId: true }
        });

        return NextResponse.json({ orderId: reserved.orderId });
      } catch (error) {
        const target = error?.meta?.target;
        const hitOrderId = Array.isArray(target)
          ? target.some(t => String(t).includes('orderId'))
          : String(target || '').includes('orderId');

        if (error?.code !== 'P2002' || !hitOrderId || attempt >= 4) throw error;
      }
    }
  } catch (error) {
    console.error('Error reserving order number:', error);
    return NextResponse.json(
      { error: 'Failed to reserve order number', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
