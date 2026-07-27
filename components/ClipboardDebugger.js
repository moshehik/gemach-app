'use client';

import { useEffect, useState } from 'react';

export default function ClipboardDebugger() {
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      // If debug mode is ON, every click is a debug click (ignore clicks on the toggle button itself)
      if (debugMode && !e.target.closest('#debug-toggle-btn')) {
        let el = e.target.closest('[data-agy-id]');
        
        // Fallback: If no explicit ID exists, use the clicked element itself
        if (!el) {
           el = e.target;
        }

        if (el) {
          e.preventDefault();
          e.stopPropagation();
          
          let id = el.getAttribute('data-agy-id');
          if (!id) {
            // Generate an automatic ID based on tag name and text content
            const tagName = el.tagName.toLowerCase();
            const textContent = el.innerText || el.textContent || '';
            const cleanText = textContent.trim().substring(0, 15).replace(/[\s\W]+/g, '_');
            id = `auto_${tagName}${cleanText ? '_' + cleanText : ''}`;
          }
          
          const showToast = (success) => {
            const toast = document.createElement('div');
            toast.innerHTML = success ? `<strong>ID copied:</strong> ${id}` : `<strong>ID:</strong> ${id} <br><small>(Auto-copy failed, please copy manually)</small>`;
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.right = '20px'; // Moved to right side
            toast.style.backgroundColor = success ? '#4CAF50' : '#f44336';
            toast.style.color = 'white';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '5px';
            toast.style.zIndex = '999999';
            toast.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            toast.style.fontFamily = 'sans-serif';
            toast.style.direction = 'ltr';
            toast.style.pointerEvents = 'none'; // so it doesn't block clicks
            toast.style.transition = 'opacity 0.3s';
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
              toast.style.opacity = '0';
              setTimeout(() => toast.remove(), 300);
            }, 3000);
          };

          let copySuccess = false;
          try {
             // Run fallback synchronously first because it requires a strict user gesture
             const textArea = document.createElement("textarea");
             textArea.value = id;
             textArea.style.position = "fixed";
             textArea.style.opacity = "0"; // Invisible
             document.body.appendChild(textArea);
             textArea.focus();
             textArea.select();
             copySuccess = document.execCommand('copy');
             document.body.removeChild(textArea);
          } catch(err) {
             console.error('execCommand Error', err);
          }
          
          if (copySuccess) {
             showToast(true);
          } else if (navigator.clipboard && navigator.clipboard.writeText) {
             navigator.clipboard.writeText(id)
               .then(() => showToast(true))
               .catch(() => showToast(false));
          } else {
             showToast(false);
          }
        }
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });
    
    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, [debugMode]);

  return (
    <div 
      id="debug-toggle-btn"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 999998,
        backgroundColor: debugMode ? '#ff9800' : 'rgba(255, 255, 255, 0.9)',
        color: debugMode ? 'white' : '#333',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        cursor: 'pointer',
        boxShadow: debugMode ? '0 0 15px rgba(255, 152, 0, 0.5)' : '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        transition: 'all 0.2s ease',
        border: debugMode ? 'none' : '1px solid rgba(0,0,0,0.1)',
        backdropFilter: 'blur(5px)'
      }}
      onClick={() => setDebugMode(!debugMode)}
      title="מצב איתור מזהים (הדלק/כבה)"
    >
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
  );
}
