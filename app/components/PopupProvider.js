'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Info, HelpCircle, X, Copy } from 'lucide-react';
import RentalReturnModal from '../../components/orders/RentalReturnModal';

const PopupContext = createContext(null);

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

  const showAuthPrompt = useCallback(async (message, requiredLevel = 'מנהל', title = 'אימות הרשאה') => {
    return new Promise(async (resolve) => {
      let employees = [];
      let currentUser = null;
      try {
        const [resEmp, resMe] = await Promise.all([
          fetch('/api/employees'),
          fetch('/api/me').catch(() => ({ ok: false }))
        ]);
        
        if (resEmp.ok) {
          employees = await resEmp.json();
          if (requiredLevel === 'מנהל') {
            employees = employees.filter(e => e.roleId === 1 || e.roleId === 2);
          }
        }
        if (resMe.ok) {
          const meData = await resMe.json();
          if (meData && meData.success) {
            currentUser = meData.employee;
          }
        }
      } catch (err) {
        console.error(err);
      }
      
      let defaultEmpId = '';
      let defaultEmpName = '';
      
      if (employees.length > 0) {
        if (currentUser && employees.some(e => e.id === currentUser.id)) {
          defaultEmpId = currentUser.id.toString();
          defaultEmpName = `${currentUser.firstName} ${currentUser.lastName}`;
        }
      }
      
      setAuthPromptConfig({ isOpen: true, message, resolve, title, requiredLevel, employees });
      setSelectedAuthEmployee(defaultEmpId);
      setAuthEmployeeSearch(defaultEmpName);
      setIsAuthEmployeeDropdownOpen(false);

      setTimeout(() => {
        if (defaultEmpId && authInputRef.current) {
          authInputRef.current.focus();
        } else if (!defaultEmpId && authSearchInputRef.current) {
          authSearchInputRef.current.focus();
        } else if (authInputRef.current) {
          authInputRef.current.focus();
        }
      }, 100);
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
                     <div style={{ background: '#fef3c7', color: '#d97706', padding: '10px', borderRadius: '12px' }}>
                        <HelpCircle data-element-name="רכיב_PopupProvider_7" size={28} />
                     </div>
                     <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: '700' }}>{confirmConfig.title}</h3>
                 </div>
                 <div style={{ padding: '20px 24px', fontSize: '1.05rem', color: '#475569', lineHeight: '1.5' }}>
                     {confirmConfig.message}
                 </div>
                 <div style={{ background: '#f8fafc', padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
                     <button data-element-name="כפתור_PopupProvider_8" onClick={() => handleConfirmResponse(false)} style={{ padding: '10px 20px', background: 'var(--card-bg)', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseOver={e => e.currentTarget.style.background='#f1f5f9'} onMouseOut={e => e.currentTarget.style.background='var(--input-bg)'}>ביטול</button>
                     <button data-element-name="כפתור_PopupProvider_9" onClick={() => handleConfirmResponse(true)} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }} onMouseOver={e => e.currentTarget.style.background='#2563eb'} onMouseOut={e => e.currentTarget.style.background='#3b82f6'}>אישור</button>
                 </div>
             </div>
         </div>
      )}

      {/* Prompt Modal */}
      {promptConfig.isOpen && (
         <div className="popup-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
             <div className="popup-content animate-fade-in" style={{ background: 'var(--card-bg)', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                 <div style={{ padding: '24px 24px 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '10px', borderRadius: '12px' }}>
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
                         onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                         onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                     />
                 </div>
                 <div style={{ background: '#f8fafc', padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
                     <button data-element-name="כפתור_PopupProvider_12" onClick={() => handlePromptResponse(null)} style={{ padding: '10px 20px', background: 'var(--card-bg)', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseOver={e => e.currentTarget.style.background='#f1f5f9'} onMouseOut={e => e.currentTarget.style.background='var(--input-bg)'}>ביטול</button>
                     <button data-element-name="כפתור_PopupProvider_13" onClick={() => handlePromptResponse(promptInputRef.current.value)} style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }} onMouseOver={e => e.currentTarget.style.background='#4338ca'} onMouseOut={e => e.currentTarget.style.background='#4f46e5'}>אישור</button>
                 </div>
             </div>
         </div>
      )}

      {/* Auth Prompt Modal */}
      {authPromptConfig.isOpen && (
         <div className="popup-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
             <div className="popup-content animate-fade-in" style={{ background: 'var(--card-bg)', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                 <div style={{ padding: '24px 24px 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '10px', borderRadius: '12px' }}>
                        <Info data-element-name="רכיב_PopupProvider_14" size={28} />
                     </div>
                     <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: '700' }}>{authPromptConfig.title}</h3>
                 </div>
                 <div style={{ padding: '20px 24px' }}>
                     <div style={{ fontSize: '1.05rem', color: '#475569', marginBottom: '12px', lineHeight: '1.5' }}>
                         {authPromptConfig.message}
                     </div>
                     <div style={{ marginBottom: '16px', position: 'relative' }}>
                         <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>בחר {authPromptConfig.requiredLevel}</label>
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
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '1.05rem', outline: 'none', transition: 'border-color 0.2s', background: '#f8fafc' }}
                            onFocusCapture={(e) => { e.target.style.borderColor = '#4f46e5'; setIsAuthEmployeeDropdownOpen(true); }}
                            onBlurCapture={(e) => e.target.style.borderColor = '#e2e8f0'}
                         />
                         {isAuthEmployeeDropdownOpen && (
                             <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'var(--card-bg)', border: '1px solid #e2e8f0', borderRadius: '10px', maxHeight: '180px', overflowY: 'auto', zIndex: 10001, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                                 {authPromptConfig.employees
                                     .filter(emp => `${emp.firstName} ${emp.lastName}`.includes(authEmployeeSearch))
                                     .map(emp => (
                                         <div 
                                             key={emp.id}
                                             onMouseDown={(e) => {
                                                 e.preventDefault();
                                                 setSelectedAuthEmployee(emp.id.toString());
                                                 setAuthEmployeeSearch(`${emp.firstName} ${emp.lastName}`);
                                                 setIsAuthEmployeeDropdownOpen(false);
                                                 if (authInputRef.current) authInputRef.current.focus();
                                             }}
                                             style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: 'var(--text-color)' }}
                                             onMouseOver={(e) => e.currentTarget.style.background = 'var(--input-bg)'}
                                             onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                         >
                                             {emp.firstName} {emp.lastName}
                                         </div>
                                     ))
                                 }
                                 {authPromptConfig.employees.filter(emp => `${emp.firstName} ${emp.lastName}`.includes(authEmployeeSearch)).length === 0 && (
                                     <div style={{ padding: '10px 16px', color: '#94a3b8' }}>לא נמצאו תוצאות</div>
                                 )}
                             </div>
                         )}
                     </div>
                     <div>
                         <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>קוד {authPromptConfig.requiredLevel}</label>
                         <input data-element-name="שדה_PopupProvider_16"
                             ref={authInputRef}
                             type="password"
                             placeholder="הקלד סיסמה..."
                             onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAuthPromptResponse({ pin: e.target.value, employeeId: selectedAuthEmployee });
                                if (e.key === 'Escape') handleAuthPromptResponse(null);
                             }}
                             style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '1.05rem', outline: 'none', transition: 'border-color 0.2s', background: '#f8fafc' }}
                             onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
                             onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                         />
                     </div>
                 </div>
                 <div style={{ background: '#f8fafc', padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
                     <button data-element-name="כפתור_PopupProvider_17" onClick={() => handleAuthPromptResponse(null)} style={{ padding: '10px 20px', background: 'var(--card-bg)', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseOver={e => e.currentTarget.style.background='#f1f5f9'} onMouseOut={e => e.currentTarget.style.background='var(--input-bg)'}>ביטול</button>
                     <button data-element-name="כפתור_PopupProvider_18" onClick={() => handleAuthPromptResponse({ pin: authInputRef.current.value, employeeId: selectedAuthEmployee })} style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }} onMouseOver={e => e.currentTarget.style.background='#4338ca'} onMouseOut={e => e.currentTarget.style.background='#4f46e5'}>אישור</button>
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
