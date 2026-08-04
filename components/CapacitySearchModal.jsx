'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, List, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import HebrewDatePicker from './HebrewDatePicker';
import HebrewDateRangePicker from './HebrewDateRangePicker';
import { HDate, HebrewCalendar } from '@hebcal/core';
import { getHebrewDateString, HEBREW_DAYS, getHebrewYearString, getHebrewMonthName } from '@/lib/hebrewDate';

export default function CapacitySearchModal({ isOpen, onClose }) {
  const [barcodePrefix, setBarcodePrefix] = useState('');
  const [size, setSize] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  
  const [sizes, setSizes] = useState([]);
  const [models, setModels] = useState([]);

  useEffect(() => {
    const prev = JSON.parse(localStorage.getItem('capacity_search_history') || '[]');
    setSearchHistory(prev);
  }, []);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch('/api/inventory/models?hasActiveItems=true');
        if (res.ok) {
          const data = await res.json();
          setModels(data.models || []);
        }
      } catch (err) {
        console.error('Error fetching models', err);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    if (!barcodePrefix) {
      setSizes([]);
      setSize('');
      return;
    }
    
    const fetchSizes = async () => {
      try {
        const res = await fetch(`/api/inventory/sizes?barcodePrefix=${barcodePrefix}`);
        if (res.ok) {
          const data = await res.json();
          setSizes(data.sizes || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSizes();
  }, [barcodePrefix]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  const performSearch = async (searchParams = null) => {
    const pPrefix = searchParams ? searchParams.barcodePrefix : barcodePrefix;
    const pSize = searchParams ? searchParams.size : size;
    let pFromDate = searchParams ? searchParams.fromDate : fromDate;
    let pToDate = searchParams ? searchParams.toDate : toDate;
    const pEmployeeCode = searchParams ? searchParams.employeeCode : employeeCode;
    const pCustomerName = searchParams ? searchParams.customerName : customerName;

    if (!pPrefix || !pSize) {
      setError('יש להזין דגם ומידה');
      return;
    }

    if (!pFromDate) {
      pFromDate = new Date().toISOString().split('T')[0];
      if (!searchParams) setFromDate(pFromDate);
    }
    if (!pToDate) {
      const d = new Date();
      d.setMonth(d.getMonth() + 6);
      pToDate = d.toISOString().split('T')[0];
      if (!searchParams) setToDate(pToDate);
    }

    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({
        barcodePrefix: pPrefix,
        size: pSize,
        fromDate: pFromDate,
        toDate: pToDate
      });
      const res = await fetch(`/api/inventory/capacity?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בחיפוש');
      setResults(data);

      const newSearch = {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        id: Date.now(),
        timestamp: new Date().toISOString(),
        employeeCode: pEmployeeCode,
        customerName: pCustomerName,
        barcodePrefix: pPrefix,
        size: pSize,
        fromDate: pFromDate,
        toDate: pToDate
      };
      const prev = JSON.parse(localStorage.getItem('capacity_search_history') || '[]');
      const updated = [newSearch, ...prev].slice(0, 50); // Keep last 50
      localStorage.setItem('capacity_search_history', JSON.stringify(updated));
      setSearchHistory(updated);

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    await performSearch();
  };

  if (!isOpen) return null;

  const content = (
    <div data-agy-id="capacity_search_modal_backdrop" className="modal-overlay" onClick={onClose} style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'fixed', inset: 0, overflowY: 'auto' }}>
      <div data-agy-id="capacity_search_modal_container" className="modal-content animate-slide-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%', background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--divider)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>חיפוש תפוסה</h2>
            <button data-agy-id="capacity_search_history_toggle_btn" type="button" onClick={() => setShowHistory(!showHistory)} className="btn btn-outline" style={{ padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
              {showHistory ? 'הסתר חיפושים קודמים' : 'חיפושים קודמים'}
            </button>
          </div>
          <button data-agy-id="capacity_search_close_btn" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} color="#666" />
          </button>
        </div>

        {/* History */}
        {showHistory && (
          <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f1f5f9', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#334155' }}>היסטוריית חיפושים</h3>
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {searchHistory
                .map(h => {
                  const modelName = models.find(m => m.barcodePrefix?.toString() === h.barcodePrefix?.toString())?.name || h.barcodePrefix;
                  const fromHebrew = h.fromDate ? getHebrewDateString(new Date(h.fromDate)) : '';
                  const toHebrew = h.toDate ? getHebrewDateString(new Date(h.toDate)) : '';
                  const searchTime = new Date(h.timestamp);
                  const searchHebrewDate = getHebrewDateString(searchTime);
                  const searchTimeStr = searchTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid #e2e8f0', background: 'var(--card-bg)', marginBottom: '0.5rem', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.9rem', flex: 1 }}>
                        <span style={{ minWidth: '120px' }}><strong>דגם:</strong> {modelName}</span>
                        <span style={{ minWidth: '80px' }}><strong>מידה:</strong> {h.size}</span>
                        {(fromHebrew || toHebrew) && (
                          <span style={{ minWidth: '180px' }}><strong>תאריכים:</strong> {fromHebrew} - {toHebrew}</span>
                        )}
                        {h.employeeCode && (
                          <span style={{ minWidth: '100px' }}><strong>עובד:</strong> {h.employeeCode}</span>
                        )}
                        <span style={{ color: '#64748b' }}>{searchHebrewDate}, {searchTimeStr}</span>
                      </div>
                      <button 
                        data-agy-id="capacity_search_history_select_btn"                        onClick={() => {
                          setEmployeeCode(h.employeeCode || '');
                          setCustomerName(h.customerName || '');
                          setBarcodePrefix(h.barcodePrefix || '');
                          setSize(h.size || '');
                          setFromDate(h.fromDate || '');
                          setToDate(h.toDate || '');
                          setShowHistory(false);
                          
                          performSearch({
                            employeeCode: h.employeeCode || '',
                            customerName: h.customerName || '',
                            barcodePrefix: h.barcodePrefix || '',
                            size: h.size || '',
                            fromDate: h.fromDate || '',
                            toDate: h.toDate || ''
                          });
                        }}
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 1rem', fontSize: '0.85rem', borderRadius: '6px' }}
                      >
                        בחר
                      </button>
                    </div>
                  );
                })}
              {searchHistory.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>לא נמצאו חיפושים</div>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSearch} style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '1.5rem', 
          marginBottom: '2rem', 
          alignItems: 'end'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#334155' }}>דגם</label>
            <select 
              data-agy-id="capacity_search_model_select"              className="form-select" 
              value={barcodePrefix} 
              onChange={e => {
                setBarcodePrefix(e.target.value);
                setSize('');
              }} 
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            >
              <option value="">בחר דגם...</option>
              {models.map(m => (
                <option key={m.id || m.barcodePrefix} value={m.barcodePrefix}>
                  {m.name} ({m.barcodePrefix})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#334155' }}>מידה</label>
            <select 
              data-agy-id="capacity_search_size_select"              className="form-select" 
              value={size} 
              onChange={e => setSize(e.target.value)} 
              required
              disabled={!barcodePrefix || sizes.length === 0}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '8px', 
                border: '1px solid #cbd5e1', 
                backgroundColor: (!barcodePrefix || sizes.length === 0) ? '#e2e8f0' : 'var(--card-bg)' 
              }}
            >
              <option value="">{(!barcodePrefix) ? 'בחר דגם תחילה' : (sizes.length === 0 ? 'אין מידות לדגם' : 'בחר מידה...')}</option>
              {sizes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#334155' }}>טווח תאריכים</label>
            <HebrewDateRangePicker 
              startDate={fromDate} 
              endDate={toDate} 
              onChange={(start, end) => {
                setFromDate(start);
                setToDate(end);
              }} 
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', gridColumn: '1 / -1', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button data-agy-id="capacity_search_clear_btn" type="button" onClick={() => {
              setBarcodePrefix('');
              setSize('');
              setFromDate('');
              setToDate('');
              setEmployeeCode('');
              setCustomerName('');
              setResults(null);
              setError('');
            }} className="btn btn-outline" style={{ padding: '0.6rem 1.5rem', borderRadius: '8px' }}>
              נקה הכל
            </button>
            <button data-agy-id="capacity_search_submit_btn" type="submit" className="btn btn-primary" style={{ padding: '0.6rem 2.5rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} disabled={loading}>
              {loading ? 'מחפש...' : <>חפש</>}
            </button>
          </div>
        </form>

        {error && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

        {/* Results */}
        {results && (
          <div className="animate-fade-in">
            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ flex: 1, backgroundColor: '#f0f9ff', padding: '1.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#0284c7' }}>במלאי</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0369a1' }}>{results.inStock}</div>
              </div>
              <div style={{ flex: 1, backgroundColor: '#fef2f2', padding: '1.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #fecaca' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#dc2626' }}>בתפוסה</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#b91c1c' }}>{results.occupiedCount}</div>
              </div>
              <div style={{ flex: 1, backgroundColor: '#fdf4ff', padding: '1.5rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #fbcfe8' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#c026d3' }}>רזרבה</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#a21caf' }}>{results.reserve}</div>
              </div>
            </div>

            {/* View Toggle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                <button 
                  data-agy-id="capacity_search_view_list_btn"                  type="button"
                  onClick={() => setViewMode('list')}
                  style={{ 
                    padding: '0.5rem 1.5rem', 
                    border: 'none', 
                    borderRadius: '6px', 
                    background: viewMode === 'list' ? 'var(--card-bg)' : 'transparent',
                    boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    cursor: 'pointer', fontWeight: viewMode === 'list' ? 'bold' : 'normal'
                  }}
                >
                  <List size={18} /> תצוגת רשימה
                </button>
                <button 
                  data-agy-id="capacity_search_view_calendar_btn"                  type="button"
                  onClick={() => setViewMode('calendar')}
                  style={{ 
                    padding: '0.5rem 1.5rem', 
                    border: 'none', 
                    borderRadius: '6px', 
                    background: viewMode === 'calendar' ? 'var(--card-bg)' : 'transparent',
                    boxShadow: viewMode === 'calendar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    cursor: 'pointer', fontWeight: viewMode === 'calendar' ? 'bold' : 'normal'
                  }}
                >
                  <CalendarIcon size={18} /> תצוגת לוח
                </button>
              </div>
            </div>

            {/* List View */}
            {viewMode === 'list' && (
              results.occupiedCount > 0 ? (
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', textAlign: 'right' }}>
                    <thead>
                      <tr>
                        <th>תאריך אירוע (לועזי)</th>
                        <th>תאריך אירוע (עברי)</th>
                        <th>שם לקוח</th>
                        <th>כמות בתפוסה</th>
                        <th>פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...results.occupiedOrders].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate)).map(order => (
                        <tr key={order.id}>
                          <td>{new Date(order.eventDate).toLocaleDateString('he-IL')}</td>
                          <td>{order.eventDateHebrew || 'לא צוין'}</td>
                          <td>{order.customerName}</td>
                          <td>{order.quantity}</td>
                          <td>
                            <a 
                              href={`/orders/${order.orderId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline"
                              style={{ padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={14} /> פתח
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <CalendarIcon size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <h3>אין הזמנות תפוסות בטווח התאריכים הנבחר</h3>
                  <p>הפריט פנוי לחלוטין בתאריכים אלו.</p>
                </div>
              )
            )}

            {/* Calendar View */}
            {viewMode === 'calendar' && (
              <CapacityCalendar 
                fromDate={fromDate || new Date().toISOString().split('T')[0]} 
                toDate={toDate || new Date().toISOString().split('T')[0]} 
                occupiedOrders={results.occupiedOrders} 
              />
            )}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

function CapacityCalendar({ fromDate, toDate, occupiedOrders }) {
  // Generate calendar months between fromDate and toDate
  const start = new HDate(new Date(fromDate));
  const end = new HDate(new Date(toDate));
  
  // We'll just display the month of fromDate for simplicity, or all months in range.
  // Let's generate a list of months to show
  const months = [];
  let curr = new HDate(1, start.getMonth(), start.getFullYear());
  while (curr.abs() <= end.abs() || (curr.getMonth() === end.getMonth() && curr.getFullYear() === end.getFullYear())) {
    months.push(new HDate(1, curr.getMonth(), curr.getFullYear()));
    if (curr.getMonth() === 13) {
      curr = new HDate(1, 1, curr.getFullYear() + 1); // Not quite right for Hebcal leap logic, but Hebcal has a better way
    } else {
      // Better way to add one month in Hebcal:
    }
    // Safer month iteration:
    const gregStart = curr.greg();
    gregStart.setDate(gregStart.getDate() + 30);
    curr = new HDate(gregStart);
    curr = new HDate(1, curr.getMonth(), curr.getFullYear());
  }

  // Deduplicate months
  const uniqueMonths = [];
  months.forEach(m => {
    if (!uniqueMonths.find(x => x.getMonth() === m.getMonth() && x.getFullYear() === m.getFullYear())) {
      uniqueMonths.push(m);
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {uniqueMonths.map((month, idx) => (
        <HebrewMonth 
          key={idx} 
          month={month} 
          occupiedOrders={occupiedOrders}
          fromDate={new Date(fromDate)}
          toDate={new Date(toDate)}
        />
      ))}
    </div>
  );
}

function HebrewMonth({ month, occupiedOrders, fromDate, toDate }) {
  const hMonthNum = month.getMonth();
  const hYear = month.getFullYear();
  const isLeap = month.isLeapYear();
  const hMonthName = getHebrewMonthName(hMonthNum, isLeap);
  const hYearString = getHebrewYearString(hYear);
  const daysInMonth = HDate.daysInMonth(hMonthNum, hYear);
  
  // Get all events for this Hebrew year, including sedrot (parashot)
  const allEvents = React.useMemo(() => {
    try {
      return HebrewCalendar.calendar({
        year: hYear,
        isHebrewYear: true,
        il: true,
        sedrot: true
      });
    } catch (e) {
      return [];
    }
  }, [hYear]);
  
  // Create grid
  const days = [];
  // Find day of week of 1st day (0 = Sun, 6 = Sat)
  const firstDay = month.greg().getDay();
  
  // padding
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const hd = new HDate(i, month.getMonth(), hYear);
    days.push(hd);
  }

  const isDayOccupied = (hd) => {
    const greg = hd.greg();
    // Reset time for fair comparison
    greg.setHours(0,0,0,0);
    
    // Calculate total quantity for this day
    let total = 0;
    occupiedOrders.forEach(order => {
      const start = new Date(order.eventDate);
      start.setHours(0,0,0,0);
      const end = order.returnDate ? new Date(order.returnDate) : new Date(order.eventDate);
      end.setHours(0,0,0,0);
      
      if (greg >= start && greg <= end) {
        total += order.quantity;
      }
    });
    return total;
  };

  const isDayInRange = (hd) => {
    const greg = hd.greg();
    greg.setHours(0,0,0,0);
    const s = new Date(fromDate); s.setHours(0,0,0,0);
    const e = new Date(toDate); e.setHours(0,0,0,0);
    return greg >= s && greg <= e;
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ backgroundColor: '#f8fafc', padding: '1rem', textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0' }}>
        {hMonthName} {hYearString}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: '#e2e8f0' }}>
        {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map(d => (
          <div key={d} style={{ padding: '0.5rem', textAlign: 'center', backgroundColor: 'var(--card-bg)', fontWeight: 'bold', fontSize: '0.85rem', color: '#64748b' }}>
            {d}
          </div>
        ))}
        {days.map((hd, i) => {
          if (!hd) return <div key={`empty-${i}`} style={{ backgroundColor: '#f8fafc' }} />;
          
          const inRange = isDayInRange(hd);
          const occQty = isDayOccupied(hd);
          const gregDay = hd.greg().getDate();
          const hebrewDay = HEBREW_DAYS[hd.getDate()];
          
          let holidays = [];
          try {
            const dayEvents = allEvents.filter(e => e.getDate().abs() === hd.abs());
            holidays = dayEvents.filter(e => {
              const flags = e.getFlags();
              if (flags & 8192) return false;
              return (flags & 1) || (flags & 524288) || (flags & 2097152) || (flags & 16384) || (flags & 256) || (flags & 1024);
            }).map(e => e.render('he'));
          } catch (e) {}

          return (
            <div key={i} style={{ 
              backgroundColor: inRange ? (occQty > 0 ? '#fee2e2' : '#f0fdf4') : 'var(--card-bg)',
              padding: '0.5rem', 
              minHeight: '80px',
              display: 'flex',
              flexDirection: 'column',
              opacity: inRange ? 1 : 0.5,
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1e293b' }}>{hebrewDay}</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{gregDay}</span>
              </div>
              {holidays.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#0369a1', marginTop: '2px', lineHeight: '1.1' }}>
                  {holidays.join(', ')}
                </div>
              )}
              {occQty > 0 && (
                <div style={{ marginTop: 'auto', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>
                  {occQty} תפוס
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
