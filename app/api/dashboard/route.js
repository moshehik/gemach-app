import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';


export async function GET() {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    // Basic Counts
    const totalCustomers = await prisma.customer.count({ where: { isDeleted: false } });
    const totalOrders = await prisma.order.count();
    const totalDresses = await prisma.dressItem.count({ where: { notInUse: false } });

    // Aggregate Revenue
    const revenueAggregation = await prisma.order.aggregate({
      _sum: {
        totalAmount: true
      }
    });
    const totalRevenue = revenueAggregation._sum.totalAmount || 0;

    // Revenue by Payment Method (groupBy)
    const paymentMethodsStats = await prisma.order.groupBy({
      by: ['paymentMethod'],
      _sum: {
        totalAmount: true
      },
      _count: {
        id: true
      }
    });

    const revenueByMethod = paymentMethodsStats.map(stat => ({
      method: stat.paymentMethod || 'לא מוגדר',
      amount: stat._sum.totalAmount || 0,
      count: stat._count.id
    })).sort((a, b) => b.amount - a.amount);

    // Orders trend (last 10 orders for simple chart or group by month if dates exist)
    // For simplicity, let's fetch recent orders and group by Date in JS
    const recentOrders = await prisma.order.findMany({
      orderBy: { id: 'desc' },
      take: 100,
      select: {
        paymentDate: true,
        totalAmount: true
      }
    });

    const dateRevenueMap = {};
    recentOrders.forEach(order => {
      if (!order.paymentDate) return;
      // Get YYYY-MM-DD
      const dateStr = order.paymentDate.toISOString().split('T')[0];
      if (!dateRevenueMap[dateStr]) {
        dateRevenueMap[dateStr] = 0;
      }
      dateRevenueMap[dateStr] += (order.totalAmount || 0);
    });

    const revenueTrend = Object.keys(dateRevenueMap)
      .sort() // ascending dates
      .map(date => ({
        date,
        revenue: dateRevenueMap[date]
      }));

    return NextResponse.json({
      kpis: {
        totalCustomers,
        totalOrders,
        totalDresses,
        totalRevenue
      },
      revenueByMethod,
      revenueTrend
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
