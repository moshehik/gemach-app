'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateOrderStatus, calculatePaymentStatus } from '@/lib/orderStatus';
import { Card, Chip, Row, Rows, Empty, Icon } from '@/app/v3/ui/components';

// מיפוי סטטוס טקסטואלי (calculateOrderStatus/calculatePaymentStatus ב-lib/orderStatus.js) אל
// וריאנט הצ'יפ של v3 — אותו מיפוי בדיוק כמו בעמוד רשימת ההזמנות (app/orders/page.js).
const getStatusChipVariant = (status) => {
  switch (status) {
    case 'הוחזר':
    case 'הוחזר חלקי':
      return 'done';
    case 'הושכר':
    case 'הושכר חלקי':
      return 'info';
    case 'בקרוב':
      return 'gold';
    case 'עבר':
    case 'מחוק':
    case 'טיוטה':
    default:
      return undefined;
  }
};

const getPaymentChipVariant = (status) => {
  switch (status) {
    case 'שולם':
      return 'done';
    case 'שולם חלקי':
      return 'gold';
    case 'ממתין לזיכוי':
      return 'info';
    case 'לא שולם':
    default:
      return 'attn';
  }
};

export default function ModernCustomerOrdersTab({ orders = [] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState(null);

  const sortedOrders = [...orders].sort((a, b) => {
    const getEventSortDate = (o) => (o.isWeekdayEvent || o.isAbroad)
      ? (o.fromDate || o.eventDate || o.orderDate || o.createdAt || 0)
      : (o.eventDate || o.orderDate || o.createdAt || 0);
    return new Date(getEventSortDate(b)) - new Date(getEventSortDate(a));
  });

  return (
    <Card icon="bag" title="הזמנות הלקוח" tip="לחיצה על הזמנה פותחת אותה. החץ מציג את הסכומים והסטטוסים.">
      {sortedOrders.length > 0 ? (
        <div className="v3-stack">
          {sortedOrders.map(order => {
            const calculatedTotalAmount = order.obligations?.length > 0
              ? order.obligations.reduce((sum, o) => sum + (o.isDeleted ? 0 : o.amount), 0)
              : (order.totalAmount || 0);
            const totalPaid = order.payments?.reduce((sum, p) => sum + (p.isDeleted ? 0 : p.amount), 0) || 0;
            const orderStatus = calculateOrderStatus(order);
            const paymentStatus = calculatePaymentStatus(calculatedTotalAmount, totalPaid);
            const isOpen = openId === order.id;
            const paidIsFull = totalPaid >= calculatedTotalAmount && calculatedTotalAmount > 0;

            return (
              <div key={order.id} className={`v3-item${isOpen ? ' is-open' : ''}`}>
                <div
                  className="v3-item__top"
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/orders/${order.orderId}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) router.push(`/orders/${order.orderId}`); }}
                >
                  <div className="v3-item__thumb"><Icon name="bag" /></div>
                  <div className="v3-item__info">
                    <span className="v3-item__model">
                      <Link href={`/orders/${order.orderId}`} onClick={(e) => e.stopPropagation()}>
                        הזמנה <bdi>{order.orderId}</bdi>
                      </Link>
                    </span>
                    <span className="v3-item__meta">
                      {order.isWeekdayEvent ? (
                        <>
                          לקיחה: <bdi>{order.fromDate ? new Date(order.fromDate).toLocaleDateString('he-IL') : '-'}</bdi>
                          {' · '}
                          החזרה: <bdi>{order.toDate || order.returnDate ? new Date(order.toDate || order.returnDate).toLocaleDateString('he-IL') : '-'}</bdi>
                        </>
                      ) : (
                        <bdi>{order.eventDateHebrew || (order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : (order.orderDate ? new Date(order.orderDate).toLocaleDateString('he-IL') : '-'))}</bdi>
                      )}
                    </span>
                  </div>
                  <Chip variant={getStatusChipVariant(orderStatus)}>{orderStatus}</Chip>
                  <button
                    type="button"
                    className="v3-th-btn v3-item__chev"
                    aria-label={isOpen ? 'סגירת פרטים' : 'פתיחת פרטים'}
                    aria-expanded={isOpen}
                    onClick={(e) => { e.stopPropagation(); setOpenId(isOpen ? null : order.id); }}
                  >
                    <Icon name="chevron-down" anim={false} />
                  </button>
                </div>
                <div className="v3-item__wrap">
                  <div className="v3-item__det">
                    <div className="v3-item__det-in">
                      <Rows>
                        <Row label="סכום לחיוב"><bdi>₪{calculatedTotalAmount}</bdi></Row>
                        <Row label="שולם">
                          <bdi>₪{totalPaid}</bdi>
                          {paidIsFull && <Chip variant="done" icon="check">שולם במלואו</Chip>}
                        </Row>
                        <Row label="סטטוס תשלום"><Chip variant={getPaymentChipVariant(paymentStatus)}>{paymentStatus}</Chip></Row>
                      </Rows>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <span className="v3-faint">סה&quot;כ <bdi>{sortedOrders.length}</bdi> הזמנות</span>
        </div>
      ) : (
        <Empty icon="bag" title="אין הזמנות ללקוח הזה" />
      )}
    </Card>
  );
}
