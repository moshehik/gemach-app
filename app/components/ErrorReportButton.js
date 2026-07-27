'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bug, X, Send } from 'lucide-react';

export default function ErrorReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [userText, setUserText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userText.trim()) {
      setError('יש להזין תיאור שגיאה');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      userText,
      url: window.location.href,
      title: document.title,
      time: new Date().toLocaleString('he-IL'),
      queryParams: window.location.search || 'אין'
    };

    try {
      const res = await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
          setUserText('');
        }, 2000);
      } else {
        setError(data.error || 'שגיאה בשליחת דיווח');
      }
    } catch (err) {
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        title="דיווח על שגיאה"
        className="icon-nav-link"
        style={{ 
          background: 'none', 
          border: 'none', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#ef4444',
          position: 'relative',
          padding: '0.25rem'
        }}
      >
        <Bug size={22} />
      </button>

      {isOpen && mounted && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          direction: 'rtl'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            width: '90%',
            maxWidth: '500px',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bug size={20} /> דיווח על שגיאה במערכת
              </h3>
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && <div style={{ color: '#ef4444', fontSize: '0.9rem', background: '#fef2f2', padding: '0.5rem', borderRadius: '6px' }}>{error}</div>}
              {success && <div style={{ color: '#16a34a', fontSize: '0.9rem', background: '#f0fdf4', padding: '0.5rem', borderRadius: '6px' }}>הדיווח נשלח בהצלחה למתכנת! תודה.</div>}
              
              <div style={{ background: 'var(--input-bg)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <p style={{ margin: '0 0 0.5rem 0' }}><strong>הנתונים הבאים יישלחו אוטומטית ברקע:</strong></p>
                <ul style={{ margin: 0, paddingRight: '1.2rem' }}>
                  <li>שעת הדיווח וכתובת המסך הנוכחי</li>
                  <li>שם החלון ופרמטרים פעילים</li>
                </ul>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--text-color)', fontWeight: '500' }}>
                  אנא תאר בקצרה מה ניסית לעשות ומה קרה:
                </label>
                <textarea
                  value={userText}
                  onChange={e => setUserText(e.target.value)}
                  className="form-control"
                  placeholder="לדוגמה: לחצתי על כפתור השמירה אך הדף נתקע והופיעה שגיאה אדומה..."
                  style={{ width: '100%', height: '120px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', resize: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{ background: 'transparent', color: '#64748b', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}
                >
                  ביטול
                </button>
                <button 
                  type="submit"
                  disabled={loading || success}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: '500', cursor: (loading || success) ? 'not-allowed' : 'pointer', opacity: (loading || success) ? 0.7 : 1 }}
                >
                  {loading ? 'שולח...' : <><Send size={16} /> שליחה למתכנת</>}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
