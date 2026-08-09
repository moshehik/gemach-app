'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateOrderStatus, calculatePaymentStatus } from '@/lib/orderStatus';

// מיפוי סטטוס טקסטואלי (calculateOrderStatus/calculatePaymentStatus ב-lib/orderStatus.js) אל
// מחלקת ה-badge של מערכת העיצוב "אריג" — אותו מיפוי בדיוק כמו בעמוד רשימת ההזמנות (app/orders/page.js).
const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'הוחזר':
    case 'הוחזר חלקי':
      return 'badge-success';
    case 'הושכר':
    case 'הושכר חלקי':
      return 'badge-info';
    case 'בקרוב':
      return 'badge-warning';
    case 'עבר':
      return 'badge-neutral';
    case 'מחוק':
      return 'badge-neutral';
    case 'טיוטה':
      return 'badge-neutral';
    default:
      return 'badge-neutral';
  }
};

const getPaymentBadgeClass = (status) => {
  switch (status) {
    case 'שולם':
      return 'badge-success';
    case 'שולם חלקי':
      return 'badge-warning';
    case 'ממתין לזיכוי':
      return 'badge-info';
    case 'לא שולם':
    default:
      return 'badge-danger';
  }
};

export default function ModernCustomerOrdersTab({ orders = [] }) {
  const router = useRouter();

  const sortedOrders = [...orders].sort((a, b) => {
    const getEventSortDate = (o) => (o.isWeekdayEvent || o.isAbroad)
      ? (o.fromDate || o.eventDate || o.orderDate || o.createdAt || 0)
      : (o.eventDate || o.orderDate || o.createdAt || 0);
    return new Date(getEventSortDate(b)) - new Date(getEventSortDate(a));
  });

  return (
    <div>
      <div className="toolbar">
        <div style={{ fontWeight: 800, fontSize: '14.5px' }}>הזמנות הלקוח</div>
        <span className="spacer" />
        <span className="hint" style={{ color: 'var(--text-3)' }}>{orders.length} הזמנות</span>
      </div>

      {sortedOrders.length > 0 ? (
        <div className="table-wrap">
          <div className="table-scroll">
          <table className="data">
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
                const paymentStatus = calculatePaymentStatus(calculatedTotalAmount, totalPaid);

                return (
                  <tr key={order.id} onClick={() => router.push(`/orders/${order.orderId}`)} style={{ cursor: 'pointer' }}>
                    <td className="cell-primary">
                      <Link href={`/orders/${order.orderId}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--primary-solid)' }}>
                        {order.orderId}
                      </Link>
                    </td>
                    <td>
                      {order.isWeekdayEvent ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12.5px' }}>
                          <span><strong>לקיחה:</strong> {order.fromDate ? new Date(order.fromDate).toLocaleDateString('he-IL') : '-'}</span>
                          <span><strong>החזרה:</strong> {order.toDate || order.returnDate ? new Date(order.toDate || order.returnDate).toLocaleDateString('he-IL') : '-'}</span>
                        </div>
                      ) : (
                        order.eventDateHebrew || (order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : (order.orderDate ? new Date(order.orderDate).toLocaleDateString('he-IL') : '-'))
                      )}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(orderStatus)}`}>{orderStatus}</span>
                    </td>
                    <td className="cell-primary">₪{calculatedTotalAmount}</td>
                    <td style={{ color: totalPaid >= calculatedTotalAmount && calculatedTotalAmount > 0 ? 'var(--success)' : (totalPaid < calculatedTotalAmount ? 'var(--danger)' : undefined) }}>₪{totalPaid}</td>
                    <td>
                      <span className={`badge ${getPaymentBadgeClass(paymentStatus)}`}>{paymentStatus}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="table-foot">
            <span>סה&quot;כ הזמנות מוצגות: {sortedOrders.length}</span>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <svg className="icon"><use href="#i-bag" /></svg>
          <p>אין הזמנות ללקוח זה.</p>
        </div>
      )}
    </div>
  );
}
