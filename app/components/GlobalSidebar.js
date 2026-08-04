'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { PlusCircle, RotateCcw, Search, Barcode, X, ArrowLeft, Loader2, User, FileText, History, Shirt } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import useDebounce from '@/hooks/useDebounce';
import { usePopup } from './PopupProvider';

export default function GlobalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [activePopover, setActivePopover] = useState(null); // 'return', 'search', 'history', null
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const { openRentalModal } = usePopup();
  
  const debouncedSearchTerm = useDebounce(inputValue, 350);
  
  const sidebarRef = useRef(null);

  if (pathname && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    return null;
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setActivePopover(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadHistory = () => {
      try {
        const h = localStorage.getItem('agy_history');
        if (h) setHistoryItems(JSON.parse(h));
      } catch (e) {}
    };
    loadHistory();
    window.addEventListener('agy_history_updated', loadHistory);
    return () => window.removeEventListener('agy_history_updated', loadHistory);
  }, []);

  const handleRefresh = () => {
    window.location.href = window.location.pathname;
  };

  const handleTogglePopover = (type) => {
    if (activePopover === type) {
      setActivePopover(null);
    } else {
      setActivePopover(type);
      setInputValue('');
      setSearchResults([]);
    }
  };

  const handleHistoryItemClick = (item, e) => {
    e.preventDefault();
    setActivePopover(null);
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
    setHistoryItems([]);
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const cleanBarcode = inputValue.replace(/\s+/g, '');
      const res = await fetch('/api/returns/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: cleanBarcode })
      });
      const data = await res.json();
      
      if (res.ok) {
        alert('ההחזרה נקלטה בהצלחה!');
        setActivePopover(null);
        setInputValue('');
        if (openRentalModal) {
          openRentalModal(data.orderId);
        } else {
          router.push('/rentals?orderId=' + data.orderId);
        }
      } else {
        alert(data.error || 'שגיאה בהחזרה');
      }
    } catch (err) {
      alert('שגיאת תקשורת');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activePopover !== 'search') return;
    
    const search = async () => {
      if (debouncedSearchTerm.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch('/api/global-search?q=' + encodeURIComponent(debouncedSearchTerm.trim()));
        const data = await res.json();
        if (data && (data.customers || data.orders)) {
          setSearchResults([...(data.orders || []), ...(data.customers || [])].slice(0, 7));
        }
      } catch (e) {
        // silent fail
      } finally {
        setIsLoading(false);
      }
    };
    
    search();
  }, [debouncedSearchTerm, activePopover]);

  const handleSearchInput = (e) => {
    setInputValue(e.target.value);
  };

  return (
    <div className="global-sidebar" ref={sidebarRef} data-element-name="רכיב_GlobalSidebar_1">
      <Link href="/orders/new" className="global-sidebar-icon" title="הזמנה חדשה" data-element-name="רכיב_GlobalSidebar_2" onClick={() => setActivePopover(null)}>
        <PlusCircle size={22} strokeWidth={2.5} />
      </Link>
      
      <button 
        type="button"
        onClick={handleRefresh} 
        className="global-sidebar-icon" 
        title="ריענון וניקוי פילטרים" 
        data-element-name="רכיב_GlobalSidebar_3"
        style={{ border: 'none', cursor: 'pointer' }}
      >
        <RotateCcw size={22} strokeWidth={2.5} />
      </button>

      <div style={{ position: 'relative' }} data-element-name="רכיב_GlobalSidebar_return_wrapper">
        <button 
          type="button"
          onClick={() => handleTogglePopover('return')} 
          className="global-sidebar-icon" 
          title="החזרה מהירה" 
          data-element-name="רכיב_GlobalSidebar_return_btn"
          style={{ border: 'none', cursor: 'pointer', background: activePopover === 'return' ? 'rgba(212, 175, 55, 0.12)' : 'transparent', color: activePopover === 'return' ? 'var(--primary-color)' : '' }}
        >
          <Barcode size={22} strokeWidth={2.5} />
        </button>

        {activePopover === 'return' && (
          <div className="sidebar-popover" data-element-name="רכיב_GlobalSidebar_return_popover">
            <div className="popover-header">
              <h4>החזרה מהירה</h4>
              <button type="button" onClick={() => setActivePopover(null)} className="close-btn"><X size={16} /></button>
            </div>
            <form onSubmit={handleReturnSubmit} className="popover-form">
              <input 
                type="text" 
                autoFocus 
                placeholder="הקלד ברקוד או מספר פריט..." 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="popover-input"
                disabled={isLoading}
              />
              <button type="submit" className="popover-submit" disabled={isLoading}>
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeft size={18} />}
              </button>
            </form>
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }} data-element-name="רכיב_GlobalSidebar_search_wrapper">
        <button 
          type="button"
          onClick={() => handleTogglePopover('search')} 
          className="global-sidebar-icon" 
          title="חיפוש מהיר" 
          data-element-name="רכיב_GlobalSidebar_search_btn"
          style={{ border: 'none', cursor: 'pointer', background: activePopover === 'search' ? 'rgba(212, 175, 55, 0.12)' : 'transparent', color: activePopover === 'search' ? 'var(--primary-color)' : '' }}
        >
          <Search size={22} strokeWidth={2.5} />
        </button>

        {activePopover === 'search' && (
          <div className="sidebar-popover" data-element-name="רכיב_GlobalSidebar_search_popover" style={{ width: '340px' }}>
            <div className="popover-header">
              <h4>חיפוש מהיר (לקוחות והזמנות)</h4>
              <button type="button" onClick={() => setActivePopover(null)} className="close-btn"><X size={16} /></button>
            </div>
            <div className="popover-form" style={{ marginBottom: searchResults.length > 0 ? '1rem' : '0' }}>
              <input 
                type="text" 
                autoFocus 
                placeholder="שם לקוח, מס' הזמנה, טלפון, תאריך..." 
                value={inputValue}
                onChange={handleSearchInput}
                className="popover-input"
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px' }}>
                {isLoading ? <Loader2 size={18} className="animate-spin" color="var(--primary-color)" /> : <Search size={18} color="var(--text-muted)" />}
              </div>
            </div>
            
            {searchResults.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '280px', overflowY: 'auto' }}>
                {searchResults.map((item, idx) => {
                  const isOrder = !!item.orderId;
                  
                  return (
                    <li key={idx} style={{ 
                        padding: '10px 12px', 
                        borderBottom: '1px solid var(--border-color)', 
                        cursor: 'pointer', 
                        transition: 'all 0.2s', 
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '4px'
                      }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--element-bg)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                        onClick={() => {
                          setActivePopover(null);
                          if (isOrder) router.push('/orders/' + item.id);
                          else router.push('/customers/' + item.id);
                        }}
                    >
                      <div style={{ 
                        width: '36px', height: '36px', borderRadius: '50%', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isOrder ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: isOrder ? '#2563eb' : '#10b981',
                        flexShrink: 0
                      }}>
                        {isOrder ? <FileText size={18} /> : <User size={18} />}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isOrder ? 'הזמנה #' + item.orderId : (item.firstName + ' ' + (item.lastName || ''))}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {isOrder ? (
                            <>
                              <span>{item.firstName + ' ' + (item.lastName || '')}</span>
                              {item.eventDate && <span>•</span>}
                              {item.eventDate && <span>{new Date(item.eventDate).toLocaleDateString('he-IL')}</span>}
                            </>
                          ) : (
                            <>
                              <span>{item.phone1 || ''}</span>
                              {item.city && <span>•</span>}
                              {item.city && <span>{item.city}</span>}
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            
            {inputValue.trim().length >= 2 && !isLoading && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                לא נמצאו תוצאות לחיפוש.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }} data-element-name="רכיב_GlobalSidebar_history_wrapper">
        <button 
          type="button"
          onClick={() => handleTogglePopover('history')} 
          className="global-sidebar-icon" 
          title="היסטוריית צפיות" 
          data-element-name="רכיב_GlobalSidebar_history_btn"
          style={{ border: 'none', cursor: 'pointer', background: activePopover === 'history' ? 'rgba(212, 175, 55, 0.12)' : 'transparent', color: activePopover === 'history' ? 'var(--primary-color)' : '' }}
        >
          <History size={22} strokeWidth={2.5} />
        </button>

        {activePopover === 'history' && (
          <div className="sidebar-popover" data-element-name="רכיב_GlobalSidebar_history_popover" style={{ width: '280px' }}>
            <div className="popover-header">
              <h4>נצפו לאחרונה</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {historyItems.length > 0 && (
                  <button onClick={clearHistory} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0' }}>נקה</button>
                )}
                <button type="button" onClick={() => setActivePopover(null)} className="close-btn"><X size={16} /></button>
              </div>
            </div>
            <div style={{ maxHeight: '350px', overflowY: 'auto', padding: '0.5rem' }}>
              {historyItems.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  אין היסטוריה זמינה
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {historyItems.map((item, index) => (
                    <li key={`${item.type}-${item.id}-${index}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <a href="#" onClick={(e) => handleHistoryItemClick(item, e)} style={{
                        display: 'flex', alignItems: 'center', gap: '12px', 
                        padding: '10px 8px', textDecoration: 'none',
                        color: 'var(--text-main)', transition: 'all 0.2s',
                        borderRadius: '6px'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--element-bg)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <div style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: item.type === 'order' ? 'rgba(59, 130, 246, 0.1)' : item.type === 'customer' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: item.type === 'order' ? '#3b82f6' : item.type === 'customer' ? '#10b981' : '#f59e0b',
                          flexShrink: 0
                        }}>
                          {item.type === 'order' ? <FileText size={16} /> : item.type === 'customer' ? <User size={16} /> : <Shirt size={16} />}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </span>
                          {item.subtext && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
    </div>
  );
}
