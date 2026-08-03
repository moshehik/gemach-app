'use client';

import React, { useState, useEffect, useRef } from 'react';
import { History, FileText, User, Shirt } from 'lucide-react';
import { usePopup } from './PopupProvider';
import { useRouter } from 'next/navigation';

export default function HistoryQuickBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const menuRef = useRef(null);
  const { openRentalModal } = usePopup();
  const router = useRouter();

  useEffect(() => {
    const loadHistory = () => {
      try {
        const h = localStorage.getItem('agy_history');
        if (h) setHistory(JSON.parse(h));
      } catch (e) {}
    };
    loadHistory();
    window.addEventListener('agy_history_updated', loadHistory);
    return () => window.removeEventListener('agy_history_updated', loadHistory);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (item, e) => {
    e.preventDefault();
    setIsOpen(false);
    
    if (item.type === 'rental') {
      if (openRentalModal) {
        openRentalModal(item.id);
      } else {
        router.push(`/rentals?orderId=${item.id}`);
      }
    } else if (item.type === 'customer') {
      router.push(`/customers/${item.id}`);
    } else {
      router.push(`/orders/${item.id}`);
    }
  };

  const clearHistory = (e) => {
    e.stopPropagation();
    localStorage.removeItem('agy_history');
    setHistory([]);
  };

  return (
    <div className="history-quick-bar" ref={menuRef} style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="icon-nav-link"
        title="היסטוריית צפיות"
        style={{ 
          background: 'none', border: 'none', cursor: 'pointer', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isOpen ? 'var(--primary-color)' : 'var(--text-color)',
          transition: 'all 0.2s', padding: '8px', borderRadius: '50%'
        }}
      >
        <History size={22} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '120%', left: '0', 
          width: '280px', background: 'var(--card-bg, #fff)', 
          borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          border: '1px solid var(--element-border, #e2e8f0)',
          zIndex: 1000, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          animation: 'fade-in 0.2s ease-out'
        }}>
          <div style={{ 
            padding: '12px 16px', background: 'var(--element-bg, #f8fafc)', 
            borderBottom: '1px solid var(--divider, #f1f5f9)', display: 'flex', 
            justifyContent: 'space-between', alignItems: 'center' 
          }}>
            <span style={{ fontWeight: 'bold', color: 'var(--text-main, #334155)', fontSize: '0.95rem' }}>נצפו לאחרונה</span>
            {history.length > 0 && (
              <button onClick={clearHistory} style={{ 
                background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', 
                cursor: 'pointer', fontSize: '0.8rem', padding: '4px' 
              }}>
                נקה
              </button>
            )}
          </div>

          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {history.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem' }}>
                אין היסטוריה זמינה
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {history.map((item, index) => (
                  <li key={`${item.type}-${item.id}-${index}`} style={{ borderBottom: '1px solid var(--divider, #f1f5f9)' }}>
                    <a href="#" onClick={(e) => handleItemClick(item, e)} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', 
                      padding: '12px 16px', textDecoration: 'none',
                      color: 'var(--text-main, #334155)', transition: 'background 0.1s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--element-bg, #f8fafc)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: item.type === 'order' ? 'rgba(59, 130, 246, 0.1)' : item.type === 'customer' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: item.type === 'order' ? '#3b82f6' : item.type === 'customer' ? '#10b981' : '#f59e0b'
                      }}>
                        {item.type === 'order' ? <FileText size={16} /> : item.type === 'customer' ? <User size={16} /> : <Shirt size={16} />}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </span>
                        {item.subtext && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.subtext}
                          </span>
                        )}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
