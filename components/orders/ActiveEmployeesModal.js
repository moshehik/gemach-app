import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, User, Clock, X } from 'lucide-react';

/**
 * מודל "עובדים פעילים בזמן ההזמנה" — בשפת העיצוב המודרנית (מחלקות moc,
 * שמוזרקות גלובלית מדף כרטיס ההזמנה).
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

  const content = (
    <div className="moc moc-modal-overlay" style={{ zIndex: 1600 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="moc-modal-box">
        <div className="moc-modal-head">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={19} /> עובדים פעילים (זמן הזמנה)</h3>
          <button className="moc-close-x" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="moc-modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <span className="moc-spinner lg" style={{ margin: '0 auto' }} />
              <p className="moc-hint" style={{ marginTop: '12px' }}>טוען נתונים...</p>
            </div>
          ) : error ? (
            <div style={{ color: 'var(--moc-danger-text)', textAlign: 'center', padding: '24px 0', fontWeight: 700 }}>
              {error}
            </div>
          ) : (
            <>
              <div className="moc-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                <Clock size={15} />
                תאריך ביצוע: {formatDate(data.orderDate)}
              </div>

              <span className="moc-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} /> ביצע/ה את ההזמנה
              </span>
              {data.executingEmployee ? (
                <div className="moc-employee-row" style={{ background: 'var(--moc-primary-light)', borderRadius: '8px', padding: '10px 12px', borderBottom: 'none', fontWeight: 700, marginBottom: '16px' }}>
                  <span>{data.executingEmployee.fullName || `${data.executingEmployee.firstName} ${data.executingEmployee.lastName}`}</span>
                  <span className="moc-hint">קופאי/ת ההזמנה</span>
                </div>
              ) : (
                <div className="moc-empty-state" style={{ padding: '12px 0', textAlign: 'right' }}>לא מוגדר עובד מבצע להזמנה זו.</div>
              )}

              <span className="moc-field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <Users size={14} /> עובדים נוספים במשמרת
              </span>
              {data.activeEmployees && data.activeEmployees.length > 0 ? (
                <div>
                  {data.activeEmployees.map(emp => (
                    <div key={emp.id} className="moc-employee-row">
                      <span style={{ fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--moc-success-text)', marginLeft: '8px' }} />
                        {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="moc-empty-state" style={{ padding: '12px 0', textAlign: 'right' }}>לא נמצאו עובדים נוספים במשמרת בזמן זה.</div>
              )}
            </>
          )}
        </div>

        <div className="moc-modal-foot">
          <button className="moc-btn moc-btn-outline" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
