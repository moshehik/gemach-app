'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, List, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import HebrewDatePicker from './HebrewDatePicker';
import HebrewDateRangePicker from './HebrewDateRangePicker';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { CapacityCalendar } from './CapacityCalendar';

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
  const [modelQuery, setModelQuery] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelSelectRef = useRef(null);

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

  // Keep the search box text in sync when barcodePrefix is set from elsewhere (e.g. history)
  useEffect(() => {
    if (!barcodePrefix) { setModelQuery(''); return; }
    const m = models.find(mm => mm.barcodePrefix === barcodePrefix);
    if (m) setModelQuery(`${m.name} (${m.barcodePrefix})`);
  }, [barcodePrefix, models]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelSelectRef.current && !modelSelectRef.current.contains(e.target)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = modelQuery.trim()
    ? models.filter(m => String(m.name || '').includes(modelQuery.trim()) || String(m.barcodePrefix || '').includes(modelQuery.trim()))
    : models;

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
          <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: 'var(--element-bg)', borderRadius: '12px', border: '1px solid var(--element-border)' }}>
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
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid var(--element-border)', background: 'var(--card-bg)', marginBottom: '0.5rem', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.9rem', flex: 1 }}>
                        <span style={{ minWidth: '120px' }}><strong>דגם:</strong> {modelName}</span>
                        <span style={{ minWidth: '80px' }}><strong>מידה:</strong> {h.size}</span>
                        {(fromHebrew || toHebrew) && (
                          <span style={{ minWidth: '180px' }}><strong>תאריכים:</strong> {fromHebrew} - {toHebrew}</span>
                        )}
                        {h.employeeCode && (
                          <span style={{ minWidth: '100px' }}><strong>עובד:</strong> {h.employeeCode}</span>
                        )}
                        <span style={{ color: 'var(--text-muted)' }}>{searchHebrewDate}, {searchTimeStr}</span>
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
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>לא נמצאו חיפושים</div>
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
          <div ref={modelSelectRef} style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#334155' }}>דגם</label>
            <input
              data-agy-id="capacity_search_model_select"
              type="text"
              className="form-select"
              value={modelQuery}
              onChange={e => {
                setModelQuery(e.target.value);
                setShowModelDropdown(true);
                if (barcodePrefix) { setBarcodePrefix(''); setSize(''); }
              }}
              onFocus={() => setShowModelDropdown(true)}
              placeholder="הקלד לחיפוש דגם..."
              autoComplete="off"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', boxSizing: 'border-box' }}
            />
            {showModelDropdown && filteredModels.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, left: 0, marginTop: '0.25rem',
                background: 'var(--card-bg, white)', border: '1px solid var(--element-border)', borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '220px', overflowY: 'auto', zIndex: 20
              }}>
                {filteredModels.map(m => (
                  <div
                    key={m.id || m.barcodePrefix}
                    onClick={() => {
                      setBarcodePrefix(m.barcodePrefix);
                      setModelQuery(`${m.name} (${m.barcodePrefix})`);
                      setSize('');
                      setShowModelDropdown(false);
                    }}
                    style={{ padding: '0.6rem 0.8rem', cursor: 'pointer', borderBottom: '1px solid var(--element-border)', textAlign: 'right' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {m.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>({m.barcodePrefix})</span>
                  </div>
                ))}
              </div>
            )}
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
                border: '1px solid var(--element-border)', 
                backgroundColor: (!barcodePrefix || sizes.length === 0) ? 'var(--element-bg)' : 'var(--card-bg)' 
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
              <div style={{ display: 'flex', background: 'var(--element-bg)', padding: '4px', borderRadius: '8px' }}>
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
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', backgroundColor: 'var(--element-bg)', borderRadius: '8px' }}>
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
