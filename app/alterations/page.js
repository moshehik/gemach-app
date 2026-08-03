'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Calendar, CalendarPlus, Scissors, Printer, Info, CheckCircle, Search, X, Check, Clock, FileText } from 'lucide-react';
import PrintWizardModal from '../components/PrintWizardModal';
import HebrewDatePicker from '../../components/HebrewDatePicker';
import { getHebrewDateString } from '../../lib/hebrewDate';
import ExportButtons from '../../components/ExportButtons';
import AISearchBar from '../components/AISearchBar';
import StatisticsModal from '../components/StatisticsModal';

const alterationsCache = new Map();

export default function AlterationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination & Search
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 60;
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(true);

  // Print Wizard state
  const [isPrintWizardOpen, setIsPrintWizardOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQueryUsed, setAiQueryUsed] = useState('');
  const [isAiModeActive, setIsAiModeActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchAlterations = async (isPrefetch = false, targetPage = page) => {
    try {
      if (!isPrefetch) {
        setLoading(true);
        setError('');
      }
      
      let url = `/api/alterations?showOnlyPending=${showOnlyPending}&page=${targetPage}&limit=${limit}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (search) url += `&search=${search}`;

      const cacheKey = url;
      
      // SWR: Instant Cache Hit
      if (!isPrefetch && alterationsCache.has(cacheKey)) {
        const cachedData = alterationsCache.get(cacheKey);
        setItems(cachedData.data || []);
        setTotalPages(cachedData.totalPages || 1);
        setTotalCount(cachedData.total || 0);
        setLoading(false); // UI becomes interactive instantly
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch alterations');
      const data = await res.json();
      
      // Update Cache silently
      alterationsCache.set(cacheKey, data);

      if (!isPrefetch && targetPage === page) {
        setItems(data.data || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      if (!isPrefetch) setError(err.message);
    } finally {
      if (!isPrefetch) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlterations(false, page);
    
    // Background Prefetching for the next page
    const timer = setTimeout(() => {
      if (page < totalPages) {
        fetchAlterations(true, page + 1);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [startDate, endDate, showOnlyPending, page, search, totalPages]);

  const markDone = async (orderItemId) => {
    if (!(await window.customConfirm('האם לאשר ביצוע תיקון?'))) return;
    try {
      const res = await fetch('/api/alterations/mark-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId })
      });
      if (!res.ok) throw new Error('Failed to mark as done');
      
      // Remove from list if showOnlyPending is true, else update state
      if (showOnlyPending) {
        setItems(items.filter(item => item.id !== orderItemId));
      } else {
        setItems(items.map(item => item.id === orderItemId ? { ...item, alterationDone: true } : item));
      }
    } catch (err) {
      alert('שגיאה בעדכון התיקון: ' + err.message);
    }
  };

  const markAllDone = async () => {
    if (!startDate) {
      alert('יש לבחור תאריך כדי לסמן את כל התיקונים כבוצעו לאותו יום.');
      return;
    }
    const hebrewDateStr = startDate ? getHebrewDateString(startDate) : '';
    const displayDate = hebrewDateStr ? hebrewDateStr : startDate;
    if (!(await window.customConfirm(`בטוח שבוצעו כל התיקונים לתאריך ${displayDate}?`))) return;
    
    try {
      const res = await fetch('/api/alterations/mark-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: startDate })
      });
      if (!res.ok) throw new Error('Failed to mark all as done');
      fetchAlterations();
    } catch (err) {
      alert('שגיאה בעדכון: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('he-IL');
  };

  const setQuickDate = (daysOffset) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const dateStr = d.toISOString().split('T')[0];
    setStartDate(dateStr);
    setEndDate(dateStr);
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setSearch(searchInput);
    setPage(1);
    setIsAiModeActive(false);
  };

  const handleAiSearch = async (query) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, pageContext: 'alterations' })
      });
      const result = await res.json();
      if (res.ok) {
        setItems(result.data || []);
        setTotalCount(result.data?.length || 0);
        setTotalPages(1);
        setIsAiModeActive(true);
        setAiQueryUsed(result.query || '');
      } else {
        alert(result.error || 'שגיאה בחיפוש החכם');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאת תקשורת');
    } finally {
      setAiLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
    if (isAiModeActive) {
      setIsAiModeActive(false);
      fetchAlterations();
    }
  };

  const fetchForExport = async (exportLimit) => {
    try {
      let url = `/api/alterations?showOnlyPending=${showOnlyPending}&page=1&limit=${exportLimit}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (search) url += `&search=${search}`;
      const res = await fetch(url);
      const data = await res.json();
      return (data.data || []).map(item => ({
        ...item,
        orderId: item.order?.orderId,
        customerName: `${item.order?.customer?.firstName || ''} ${item.order?.customer?.lastName || ''}`,
        dressName: item.dressItem?.dress?.name 
          ? `${item.dressItem.dress.name} ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix ? `(קוד: ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix})` : ''}`
          : (item.description || item.dressItem?.dressName),
        eventDate: item.order?.eventDateHebrew || (item.order?.eventDate ? getHebrewDateString(item.order.eventDate) : '-'),
        alterationStatus: item.alterationDone ? 'בוצע' : 'ממתין'
      }));
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  return (
    <main data-agy-id="alterations-page-main" className="container animate-fade-in" style={{ padding: '2rem 1rem', minHeight: '80vh' }}>
      <div style={{ 
        position: 'relative',
        marginBottom: '1rem', padding: '1.5rem', 
        background: 'var(--card-bg)', 
        borderRadius: '16px', 
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--element-border)',
        color: 'var(--text-main)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2rem'
      }}>
        {/* Decorative ambient blobs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: '16px', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'linear-gradient(135deg, #a855f7, #ec4899)', borderRadius: '50%', filter: 'blur(60px)', opacity: 0.1 }}></div>
          <div style={{ position: 'absolute', bottom: '-50px', left: '-50px', width: '250px', height: '250px', background: 'linear-gradient(135deg, #3b82f6, #2dd4bf)', borderRadius: '50%', filter: 'blur(70px)', opacity: 0.08 }}></div>
        </div>

        {/* Top Header Row */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '800' }}>
              <Scissors data-element-name="רכיב_page_1" size={26} color="var(--primary-color)" />
              ניהול תפירות ותיקונים
            </h1>
          </div>
        </div>

        {/* Filter Toolbar (Glassmorphism) */}
        <div style={{ 
          position: 'relative', zIndex: 1, 
          display: 'flex', gap: '1.2rem', alignItems: 'center', flexWrap: 'wrap', 
          background: 'var(--element-bg)', padding: '0.75rem 1rem', 
          borderRadius: '12px', border: '1px solid var(--element-border)',
          backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar data-element-name="רכיב_page_7" size={18} color="var(--text-muted)" />
            <label style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>מתאריך:</label>
            <div style={{ width: '200px' }}>
              <HebrewDatePicker data-element-name="רכיב_page_8" value={startDate} onChange={setStartDate} />
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar data-element-name="רכיב_page_9" size={18} color="var(--text-muted)" />
            <label style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>עד תאריך:</label>
            <div style={{ width: '200px' }}>
              <HebrewDatePicker data-element-name="רכיב_page_10" value={endDate} onChange={setEndDate} />
            </div>
          </div>
          
          <div style={{ width: '1px', height: '30px', background: 'var(--element-border)', margin: '0 0.5rem' }}></div>
          
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500', color: 'var(--text-main)' }}>
            <div style={{ 
              width: '20px', height: '20px', borderRadius: '6px', 
              border: '2px solid var(--element-border)', 
              background: showOnlyPending ? '#ec4899' : 'var(--input-bg)',
              marginLeft: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}>
              {showOnlyPending && <Check data-element-name="רכיב_page_11" size={14} color="white" strokeWidth={3} />}
            </div>
            <input data-element-name="שדה_page_12" 
              data-agy-id="checkbox-show-only-pending"
              type="checkbox" 
              checked={showOnlyPending} 
              onChange={e => setShowOnlyPending(e.target.checked)} 
              style={{ display: 'none' }}
            />
            רק ממתינים לביצוע
          </label>

          <div style={{ flex: 1 }}></div>

          <button data-element-name="כפתור_page_13" 
            data-agy-id="mark-all-done-button"
            onClick={markAllDone} 
            disabled={!startDate}
            style={{ 
              padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '10px', 
              display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold',
              background: !startDate ? 'var(--element-bg)' : 'linear-gradient(135deg, #10b981, #059669)',
              color: !startDate ? 'var(--text-muted)' : 'white',
              border: !startDate ? '1px solid var(--element-border)' : 'none',
              boxShadow: !startDate ? 'none' : '0 4px 10px rgba(16, 185, 129, 0.3)',
              cursor: !startDate ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', height: '40px'
            }}
          >
            <CheckCircle data-element-name="רכיב_page_14" size={16} /> סמן יום כבוצע
          </button>
        </div>

      {/* Search and Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '600px' }}>
          <AISearchBar data-element-name="רכיב_page_15" 
            placeholder="חיפוש (מספר הזמנה, שם לקוח, דגם שמלה)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleSearch}
            onClear={handleClearSearch}
            onAiSearch={handleAiSearch}
            onStatistics={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}
            loading={aiLoading}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <ExportButtons data-element-name="רכיב_page_2" 
              data={items.map(item => ({
                ...item,
                orderId: item.order?.orderId,
                customerName: `${item.order?.customer?.firstName || ''} ${item.order?.customer?.lastName || ''}`,
                dressName: item.dressItem?.dress?.name 
                  ? `${item.dressItem.dress.name} ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix ? `(קוד: ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix})` : ''}`
                  : (item.description || item.dressItem?.dressName),
                eventDate: item.order?.eventDateHebrew || (item.order?.eventDate ? getHebrewDateString(item.order.eventDate) : '-'),
                alterationStatus: item.alterationDone ? 'בוצע' : 'ממתין'
              }))}
              filename="תפירות"
              columns={[
                { key: 'orderId', label: 'קוד הזמנה' },
                { key: 'customerName', label: 'לקוח' },
                { key: 'dressName', label: 'שמלה' },
                { key: 'sizeText', label: 'מידה' },
                { key: 'eventDate', label: 'תאריך אירוע' },
                { key: 'alterationStatus', label: 'סטטוס' }
              ]}
              iconOnly={true}
              onFetchData={fetchForExport}
            />
            <button data-element-name="כפתור_page_3" 
              data-agy-id="print-wizard-button"
              onClick={() => setIsPrintWizardOpen(true)}
              className="btn-header-icon"
              title="אשף הדפסה"
            >
              <Printer data-element-name="רכיב_page_4" size={20} />
            </button>
            <button data-element-name="כפתור_page_5" 
              data-agy-id="legend-button"
              onClick={() => setIsLegendOpen(true)}
              className="btn-header-icon"
              title="מקרא"
            >
              <Info data-element-name="רכיב_page_6" size={20} />
            </button>
        </div>
      </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'fadeIn 1.5s infinite alternate' }}>⏳</div>
          <h2>טוען נתונים...</h2>
        </div>
      ) : error ? (
        <div className="dress-card" style={{ padding: '2rem', textAlign: 'center', color: '#e53935', borderRight: '5px solid #e53935' }}>
          <h3>שגיאה בטעינת נתונים</h3>
          <p>{error}</p>
        </div>
      ) : (
        <div className="dress-card" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto', minHeight: '50vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'rgba(212, 175, 55, 0.1)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>תאריך אירוע</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>לקוח</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>דגם שמלה</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>מידה</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>פירוט תיקונים</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>סטטוס</th>
                  <th style={{ padding: '1.2rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>👗</div>
                      <p style={{ fontSize: '1.2rem' }}>לא נמצאו תיקונים העונים לחתך החיפוש</p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr 
                      key={item.id} 
                      style={{ 
                        borderBottom: '1px solid #eee',
                        background: item.alterationDone ? 'rgba(67, 160, 71, 0.05)' : (index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'),
                        transition: 'background 0.3s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = item.alterationDone ? 'rgba(67, 160, 71, 0.05)' : (index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)')}
                    >
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <div style={{ fontWeight: 'bold' }}>{item.order?.eventDateHebrew || (item.order?.eventDate ? getHebrewDateString(item.order.eventDate) : '-')}</div>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', fontWeight: '600' }}>{item.order?.customer?.firstName} {item.order?.customer?.lastName}</td>
                      <td style={{ padding: '0.4rem 0.5rem', color: 'var(--primary-color)' }}>
                        {item.dressItem?.dress?.name 
                          ? `${item.dressItem.dress.name} ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix ? `(קוד: ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix})` : ''}`
                          : (item.description || item.dressItem?.dressName)}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <span style={{ background: 'var(--bg-color)', border: '1px solid #ddd', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '500' }}>
                          {item.sizeText || item.size}
                        </span>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', maxWidth: '350px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {item.neckAlteration > 0 && <span style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--primary-color)', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>צוואר: הצרה {item.neckAlteration}</span>}
                          {item.sleeveAlteration > 0 && <span style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--primary-color)', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>שרוול: הארכה {item.sleeveAlteration}</span>}
                          {item.lengthAlteration && <span style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--primary-color)', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>אורך: {item.lengthAlteration}</span>}
                          {item.alterationDetails && <span style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-main)', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>{item.alterationDetails}</span>}
                          {!item.neckAlteration && !item.sleeveAlteration && !item.lengthAlteration && !item.alterationDetails && <span style={{ color: 'var(--text-muted)' }}>-</span>}
                        </div>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '0.4rem 1rem',
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          background: item.alterationDone ? 'rgba(67, 160, 71, 0.1)' : 'rgba(229, 57, 53, 0.1)',
                          color: item.alterationDone ? '#2e7d32' : '#c62828',
                          border: `1px solid ${item.alterationDone ? 'rgba(67, 160, 71, 0.2)' : 'rgba(229, 57, 53, 0.2)'}`
                        }}>
                          {item.alterationDone ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle data-element-name="רכיב_page_16" size={14} /> בוצע</span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock data-element-name="רכיב_page_17" size={14} /> ממתין</span>
                          )}
                        </span>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                          <Link data-element-name="רכיב_page_18" 
                            href={`/orders/${item.order?.orderId}`} 
                            className="btn btn-outline" 
                            style={{ padding: '0.5rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: '38px', height: '38px' }}
                            title="כרטיס הזמנה"
                          >
                            <FileText data-element-name="רכיב_page_19" size={18} />
                          </Link>
                        {!item.alterationDone && (
                          <button data-element-name="כפתור_page_20" 
                            className="btn btn-primary" 
                            style={{ padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', width: '38px', height: '38px', border: 'none', cursor: 'pointer', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}
                            onClick={() => markDone(item.id)}
                            title="סמן שבוצע"
                          >
                            <CheckCircle data-element-name="רכיב_page_21" size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Bottom Bar - Floating/Sticky */}
          <div style={{ position: 'sticky', bottom: '0', background: 'var(--card-bg)', padding: '0.75rem 1.5rem', borderTop: '1px solid var(--element-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 12px 12px', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 -4px 12px rgba(0,0,0,0.06)', zIndex: 10, margin: '0' }}>
            <div style={{ fontWeight: 'bold' }}>סה"כ מוצג בעמוד: {items.length} | סה"כ תיקונים תואמים: {totalCount}</div>
            
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                <button data-element-name="כפתור_page_22" className="btn btn-outline" disabled={page <= 1 } onClick={() => setPage(p => p - 1)} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px' }}>&lt; הקודם</button>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>עמוד <input data-element-name="שדה_page_23" type="number" min={1} max={totalPages || 1} value={page} onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }} style={{ width: '50px', padding: '0.2rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)' }} /> מתוך {totalPages}</span>
                <button data-element-name="כפתור_page_24" className="btn btn-outline" disabled={page >= totalPages } onClick={() => setPage(p => p + 1)} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px' }}>הבא &gt;</button>
              </div>
            )}
          </div>
        </div>
      )}

      {isPrintWizardOpen && (
        <PrintWizardModal data-element-name="רכיב_page_25" 
          onClose={() => setIsPrintWizardOpen(false)} 
          defaultStartDate={startDate}
          defaultEndDate={endDate}
        />
      )}

      {isLegendOpen && mounted && createPortal(
        <div data-element-name="לחיץ_page_26" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }} onClick={() => setIsLegendOpen(false)}>
          <div data-element-name="לחיץ_page_27" style={{
            background: 'var(--card-bg)',
            padding: '2rem',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            maxWidth: '400px',
            width: '100%',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <button data-element-name="כפתור_page_28" 
              onClick={() => setIsLegendOpen(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X data-element-name="רכיב_page_29" size={20} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info data-element-name="רכיב_page_30" size={24} /> מקרא צבעים
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(229, 57, 53, 0.1)', border: '1px solid rgba(229, 57, 53, 0.2)' }}></div>
                <span><strong>אדום / ממתין:</strong> התיקון טרם בוצע.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(67, 160, 71, 0.1)', border: '1px solid rgba(67, 160, 71, 0.2)' }}></div>
                <span><strong>ירוק / בוצע:</strong> התיקון בוצע בהצלחה.</span>
              </div>
            </div>
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button data-element-name="כפתור_page_31" className="btn btn-primary" onClick={() => setIsLegendOpen(false)}>הבנתי</button>
            </div>
          </div>
        </div>, document.body
      )}

      <StatisticsModal data-element-name="רכיב_page_32" 
        isOpen={!!showStatistics} 
        onClose={() => setShowStatistics(false)} 
        pageContext="alterations"
        contextQuery={aiQueryUsed}
        position={typeof showStatistics === 'object' ? showStatistics : null}
      />
    </main>
  );
}
