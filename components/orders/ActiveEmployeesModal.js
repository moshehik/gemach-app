'use client';

import React, { useState, useEffect } from 'react';
import '../../app/v3/tokens.css';
import '../../app/v3/components.css';
import { Dialog, Btn, Icon } from '../../app/v3/ui/components';
import './modern/orderCardV3.css';

/**
 * חלונית "מי עבד בזמן ההזמנה" - תצוגה בלבד (אישור/צפייה, לכן חלונית v3 עם תמיכה בכהה ובהיר).
 * מבצע ההזמנה + העובדים האחרים שהיו במשמרת באותה שעה. הקריאה לשרת נשארה זהה: נטענת רק כשהחלונית נפתחת.
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('he-IL', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  const initialsOf = (emp) => `${(emp.firstName || '').charAt(0)}${(emp.lastName || '').charAt(0)}` || 'U';

  return (
    <Dialog
      open={!!isOpen}
      variant="confirm"
      mode="light"
      icon="users"
      title="מי עבד בזמן ההזמנה"
      sub={!loading && !error && data.orderDate ? `ההזמנה בוצעה ב-${formatDate(data.orderDate)}` : undefined}
      onClose={onClose}
      actions={<Btn variant="primary" onClick={onClose}>סגירה</Btn>}
    >
      {loading ? (
        <div className="v3-empty" role="status" aria-live="polite">
          <Icon name="loader" size="xl" loop />
          <span>טוענים...</span>
        </div>
      ) : error ? (
        <p className="v3-error" role="alert"><Icon name="alert-circle" size="sm" />{error}</p>
      ) : (
        <div className="v3-dlg-rows">
          <div className="v3-dlg-row">
            <div className="v3-dlg-row__ico"><Icon name="user" /></div>
            <div className="v3-dlg-row__t">
              <span className="v3-faint">ביצע/ה את ההזמנה</span>
              <div>
                {data.executingEmployee
                  ? <strong>{data.executingEmployee.fullName || `${data.executingEmployee.firstName} ${data.executingEmployee.lastName}`}</strong>
                  : 'לא הוגדר עובד מבצע להזמנה הזו.'}
              </div>
            </div>
            {data.executingEmployee && <span className="v3-avatar" aria-hidden="true">{initialsOf(data.executingEmployee)}</span>}
          </div>

          <div className="v3-dlg-row">
            <div className="v3-dlg-row__ico"><Icon name="users" /></div>
            <div className="v3-dlg-row__t">
              <span className="v3-faint">עובדים נוספים במשמרת</span>
              {data.activeEmployees && data.activeEmployees.length > 0 ? (
                <div className="oc-emp-list">
                  {data.activeEmployees.map(emp => (
                    <div key={emp.id} className="oc-emp">
                      <span className="v3-avatar" aria-hidden="true">{initialsOf(emp)}</span>
                      <strong>{emp.fullName || `${emp.firstName} ${emp.lastName}`}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div>לא היו עובדים נוספים במשמרת באותו זמן.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
