'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Info, HelpCircle, X } from 'lucide-react';

const PopupContext = createContext(null);

export function PopupProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', resolve: null, title: 'אישור פעולה' });
  const [promptConfig, setPromptConfig] = useState({ isOpen: false, message: '', resolve: null, title: 'הזנת נתונים', defaultValue: '', type: 'text' });
  const [authPromptConfig, setAuthPromptConfig] = useState({ isOpen: false, message: '', resolve: null, title: 'אימות הרשאה', requiredLevel: 'מנהל', employees: [] });
  const promptInputRef = useRef(null);
  const authInputRef = useRef(null);
  const [selectedAuthEmployee, setSelectedAuthEmployee] = useState('');

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
    setAlerts(prev => [...prev, { id, message, type }]);
    
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
      try {
        const res = await fetch('/api/employees');
        if (res.ok) {
          employees = await res.json();
          if (requiredLevel === 'מנהל') {
            employees = employees.filter(e => e.roleId === 1 || e.roleId === 2);
          }
        }
      } catch (err) {
        console.error(err);
      }
      setAuthPromptConfig({ isOpen: true, message, resolve, title, requiredLevel, employees });
      setSelectedAuthEmployee(employees.length > 0 ? employees[0].id.toString() : '');
      setTimeout(() => {
        if (authInputRef.current) authInputRef.current.focus();
      }, 100);
    });
  }, []);

  const handleAuthPromptResponse = useCallback((result) => {
    if (authPromptConfig.resolve) {
      authPromptConfig.resolve(result); // result will be { pin, employeeId } or null
    }
    setAuthPromptConfig({ isOpen: false, message: '', resolve: null, title: 'אימות הרשאה', requiredLevel: 'מנהל', employees: [] });
    setSelectedAuthEmployee('');
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
    <PopupContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
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
            {alert.type === 'error' ? <AlertTriangle size={20} /> : alert.type === 'success' ? <CheckCircle size={20} /> : <Info size={20} />}
            <div className="popup-toast-message" style={{ flex: 1, fontWeight: '500', fontSize: '0.95rem' }}>{alert.message}</div>
            <button className="popup-toast-close" onClick={() => removeAlert(alert.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}>
              <X size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmConfig.isOpen && (
         <div className="popup-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
             <div className="popup-content animate-fade-in" style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                 <div style={{ padding: '24px 24px 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ background: '#fef3c7', color: '#d97706', padding: '10px', borderRadius: '12px' }}>
                        <HelpCircle size={28} />
                     </div>
                     <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: '700' }}>{confirmConfig.title}</h3>
                 </div>
                 <div style={{ padding: '20px 24px', fontSize: '1.05rem', color: '#475569', lineHeight: '1.5' }}>
                     {confirmConfig.message}
                 </div>
                 <div style={{ background: '#f8fafc', padding: '16px 24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0' }}>
                     <button onClick={() => handleConfirmResponse(false)} style={{ padding: '10px 20px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseOver={e => e.currentTarget.style.background='#f1f5f9'} onMouseOut={e => e.currentTarget.style.background='white'}>ביטול</button>
                     <button onClick={() => handleConfirmResponse(true)} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }} onMouseOver={e => e.currentTarget.style.background='#2563eb'} onMouseOut={e => e.currentTarget.style.background='#3b82f6'}>אישור</button>
                 </div>
             </div>
         </div>
      )}

      {/* Prompt Modal */}
      {promptConfig.isOpen && (
         <div className="popup-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
             <div className="popup-content animate-fade-in" style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                 <div style={{ padding: '24px 24px 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '10px', borderRadius: '12px' }}>
                        <Info size={28} />
                     </div>
                     <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: '700' }}>{promptConfig.title}</h3>
                 </div>
                 <div style={{ padding: '20px 24px' }}>
                     <div style={{ fontSize: '1.05rem', color: '#475569', marginBottom: '12px', lineHeight: '1.5' }}>
                         {promptConfig.message}
                     </div>
                     <input
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
                     <button onClick={() => handlePromptResponse(null)} style={{ padding: '10px 20px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseOver={e => e.currentTarget.style.background='#f1f5f9'} onMouseOut={e => e.currentTarget.style.background='white'}>ביטול</button>
                     <button onClick={() => handlePromptResponse(promptInputRef.current.value)} style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }} onMouseOver={e => e.currentTarget.style.background='#4338ca'} onMouseOut={e => e.currentTarget.style.background='#4f46e5'}>אישור</button>
                 </div>
             </div>
         </div>
      )}

      {/* Auth Prompt Modal */}
      {authPromptConfig.isOpen && (
         <div className="popup-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
             <div className="popup-content animate-fade-in" style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                 <div style={{ padding: '24px 24px 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '10px', borderRadius: '12px' }}>
                        <Info size={28} />
                     </div>
                     <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: '700' }}>{authPromptConfig.title}</h3>
                 </div>
                 <div style={{ padding: '20px 24px' }}>
                     <div style={{ fontSize: '1.05rem', color: '#475569', marginBottom: '12px', lineHeight: '1.5' }}>
                         {authPromptConfig.message}
                     </div>
                     <div style={{ marginBottom: '16px' }}>
                         <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>בחר {authPromptConfig.requiredLevel}</label>
                         <select 
                            value={selectedAuthEmployee}
                            onChange={(e) => setSelectedAuthEmployee(e.target.value)}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '1.05rem', outline: 'none', background: '#f8fafc' }}
                         >
                            <option value="">-- בחר --</option>
                            {authPromptConfig.employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                            ))}
                         </select>
                     </div>
                     <div>
                         <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>קוד {authPromptConfig.requiredLevel}</label>
                         <input
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
                     <button onClick={() => handleAuthPromptResponse(null)} style={{ padding: '10px 20px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseOver={e => e.currentTarget.style.background='#f1f5f9'} onMouseOut={e => e.currentTarget.style.background='white'}>ביטול</button>
                     <button onClick={() => handleAuthPromptResponse({ pin: authInputRef.current.value, employeeId: selectedAuthEmployee })} style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }} onMouseOver={e => e.currentTarget.style.background='#4338ca'} onMouseOut={e => e.currentTarget.style.background='#4f46e5'}>אישור</button>
                 </div>
             </div>
         </div>
      )}
    </PopupContext.Provider>
  );
}

export const usePopup = () => useContext(PopupContext);
