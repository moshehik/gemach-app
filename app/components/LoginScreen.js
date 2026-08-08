'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
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

  const filteredEmployees = employees.filter(emp => `${emp.firstName} ${emp.lastName}`.includes(searchTerm));

  const trustedNote = deviceTrusted && (
    <div className="badge badge-success" style={{ margin: '10px auto 0', width: 'fit-content' }}>
      <svg className="icon"><use href="#i-shield" /></svg>
      מחשב זה מוגדר כמערכת מהימנה
    </div>
  );

  const formFields = (
    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>

      {error && (
        <div className="callout callout-danger" style={{ marginBottom: '14px' }}>
          <svg className="icon"><use href="#i-alert-circle" /></svg>
          <span>{error}</span>
        </div>
      )}

      <div className="field combobox" ref={dropdownRef}>
        <label htmlFor="login-employee">שם העובד</label>
        <div className="input-icon-wrap">
          {isFetchingEmployees ? (
            <span className="spinner" style={{ position: 'absolute', insetInlineStart: '12px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', borderWidth: '2px' }} />
          ) : (
            <svg data-element-name="לחיץ_LoginScreen_6" className="icon" style={{ cursor: 'pointer', color: selectedEmployee ? 'var(--primary-solid)' : undefined }} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
              <use href="#i-user" />
            </svg>
          )}
          <input data-element-name="שדה_LoginScreen_4"
            id="login-employee"
            className="input"
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
        </div>

        {isDropdownOpen && !isFetchingEmployees && (
          <div className="combobox-results">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map(emp => (
                <div data-element-name="לחיץ_LoginScreen_7"
                  key={emp.id}
                  className="combobox-option"
                  style={selectedEmployee === emp.id ? { background: 'var(--primary-tint)', fontWeight: 700 } : undefined}
                  onClick={() => {
                    setSelectedEmployee(emp.id);
                    setSearchTerm(`${emp.firstName} ${emp.lastName}`);
                    setIsDropdownOpen(false);
                  }}
                >
                  <svg className="icon"><use href="#i-user" /></svg>
                  {emp.firstName} {emp.lastName}
                </div>
              ))
            ) : (
              <div className="combobox-option" style={{ cursor: 'default', color: 'var(--text-3)', justifyContent: 'center' }}>
                לא נמצאו עובדים
              </div>
            )}
          </div>
        )}
      </div>

      <div className="field">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <label htmlFor="login-password" style={{ marginBottom: 0 }}>
            {usePinMode ? '4 התווים האחרונים בסיסמה' : 'קוד כניסה'}
          </label>
          {deviceTrusted && (
            <button
              type="button"
              onClick={() => { setUsePinMode(!usePinMode); setError(''); setPassword(''); setPinValue(''); }}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary-solid)', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {usePinMode ? 'השתמש בסיסמה המלאה' : 'השתמש בקוד מקוצר (4 תווים)'}
            </button>
          )}
        </div>
        <div className="password-field">
          <svg className="icon lead-icon"><use href="#i-lock" /></svg>
          {usePinMode ? (
            <input data-element-name="שדה_LoginScreen_pin"
              id="login-password"
              className="input"
              type="password"
              maxLength={4}
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.slice(0, 4))}
              placeholder="••••"
              style={{ letterSpacing: '0.6em', textAlign: 'center' }}
            />
          ) : (
            <input data-element-name="שדה_LoginScreen_8"
              id="login-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="הזן את הקוד שלך"
            />
          )}
        </div>
        <div style={{ textAlign: 'end', marginTop: '6px' }}>
          <button
            type="button"
            onClick={() => { setForgotOpen(true); setForgotResult(null); }}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-3)', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            שכחתי סיסמה
          </button>
        </div>
      </div>

      <button data-element-name="כפתור_LoginScreen_10"
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={loading}
        style={{ width: '100%', marginTop: '10px' }}
      >
        {loading ? (
          <span className="spinner" />
        ) : (
          <svg data-element-name="רכיב_LoginScreen_11" className="icon"><use href="#i-arrow-end" /></svg>
        )}
        היכנס למערכת
      </button>
    </form>
  );

  const loginCard = isModal ? (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} dir="rtl">
      <div className="modal" style={{ maxWidth: '440px', width: '100%', margin: 0 }}>
        <div className="modal-head">
          <strong>
            <svg data-element-name="רכיב_LoginScreen_3" className="icon"><use href="#i-lock" /></svg>
            כניסת עובדים
          </strong>
          {onClose && (
            <button data-element-name="כפתור_LoginScreen_1" type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => onClose(false)} title="סגירה">
              <svg data-element-name="רכיב_LoginScreen_2" className="icon"><use href="#i-x" /></svg>
            </button>
          )}
        </div>
        <div className="modal-body">
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <p className="page-desc" style={{ margin: 0 }}>נא להזדהות על מנת להמשיך למערכת</p>
            {trustedNote}
          </div>
          {formFields}
        </div>
      </div>
    </div>
  ) : (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(circle at 50% -15%, color-mix(in srgb, var(--primary) 22%, transparent) 0%, transparent 45%), radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--accent) 16%, transparent) 0%, transparent 45%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }} dir="rtl">
      <div className="card card-pad" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--primary-solid), var(--accent-solid))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: 'var(--shadow-md)' }}>
            <svg data-element-name="רכיב_LoginScreen_3" className="icon" style={{ width: '28px', height: '28px', color: 'var(--text-on-primary)' }}>
              <use href="#i-lock" />
            </svg>
          </div>
          <h1 style={{ fontSize: '22px', margin: '0 0 4px' }}>כניסת עובדים</h1>
          <p className="page-desc" style={{ margin: 0 }}>נא להזדהות על מנת להמשיך למערכת</p>
          {trustedNote}
        </div>
        {formFields}
      </div>
    </div>
  );

  const forgotDialog = (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} dir="rtl" onClick={(e) => { if (e.target === e.currentTarget) setForgotOpen(false); }}>
      <div className="modal" style={{ maxWidth: '400px', width: '100%', margin: 0 }}>
        <div className="modal-head">
          <strong>
            <svg className="icon"><use href="#i-mail" /></svg>
            שכחתי סיסמה
          </strong>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.6, marginBottom: forgotResult ? '14px' : 0 }}>
            תישלח סיסמה זמנית לכתובת המייל השמורה במערכת עבור העובד שנבחר ({searchTerm || 'לא נבחר עובד'}). לאחר ההתחברות עם הסיסמה הזמנית תתבקש/י להגדיר סיסמה חדשה.
          </p>
          {forgotResult && (
            <div className={`callout ${forgotResult.success ? 'callout-success' : 'callout-danger'}`}>
              <svg className="icon"><use href={forgotResult.success ? '#i-check-circle' : '#i-alert-circle'} /></svg>
              <span>{forgotResult.message}</span>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={() => setForgotOpen(false)}>סגור</button>
          <button type="button" className="btn btn-primary" disabled={forgotSending} onClick={handleForgotPassword}>
            {forgotSending ? (<><span className="spinner" />שולח...</>) : 'שלח סיסמה זמנית'}
          </button>
        </div>
      </div>
    </div>
  );

  const resetDialog = (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} dir="rtl">
      <div className="modal" style={{ maxWidth: '420px', width: '100%', margin: 0 }}>
        <div className="modal-head">
          <strong>
            <svg className="icon"><use href="#i-shield" /></svg>
            יש להגדיר סיסמה חדשה
          </strong>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.6, marginBottom: '14px' }}>
            התחברת עם סיסמה זמנית. יש להגדיר סיסמה קבועה חדשה כדי להמשיך.
          </p>
          {resetError && (
            <div className="callout callout-danger" style={{ marginBottom: '14px' }}>
              <svg className="icon"><use href="#i-alert-circle" /></svg>
              <span>{resetError}</span>
            </div>
          )}
          <form onSubmit={handleSetNewPassword} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="field">
              <label htmlFor="login-newpass1">סיסמה חדשה</label>
              <div className="password-field">
                <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                <input id="login-newpass1" className="input" type="password" value={newPass1} onChange={(e) => setNewPass1(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="login-newpass2">אימות סיסמה חדשה</label>
              <div className="password-field">
                <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                <input id="login-newpass2" className="input" type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={resetSaving} style={{ width: '100%', marginTop: '6px' }}>
              {resetSaving ? (<><span className="spinner" />שומר...</>) : 'שמור והמשך'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    // Before the client-only mount effect fires, render the modal inline (no portal) rather
    // than nothing - createPortal needs document.body, which isn't available during SSR.
    if (!mounted) return loginCard;
    return (
      <>
        {createPortal(loginCard, document.body)}
        {forgotOpen && createPortal(forgotDialog, document.body)}
        {resetRequired && createPortal(resetDialog, document.body)}
      </>
    );
  }

  return (
    <>
      {loginCard}
      {forgotOpen && forgotDialog}
      {resetRequired && resetDialog}
    </>
  );
}
