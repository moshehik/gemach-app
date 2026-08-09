'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';

export default function PunchClockPage() {
  const [employees, setEmployees] = useState(null); // null = loading
  const [employeeId, setEmployeeId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchSharedJson('/api/employees', { ttl: TTL.STATIC })
      .then(list => setEmployees(Array.isArray(list) ? list : []))
      .catch(() => setEmployees([]));
  }, []);

  const filteredEmployees = (employees || [])
    .filter(emp => `${emp.firstName} ${emp.lastName}`.includes(employeeSearch));

  const handlePunch = async (action) => {
    if (!employeeId || !password) {
      setStatusMessage('אנא בחר עובד והזן סיסמא');
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
        setEmployeeSearch('');
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
          <div className="page-desc">בחירת עובד והזנת סיסמא לרישום כניסה או יציאה מהעבודה</div>
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
            <label htmlFor="punch-clock-employeeSearch">עובד</label>
            <div className="combobox">
              <input
                data-element-name="שדה_punch-clock_1"
                className="input"
                id="punch-clock-employeeSearch"
                type="text"
                value={employeeSearch}
                placeholder="הקלד לחיפוש שם..."
                onChange={(e) => {
                  setEmployeeSearch(e.target.value);
                  setIsDropdownOpen(true);
                  setEmployeeId('');
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
              />
              {isDropdownOpen && (
                <div className="combobox-results">
                  {employees === null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', color: 'var(--text-2)', fontSize: '12.5px' }}>
                      <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                      טוען רשימת עובדים...
                    </div>
                  ) : (
                    <>
                      {filteredEmployees.map(emp => (
                        <div
                          key={emp.id}
                          className="combobox-option"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEmployeeId(emp.id.toString());
                            setEmployeeSearch(`${emp.firstName} ${emp.lastName}`);
                            setIsDropdownOpen(false);
                            passwordInputRef.current?.focus();
                          }}
                        >
                          <svg className="icon"><use href="#i-user" /></svg>
                          {emp.firstName} {emp.lastName}
                        </div>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <div className="combobox-option" style={{ cursor: 'default', color: 'var(--text-3)' }}>לא נמצאו תוצאות</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="punch-clock-password">סיסמא</label>
            <div className="password-field">
              <svg className="icon lead-icon"><use href="#i-lock" /></svg>
              <input
                data-element-name="שדה_punch-clock_2"
                ref={passwordInputRef}
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
