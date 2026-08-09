'use client';

import React from 'react';

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

  const debtIcon = debt > 0 ? 'i-alert-tri' : debt < 0 ? 'i-wallet' : 'i-check';
  const debtLabel = debt > 0 ? 'יתרת חוב' : debt < 0 ? 'יתרת זכות' : 'מאוזן';
  const debtColor = debt > 0 ? 'var(--danger)' : debt < 0 ? 'var(--info)' : 'var(--success)';
  const debtTint = debt > 0 ? 'var(--danger-tint)' : debt < 0 ? 'var(--info-tint)' : 'var(--success-tint)';

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}><svg className="icon"><use href="#i-coin" /></svg></div></div>
          <div className="kpi-label">סך הכל חיובים</div>
          <div className="kpi-value">₪{totalRequired.toLocaleString('he-IL')}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}><svg className="icon"><use href="#i-wallet" /></svg></div></div>
          <div className="kpi-label">סה&quot;כ שולם</div>
          <div className="kpi-value">₪{totalPayments.toLocaleString('he-IL')}</div>
        </div>
        {totalRefunds > 0 && (
          <div className="kpi-card">
            <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}><svg className="icon"><use href="#i-refresh" /></svg></div></div>
            <div className="kpi-label">סה&quot;כ זיכויים</div>
            <div className="kpi-value">₪{totalRefunds.toLocaleString('he-IL')}</div>
          </div>
        )}
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: debtTint, color: debtColor }}><svg className="icon"><use href={`#${debtIcon}`} /></svg></div></div>
          <div className="kpi-label">{debtLabel}</div>
          <div className="kpi-value" style={{ color: debtColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
            ₪{Math.abs(debt).toLocaleString('he-IL')}
            {debt !== 0 && (
              <span className="badge" style={{ background: debtColor, color: 'var(--text-on-primary)', fontSize: '10px' }}>
                {debt > 0 ? 'חובה' : 'זכות'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div style={{ fontWeight: 800, fontSize: '14.5px' }}>היסטוריית תשלומים</div>
        <span className="spacer" />
        <span className="hint" style={{ color: 'var(--text-3)' }}>{payments.length} רשומות</span>
      </div>

      {payments.length > 0 ? (
        <div className="table-wrap">
          <div className="table-scroll">
          <table className="data">
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
                      <span className={`badge ${isRefund ? 'badge-danger' : 'badge-success'}`}>{isRefund ? 'זיכוי' : 'תשלום'}</span>
                    </td>
                    <td>{payment.orderId ? `הזמנה ${payment.orderId}` : '-'}</td>
                    <td>{isRefund ? (payment.reason || 'זיכוי') : payment.paymentMethod}</td>
                    <td className="cell-primary" style={{ color: isRefund ? 'var(--danger)' : 'var(--primary-solid)' }}>{isRefund ? '-' : ''}₪{payment.amount}</td>
                    <td className={isRefund ? undefined : (payment.notes ? undefined : 'cell-muted')}>
                      {isRefund ? (payment.isExecuted ? 'בוצע' : 'ממתין לביצוע') : (payment.notes || '-')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="table-foot">
            <span>סה&quot;כ רשומות מוצגות: {payments.length}</span>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <svg className="icon"><use href="#i-card" /></svg>
          <p>אין היסטוריית תשלומים ללקוח זה.</p>
        </div>
      )}
    </div>
  );
}
