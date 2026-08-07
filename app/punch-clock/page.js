'use client';

import { useState, useEffect } from 'react';

export default function PunchClockPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  const isError = statusMessage.includes('שגיאה');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>שעון נוכחות</h1>
          <div className="page-desc">הזנת קוד עובד וסיסמא לרישום כניסה או יציאה מהעבודה</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="card card-pad" style={{ maxWidth: '420px', width: '100%' }}>

          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div className="kpi-icon" style={{ background: 'var(--primary-tint)', color: 'var(--primary-solid)', margin: '0 auto 10px' }}>
              <svg className="icon"><use href="#i-clock" /></svg>
            </div>
            <div className="kpi-value" style={{ fontSize: '40px' }}>{currentTime || '...'}</div>
            <div className="kpi-label">השעה כעת</div>
          </div>

          <div className="field">
            <label htmlFor="punch-clock-employeeId">קוד עובד</label>
            <input
              data-element-name="שדה_punch-clock_1"
              className="input"
              id="punch-clock-employeeId"
              type="number"
              inputMode="numeric"
              dir="auto"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="הזן קוד עובד"
              style={{ textAlign: 'center' }}
            />
          </div>

          <div className="field">
            <label htmlFor="punch-clock-password">סיסמא</label>
            <div className="password-field">
              <svg className="icon lead-icon"><use href="#i-lock" /></svg>
              <input
                data-element-name="שדה_punch-clock_2"
                className="input"
                id="punch-clock-password"
                type={showPassword ? 'text' : 'password'}
                dir="auto"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="הזן סיסמא"
              />
              <button type="button" className="toggle-visibility" title="הצג סיסמה" onClick={() => setShowPassword(v => !v)}>
                <svg className="icon"><use href="#i-eye" /></svg>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              data-element-name="כפתור_punch-clock_3"
              type="button"
              onClick={() => handlePunch('IN')}
              disabled={isLoading}
              className="btn btn-primary btn-lg"
              style={{ flex: 1 }}
            >
              {isLoading ? <span className="spinner" /> : <svg className="icon"><use href="#i-check-circle" /></svg>}
              כניסה
            </button>
            <button
              data-element-name="כפתור_punch-clock_4"
              type="button"
              onClick={() => handlePunch('OUT')}
              disabled={isLoading}
              className="btn btn-danger btn-lg"
              style={{ flex: 1 }}
            >
              {isLoading ? <span className="spinner" /> : <svg className="icon"><use href="#i-logout" /></svg>}
              יציאה
            </button>
          </div>

          {statusMessage && (
            <div className={`callout ${isError ? 'callout-danger' : 'callout-success'}`} style={{ marginTop: '18px' }}>
              <svg className="icon"><use href={isError ? '#i-alert-circle' : '#i-check-circle'} /></svg>
              <div>{statusMessage}</div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
