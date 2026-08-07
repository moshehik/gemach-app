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
    <>
      <div className="page-head">
        <div>
          <h1>אזור ניהול - סיכומים ופילוחים</h1>
        </div>
      </div>

      <h2 className="section-title">מדדים מרכזיים</h2>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>
              <svg className="icon"><use href="#i-coin" /></svg>
            </div>
          </div>
          <div className="kpi-label">סה"כ הכנסות</div>
          <div className="kpi-value">₪{totalRevenue.toLocaleString()}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--info-tint)', color: 'var(--info)' }}>
              <svg className="icon"><use href="#i-users" /></svg>
            </div>
          </div>
          <div className="kpi-label">לקוחות פעילים</div>
          <div className="kpi-value">{totalCustomers.toLocaleString()}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}>
              <svg className="icon"><use href="#i-bag" /></svg>
            </div>
          </div>
          <div className="kpi-label">סה"כ הזמנות</div>
          <div className="kpi-value">{totalOrders.toLocaleString()}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--warning-tint)', color: 'var(--warning)' }}>
              <svg className="icon"><use href="#i-user-check" /></svg>
            </div>
          </div>
          <div className="kpi-label">עובדים פעילים</div>
          <div className="kpi-value">{totalEmployees}</div>
        </div>
      </div>

      <h2 className="section-title">פילוח נתונים</h2>
      <DashboardCharts revenueByMethod={revenueByMethod} revenueTrend={revenueTrend} />
    </>
  );
}
