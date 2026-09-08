'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useDebounce from '@/hooks/useDebounce';
import { usePopup } from './PopupProvider';

// Ports GlobalSidebar's barcode-return / global-search / recently-viewed logic
// into the topbar quick-search box + dropdown panel (design-v2 topbar-search pattern).
export default function TopbarSearch() {
  const router = useRouter();
  const { openRentalModal } = usePopup();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);

  const wrapRef = useRef(null);
  const debouncedQuery = useDebounce(query, 350);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
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

  // מקסימום תוצאות בחלונית הנפתחת עצמה (עדיין תלוי-גובה, לא מסך מלא) - הועלה
  // מ-7 קבוע ל-15, וכשיש יותר מכך (או תמיד, כדי לתת גישה לתצוגה המלאה) מוצג
  // קישור "הצג את כל התוצאות" שמוביל למסך הבית עם כל התוצאות בעמוד מלא (ר' item 7
  // בדיווח: "פותח חלונית ולא מציג את התוצאות על כל המסך, וגם מציג מקסימום 7 תוצאות").
  const TOPBAR_PANEL_RESULT_CAP = 15;
  const [totalResultCount, setTotalResultCount] = useState(0);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setSearchResults([]);
      setTotalResultCount(0);
      return;
    }
    setIsSearching(true);
    fetch('/api/global-search?q=' + encodeURIComponent(debouncedQuery.trim()))
      .then((res) => res.json())
      .then((data) => {
        if (data && (data.customers || data.orders)) {
          const combined = [...(data.orders || []), ...(data.customers || [])];
          setTotalResultCount(combined.length);
          setSearchResults(combined.slice(0, TOPBAR_PANEL_RESULT_CAP));
        }
      })
      .catch(() => {})
      .finally(() => setIsSearching(false));
  }, [debouncedQuery]);

  const handleViewAllResults = () => {
    setOpen(false);
    router.push('/?q=' + encodeURIComponent(query.trim()));
  };

  const handleResultClick = (item) => {
    setOpen(false);
    setQuery('');
    if (item.orderId) router.push('/orders/' + item.id);
    else router.push('/customers/' + item.id);
  };

  const handleHistoryItemClick = (item, e) => {
    e.preventDefault();
    setOpen(false);
    if (item.type === 'rental') {
      if (openRentalModal) openRentalModal(item.id);
      else router.push(`/rentals?orderId=${item.id}`);
    } else if (item.type === 'customer') {
      router.push(`/customers/${item.id}`);
    } else if (item.type === 'dress') {
      router.push(`/dashboard/dresses/${item.id}`);
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
    if (!barcode.trim() || isReturning) return;
    setIsReturning(true);
    try {
      const cleanBarcode = barcode.replace(/\s+/g, '');
      const res = await fetch('/api/returns/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: cleanBarcode }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('ההחזרה נקלטה בהצלחה!');
        setOpen(false);
        setBarcode('');
        if (openRentalModal) openRentalModal(data.orderId);
        else router.push('/rentals?orderId=' + data.orderId);
      } else {
        alert(data.error || 'שגיאה בהחזרה');
      }
    } catch (err) {
      alert('שגיאת תקשורת');
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <div className={`topbar-search${open ? ' open' : ''}`} id="topbarSearch" ref={wrapRef}>
      <div className="search-box" onClick={() => setOpen(true)}>
        <svg className="icon"><use href="#i-search" /></svg>
        <input
          type="text"
          id="topbarSearchInput"
          placeholder="חיפוש לקוח, הזמנה, ברקוד…"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
        />
      </div>
      <div className="topbar-search-panel">
        {query.trim().length >= 2 && (
          <div className="topbar-search-panel-section">
            <div className="topbar-search-panel-title">
              <svg className="icon"><use href="#i-search" /></svg>
              תוצאות חיפוש
            </div>
            {isSearching ? (
              <div className="loading-inline"><span className="spinner" /></div>
            ) : searchResults.length === 0 ? (
              <div className="empty-state" style={{ padding: '16px 0' }}>
                <p>לא נמצאו תוצאות</p>
              </div>
            ) : (
              searchResults.map((item, idx) => {
                const isOrder = !!item.orderId;
                return (
                  <div
                    key={idx}
                    className="topbar-recent-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleResultClick(item)}
                  >
                    <div className="kpi-icon" style={{ background: isOrder ? 'var(--info-tint)' : 'var(--success-tint)', color: isOrder ? 'var(--info)' : 'var(--success)' }}>
                      <svg className="icon"><use href={isOrder ? '#i-file' : '#i-user'} /></svg>
                    </div>
                    <div>
                      <strong>{isOrder ? 'הזמנה #' + item.orderId : `${item.firstName} ${item.lastName || ''}`}</strong>
                      <span>{isOrder ? (item.firstName + ' ' + (item.lastName || '')) : (item.phone1 || item.city || '')}</span>
                    </div>
                  </div>
                );
              })
            )}
            {!isSearching && totalResultCount > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', marginTop: '10px' }}
                onClick={handleViewAllResults}
              >
                הצג את כל התוצאות ({totalResultCount}) במסך מלא
              </button>
            )}
          </div>
        )}
        <div className="topbar-search-panel-section">
          <div className="topbar-search-panel-title">
            <svg className="icon"><use href="#i-tag" /></svg>
            החזרה מהירה בברקוד
          </div>
          <form onSubmit={handleReturnSubmit} className="search-toolbar" style={{ maxWidth: 'none' }}>
            <svg className="icon"><use href="#i-tag" /></svg>
            <input
              type="text"
              placeholder="סרוק או הקלד ברקוד פריט…"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              disabled={isReturning}
            />
            <div className="search-toolbar-actions">
              <button type="submit" className="btn btn-primary btn-icon-only btn-sm" title="בצע החזרה" disabled={isReturning}>
                <svg className="icon"><use href="#i-arrow-end" /></svg>
              </button>
            </div>
          </form>
        </div>
        <div className="topbar-search-panel-section">
          <div className="topbar-search-panel-title" style={{ justifyContent: 'space-between', display: 'flex' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg className="icon"><use href="#i-history" /></svg>
              נצפו לאחרונה
            </span>
            {historyItems.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearHistory} style={{ padding: '2px 8px' }}>נקה</button>
            )}
          </div>
          {historyItems.length === 0 ? (
            <div className="empty-state" style={{ padding: '16px 0' }}>
              <p>אין היסטוריה זמינה</p>
            </div>
          ) : (
            historyItems.map((item, index) => (
              <a
                key={`${item.type}-${item.id}-${index}`}
                href="#"
                className="topbar-recent-item"
                onClick={(e) => handleHistoryItemClick(item, e)}
              >
                <div className="kpi-icon" style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}>
                  <svg className="icon"><use href={item.type === 'order' ? '#i-file' : item.type === 'customer' ? '#i-user' : '#i-tag'} /></svg>
                </div>
                <div>
                  <strong>{item.name}</strong>
                  {item.subtext && <span>{item.subtext}</span>}
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
