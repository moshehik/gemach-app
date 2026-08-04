'use client';

import React from 'react';

export default function ModernCustomerPaymentsTab({ payments = [] }) {
  const totalPayments = payments.filter(p => p.entryType !== 'refund').reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalRefunds = payments.filter(p => p.entryType === 'refund').reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div>
      <div className="moc-pay-summary">
        <div className="moc-pay-tile paid">
          <div className="moc-pt-lbl">סה"כ תשלומים</div>
          <div className="moc-pt-amt">₪{totalPayments.toLocaleString('he-IL')}</div>
        </div>
        <div className="moc-pay-tile debt">
          <div className="moc-pt-lbl">סה"כ זיכויים</div>
          <div className="moc-pt-amt">₪{totalRefunds.toLocaleString('he-IL')}</div>
        </div>
      </div>

      <div className="moc-card-panel">
        <div className="moc-table-toolbar">
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>היסטוריית תשלומים</h3>
          <span className="moc-hint">{payments.length} רשומות</span>
        </div>

        {payments.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="moc-data-table">
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>סוג</th>
                  <th>הזמנה מקושרת</th>
                  <th>אופן תשלום</th>
                  <th>סכום</th>
                  <th>הערות</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(payment => {
                  const isRefund = payment.entryType === 'refund';
                  return (
                    <tr key={`${payment.entryType}-${payment.id}`}>
                      <td>{new Date(payment.paymentDate).toLocaleDateString('he-IL')}</td>
                      <td>
                        <span className="moc-badge" style={{
                          background: isRefund ? 'var(--moc-danger-bg)' : 'var(--moc-success-bg)',
                          color: isRefund ? 'var(--moc-danger-text)' : '#166534'
                        }}>
                          {isRefund ? 'זיכוי' : 'תשלום'}
                        </span>
                      </td>
                      <td>{payment.orderId ? `הזמנה ${payment.orderId}` : '-'}</td>
                      <td>{isRefund ? (payment.reason || 'זיכוי') : payment.paymentMethod}</td>
                      <td style={{ fontWeight: 700, color: isRefund ? 'var(--moc-danger-text)' : 'var(--moc-primary-dark)' }}>{isRefund ? '-' : ''}₪{payment.amount}</td>
                      <td>{isRefund ? (payment.isExecuted ? 'בוצע' : 'ממתין לביצוע') : (payment.notes || '-')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="moc-empty-state">אין היסטוריית תשלומים ללקוח זה.</div>
        )}
      </div>
    </div>
  );
}
