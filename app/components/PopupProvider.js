'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Info, HelpCircle, X, Copy, KeyRound } from 'lucide-react';
import RentalReturnModal from '../../components/orders/RentalReturnModal';
import modernOrderCss from '../../components/orders/modern/modernOrderStyles';

const PopupContext = createContext(null);

// מטמון לנתוני האימות (רשימת עובדים + משתמש נוכחי) — נטען פעם אחת לכל טעינת עמוד,
// כדי שחלונית אישור מנהל/עובד תיפתח מיד ולא תחכה לשרת בכל פתיחה.
let authDataCachePromise = null;
const loadAuthData = () => {
  if (!authDataCachePromise) {
    authDataCachePromise = Promise.all([
      fetch('/api/employees').then(r => (r.ok ? r.json() : [])).catch(() => []),
      fetch('/api/me').then(r => (r.ok ? r.json() : null)).catch(() => null)
    ]);
  }
  return authDataCachePromise;
};

export function PopupProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [alertsHistory, setAlertsHistory] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', resolve: null, title: 'אישור פעולה' });
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
    }
  }, [showAlert, showConfirm, showPrompt, showAuthPrompt]);

  return (
    <PopupContext.Provider data-element-name="רכיב_PopupProvider_1" value={{ showAlert, showConfirm, showPrompt, alertsHistory, openRentalModal, closeRentalModal }}>
      {/* עיצוב "moc" של כרטיס ההזמנה המודרני — מוזרק גלובלית כדי שחלוניות אימות/אישור
          המוצגות מכל דף באפליקציה (לא רק מכרטיס הזמנה) יעוצבו באותה שפה עיצובית */}
      <style>{modernOrderCss}</style>
      {children}


      {/* Toast Alerts Container */}
      <div className="popup-toast-container" style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {alerts.map(alert => (
          <div key={alert.id} className={`popup-toast animate-slide-in ${alert.type}`} style={{
            background: alert.type === 'error' ? '#fee2e2' : alert.type === 'success' ? '#dcfce7' : '#e0f2fe',
            color: alert.type === 'error' ? '#991b1b' : alert.type === 'success' ? '#166534' : '#075985',
            padding: '12px 24px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex', alignItems: 'center', gap: '12px', minWidth: '300px', maxWidth: '90vw', border: `1px solid ${alert.type === 'error' ? '#fecaca' : alert.type === 'success' ? '#bbf7d0' : '#bae6fd'}`
          }}>
            {alert.type === 'error' ? <AlertTriangle data-element-name="רכיב_PopupProvider_2" size={20} /> : alert.type === 'success' ? <CheckCircle data-element-name="רכיב_PopupProvider_3" size={20} /> : <Info data-element-name="רכיב_PopupProvider_4" size={20} />}
            <div className="popup-toast-message" style={{ flex: 1, fontWeight: '500', fontSize: '0.95rem' }}>{alert.message}</div>
            <button data-element-name="כפתור_העתקה_PopupProvider" onClick={() => navigator.clipboard.writeText(alert.message).catch(()=>{})} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.7, padding: '4px' }} title="העתק הודעה">
              <Copy data-element-name="רכיב_Copy_PopupProvider" size={16} />
            </button>
            <button data-element-name="כפתור_PopupProvider_5" className="popup-toast-close" onClick={() => removeAlert(alert.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: '4px' }}>
              <X data-element-name="רכיב_PopupProvider_6" size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmConfig.isOpen && (
         <div className="popup-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
             <div className="popup-content animate-fade-in" style={{ background: 'var(--card-bg)', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                 <div style={{ padding: '24px 24px 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ background: 'rgba(212, 175, 55, 0.14)', color: '#b5952f', padding: '10px', borderRadius: '12px' }}>
                        <HelpCircle data-element-name="רכיב_PopupProvider_7" size={28} />
                     </div>
                     <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: '700' }}>{confirmConfig.title}</h3>
                 </div>
                 <div style={{ padding: '20px 24px', fontSize: '1.05rem', color: '#475569', lineHeight: '1.5' }}>
                     {confirmConfig.message}
                 </div>
                 <div style={{ background: '#f8fafc', padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
                     <button data-element-name="כפתור_PopupProvider_8" onClick={() => handleConfirmResponse(false)} style={{ padding: '10px 20px', background: 'var(--card-bg)', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseOver={e => e.currentTarget.style.background='#f7f4ec'} onMouseOut={e => e.currentTarget.style.background='var(--card-bg)'}>ביטול</button>
                     <button data-element-name="כפתור_PopupProvider_9" onClick={() => handleConfirmResponse(true)} style={{ padding: '10px 20px', background: '#d4af37', color: '#1e293b', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(212, 175, 55, 0.35)' }} onMouseOver={e => { e.currentTarget.style.background='#b5952f'; e.currentTarget.style.color='#fff'; }} onMouseOut={e => { e.currentTarget.style.background='#d4af37'; e.currentTarget.style.color='#1e293b'; }}>אישור</button>
                 </div>
             </div>
         </div>
      )}

      {/* Prompt Modal */}
      {promptConfig.isOpen && (
         <div className="popup-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
             <div className="popup-content animate-fade-in" style={{ background: 'var(--card-bg)', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                 <div style={{ padding: '24px 24px 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ background: 'rgba(212, 175, 55, 0.14)', color: '#b5952f', padding: '10px', borderRadius: '12px' }}>
                        <Info data-element-name="רכיב_PopupProvider_10" size={28} />
                     </div>
                     <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: '700' }}>{promptConfig.title}</h3>
                 </div>
                 <div style={{ padding: '20px 24px' }}>
                     <div style={{ fontSize: '1.05rem', color: '#475569', marginBottom: '12px', lineHeight: '1.5' }}>
                         {promptConfig.message}
                     </div>
                     <input data-element-name="שדה_PopupProvider_11"
                         ref={promptInputRef}
                         type={promptConfig.type}
                         defaultValue={promptConfig.defaultValue}
                         placeholder="הקלד כאן..."
                         onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePromptResponse(e.target.value);
                            if (e.key === 'Escape') handlePromptResponse(null);
                         }}
                         style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '1.05rem', outline: 'none', transition: 'border-color 0.2s', background: '#f8fafc' }}
                         onFocus={(e) => e.target.style.borderColor = '#d4af37'}
                         onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                     />
                 </div>
                 <div style={{ background: '#f8fafc', padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
                     <button data-element-name="כפתור_PopupProvider_12" onClick={() => handlePromptResponse(null)} style={{ padding: '10px 20px', background: 'var(--card-bg)', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseOver={e => e.currentTarget.style.background='#f7f4ec'} onMouseOut={e => e.currentTarget.style.background='var(--card-bg)'}>ביטול</button>
                     <button data-element-name="כפתור_PopupProvider_13" onClick={() => handlePromptResponse(promptInputRef.current.value)} style={{ padding: '10px 20px', background: '#d4af37', color: '#1e293b', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(212, 175, 55, 0.35)' }} onMouseOver={e => { e.currentTarget.style.background='#b5952f'; e.currentTarget.style.color='#fff'; }} onMouseOut={e => { e.currentTarget.style.background='#d4af37'; e.currentTarget.style.color='#1e293b'; }}>אישור</button>
                 </div>
             </div>
         </div>
      )}

      {/* Auth Prompt Modal — בסגנון החלונות הצפים של כרטיס ההזמנה המודרני (moc) */}
      {authPromptConfig.isOpen && (
         <div className="moc moc-modal-overlay" style={{ zIndex: 10000 }} onClick={(e) => { if (e.target === e.currentTarget) handleAuthPromptResponse(null); }}>
             <div className="moc-modal-box">
                 <div className="moc-modal-head">
                     <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                         <span style={{
                             width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                             background: 'var(--moc-primary-light)', color: 'var(--moc-primary-dark)', flexShrink: 0
                         }}>
                             <KeyRound data-element-name="רכיב_PopupProvider_14" size={18} />
                         </span>
                         {authPromptConfig.title}
                     </h3>
                     <button className="moc-close-x" onClick={() => handleAuthPromptResponse(null)}><X data-element-name="כפתור_סגירה_PopupProvider" size={15} /></button>
                 </div>
                 <div className="moc-modal-body">
                     <p style={{ color: 'var(--moc-text-muted)', margin: '0 0 18px', lineHeight: 1.6, fontSize: '0.92rem' }}>
                         {authPromptConfig.message}
                     </p>
                     <div style={{ marginBottom: '16px', position: 'relative' }}>
                         <span className="moc-field-label">בחר {authPromptConfig.requiredLevel}</span>
                         <input data-element-name="חיפוש_PopupProvider_15"
                            ref={authSearchInputRef}
                            type="text"
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
                             <div className="moc-dropdown-menu" style={{ width: '100%', maxHeight: '190px', overflowY: 'auto' }}>
                                 {authPromptConfig.employees === null ? (
                                     <div className="moc-hint" style={{ padding: '10px 16px' }}>טוען רשימת עובדים...</div>
                                 ) : (
                                     <>
                                         {authPromptConfig.employees
                                             .filter(emp => `${emp.firstName} ${emp.lastName}`.includes(authEmployeeSearch))
                                             .map(emp => (
                                                 <div
                                                     key={emp.id}
                                                     className="moc-dropdown-item"
                                                     onMouseDown={(e) => {
                                                         e.preventDefault();
                                                         setSelectedAuthEmployee(emp.id.toString());
                                                         setAuthEmployeeSearch(`${emp.firstName} ${emp.lastName}`);
                                                         setIsAuthEmployeeDropdownOpen(false);
                                                         if (authInputRef.current) authInputRef.current.focus();
                                                     }}
                                                 >
                                                     {emp.firstName} {emp.lastName}
                                                 </div>
                                             ))
                                         }
                                         {authPromptConfig.employees.filter(emp => `${emp.firstName} ${emp.lastName}`.includes(authEmployeeSearch)).length === 0 && (
                                             <div className="moc-hint" style={{ padding: '10px 16px' }}>לא נמצאו תוצאות</div>
                                         )}
                                     </>
                                 )}
                             </div>
                         )}
                     </div>
                     <div>
                         <span className="moc-field-label">קוד {authPromptConfig.requiredLevel}</span>
                         <input data-element-name="שדה_PopupProvider_16"
                             ref={authInputRef}
                             type="password"
                             placeholder="הקלד סיסמה..."
                             onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAuthPromptResponse({ pin: e.target.value, employeeId: selectedAuthEmployee });
                                if (e.key === 'Escape') handleAuthPromptResponse(null);
                             }}
                         />
                     </div>
                 </div>
                 <div className="moc-modal-foot">
                     <button data-element-name="כפתור_PopupProvider_17" className="moc-btn moc-btn-outline" onClick={() => handleAuthPromptResponse(null)}>ביטול</button>
                     <button data-element-name="כפתור_PopupProvider_18" className="moc-btn moc-btn-gold" onClick={() => handleAuthPromptResponse({ pin: authInputRef.current.value, employeeId: selectedAuthEmployee })}>אישור</button>
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
