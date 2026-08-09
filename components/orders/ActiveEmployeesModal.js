import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, User, Clock, X, AlertCircle } from 'lucide-react';

/**
 * מודל "עובדים פעילים בזמן ההזמנה" — בשפת העיצוב "אריג" (modal-backdrop/modal/
 * modal-head/modal-body/modal-foot מ-app/design-system.css).
 *
 * אין פרגמנט design-v2 ייעודי לגוף המודל הזה — scratch/design-v2/fragments/order-detail.html
 * (סביבות שורה 562) מציג רק את כפתור ההפעלה "עובדים פעילים", לא את תוכן המודל עצמו.
 * לכן, כפי שצוין באיתור התקלה, המבנה כאן מורכב מאוצר המחלקות הקיים באפליקציה
 * (אותה קונבנציית מודל בדיוק כמו ItemCapacityModal.js ו-RentalReturnModal.js באותו
 * אשכול "כרטיס הזמנה", עם avatar/status-dot כמו ב-UserMenu.js לשורת עובד) —
 * זהו מקרה ה-fallback המתועד של כלל הברזל: הרכבה מאוצר קיים כשאין מוקאפ ספציפי.
 */
export default function ActiveEmployeesModal({ orderId, isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ executingEmployee: null, activeEmployees: [], orderDate: null });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !orderId) return;

    setLoading(true);
    fetch(`/api/orders/${orderId}/employees`)
      .then(res => {
        if (!res.ok) throw new Error('שגיאה בטעינת נתונים');
        return res.json();
      })
      .then(fetchedData => {
        setData(fetchedData);
        setError(null);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('שגיאה בטעינת העובדים');
        setLoading(false);
      });
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('he-IL', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  const initialsOf = (emp) => `${(emp.firstName || '').charAt(0)}${(emp.lastName || '').charAt(0)}` || 'U';

  const content = (
    <div
      className="modal-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 1600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: '480px', width: '100%', margin: 0 }}>
        <div className="modal-head">
          <strong>
            <Users className="icon" />
            עובדים פעילים (זמן הזמנה)
          </strong>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={onClose} title="סגירה" aria-label="סגירה">
            <X className="icon" />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-inline"><span className="spinner" /> טוען נתונים...</div>
          ) : error ? (
            <div className="callout callout-danger">
              <AlertCircle className="icon" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              <p className="hint" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-3)', marginBottom: '16px' }}>
                <Clock className="icon" style={{ width: '14px', height: '14px' }} />
                תאריך ביצוע: {formatDate(data.orderDate)}
              </p>

              <div className="field">
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-2)' }}>
                  <User className="icon" style={{ width: '14px', height: '14px' }} /> ביצע/ה את ההזמנה
                </span>
                {data.executingEmployee ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="avatar">{initialsOf(data.executingEmployee)}</div>
                    <strong>{data.executingEmployee.fullName || `${data.executingEmployee.firstName} ${data.executingEmployee.lastName}`}</strong>
                  </div>
                ) : (
                  <p className="hint" style={{ color: 'var(--text-3)' }}>לא מוגדר עובד מבצע להזמנה זו.</p>
                )}
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-2)' }}>
                  <Users className="icon" style={{ width: '14px', height: '14px' }} /> עובדים נוספים במשמרת
                </span>
                {data.activeEmployees && data.activeEmployees.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {data.activeEmployees.map(emp => (
                      <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar">
                          {initialsOf(emp)}
                          <span className="status-dot online" />
                        </div>
                        <span style={{ fontWeight: 600 }}>{emp.fullName || `${emp.firstName} ${emp.lastName}`}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hint" style={{ color: 'var(--text-3)' }}>לא נמצאו עובדים נוספים במשמרת בזמן זה.</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
