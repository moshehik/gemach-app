'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import RentalReturnModal from '../../components/orders/RentalReturnModal';
import { fetchSharedJson, TTL } from '@/lib/apiCache';

const PopupContext = createContext(null);

// נתוני האימות (רשימת עובדים + משתמש נוכחי) נטענים דרך המטמון המשותף —
// חלונית אישור מנהל/עובד נפתחת מיד, והרשימה מתרעננת אוטומטית אחרי עריכת עובדים
// או התחברות/התנתקות (בניגוד למטמון המקומי הישן שלא התעדכן לעולם).
const loadAuthData = () => Promise.all([
  fetchSharedJson('/api/employees', { ttl: TTL.STATIC }).catch(() => []),
  fetchSharedJson('/api/me', { ttl: TTL.STATIC }).catch(() => null)
]);

export function PopupProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [alertsHistory, setAlertsHistory] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', resolve: null, title: 'אישור פעולה' });
  const [threeWayConfirmConfig, setThreeWayConfirmConfig] = useState({ isOpen: false, message: '', resolve: null, title: 'שינויים לא נשמרו' });
  const [promptConfig, setPromptConfig] = useState({ isOpen: false, message: '', resolve: null, title: 'הזנת נתונים', defaultValue: '', type: 'text' });
  const [authPromptConfig, setAuthPromptConfig] = useState({ isOpen: false, message: '', resolve: null, title: 'אימות הרשאה', requiredLevel: 'מנהל', employees: [] });
  const promptInputRef = useRef(null);
  const authInputRef = useRef(null);
  const authSearchInputRef = useRef(null);
  const [selectedAuthEmployee, setSelectedAuthEmployee] = useState('');
  const [authEmployeeSearch, setAuthEmployeeSearch] = useState('');
  const [isAuthEmployeeDropdownOpen, setIsAuthEmployeeDropdownOpen] = useState(false);

  // Global Rental Modal state
  const [globalRentalModalOrderId, setGlobalRentalModalOrderId] = useState(null);

  const openRentalModal = useCallback((orderId) => {
    setGlobalRentalModalOrderId(orderId);
  }, []);

  const closeRentalModal = useCallback(() => {
    setGlobalRentalModalOrderId(null);
  }, []);


  // Background error logger
  const logErrorToSystem = async (errorMessage) => {
    try {
      // Assuming a /api/logs endpoint exists or will exist from the parallel thread
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UI_ERROR_ALERT',
          error: errorMessage,
          timestamp: new Date().toISOString(),
          url: window.location.href,
        })
      });
    } catch (e) {
      // Silently fail if logging system is not yet available
    }
  };

  const showAlert = useCallback((message, type = 'info') => {
    // If it's an error message (or seems like one), log it to the system
    if (type === 'error' || (typeof message === 'string' && message.toLowerCase().includes('שגיאה'))) {
       logErrorToSystem(message);
    }

    const id = Date.now() + Math.random();
    const newAlert = { id, message, type, time: new Date() };
    setAlerts(prev => [...prev, newAlert]);
    setAlertsHistory(prev => [newAlert, ...prev].slice(0, 100)); // Keep last 100 messages

    // Auto remove after 4 seconds
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }, 4000);
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const showConfirm = useCallback((message, title = 'אישור פעולה') => {
    return new Promise((resolve) => {
      setConfirmConfig({ isOpen: true, message, resolve, title });
    });
  }, []);

  const handleConfirmResponse = useCallback((result) => {
    if (confirmConfig.resolve) {
      confirmConfig.resolve(result);
    }
    setConfirmConfig({ isOpen: false, message: '', resolve: null, title: 'אישור פעולה' });
  }, [confirmConfig]);

  const showThreeWayConfirm = useCallback((message, title = 'שינויים לא נשמרו') => {
    return new Promise((resolve) => {
      setThreeWayConfirmConfig({ isOpen: true, message, resolve, title });
    });
  }, []);

  const handleThreeWayConfirmResponse = useCallback((result) => {
    if (threeWayConfirmConfig.resolve) {
      threeWayConfirmConfig.resolve(result);
    }
    setThreeWayConfirmConfig({ isOpen: false, message: '', resolve: null, title: 'שינויים לא נשמרו' });
  }, [threeWayConfirmConfig]);

  const showPrompt = useCallback((message, title = 'הזנת נתונים', defaultValue = '', type = 'text') => {
    return new Promise((resolve) => {
      setPromptConfig({ isOpen: true, message, resolve, title, defaultValue, type });
      // Focus input shortly after render
      setTimeout(() => {
        if (promptInputRef.current) promptInputRef.current.focus();
      }, 100);
    });
  }, []);

  const handlePromptResponse = useCallback((result) => {
    if (promptConfig.resolve) {
      promptConfig.resolve(result);
    }
    setPromptConfig({ isOpen: false, message: '', resolve: null, title: 'הזנת נתונים', defaultValue: '', type: 'text' });
  }, [promptConfig]);

  const showAuthPrompt = useCallback((message, requiredLevel = 'מנהל', title = 'אימות הרשאה') => {
    return new Promise((resolve) => {
      // החלונית נפתחת מיד; רשימת העובדים נטענת ברקע (עם מטמון) — employees:null = בטעינה
      setAuthPromptConfig({ isOpen: true, message, resolve, title, requiredLevel, employees: null });
      setSelectedAuthEmployee('');
      setAuthEmployeeSearch('');
      setIsAuthEmployeeDropdownOpen(false);
      setTimeout(() => { if (authInputRef.current) authInputRef.current.focus(); }, 100);

      loadAuthData().then(([allEmployees, meData]) => {
        let employees = Array.isArray(allEmployees) ? allEmployees : [];
        if (requiredLevel === 'מנהל') {
          employees = employees.filter(e => e.roleId === 1 || e.roleId === 2);
        } else if (requiredLevel === 'מתכנת') {
          employees = employees.filter(e => e.roleId === 2);
        }
        const currentUser = (meData && meData.success) ? meData.employee : null;

        let defaultEmpId = '';
        let defaultEmpName = '';
        if (currentUser && employees.some(e => e.id === currentUser.id)) {
          defaultEmpId = currentUser.id.toString();
          defaultEmpName = `${currentUser.firstName} ${currentUser.lastName}`;
        }

        // מעדכנים רק אם זו עדיין אותה חלונית פתוחה (ולא דורסים בחירה שהמשתמש כבר התחיל)
        setAuthPromptConfig(prev => (prev.isOpen && prev.resolve === resolve) ? { ...prev, employees } : prev);
        if (defaultEmpId) {
          setSelectedAuthEmployee(prev => prev || defaultEmpId);
          setAuthEmployeeSearch(prev => prev || defaultEmpName);
        } else {
          setTimeout(() => {
            if (authSearchInputRef.current && !authSearchInputRef.current.value
              && authInputRef.current && !authInputRef.current.value) {
              authSearchInputRef.current.focus();
            }
          }, 50);
        }
      });
    });
  }, []);

  const handleAuthPromptResponse = useCallback((result) => {
    if (authPromptConfig.resolve) {
      authPromptConfig.resolve(result); // result will be { pin, employeeId } or null
    }
    setAuthPromptConfig({ isOpen: false, message: '', resolve: null, title: 'אימות הרשאה', requiredLevel: 'מנהל', employees: [] });
    setSelectedAuthEmployee('');
    setAuthEmployeeSearch('');
    setIsAuthEmployeeDropdownOpen(false);
  }, [authPromptConfig]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.alert = (message) => showAlert(message);
      window.customConfirm = (message) => showConfirm(message);
      window.customPrompt = (message, defaultValue, type) => showPrompt(message, 'הזנת נתונים', defaultValue, type);
      window.customAuthPrompt = (message, requiredLevel) => showAuthPrompt(message, requiredLevel, 'אימות הרשאה');
      window.customThreeWayConfirm = (message, title) => showThreeWayConfirm(message, title);
    }
  }, [showAlert, showConfirm, showPrompt, showAuthPrompt, showThreeWayConfirm]);

  const filteredAuthEmployees = (authPromptConfig.employees || [])
    .filter(emp => `${emp.firstName} ${emp.lastName}`.includes(authEmployeeSearch));

  return (
    <PopupContext.Provider data-element-name="רכיב_PopupProvider_1" value={{ showAlert, showConfirm, showPrompt, alertsHistory, openRentalModal, closeRentalModal }}>
      {children}

      {/* Toast Alerts Container */}
      <div className="toast-stack" style={{ position: 'fixed', top: '20px', insetInlineStart: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
        {alerts.map(alert => (
          <div key={alert.id} className={`toast ${alert.type} animate-slide-in`} style={{ minWidth: '300px', maxWidth: '90vw' }}>
            <svg data-element-name={alert.type === 'error' ? 'רכיב_PopupProvider_2' : alert.type === 'success' ? 'רכיב_PopupProvider_3' : 'רכיב_PopupProvider_4'} className="icon">
              <use href={`#${alert.type === 'error' ? 'i-alert-tri' : alert.type === 'success' ? 'i-check-circle' : 'i-info'}`} />
            </svg>
            <div style={{ flex: 1, fontWeight: 600 }}>{alert.message}</div>
            <button
              data-element-name="כפתור_העתקה_PopupProvider"
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={() => navigator.clipboard.writeText(alert.message).catch(() => {})}
              title="העתק הודעה"
            >
              <svg data-element-name="רכיב_Copy_PopupProvider" className="icon"><use href="#i-link" /></svg>
            </button>
            <button
              data-element-name="כפתור_PopupProvider_5"
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={() => removeAlert(alert.id)}
              title="סגירה"
            >
              <svg data-element-name="רכיב_PopupProvider_6" className="icon"><use href="#i-x" /></svg>
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmConfig.isOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal animate-fade-in" style={{ maxWidth: '420px', width: '100%', margin: 0 }}>
            <div className="modal-head">
              <strong>
                <svg data-element-name="רכיב_PopupProvider_7" className="icon"><use href="#i-alert-circle" /></svg>
                {confirmConfig.title}
              </strong>
            </div>
            <div className="modal-body">{confirmConfig.message}</div>
            <div className="modal-foot">
              <button data-element-name="כפתור_PopupProvider_8" type="button" className="btn btn-secondary" onClick={() => handleConfirmResponse(false)}>ביטול</button>
              <button data-element-name="כפתור_PopupProvider_9" type="button" className="btn btn-primary" onClick={() => handleConfirmResponse(true)}>אישור</button>
            </div>
          </div>
        </div>
      )}

      {/* Three Way Confirm Modal */}
      {threeWayConfirmConfig.isOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal animate-fade-in" style={{ maxWidth: '420px', width: '100%', margin: 0 }}>
            <div className="modal-head">
              <strong>
                <svg data-element-name="רכיב_PopupProvider_19_3way" className="icon"><use href="#i-alert-tri" /></svg>
                {threeWayConfirmConfig.title}
              </strong>
            </div>
            <div className="modal-body">{threeWayConfirmConfig.message}</div>
            <div className="modal-foot" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              <button data-element-name="כפתור_שמור_PopupProvider" type="button" className="btn btn-primary" onClick={() => handleThreeWayConfirmResponse('save')}>
                <svg className="icon"><use href="#i-check" /></svg>
                לשמור
              </button>
              <button data-element-name="כפתור_אל_תשמור_PopupProvider" type="button" className="btn btn-danger-ghost" onClick={() => handleThreeWayConfirmResponse('discard')}>אל תשמור</button>
              <div style={{ flex: 1 }} />
              <button data-element-name="כפתור_ביטול_PopupProvider" type="button" className="btn btn-secondary" onClick={() => handleThreeWayConfirmResponse('cancel')}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {promptConfig.isOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal animate-fade-in" style={{ maxWidth: '420px', width: '100%', margin: 0 }}>
            <div className="modal-head">
              <strong>
                <svg data-element-name="רכיב_PopupProvider_10" className="icon"><use href="#i-info" /></svg>
                {promptConfig.title}
              </strong>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '12px', color: 'var(--text-2)' }}>
                {promptConfig.message}
              </div>
              <input
                data-element-name="שדה_PopupProvider_11"
                ref={promptInputRef}
                type={promptConfig.type}
                defaultValue={promptConfig.defaultValue}
                placeholder="הקלד כאן..."
                className="input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePromptResponse(e.target.value);
                  if (e.key === 'Escape') handlePromptResponse(null);
                }}
              />
            </div>
            <div className="modal-foot">
              <button data-element-name="כפתור_PopupProvider_12" type="button" className="btn btn-secondary" onClick={() => handlePromptResponse(null)}>ביטול</button>
              <button data-element-name="כפתור_PopupProvider_13" type="button" className="btn btn-primary" onClick={() => handlePromptResponse(promptInputRef.current.value)}>אישור</button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Prompt Modal */}
      {authPromptConfig.isOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) handleAuthPromptResponse(null); }}>
          <div className="modal animate-fade-in" style={{ maxWidth: '440px', width: '100%', margin: 0 }}>
            <div className="modal-head">
              <strong>
                <svg data-element-name="רכיב_PopupProvider_14" className="icon"><use href="#i-lock" /></svg>
                {authPromptConfig.title}
              </strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => handleAuthPromptResponse(null)} title="סגירה">
                <svg data-element-name="כפתור_סגירה_PopupProvider" className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)', margin: '0 0 18px', lineHeight: 1.6, fontSize: '13px' }}>
                {authPromptConfig.message}
              </p>
              <div className="field">
                <label>בחר {authPromptConfig.requiredLevel}</label>
                <div className="combobox">
                  <input
                    data-element-name="חיפוש_PopupProvider_15"
                    ref={authSearchInputRef}
                    type="text"
                    className="input"
                    value={authEmployeeSearch}
                    placeholder="הקלד לחיפוש..."
                    onChange={(e) => {
                      setAuthEmployeeSearch(e.target.value);
                      setIsAuthEmployeeDropdownOpen(true);
                      setSelectedAuthEmployee('');
                    }}
                    onFocus={() => setIsAuthEmployeeDropdownOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setIsAuthEmployeeDropdownOpen(false), 200);
                    }}
                  />
                  {isAuthEmployeeDropdownOpen && (
                    <div className="combobox-results">
                      {authPromptConfig.employees === null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', color: 'var(--text-2)', fontSize: '12.5px' }}>
                          <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                          טוען רשימת עובדים...
                        </div>
                      ) : (
                        <>
                          {filteredAuthEmployees.map(emp => (
                            <div
                              key={emp.id}
                              className="combobox-option"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSelectedAuthEmployee(emp.id.toString());
                                setAuthEmployeeSearch(`${emp.firstName} ${emp.lastName}`);
                                setIsAuthEmployeeDropdownOpen(false);
                                if (authInputRef.current) authInputRef.current.focus();
                              }}
                            >
                              <svg className="icon"><use href="#i-user" /></svg>
                              {emp.firstName} {emp.lastName}
                            </div>
                          ))}
                          {filteredAuthEmployees.length === 0 && (
                            <div className="combobox-option" style={{ cursor: 'default', color: 'var(--text-3)' }}>לא נמצאו תוצאות</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>קוד {authPromptConfig.requiredLevel}</label>
                <div className="password-field">
                  <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                  <input
                    data-element-name="שדה_PopupProvider_16"
                    ref={authInputRef}
                    type="password"
                    className="input"
                    placeholder="הקלד סיסמה..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAuthPromptResponse({ pin: e.target.value, employeeId: selectedAuthEmployee });
                      if (e.key === 'Escape') handleAuthPromptResponse(null);
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button data-element-name="כפתור_PopupProvider_17" type="button" className="btn btn-secondary" onClick={() => handleAuthPromptResponse(null)}>ביטול</button>
              <button data-element-name="כפתור_PopupProvider_18" type="button" className="btn btn-primary" onClick={() => handleAuthPromptResponse({ pin: authInputRef.current.value, employeeId: selectedAuthEmployee })}>אישור</button>
            </div>
          </div>
        </div>
      )}

      {/* Global Rental Return Modal */}
      {globalRentalModalOrderId && (
        <RentalReturnModal
          orderId={globalRentalModalOrderId}
          onClose={closeRentalModal}
          onUpdate={() => {}}
        />
      )}
    </PopupContext.Provider>
  );
}

export const usePopup = () => useContext(PopupContext);
