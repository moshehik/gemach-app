'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUniqueNames } from '../app/components/UniqueNamesContext';
import { RefreshCw } from 'lucide-react';

// Global API Fetch Interceptor to capture the exact API queries sent by pages to the server
if (typeof window !== 'undefined' && !window.__FETCH_INTERCEPTED__) {
  window.__FETCH_INTERCEPTED__ = true;
  window.__LAST_API_CALLS__ = window.__LAST_API_CALLS__ || {};
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (urlStr && urlStr.includes('/api/') && !urlStr.includes('/api/queries-by-path')) {
        const path = window.location.pathname;
        window.__LAST_API_CALLS__[path] = urlStr;
        if (urlStr.includes('/api/orders')) window.__LAST_API_CALLS__['orders'] = urlStr;
        if (urlStr.includes('/api/dresses')) window.__LAST_API_CALLS__['dresses'] = urlStr;
        if (urlStr.includes('/api/customers')) window.__LAST_API_CALLS__['customers'] = urlStr;
        if (urlStr.includes('/api/alterations')) window.__LAST_API_CALLS__['alterations'] = urlStr;
        if (urlStr.includes('/api/employees')) window.__LAST_API_CALLS__['employees'] = urlStr;
        if (urlStr.includes('/api/refunds')) window.__LAST_API_CALLS__['refunds'] = urlStr;
        
        window.dispatchEvent(new CustomEvent('agy_api_call', { detail: { url: urlStr } }));
      }
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };
}

