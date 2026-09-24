'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useDebounce from '@/hooks/useDebounce';
import { usePopup } from './PopupProvider';
import { Icon } from '@/app/v3/ui';
import { useTopbarPanel } from './topbarPanel';

// Ports GlobalSidebar's barcode-return / global-search / recently-viewed logic
// into the topbar quick-search box + dropdown panel (design-v2 topbar-search pattern).
export default function TopbarSearch() {
  const router = useRouter();
  const { openRentalModal } = usePopup();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);

  const debouncedQuery = useDebounce(query, 350);

  // v3: פתיחה/סגירה, Esc, לחיצה בחוץ וניווט מקלדת - מהתשתית המשותפת של הסרגל (topbarPanel.js).
  // ההתנהגות העסקית (חיפוש, החזרה בברקוד, היסטוריה) נשארת כפי שהייתה.
  const { open, close, itemProps, triggerProps } = useTopbarPanel({
    hover: false,
    onOpened: (panel) => setTimeout(() => panel.querySelector('#topbarSearchInput')?.focus(), 30),
  });

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
    close(false);
    router.push('/?q=' + encodeURIComponent(query.trim()));
  };

  const handleResultClick = (item) => {
    close(false);
    setQuery('');
    if (item.orderId) router.push('/orders/' + item.id);
    else router.push('/customers/' + item.id);
  };

  const handleHistoryItemClick = (item, e) => {
    e.preventDefault();
    close(false);
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
        close(false);
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
    <div {...itemProps} id="topbarSearch" data-tb-search>
      <button
        type="button"
        {...triggerProps}
        className="v3-topbar__ib"
        aria-label="חיפוש"
        title="חיפוש לקוח, הזמנה או ברקוד"
      >
        <Icon name="search" />
      </button>
      <div className="v3-topbar__panel v3-tb-panel v3-tb-search" role="dialog" aria-label="חיפוש">
        <div className="v3-sbox">
          <Icon name="search" size="sm" />
          <input
            type="search"
            id="topbarSearchInput"
            placeholder="חיפוש לקוח, הזמנה, ברקוד…"
            aria-label="חיפוש לקוח, הזמנה או ברקוד"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {query.trim().length >= 2 && (
          <div className="v3-tb-sec">
            <div className="v3-tb-st"><Icon name="search" size="xs" />תוצאות חיפוש</div>
            {isSearching ? (
              <div className="v3-tb-empty" role="status"><Icon name="loader" size="sm" loop /> מחפשים…</div>
            ) : searchResults.length === 0 ? (
              <div className="v3-tb-empty">לא נמצאו תוצאות</div>
            ) : (
              searchResults.map((item, idx) => {
                const isOrder = !!item.orderId;
                return (
                  <button
                    key={idx}
                    type="button"
                    className="v3-link"
                    data-tbl
                    onClick={() => handleResultClick(item)}
                  >
                    <span className="v3-link__ic"><Icon name={isOrder ? 'file' : 'user'} /></span>
                    <span className="v3-link__t">
                      <strong>{isOrder ? <>הזמנה <bdi>#{item.orderId}</bdi></> : `${item.firstName} ${item.lastName || ''}`}</strong>
                      <small>{isOrder ? (item.firstName + ' ' + (item.lastName || '')) : (item.phone1 ? <bdi>{item.phone1}</bdi> : (item.city || ''))}</small>
                    </span>
                  </button>
                );
              })
            )}
            {!isSearching && totalResultCount > 0 && (
              <button type="button" className="v3-tb-all" data-tbl onClick={handleViewAllResults}>
                הצג את כל התוצאות (<bdi>{totalResultCount}</bdi>) במסך מלא
              </button>
            )}
          </div>
        )}

        <div className="v3-tb-sec">
          <div className="v3-tb-st"><Icon name="tag" size="xs" />החזרה מהירה בברקוד</div>
          <form onSubmit={handleReturnSubmit} className="v3-tb-scan">
            <div className="v3-sbox">
              <Icon name="tag" size="sm" />
              <input
                type="text"
                placeholder="סרוק או הקלד ברקוד פריט…"
                aria-label="ברקוד פריט להחזרה"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                disabled={isReturning}
              />
            </div>
            <button type="submit" className="v3-tb-go" title="בצע החזרה" aria-label="בצע החזרה" disabled={isReturning}>
              <Icon name="arrow-end" />
            </button>
          </form>
        </div>

        <div className="v3-tb-sec">
          <div className="v3-tb-st v3-tb-st--row">
            <span><Icon name="history" size="xs" />נצפו לאחרונה</span>
            {historyItems.length > 0 && (
              <button type="button" className="v3-tb-clear" data-tbl onClick={clearHistory}>נקה</button>
            )}
          </div>
          {historyItems.length === 0 ? (
            <div className="v3-tb-empty">אין היסטוריה זמינה</div>
          ) : (
            historyItems.map((item, index) => (
              <button
                key={`${item.type}-${item.id}-${index}`}
                type="button"
                className="v3-link"
                data-tbl
                onClick={(e) => handleHistoryItemClick(item, e)}
              >
                <span className="v3-link__ic"><Icon name={item.type === 'order' ? 'file' : item.type === 'customer' ? 'user' : 'tag'} /></span>
                <span className="v3-link__t">
                  <strong>{item.name}</strong>
                  {item.subtext && <small>{item.subtext}</small>}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
