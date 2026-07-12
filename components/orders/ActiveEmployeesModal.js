import React, { useState, useEffect } from 'react';
import { Users, User, Clock, X } from 'lucide-react';

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
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      direction: 'rtl'
    }}>
      <div style={{
        background: 'var(--card-bg, #fff)',
        padding: '2rem',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '500px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#64748b'
          }}
        >
          <X size={24} />
        </button>

        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0, color: 'var(--primary-color)', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>
          <Users size={28} />
          עובדים פעילים (זמן הזמנה)
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>טוען נתונים...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : error ? (
          <div style={{ color: '#d32f2f', textAlign: 'center', padding: '2rem 0', fontWeight: 'bold' }}>
            {error}
          </div>
        ) : (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={16} />
              תאריך ביצוע: {formatDate(data.orderDate)}
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#0f172a', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={20} color="#3b82f6" /> 
                עובד מבצע
              </h3>
              {data.executingEmployee ? (
                <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e40af' }}>
                    {data.executingEmployee.fullName || `${data.executingEmployee.firstName} ${data.executingEmployee.lastName}`}
                  </span>
                </div>
              ) : (
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', color: '#64748b' }}>
                  לא מוגדר עובד מבצע להזמנה זו.
                </div>
              )}
            </div>

            <div>
              <h3 style={{ color: '#0f172a', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} color="#10b981" />
                עובדים נוספים במשמרת
              </h3>
              {data.activeEmployees && data.activeEmployees.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.activeEmployees.map(emp => (
                    <li key={emp.id} style={{ background: '#ecfdf5', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #a7f3d0', color: '#065f46', fontWeight: 'bold' }}>
                      {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', color: '#64748b' }}>
                  לא נמצאו עובדים נוספים במשמרת בזמן זה.
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'left' }}>
          <button 
            onClick={onClose}
            style={{ padding: '0.6rem 1.5rem', background: 'var(--element-bg, #f1f5f9)', color: 'var(--text-main, #334155)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
