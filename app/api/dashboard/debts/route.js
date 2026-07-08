import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { checkAuth } from '../../../../lib/auth';

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  try {
    // 1. Fetch Outstanding Debts (Orders that are not fully paid)
    // For simplicity, we find orders where isPaid is false. 
    // In a real scenario you might sum up order totalAmount and subtract payments.
    const debts = await prisma.order.findMany({
      where: {
        isPaid: false,
        isDeleted: false
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phone1: true
          }
        },
        payments: true
      },
      orderBy: {
        orderId: 'desc'
      },
      take: 20
    });

    const debtsWithRemaining = debts.map(order => {
      const totalPaid = order.payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);
      const remaining = (order.totalAmount || 0) - totalPaid;
      return {
        ...order,
        totalPaid,
        remaining
      };
    }).filter(d => d.remaining > 0);

    // 2. Fetch Recent Payments
    const recentPayments = await prisma.payment.findMany({
      where: {
        isDeleted: false
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        order: {
          select: {
            orderId: true
          }
        }
      },
      orderBy: {
        paymentDate: 'desc'
      },
      take: 10
    });

    // 3. Fetch Recent Orders
    const recentOrders = await prisma.order.findMany({
      where: {
        isDeleted: false
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        items: {
          where: { isDeleted: false },
          select: { id: true }
        }
      },
      orderBy: {
        orderId: 'desc'
      },
      take: 10
    });
    // 4. Fetch Recent Rentals
    const recentRentals = await prisma.orderItem.findMany({
      where: {
        isDeleted: false,
        order: {
          isDeleted: false
        }
      },
      include: {
        order: {
          include: {
            customer: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        dressItem: {
          include: {
            dress: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        id: 'desc'
      },
      take: 10
    });

    return NextResponse.json({ debts: debtsWithRemaining, recentPayments, recentOrders, recentRentals });
  } catch (error) {
    console.error('Debts fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch debts and payments' }, { status: 500 });
  }
}
