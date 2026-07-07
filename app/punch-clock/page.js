'use client';

import { useState, useEffect } from 'react';

export default function PunchClockPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePunch = async (action) => {
    if (!employeeId || !password) {
      setStatusMessage('אנא הזן קוד עובד וסיסמא');
      return;
    }

    setIsLoading(true);
    setStatusMessage('');

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, password, action })
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(`שגיאה: ${data.error}`);
      } else {
        setStatusMessage(action === 'IN' ? '✅ כניסה נרשמה בהצלחה' : '✅ יציאה נרשמה בהצלחה');
        setEmployeeId('');
        setPassword('');
        // Hide success message after 3 seconds
        setTimeout(() => setStatusMessage(''), 3000);
      }
    } catch (e) {
      setStatusMessage('שגיאת תקשורת, אנא נסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', padding: '3rem', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        <h1 style={{ color: 'var(--primary-color)', marginBottom: '0.5rem', fontSize: '2rem' }}>שעון נוכחות</h1>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#333', marginBottom: '2rem', letterSpacing: '2px' }}>
          {currentTime || '...'}
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem', textAlign: 'right' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#555' }}>קוד עובד</label>
          <input 
            type="number" 
            value={employeeId} 
            onChange={(e) => setEmployeeId(e.target.value)} 
            placeholder="הזן קוד עובד"
            style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #eee', fontSize: '1.1rem', textAlign: 'center', transition: 'border-color 0.3s', outline: 'none' }} 
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={(e) => e.target.style.borderColor = '#eee'}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '2rem', textAlign: 'right' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#555' }}>סיסמא</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="הזן סיסמא"
            style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #eee', fontSize: '1.1rem', textAlign: 'center', transition: 'border-color 0.3s', outline: 'none' }} 
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={(e) => e.target.style.borderColor = '#eee'}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => handlePunch('IN')} 
            disabled={isLoading}
            style={{ flex: 1, padding: '1.2rem', borderRadius: '12px', border: 'none', background: '#4CAF50', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(76,175,80,0.3)', transition: 'transform 0.1s' }}
            onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
          >
            כניסה
          </button>
          <button 
            onClick={() => handlePunch('OUT')} 
            disabled={isLoading}
            style={{ flex: 1, padding: '1.2rem', borderRadius: '12px', border: 'none', background: '#f44336', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(244,67,54,0.3)', transition: 'transform 0.1s' }}
            onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
          >
            יציאה
          </button>
        </div>

        {statusMessage && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '8px', background: statusMessage.includes('שגיאה') ? '#ffebee' : '#e8f5e9', color: statusMessage.includes('שגיאה') ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
}
