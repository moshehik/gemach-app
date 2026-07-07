'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const PopupContext = createContext(null);

export function PopupProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, message: '', resolve: null });

  const showAlert = useCallback((message, type = 'info') => {
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

  const showConfirm = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmConfig({ isOpen: true, message, resolve });
    });
  }, []);

  const handleConfirmResponse = useCallback((result) => {
    if (confirmConfig.resolve) {
      confirmConfig.resolve(result);
    }
    setConfirmConfig({ isOpen: false, message: '', resolve: null });
  }, [confirmConfig]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.alert = (message) => showAlert(message);
      window.customConfirm = (message) => showConfirm(message);
    }
  }, [showAlert, showConfirm]);

  return (
    <PopupContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      
      {/* Toast Alerts Container */}
      <div className="popup-toast-container">
        {alerts.map(alert => (
          <div key={alert.id} className={`popup-toast animate-slide-in ${alert.type}`}>
            <div className="popup-toast-message">{alert.message}</div>
            <button className="popup-toast-close" onClick={() => removeAlert(alert.id)}>×</button>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmConfig.isOpen && (
         <div className="popup-overlay">
             <div className="popup-content popup-confirm animate-fade-in">
                 <div className="popup-header">
                     <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>אישור פעולה</h3>
                 </div>
                 <div className="popup-body" style={{ margin: '1.5rem 0', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>
                     {confirmConfig.message}
                 </div>
                 <div className="popup-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                     <button className="btn btn-outline" onClick={() => handleConfirmResponse(false)}>ביטול</button>
                     <button className="btn btn-primary" onClick={() => handleConfirmResponse(true)}>אישור</button>
                 </div>
             </div>
         </div>
      )}
    </PopupContext.Provider>
  );
}

export const usePopup = () => useContext(PopupContext);
