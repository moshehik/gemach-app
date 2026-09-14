'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// דיווח 7dad77c4 (נווה יעקב): "הוסף חלונית של מושכר שצריך לחזור - האירוע אתמול או
// לפני אתמול" - בניגוד ל-OverdueRemindersWatcher (alert חד-פעמי לפי סף 7 ימים
// מהחזרה), זו חלונית קבועה בעמוד ההשכרות עצמו, לפי תאריך האירוע.
export default function RentedPastEventWidget() {
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/orders/rented-past-event', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setOrders(data.orders || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!orders || orders.length === 0) return null;

  return (
    <div className="card card-pad" style={{ marginBottom: '16px', borderColor: 'var(--warning)' }}>
      <div className="card-title-row" style={{ color: 'var(--warning)', fontWeight: 800, marginBottom: '10px' }}>
        <svg className="icon" style={{ color: 'var(--warning)' }}><use href="#i-alert-circle" /></svg>
        <span>מושכר שצריך לחזור - האירוע כבר עבר ({orders.length})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {orders.slice(0, 10).map((o) => (
          <Link key={o.orderId} href={`/orders/${o.orderId}`} className="list-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ flex: 1 }}>
              <strong>{o.customerName}</strong>
              <span className="hint" style={{ color: 'var(--text-3)', marginInlineStart: '8px' }}>הזמנה #{o.orderId}</span>
            </div>
            <span className="hint" style={{ color: 'var(--warning)', fontWeight: 700 }}>
              {o.daysSinceEvent <= 1 ? 'האירוע היה אתמול' : `האירוע לפני ${o.daysSinceEvent} ימים`}
            </span>
          </Link>
        ))}
        {orders.length > 10 && (
          <span className="hint" style={{ color: 'var(--text-3)' }}>... ועוד {orders.length - 10} הזמנות</span>
        )}
      </div>
    </div>
  );
}
