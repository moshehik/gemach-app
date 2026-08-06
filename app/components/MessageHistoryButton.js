'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X, Copy, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { usePopup } from './PopupProvider';

export default function MessageHistoryButton({ 'data-element-name': dataElementName }) {
  const [isOpen, setIsOpen] = useState(false);
  const popupContext = usePopup();
  const alertsHistory = popupContext?.alertsHistory || [];

  return (
    <>
      <button 
        data-element-name={dataElementName || "כפתור_היסטוריית_הודעות"}
        onClick={() => setIsOpen(true)}
        title="היסטוריית הודעות מערכת"
        className="icon-nav-link"
      >
        <MessageSquare size={20} />
        {alertsHistory.length > 0 && (
          <span className="nav-badge">
            {alertsHistory.length > 99 ? '99+' : alertsHistory.length}
          </span>
        )}
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          direction: 'rtl'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f3ff' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#6d28d9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={20} /> היסטוריית הודעות מערכת
              </h3>
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8b5cf6' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              {alertsHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  אין הודעות מתועדות למסע הנוכחי.
                </div>
              ) : (
                alertsHistory.map((alert, idx) => (
                  <div key={idx} style={{
                    background: alert.type === 'error' ? '#fef2f2' : alert.type === 'success' ? '#f0fdf4' : '#f0f9ff',
                    border: `1px solid ${alert.type === 'error' ? '#fecaca' : alert.type === 'success' ? '#bbf7d0' : '#bae6fd'}`,
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    {alert.type === 'error' ? <AlertTriangle color="#991b1b" size={18} /> : alert.type === 'success' ? <CheckCircle color="#166534" size={18} /> : <Info color="#075985" size={18} />}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {alert.time.toLocaleTimeString('he-IL')}
                      </span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-color)' }}>
                        {alert.message}
                      </span>
                    </div>
                    <button 
                      onClick={() => navigator.clipboard.writeText(alert.message).catch(()=>{})} 
                      style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', padding: '4px', color: '#64748b' }}
                      title="העתק הודעה"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
