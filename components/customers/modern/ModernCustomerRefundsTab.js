'use client';

import React from 'react';
import Link from 'next/link';

export default function ModernCustomerRefundsTab({ customer, onChange, onSubmit, saving, refunds = [] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <form className="card card-pad" onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0, marginBottom: '14px' }}>פרטי חשבון בנק לזיכויים</h3>
        <div className="form-grid">
          <div className="field">
            <label>שם בנק</label>
            <input type="text" className="input" name="bankName" value={customer.bankName || ''} onChange={onChange} placeholder="למשל: לאומי" />
          </div>
          <div className="field">
            <label>סניף</label>
            <input type="text" className="input" name="bankBranch" value={customer.bankBranch || ''} onChange={onChange} placeholder="מספר סניף" />
          </div>
          <div className="field">
            <label>מספר חשבון</label>
            <input type="text" className="input" name="bankAccount" value={customer.bankAccount || ''} onChange={onChange} />
          </div>
          <div className="field">
            <label>שם בעל החשבון</label>
            <input type="text" className="input" name="bankAccountName" value={customer.bankAccountName || ''} onChange={onChange} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <svg className="icon"><use href="#i-check" /></svg>}
            {saving ? 'שומר...' : 'שמור פרטי בנק'}
          </button>
        </div>
      </form>

      <div>
        <div className="toolbar">
          <div style={{ fontWeight: 800, fontSize: '14.5px' }}>היסטוריית זיכויים</div>
          <span className="spacer" />
          <span className="hint" style={{ color: 'var(--text-3)' }}>{refunds.length} זיכויים</span>
        </div>

        {refunds.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>תאריך בקשה</th>
                  <th>מס&apos; הזמנה</th>
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
                        <Link href={`/orders/${refund.orderId}`} className="cell-primary" style={{ color: 'var(--primary-solid)' }}>
                          {refund.orderId}
                        </Link>
                      ) : '-'}
                    </td>
                    <td className="cell-primary" style={{ color: 'var(--danger)' }}>₪{refund.amount}</td>
                    <td>{refund.reason || '-'}</td>
                    <td>
                      <span className={`badge ${refund.isExecuted ? 'badge-success' : 'badge-warning'}`}>
                        {refund.isExecuted ? `בוצע (${new Date(refund.executionDate).toLocaleDateString('he-IL')})` : 'ממתין לביצוע'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-foot">
              <span>סה&quot;כ זיכויים מוצגים: {refunds.length}</span>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <svg className="icon"><use href="#i-refresh" /></svg>
            <p>אין זיכויים ללקוח זה.</p>
          </div>
        )}
      </div>
    </div>
  );
}
