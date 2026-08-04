'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateOrderStatus, getStatusColor, calculatePaymentStatus, getPaymentStatusColor } from '@/lib/orderStatus';

export default function ModernCustomerOrdersTab({ orders = [] }) {
  const router = useRouter();

  const sortedOrders = [...orders].sort((a, b) => {
    const getEventSortDate = (o) => (o.isWeekdayEvent || o.isAbroad)
      ? (o.fromDate || o.eventDate || o.orderDate || o.createdAt || 0)
      : (o.eventDate || o.orderDate || o.createdAt || 0);
    return new Date(getEventSortDate(b)) - new Date(getEventSortDate(a));
  });

  return (
    <div className="moc-card-panel">
      <div className="moc-table-toolbar">
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>הזמנות הלקוח</h3>
        <span className="moc-hint">{orders.length} הזמנות</span>
      </div>

      {sortedOrders.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="moc-data-table">
            <thead>
              <tr>
                <th>קוד הזמנה</th>
                <th>תאריך אירוע/השכרה</th>
                <th>סטטוס פריטים</th>
                <th>סכום לחיוב</th>
                <th>שולם</th>
                <th>סטטוס תשלום</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map(order => {
                const calculatedTotalAmount = order.obligations?.length > 0
                  ? order.obligations.reduce((sum, o) => sum + (o.isDeleted ? 0 : o.amount), 0)
                  : (order.totalAmount || 0);
                const totalPaid = order.payments?.reduce((sum, p) => sum + (p.isDeleted ? 0 : p.amount), 0) || 0;
                const orderStatus = calculateOrderStatus(order);
                const statusColors = getStatusColor(orderStatus);
                const paymentStatus = calculatePaymentStatus(calculatedTotalAmount, totalPaid);
                const paymentColors = getPaymentStatusColor(paymentStatus);

                return (
                  <tr key={order.id} onClick={() => router.push(`/orders/${order.orderId}`)} style={{ cursor: 'pointer' }}>
                    <td>
                      <Link href={`/orders/${order.orderId}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--moc-primary-dark)', textDecoration: 'none', fontWeight: 700 }}>
                        {order.orderId}
                      </Link>
                    </td>
                    <td>
                      {order.isWeekdayEvent ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.85rem' }}>
                          <span><strong>לקיחה:</strong> {order.fromDate ? new Date(order.fromDate).toLocaleDateString('he-IL') : '-'}</span>
                          <span><strong>החזרה:</strong> {order.toDate || order.returnDate ? new Date(order.toDate || order.returnDate).toLocaleDateString('he-IL') : '-'}</span>
                        </div>
                      ) : (
                        order.eventDateHebrew || (order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : (order.orderDate ? new Date(order.orderDate).toLocaleDateString('he-IL') : '-'))
                      )}
                    </td>
                    <td>
                      <span className="moc-badge" style={{ background: statusColors.bg, color: statusColors.text }}>{orderStatus}</span>
                    </td>
                    <td style={{ fontWeight: 700 }}>₪{calculatedTotalAmount}</td>
                    <td style={{ color: totalPaid >= calculatedTotalAmount && calculatedTotalAmount > 0 ? '#166534' : (totalPaid < calculatedTotalAmount ? 'var(--moc-danger-text)' : 'inherit') }}>₪{totalPaid}</td>
                    <td>
                      <span className="moc-badge" style={{ background: paymentColors.bg, color: paymentColors.text }}>{paymentStatus}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="moc-empty-state">אין הזמנות ללקוח זה.</div>
      )}
    </div>
  );
}
