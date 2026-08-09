import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';


export async function GET() {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    // חלון הגרף — 35 ימים אחורה מכסה "30 הימים האחרונים" כולל שוליים, במקום למשוך
    // מאות שורות ולסנן ב-JS.
    const trendWindowStart = new Date();
    trendWindowStart.setDate(trendWindowStart.getDate() - 35);
    trendWindowStart.setHours(0, 0, 0, 0);

    // כל 6 השאילתות בלתי-תלויות זו בזו — רצות במקביל במקום 6 סבבים עוקבים מול Neon.
    const [
      totalCustomers,
      totalOrders,
      totalDresses,
      revenueAggregation,
      paymentMethodsStats,
      recentOrders
    ] = await Promise.all([
      prisma.customer.count({ where: { isDeleted: false } }),
      prisma.order.count(),
      prisma.dressItem.count({ where: { notInUse: false } }),
      prisma.order.aggregate({
        _sum: {
          totalAmount: true
        }
      }),
      prisma.order.groupBy({
        by: ['paymentMethod'],
        _sum: {
          totalAmount: true
        },
        _count: {
          id: true
        }
      }),
      // Orders trend — only the rows inside the chart window instead of the last N
      // orders by id (which could span any date range and still miss chart days).
      prisma.order.findMany({
        where: { paymentDate: { gte: trendWindowStart } },
        select: {
          paymentDate: true,
          totalAmount: true
        }
      })
    ]);

    const totalRevenue = revenueAggregation._sum.totalAmount || 0;

    const revenueByMethod = paymentMethodsStats.map(stat => ({
      method: stat.paymentMethod || 'לא מוגדר',
      amount: stat._sum.totalAmount || 0,
      count: stat._count.id
    })).sort((a, b) => b.amount - a.amount);

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
