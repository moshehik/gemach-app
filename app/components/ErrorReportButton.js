'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X, Copy } from 'lucide-react';

export default function ErrorReportButton() {
  const [isQueryOpen, setIsQueryOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [buttonRect, setButtonRect] = useState(null);

  useEffect(() => {
    setMounted(true);

    const handleGlobalClick = (e) => {
      let target = e.target;
      while (target && target !== document.body) {
        if (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button' || (target.tagName === 'A' && (target.classList?.contains('btn') || target.classList?.contains('button')))) {
          let btnText = target.innerText || target.textContent || target.title || target.getAttribute('aria-label') || '׳׳—׳¦׳ ׳׳׳ ׳˜׳§׳¡׳˜';
          btnText = btnText.trim().substring(0, 50).replace(/\n/g, ' ');
          if (btnText) {
            window.__lastButtons = window.__lastButtons || [];
            window.__lastButtons.push(btnText);
            if (window.__lastButtons.length > 5) {
              window.__lastButtons.shift();
            }
          }
          break;
        }
        target = target.parentElement;
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  const handleClick = async (e) => {
    alert('Button clicked! isQueryOpen: ' + isQueryOpen);
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    
    // Copy the last button clicked to the clipboard
    const lastButtons = window.__lastButtons || [];
    const lastBtn = lastButtons.length > 0 ? lastButtons[lastButtons.length - 1] : '׳׳ ׳ ׳׳—׳¥ ׳›׳₪׳×׳•׳¨';
    
    try {
      await navigator.clipboard.writeText(lastBtn);
    } catch (err) {
      console.error('Failed to copy', err);
    }

    // Toggle the floating query window
    if (!isQueryOpen) {
      setButtonRect(rect);
    }
    setIsQueryOpen((prev) => !prev);
  };

  const copyQueryToClipboard = async () => {
    const currentQuery = window.location.search || '׳׳™׳ ׳©׳׳™׳׳×׳” ׳‘׳׳¡׳ ׳–׳”';
    try {
      await navigator.clipboard.writeText(currentQuery);
      setToast({ message: '׳”׳©׳׳™׳׳×׳” ׳”׳•׳¢׳×׳§׳” ׳׳׳•׳—!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({ message: '׳©׳’׳™׳׳” ׳‘׳”׳¢׳×׳§׳”', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <>
      <button 
        onClick={handleClick}
        title="׳“׳™׳•׳•׳—"
        className="icon-nav-link"
        style={{ 
          background: 'none', 
          border: 'none', 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#6366f1',
          position: 'relative',
          padding: '0.25rem'
        }}
      >
        <AlertCircle size={22} />
      </button>

      {isQueryOpen && mounted && createPortal(
        <div style={{
          position: 'fixed',
          top: buttonRect ? buttonRect.bottom + 10 : 60,
          left: buttonRect ? Math.max(10, buttonRect.left - 250) : 10,
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          padding: '1rem',
          zIndex: 9999999,
          width: 'max-content',
          maxWidth: '300px',
          direction: 'rtl',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#4f46e5' }}>׳©׳׳™׳׳×׳× ׳”׳׳¡׳ ׳”׳ ׳•׳›׳—׳™:</span>
            <button 
              onClick={() => setIsQueryOpen(false)} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
            >
              <X size={16} />
            </button>
          </div>
          
          <div style={{ 
            background: 'var(--input-bg, #f3f4f6)', 
            padding: '0.5rem', 
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: 'var(--text-color, #374151)',
            wordBreak: 'break-all'
          }}>
            {window.location.search || '׳׳™׳ ׳©׳׳™׳׳×׳” ׳‘׳›׳×׳•׳‘׳× ׳–׳•'}
          </div>
          
          <button 
            onClick={copyQueryToClipboard}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '0.4rem', 
              background: '#4f46e5', 
              color: 'white', 
              border: 'none', 
              padding: '0.4rem 0.8rem', 
              borderRadius: '6px', 
              fontWeight: '500', 
              cursor: 'pointer',
              fontSize: '0.85rem',
              alignSelf: 'flex-start'
            }}
          >
            <Copy size={14} /> ׳”׳¢׳×׳§ ׳©׳׳™׳׳×׳”
          </button>
        </div>,
        document.body
      )}

      {toast && mounted && createPortal(
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999999,
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: '500',
          direction: 'rtl',
          animation: 'fadeInDown 0.3s ease-out'
        }}>
          {toast.message}
        </div>,
        document.body
      )}
    </>
  );
}


