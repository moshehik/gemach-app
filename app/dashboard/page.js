import prisma from '../lib/prisma';
import DashboardCharts from './DashboardCharts';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  // Basic KPIs
  const totalCustomers = await prisma.customer.count({ where: { isDeleted: false } });
  const totalEmployees = await prisma.employee.count({ where: { isActive: true } });
  const totalOrders = await prisma.order.count();
  
  const revenueAggregation = await prisma.order.aggregate({
    _sum: { totalAmount: true }
  });
  const totalRevenue = revenueAggregation._sum.totalAmount || 0;

  // Chart Data: Revenue by Method
  const paymentMethodsStats = await prisma.order.groupBy({
    by: ['paymentMethod'],
    _sum: { totalAmount: true },
    _count: { id: true }
  });

  const revenueByMethod = paymentMethodsStats.map(stat => ({
    method: stat.paymentMethod || 'לא מוגדר',
    amount: stat._sum.totalAmount || 0,
    count: stat._count.id
  })).sort((a, b) => b.amount - a.amount);

  // Chart Data: Revenue Trend (grouping last 1000 orders by date string in JS)
  const recentOrders = await prisma.order.findMany({
    orderBy: { paymentDate: 'desc' },
    take: 1000,
    select: { paymentDate: true, totalAmount: true },
    where: { paymentDate: { not: null } }
  });

  const dateRevenueMap = {};
  recentOrders.forEach(order => {
    if (!order.paymentDate) return;
    const dateStr = order.paymentDate.toISOString().split('T')[0];
    if (!dateRevenueMap[dateStr]) dateRevenueMap[dateStr] = 0;
    dateRevenueMap[dateStr] += (order.totalAmount || 0);
  });

  // Limit to last 30 active days
  const revenueTrend = Object.keys(dateRevenueMap)
    .sort()
    .slice(-30)
    .map(date => ({
      date,
      revenue: dateRevenueMap[date]
    }));

  return (
    <main className="container animate-fade-in" style={{ paddingTop: '3rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>אזור ניהול - סיכומים ופילוחים</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div className="dress-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>סה"כ הכנסות</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--primary-color)' }}>₪{totalRevenue.toLocaleString()}</div>
        </div>
        
        <div className="dress-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>לקוחות פעילים</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--primary-color)' }}>{totalCustomers.toLocaleString()}</div>
        </div>

        <div className="dress-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>סה"כ הזמנות</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: 'var(--primary-color)' }}>{totalOrders.toLocaleString()}</div>
        </div>
        
        <div className="dress-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>עובדים פעילים</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#e53935' }}>{totalEmployees}</div>
        </div>
      </div>

      <DashboardCharts revenueByMethod={revenueByMethod} revenueTrend={revenueTrend} />
      
    </main>
  );
}
