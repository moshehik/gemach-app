'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Lock, User, LogIn, X, Loader2, ShieldCheck, KeyRound } from 'lucide-react';

export default function LoginScreen({ isModal = false, onClose }) {
  const [employees, setEmployees] = useState([]);
  const [isFetchingEmployees, setIsFetchingEmployees] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [password, setPassword] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();

  // Trusted-device fast path: this computer may have been marked trusted by a manager
  // (see /admin/trusted-devices), which lets whoever logs in from it use just the last 4
  // digits of their real password instead of typing the whole thing every time.
  const [deviceTrusted, setDeviceTrusted] = useState(false);
  const [usePinMode, setUsePinMode] = useState(false);

  // "שכחתי סיסמה" - emails a temporary password to the employee's address on file.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotResult, setForgotResult] = useState(null);

  // Forced "set a new password" prompt, shown right after logging in with a temporary
  // password issued by the forgot-password/reset flow (Employee.mustResetPassword).
  const [resetRequired, setResetRequired] = useState(false);
  const [resetEmployeeId, setResetEmployeeId] = useState(null);
  const [newPass1, setNewPass1] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch('/api/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmployees(data);
        }
        setIsFetchingEmployees(false);
      })
      .catch(err => {
        console.error('Failed to load employees:', err);
        setIsFetchingEmployees(false);
      });

    fetch('/api/auth/device-status')
      .then(res => res.json())
      .then(data => {
        setDeviceTrusted(!!data.trusted);
        setUsePinMode(!!data.trusted);
      })
      .catch(() => {});
  }, []);

  const resolveEmployeeId = () => {
    let finalEmployeeId = selectedEmployee;
    if (!finalEmployeeId && searchTerm) {
      const match = employees.find(emp => `${emp.firstName} ${emp.lastName}`.trim() === searchTerm.trim());
      if (match) {
        finalEmployeeId = match.id;
        setSelectedEmployee(match.id);
      }
    }
    return finalEmployeeId;
  };

  const finishLogin = () => {
    if (isModal && onClose) {
      onClose(true);
    } else {
      router.push('/');
    }
    router.refresh();
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    const finalEmployeeId = resolveEmployeeId();
    const credential = usePinMode ? pinValue : password;

    if (!finalEmployeeId || !credential) {
      setError(usePinMode ? 'נא לבחור עובד ולהזין 4 ספרות' : 'נא לבחור עובד ולהזין סיסמה');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usePinMode
          ? { employeeId: finalEmployeeId, pin: credential }
          : { employeeId: finalEmployeeId, password: credential })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.mustResetPassword) {
          setResetEmployeeId(finalEmployeeId);
          setResetRequired(true);
        } else {
          finishLogin();
        }
      } else {
        // The server may tell us the PIN path isn't usable right now (device not trusted
        // after all, or this employee has no PIN yet) - fall back to the full password field.
        if (data.requireFullPassword) {
          setUsePinMode(false);
          setPinValue('');
        }
        setError(data.message || 'שגיאה בהתחברות');
      }
    } catch (err) {
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const finalEmployeeId = resolveEmployeeId();
    if (!finalEmployeeId) {
      setForgotResult({ success: false, message: 'יש לבחור קודם עובד מהרשימה' });
      return;
    }
    setForgotSending(true);
    setForgotResult(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: finalEmployeeId })
      });
      const data = await res.json();
      setForgotResult({ success: !!data.success, message: data.message || (data.success ? 'נשלח בהצלחה' : 'שליחה נכשלה') });
    } catch (err) {
      setForgotResult({ success: false, message: 'שגיאת תקשורת' });
    } finally {
      setForgotSending(false);
    }
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    if (!newPass1 || newPass1.length < 4) {
      setResetError('הסיסמה החדשה קצרה מדי (לפחות 4 תווים)');
      return;
    }
    if (newPass1 !== newPass2) {
      setResetError('הסיסמאות אינן תואמות');
      return;
    }
    setResetSaving(true);
    try {
      const res = await fetch(`/api/employees/${resetEmployeeId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPass1 })
      });
      const data = await res.json();
      if (data.success) {
        setResetRequired(false);
        finishLogin();
      } else {
        setResetError(data.message || 'שגיאה בשמירת הסיסמה');
      }
    } catch (err) {
      setResetError('שגיאת תקשורת');
    } finally {
      setResetSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: 'white',
    padding: '1.1rem 3.2rem 1.1rem 1rem',
    borderRadius: '14px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'all 0.2s ease'
  };

  const content = (
    <div style={{
      ...(isModal ? {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      } : {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        backgroundImage: 'radial-gradient(circle at 50% -20%, #3b82f6 0%, transparent 40%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      }),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem'
    }} dir="rtl">

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '3rem 2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(59, 130, 246, 0.1)'
      }}>
        {isModal && onClose && (
          <button data-element-name="כפתור_LoginScreen_1" onClick={() => onClose(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color='white'} onMouseOut={e => e.currentTarget.style.color='#94a3b8'}>
             <X data-element-name="רכיב_LoginScreen_2" size={24} />
          </button>
        )}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: '76px',
            height: '76px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
            boxShadow: '0 10px 25px rgba(37, 99, 235, 0.4), inset 0 2px 4px rgba(255,255,255,0.3)',
            transform: 'rotate(-5deg)'
          }}>
            <Lock data-element-name="רכיב_LoginScreen_3" size={34} color="white" strokeWidth={2.5} style={{ transform: 'rotate(5deg)' }} />
          </div>
          <h2 style={{ fontSize: '2.1rem', fontWeight: '800', color: 'white', margin: '0 0 0.5rem 0', letterSpacing: '-0.025em' }}>
            כניסת עובדים
          </h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '1.05rem' }}>
            נא להזדהות על מנת להמשיך למערכת
          </p>
          {deviceTrusted && (
            <p style={{ color: '#60a5fa', margin: '0.6rem 0 0', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={15} />
              מחשב זה מוגדר כמערכת מהימנה
            </p>
          )}
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#fca5a5',
              padding: '1rem',
              borderRadius: '12px',
              fontSize: '0.95rem',
              textAlign: 'center',
              fontWeight: '500',
              animation: 'shake 0.4s ease-in-out'
            }}>
              {error}
            </div>
          )}

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              שם העובד
            </label>
            <div style={{ position: 'relative' }}>
              <input data-element-name="שדה_LoginScreen_4"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedEmployee('');
                  setIsDropdownOpen(true);
                }}
                disabled={isFetchingEmployees}
                placeholder={isFetchingEmployees ? '-- טוען עובדים... --' : 'הקלד או בחר מהרשימה'}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  padding: '1.1rem 3.2rem 1.1rem 1rem',
                  borderRadius: '14px',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.25)';
                  setIsDropdownOpen(true);
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {isFetchingEmployees ? (
                <Loader2 data-element-name="רכיב_LoginScreen_5" size={20} color="#3b82f6" style={{ position: 'absolute', right: '1.1rem', top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' }} />
              ) : (
                <User data-element-name="לחיץ_LoginScreen_6"
                  size={20}
                  color={selectedEmployee ? '#3b82f6' : '#64748b'}
                  style={{ position: 'absolute', right: '1.1rem', top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s', cursor: 'pointer' }}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                />
              )}

              {isDropdownOpen && !isFetchingEmployees && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '0.5rem',
                  background: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 50,
                  border: '1px solid #e2e8f0'
                }}>
                  {employees.filter(emp => `${emp.firstName} ${emp.lastName}`.includes(searchTerm)).length > 0 ? (
                    employees.filter(emp => `${emp.firstName} ${emp.lastName}`.includes(searchTerm)).map(emp => (
                      <div data-element-name="לחיץ_LoginScreen_7"
                        key={emp.id}
                        onClick={() => {
                          setSelectedEmployee(emp.id);
                          setSearchTerm(`${emp.firstName} ${emp.lastName}`);
                          setIsDropdownOpen(false);
                        }}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          color: '#0f172a',
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.2s',
                          background: selectedEmployee === emp.id ? '#e0e7ff' : 'transparent',
                          fontWeight: selectedEmployee === emp.id ? '600' : '400'
                        }}
                        onMouseOver={(e) => { if(selectedEmployee !== emp.id) e.target.style.background = '#f8fafc' }}
                        onMouseOut={(e) => { if(selectedEmployee !== emp.id) e.target.style.background = 'transparent' }}
                      >
                        {emp.firstName} {emp.lastName}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '10px 16px', color: '#64748b', textAlign: 'center' }}>
                      לא נמצאו עובדים
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '500' }}>
                {usePinMode ? '4 הספרות האחרונות בסיסמה' : 'קוד כניסה'}
              </label>
              {deviceTrusted && (
                <button
                  type="button"
                  onClick={() => { setUsePinMode(!usePinMode); setError(''); setPassword(''); setPinValue(''); }}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}
                >
                  {usePinMode ? 'השתמש בסיסמה המלאה' : 'השתמש בקוד מקוצר (4 ספרות)'}
                </button>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              {usePinMode ? (
                <input data-element-name="שדה_LoginScreen_pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  style={{ ...inputStyle, letterSpacing: '0.6em', textAlign: 'center', fontSize: '1.3rem' }}
                  onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.25)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.boxShadow = 'none'; }}
                />
              ) : (
                <input data-element-name="שדה_LoginScreen_8"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="הזן את הקוד שלך"
                  style={{ ...inputStyle, letterSpacing: password.length > 0 ? '0.2em' : 'normal' }}
                  onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.25)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.boxShadow = 'none'; }}
                />
              )}
              <Lock data-element-name="רכיב_LoginScreen_9" size={20} color={(usePinMode ? pinValue : password) ? '#3b82f6' : '#64748b'} style={{ position: 'absolute', right: '1.1rem', top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s' }} />
            </div>
            <div style={{ textAlign: 'left', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => { setForgotOpen(true); setForgotResult(null); }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}
              >
                שכחתי סיסמה
              </button>
            </div>
          </div>

          <button data-element-name="כפתור_LoginScreen_10"
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              width: '100%',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '1.1rem',
              borderRadius: '14px',
              fontSize: '1.15rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: loading ? 0.8 : 1,
              boxShadow: '0 8px 20px -6px rgba(37, 99, 235, 0.6)'
            }}
            onMouseOver={(e) => { if(!loading) { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 25px -6px rgba(37, 99, 235, 0.7)'; } }}
            onMouseOut={(e) => { if(!loading) { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 8px 20px -6px rgba(37, 99, 235, 0.6)'; } }}
            onMouseDown={(e) => { if(!loading) { e.target.style.transform = 'translateY(1px)'; e.target.style.boxShadow = '0 4px 10px -6px rgba(37, 99, 235, 0.6)'; } }}
            onMouseUp={(e) => { if(!loading) { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 25px -6px rgba(37, 99, 235, 0.7)'; } }}
          >
            {loading ? (
              <span style={{ display: 'inline-block', width: '22px', height: '22px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
            ) : (
              <>
                <LogIn data-element-name="רכיב_LoginScreen_11" size={22} />
                היכנס למערכת
              </>
            )}
          </button>
        </form>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
            20%, 40%, 60%, 80% { transform: translateX(4px); }
          }
          * { box-sizing: border-box; }
        `}} />
      </div>

      {forgotOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(15,23,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }} onClick={(e) => { if (e.target === e.currentTarget) setForgotOpen(false); }}>
          <div style={{ width: '100%', maxWidth: '400px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '2rem', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <KeyRound size={20} color="#60a5fa" />
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>שכחתי סיסמה</h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.2rem' }}>
              תישלח סיסמה זמנית לכתובת המייל השמורה במערכת עבור העובד שנבחר ({searchTerm || 'לא נבחר עובד'}). לאחר ההתחברות עם הסיסמה הזמנית תתבקש/י להגדיר סיסמה חדשה.
            </p>
            {forgotResult && (
              <div style={{
                background: forgotResult.success ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${forgotResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: forgotResult.success ? '#86efac' : '#fca5a5',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                fontSize: '0.88rem',
                marginBottom: '1rem'
              }}>
                {forgotResult.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setForgotOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: 'pointer' }}>סגור</button>
              <button type="button" disabled={forgotSending} onClick={handleForgotPassword} style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '0.6rem 1.1rem', borderRadius: '10px', cursor: forgotSending ? 'not-allowed' : 'pointer', opacity: forgotSending ? 0.7 : 1 }}>
                {forgotSending ? 'שולח...' : 'שלח סיסמה זמנית'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetRequired && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '420px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '2rem', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <ShieldCheck size={20} color="#60a5fa" />
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>יש להגדיר סיסמה חדשה</h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.2rem' }}>
              התחברת עם סיסמה זמנית. יש להגדיר סיסמה קבועה חדשה כדי להמשיך.
            </p>
            {resetError && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.88rem', marginBottom: '1rem' }}>
                {resetError}
              </div>
            )}
            <form onSubmit={handleSetNewPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.4rem' }}>סיסמה חדשה</label>
                <input type="password" value={newPass1} onChange={(e) => setNewPass1(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.4rem' }}>אימות סיסמה חדשה</label>
                <input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} style={inputStyle} />
              </div>
              <button type="submit" disabled={resetSaving} style={{ marginTop: '0.4rem', background: '#3b82f6', border: 'none', color: 'white', padding: '0.85rem', borderRadius: '12px', cursor: resetSaving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: resetSaving ? 0.7 : 1 }}>
                {resetSaving ? 'שומר...' : 'שמור והמשך'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal && mounted) {
    return createPortal(content, document.body);
  }

  return content;
}
