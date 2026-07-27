'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LifeBuoy, X, Send } from 'lucide-react';

export default function ErrorReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [userText, setUserText] = useState('');
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleGlobalClick = (e) => {
      let target = e.target;
      while (target && target !== document.body) {
        if (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button' || (target.tagName === 'A' && (target.classList?.contains('btn') || target.classList?.contains('button')))) {
          let btnText = target.innerText || target.textContent || target.title || target.getAttribute('aria-label') || 'כפתור ללא טקסט';
          btnText = btnText.trim().substring(0, 50).replace(/\n/g, ' ');
          if (btnText) {
            window.__lastButtons = window.__lastButtons || [];
            window.__lastButtons.push(btnText);
            if (window.__lastButtons.length > 5) {
              window.__lastButtons.shift();
            }
          }
          break;
        }
        target = target.parentElement;
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userText.trim()) {
      setToast({ message: 'יש להזין תיאור שגיאה', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setIsOpen(false);
    setToast({ message: 'שולח דיווח למתכנת, אנא המתן...', type: 'info' });

    const payload = {
      userText,
      url: window.location.href,
      title: document.title,
      time: new Date().toLocaleString('he-IL'),
      queryParams: window.location.search || 'אין',
      lastButtons: window.__lastButtons || []
    };

    try {
      const res = await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ message: 'הדיווח נשלח בהצלחה למתכנת! תודה.', type: 'success' });
        setUserText('');
      } else {
        setToast({ message: data.error || 'שגיאה בשליחת דיווח', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'שגיאת תקשורת', type: 'error' });
    }
    
    setTimeout(() => {
      setToast(null);
    }, 4000);
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
          color: '#6366f1', // modern indigo instead of scary red
          position: 'relative',
          padding: '0.25rem'
        }}
      >
        <LifeBuoy size={22} />
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
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eef2ff' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#4338ca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LifeBuoy size={20} /> דיווח על תקלה / בקשה לשיפור
              </h3>
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6366f1' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--text-color)', fontWeight: '500' }}>
                  המערכת יודעת איפה אתה נמצא, רק כתוב מהי התקלה / בקשה לשיפור:
                </label>
                <textarea
                  value={userText}
                  onChange={e => setUserText(e.target.value)}
                  className="form-control"
                  placeholder="פרט כאן..."
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
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#6366f1', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}
                >
                  <Send size={16} /> שליחה למתכנת
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {toast && mounted && createPortal(
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999999,
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: '500',
          direction: 'rtl',
          animation: 'fadeInDown 0.3s ease-out'
        }}>
          {toast.message}
        </div>,
        document.body
      )}
    </>
  );
}
