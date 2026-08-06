'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Lock, User, LogIn, X, Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';

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
  // characters of their real password instead of typing the whole thing every time.
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
    fetchSharedJson('/api/employees', { ttl: TTL.STATIC })
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
    // רענון מלא ולא router.refresh: ה-navbar מיוצר בשרת לפי תפקיד המשתמש,
    // ו-UserMenu מציג את /api/me מהמטמון המשותף בזיכרון — שניהם מתעדכנים
    // לעובד שנכנס רק בטעינת עמוד נקייה. אם העמוד הנוכחי אסור לתפקיד החדש,
    // ה-guard בשרת ממילא יפנה לדף הבית.
    if (isModal && onClose) {
      window.location.reload();
    } else {
      window.location.href = '/';
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    const finalEmployeeId = resolveEmployeeId();
    const credential = usePinMode ? pinValue : password;

    if (!finalEmployeeId || !credential) {
      setError(usePinMode ? 'נא לבחור עובד ולהזין 4 תווים' : 'נא לבחור עובד ולהזין סיסמה');
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

  const content = (
    <div style={{
      ...(isModal ? {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(44, 38, 20, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      } : {
        minHeight: '100vh',
        background: 'var(--bg-color)',
        backgroundImage: 'radial-gradient(circle at 50% -15%, rgba(212, 175, 55, 0.30) 0%, transparent 45%), radial-gradient(circle at 100% 100%, rgba(212, 175, 55, 0.12) 0%, transparent 45%)'
      }),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }} dir="rtl">

      <div className="ls-card">
        {isModal && onClose && (
          <button data-element-name="כפתור_LoginScreen_1" className="ls-close" onClick={() => onClose(false)}>
             <X data-element-name="רכיב_LoginScreen_2" size={24} />
          </button>
        )}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="ls-badge">
            <Lock data-element-name="רכיב_LoginScreen_3" size={34} strokeWidth={2.5} style={{ transform: 'rotate(5deg)', color: 'var(--btn-primary-text)' }} />
          </div>
          <h2 style={{ fontSize: '2.1rem', color: 'var(--text-main)', margin: '0 0 0.5rem 0', letterSpacing: '-0.015em' }}>
            כניסת עובדים
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.05rem' }}>
            נא להזדהות על מנת להמשיך למערכת
          </p>
          {deviceTrusted && (
            <p className="ls-trusted" style={{ margin: '0.6rem 0 0', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={15} />
              מחשב זה מוגדר כמערכת מהימנה
            </p>
          )}
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {error && (
            <div className="ls-alert ls-alert-err ls-alert-shake" style={{ padding: '1rem', textAlign: 'center', fontWeight: '500', fontSize: '0.95rem' }}>
              {error}
            </div>
          )}

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <label className="ls-label">
              שם העובד
            </label>
            <div style={{ position: 'relative' }}>
              <input data-element-name="שדה_LoginScreen_4"
                className="ls-input"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedEmployee('');
                  setIsDropdownOpen(true);
                }}
                disabled={isFetchingEmployees}
                placeholder={isFetchingEmployees ? '-- טוען עובדים... --' : 'הקלד או בחר מהרשימה'}
                onFocus={() => setIsDropdownOpen(true)}
              />
              {isFetchingEmployees ? (
                <Loader2 data-element-name="רכיב_LoginScreen_5" size={20} style={{ position: 'absolute', right: '1.1rem', top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite', color: 'var(--primary-color)' }} />
              ) : (
                <User data-element-name="לחיץ_LoginScreen_6"
                  size={20}
                  style={{ position: 'absolute', right: '1.1rem', top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s', cursor: 'pointer', color: selectedEmployee ? 'var(--primary-color)' : 'var(--text-muted)' }}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                />
              )}

              {isDropdownOpen && !isFetchingEmployees && (
                <div className="ls-dropdown">
                  {employees.filter(emp => `${emp.firstName} ${emp.lastName}`.includes(searchTerm)).length > 0 ? (
                    employees.filter(emp => `${emp.firstName} ${emp.lastName}`.includes(searchTerm)).map(emp => (
                      <div data-element-name="לחיץ_LoginScreen_7"
                        key={emp.id}
                        className={`ls-option${selectedEmployee === emp.id ? ' is-selected' : ''}`}
                        onClick={() => {
                          setSelectedEmployee(emp.id);
                          setSearchTerm(`${emp.firstName} ${emp.lastName}`);
                          setIsDropdownOpen(false);
                        }}
                      >
                        {emp.firstName} {emp.lastName}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '10px 16px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      לא נמצאו עובדים
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label className="ls-label" style={{ marginBottom: 0 }}>
                {usePinMode ? '4 התווים האחרונים בסיסמה' : 'קוד כניסה'}
              </label>
              {deviceTrusted && (
                <button
                  type="button"
                  className="ls-link ls-link-accent"
                  onClick={() => { setUsePinMode(!usePinMode); setError(''); setPassword(''); setPinValue(''); }}
                >
                  {usePinMode ? 'השתמש בסיסמה המלאה' : 'השתמש בקוד מקוצר (4 תווים)'}
                </button>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              {usePinMode ? (
                <input data-element-name="שדה_LoginScreen_pin"
                  className="ls-input ls-input-pin"
                  type="password"
                  maxLength={4}
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value.slice(0, 4))}
                  placeholder="••••"
                />
              ) : (
                <input data-element-name="שדה_LoginScreen_8"
                  className="ls-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="הזן את הקוד שלך"
                  style={{ letterSpacing: password.length > 0 ? '0.2em' : 'normal' }}
                />
              )}
              <Lock data-element-name="רכיב_LoginScreen_9" size={20} style={{ position: 'absolute', right: '1.1rem', top: '50%', transform: 'translateY(-50%)', transition: 'color 0.2s', color: (usePinMode ? pinValue : password) ? 'var(--primary-color)' : 'var(--text-muted)' }} />
            </div>
            <div style={{ textAlign: 'left', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="ls-link"
                onClick={() => { setForgotOpen(true); setForgotResult(null); }}
              >
                שכחתי סיסמה
              </button>
            </div>
          </div>

          <button data-element-name="כפתור_LoginScreen_10"
            type="submit"
            className="ls-btn-gold ls-submit"
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'inline-block', width: '22px', height: '22px', border: '3px solid rgba(0,0,0,0.18)', borderTopColor: 'var(--btn-primary-text)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
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

          /* ---- מסך הכניסה: זהב על קרם, באותה שפה עיצובית של שאר המערכת ---- */
          .ls-card {
            position: relative;
            width: 100%;
            max-width: 440px;
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 3rem 2.5rem;
            box-shadow: var(--shadow-lg), 0 0 40px rgba(212, 175, 55, 0.12);
          }

          .ls-close {
            position: absolute;
            top: 1.5rem;
            right: 1.5rem;
            background: none;
            border: none;
            padding: 0;
            line-height: 0;
            color: var(--text-muted);
            cursor: pointer;
            transition: color 0.2s;
          }
          .ls-close:hover { color: var(--primary-color); }

          .ls-badge {
            width: 76px;
            height: 76px;
            background: linear-gradient(135deg, var(--primary-color), #e8c85a);
            border-radius: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem auto;
            box-shadow: 0 10px 25px rgba(212, 175, 55, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.45);
            transform: rotate(-5deg);
          }

          .ls-trusted { color: var(--primary-hover); }
          [data-theme="dark"] .ls-trusted { color: var(--primary-color); }

          .ls-label {
            display: block;
            color: var(--text-main);
            font-size: 0.9rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
          }

          .ls-input {
            width: 100%;
            background: var(--input-bg);
            border: 1px solid var(--element-border);
            color: var(--text-main);
            padding: 1.1rem 3.2rem 1.1rem 1rem;
            border-radius: 14px;
            font-family: inherit;
            font-size: 1rem;
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
          }
          .ls-input::placeholder { color: var(--text-muted); opacity: 1; }
          .ls-input:focus {
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px var(--primary-light);
          }
          .ls-input:disabled { opacity: 0.7; cursor: not-allowed; }
          .ls-input-pin { letter-spacing: 0.6em; text-align: center; font-size: 1.3rem; }
          .ls-input-plain { padding: 0.85rem 1rem; }

          .ls-link {
            background: none;
            border: none;
            padding: 0;
            font-family: inherit;
            font-size: 0.82rem;
            color: var(--text-muted);
            cursor: pointer;
            transition: color 0.2s;
          }
          .ls-link:hover { color: var(--primary-color); }
          .ls-link-accent { color: var(--primary-hover); font-weight: 600; }
          [data-theme="dark"] .ls-link-accent { color: var(--primary-color); }
          .ls-link-accent:hover { color: var(--primary-color); }

          .ls-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            margin-top: 0.5rem;
            background: var(--input-bg);
            border: 1px solid var(--element-border);
            border-radius: 12px;
            box-shadow: var(--shadow-lg);
            max-height: 200px;
            overflow-y: auto;
            z-index: 50;
          }

          .ls-option {
            padding: 10px 16px;
            cursor: pointer;
            color: var(--text-main);
            background: transparent;
            border-bottom: 1px solid var(--divider);
            transition: background 0.2s;
          }
          .ls-option:last-child { border-bottom: none; }
          .ls-option:hover { background: var(--element-bg); }
          .ls-option.is-selected { background: var(--primary-light); font-weight: 600; }

          .ls-btn-gold {
            background: linear-gradient(135deg, var(--primary-color), #e8c85a);
            color: var(--btn-primary-text);
            border: none;
            font-family: inherit;
            font-weight: 700;
            cursor: pointer;
          }
          .ls-btn-gold:hover:not(:disabled) {
            background: linear-gradient(135deg, var(--primary-hover), var(--primary-color));
          }
          .ls-btn-gold:disabled { opacity: 0.7; cursor: not-allowed; }

          .ls-btn-ghost {
            background: transparent;
            border: 1px solid var(--element-border);
            color: var(--text-main);
            font-family: inherit;
            cursor: pointer;
            transition: border-color 0.2s, color 0.2s;
          }
          .ls-btn-ghost:hover { border-color: var(--primary-color); color: var(--primary-color); }

          .ls-submit {
            margin-top: 0.5rem;
            width: 100%;
            padding: 1.1rem;
            border-radius: 14px;
            font-size: 1.15rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.6rem;
            box-shadow: 0 8px 20px -6px rgba(212, 175, 55, 0.55);
            transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, background 0.2s ease;
          }
          .ls-submit:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 12px 25px -6px rgba(212, 175, 55, 0.7);
          }
          .ls-submit:active:not(:disabled) {
            transform: translateY(1px);
            box-shadow: 0 4px 10px -6px rgba(212, 175, 55, 0.55);
          }
          .ls-submit:disabled { opacity: 0.8; }

          .ls-dialog {
            width: 100%;
            background: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 18px;
            padding: 2rem;
            color: var(--text-main);
            box-shadow: var(--shadow-lg);
          }

          .ls-alert { padding: 0.75rem 1rem; border-radius: 12px; font-size: 0.88rem; }
          .ls-alert-err {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.28);
            color: #b91c1c;
          }
          [data-theme="dark"] .ls-alert-err { color: #fca5a5; }
          .ls-alert-ok {
            background: rgba(34, 197, 94, 0.12);
            border: 1px solid rgba(34, 197, 94, 0.3);
            color: #15803d;
          }
          [data-theme="dark"] .ls-alert-ok { color: #86efac; }
          .ls-alert-shake { animation: shake 0.4s ease-in-out; }
        `}} />
      </div>

      {forgotOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(44, 38, 20, 0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }} onClick={(e) => { if (e.target === e.currentTarget) setForgotOpen(false); }}>
          <div className="ls-dialog" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <KeyRound size={20} style={{ color: 'var(--primary-color)' }} />
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>שכחתי סיסמה</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.2rem' }}>
              תישלח סיסמה זמנית לכתובת המייל השמורה במערכת עבור העובד שנבחר ({searchTerm || 'לא נבחר עובד'}). לאחר ההתחברות עם הסיסמה הזמנית תתבקש/י להגדיר סיסמה חדשה.
            </p>
            {forgotResult && (
              <div className={`ls-alert ${forgotResult.success ? 'ls-alert-ok' : 'ls-alert-err'}`} style={{ marginBottom: '1rem' }}>
                {forgotResult.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button type="button" className="ls-btn-ghost" onClick={() => setForgotOpen(false)} style={{ padding: '0.6rem 1.1rem', borderRadius: '10px' }}>סגור</button>
              <button type="button" className="ls-btn-gold" disabled={forgotSending} onClick={handleForgotPassword} style={{ padding: '0.6rem 1.1rem', borderRadius: '10px' }}>
                {forgotSending ? 'שולח...' : 'שלח סיסמה זמנית'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetRequired && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(44, 38, 20, 0.7)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="ls-dialog" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <ShieldCheck size={20} style={{ color: 'var(--primary-color)' }} />
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>יש להגדיר סיסמה חדשה</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.2rem' }}>
              התחברת עם סיסמה זמנית. יש להגדיר סיסמה קבועה חדשה כדי להמשיך.
            </p>
            {resetError && (
              <div className="ls-alert ls-alert-err" style={{ marginBottom: '1rem' }}>
                {resetError}
              </div>
            )}
            <form onSubmit={handleSetNewPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label className="ls-label" style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>סיסמה חדשה</label>
                <input className="ls-input ls-input-plain" type="password" value={newPass1} onChange={(e) => setNewPass1(e.target.value)} />
              </div>
              <div>
                <label className="ls-label" style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>אימות סיסמה חדשה</label>
                <input className="ls-input ls-input-plain" type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} />
              </div>
              <button type="submit" className="ls-btn-gold" disabled={resetSaving} style={{ marginTop: '0.4rem', padding: '0.85rem', borderRadius: '12px' }}>
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
