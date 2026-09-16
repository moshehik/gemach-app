'use client';

import { createPortal } from 'react-dom';

// רשימת ההזמנות שלא הוחזרו (OverdueRemindersWatcher) - מוצג רק בגמח נווה יעקב
// (ר' showOverdueRemindersPopup/enable_unreturned_orders_popup ב-app/layout.js).
// שורות ממוינות לפי מספר הזמנה, עם קישור/אייקון נקי לכניסה לאותה הזמנה - במקום
// ה-window.customConfirm הטקסטואלי הקודם שלא תמך בקישורים.
export default function OverdueOrdersModal({ isOpen, orders, onClose }) {
  if (!isOpen) return null;

  const sortedOrders = [...orders].sort((a, b) => a.orderId - b.orderId);

  const content = (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '34px 16px' }}
    >
      <div
        className="modal animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}
      >
        <div className="modal-head">
          <strong>
            <svg className="icon"><use href="#i-alert-tri" /></svg>
            הזמנות שלא הוחזרו ({sortedOrders.length})
          </strong>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" aria-label="סגירה">
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>

        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>המשפחות הבאות עדיין לא החזירו את השמלות ומועד ההחזרה שלהן עבר:</p>
          <div className="table-wrap">
            <div className="table-scroll" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>הזמנה</th>
                    <th>שם לקוח</th>
                    <th>ימי איחור</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((order) => (
                    <tr key={order.orderId}>
                      <td>{order.orderId}</td>
                      <td>{order.customerName}</td>
                      <td><span className="badge badge-danger">{order.daysLate}</span></td>
                      <td>
                        <a
                          href={`/orders/${order.orderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-icon-only btn-sm"
                          title="כניסה להזמנה"
                          aria-label="כניסה להזמנה"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="icon"><use href="#i-link" /></svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
