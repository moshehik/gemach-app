'use client';

import { useEffect, useState } from 'react';
import { getDailyReport, getOrderSummaryStats, getMaxConcurrentEmployees } from './actions';

export default function StatisticsPage() {
  const [dailyReport, setDailyReport] = useState(null);
  const [orderSummary, setOrderSummary] = useState([]);
  const [maxEmployees, setMaxEmployees] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [daily, orders, maxEmp] = await Promise.all([
          getDailyReport(),
          getOrderSummaryStats(),
          getMaxConcurrentEmployees()
        ]);
        setDailyReport(daily);
        setOrderSummary(orders);
        setMaxEmployees(maxEmp);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="container" style={{ paddingTop: '3rem', textAlign: 'center' }}>טוען נתונים סטטיסטיים...</div>;
  }

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '3rem' }}>
      <h1 style={{ marginBottom: '2rem', color: 'var(--primary-color)' }}>מרכז סטטיסטיקות מתקדם</h1>

      {/* דוח יומי */}
      <h2 style={{ marginBottom: '1rem', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>סטטיסטיקה_דוח_יומי (להיום)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div className="dress-card" style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f0fdf4' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>הזמנות חדשות</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#166534' }}>{dailyReport?.newOrders || 0}</div>
        </div>
        <div className="dress-card" style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fffbeb' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>פריטים שהוחזרו</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#b45309' }}>{dailyReport?.itemsReturned || 0}</div>
        </div>
        <div className="dress-card" style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#eff6ff' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>הכנסות היום</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1e40af' }}>₪{dailyReport?.revenue?.toLocaleString() || 0}</div>
        </div>
      </div>

      {/* סטטיסטיקת עובדים */}
      <h2 style={{ marginBottom: '1rem', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>סטטיסטיקה_עובדים_מקסימלית</h2>
      <div className="dress-card" style={{ padding: '2rem', marginBottom: '3rem', background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-color)' }}>שיא עובדים בו-זמנית</h3>
            <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)' }}>
              זמן השיא: {maxEmployees?.peakTime ? new Date(maxEmployees.peakTime).toLocaleString('he-IL') : 'אין נתונים'}
            </p>
          </div>
          <div style={{ fontSize: '3rem', fontWeight: '900', color: '#475569' }}>
            {maxEmployees?.maxEmployees || 0}
          </div>
        </div>
      </div>

      {/* סיכום הזמנות */}
      <h2 style={{ marginBottom: '1rem', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>סטטיסטיקה_סיכום_להזמנה (10 אחרונות)</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <thead style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'right' }}>מזהה</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>לקוח</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>תאריך</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>כמות פריטים</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>סך הכל</th>
            </tr>
          </thead>
          <tbody>
            {orderSummary.map((order, idx) => (
              <tr key={order.orderId} style={{ borderBottom: '1px solid #eee', backgroundColor: idx % 2 === 0 ? '#fafafa' : 'white' }}>
                <td style={{ padding: '1rem' }}>{order.orderId.substring(0, 8)}...</td>
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{order.customerName}</td>
                <td style={{ padding: '1rem' }}>{new Date(order.date).toLocaleDateString('he-IL')}</td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>{order.totalItems}</td>
                <td style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold', color: 'var(--primary-color)' }}>₪{order.totalAmount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
