'use client';

import React from 'react';
import { Wallet, AlertTriangle, Check } from 'lucide-react';

export default function ModernCustomerPaymentsTab({ payments = [], customer }) {
  const totalRequired = (customer?.orders || []).reduce((acc, order) => {
    const orderTotal = order.obligations?.length > 0
      ? order.obligations.reduce((sum, o) => sum + (o.isDeleted ? 0 : o.amount), 0)
      : (order.totalAmount || 0);
    return acc + orderTotal;
  }, 0);

  const totalPayments = payments.filter(p => p.entryType !== 'refund').reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalRefunds = payments.filter(p => p.entryType === 'refund').reduce((sum, p) => sum + (p.amount || 0), 0);
  
  // החוב הוא סך הכל לתשלום פחות מה ששולם בפועל. זיכויים ללקוח לא מקטינים את החוב אלא להפך (אם החזרנו כסף ללקוח, הוא שילם פחות בפועל). 
  // לכן, התשלום האפקטיבי הוא (תשלומים - זיכויים).
  const effectivePaid = totalPayments - totalRefunds;
  const debt = totalRequired - effectivePaid;

  return (
    <div>
      <div className="moc-pay-summary">
        <div className="moc-pay-tile" style={{ background: 'var(--moc-light-gold)' }}>
          <div className="moc-pt-lbl">סך הכל חיובים</div>
          <div className="moc-pt-amt" style={{ color: 'var(--moc-gold)' }}>₪{totalRequired.toLocaleString('he-IL')}</div>
        </div>
        <div className="moc-pay-tile paid">
          <div className="moc-pt-lbl">סה"כ שולם</div>
          <div className="moc-pt-amt">₪{totalPayments.toLocaleString('he-IL')}</div>
        </div>
        {totalRefunds > 0 && (
          <div className="moc-pay-tile debt">
            <div className="moc-pt-lbl">סה"כ זיכויים</div>
            <div className="moc-pt-amt">₪{totalRefunds.toLocaleString('he-IL')}</div>
          </div>
        )}
        <div className={`moc-pay-tile ${debt > 0 ? 'debt' : debt < 0 ? 'credit' : 'paid'}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="moc-pt-lbl" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {debt > 0 ? <AlertTriangle size={15} /> : debt < 0 ? <Wallet size={15} /> : <Check size={15} />}
            {debt > 0 ? 'יתרת חוב' : debt < 0 ? 'יתרת זכות' : 'מאוזן'}
          </div>
          {debt !== 0 ? (
            <div className="moc-pt-amt" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              ₪{Math.abs(debt).toLocaleString('he-IL')}
              <span className="moc-amt-badge" style={{ fontSize: '0.8rem', padding: '2px 6px', background: 'currentColor', color: '#fff', borderRadius: '4px' }}>
                {debt > 0 ? 'חובה' : 'זכות'}
              </span>
            </div>
          ) : (
            <div className="moc-pt-amt">₪0</div>
          )}
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