export default function ClipboardDebugger() {
  const [isQueryOpen, setIsQueryOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef(null);
  const [buttonRect, setButtonRect] = useState(null);
  const { showUniqueNames, toggleUniqueNames } = useUniqueNames();

  const [queries, setQueries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastApiStats, setLastApiStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Element Copy Mode: When true, clicking ANY element copies its unique/generated name to clipboard
  const [elementCopyMode, setElementCopyMode] = useState(false);

  useEffect(() => {
    const handleApiCallEvent = (e) => {
      if (e.detail) {
        setLastApiStats(e.detail);
      }
    };
    window.addEventListener('agy_api_call', handleApiCallEvent);
    return () => window.removeEventListener('agy_api_call', handleApiCallEvent);
  }, []);

  useEffect(() => {
    setMounted(true);

    const handleGlobalClick = (e) => {
      // Don't track clicks on the debugger button itself or the floating panel
      if (e.target.closest('#debug-toggle-btn') || e.target.closest('#debug-floating-panel')) {
        return;
      }

      // If Element Copy Mode is ACTIVE: intercept click and copy element's name
      if (elementCopyMode) {
        e.preventDefault();
        e.stopPropagation();

        let el = e.target.closest('[data-element-name], [data-agy-id], [id], [name]');
        let name = '';

        if (el) {
          name = el.getAttribute('data-element-name') || 
                 el.getAttribute('data-agy-id') || 
                 el.getAttribute('name') || 
                 el.getAttribute('id');
        }

        if (!name) {
          // Generate dynamic human-readable name for elements without explicit name tags
          const target = e.target;
          const tagName = target.tagName.toLowerCase();
          const textContent = (target.innerText || target.textContent || target.placeholder || target.title || target.getAttribute('aria-label') || '').trim();
          
          let cleanText = textContent.substring(0, 20).replace(/[\s\W]+/g, '_');
          if (cleanText.endsWith('_')) cleanText = cleanText.slice(0, -1);
          if (cleanText.startsWith('_')) cleanText = cleanText.slice(1);
          
          if (tagName === 'th' || tagName === 'td') {
            name = `עמודה_טבלה_${cleanText || 'שדה'}`;
          } else if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            name = `שדה_קלט_${cleanText || target.name || target.type || 'טקסט'}`;
          } else if (tagName === 'button' || target.getAttribute('role') === 'button') {
            name = `כפתור_${cleanText || 'פעולה'}`;
          } else if (tagName === 'a') {
            name = `קישור_${cleanText || 'ניווט'}`;
          } else {
            name = `תגית_${tagName}_${cleanText || 'אלמנט'}`;
          }
        }

        copyTextToClipboard(name, `מזהה אלמנט הועתק: ${name}`);
        return;
      }

      // Normal click tracking for last clicked button
      let target = e.target;
      while (target && target !== document.body) {
        if (
          target.tagName === 'BUTTON' || 
          target.getAttribute('role') === 'button' || 
          (target.tagName === 'A' && (target.classList?.contains('btn') || target.classList?.contains('button')))
        ) {
          let btnText = target.getAttribute('data-element-name') || 
                        target.innerText || 
                        target.textContent || 
                        target.title || 
                        target.getAttribute('aria-label') || 
                        'לחצן ללא טקסט';
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

    document.addEventListener('click', handleGlobalClick, { capture: true });
    
    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, [elementCopyMode]);

  // Fetch queries when dialog is open and when search or path changes or when API calls happen
  useEffect(() => {
    if (!isQueryOpen) return;

    const fetchQueries = async () => {
      setLoading(true);
      try {
        const pathParam = encodeURIComponent(window.location.pathname);
        const urlSearchParam = encodeURIComponent(window.location.search);
        const lastApiCall = window.__LAST_API_CALLS__?.[window.location.pathname] || window.__GLOBAL_LAST_API_CALL__ || '';
        const lastApiCallParam = encodeURIComponent(lastApiCall);

        // Collect live active input and select values from the page
        const liveFilters = {};
        try {
          const searchParams = new URLSearchParams(window.location.search);
          searchParams.forEach((val, key) => { if (val) liveFilters[key] = val; });

          document.querySelectorAll('input, select, textarea').forEach(el => {
            if (el.value && el.value.trim() && el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button') {
              if (el.getAttribute('placeholder') === 'חפש שאילתה בתוך המסך הנוכחי...') return;
              const key = el.name || el.id || el.getAttribute('data-agy-id') || el.getAttribute('placeholder') || 'filter';
              if (!liveFilters[key]) {
                liveFilters[key] = el.value.trim();
              }
            }
          });
        } catch(e) {}

        const activeFiltersParam = encodeURIComponent(JSON.stringify(liveFilters));
        const searchParam = encodeURIComponent(searchQuery);
        const res = await fetch(`/api/queries-by-path?path=${pathParam}&urlSearch=${urlSearchParam}&lastApiCall=${lastApiCallParam}&activeFilters=${activeFiltersParam}&search=${searchParam}&_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setQueries(data);
        }
      } catch (err) {
        console.error('Failed to fetch queries', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQueries();

    // Listen to live API calls made by filter buttons or inputs on the page
    const handleApiCall = () => {
      fetchQueries();
    };
    window.addEventListener('agy_api_call', handleApiCall);

    return () => {
      window.removeEventListener('agy_api_call', handleApiCall);
    };
  }, [searchQuery, isQueryOpen, refreshKey]);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }

    // Clicking icon closes query window and cancels element copy mode
    if (isQueryOpen || elementCopyMode) {
      setIsQueryOpen(false);
      setElementCopyMode(false);
    } else {
      setIsQueryOpen(true);
    }
  };

  const copyTextToClipboard = async (text, successMsg = 'הועתק ללוח!') => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ message: successMsg, type: 'success' });
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setToast({ message: 'שגיאה בהעתקה', type: 'error' });
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <>
      <div 
        id="debug-toggle-btn"
        ref={buttonRef}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 999998,
          backgroundColor: elementCopyMode ? '#ef4444' : 'rgba(255, 255, 255, 0.95)',
          color: elementCopyMode ? '#ffffff' : '#4f46e5',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          cursor: 'pointer',
          boxShadow: elementCopyMode ? '0 0 20px rgba(239, 68, 68, 0.5)' : '0 6px 20px rgba(79, 70, 229, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          border: elementCopyMode ? '2px solid #ef4444' : '2px solid #4f46e5',
          backdropFilter: 'blur(5px)'
        }}
        onClick={handleClick}
        title={elementCopyMode ? "מצב העתקת מזהים פעיל - לחץ לסגירה וביטול" : "לחץ לצפייה בשאילתות מסך וניהול מזהים"}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.08) rotate(5deg)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
        }}
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>

      {isQueryOpen && mounted && createPortal(
        <div 
          id="debug-floating-panel"
          style={{
            position: 'fixed',
            bottom: buttonRect ? (window.innerHeight - buttonRect.top + 10) : 80,
            right: buttonRect ? (window.innerWidth - buttonRect.right) : 20,
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '1.25rem',
            zIndex: 9999999,
            width: '360px',
            direction: 'rtl',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '750', fontSize: '1rem', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🔍</span> שאילתות ונתוני API
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button 
                title="רענן שאילתות בזמן אמת"
                onClick={() => setRefreshKey(prev => prev + 1)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', color: '#4f46e5', padding: '5px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e0e7ff'; e.currentTarget.style.transform = 'scale(1.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> רענן
              </button>
              <button 
                onClick={() => {
                  setIsQueryOpen(false);
                  setElementCopyMode(false);
                }} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
          
          {/* Live API Call Payload Size Banner */}
          {lastApiStats && (
            <div style={{
              background: (typeof lastApiStats.responseSize === 'number' && lastApiStats.responseSize > 1048576) ? '#fef2f2' : (typeof lastApiStats.responseSize === 'number' && lastApiStats.responseSize > 102400) ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${(typeof lastApiStats.responseSize === 'number' && lastApiStats.responseSize > 1048576) ? '#fecaca' : (typeof lastApiStats.responseSize === 'number' && lastApiStats.responseSize > 102400) ? '#fde68a' : '#bbf7d0'}`,
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '0.75rem',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              color: (typeof lastApiStats.responseSize === 'number' && lastApiStats.responseSize > 1048576) ? '#991b1b' : (typeof lastApiStats.responseSize === 'number' && lastApiStats.responseSize > 102400) ? '#92400e' : '#166534',
              fontWeight: '600'
            }}>
              <span style={{ direction: 'ltr', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                {lastApiStats.endpoint}
              </span>
              <span style={{ direction: 'ltr', display: 'flex', gap: '4px', alignItems: 'center' }}>
                📦 {typeof lastApiStats.responseSize === 'number' && !isNaN(lastApiStats.responseSize)
                  ? (lastApiStats.responseSize >= 1048576
                    ? `${(lastApiStats.responseSize / 1048576).toFixed(2)} MB`
                    : `${(lastApiStats.responseSize / 1024).toFixed(1)} KB`)
                  : 'נלכד בזמן אמת'
                }
                {typeof lastApiStats.executionTime === 'number' && !isNaN(lastApiStats.executionTime) && (
                  <span style={{ opacity: 0.75, fontSize: '0.7rem' }}>({lastApiStats.executionTime}ms)</span>
                )}
              </span>
            </div>
          )}
          
          {/* Search box */}
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="חפש שאילתה במאגר (לדוגמה: הזמנות)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                background: 'var(--input-bg, #f8fafc)',
                color: 'var(--text-color, #1f2937)',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#4f46e5'}
              onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Queries list container */}
          <div style={{ 
            maxHeight: '260px', 
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            paddingRight: '2px'
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#6b7280', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTop: '2px solid #4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span>טוען שאילתות...</span>
              </div>
            ) : queries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', fontSize: '0.85rem', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e5e7eb' }}>
                {searchQuery ? 'לא נמצאו שאילתות תואמות לחיפוש' : 'אין שאילתות מוגדרות למסך זה'}
              </div>
            ) : (
              queries.map((q, idx) => (
                <div 
                  key={idx} 
                  style={{
                    border: q.isMain ? '1.5px solid #4f46e5' : '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '10px',
                    padding: '0.75rem',
                    background: q.isMain ? 'rgba(79, 70, 229, 0.04)' : 'var(--card-bg, #ffffff)',
                    boxShadow: q.isMain ? '0 2px 8px rgba(79, 70, 229, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    transition: 'box-shadow 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = q.isMain ? '0 2px 8px rgba(79, 70, 229, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontWeight: '700', color: '#1e293b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.8rem', wordBreak: 'break-all', color: q.isMain ? '#4f46e5' : '#334155' }}>
                        {q.name.replace('~sq_c', '').replace('~sq_f', '').replace('~sq_r', '')}
                      </span>
                      {q.subtitle && (
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>
                          {q.subtitle}
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => copyTextToClipboard(q.sql, 'השאילתה הועתקה ללוח!')}
                      title="העתק שאילתה"
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        color: '#4f46e5',
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '4px',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s',
                        flexShrink: 0
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                  </div>
                  <pre 
                    style={{ 
                      margin: 0, 
                      padding: '0.5rem', 
                      background: '#f1f5f9', 
                      borderRadius: '6px',
                      fontSize: '0.72rem', 
                      maxHeight: '70px', 
                      overflowY: 'auto', 
                      direction: 'ltr',
                      textAlign: 'left', 
                      fontFamily: 'Consolas, Monaco, monospace', 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-all',
                      color: '#475569',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    {q.sql}
                  </pre>
                </div>
              ))
            )}
          </div>

          {/* Action buttons footer */}
          <div style={{ display: 'flex', borderTop: '1px solid var(--border-color, #e5e7eb)', paddingTop: '0.75rem' }}>
            <button 
              onClick={() => {
                const nextState = !elementCopyMode;
                setElementCopyMode(nextState);
                setToast({ 
                  message: nextState ? 'מצב העתקת מזהים הופעל! לחץ על כל אלמנט במסך להעתקה' : 'מצב העתקת מזהים הופסק', 
                  type: nextState ? 'info' : 'success' 
                });
                setTimeout(() => setToast(null), 3000);
              }}
              style={{ 
                width: '100%',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '0.4rem', 
                background: elementCopyMode ? '#ef4444' : '#10b981', 
                color: 'white', 
                border: 'none', 
                padding: '0.65rem 0.8rem', 
                borderRadius: '8px', 
                fontWeight: '600', 
                cursor: 'pointer',
                fontSize: '0.85rem',
                boxShadow: elementCopyMode ? '0 2px 4px rgba(239, 68, 68, 0.15)' : '0 2px 4px rgba(16, 185, 129, 0.15)',
                transition: 'background-color 0.2s'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {elementCopyMode ? (
                  <>
                    <path d="M2 12h20" />
                    <path d="M12 2v20" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
              {elementCopyMode ? 'בטל העתקת מזהים' : 'הפעל העתקת מזהים'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {toast && mounted && createPortal(
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 9999999,
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: '600',
          direction: 'rtl',
          animation: 'fadeInDown 0.3s ease-out',
          fontSize: '0.9rem'
        }}>
          {toast.message}
        </div>,
        document.body
      )}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </>
  );
}

