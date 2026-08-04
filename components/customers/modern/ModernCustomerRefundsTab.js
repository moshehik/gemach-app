'use client';

import React from 'react';
import Link from 'next/link';
import { Save } from 'lucide-react';

export default function ModernCustomerRefundsTab({ customer, onChange, onSubmit, saving, refunds = [] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <form className="moc-card-panel" onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.05rem' }}>פרטי חשבון בנק לזיכויים</h3>
        <div className="moc-grid-2">
          <div>
            <span className="moc-field-label">שם בנק</span>
            <input type="text" name="bankName" value={customer.bankName || ''} onChange={onChange} placeholder="למשל: לאומי" />
          </div>
          <div>
            <span className="moc-field-label">סניף</span>
            <input type="text" name="bankBranch" value={customer.bankBranch || ''} onChange={onChange} placeholder="מספר סניף" />
          </div>
          <div>
            <span className="moc-field-label">מספר חשבון</span>
            <input type="text" name="bankAccount" value={customer.bankAccount || ''} onChange={onChange} />
          </div>
          <div>
            <span className="moc-field-label">שם בעל החשבון</span>
            <input type="text" name="bankAccountName" value={customer.bankAccountName || ''} onChange={onChange} />
          </div>
        </div>
        <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="moc-btn moc-btn-gold" disabled={saving}>
            {saving ? <span className="moc-spinner" /> : <Save size={15} />} {saving ? 'שומר...' : 'שמור פרטי בנק'}
          </button>
        </div>
      </form>

      <div className="moc-card-panel">
        <div className="moc-table-toolbar">
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>היסטוריית זיכויים</h3>
          <span className="moc-hint">{refunds.length} זיכויים</span>
        </div>

        {refunds.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="moc-data-table">
              <thead>
                <tr>
                  <th>תאריך בקשה</th>
                  <th>מס' הזמנה</th>
                  <th>סכום</th>
                  <th>סיבה</th>
                  <th>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map(refund => (
                  <tr key={refund.id}>
                    <td>{new Date(refund.createdAt).toLocaleDateString('he-IL')}</td>
                    <td>
                      {refund.orderId ? (
                        <Link href={`/orders/${refund.orderId}`} style={{ color: 'var(--moc-primary-dark)', textDecoration: 'none', fontWeight: 700 }}>
                          {refund.orderId}
                        </Link>
                      ) : '-'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--moc-danger-text)' }}>₪{refund.amount}</td>
                    <td>{refund.reason || '-'}</td>
                    <td>
                      <span className="moc-badge" style={{
                        background: refund.isExecuted ? 'var(--moc-success-bg)' : 'var(--moc-warning-bg)',
                        color: refund.isExecuted ? '#166534' : '#92400e'
                      }}>
                        {refund.isExecuted ? `בוצע (${new Date(refund.executionDate).toLocaleDateString('he-IL')})` : 'ממתין לביצוע'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="moc-empty-state">אין זיכויים ללקוח זה.</div>
        )}
      </div>
    </div>
  );
}
